import type { VariableTimeline, VariableTimelineExport } from "./timeline.js";
import { serializeTimeline } from "./timeline.js";

export type ExportFormat = "json" | "csv" | "markdown";

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export function exportTimelinesData(timelines: VariableTimeline[]): VariableTimelineExport[] {
  return timelines.map(serializeTimeline);
}

function exportJson(timelines: VariableTimeline[]): string {
  return JSON.stringify(exportTimelinesData(timelines), null, 2);
}

function exportCsv(timelines: VariableTimeline[]): string {
  const lines = ["variable,date,author,type,value"];

  for (const timeline of exportTimelinesData(timelines)) {
    for (const entry of timeline.timeline) {
      lines.push(
        [
          timeline.variable,
          entry.date,
          entry.author,
          entry.type,
          entry.value ?? ""
        ]
          .map(escapeCsvField)
          .join(",")
      );
    }
  }

  return lines.join("\n");
}

function exportMarkdown(timelines: VariableTimeline[]): string {
  const sections: string[] = [];

  for (const timeline of exportTimelinesData(timelines)) {
    sections.push(`## ${timeline.variable}`);
    sections.push("| Date | Author | Change | Value |");
    sections.push("|------|--------|--------|-------|");

    for (const entry of timeline.timeline) {
      sections.push(`| ${entry.date} | ${entry.author} | ${entry.type} | ${entry.value ?? ""} |`);
    }

    if (timeline.timeline.length === 0) {
      sections.push("| - | - | - | - |");
    }
  }

  return sections.join("\n");
}

export function exportTimelines(timelines: VariableTimeline[], format: ExportFormat): string {
  if (format === "json") {
    return exportJson(timelines);
  }

  if (format === "csv") {
    return exportCsv(timelines);
  }

  return exportMarkdown(timelines);
}
