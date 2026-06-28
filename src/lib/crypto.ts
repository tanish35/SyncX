const ALGO = "AES-GCM";
const IV_LENGTH = 12;

function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getCryptoKey(rawBase64: string): Promise<CryptoKey> {
  const raw = base64urlDecode(rawBase64);
  return crypto.subtle.importKey("raw", raw as unknown as ArrayBuffer, ALGO, false, ["encrypt", "decrypt"]);
}

export async function encryptCredential(value: unknown, keyBase64: string): Promise<string> {
  const key = await getCryptoKey(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, key, plaintext);
  return `${base64urlEncode(iv)}.${base64urlEncode(ciphertext)}`;
}

export async function decryptCredential<T>(blob: string, keyBase64: string): Promise<T> {
  const [ivPart, ctPart] = blob.split(".");
  if (!ivPart || !ctPart) throw new Error("Invalid credential blob format");
  const key = await getCryptoKey(keyBase64);
  const iv = base64urlDecode(ivPart);
  const ciphertext = base64urlDecode(ctPart);
  const plaintext = await crypto.subtle.decrypt({ name: ALGO, iv: iv as unknown as ArrayBuffer }, key, ciphertext as unknown as ArrayBuffer);
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
