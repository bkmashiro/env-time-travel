[![npm](https://img.shields.io/npm/v/env-time-travel)](https://www.npmjs.com/package/env-time-travel) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# env-time-travel

`env-time-travel` is a CLI for tracing `.env` variables through git history. It shows who added a variable, when it changed, when it disappeared, and whether it still exists today.

## Install

```bash
pnpm add -g env-time-travel
```

## Usage

```bash
env-time-travel [variable] [options]
```

Options:

- `--all` Show all variables. This is the default when no variable is provided.
- `--audit` Audit `.env` history for likely secret variables left in git history.
- `--export <format>` Export timelines as `json`, `csv`, or `markdown`.
- `--file <path>` Track a specific env file. Defaults to `.env`.
- `--json` Emit JSON instead of colored terminal output.
- `--zombies` Only show removed variables.
- `--since <date>` Only include changes on or after `YYYY-MM-DD`.

Examples:

```bash
env-time-travel DB_HOST
env-time-travel --all
env-time-travel --audit
env-time-travel --all --export json
env-time-travel DB_HOST --export markdown
env-time-travel --zombies --since 2024-01-01
env-time-travel API_URL --json
```

## How It Works

1. Reads git patch history for `.env` files.
2. Parses added and removed `KEY=VALUE` lines from diff hunks.
3. Builds a per-variable timeline of `ADDED`, `CHANGED`, and `REMOVED` events.
4. Cross-references the current `.env` to determine whether each variable is still current.
5. Checks `.env.example`, `.env.sample`, and `.env.template` to detect documented variables that no longer exist.

## Zombie Variables

A zombie variable is a variable that has been removed from the current tracked env file, but still appears in documentation files like `.env.example`, `.env.sample`, or `.env.template`. These are often stale variables that still confuse new contributors or deployment tooling.
