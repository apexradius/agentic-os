---
name: careful
description: "Safety guardrails for destructive commands. Warns before rm -rf, DROP TABLE, force push, git reset --hard, kubectl delete. Use in production, shared environments, or /careful."
user-invocable: true
---

# Careful Mode — Destructive Command Safety

When active, flag and confirm before executing destructive operations.

## Dangerous Patterns (always warn)
| Pattern | Risk |
|---------|------|
| `rm -rf` (on non-temp paths) | Permanent data loss |
| `DROP TABLE/DATABASE` | Permanent data loss |
| `git push --force` | Overwrites remote history |
| `git reset --hard` | Discards uncommitted work |
| `git checkout -- .` | Discards all changes |
| `kubectl delete` | Destroys cluster resources |
| `docker system prune -a` | Removes all unused images |
| `chmod -R 777` | Security vulnerability |
| `> /dev/sda` | Disk destruction |
| Modifying `.env` in production | Credential exposure |

## Behavior
1. Detect dangerous command in planned execution
2. Display warning: what it does, what could go wrong
3. Ask for explicit confirmation
4. Log the action to progress.md if planning skill is active
5. Execute only after confirmation

## Auto-Activate
- When working on production servers (detected via SSH to non-localhost)
- When working on main/master branch
- When user says "be careful", "prod mode", or "careful mode"
