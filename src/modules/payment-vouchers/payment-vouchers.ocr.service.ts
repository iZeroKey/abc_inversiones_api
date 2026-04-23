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

const SUPPORTED_BANKS = [
  "BCP",
  "INTERBANK",
  "BBVA",
  "SCOTIABANK",
  "YAPE",
  "PLIN",
  "BANBIF",
] as const;

const getVisionClient = (): vision.ImageAnnotatorClient => {
  if (!visionClient) {
    visionClient = new vision.ImageAnnotatorClient();
  }

  return visionClient;
};

const normalizeSpaces = (value: string): string => value.replace(/\s+/g, " ").trim();

const toIsoDate = (value: string): string | null => {
  const match = value.match(/(?<day>\d{2})[\/.-](?<month>\d{2})[\/.-](?<year>\d{2,4})/);
  if (!match?.groups) return null;

  const day = Number(match.groups.day);
  const month = Number(match.groups.month);
  const rawYear = Number(match.groups.year);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
};

const extractAmount = (text: string): string | null => {
  const labeledPatterns = [
    /(?:importe|monto|total|deposito|dep[oó]sito)\s*[:\-]?\s*(?:s\/\.?|s\/|usd|\$)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d{2}))/i,
    /(?:s\/\.?|s\/|\$|usd)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d{2}))/i,
  ];

  for (const pattern of labeledPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/,/g, ".");
    }
  }

  return null;
};

const extractOperationId = (text: string): string | null => {
  const labeledPatterns = [
    /(?:operaci[oó]n|operation id|n[úu]mero de operaci[oó]n|codigo de operaci[oó]n|nro\.?\s*operaci[oó]n)\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
    /(?:voucher|constancia|transacci[oó]n)\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
  ];

  for (const pattern of labeledPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
};

const extractOperationDate = (text: string): string | null => {
  const labeledPatterns = [
    /(?:fecha|fecha de operaci[oó]n|f\.?\s*operaci[oó]n)\s*[:\-]?\s*(\d{2}[\/.-]\d{2}[\/.-]\d{2,4})/i,
    /(\d{2}[\/.-]\d{2}[\/.-]\d{2,4})/,
  ];

  for (const pattern of labeledPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return toIsoDate(match[1]);
    }
  }

  return null;
};

const extractBank = (text: string): string | null => {
  const upper = text.toUpperCase();

  for (const bank of SUPPORTED_BANKS) {
    if (upper.includes(bank)) {
      return bank;
    }
  }

  return null;
};

const collectConfidence = (pages: any[] | null | undefined): number | null => {
  if (!pages?.length) return null;

  const confidenceValues: number[] = [];

  for (const page of pages) {
    if (typeof page.confidence === "number") confidenceValues.push(page.confidence);

    for (const block of page.blocks ?? []) {
      if (typeof block.confidence === "number") confidenceValues.push(block.confidence);
    }
  }

  if (!confidenceValues.length) return null;

  const average = confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length;
  return Number(average.toFixed(4));
};

const buildWarnings = (rawText: string, extracted: VoucherOcrExtractedData): string[] => {
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
    result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description || "",
  );

  const extracted: VoucherOcrExtractedData = {
    amount: extractAmount(rawText),
    operationId: extractOperationId(rawText),
    operationDate: extractOperationDate(rawText),
    bank: extractBank(rawText),
  };

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
