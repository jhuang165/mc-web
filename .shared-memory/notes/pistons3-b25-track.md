# Pistons3 track, batch 25

Branch `batch25-pistons3` (worktree `wt25-pistons3`), cut from 84e93f6. Commits: 3989d5c (per-tile push order), 591670d (move tails, own moves, new native records), plus this note.

## Summary

- **Per-tile push order.** `TileEntityPiston.updateEntity` pushes inside the tile loop.
  - `src/redstone.js` tile update calls `w.pistonPush(te, progress, delta)`. `src/piston-live.js` installs the hook, and `tick()` reinstalls it.
  - Entities are ordered by chunk, then slice, then list (`nativeOrder`).
  - Collision cells run from `floor(minY) - 1`.
  - Vehicle blockers in `piston-push.js` use live boxes with fround widths.
  - Trapdoor support uses the "solid top" column (`shaped-blocks.js`), probed by scenario "trapdoor-on-redstone-block".
- **Player push tail.** `pushPlayer` runs the player's moveEntity tail through `player-environment.js` `playerMoveTail`: cactus and fire hurts, the fire counter and setFire, webs, the fizz.
  - A landing calls `landPlayer` (fall damage, trample, sound, dust), which was extracted from `finishPlayerMovement`.
  - main.js changes are minimal: the adapter `tail`/`land`, the `playerFizz` and `playerLanding` helpers, and the `itemSystem`/`orbSystem` hooks.
- **Items, TNT, falling blocks, orbs.** These now use their own move.
  - Items go through `ItemEntities.push`, with the noClip from the last tick's pushOutOfBlocks and inWater. A noClip move keeps onGround. Items now record collidedH.
  - Orbs go through `ExperienceOrbs.move`.
  - TNT and falling blocks run entities.js moveEntity on the entity.
- **Native records.**
  - The probe adds item, noClip item, TNT, falling sand and orb live kinds, plus a `watch` cell readout.
  - New scenarios: the 8 order-*, items, TNT/sand/orb, boat blocked by item, carts on detector rails, pigs on a lifted wall/gate, 33 odd-block3 ids, and 4 beside-stone connecting blocks.
- **Stored-block fixes.** A wall's pool box reads its neighbours at the moving cell. Panes and bars are the full cube.

## Verification

- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-piston-live.mjs`: PASS, 175 scenarios, 474 live entity states, 92 live entity moves. The 8 order scenarios differ under the deferred order.
- `npm test`: 4518 pass, 0 fail (player-physics fixtures included).
- `npm run build`: OK.
- No browser check was run.

## Follow-ups

- The player push-landing damage is applied immediately. Native `EntityPlayerMP.updateFallState` is a no-op, and the server applies the fall from client packets.
- Pane, fence and carpet pool boxes depend on stale shared Block bounds. The port uses the probe's fresh-JVM values.
- Port items lack fallDistance and updateFallState. Falling blocks' own tick uses step 0.5. Item rain wetness reads inWater only.
- `structure-simulation.js` boat and cart blockers use non-fround widths and ignore items.
- Riders follow on their next tick. Stored blocks outside the probed lists remain unverified.
