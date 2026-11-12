# Batch 48 lead (claude, 2026-11-11)

Five Sonnet tracks ran in `../wt48-<name>` on `batch48-<name>`. All were cut from 61e069a4a (0.76.0, equal to github/main). The lead reviewed each one and merged it `--no-ff` on `batch48-lead`. Each track has its own note, `<name>-b48-track.md`. Every track was vanilla only, with no `server/` or `src/multiplayer/` edits. The gun side runs separately and was not touched.

## Merges (in merge order)
- **vehiclerender** (39cd969f2): boats, carts, paintings, item frames, knots, the boat shadow and the spawner cart's display mob draw from the client copies. A view is a cached `Object.create(live)` with the copy's fields laid over it, so renderer mesh maps keyed by entity stay stable. The ridden vehicle, `aimedCart` and `aimedHanging` stay on the live entities.
- **swordblock** (a08aadd75): `blockedDamage` in `armor-enchantments.js`, `survival.blocking` set from the use state in `movementTick`; riders are not slowed by item use. Executed `BlockingProbe`, 119 records. The lead removed an empty `logs/latest.log` the track committed (f99fc84fb).
- **deathdrops** (16a51506c): `EntityWorld.flushLoot` at every walk step, `mobs.spawnLoot` set in main.js and the away run, the `joined` hooks for boats, carts and hanging entities, exp bottles on `mobs.worldRandom`. `EntityListProbe` 78 cases.
- **trackertiming** (f26d0e7a8): `tracker-birth.js`, `airBorne`/`velocityChanged` on vehicle collisions and hits, furnace and command cart watchers, the `sameStack` string fix. boatFar: the probe was wrong; the port's untrack at tick 71 is right. Regenerating the other tracker references locally gives nondeterministic rows with the old probe too, so the committed ones were kept.
- **pistonpush** (4fb80d72a): `b48pp` (flag `B48`), `pushServerPlayer`, the copy's own `onGround`, the `afterEntities` hook. **Lead fix** (8a086c83d): the track only passed `serverPlayer` in the replay, so live pistons never pushed the copy; `installPistons` in `redstone-runtime.js` now passes `game.mobs()?.ai?.player`.

## Verification (batch48-lead, all five merges)
- `npm test`, once: 6220 tests, 6220 passed. The 76 "exit prewarm: this.host.active" log lines are the same as in batch 47.
- `npm run build`: ok (5.66 s). Bridge unittest: OK. `git diff --check 61e069a4a`: clean.
- Muted headless Chrome smoke (vite :5546, `--mute-audio`, master volume 0; script and screenshots in `artifacts/b48-lead/`), Survival world:
  - Walking 4.14 blocks/s free, 0.69 with an iron sword blocking.
  - A zombie-style hit of 6 costs 6 free and 3.5 blocking; a fall of 6 costs 6 blocking.
  - A boat, painting, item frame and leash knot render from their copies; all five copies (boat, cart, painting, frame, knot) are present. The cart was out of view on screen.
  - A boat given motion 0.2 moved; live x 62.70, copy x 62.87 after 1.5 s.
  - A cow with 1 health and a player hit fell and died; leather and beef and an orb of 3 appeared.
  - No long tasks in 60 turns. 160 ticks per 8 s in the Overworld and in the Nether. The server copy rests at the player's place, on the ground.
  - The only console errors were the known static 404 and the about:blank localStorage message.
  - The smoke's first run gave a port id that is not a sword (276), so nothing blocked; the second used 114 (iron sword).

## Remaining gaps
See "Still open from batch 48" in `public/research/remaining-gaps.md`, plus each track note.
