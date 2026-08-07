import fs from "node:fs";
import readline from "node:readline";

export async function readJsonl<T>(filePath: string): Promise<T[]> {
  const out: T[] = [];
  if (!fs.existsSync(filePath)) return out;

  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      // skip malformed lines
    }
  }
  return out;
}
