# Agent Skills

Vendored from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)
(plugin version 0.6.8, commit `020ec10a788f5703108d093a4bd3d9a7c3847d36`), MIT licensed — see `LICENSE`.

25 skills covering the software development lifecycle. Claude Code picks them up
automatically from `.claude/skills/`; each skill's `description` in its
`SKILL.md` front matter controls when it triggers.

| Phase   | Skills |
| ------- | ------ |
| Define  | interview-me, idea-refine, spec-driven-development, constraint-driven-development |
| Plan    | planning-and-task-breakdown |
| Build   | incremental-implementation, test-driven-development, context-engineering, source-driven-development, doubt-driven-development, frontend-ui-engineering, api-and-interface-design |
| Verify  | browser-testing-with-devtools, debugging-and-error-recovery |
| Review  | code-review-and-quality, code-simplification, security-and-hardening, performance-optimization |
| Ship    | git-workflow-and-versioning, ci-cd-and-automation, deprecation-and-migration, documentation-and-adrs, observability-and-instrumentation, shipping-and-launch |
| Meta    | using-agent-skills |

## Updating

```sh
git clone --depth 1 https://github.com/addyosmani/agent-skills.git /tmp/agent-skills
rm -rf .claude/skills/*/ && cp -R /tmp/agent-skills/skills/. .claude/skills/
```

The subagents, slash commands and hooks from the same upstream repo live in
`.claude/agents/`, `.claude/commands/` and `.claude/hooks/` — see
`.claude/README.md`.
