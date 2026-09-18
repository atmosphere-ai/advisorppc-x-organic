import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { containsLink, mediaFingerprint, normalizeHandle, sha256Hex } from "../src/x/hash.ts";

test("normalizes handle strip @ and lowercase", () => {
  assert.equal(normalizeHandle("@Acme"), "acme");
  assert.equal(normalizeHandle("  Foo_Bar "), "foo_bar");
});

test("hashes utf8 SHA-256", () => {
  const expected = createHash("sha256").update("hello", "utf8").digest("hex");
  assert.equal(sha256Hex("hello"), expected);
});

test("media fingerprint is sha256 of bytes", () => {
  const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  assert.equal(mediaFingerprint(buf), sha256Hex(buf));
  assert.match(mediaFingerprint(buf), /^[a-f0-9]{64}$/);
});

test("containsLink detects http(s) URLs for pay-per-use warning", () => {
  assert.equal(containsLink("hello world"), false);
  assert.equal(containsLink("see https://advisorppc.com/x"), true);
  assert.equal(containsLink("http://x.com/a"), true);
});
