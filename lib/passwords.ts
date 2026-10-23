import {
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
const ITERATIONS = 600000;
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `pbkdf2-sha256$${ITERATIONS}$${salt}$${pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256").toString("hex")}`;
}
export function passwordMatches(password: string, encoded: string) {
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
export const DUMMY_PASSWORD_HASH = `pbkdf2-sha256$${ITERATIONS}$00000000000000000000000000000000$${"0".repeat(64)}`;
