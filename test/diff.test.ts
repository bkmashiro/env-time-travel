import assert from "node:assert/strict";
import test from "node:test";
import { buildEnvDiff, formatEnvDiff } from "../src/diff.js";

test("builds exact added removed and changed env entries", () => {
  const result = buildEnvDiff(
    "HEAD~1",
    "HEAD",
    "abc1234",
    "def5678",
    new Map([
      ["DATABASE_URL", "postgres://dev"],
      ["LOG_LEVEL", "debug"],
      ["OLD_API_KEY", "sk-proj-secretvalue123456"]
    ]),
    new Map([
      ["DATABASE_URL", "postgres://prod"],
      ["LOG_LEVEL", "info"],
      ["REDIS_URL", "redis://localhost:6379"]
    ])
  );

  assert.deepEqual(result.added, [{ key: "REDIS_URL", after: "redis://localhost:6379" }]);
  assert.deepEqual(result.removed, [{ key: "OLD_API_KEY", before: "sk-proj-secretvalue123456" }]);
  assert.deepEqual(result.changed, [
    { key: "DATABASE_URL", before: "postgres://dev", after: "postgres://prod" },
    { key: "LOG_LEVEL", before: "debug", after: "info" }
  ]);
});

test("formats env diff output with masked secret removals", () => {
  const report = formatEnvDiff(
    buildEnvDiff(
      "HEAD~1",
      "HEAD",
      "abc1234",
      "def5678",
      new Map([
        ["OLD_API_KEY", "sk-proj-secretvalue123456"],
        ["DATABASE_URL", "postgres://dev"]
      ]),
      new Map([
        ["DATABASE_URL", "postgres://prod"],
        ["FEATURE_FLAGS_ENABLED", "true"]
      ])
    )
  );

  assert.match(report, /Env changes from abc1234 to def5678/);
  assert.match(report, /\+ FEATURE_FLAGS_ENABLED=true/);
  assert.match(report, /- OLD_API_KEY \(was: "sk-\*\*\*\*"\)/);
  assert.match(report, /~ DATABASE_URL: "postgres:\/\/dev" .* "postgres:\/\/prod"/);
});
