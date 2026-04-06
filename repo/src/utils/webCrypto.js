export function getWebCrypto() {
  const webCrypto = globalThis.crypto;

  if (
    !webCrypto ||
    typeof webCrypto.getRandomValues !== "function" ||
    !webCrypto.subtle
  ) {
    throw new Error(
      "Web Crypto API is unavailable. Use a browser secure context or Node.js v20+.",
    );
  }

  return webCrypto;
}
