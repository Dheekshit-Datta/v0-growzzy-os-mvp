import crypto from "crypto"

function getKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be set to a 64-char hex string (32 bytes). Generate one with: node -e "console.log(require(\\"crypto\\").randomBytes(32).toString(\\"hex\\"))"'
    )
  }
  return Buffer.from(key, "hex")
}

export function encrypt(text: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  const tag = cipher.getAuthTag().toString("hex")
  return `gcm:${iv.toString("hex")}:${tag}:${encrypted}`
}

export function decrypt(text: string): string {
  const key = getKey()

  if (text.startsWith("gcm:")) {
    const [, ivHex, tagHex, ciphertext] = text.split(":")
    if (!ivHex || !tagHex || !ciphertext) throw new Error("Invalid encrypted value format")
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"))
    decipher.setAuthTag(Buffer.from(tagHex, "hex"))
    let decrypted = decipher.update(ciphertext, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  }

  const [ivHex, ciphertext] = text.split(":")
  if (!ivHex || !ciphertext) throw new Error("Invalid encrypted value format")
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, Buffer.from(ivHex, "hex"))
  let decrypted = decipher.update(ciphertext, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}
