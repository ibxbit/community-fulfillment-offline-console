import { getWebCrypto } from "../utils/webCrypto";

const PBKDF2_HASH = "SHA-256";
const PBKDF2_ITERATIONS = 120000;
const PBKDF2_KEY_LENGTH = 256;

function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export function createSalt(byteLength = 16) {
  const salt = getWebCrypto().getRandomValues(new Uint8Array(byteLength));
  return toBase64(salt);
}

export async function hashPassword(
  password,
  saltBase64,
  iterations = PBKDF2_ITERATIONS,
) {
  const { subtle } = getWebCrypto();
  const encoder = new TextEncoder();
  const passwordKey = await subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const saltBytes = fromBase64(saltBase64);
  const derived = await subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations,
      hash: PBKDF2_HASH,
    },
    passwordKey,
    PBKDF2_KEY_LENGTH,
  );

  return toBase64(new Uint8Array(derived));
}

export async function verifyPassword(
  password,
  passwordHash,
  saltBase64,
  iterations,
) {
  const computed = await hashPassword(password, saltBase64, iterations);
  return computed === passwordHash;
}

export { PBKDF2_ITERATIONS };
