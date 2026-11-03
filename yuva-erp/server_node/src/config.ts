// Settings. Values come from environment variables, or from server_node/.env (not part of git).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'); // server_node/
export const PROJECT = path.join(ROOT, '..'); // yuva-erp/

/** Reads KEY=VALUE lines. Variables that are already set are not replaced. */
export function loadDotenv(file: string): void {
  let lines: string[];
  try {
    lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
  } catch {
    return;
  }
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const at = line.indexOf('=');
    const key = line.slice(0, at).trim();
    const value = line
      .slice(at + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function loadEnvFiles(): void {
  if (process.env.ACADEMIA_NO_DOTENV === '1') return; // the tests must never read the real .env files
  loadDotenv(path.join(ROOT, '.env'));
}

export function settings() {
  loadEnvFiles();
  const env = process.env;
  return {
    mongodbUri: env.MONGODB_URI || '',
    mongodbDb: env.MONGODB_DB || 'academiaos',
    host: env.DB_HOST || '0.0.0.0',
    // hosting services (Render...) tell the program its port in PORT
    port: parseInt(env.DB_PORT || env.PORT || '3001', 10),
    distDir: env.DIST_DIR || path.join(PROJECT, 'dist'),
    legacyFile: path.join(PROJECT, 'server', 'data', 'db.json'),
  };
}
