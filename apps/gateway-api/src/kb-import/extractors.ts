import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { KbImportAsset } from "./types";

const WINDOWS_COMMAND_FALLBACKS: Record<string, string[]> = {
  tesseract: [
    String.raw`C:\Program Files\Tesseract-OCR\tesseract.exe`,
    String.raw`C:\Program Files (x86)\Tesseract-OCR\tesseract.exe`,
  ],
};

async function isExecutableAvailable(target: string): Promise<boolean> {
  try {
    await run(target, ["--version"], 5000);
    return true;
  } catch {
    return false;
  }
}

export async function resolveCommand(command: string): Promise<string | null> {
  const probe = process.platform === "win32" ? "where" : "which";
  const discovered = await new Promise<string | null>((resolve) => {
    execFile(probe, [command], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      const first = String(stdout || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
      resolve(first || null);
    });
  });

  if (discovered) {
    return discovered;
  }

  if (process.platform !== "win32") {
    return null;
  }

  const fallbacks = WINDOWS_COMMAND_FALLBACKS[command] || [];
  for (const candidate of fallbacks) {
    if (await isExecutableAvailable(candidate)) {
      return candidate;
    }
  }

  return null;
}

function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = process.platform === "win32" ? "where" : "which";
    execFile(probe, [command], { timeout: 5000 }, (error) => resolve(!error));
  });
}

function run(command: string, args: string[], timeoutMs = 120000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const detail = stderr || stdout || error.message;
        reject(new Error(`${command} failed: ${detail}`));
        return;
      }
      resolve({ stdout: String(stdout || ""), stderr: String(stderr || "") });
    });
  });
}

function stripHtml(input: string): string {
  return input.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function extractTextFromAsset(asset: KbImportAsset): Promise<{ text: string; method: string; confidence: number }> {
  const ext = (asset.extension || path.extname(asset.originalName)).toLowerCase();
  if ([".txt", ".md", ".csv", ".json"].includes(ext)) {
    return { text: await readFile(asset.storedPath, "utf8"), method: "direct-text", confidence: 0.95 };
  }
  if ([".html", ".htm"].includes(ext)) {
    const html = await readFile(asset.storedPath, "utf8");
    return { text: stripHtml(html), method: "html-strip", confidence: 0.85 };
  }
  if (ext === ".pdf") {
    const pdftotextCommand = await resolveCommand("pdftotext");
    if (pdftotextCommand) {
      const tmp = path.join(os.tmpdir(), `kb-import-${asset.id}.txt`);
      await run(pdftotextCommand, ["-layout", asset.storedPath, tmp], 120000);
      const text = await readFile(tmp, "utf8");
      await rm(tmp, { force: true });
      if (text.trim()) return { text, method: "pdftotext", confidence: 0.9 };
    }
    throw new Error("PDF extraction requires pdftotext or an OCR fallback worker.");
  }
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
    const tesseractCommand = await resolveCommand("tesseract");
    if (!tesseractCommand) {
      throw new Error("Image OCR requires tesseract in PATH with ara/eng traineddata.");
    }
    const outBase = path.join(os.tmpdir(), `kb-import-${asset.id}`);
    await run(tesseractCommand, [asset.storedPath, outBase, "-l", process.env.KB_IMPORT_OCR_LANGS || "ara+eng"], 180000);
    const textPath = `${outBase}.txt`;
    const text = await readFile(textPath, "utf8");
    await rm(textPath, { force: true });
    return { text, method: "tesseract", confidence: text.trim() ? 0.8 : 0.2 };
  }
  if (ext === ".docx") {
    throw new Error("DOCX extraction requires mammoth integration. Package dependency is reported by APEX.");
  }
  throw new Error(`Unsupported extraction type: ${ext || "unknown"}`);
}