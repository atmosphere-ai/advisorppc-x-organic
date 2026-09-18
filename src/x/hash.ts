import { createHash } from "node:crypto";

export function sha256Hex(value: string | Buffer): string {
  const hash = createHash("sha256");
  if (typeof value === "string") hash.update(value, "utf8");
  else hash.update(value);
  return hash.digest("hex");
}

/** Strip leading @ and lowercase. Used before user lookup so we never invent handles. */
export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

export function isHandle(value: string): boolean {
  return /^[A-Za-z0-9_]{1,15}$/.test(normalizeHandle(value));
}

export function containsLink(text: string): boolean {
  return /https?:\/\/\S+/i.test(text);
}

/** Fingerprint uploaded bytes so operators can prove which asset went up. Never a substitute id. */
export function mediaFingerprint(buf: Buffer): string {
  return sha256Hex(buf);
}
