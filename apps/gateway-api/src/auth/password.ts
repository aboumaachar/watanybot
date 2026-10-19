/** Password hashing utilities: native bcrypt plus legacy WordPress verification. */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;
const PHPASS_ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function isLegacyWordpressPasswordHash(hash: string): boolean {
  return hash.startsWith("$P$") || hash.startsWith("$H$") || hash.startsWith("$wp$");
}

function phpassEncode64(input: Buffer, count: number): string {
  let output = "";
  let i = 0;
  do {
    let value = input[i++];
    output += PHPASS_ITOA64[value & 0x3f];
    if (i < count) value |= input[i] << 8;
    output += PHPASS_ITOA64[(value >> 6) & 0x3f];
    if (i++ >= count) break;
    if (i < count) value |= input[i] << 16;
    output += PHPASS_ITOA64[(value >> 12) & 0x3f];
    if (i++ >= count) break;
    output += PHPASS_ITOA64[(value >> 18) & 0x3f];
  } while (i < count);
  return output;
}
function verifyPortablePhpass(plain: string, stored: string): boolean {
  if (plain.length > 4096 || stored.length < 34) return false;
  const countLog2 = PHPASS_ITOA64.indexOf(stored[3]);
  if (countLog2 < 7 || countLog2 > 30) return false;
  const salt = stored.slice(4, 12);
  if (salt.length !== 8) return false;
  const password = Buffer.from(plain, "utf8");
  let digest = createHash("md5").update(Buffer.concat([Buffer.from(salt, "utf8"), password])).digest();
  let count = 1 << countLog2;
  while (count-- > 0) {
    digest = createHash("md5").update(Buffer.concat([digest, password])).digest();
  }
  const candidate = `${stored.slice(0, 12)}${phpassEncode64(digest, 16)}`.slice(0, 34);
  const expected = stored.slice(0, 34);
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  if (hash.startsWith("$P$") || hash.startsWith("$H$")) return verifyPortablePhpass(plain, hash);
  if (hash.startsWith("$wp$")) {
    const prehashed = createHmac("sha384", "wp-sha384").update(plain, "utf8").digest("base64");
    return bcrypt.compare(prehashed, hash.slice(3));
  }
  return bcrypt.compare(plain, hash);
}
