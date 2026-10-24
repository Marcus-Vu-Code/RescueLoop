import {
  pbkdf2Sync,
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
const ITERATIONS = 600000;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$32768$8$3$${salt}$${scryptSync(password, salt, 32, SCRYPT_OPTIONS).toString("hex")}`;
}
export function passwordMatches(password: string, encoded: string) {
  if (encoded.startsWith("scrypt$")) {
    const [kind, n, r, p, salt, hex] = encoded.split("$");
    if (
      n !== "32768" ||
      r !== "8" ||
      p !== "3" ||
      !/^[a-f0-9]{32}$/.test(salt || "") ||
      !/^[a-f0-9]{64}$/.test(hex || "")
    )
      return false;
    return timingSafeEqual(
      scryptSync(password, salt, 32, SCRYPT_OPTIONS),
      Buffer.from(hex, "hex"),
    );
  }
  const [kind, count, salt, hex] = encoded.split("$");
  if (
    kind !== "pbkdf2-sha256" ||
    Number(count) !== ITERATIONS ||
    !/^[a-f0-9]{32}$/.test(salt || "") ||
    !/^[a-f0-9]{64}$/.test(hex || "")
  )
    return false;
  const actual = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  return timingSafeEqual(actual, Buffer.from(hex, "hex"));
}
export function token() {
  return randomBytes(32).toString("base64url");
}
export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function equalDigest(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
export const DUMMY_PASSWORD_HASH = `scrypt$32768$8$3$00000000000000000000000000000000$${"0".repeat(64)}`;
