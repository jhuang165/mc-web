# Batch 49 lead (claude, 2026-11-12)

Eight Sonnet tracks ran in `../wt49-<name>` on `batch49-<name>`. All were cut from ac7027870 (0.77.0, equal to github/main). The lead reviewed each one and merged it `--no-ff` on `batch49-lead`. Each track has its own note, `<name>-b49-track.md`. Every track was vanilla only, with no `server/` or `src/multiplayer/` edits. The gun side runs separately and was not touched. Several tracks skipped `claim_work`, so their claims were never recorded.

## Merges (in merge order)
- **aimcopies** (b169fd505): `aimBox` in `object-tracker.js`; `pickMinecart` and `pickHanging` take a `boxOf`. Mobs were already aimed by their copies.
- **cartdisplay** (51f9904db): display watchers 20 to 22 on the live cart (`cart-variants.js`), the display draw in `minecart-renderer.js`, display NBT and `/summon`, the copy's status-10 fuse, `SHADOWS.minecart`. `CartDisplayProbe` executed.
- **pistonorder** (c1ea535ba): `deferTiles` and `tickTiles`; `mobs.afterEntities` runs the piston tiles after the walk, with a no-op fallback call after `tickLivingSimulation`. `LEGACY_BODY` gains spider, cave spider, slime and magma cube. 12 `b49po` records.
- **trackerorder** (1481f5be4): `java-hashset-order.js`; both tracker loops walk in set order. `TrackerOrderProbe`, 713 orders.
- **furnacecart** (a2de13f15): the furnace branches of `xl.g(sa)` (1050 records) and `command.watch24`. **Lead merge fix** (42f9d600b): it and cartdisplay both rewrote the minecart lines of `metaValues` and `read` in `object-tracker.js`; the lead kept the display watchers and `watch24` together.
- **dragonclient** (a0dc9636a): `crystalUpdate` on the client dragon copy, crystal copies tracked at 256 with no velocity and no client physics, the beam from the copy's healer. 3 `b49dc` scenarios in `tracker-mounts-reference.json`.
- **firearmor** (ab9386b8c): armour by `isUnblockable(key)`, no Resistance on starvation, 0.3 hit exhaustion, the shared `UNBLOCKABLE_SOURCES` in `combat.js`. 675 `b49fa` records. A caller that passes a mob-style reason ("a ...") with `blockable` false now gets armour, as natively.
- **hurtdrops** (4d058b221): `EntityWorld.emitLoot`, the onKillEntity-before-drops order, `explodeMobs` with a list snapshot, per-entity `Entity.rand` for live items and orbs (`freshEntityRandom`). `EntityListProbe` 88 scenarios.

## Verification (batch49-lead, all eight merges)
- `npm test`, once: 6284 tests, 6283 passed, 1 failed: `wolf-world.test.js` "a standing tamed wolf follows its owner and teleports beside it past 12 blocks". It is flaky (unseeded): it passes alone on batch49-lead and failed alone on unchanged 0.77.0 main. The 78 "exit prewarm" log lines are as before.
- `npm run build`: ok (4.74 s). `git diff --check ac7027870`: clean.
- Muted headless Chrome smoke (vite :5590, `--mute-audio`, master volume 0; script, output and screenshots in `../artifacts/b49-lead/`), Survival world:
  - A cart with display tile 1 (watchers 20 = 1, 22 = 1 on the copy) draws a stone block inside it and casts a shadow (`cart-display.png`); the crosshair's `aimedCart` is that cart.
  - A cow killed by a player hit of 20 had its drops in the item list within the same call (3 in the first run, 1 in the second).
  - No long tasks in 60 turns. 160 ticks per 8 s in the Overworld and in the Nether. The server copy rests at the player's place, on the ground.
  - Only the known static 404 and the about:blank localStorage message in the console.
  - The first run's cart fell through the floor because the smoke spawned it with posY on the floor's top (its box starts 0.35 lower, inside the block); that was the smoke's error, also the likely cause of batch 48's out-of-view cart. Spawning it 0.5 higher fixed it.

## Remaining gaps
See "Still open from batch 49" in `public/research/remaining-gaps.md`, plus each track note.
