import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { KbImportAsset, KbImportSourceType } from "./types";

const allowedExtensions = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".txt", ".md", ".html", ".htm", ".csv", ".json", ".docx"
]);

export function sanitizeOriginalName(name: string): string {
  return String(name || "source")
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "source";
}

export function detectSourceType(filename: string): KbImportSourceType {
  const ext = path.extname(filename).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  if ([".html", ".htm"].includes(ext)) return "html";
  if (ext === ".csv") return "csv";
  if (ext === ".json") return "json";
  if ([".txt", ".md"].includes(ext)) return "text";
  return "unknown";
}

export function assertAllowedExtension(filename: string): void {
  const ext = path.extname(filename).toLowerCase();
  if (!allowedExtensions.has(ext)) {
    throw new Error(`Unsupported KB import file extension: ${ext || "none"}`);
  }
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });
  return hash.digest("hex");
}

export async function buildAssetFromStoredFile(input: {
  originalName: string;
  storedPath: string;
  mimeType?: string;
}): Promise<KbImportAsset> {
  const clean = sanitizeOriginalName(input.originalName);
  assertAllowedExtension(clean);
  const info = await stat(input.storedPath);
  const sha256 = await sha256File(input.storedPath);
  return {
    id: randomUUID(),
    originalName: clean,
    storedName: path.basename(input.storedPath),
    storedPath: input.storedPath,
    sha256,
    bytes: info.size,
    mimeType: input.mimeType,
    extension: path.extname(clean).toLowerCase(),
  };
}