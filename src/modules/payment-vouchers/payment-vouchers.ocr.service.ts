import vision from "@google-cloud/vision";
import { env } from "../../config/env.js";

export interface VoucherOcrExtractedData {
  amount: string | null;
  operationId: string | null;
  operationDate: string | null;
  bank: string | null;
}

export interface VoucherOcrResult {
  provider: "google-vision";
  rawText: string;
  extracted: VoucherOcrExtractedData;
  warnings: string[];
  meta: {
    mimeType: string;
    pages: number;
    averageConfidence: number | null;
  };
}

let visionClient: vision.ImageAnnotatorClient | null = null;

type SupportedBank =
  | "BCP"
  | "INTERBANK"
  | "BBVA"
  | "SCOTIABANK"
  | "YAPE"
  | "PLIN"
  | "BANBIF";

interface OcrBlock {
  confidence?: number | null;
}

interface OcrPage {
  confidence?: number | null;
  blocks?: OcrBlock[] | null;
}

const getVisionClient = (): vision.ImageAnnotatorClient => {
  if (!visionClient) {
    visionClient = new vision.ImageAnnotatorClient();
  }

  return visionClient;
};

const normalizeSpaces = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const MONTH_INDEX_BY_NAME: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  setiembre: 9,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const toIsoDateParts = (
  day: number,
  month: number,
  rawYear: number,
): string | null => {
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
};

const toIsoDate = (value: string): string | null => {
  const match = value.match(
    /(?<day>\d{1,2})[/.-](?<month>\d{1,2})[/.-](?<year>\d{2,4})/,
  );
  if (!match?.groups) return null;

  const day = Number(match.groups.day);
  const month = Number(match.groups.month);
  const rawYear = Number(match.groups.year);

  return toIsoDateParts(day, month, rawYear);
};

const normalizeAmount = (rawValue: string): string | null => {
  const value = rawValue.trim();

  if (!value) return null;

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  const decimalSeparatorIndex = Math.max(lastComma, lastDot);

  if (decimalSeparatorIndex === -1) {
    const digitsOnly = value.replace(/[^\d]/g, "");
    return digitsOnly ? digitsOnly : null;
  }

  const integerPart = value
    .slice(0, decimalSeparatorIndex)
    .replace(/[^\d]/g, "");
  const decimalPart = value
    .slice(decimalSeparatorIndex + 1)
    .replace(/[^\d]/g, "");

  if (!integerPart || !decimalPart) return null;

  return `${integerPart}.${decimalPart.slice(0, 2)}`;
};

const extractAmount = (text: string): string | null => {
  const labeledPatterns = [
    /(?:importe|monto|monto\s+recibido|total|deposito|dep[oó]sito|importe\s+depositado)\s*[:-]?\s*(?:s\/.?|s\/|soles|usd|us\$|\$)?\s*(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d{2}))/i,
    /(?:s\/.?|s\/|soles|usd|us\$|\$)\s*(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d{2}))/i,
  ];

  for (const pattern of labeledPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return normalizeAmount(match[1]);
    }
  }

  return null;
};

const extractOperationId = (text: string): string | null => {
  const labeledPatterns = [
    /(?:n(?:[°ºo]\.?)?\s*ope(?:raci[oó]n)?|nro\.?\s*ope(?:raci[oó]n)?|n[úu]mero\s*de\s*ope(?:raci[oó]n)?|operaci[oó]n|operation\s*id|c[oó]digo\s*de\s*operaci[oó]n)\s*[:#.-]?\s*([A-Z0-9][A-Z0-9\s-]{5,}?)(?=\s*(?:[-–—]+\s*)?(?:importe|monto|fecha|hora|nombre|cta|cuenta|dep[oó]sito)\b|$)/i,
    /(?:voucher|constancia|transacci[oó]n)\s*[:#.-]?\s*([A-Z0-9][A-Z0-9\s-]{5,}?)(?=\s*(?:[-–—]+\s*)?(?:importe|monto|fecha|hora|nombre|cta|cuenta|deposito|dep[oó]sito)\b|$)/i,
  ];

  for (const pattern of labeledPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const tokens = match[1]
        .trim()
        .split(/\s+/)
        .map((token) => token.replace(/[^A-Z0-9-]/gi, ""))
        .filter(Boolean);

      const bestNumericToken = tokens.find((token) => /^\d{6,12}$/.test(token));
      if (bestNumericToken) {
        return bestNumericToken;
      }

      const cleaned = match[1].replace(/\s+/g, "").replace(/-+/g, "-").trim();

      if (cleaned.length >= 6) {
        return cleaned;
      }
    }
  }

  const labelIndex = text.search(
    /n(?:[°ºo]\.?)?\s*ope(?:raci[oó]n)?|nro\.?\s*ope(?:raci[oó]n)?|n[úu]mero\s*de\s*ope(?:raci[oó]n)?|operaci[oó]n|operation\s*id|c[oó]digo\s*de\s*operaci[oó]n/i,
  );

  if (labelIndex >= 0) {
    const nearbyText = text.slice(labelIndex, labelIndex + 180);
    const numericCandidates = nearbyText.match(/\b\d{6,12}\b/g) ?? [];
    if (numericCandidates.length > 0) {
      return numericCandidates[numericCandidates.length - 1] ?? null;
    }
  }

  return null;
};

const extractOperationDate = (text: string): string | null => {
  const labeledPatterns = [
    /(?:fecha|fec\.?|fecha\s+de\s+operaci[oó]n|f\.?\s*operaci[oó]n)\s*[:-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i,
    /(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/,
  ];

  for (const pattern of labeledPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return toIsoDate(match[1]);
    }
  }

  const monthDateMatch = text.match(
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{2,4})|(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\s+(\d{2,4})/i,
  );

  if (monthDateMatch) {
    const dayText = monthDateMatch[1] ?? monthDateMatch[4];
    const monthText = monthDateMatch[2] ?? monthDateMatch[5];
    const yearText = monthDateMatch[3] ?? monthDateMatch[6];

    if (dayText && monthText && yearText) {
      const month = MONTH_INDEX_BY_NAME[monthText.toLowerCase()];
      if (month) {
        return toIsoDateParts(Number(dayText), month, Number(yearText));
      }
    }
  }

  return null;
};

export const extractVoucherDataFromText = (
  rawText: string,
): VoucherOcrExtractedData => {
  const normalized = normalizeSpaces(rawText);

  return {
    amount: extractAmount(normalized),
    operationId: extractOperationId(normalized),
    operationDate: extractOperationDate(normalized),
    bank: extractBank(normalized),
  };
};

const extractBank = (text: string): string | null => {
  const upper = text.toUpperCase();

  const bankPatterns: Array<{ bank: SupportedBank; pattern: RegExp }> = [
    {
      bank: "BCP",
      pattern: /\b(?:BCP|BANCO\s+DE\s+CREDITO|BANCO\s+DE\s+CR[EE]DITO)\b/i,
    },
    { bank: "INTERBANK", pattern: /\b(?:INTERBANK|INTER\s+BANK)\b/i },
    {
      bank: "BBVA",
      pattern: /\b(?:BBVA|BBVA\s+CONTINENTAL|BANCO\s+CONTINENTAL)\b/i,
    },
    { bank: "SCOTIABANK", pattern: /\b(?:SCOTIABANK|SCOTIA\s+BANK)\b/i },
    { bank: "YAPE", pattern: /\bYAPE\b/i },
    { bank: "PLIN", pattern: /\bPLIN\b/i },
  ];

  for (const { bank, pattern } of bankPatterns) {
    if (pattern.test(upper)) {
      return bank;
    }
  }

  return null;
};

const collectConfidence = (
  pages: OcrPage[] | null | undefined,
): number | null => {
  if (!pages?.length) return null;

  const confidenceValues: number[] = [];

  for (const page of pages) {
    if (typeof page.confidence === "number")
      confidenceValues.push(page.confidence);

    for (const block of page.blocks ?? []) {
      if (typeof block.confidence === "number")
        confidenceValues.push(block.confidence);
    }
  }

  if (!confidenceValues.length) return null;

  const average =
    confidenceValues.reduce((sum, value) => sum + value, 0) /
    confidenceValues.length;
  return Number(average.toFixed(4));
};

const buildWarnings = (
  rawText: string,
  extracted: VoucherOcrExtractedData,
): string[] => {
  const warnings: string[] = [];

  if (!rawText.trim()) {
    warnings.push("No se detectó texto en la imagen.");
  }
  if (!extracted.amount) {
    warnings.push("No se pudo identificar el monto del comprobante.");
  }
  if (!extracted.operationId) {
    warnings.push("No se pudo identificar el número de operación.");
  }
  if (!extracted.operationDate) {
    warnings.push("No se pudo identificar la fecha de operación.");
  }

  return warnings;
};

export const analyzeVoucherImage = async (
  buffer: Buffer,
  mimeType: string,
): Promise<VoucherOcrResult> => {
  if (!env.OCR_ENABLED) {
    throw new Error("El OCR está deshabilitado en este entorno");
  }

  const client = getVisionClient();
  const [result] = await client.documentTextDetection({
    image: {
      content: buffer.toString("base64"),
    },
    imageContext: {
      languageHints: ["es", "en"],
    },
  });

  const rawText = normalizeSpaces(
    result.fullTextAnnotation?.text ||
      result.textAnnotations?.[0]?.description ||
      "",
  );

  const extracted = extractVoucherDataFromText(rawText);

  return {
    provider: env.OCR_PROVIDER,
    rawText,
    extracted,
    warnings: buildWarnings(rawText, extracted),
    meta: {
      mimeType,
      pages: result.fullTextAnnotation?.pages?.length || 0,
      averageConfidence: collectConfidence(result.fullTextAnnotation?.pages),
    },
  };
};
