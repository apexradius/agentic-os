# statusline

A portable [Claude Code status line](https://code.claude.com/docs/en/statusline): four rows, one
distinct hue per section, every field degrading gracefully when its source is absent. It reads the
status-line JSON Claude Code writes to stdin and prints up to four lines.

| Row | Shows | Source |
|---|---|---|
| 1 — location | `user@host` · cwd (`~`-shortened) · `(repo:branch *dirty)` | shell + `workspace`/`worktree` JSON |
| 2 — session | model · `eff:` reasoning effort · `ctx:%` context used · `[vim]` | `model`, `effort`, `context_window`, `vim` |
| 3 — limits | `5h:%` + reset clock · `7d:%` + reset clock | `rate_limits` (Pro/Max plans only) |
| 4 — priority | `P0: <first open task>` | the configured task file (see below) |

The three gauges — effort, context, rate — carry a green→yellow→red grade so an approaching limit
reads at a glance; every other section gets a fixed color for legibility. A row with no content is
omitted, so a plan without rate limits, or a session with no task file, simply shows fewer lines.

## Install

Point `statusLine.command` in your Claude Code settings at this script:

```json
{ "statusLine": { "type": "command", "command": "/abs/path/to/statusline-command.sh" } }
```

Requires `jq` and `git` on `PATH`.

## The one configurable input

The script carries **zero instance coupling**: the only project-specific value is the task file
behind Row 4, supplied via an environment variable.

```bash
export CLAUDE_STATUSLINE_TASKS_FILE=/abs/path/to/your/tasks.md
```

- **Unset** → Row 4 is omitted entirely (the other three rows are unaffected).
- **Set** → the first open item (`- [ ]`) is shown. A leading `**bold title**` becomes the label;
  otherwise the first line is used and capped to one row, so Row 4 never shows a mid-sentence
  fragment.

That single variable is the whole seam between this generic tool and any instance — there is no
hard-coded path, host, or project name in the script.

## Verify

```bash
echo '{"model":{"display_name":"Opus"},"context_window":{"used_percentage":42},
"workspace":{"current_dir":"/tmp"}}' | runtime/statusline/statusline-command.sh
```

It prints Row 1 (location) and Row 2 (`Opus | ctx:42%`); add a `CLAUDE_STATUSLINE_TASKS_FILE`
pointing at a list with a `- [ ]` item to see Row 4.

> Last reviewed: 2026-06-25
