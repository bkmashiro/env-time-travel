import chalk from "chalk";
import type { VariableTimeline } from "./timeline.js";

const SECRET_KEY_RE = /API.KEY|SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL/i;

export type AuditRisk = "HIGH" | "MEDIUM";

export type AuditFinding = {
  key: string;
  added: string;
  removed?: string;
  status: "current" | "removed";
  risk: AuditRisk;
};

function matchesSecretPattern(key: string): boolean {
  return SECRET_KEY_RE.test(key);
}

function getAddedDate(timeline: VariableTimeline): string | undefined {
  return timeline.entries[0]?.date;
}

function getRemovedDate(timeline: VariableTimeline): string | undefined {
  for (let index = timeline.entries.length - 1; index >= 0; index -= 1) {
    const entry = timeline.entries[index];
    if (entry?.action === "REMOVED") {
      return entry.date;
    }
  }

  return undefined;
}

export function buildAuditFindings(timelines: VariableTimeline[]): AuditFinding[] {
  return timelines
    .filter((timeline) => matchesSecretPattern(timeline.key) && timeline.entries.length > 0)
    .map((timeline) => {
      const added = getAddedDate(timeline) ?? "unknown";
      const removed = timeline.status === "removed" ? getRemovedDate(timeline) : undefined;

      return {
        key: timeline.key,
        added,
        removed,
        status: timeline.status,
        risk: timeline.status === "current" ? ("HIGH" as const) : ("MEDIUM" as const)
      };
    })
    .sort((left, right) => left.key.localeCompare(right.key));
}

function formatFinding(finding: AuditFinding): string {
  if (finding.status === "current") {
    return `  ${finding.key.padEnd(14)} added ${finding.added}, NEVER removed (still in latest commit!)`;
  }

  if (finding.removed === finding.added) {
    return `  ${finding.key.padEnd(14)} added ${finding.added}, removed same day (was it leaked?)`;
  }

  return `  ${finding.key.padEnd(14)} added ${finding.added}, removed ${finding.removed ?? "unknown"} (still in git history!)`;
}

export function formatAuditReport(timelines: VariableTimeline[]): string {
  const findings = buildAuditFindings(timelines);
  const lines = ["Security audit of .env history...", ""];

  if (findings.length === 0) {
    lines.push(`${chalk.green("No potential secrets found in git history.")}`);
    return lines.join("\n");
  }

  lines.push(`${chalk.yellow("⚠️  Potential secrets found in git history:")}`);
  for (const finding of findings) {
    lines.push(formatFinding(finding));
  }

  const active = findings.filter((finding) => finding.status === "current").map((finding) => finding.key);
  const removed = findings.filter((finding) => finding.status === "removed").map((finding) => finding.key);

  lines.push("");
  lines.push("Variables matching secret patterns (API_KEY, SECRET, TOKEN, PASSWORD, PRIVATE, CREDENTIAL):");
  if (active.length > 0) {
    lines.push(`  Active in HEAD: ${active.join(", ")} ${chalk.red("← HIGH RISK")}`);
  }
  if (removed.length > 0) {
    lines.push(
      `  Removed but in history: ${removed.join(", ")} ${chalk.yellow("← Consider git history rewrite")}`
    );
  }

  lines.push("");
  lines.push("Run: git filter-repo --path .env --invert-paths  (to remove .env from history)");

  return lines.join("\n");
}
