import chalk from "chalk";
import type { TimelineEntry, VariableTimeline } from "./timeline.js";

function formatAction(entry: TimelineEntry): string {
  if (entry.action === "ADDED") {
    return `${chalk.green("ADDED")}   ${JSON.stringify(entry.value ?? "")}`;
  }

  if (entry.action === "CHANGED") {
    return `${chalk.yellow("CHANGED")} ${JSON.stringify(entry.previousValue ?? "")} ${chalk.dim("→")} ${JSON.stringify(entry.value ?? "")}`;
  }

  return `${chalk.red("REMOVED")} ${entry.previousValue ? JSON.stringify(entry.previousValue) : ""}`.trimEnd();
}

export function formatVariableTimeline(timeline: VariableTimeline): string {
  const lines = [`${chalk.bold(timeline.key)} timeline:`];

  for (const entry of timeline.entries) {
    lines.push(
      `  ${chalk.dim(entry.date)}  ${entry.authorName} <${entry.authorEmail}>  ${formatAction(entry)}`
    );
  }

  if (timeline.entries.length === 0) {
    lines.push("  No matching history found.");
  }

  lines.push(
    `  ${chalk.dim("status:")} ${timeline.status}${timeline.zombie ? chalk.red(" (zombie!)") : ""}`
  );

  return lines.join("\n");
}

export function formatVariableSummary(timeline: VariableTimeline): string {
  const changeLabel = timeline.entries.length === 1 ? "change" : "changes";
  const status = timeline.zombie ? "removed (zombie!)" : timeline.status;
  return `  ${timeline.key.padEnd(15)} ${String(timeline.entries.length).padStart(2)} ${changeLabel.padEnd(7)} last: ${
    timeline.lastChanged ?? "unknown"
  }  status: ${status}`;
}

export function formatAllVariables(timelines: VariableTimeline[]): string {
  const lines = ["All variables in .env history:"];

  if (timelines.length === 0) {
    lines.push("  No matching variables found.");
    return lines.join("\n");
  }

  for (const timeline of timelines) {
    lines.push(formatVariableSummary(timeline));
  }

  return lines.join("\n");
}
