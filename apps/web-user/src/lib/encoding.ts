/**
 * UTF-8 / Mojibake repair utilities for Arabic text.
 * Shared across ChatMessageView, UserWindow, VoiceMode, etc.
 */

export function countArabic(text: string): number {
  const matches = text.match(/[\u0600-\u06FF]/g);
  return matches ? matches.length : 0;
}

/**
 * Attempt to repair mojibake (UTF-8 bytes misinterpreted as Latin-1).
 * Works by re-encoding the string as Latin-1 bytes and then decoding as UTF-8.
 * If the result contains more Arabic characters, it was likely mojibake.
 */
export function fixMojibake(text: string): string {
  // No-op: server now emits correct UTF-8. Keep function to avoid breaking imports.
  return text;
}
