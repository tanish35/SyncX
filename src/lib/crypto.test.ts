import { describe, it } from "node:test";
import assert from "node:assert";
import { encryptCredential, decryptCredential } from "./crypto";

describe("crypto", () => {
  const testKey = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url");

  it("encrypt/decrypt round-trip", async () => {
    const value = { authKey: "test-auth-key-12345", nested: { foo: "bar" } };
    const encrypted = await encryptCredential(value, testKey);
    assert.ok(typeof encrypted === "string");
    assert.ok(encrypted.includes("."));

    const decrypted = await decryptCredential<typeof value>(encrypted, testKey);
    assert.deepStrictEqual(decrypted, value);
  });

  it("encrypt produces different ciphertext for same plaintext (random IV)", async () => {
    const value = { secret: "same" };
    const a = await encryptCredential(value, testKey);
    const b = await encryptCredential(value, testKey);
    assert.notStrictEqual(a, b);
  });

  it("decrypt rejects tampered ciphertext", async () => {
    const value = { secret: "untampered" };
    const encrypted = await encryptCredential(value, testKey);
    const parts = encrypted.split(".");
    const tampered = `${parts[0]}.AAAA${parts[1].slice(4)}`;
    await assert.rejects(() => decryptCredential(tampered, testKey));
  });

  it("decrypt rejects invalid blob format", async () => {
    await assert.rejects(() => decryptCredential("no-dot-separator", testKey));
  });
});
