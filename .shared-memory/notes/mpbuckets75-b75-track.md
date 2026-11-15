# Batch 75 mpbuckets75: buckets on the dedicated server

## Summary
- `src/multiplayer/server-bucket.js` (new): `bucketUse` runs `ItemBucket.onItemRightClick` on the server by calling the single-player `traceBucket` / `useBucketAt` (`buckets.js`): the server's own 5-block ray (liquids only for an empty bucket), spawn protection (`blockProtected`, canMineBlock) and Adventure (canPlayerEdit) refuse, an empty bucket takes a water/lava source (filled bucket into the inventory, replacing a lone bucket, or thrown with `sim.items.dropPlayer` when full), a full bucket places its liquid on the adjacent cell (replaceable block broken with drops through `Fluids.wash`), Creative keeps the stack. The Nether's water only fizzes (`random.fizz`, volume 0.5, pitch 2.6 + (r - r) * 0.8, cell centre, `dim` of the player, user included) and the bucket is still used. No use statistic.
- `fizzSound`, `fluidFizz`, `installFluidHooks` in the same file: server `Fluids` now fizz (lava meeting water, `random.fizz` S29) and wash drops (torch, web, flowers, saplings, crops become items). Before, the server's Fluids had no `fizz` / `wash` callbacks at all.
- `src/fluid-wash.js` (new): `washStacks`, the drops list moved out of the single-player Fluids hook in `main.js`, which now calls it (one line). Server and single player share it.
- `simulation.js`: import, `installFluidHooks` after the Overworld `fluids.load`, and two `bucketUse` calls in `edit` (no block target: water needs none; with a target: after the block's own use, before items that place). `server-nether.js`: `installFluidHooks` for the Nether and End Fluids.
- `server-container-ticks.js` (dispensers): host got `isReplaceable` (Material.isSolid, ladder) so a filled bucket replaces non-solid blocks in front (was refused), and `setLiquid` makes Nether water fizz instead of a block (tryPlaceContainedLiquid; the bucket is still emptied). Water placed by a dispenser flows through the same world write as before.
- `src/main.js`: `random.fizz` joins `MP_SOUNDS` (the client dropped it before). Client prediction already existed (`dryBucketUse`, `heldPlan`, smoke at the click) and is unchanged; it expects exactly this server fizz.
- `src/mpbuckets-b75.test.js` (11 tests).

## Evidence
- Executed: the 41 `bucket` records of `client-predict-reference.json` (`ClientPredictProbe`, ItemBucket.onItemRightClick on the unchanged 1.7.10 classes, isRemote set) are replayed through `DedicatedSimulation.edit` with the probe's eye and view: cells changed, stack left, filled bucket in the first free slot, thrown filled bucket with a full inventory, Creative keeps the stack, reach 4.9 hit / 5.1 miss, Nether water fizz (native log `sound random.fizz 0.5 2.95`). All 41 match. No new Java probe (the old one already ran the real class; the server differences are not in that class).
- Bytecode-read (`abo`): `canMineBlock` (`ahb.a(yz,III)`) on the hit block first for both branches, then `canPlayerEdit` on the hit block (empty) or the adjacent cell (full); no `addStat` call anywhere; the fizz is `World.playSoundEffect` at x+0.5/y+0.5/z+0.5, volume 0.5, 2.6 + (nextFloat - nextFloat) * 0.8 on `World.rand`; the 8 largesmoke calls are `World.spawnParticle`, which does nothing on a server world, so the smoke is the clicking client's own (its prediction).
- Bytecode-read (earlier tracks, `oi.a` sendToAllNear): the fizz goes to everyone within 16 blocks, nobody excluded.
- Executed (JS only, not native): the server flow of a placed source, the pickup back, lava meeting water fizz, washed torch drop, dispenser torch replacement and Nether fizz, and the real Nether world (`isHell`, dim -1 sound, lava scheduled on the Nether's Fluids).
- Recalled: BehaviorDispenseFilledBucket calls `tryPlaceContainedLiquid`, so the dispenser replaces non-solid blocks and fizzes in the Nether.

## Verification
- `node --test src/mpbuckets-b75.test.js`: 11 pass.
- `node --test src/mpdispense-b61.test.js src/mpsounds-b74.test.js src/buckets-simulation.test.js src/buckets.test.js src/fluids.test.js src/player-throw-replay.test.js src/client-predict-b57.test.js src/mpnether-b61.test.js src/mpblocks73-b73.test.js src/mpcontainers2-b60.test.js src/dispense.test.js`: 124 pass, 0 fail (with the new file 11 more run separately).
- `node --check` on every touched file; `washStacks` is imported in `main.js` (line 116) and `world` / `items` are the module names the old inline code used. `npm run build` ok. Full npm test not run (batch rule). No browser check: the audible fizz, the smoke only at the clicker and the hotbar swap on a real connection were not seen.

## Follow-ups
- The server uses `sim.soundRand` for the fizz pitch, not the world's `World.rand` stream, so pitches are in the native range but not draw-for-draw.
- Single-player and server dispensers pass original block ids to `isReplaceable`; the server reads the port cell instead. Single-player dispensers (`main.js` host) still lack `isReplaceable` and the Nether fizz; not touched here.
- The two C08 packets of native (block use, then the bucket's own use) are one `place` message here: the block's own use (chest, door) wins, then the bucket runs. A bucket click on a block refused by the build-height gate or spawn protection is refused before the bucket trace (native would still run the bucket's own packet).
- Cauldron use of a water bucket on the server is not in this track.
