# Codex + Claude Code collaboration

The canonical checkout is this repository. In the original Desktop workspace, enter `mc-web/game`; the parent folder is only a workspace wrapper. GitHub remote `github` is https://github.com/jhuang165/mc-web . The existing Sites publishing history is preserved in the same Git repository.

```sh
npm ci
npm run setup:bridge
npm run agent:claude
# Or start a new Codex session with the bridge explicitly supplied:
npm run agent:codex
```

Claude reads `CLAUDE.md`, which imports `AGENTS.md` and `.shared-memory/PROJECT.md`. The project `.mcp.json` registers `mc-web-memory`. Claude may display a project-server approval prompt; approve this local server in the project session. The setup script also generates `.codex/config.toml` with absolute paths for this checkout. Restart Codex/Claude sessions after configuration. Codex only loads project configuration for trusted folders; the setup script does not change global trust or approval settings.

The MCP bridge is a local stdio Python process with no external dependencies, API keys, network listener or shell execution tools. It provides six tools: context, listing/reading/writing notes, claiming work and finishing work. Both clients point to the same `.shared-memory` directory. Notes are versioned Markdown; writes use revision checks. Runtime task claims use SQLite transactions to reject overlapping paths. Do not copy runtime SQLite state between clones.

At startup, read context. Claim the file paths you plan to edit, use a different scope if another agent owns them, and leave a handoff containing changes, validation and commit IDs. Claims are advisory, expire after 30 minutes by default and cannot prevent arbitrary direct edits. They coordinate agents using the same checkout. Separate clones exchange notes through Git; their live claims are not a cross-machine lock service. Use separate worktrees/branches for overlapping implementation and merge deliberately.

```sh
npm test
npm run test:bridge
npm run build
git diff
# Stage only the completed work you reviewed, then commit it.
npm run push:github
```

`push:github` requires a clean, committed worktree, validates the app and bridge, then pushes the current branch to `github`. It never automatically stages, commits, force-pushes, resets or rebases. GitHub Actions runs app tests, bridge tests and the build on pushes/PRs. Pull `main` with `git pull --ff-only github main` only when the shared working tree is clean and idle. Pushing GitHub does not automatically deploy the owner-private Site; keep Sites publication separate.

Useful verification:

```sh
claude mcp get mc-web-memory
npm run agent:codex -- --check
python3 tools/memory_bridge.py --context
```

The current Claude CLI reports the project server as pending approval until it is approved in a Claude session. Configuration files and the stdio protocol are tested independently of that approval.

Official references: [Claude project MCP configuration](https://code.claude.com/docs/en/mcp#project-scope), [Codex project MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli). The project instructions and Markdown notes remain usable if MCP has not loaded yet.

The Codex launcher supplies only this project's memory server through command-line configuration. It also works when an installed CLI's MCP management commands do not enumerate project-scoped configuration. It does not alter global configuration or project trust.
