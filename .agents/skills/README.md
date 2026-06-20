# Agent Skills

This directory holds agent skills in the [Agent Skills](https://agentskills.io) open
standard — a portable, version-controlled format for giving AI agents specialized
capabilities. Each skill is a directory with a `SKILL.md` entrypoint plus optional
`references/` and `assets/`. Agents load metadata at startup, full instructions on
activation, and supporting files on demand.

## Available Skills

| Skill | Description |
|-------|-------------|
| [unbind-template-dev](unbind-template-dev/) | Author one-click app templates for Unbind — services, inputs, generated secrets, variable references, the deploy flow, and the icon registry. |

## Installation

`.agents/skills/` is the standard path from the agentskills.io spec; many agents discover it
automatically. Others want a symlink into their own directory.

### Claude Code

Claude Code discovers skills from `.claude/skills/` (project) or `~/.claude/skills/`
(personal). Symlink to expose this skill:

```bash
mkdir -p .claude/skills
ln -s ../../.agents/skills/unbind-template-dev .claude/skills/unbind-template-dev
```

After linking it shows up as `/unbind-template-dev` and loads automatically when you ask
about Unbind templates.

### Other agents (Cursor, Copilot, Gemini, Codex, ...)

Same pattern, different directory:

```bash
mkdir -p .<agent>/skills
ln -s ../../.agents/skills/unbind-template-dev .<agent>/skills/unbind-template-dev
```

`.cursor/skills/`, `.github/skills/`, `.gemini/skills/`, `.codex/skills/`. See the
[client showcase](https://agentskills.io/clients) for specifics.

## Adding New Skills

1. Create a lowercase-hyphenated subdirectory (e.g. `my-new-skill/`).
2. Add `SKILL.md` with YAML frontmatter (`name`, `description`) and markdown instructions.
3. Optionally add `references/` and `assets/`.
4. Keep `SKILL.md` under ~500 lines; push detail into reference files.

See the [Agent Skills spec](https://agentskills.io/specification) for the full format.
