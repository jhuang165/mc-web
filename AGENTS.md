# Minecraft Java 1.7.10 web recreation

Read `.shared-memory/PROJECT.md`, recent `.shared-memory/notes/`, and `public/research/parity.md` before editing. `CLAUDE.md` points here; both agents use the same facts and handoffs. The target is 1.7.10, not modern Minecraft. Do not claim full parity.

Use the `mc-web-memory` MCP server: call `get_context`, then `claim_work` for the relative files/subsystems you will edit. Check other claims and choose separate files when another agent owns them. Finish with `finish_work`, stating what changed, test results, remaining work, and relevant commit/deployment IDs. Claims are advisory and expire; they do not enforce filesystem locks. If starting Codex locally, `npm run agent:codex` explicitly supplies the bridge configuration. If MCP is unavailable, read/update the shared Markdown notes directly and check Git before edits. Never store credentials in notes.

This directory is the canonical Git checkout and GitHub repository root. In the original Desktop workspace it is `mc-web/game`; the parent folder's initially empty Git repository is not the app repository. Run Git commands here. Sites and GitHub share this source history; remote `github` points to `https://github.com/jhuang165/mc-web.git`. Keep `.openai/hosting.json` and the existing owner-private Site audience. Use the Sites workflow for Site publication; `git push github` alone does not publish the Site.

Validate behavior changes with `npm test` and `npm run build`. For bridge changes also run `python3 -m unittest discover -s tools -p 'test_memory_bridge.py'`. Research inputs in `tools/research/` stay ignored; original assets retain their provenance/ownership credits. Research tools need a JDK; browser tests do not require shipping game classes.

Before committing, inspect the complete diff and coordinate with other active work claims. Commit only intended changes; do not stage another agent's unfinished work. Push reviewed commits with `npm run push:github`; this validates and pushes the current branch, without force-pushing or automatically committing. Pull with `git pull --ff-only github main` when the worktree is clean. Do not reset or rebase a shared working tree while the other agent is using it.

Core code: `src/world.js`, `scene.js`, `main.js`, `survival.js`, `mining.js`, `farming.js`, `entities.js`, `experience.js`, `container-ui.css`, `gui.js`. Native mining evidence is in `public/research/mining-reference.json`; do not replace 1.7.10 rules with later-version formulas.
