import assert from "node:assert/strict";
import test from "node:test";
import { buildSecretFindings, classifySecretValue, formatSecretsCheckReport } from "../src/secrets-check.js";
import type { GitPatchCommit } from "../src/git.js";

test("detects known secret prefixes and weak plaintext passwords", () => {
  assert.equal(classifySecretValue("API_KEY", "sk-proj-abc123xyz"), "looks like OpenAI key");
  assert.equal(classifySecretValue("DB_PASSWORD", "hunter2"), "short password in plaintext");
  assert.equal(classifySecretValue("SESSION_TOKEN", "abc123"), null);
});

test("builds findings from added env values in git patches", () => {
  const commits: GitPatchCommit[] = [
    {
      hash: "abc123456789",
      date: "2024-03-15",
      authorName: "alice",
      authorEmail: "alice@example.com",
      files: [
        {
          path: ".env",
          patch: ["@@ -0,0 +1,2 @@", '+API_KEY="sk-proj-abc123xyz"', '+DEBUG="true"'].join("\n")
        }
      ]
    },
    {
      hash: "def567890123",
      date: "2024-02-01",
      authorName: "bob",
      authorEmail: "bob@example.com",
      files: [
        {
          path: ".env.local",
          patch: ['@@ -1 +1,2 @@', '+DB_PASSWORD="hunter2"'].join("\n")
        }
      ]
    }
  ];

  const findings = buildSecretFindings(commits);

  assert.deepEqual(
    findings.map(({ commit, date, file, key, reason }) => ({ commit, date, file, key, reason })),
    [
      {
        commit: "abc123456789",
        date: "2024-03-15",
        file: ".env",
        key: "API_KEY",
        reason: "looks like OpenAI key"
      },
      {
        commit: "def567890123",
        date: "2024-02-01",
        file: ".env.local",
        key: "DB_PASSWORD",
        reason: "short password in plaintext"
      }
    ]
  );
});

test("formats secrets-check report", () => {
  const report = formatSecretsCheckReport(
    [
      {
        commit: "abc123456789",
        date: "2024-03-15",
        file: ".env",
        key: "API_KEY",
        value: "sk-proj-abc123xyz",
        reason: "looks like OpenAI key"
      }
    ],
    42
  );

  assert.match(report, /Scanning 42 commits for leaked secrets/);
  assert.match(report, /Potential secret leaked in commit abc1234 \(2024-03-15\)/);
  assert.match(report, /\.env: API_KEY="sk-proj-abc123xyz\.\.\."/);
  assert.match(report, /git filter-repo/);
});
