import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rename, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const EXTENSION_TO_MIME = Object.fromEntries(
  Object.entries(MIME_TO_EXTENSION).map(([mime, extension]) => [extension, mime]),
) as Record<string, string>;

export const ARTICLE_MEDIA_MAX_BYTES = 25 * 1024 * 1024;

export function articleMediaDir(): string {
  const configured = String(process.env.WATANY_ARTICLE_MEDIA_DIR || "").trim();
  return configured || path.join(os.homedir(), ".watany", "article-media");
}

export function extensionForMime(mimeType: string): string | null {
  return MIME_TO_EXTENSION[mimeType.toLowerCase()] || null;
}

export function mimeForMediaFile(fileName: string): string | null {
  const extension = path.extname(fileName).slice(1).toLowerCase();
  return EXTENSION_TO_MIME[extension] || null;
}

function hasExpectedSignature(mimeType: string, data: Buffer): boolean {
  if (mimeType === "image/jpeg") return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (mimeType === "image/png") return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/gif") return data.subarray(0, 6).toString("ascii") === "GIF87a" || data.subarray(0, 6).toString("ascii") === "GIF89a";
  if (mimeType === "image/webp") return data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP";
  if (mimeType === "application/pdf") return data.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "video/mp4") return data.length >= 12 && data.subarray(4, 8).toString("ascii") === "ftyp";
  if (mimeType === "video/webm") return data.length >= 4 && data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3;
  return false;
}

export function isSafeMediaFileName(value: string): boolean {
  return /^[0-9a-f-]+\.(?:jpg|png|webp|gif|pdf|mp4|webm)$/iu.test(value);
}

export async function writeArticleMedia(input: { mimeType: string; data: Buffer }) {
  const extension = extensionForMime(input.mimeType);
  if (!extension) throw new Error("ARTICLE_MEDIA_TYPE_NOT_ALLOWED");
  if (input.data.length <= 0 || input.data.length > ARTICLE_MEDIA_MAX_BYTES) throw new Error("ARTICLE_MEDIA_SIZE_INVALID");
  if (!hasExpectedSignature(input.mimeType, input.data)) throw new Error("ARTICLE_MEDIA_SIGNATURE_INVALID");
  const fileName = `${randomUUID()}.${extension}`;
  const root = articleMediaDir();
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, fileName), input.data, { flag: "wx", mode: 0o640 });
  return {
    fileName,
    url: `/api/articles/media/${fileName}`,
    mimeType: input.mimeType,
    size: input.data.length,
  };
}

export async function replaceArticleMedia(input: { fileName: string; mimeType: string; data: Buffer }) {
  const extension = extensionForMime(input.mimeType);
  if (!extension) throw new Error("ARTICLE_MEDIA_TYPE_NOT_ALLOWED");
  if (!isSafeMediaFileName(input.fileName)) throw new Error("ARTICLE_MEDIA_FILE_NAME_INVALID");
  if (path.extname(input.fileName).slice(1).toLowerCase() !== extension) throw new Error("ARTICLE_MEDIA_TYPE_MISMATCH");
  if (input.data.length <= 0 || input.data.length > ARTICLE_MEDIA_MAX_BYTES) throw new Error("ARTICLE_MEDIA_SIZE_INVALID");
  if (!hasExpectedSignature(input.mimeType, input.data)) throw new Error("ARTICLE_MEDIA_SIGNATURE_INVALID");
  const target = resolveArticleMediaPath(input.fileName);
  if (!target) throw new Error("ARTICLE_MEDIA_FILE_NAME_INVALID");
  const current = await stat(target).catch(() => null);
  if (!current?.isFile()) throw new Error("ARTICLE_MEDIA_NOT_FOUND");
  const revisionDir = path.join(articleMediaDir(), ".revisions");
  await mkdir(revisionDir, { recursive: true });
  const backup = path.join(revisionDir, `${input.fileName}.${Date.now()}.bak`);
  await copyFile(target, backup);
  const temp = `${target}.replacement-${randomUUID()}`;
  await writeFile(temp, input.data, { flag: "wx", mode: current.mode & 0o777 });
  await rename(temp, target);
  return { fileName: input.fileName, url: `/api/articles/media/${input.fileName}`, mimeType: input.mimeType, size: input.data.length, backup };
}

export function resolveArticleMediaPath(fileName: string): string | null {
  if (!isSafeMediaFileName(fileName)) return null;
  const root = articleMediaDir();
  const resolved = path.resolve(root, fileName);
  return resolved.startsWith(path.resolve(root) + path.sep) ? resolved : null;
}
