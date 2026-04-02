import assert from "node:assert/strict";
import test from "node:test";
import { buildAuditFindings, formatAuditReport } from "../src/audit.js";
import type { VariableTimeline } from "../src/timeline.js";

function createTimeline(
  key: string,
  status: "current" | "removed",
  entries: VariableTimeline["entries"]
): VariableTimeline {
  return {
    key,
    entries,
    status,
    currentValue: status === "current" ? entries.at(-1)?.value : undefined,
    documented: false,
    zombie: false,
    lastChanged: entries.at(-1)?.date
  };
}

test("audit finds current and removed secret-like variables with correct risk", () => {
  const findings = buildAuditFindings([
    createTimeline("AWS_SECRET", "current", [
      {
        action: "ADDED",
        date: "2022-11-01",
        authorName: "alice",
        authorEmail: "alice@example.com",
        value: "topsecret",
        hash: "a1"
      }
    ]),
    createTimeline("OLD_API_KEY", "removed", [
      {
        action: "ADDED",
        date: "2023-03-10",
        authorName: "alice",
        authorEmail: "alice@example.com",
        value: "abc",
        hash: "b2"
      },
      {
        action: "REMOVED",
        date: "2023-03-10",
        authorName: "alice",
        authorEmail: "alice@example.com",
        previousValue: "abc",
        hash: "b3"
      }
    ]),
    createTimeline("DB_HOST", "current", [
      {
        action: "ADDED",
        date: "2023-01-15",
        authorName: "alice",
        authorEmail: "alice@example.com",
        value: "localhost",
        hash: "c4"
      }
    ])
  ]);

  assert.deepEqual(findings, [
    {
      key: "AWS_SECRET",
      added: "2022-11-01",
      removed: undefined,
      status: "current",
      risk: "HIGH"
    },
    {
      key: "OLD_API_KEY",
      added: "2023-03-10",
      removed: "2023-03-10",
      status: "removed",
      risk: "MEDIUM"
    }
  ]);
});

test("audit report includes rewrite guidance", () => {
  const report = formatAuditReport([
    createTimeline("SECRET_KEY", "removed", [
      {
        action: "ADDED",
        date: "2023-01-15",
        authorName: "alice",
        authorEmail: "alice@example.com",
        value: "abc123",
        hash: "d5"
      },
      {
        action: "REMOVED",
        date: "2024-01-01",
        authorName: "bob",
        authorEmail: "bob@example.com",
        previousValue: "abc123",
        hash: "d6"
      }
    ])
  ]);

  assert.match(report, /Potential secrets found in git history/);
  assert.match(report, /SECRET_KEY/);
  assert.match(report, /git filter-repo --path \.env --invert-paths/);
});
