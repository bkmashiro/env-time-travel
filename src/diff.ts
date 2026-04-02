import chalk from "chalk";
import { getEnvAtRevision, getShortHash } from "./git.js";

export type EnvDiffEntry = {
  key: string;
  before?: string;
  after?: string;
};

export type EnvDiffResult = {
  fromRef: string;
  toRef: string;
  fromHash: string;
  toHash: string;
  added: EnvDiffEntry[];
  removed: EnvDiffEntry[];
  changed: EnvDiffEntry[];
};

const SECRET_KEY_RE = /API.KEY|SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL/i;

function quoteValue(value: string): string {
  return JSON.stringify(value);
}

function formatValue(key: string, value: string): string {
  if (!SECRET_KEY_RE.test(key)) {
    return quoteValue(value);
  }

  if (value.length <= 4) {
    return quoteValue("****");
  }

  return quoteValue(`${value.slice(0, 3)}****`);
}

function sortEntries(entries: EnvDiffEntry[]): EnvDiffEntry[] {
  return [...entries].sort((left, right) => left.key.localeCompare(right.key));
}

export function buildEnvDiff(
  fromRef: string,
  toRef: string,
  fromHash: string,
  toHash: string,
  beforeEnv: Map<string, string>,
  afterEnv: Map<string, string>
): EnvDiffResult {
  const keys = new Set([...beforeEnv.keys(), ...afterEnv.keys()]);
  const added: EnvDiffEntry[] = [];
  const removed: EnvDiffEntry[] = [];
  const changed: EnvDiffEntry[] = [];

  for (const key of keys) {
    const before = beforeEnv.get(key);
    const after = afterEnv.get(key);

    if (before === undefined && after !== undefined) {
      added.push({ key, after });
      continue;
    }

    if (before !== undefined && after === undefined) {
      removed.push({ key, before });
      continue;
    }

    if (before !== undefined && after !== undefined && before !== after) {
      changed.push({ key, before, after });
    }
  }

  return {
    fromRef,
    toRef,
    fromHash,
    toHash,
    added: sortEntries(added),
    removed: sortEntries(removed),
    changed: sortEntries(changed)
  };
}

export function formatEnvDiff(result: EnvDiffResult): string {
  const lines = [
    `Env changes from ${result.fromHash} to ${result.toHash}:`,
    ""
  ];

  if (result.added.length === 0 && result.removed.length === 0 && result.changed.length === 0) {
    lines.push(chalk.green("  No env changes."));
    return lines.join("\n");
  }

  if (result.added.length > 0) {
    lines.push("  Added:");
    for (const entry of result.added) {
      lines.push(`    ${chalk.green("+")} ${entry.key}=${entry.after ?? ""}`);
    }
    lines.push("");
  }

  if (result.removed.length > 0) {
    lines.push("  Removed:");
    for (const entry of result.removed) {
      lines.push(`    ${chalk.red("-")} ${entry.key} (was: ${formatValue(entry.key, entry.before ?? "")})`);
    }
    lines.push("");
  }

  if (result.changed.length > 0) {
    lines.push("  Changed:");
    for (const entry of result.changed) {
      lines.push(
        `    ${chalk.yellow("~")} ${entry.key}: ${formatValue(entry.key, entry.before ?? "")} ${chalk.dim("→")} ${formatValue(entry.key, entry.after ?? "")}`
      );
    }
  } else if (lines.at(-1) === "") {
    lines.pop();
  }

  return lines.join("\n");
}

export async function diffEnvRevisions(
  fromRef: string,
  toRef: string,
  file: string,
  cwd = process.cwd()
): Promise<EnvDiffResult> {
  const [beforeEnv, afterEnv, fromHash, toHash] = await Promise.all([
    getEnvAtRevision(fromRef, file, cwd),
    getEnvAtRevision(toRef, file, cwd),
    getShortHash(fromRef, cwd),
    getShortHash(toRef, cwd)
  ]);

  return buildEnvDiff(fromRef, toRef, fromHash, toHash, beforeEnv, afterEnv);
}
