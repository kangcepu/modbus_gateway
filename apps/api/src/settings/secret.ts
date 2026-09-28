import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
function encryptionKey() {
  const key = Buffer.from(process.env.SETTINGS_ENCRYPTION_KEY || "", "hex");
  if (key.length !== 32)
    throw new Error("SETTINGS_ENCRYPTION_KEY harus berupa 64 karakter hex.");
  return key;
}
export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}
export function decryptSecret(value: string): string {
  if (!value) return "";
  const [iv, tag, encrypted] = value.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
