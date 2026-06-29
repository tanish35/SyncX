import { describe, it } from "node:test";
import assert from "node:assert";
import { z } from "zod";


const stremioErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.number().optional(),
  }),
});

function isStremioError(body: unknown): body is z.infer<typeof stremioErrorSchema> {
  return stremioErrorSchema.safeParse(body).success;
}

describe("stremio response envelope", () => {
  it("rejects { error } responses", () => {
    const response = { error: { message: "Invalid auth key", code: 1 } };
    assert.strictEqual(isStremioError(response), true);
  });

  it("accepts { result } responses", () => {
    const response = { result: { authKey: "abc123" } };
    assert.strictEqual(isStremioError(response), false);
  });

  it("rejects malformed error objects", () => {
    assert.strictEqual(isStremioError({ error: "string" }), false);
    assert.strictEqual(isStremioError({ error: {} }), false);
    assert.strictEqual(isStremioError(null), false);
    assert.strictEqual(isStremioError(undefined), false);
  });

  it("accepts error without code", () => {
    const response = { error: { message: "Something went wrong" } };
    assert.strictEqual(isStremioError(response), true);
  });
});
