import assert from "node:assert/strict";
import test from "node:test";
import { exportTimelines, exportTimelinesData } from "../src/exporter.js";
import type { VariableTimeline } from "../src/timeline.js";

const timeline: VariableTimeline = {
  key: "DB_HOST",
  entries: [
    {
      action: "ADDED",
      date: "2023-01-15",
      authorName: "alice",
      authorEmail: "alice@example.com",
      value: "localhost",
      hash: "a1"
    }
  ],
  status: "current",
  currentValue: "localhost",
  documented: false,
  zombie: false,
  lastChanged: "2023-01-15"
};

test("export data serializes variable timeline shape", () => {
  assert.deepEqual(exportTimelinesData([timeline]), [
    {
      variable: "DB_HOST",
      timeline: [
        {
          date: "2023-01-15",
          author: "alice",
          type: "ADDED",
          value: "localhost"
        }
      ]
    }
  ]);
});

test("exports csv rows", () => {
  const output = exportTimelines([timeline], "csv");
  assert.equal(
    output,
    ["variable,date,author,type,value", "DB_HOST,2023-01-15,alice,ADDED,localhost"].join("\n")
  );
});

test("exports markdown table", () => {
  const output = exportTimelines([timeline], "markdown");
  assert.equal(
    output,
    [
      "## DB_HOST",
      "| Date | Author | Change | Value |",
      "|------|--------|--------|-------|",
      "| 2023-01-15 | alice | ADDED | localhost |"
    ].join("\n")
  );
});

test("exports json array", () => {
  const output = exportTimelines([timeline], "json");
  assert.match(output, /"variable": "DB_HOST"/);
  assert.match(output, /"type": "ADDED"/);
});
