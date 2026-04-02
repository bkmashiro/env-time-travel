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

test("supports export syntax and single-quoted values", () => {
  const parsed = parseEnvFile("export API_TOKEN='secret value'");
  assert.equal(parsed.get("API_TOKEN"), "secret value");
});

test("ignores invalid env assignment lines", () => {
  const parsed = parseEnvFile("NOT VALID\n1KEY=value\nKEY");
  assert.equal(parsed.size, 0);
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

test("ignores diff headers, context lines, and invalid assignments", () => {
  const changes = parseEnvDiffHunk(
    [
      "--- a/.env",
      "+++ b/.env",
      "@@ -1,2 +1,3 @@",
      " DB_HOST=staging",
      "+NOT VALID",
      "-# comment",
      "+API_URL=https://example.test"
    ].join("\n")
  );

  assert.deepEqual(changes, [
    { type: "add", key: "API_URL", value: "https://example.test" }
  ]);
});
