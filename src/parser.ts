export type EnvChange = {
  type: "add" | "remove";
  key: string;
  value: string;
};

const ENV_LINE_RE = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

function normalizeValue(rawValue: string): string {
  const trimmed = rawValue.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseEnvAssignment(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const match = trimmed.match(ENV_LINE_RE);
  if (!match) {
    return null;
  }

  const [, key, rawValue] = match;
  return { key, value: normalizeValue(rawValue) };
}

export function parseEnvFile(content: string): Map<string, string> {
  const entries = new Map<string, string>();

  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvAssignment(line);
    if (parsed) {
      entries.set(parsed.key, parsed.value);
    }
  }

  return entries;
}

export function parseEnvDiffHunk(hunk: string): EnvChange[] {
  const changes: EnvChange[] = [];

  for (const line of hunk.split(/\r?\n/)) {
    if (!line || line.startsWith("+++ ") || line.startsWith("--- ") || line.startsWith("@@")) {
      continue;
    }

    const prefix = line[0];
    if (prefix !== "+" && prefix !== "-") {
      continue;
    }

    const parsed = parseEnvAssignment(line.slice(1));
    if (!parsed) {
      continue;
    }

    changes.push({
      type: prefix === "+" ? "add" : "remove",
      key: parsed.key,
      value: parsed.value
    });
  }

  return changes;
}
