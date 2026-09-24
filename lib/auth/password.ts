import crypto from "crypto";

const DEFAULT_ITERATIONS = 210000;
const LEGACY_ITERATIONS = 1000;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, DEFAULT_ITERATIONS, 64, "sha512").toString("hex");
  return `${salt}:${hash}:${DEFAULT_ITERATIONS}`;
}

export function verifyPassword(password: string, combinedHash: string): boolean {
  const parts = combinedHash.split(":");
  if (parts.length < 2) return false;
  const salt = parts[0];
  const originalHash = parts[1];
  const iterations = parts[2] ? parseInt(parts[2], 10) : LEGACY_ITERATIONS;

  const verifyHash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(originalHash, "hex"), Buffer.from(verifyHash, "hex"));
  } catch {
    return false;
  }
}

