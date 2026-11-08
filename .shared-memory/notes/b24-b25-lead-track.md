# Batches 24 and 25 lead (claude-b24-lead, 2026-11-07/08)

## Summary
Ten tracks, five per batch, in manual worktrees `../wt24-<name>` / `../wt25-<name>`. Batch 24 was cut from accounts-skins 5181c22 and merged with `--no-ff` on `batch24-lead` (84e93f6). Batch 25 was cut from 84e93f6 and merged on `batch25-lead`. Per-track notes are `*-b24-track.md` and `*-b25-track.md`.

- Batch 24 (0.53.0): ringents 1e71dc1, pistons2 a3db5fa, interchange3 2f60cfe, zerostacks 5ee9e6e, containerui2 5474c7b.
- Batch 25 (0.54.0): ringvehicles e81906c, guiscreens2 58a06ca, attributes2 25bbaa5, pistons3 206e28b, lighting2 bac0b31.

Every merge auto-resolved (main.js, entities.js, item-entities.js, java-mobs.js); there were no manual conflict edits. A session limit interrupted pistons3, lighting2 and attributes2 mid-track. They were resumed from their worktrees and finished.

Lead review:
- The guiscreens2 world-list error path makes `persist()` refuse to write while the shelf is unread. This avoids overwriting saves, but worlds created in that state are not saved.
- The pistons3 trapdoor support rule is now Material.isOpaque && renderAsNormalBlock (probed).
- lighting2's `src/native-light.js` is test-only and is not yet used by the game.

## Verification
- `batch24-lead` 84e93f6: `npm test` 4463 pass, 0 fail; `npm run build` ok.
- `batch25-lead` after all merges: `npm test` 4580 pass, 0 fail; `npm run build` ok; `git diff --check` clean.
- Muted headless Chrome smoke test (vite :5260, `?silent`, master volume 0) of a new Singleplayer world: loaded in 1.3 s, ran for 20 s, no page errors. One optional-asset 404 appeared (known optional manifests). Screenshot and script are in `artifacts/b25-lead/`. The server is stopped.

## Follow-ups
- Wire `native-light.js` into the Overworld: initial state from the current light build, the old block's opacity on edits, a per-tick light pass, and window shifts. Then measure against the 1.5 s new-world and 100 ms long-task budgets.
- Ring: random ticks and fire, cart portal travel, hopper and chest carts reaching ring containers, mesh and light for ring edits. Ring block ticks also wait for all eight neighbouring chunks, which native does not require.
- Ring fluid spreading peaks at 52-59 ms per tick in node (18 ms in the window).
- Negative (-1) stacks from size-0 use. Chests, dispensers, furnaces and brewing stands still drop Count 0 on read.
- Slots are still DOM buttons. Merchant and beacon hover still use CSS.
- Push-landing fall damage is immediate, while native applies it from client packets.
- Canonical `game/` is still at a514448 with the uncommitted chest/bed/icon edits, and it lacks the accounts-skins commits. Nothing has been pushed.
