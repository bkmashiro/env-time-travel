import chalk from "chalk";
import { parseEnvDiffHunk } from "./parser.js";
import type { GitPatchCommit } from "./git.js";

const ENV_PATH_RE = /(^|\/)\.env([._-].+)?$/i;
const SECRET_KEY_RE = /API.KEY|SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL/i;
const HIGH_ENTROPY_RE = /\b[A-Za-z0-9_-]{20,}\b/;
const SHORT_PASSWORD_RE = /^(?=.{6,}$)[^\s]+$/;
const KNOWN_PREFIXES: Array<{ prefix: string; label: string }> = [
  { prefix: "sk-", label: "OpenAI key" },
  { prefix: "ghp_", label: "GitHub personal access token" },
  { prefix: "github_pat_", label: "GitHub fine-grained token" },
  { prefix: "glpat-", label: "GitLab personal access token" },
  { prefix: "xoxb-", label: "Slack bot token" },
  { prefix: "AKIA", label: "AWS access key" }
];

export type SecretFinding = {
  commit: string;
  date: string;
  file: string;
  key: string;
  value: string;
  reason: string;
};

export function classifySecretValue(key: string, value: string): string | null {
  for (const { prefix, label } of KNOWN_PREFIXES) {
    if (value.startsWith(prefix)) {
      return `looks like ${label}`;
    }
  }

  if (SECRET_KEY_RE.test(key) && value.length >= 8 && HIGH_ENTROPY_RE.test(value)) {
    return "long plaintext secret";
  }

  if (/PASSWORD/i.test(key) && SHORT_PASSWORD_RE.test(value)) {
    return "short password in plaintext";
  }

  if (SECRET_KEY_RE.test(key) && value.length >= 12) {
    return "plaintext secret-looking value";
  }

  if (HIGH_ENTROPY_RE.test(value) && value.length >= 24) {
    return "long alphanumeric token";
  }

  return null;
}

export function maskSecretValue(value: string): string {
  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 18)}...`;
}

function isEnvPath(path: string): boolean {
  return ENV_PATH_RE.test(path);
}

export function buildSecretFindings(commits: GitPatchCommit[]): SecretFinding[] {
  const findings: SecretFinding[] = [];

  for (const commit of commits) {
    for (const filePatch of commit.files) {
      if (!isEnvPath(filePatch.path)) {
        continue;
      }

      for (const change of parseEnvDiffHunk(filePatch.patch)) {
        if (change.type !== "add") {
          continue;
        }

        const reason = classifySecretValue(change.key, change.value);
        if (!reason) {
          continue;
        }

        findings.push({
          commit: commit.hash,
          date: commit.date,
          file: filePatch.path,
          key: change.key,
          value: change.value,
          reason
        });
      }
    }
  }

  return findings;
}

export function formatSecretsCheckReport(findings: SecretFinding[], scannedCommits: number): string {
  const lines = [`Scanning ${scannedCommits} commits for leaked secrets...`, ""];

  if (findings.length === 0) {
    lines.push(chalk.green("No obvious leaked secret values found in git history."));
    return lines.join("\n");
  }

  for (const finding of findings) {
    lines.push(
      `${chalk.yellow("⚠")} Potential secret leaked in commit ${finding.commit.slice(0, 7)} (${finding.date}):`
    );
    lines.push(
      `  ${finding.file}: ${finding.key}=${JSON.stringify(maskSecretValue(finding.value))} (${finding.reason})`
    );
    lines.push("");
  }

  lines.push("Run: git filter-repo to remove from history");
  return lines.join("\n");
}
