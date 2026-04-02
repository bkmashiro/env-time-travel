import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseEnvDiffHunk, type EnvChange } from "./parser.js";

const execFileAsync = promisify(execFile);

export type GitCommit = {
  hash: string;
  date: string;
  authorName: string;
  authorEmail: string;
  changes: EnvChange[];
};

const COMMIT_MARKER = "__ENV_TIME_TRAVEL_COMMIT__";

function parseGitLogOutput(output: string): GitCommit[] {
  const sections = output
    .split(`${COMMIT_MARKER}\n`)
    .map((section) => section.trim())
    .filter(Boolean);

  const commits: GitCommit[] = [];

  for (const section of sections) {
    const lines = section.split("\n");
    if (lines.length < 4) {
      continue;
    }

    const [hash, date, authorName, authorEmail, ...rest] = lines;
    const changes = parseEnvDiffHunk(rest.join("\n"));

    if (changes.length === 0) {
      continue;
    }

    commits.push({
      hash,
      date,
      authorName,
      authorEmail,
      changes
    });
  }

  return commits;
}

export async function getEnvHistory(file?: string, cwd = process.cwd()): Promise<GitCommit[]> {
  const pathspecs = file
    ? [file]
    : [".env", ":(glob).env.*", ":(glob)*.env"];

  const args = [
    "log",
    "--all",
    "--date=short",
    `--format=${COMMIT_MARKER}%n%H%n%ad%n%an%n%ae`,
    "-p",
    ...(file ? ["--follow"] : []),
    "--",
    ...pathspecs
  ];

  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024
    });

    return parseGitLogOutput(stdout).reverse();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("does not have any commits yet")) {
      return [];
    }
    throw new Error(`Failed to read git history: ${message}`);
  }
}
