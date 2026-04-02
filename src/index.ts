#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Command } from "commander";
import { formatAuditReport } from "./audit.js";
import { exportTimelines, type ExportFormat } from "./exporter.js";
import { getEnvHistory } from "./git.js";
import { formatAllVariables, formatVariableTimeline } from "./formatter.js";
import { parseEnvFile } from "./parser.js";
import { buildVariableTimelines } from "./timeline.js";

type CliOptions = {
  all?: boolean;
  audit?: boolean;
  export?: ExportFormat;
  file: string;
  json?: boolean;
  zombies?: boolean;
  since?: string;
};

async function readEnvMap(filePath: string): Promise<Map<string, string>> {
  try {
    const content = await readFile(filePath, "utf8");
    return parseEnvFile(content);
  } catch {
    return new Map<string, string>();
  }
}

async function readDocumentedEnvMaps(filePath: string): Promise<Map<string, string>> {
  const dir = dirname(filePath);
  const candidates = [
    ".env.example",
    ".env.sample",
    ".env.template",
    `${filePath}.example`,
    `${filePath}.sample`,
    `${filePath}.template`
  ];

  const documented = new Map<string, string>();
  for (const candidate of candidates) {
    const candidatePath = resolve(dir, candidate);
    const entries = await readEnvMap(candidatePath);
    for (const [key, value] of entries) {
      documented.set(key, value);
    }
  }

  return documented;
}

function sortTimelines<T extends { key: string }>(entries: T[]): T[] {
  return [...entries].sort((left, right) => left.key.localeCompare(right.key));
}

const program = new Command();

program
  .name("env-time-travel")
  .description("Show git history for .env variables")
  .argument("[variable]", "Specific variable to trace")
  .option("--all", "Show all variables")
  .option("--audit", "Audit git history for likely secrets")
  .option("--export <format>", "Export timeline as json, csv, or markdown")
  .option("--file <path>", "Env file to track", ".env")
  .option("--json", "Output as JSON")
  .option("--zombies", "Only show removed variables")
  .option("--since <date>", "Only changes since date (YYYY-MM-DD)")
  .action(async (variable: string | undefined, options: CliOptions) => {
    if (options.json && options.export) {
      throw new Error("Use either --json or --export, not both");
    }

    if (options.export && !["json", "csv", "markdown"].includes(options.export)) {
      throw new Error("Invalid export format. Use json, csv, or markdown");
    }

    const trackedFile = resolve(process.cwd(), options.file);
    const commits = await getEnvHistory(options.file);
    const currentEnv = await readEnvMap(trackedFile);
    const documentedEnv = await readDocumentedEnvMaps(trackedFile);
    const timelinesMap = buildVariableTimelines(commits, currentEnv, documentedEnv, options.since);

    let timelines = sortTimelines(Array.from(timelinesMap.values()));
    if (options.zombies) {
      timelines = timelines.filter((timeline) => timeline.status === "removed");
    }

    if (options.audit) {
      console.log(formatAuditReport(timelines));
      return;
    }

    if (variable && !options.all) {
      const timeline = timelinesMap.get(variable);
      if (!timeline) {
        throw new Error(`No history found for variable: ${variable}`);
      }

      if (options.export) {
        console.log(exportTimelines([timeline], options.export));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(timeline, null, 2));
        return;
      }

      console.log(formatVariableTimeline(timeline));
      return;
    }

    if (options.export) {
      console.log(exportTimelines(timelines, options.export));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(timelines, null, 2));
      return;
    }

    console.log(formatAllVariables(timelines));
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
