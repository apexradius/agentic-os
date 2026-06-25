#!/usr/bin/env bash
# statusline-command.sh — a portable Claude Code status line: four rows, one distinct hue per
# section, every field degrading gracefully when absent. Reads the status-line JSON on stdin.
#   Row 1 (location):  user@host | cwd | (repo:branch *dirty)
#   Row 2 (session):   model | eff | ctx | [vim]
#   Row 3 (limits):    5h:% resets HH:MM | 7d:% resets Ddd HH:MM   (Pro/Max only)
#   Row 4 (priority):  P0: <first open task title>   (only when a task file is configured)
# Field names track code.claude.com/docs/en/statusline.
#
# Zero instance coupling: the only project-specific input is the task file, supplied via the
# CLAUDE_STATUSLINE_TASKS_FILE environment variable. Unset ⇒ Row 4 is simply omitted. To wire it,
# point the variable at a Markdown task list whose open items are GitHub-style `- [ ]` checkboxes
# (a leading **bold title** is used as the label when present). Install by setting
# `statusLine.command` in your Claude Code settings to the path of this script.
#
# Gauges (eff/ctx/rate) keep a green→yellow→red grade so danger reads instantly; every other
# section gets a fixed unique color for at-a-glance legibility.
RST='\033[0m'
C_HOST='\033[1;96m'     # bold bright cyan — identity
C_CWD='\033[38;5;39m'   # blue            — location
C_GIT='\033[1;95m'      # bold magenta    — repo/branch
C_DIRTY='\033[1;91m'    # bold red        — uncommitted changes (attention)
C_MODEL='\033[1;97m'    # bold white      — model
C_VIM='\033[1;94m'      # bold blue       — vim mode badge
C_P0='\033[1;38;5;208m' # bold orange     — P0 label
C_P0T='\033[38;5;215m'  # soft orange     — P0 text
C_RDIM='\033[2m'        # dim             — reset row labels
C_RVAL='\033[38;5;117m' # light blue      — reset row times
SEP='\033[2m|'"$RST"    # dim pipe
# grade colors (gauges)
G_OK='\033[1;92m'       # bold green
G_WARN='\033[1;93m'     # bold yellow
G_HOT='\033[1;91m'      # bold red

input=$(cat)

# Core fields
cwd=$(echo "$input" | jq -r '.cwd // .workspace.current_dir // empty')
model=$(echo "$input" | jq -r '.model.display_name // empty')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
repo_name=$(echo "$input" | jq -r '.workspace.repo | if . then .owner + "/" + .name else empty end')
worktree_branch=$(echo "$input" | jq -r '.worktree.branch // empty')
git_worktree=$(echo "$input" | jq -r '.workspace.git_worktree // empty')
vim_mode=$(echo "$input" | jq -r '.vim.mode // empty')
# Extra segments (all degrade gracefully when their field is absent)
effort=$(echo "$input" | jq -r '.effort.level // empty')
rate_5h=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
rate_7d=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
reset_5h=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
reset_7d=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

# Shorten home dir like Starship does
short_cwd="${cwd/#$HOME/~}"

# epoch (seconds) -> local time string; BSD date (-r) with GNU (-d @) fallback
fmt_epoch() {  # $1=epoch  $2=strftime fmt
  local e
  e=$(printf '%.0f' "$1" 2>/dev/null) || return 1
  date -r "$e" "$2" 2>/dev/null || date -d "@$e" "$2" 2>/dev/null
}

# Git dirty marker — one cheap porcelain call, scoped to cwd (works regardless of $PWD)
dirty_count=""
if [ -n "$cwd" ] && git -C "$cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  dirty_count=$(git -C "$cwd" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
fi

# P0 — first unchecked task from the configured task list. Bullets here wrap across physical lines
# and usually lead with a **bold title**; grep sees only the first line, so prefer the bold title as
# a clean label and otherwise cap the first line — Row 4 must never show a mid-sentence fragment.
# No task file configured (CLAUDE_STATUSLINE_TASKS_FILE unset) ⇒ Row 4 is omitted entirely.
p0=""
tasks_file="${CLAUDE_STATUSLINE_TASKS_FILE:-}"
if [ -n "$tasks_file" ] && [ -f "$tasks_file" ]; then
  p0_raw=$(grep -m1 '^- \[ \]' "$tasks_file" 2>/dev/null)
  if [ -n "$p0_raw" ]; then
    p0=$(printf '%s' "$p0_raw" | sed -n 's/^- \[ \] *\*\*\([^*]*\)\*\*.*/\1/p')   # leading bold title
    [ -z "$p0" ] && p0=$(printf '%s' "$p0_raw" | sed 's/^- \[ \] *//; s/\*\*//g')  # fallback: plain text
    [ "${#p0}" -gt 72 ] && p0="${p0:0:71}…"                                          # one-row cap
  fi
fi

user=$(whoami)
host=$(hostname -s)

# Row 1 — location: identity, cwd, git
row1=()
row1+=("$(printf "${C_HOST}%s@%s${RST}" "$user" "$host")")
if [ -n "$short_cwd" ]; then
  row1+=("$(printf "${C_CWD}%s${RST}" "$short_cwd")")
fi
if [ -n "$repo_name" ]; then
  branch_label="$repo_name"
  if [ -n "$worktree_branch" ]; then
    branch_label="$branch_label:$worktree_branch"
  elif [ -n "$git_worktree" ]; then
    branch_label="$branch_label:$git_worktree"
  fi
  if [ -n "$dirty_count" ] && [ "$dirty_count" -gt 0 ]; then
    row1+=("$(printf "${C_GIT}(%s ${C_DIRTY}*%s${C_GIT})${RST}" "$branch_label" "$dirty_count")")
  else
    row1+=("$(printf "${C_GIT}(%s)${RST}" "$branch_label")")
  fi
fi

# Row 2 — session state: model, effort, ctx, vim
row2=()
if [ -n "$model" ]; then
  row2+=("$(printf "${C_MODEL}%s${RST}" "$model")")
fi
if [ -n "$effort" ]; then
  case "$effort" in
    max)    ecolor="$G_HOT" ;;
    xhigh)  ecolor="$G_WARN" ;;
    high)   ecolor='\033[1;96m' ;;  # bright cyan
    medium) ecolor="$G_OK" ;;
    *)      ecolor='\033[2m'  ;;     # dim (low / unknown)
  esac
  row2+=("$(printf "${ecolor}eff:%s${RST}" "$effort")")
fi
if [ -n "$used_pct" ]; then
  used_int=$(printf '%.0f' "$used_pct")
  if [ "$used_int" -ge 85 ]; then color="$G_HOT"
  elif [ "$used_int" -ge 70 ]; then color="$G_WARN"
  else color="$G_OK"; fi
  row2+=("$(printf "${color}ctx:%d%%${RST}" "$used_int")")
fi
if [ -n "$vim_mode" ]; then
  row2+=("$(printf "${C_VIM}[%s]${RST}" "$vim_mode")")
fi

# Row 3 — rate limits: graded % + local reset clock (5h time only, 7d weekday + time)
row3=()
grade() {  # echo a grade color for an integer percent
  if [ "$1" -ge 90 ]; then printf '%s' "$G_HOT"
  elif [ "$1" -ge 70 ]; then printf '%s' "$G_WARN"
  else printf '%s' "$G_OK"; fi
}
if [ -n "$rate_5h" ] || [ -n "$reset_5h" ]; then
  seg=""
  if [ -n "$rate_5h" ]; then
    fh=$(printf '%.0f' "$rate_5h")
    seg="$(printf "$(grade "$fh")5h:%d%%${RST}" "$fh")"
  fi
  if [ -n "$reset_5h" ]; then
    t5=$(fmt_epoch "$reset_5h" '+%H:%M')
    [ -n "$t5" ] && seg="${seg:+$seg }$(printf "${C_RDIM}resets ${RST}${C_RVAL}%s${RST}" "$t5")"
  fi
  [ -n "$seg" ] && row3+=("$seg")
fi
if [ -n "$rate_7d" ] || [ -n "$reset_7d" ]; then
  seg=""
  if [ -n "$rate_7d" ]; then
    wk=$(printf '%.0f' "$rate_7d")
    seg="$(printf "$(grade "$wk")7d:%d%%${RST}" "$wk")"
  fi
  if [ -n "$reset_7d" ]; then
    t7=$(fmt_epoch "$reset_7d" '+%a %H:%M')
    [ -n "$t7" ] && seg="${seg:+$seg }$(printf "${C_RDIM}resets ${RST}${C_RVAL}%s${RST}" "$t7")"
  fi
  [ -n "$seg" ] && row3+=("$seg")
fi

# Row 4 — current P0 task on its own line so the full title always has room
row4=()
if [ -n "$p0" ]; then
  row4+=("$(printf "${C_P0}P0: ${RST}${C_P0T}%s${RST}" "$p0")")
fi

# Join one row's segments with the dim-pipe separator
join_row() {
  local result="" seg
  for seg in "$@"; do
    if [ -z "$result" ]; then
      result="$seg"
    else
      result="$result $(printf '%b' "$SEP") $seg"
    fi
  done
  printf '%s' "$result"
}

# Emit: row 1 always; rows 2–4 each on their own line only when they have content
printf '%s' "$(join_row "${row1[@]}")"
if [ "${#row2[@]}" -gt 0 ]; then
  printf '\n%s' "$(join_row "${row2[@]}")"
fi
if [ "${#row3[@]}" -gt 0 ]; then
  printf '\n%s' "$(join_row "${row3[@]}")"
fi
if [ "${#row4[@]}" -gt 0 ]; then
  printf '\n%s' "$(join_row "${row4[@]}")"
fi
