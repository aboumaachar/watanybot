// Loads local KB JSON files for salary, aids, ornaments, etc.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadLocalKB(kbName) {
  let fileName = `${kbName}.json`;
  if (kbName === 'salaries') fileName = 'salariesIndex.json';
  
  // Use KB_DATA_ROOT env var if set (production), else fall back to monorepo structure
  const kbRoot = process.env.KB_DATA_ROOT
    ? path.join(process.env.KB_DATA_ROOT, 'kb')
    : path.join(path.resolve(__dirname, '../../../../'), 'kb');
  
  const kbPath = path.join(kbRoot, kbName, fileName);
  if (!fs.existsSync(kbPath)) {
    console.warn(`[loadLocalKB] KB file not found (non-fatal): ${kbPath}`);
    return [];
  }
  return JSON.parse(fs.readFileSync(kbPath, 'utf8'));
}
