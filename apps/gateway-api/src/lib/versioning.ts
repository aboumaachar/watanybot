/**
 * KB versioning utilities extracted from server.ts
 */
import fs from "node:fs";
import path from "node:path";

export async function loadJsonFile<T>(p: string, fallback: T): Promise<T> {
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = await fs.promises.readFile(p, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile<T>(p: string, data: T) {
  const json = JSON.stringify(data, null, 2);
  try {
    const tmp = `${p}.tmp`;
    await fs.promises.writeFile(tmp, json, 'utf8');
    await fs.promises.rename(tmp, p);
  } catch {
    try {
      await fs.promises.writeFile(p, json, 'utf8');
    } catch {
      // silently fail
    }
  }
}

export function createVersioningService(versionsDir: string) {
  fs.mkdirSync(versionsDir, { recursive: true });
  const versionsIndexPath = path.join(versionsDir, 'versions.json');

  async function addVersionEntry(fileRelPath: string, note = '', srcRoot: string) {
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const base = path.basename(fileRelPath);
      const verName = `${base}.${ts}`;
      const dst = path.join(versionsDir, verName);
      const abs = path.resolve(srcRoot, fileRelPath);
      if (fs.existsSync(abs)) {
        await fs.promises.copyFile(abs, dst);
      } else {
        await writeJsonFile(dst, { createdAt: new Date().toISOString(), note });
      }
      const idx = await loadJsonFile<Record<string, any>[]>(versionsIndexPath, []);
      idx.unshift({ id: verName, file: base, path: dst, ts: new Date().toISOString(), note });
      while (idx.length > 20) idx.pop();
      await writeJsonFile(versionsIndexPath, idx);
      return { ok: true, id: verName, path: dst };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  async function listVersions(fileFilter?: string) {
    const all = await loadJsonFile<Record<string, any>[]>(versionsIndexPath, []);
    return fileFilter ? all.filter((v) => v.file === fileFilter) : all;
  }

  async function restoreVersion(versionId: string) {
    try {
      const idx = await loadJsonFile<Record<string, any>[]>(versionsIndexPath, []);
      const entry = idx.find((v) => v.id === versionId);
      if (!entry) return { ok: false, error: 'version not found' };
      const target = path.resolve(entry.path);
      const dest = path.resolve(versionsDir, '../../', entry.file);
      await fs.promises.copyFile(target, dest);
      return { ok: true, restored: dest };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  return { addVersionEntry, listVersions, restoreVersion };
}
