# Claude Code setup

Everything here is vendored from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)
(plugin version 0.6.8, commit `020ec10a788f5703108d093a4bd3d9a7c3847d36`), MIT licensed —
see `skills/LICENSE`.

| Path        | What |
| ----------- | ---- |
| `skills/`   | 25 lifecycle skills, loaded automatically. See `skills/README.md`. |
| `agents/`   | 4 specialist subagents: `code-reviewer`, `security-auditor`, `test-engineer`, `web-performance-auditor`. |
| `commands/` | 9 slash commands: `/spec`, `/plan`, `/build`, `/test`, `/review`, `/code-simplify`, `/constraints`, `/ship`, `/webperf`. |
| `hooks/`    | Session and tool hooks, wired up in `settings.json`. |
| `settings.json` | Hook registration. |

## Local changes to the upstream copy

Three deliberate deviations, to redo when refreshing from upstream:

1. **Commands are de-namespaced.** Upstream ships them as a plugin, so they say
   `Invoke the agent-skills:code-review-and-quality skill`. Skills vendored into
   `.claude/skills/` are not namespaced, so the `agent-skills:` prefix is stripped
   or the skill name will not resolve.
2. **Hook paths.** Upstream's `commands/*.toml` (Antigravity format) is not used;
   the Claude Code `.md` commands from upstream's own `.claude/commands/` are.
   Hook scripts are referenced at `${CLAUDE_PROJECT_DIR}/.claude/hooks/`, and the
   two test scripts were anchored to their own directory instead of a repo-root
   `hooks/`.
3. **`session-start-test.sh` was fixed.** Upstream's version asserts a stale
   payload shape (`{priority, message}`) while the hook correctly emits the
   `hookSpecificOutput` envelope Claude Code requires — so the upstream test
   fails against its own hook. Ours asserts the current shape.

## Hooks: what is on and what is not

Active in `settings.json`:

- **`session-start.sh`** (SessionStart) — injects the `using-agent-skills`
  meta-skill so skill discovery works from the first turn. Needs `jq`; degrades
  to a notice without it.
- **`sdd-cache-pre.sh` / `sdd-cache-post.sh`** (Pre/PostToolUse on WebFetch) —
  caches fetched pages under `.claude/sdd-cache/` and serves them again only
  when the origin answers HTTP 304. No TTL, no staleness guessing. Needs `jq`
  and `curl`; passes the fetch through if either is missing.

**Deliberately not enabled: `simplify-ignore.sh`.** It is opt-in for
`/code-simplify`, and it works by rewriting your source files on disk — every
`Read` replaces `simplify-ignore` blocks with placeholders and the `Stop` hook
restores them from a backup under `.claude/.simplify-ignore-cache/`. If a
session dies between those two points, files are left holding placeholders and
the real code only exists in that cache. Enable it per `hooks/SIMPLIFY-IGNORE.md`
if you want it, ideally in `settings.local.json`.

## Verified

- `bash .claude/hooks/session-start-test.sh` → passes
- `bash .claude/hooks/simplify-ignore-test.sh` → 21 passed, 0 failed
- sdd-cache round trip exercised manually: post-hook wrote an entry, pre-hook
  revalidated via 304 and exited 2 with the cached body

## Updating

```sh
git clone --depth 1 https://github.com/addyosmani/agent-skills.git /tmp/agent-skills
rm -rf .claude/skills/*/ && cp -R /tmp/agent-skills/skills/. .claude/skills/
cp /tmp/agent-skills/agents/*.md .claude/agents/
cp /tmp/agent-skills/.claude/commands/*.md .claude/commands/
cp /tmp/agent-skills/hooks/*.sh /tmp/agent-skills/hooks/*.md .claude/hooks/
chmod +x .claude/hooks/*.sh
sed -i 's/agent-skills://g' .claude/commands/*.md   # deviation 1
```

Then redo deviations 2 and 3 above and re-run the two test scripts.
