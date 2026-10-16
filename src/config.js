import process from 'node:process';

try {
  process.loadEnvFile();
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Environment variable ${name} belum diisi. Salin .env.example menjadi .env lalu isi nilainya.`);
  }
  return value;
}

const MIN_INTERVAL_SECONDS = 30;

export const config = Object.freeze({
  token: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  guildId: required('GUILD_ID'),
  databasePath: process.env.DATABASE_PATH?.trim() || './data/kirana.db',
  updateIntervalSeconds: Math.max(
    MIN_INTERVAL_SECONDS,
    Number.parseInt(process.env.UPDATE_INTERVAL_SECONDS ?? '', 10) || 60,
  ),
});
