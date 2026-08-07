import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "node:child_process";
import { resolveCommand } from "../kb-import/extractors";

type ExecFileCallback = (error: Error | null, stdout?: string, stderr?: string) => void;

describe("kb-import extractor command resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses discovered command path when where succeeds", async () => {
    vi.mocked(execFile).mockImplementation((command, args, options, callback) => {
      const cb = callback as ExecFileCallback;
      if (command === "where" && Array.isArray(args) && args[0] === "tesseract") {
        cb(null, "C:\\tools\\tesseract.exe\r\n", "");
        return {} as never;
      }
      cb(new Error("unexpected call"), "", "");
      return {} as never;
    });

    const resolved = await resolveCommand("tesseract");
    expect(resolved).toBe("C:\\tools\\tesseract.exe");
  });

  it("falls back to absolute Windows tesseract path when where fails", async () => {
    vi.mocked(execFile).mockImplementation((command, args, options, callback) => {
      const cb = callback as ExecFileCallback;
      const firstArg = Array.isArray(args) ? String(args[0] || "") : "";

      if (command === "where" && firstArg === "tesseract") {
        cb(new Error("not found"), "", "");
        return {} as never;
      }

      if (String(command).toLowerCase() === "c:\\program files\\tesseract-ocr\\tesseract.exe" && firstArg === "--version") {
        cb(null, "tesseract 5.5.0\n", "");
        return {} as never;
      }

      cb(new Error(`unexpected call: ${String(command)} ${firstArg}`), "", "");
      return {} as never;
    });

    const resolved = await resolveCommand("tesseract");
    expect(resolved).toBe("C:\\Program Files\\Tesseract-OCR\\tesseract.exe");
  });

  it("returns null when command has no discovered path and no fallback", async () => {
    vi.mocked(execFile).mockImplementation((command, args, options, callback) => {
      const cb = callback as ExecFileCallback;
      if (command === "where" && Array.isArray(args) && args[0] === "pdftotext") {
        cb(new Error("not found"), "", "");
        return {} as never;
      }
      cb(new Error("unexpected call"), "", "");
      return {} as never;
    });

    const resolved = await resolveCommand("pdftotext");
    expect(resolved).toBeNull();
  });
});
