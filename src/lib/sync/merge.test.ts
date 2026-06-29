import { describe, it } from "node:test";
import assert from "node:assert";
import { computeFingerprint, isStalePull } from "./merge";

describe("merge", () => {
  describe("isStalePull", () => {
    const older = new Date("2026-07-03T10:00:00Z");
    const newer = new Date("2026-07-03T10:05:00Z");

    it("treats a strictly-newer incoming value as fresh (applies it)", () => {
      assert.strictEqual(isStalePull(older, newer), false);
    });

    it("treats an older incoming value as stale (the mid-watch rewind case)", () => {
      
      
      assert.strictEqual(isStalePull(newer, older), true);
    });

    it("treats an equal timestamp as stale (avoids echo re-push)", () => {
      assert.strictEqual(isStalePull(newer, newer), true);
    });

    it("applies an incoming value when nothing is stored yet", () => {
      assert.strictEqual(isStalePull(null, newer), false);
      assert.strictEqual(isStalePull(undefined, newer), false);
    });

    it("treats a null incoming timestamp as stale against any stored time", () => {
      assert.strictEqual(isStalePull(older, null), true);
    });
  });

  describe("computeFingerprint", () => {
    it("produces consistent fingerprints for same inputs", () => {
      const a = computeFingerprint(true, 50000, 100000);
      const b = computeFingerprint(true, 50000, 100000);
      assert.strictEqual(a, b);
    });

    it("produces different fingerprints for different watched flags", () => {
      const a = computeFingerprint(true, 50000, 100000);
      const b = computeFingerprint(false, 50000, 100000);
      assert.notStrictEqual(a, b);
    });

    it("rounds position to 10-second intervals", () => {
      
      const a = computeFingerprint(true, 50000, 100000);
      const b = computeFingerprint(true, 54000, 100000);
      assert.strictEqual(a, b);
    });

    it("differentiates different durations", () => {
      const a = computeFingerprint(true, 50000, 100000);
      const b = computeFingerprint(true, 50000, 200000);
      assert.notStrictEqual(a, b);
    });
  });
});
