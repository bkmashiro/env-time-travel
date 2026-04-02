import type { EnvChange } from "./parser.js";
import type { GitCommit } from "./git.js";

export type TimelineAction = "ADDED" | "CHANGED" | "REMOVED";
export type VariableStatus = "current" | "removed";

export type TimelineEntry = {
  action: TimelineAction;
  date: string;
  authorName: string;
  authorEmail: string;
  value?: string;
  previousValue?: string;
  hash: string;
};

export type VariableTimeline = {
  key: string;
  entries: TimelineEntry[];
  status: VariableStatus;
  currentValue?: string;
  documented: boolean;
  zombie: boolean;
  lastChanged?: string;
};

function groupByKey(changes: EnvChange[]): Map<string, { adds: string[]; removes: string[] }> {
  const grouped = new Map<string, { adds: string[]; removes: string[] }>();

  for (const change of changes) {
    const bucket = grouped.get(change.key) ?? { adds: [], removes: [] };
    if (change.type === "add") {
      bucket.adds.push(change.value);
    } else {
      bucket.removes.push(change.value);
    }
    grouped.set(change.key, bucket);
  }

  return grouped;
}

export function buildVariableTimelines(
  commits: GitCommit[],
  currentEnv: Map<string, string>,
  documentedEnv: Map<string, string>,
  since?: string
): Map<string, VariableTimeline> {
  const timelines = new Map<string, VariableTimeline>();
  const sinceTime = since ? Date.parse(`${since}T00:00:00Z`) : Number.NEGATIVE_INFINITY;

  for (const commit of commits) {
    const commitTime = Date.parse(`${commit.date}T00:00:00Z`);
    if (Number.isNaN(commitTime) || commitTime < sinceTime) {
      continue;
    }

    const grouped = groupByKey(commit.changes);

    for (const [key, values] of grouped) {
      const timeline =
        timelines.get(key) ??
        {
          key,
          entries: [],
          status: currentEnv.has(key) ? "current" : "removed",
          currentValue: currentEnv.get(key),
          documented: documentedEnv.has(key),
          zombie: !currentEnv.has(key) && documentedEnv.has(key),
          lastChanged: undefined
        };

      const pairedChanges = Math.max(values.adds.length, values.removes.length);
      for (let index = 0; index < pairedChanges; index += 1) {
        const added = values.adds[index];
        const removed = values.removes[index];

        let action: TimelineAction;
        if (added !== undefined && removed !== undefined) {
          action = "CHANGED";
        } else if (added !== undefined) {
          action = "ADDED";
        } else {
          action = "REMOVED";
        }

        timeline.entries.push({
          action,
          date: commit.date,
          authorName: commit.authorName,
          authorEmail: commit.authorEmail,
          value: added,
          previousValue: removed,
          hash: commit.hash
        });
      }

      timeline.lastChanged = commit.date;
      timelines.set(key, timeline);
    }
  }

  for (const [key, timeline] of timelines) {
    timeline.status = currentEnv.has(key) ? "current" : "removed";
    timeline.currentValue = currentEnv.get(key);
    timeline.documented = documentedEnv.has(key);
    timeline.zombie = timeline.status === "removed" && timeline.documented;
    timelines.set(key, timeline);
  }

  return timelines;
}
