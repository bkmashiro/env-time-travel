import test from "node:test";
import assert from "node:assert/strict";
import { buildVariableTimelines } from "../src/timeline.js";
import type { GitCommit } from "../src/git.js";

test("single add commit creates ADDED entry", () => {
  const commits: GitCommit[] = [
    {
      hash: "a1",
      date: "2023-01-15",
      authorName: "alice",
      authorEmail: "alice@co.com",
      changes: [{ type: "add", key: "DB_HOST", value: "localhost" }]
    }
  ];

  const timelines = buildVariableTimelines(commits, new Map(), new Map());
  const timeline = timelines.get("DB_HOST");

  if (!timeline) {
    throw new Error("Expected DB_HOST timeline");
  }
  assert.equal(timeline.entries.length, 1);
  assert.equal(timeline.entries[0]?.action, "ADDED");
});

test("add then remove creates ADDED and REMOVED entries", () => {
  const commits: GitCommit[] = [
    {
      hash: "a1",
      date: "2023-01-15",
      authorName: "alice",
      authorEmail: "alice@co.com",
      changes: [{ type: "add", key: "DB_HOST", value: "localhost" }]
    },
    {
      hash: "b2",
      date: "2024-02-10",
      authorName: "carol",
      authorEmail: "carol@co.com",
      changes: [{ type: "remove", key: "DB_HOST", value: "localhost" }]
    }
  ];

  const timelines = buildVariableTimelines(commits, new Map(), new Map());
  const timeline = timelines.get("DB_HOST");

  if (!timeline) {
    throw new Error("Expected DB_HOST timeline");
  }
  assert.deepEqual(
    timeline.entries.map((entry) => entry.action),
    ["ADDED", "REMOVED"]
  );
});

test('variable in current env has status "current"', () => {
  const commits: GitCommit[] = [
    {
      hash: "a1",
      date: "2023-01-15",
      authorName: "alice",
      authorEmail: "alice@co.com",
      changes: [{ type: "add", key: "SECRET_KEY", value: "abc123" }]
    }
  ];

  const timelines = buildVariableTimelines(
    commits,
    new Map([["SECRET_KEY", "abc123"]]),
    new Map()
  );
  assert.equal(timelines.get("SECRET_KEY")?.status, "current");
});

test('variable not in current env has status "removed"', () => {
  const commits: GitCommit[] = [
    {
      hash: "a1",
      date: "2023-01-15",
      authorName: "alice",
      authorEmail: "alice@co.com",
      changes: [{ type: "add", key: "OLD_WEBHOOK", value: "http://example.test" }]
    }
  ];

  const timelines = buildVariableTimelines(commits, new Map(), new Map());
  assert.equal(timelines.get("OLD_WEBHOOK")?.status, "removed");
});
