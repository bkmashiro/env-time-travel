import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseEnvDiffHunk, type EnvChange } from "./parser.js";
import { parseEnvFile } from "./parser.js";

const execFileAsync = promisify(execFile);

export type GitCommit = {
  hash: string;
  date: string;
  authorName: string;
  authorEmail: string;
  changes: EnvChange[];
};

export type GitPatchFile = {
  path: string;
  patch: string;
};

export type GitPatchCommit = {
  hash: string;
  date: string;
  authorName: string;
  authorEmail: string;
  files: GitPatchFile[];
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

function parseDiffPath(header: string): string | null {
  const match = header.match(/^diff --git a\/(.+?) b\/(.+)$/);
  if (!match) {
    return null;
  }

  const [, beforePath, afterPath] = match;
  return afterPath === "/dev/null" ? beforePath : afterPath;
}

function parsePatchFiles(lines: string[]): GitPatchFile[] {
  const files: GitPatchFile[] = [];
  let currentPath: string | null = null;
  let currentPatch: string[] = [];

  const flush = () => {
    if (!currentPath) {
      return;
    }

    files.push({
      path: currentPath,
      patch: currentPatch.join("\n")
    });
  };

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      flush();
      currentPath = parseDiffPath(line);
      currentPatch = [];
      continue;
    }

    if (currentPath) {
      currentPatch.push(line);
    }
  }

  flush();
  return files;
}

function parseGitPatchLogOutput(output: string): GitPatchCommit[] {
  const sections = output
    .split(`${COMMIT_MARKER}\n`)
    .map((section) => section.trim())
    .filter(Boolean);

  const commits: GitPatchCommit[] = [];

  for (const section of sections) {
    const lines = section.split("\n");
    if (lines.length < 4) {
      continue;
    }

    const [hash, date, authorName, authorEmail, ...rest] = lines;
    commits.push({
      hash,
      date,
      authorName,
      authorEmail,
      files: parsePatchFiles(rest)
    });
  }

  return commits.reverse();
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

export async function getEnvPatchHistory(cwd = process.cwd()): Promise<GitPatchCommit[]> {
  const args = [
    "log",
    "--all",
    "--date=short",
    `--format=${COMMIT_MARKER}%n%H%n%ad%n%an%n%ae`,
    "-p",
    "--",
    ".env",
    ":(glob).env.*",
    ":(glob)*.env"
  ];

  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      maxBuffer: 20 * 1024 * 1024
    });

    return parseGitPatchLogOutput(stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("does not have any commits yet")) {
      return [];
    }
    throw new Error(`Failed to read git history: ${message}`);
  }
}

export async function getEnvAtRevision(
  revision: string,
  file: string,
  cwd = process.cwd()
): Promise<Map<string, string>> {
  try {
    const { stdout } = await execFileAsync("git", ["show", `${revision}:${file}`], {
      cwd,
      maxBuffer: 1024 * 1024
    });

    return parseEnvFile(stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("exists on disk, but not in") ||
      message.includes("does not exist in") ||
      message.includes("Path '") ||
      message.includes("invalid object name")
    ) {
      return new Map<string, string>();
    }

    throw new Error(`Failed to read ${file} at ${revision}: ${message}`);
  }
}

export async function getShortHash(revision: string, cwd = process.cwd()): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--short", revision], {
      cwd
    });
    return stdout.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to resolve revision ${revision}: ${message}`);
  }
}
