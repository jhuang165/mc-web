# tiles92 (batch 92): random-tick and sleep darkness, the away run's clock

Branch `batch92-tiles92`, worktree `wt92-tiles`. Target is 1.7.10. This does not claim full parity.

## Summary

- `main.js`: `trees.light`, `farming.lightLevel`, the ring wrap (`wrapRandomTickLight`), the per-tick sleep check (`tickBed`) and the bed click (`useBed`) read `entitySubtracted()` (the value native has after `WorldServer.tick`'s skylight calculation) instead of `scene.subtracted`. Differs only with the clock frozen (one tick). A bed click is handled between ticks, so it reads what the last tick left (`entitySub` keeps its value until the next tick).
- `away-entities.js`: the away run's clock was wrong. `plan.time` is the clock at the END of the trip (`away-commands.js` `now`), but the run started at it, so every tick read a time up to `plan.ticks` too late, and the angle sample was partial 0 of the pre-step time (one tick early). Now `clock` starts at `plan.time - ticks` (only when doDaylightCycle is on), counts only while the rule is on (new `cycling` option, passed by `away-world.js`), the darkness is `celestialAngle(clock, 1)` (`(pre-step + 1) / 24000`, frozen or not), and `mobSv.time` is the post-step time. A `/time` shift reaches the next tick's read (`shifted`), since command blocks fire after the skylight calculation.
- Checked and unchanged: the daylight detector (b88, `sensorSky`), the spawner tile pass (b91, `entitySubtracted`), the away sensors (`away-world.js` `worldTimeAt`, b88), beacons and furnaces read no light. Ice and snow melt/freeze read saved block light only (no sky term). Mushrooms read `fullLight` with subtracted 0. Grass spread is not modelled as a light read here.

## Evidence

- **Bytecode-read** (b88): `WorldServer.tick` (`mt.b`) computes `skylightSubtracted` from the time before the +1, then sleep wake-up, random ticks, entities, tile entities. `EntityPlayer.onUpdate` reads `World.isDaytime` (skylightSubtracted < 4) in the entity pass.
- **Port-read:** `away-commands.js` comment and `now()` (end-of-trip clock); `lighting.celestialAngle(t, partial)` equals `clock.celestialAngle`.
- **Executed:** none new.

## Verification

- `node --test --test-concurrency=2 src/tiles92-b92.test.js`: 6/6. With `away-entities.js` reverted: 2/6 (4 fail).
- One targeted run (away-*, tiles8x/9x, saved-order, rain8x, bed, ring/dimension random ticks, world-tick, headless): 359/359. `node --check src/main.js` ok. No build, no browser.

## Found wrong in the batch 91 list

- "`away-entities.js` keeps its own clock" understated it: the clock started at the trip's end time, not its start.

## Follow-ups

- A `/time` shift made after `ents.tick` in the same away tick (tile pass) is excluded from the next tick's read; command blocks fire from the tick tree, so none known.
- A gamerule change mid-run is not reflected in the start clock.
- Browser-only: sunburn, crop growth and sleeping at dusk with the daylight cycle off.
