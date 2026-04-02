import test from "node:test";
import assert from "node:assert/strict";
import { parseEnvDiffHunk, parseEnvFile } from "../src/parser.js";

test("parses KEY=value", () => {
  const parsed = parseEnvFile("KEY=value");
  assert.equal(parsed.get("KEY"), "value");
});

test('parses KEY="quoted value"', () => {
  const parsed = parseEnvFile('KEY="quoted value"');
  assert.equal(parsed.get("KEY"), "quoted value");
});

test("ignores comments and empty lines", () => {
  const parsed = parseEnvFile("# comment\n\nKEY=value");
  assert.equal(parsed.size, 1);
  assert.equal(parsed.get("KEY"), "value");
});

test("parses diff hunk add event", () => {
  const changes = parseEnvDiffHunk("+DB_HOST=localhost");
  assert.deepEqual(changes, [{ type: "add", key: "DB_HOST", value: "localhost" }]);
});

test("parses diff hunk change event lines", () => {
  const changes = parseEnvDiffHunk("-DB_HOST=localhost\n+DB_HOST=prod");
  assert.deepEqual(changes, [
    { type: "remove", key: "DB_HOST", value: "localhost" },
    { type: "add", key: "DB_HOST", value: "prod" }
  ]);
});
