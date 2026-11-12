# Batch 46 lead (claude, 2026-11-11)

Five Sonnet tracks ran in `../wt46-<name>` on `batch46-<name>`. All were cut from a1ba8548c (0.74.0, equal to github/main). The lead reviewed each one and merged it `--no-ff` on `batch46-lead`. Each track has its own note, `<name>-b46-track.md`. Every track was vanilla only, with no `server/` or `src/multiplayer/` edits. The gun side runs separately and was not touched.

## Merges (in merge order)
- **awayvehicles** (5a8f2529f): away carts, boats, hanging entities and firework rockets tick at their join place in the one walk (`walks.set("rocket", …)`, `FireworkRockets.tickOne`/`reap`, `launch` reports its join). Away carts and boats now meet away mobs as blockers. The shadow-kill death screen still shows on return (needs a live worker; reasoning in `dimensions.md`).
- **itematlas2** (7be33f5a7): `item-passes.js` gives spawn eggs and potions their two native passes from atlas cells (leather unchanged). The clock and compass are atlas cells showing the current frame (`setItemAtlasFrame`). Bytecode-read: only the blocks TextureMap gets mipmaps; the piston item is a cube with its native faces (executed draws, `piston-item.test.js`).
  - Review: a frame change redraws one cell and re-uploads the whole atlas. The smoke shows no long tasks while turning with the compass held.
- **playerthrows** (650a3382c): the player's potion and exp bottle used `Math.sin`/`Math.cos` and now share `launch` with MathHelper's table (25 executed launch records). Player balls hit carts and boats (`thrownAtVehicleOrHanging`; Creative breaks with no drop), eggs and pearls break paintings, and a pearl moves once more after impact. `EntityListProbe` has 63 scenarios.
- **clienttargets** (309fc0b54): on a client world, boats, carts, paintings, item frames, knots and the dragon's parts answer `attackEntityFrom` true (executed), so the client arrow ends and the hook attaches. The dragon lists its parts, not its box. A burning client arrow sets the copy's fire (drawn by `mob-renderer.js`, zeroed at the copy's next update). A burning server arrow flags `velocityChanged` every 20th tick. `main.js` auto-merged with playerthrows.
- **mobpush** (38d52a6ae): 19 executed `b46mp` records (the probe now runs `EntityPlayerMP.onUpdateEntity` after the mobs). `ai.player.motion` is the server copy's motion (mob pushes, knockback at the hit, blast pushes, snap, friction, its own push of mobs). The witch leads by it.
  - **Sent back once**: the first round left the controlled player unpushed. The second round added `src/client-push.js`, which runs `collideWithNearbyEntities` on the client player after its move (bytecode-read: `sv.e` → `sv.bo`, Creative is pushed, a rider is not), using the client copies' positions.

## Lead fix
- a45952806: `main.js` passed the held stack's damage to first person only for a short id list, so a held spawn egg drew as an untinted egg with no spots and every held potion as a water bottle. Spawn eggs and potions are now on the list. Found in the smoke; re-checked in `artifacts/b46-lead/egg1.png`/`egg3.png`.

## Verification (batch46-lead, before the lead fix)
- `npm test`, once after all five merges: 6025 tests, 6025 passed.
- After the lead fix: `node --test src/item-passes.test.js src/first-person*.test.js` 6/6, `node --check src/main.js`.
- `npm run build`: ok (4.95 s). Bridge unittest: OK. `git diff --check a1ba8548c`: clean, after trimming one trailing blank line in `dimensions.md`.
- Muted headless Chrome smoke (vite :5546, `--mute-audio`, master volume 0; script and output in `artifacts/b46-lead/`, `smoke.mjs` and `probe-egg.mjs`):
  - Creative world loaded in 2.0 s. 160 ticks per 8 s in the Overworld and in the Nether.
  - Dropped potions show their liquid, and dropped eggs show their colours. The held compass and clock draw from the atlas.
  - No long tasks in 60 turns with the compass held.
  - A cow spawned 0.2 blocks into the player pushed the player 0.46 blocks away within 1.5 s.
  - The only console errors were the known static 404 and the about:blank localStorage message.

## Remaining gaps
See "Still open from batch 46" in `public/research/remaining-gaps.md`, plus each track note.
