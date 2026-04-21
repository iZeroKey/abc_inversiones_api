import 'dotenv/config';
import postgres from 'postgres';
import { env } from '../config/env.js';

async function setDatabaseTimezone() {
  const sql = postgres(process.env.DATABASE_URL!);
  console.log(`[Timezone] Ajustando base de datos a: ${env.APP_TIMEZONE}...`);
  
  try {
    await sql`ALTER DATABASE postgres SET timezone TO ${sql(env.APP_TIMEZONE)};`;
    console.log('[Timezone] ¡Zona horaria actualizada con éxito!');
  } catch (error) {
    console.error('[Timezone] Error al ajustar la zona horaria:', error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

setDatabaseTimezone();
