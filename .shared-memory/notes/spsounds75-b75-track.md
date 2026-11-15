# Batch 75 spsounds75: single-player sound sweep and seed/double-plant fixes

## Summary
- `tools/probes/SoundSweepProbe.java` + `tools/verify-sound-sweep.mjs` -> `public/research/sound-sweep-reference.json` (new, 1902 records, ~280 KB): place, break and step sounds from the unchanged 1.7.10 classes.
- `src/player-edit-simulation.js`: seeds, crops and nether wart no longer play `step.grass` (ItemSeeds plays nothing). The cake item passes its cell to the sound hook.
- `src/block-placement-simulation.js`: the double plant now plays its place sound; every `sound(true, id, cell)` call passes the placed cell.
- `src/main.js` (`sound`, 2 lines): optional third argument `at` = the placed cell. Before, the sound used `target.adjacent`, which is the wrong cell when a snow layer or tall grass is replaced (native plays at the placed cell).
- `src/spsounds-b75.test.js` (5 tests); three older tests updated for the extra hook argument (`block-placement-simulation`, `player-edit-simulation`, `instantbreak-b55`) and the step.grass expectations in `player-edit-simulation.test.js`.

## Evidence
- Executed: place = `Item.onItemUse` of every registered item (damage 0..15 below id 256, 0 and 3 above) in 10 click scenarios (stone floor and wall, farmland, soul sand, sand beside water, grass, dirt, snow layer, half slab, tall grass), logging `World.playSoundEffect` with volume, pitch and position. Seeds, nether wart, doors, redstone dust: no sound. Comparator item NPEs on the probe's tile list (no sound recorded; not compared).
- Executed: break = the real `RenderGlobal.playAuxSFX` type 2001 for every block id and metadata, reading the `PositionedSoundRecord` handed to the sound handler (name, volume, pitch, position x+0.5).
- Executed: step = `Entity.func_145780_a` for every block, plain and under a snow layer (the client player plays it through `World.playSoundEffect` at its own position).
- Replay result: every break (all ids and metadata), every step, and 229 port placements (`placeHeldBlock` with items mapped by `itemFromOriginal`) agree with native in name, volume, pitch and cell; 17 silent placements agree. No table mismatch found. The real gaps were the seed and wart sound, the missing double-plant sound and the placed cell.

## Verification
- `node --test src/spsounds-b75.test.js`: 5 pass. With `src/player-edit-simulation.test.js src/block-placement-simulation.test.js src/block-sounds.test.js src/mpsounds-b74.test.js src/sounds73-b73.test.js src/media.test.js src/instantbreak-b55.test.js src/attributes2.test.js src/block-clicks-b52.test.js src/client-predict-b56.test.js src/client-predict-b57.test.js src/prediction5-b59.test.js src/cakefog-b72.test.js src/player-throw-replay.test.js`: all pass.
- `node --check` on touched src files ok. `npm run build`: see commit message. Full npm test not run (batch rule). No browser check (audibility, positional attenuation not heard).

## Follow-ups
- Not swept: items whose sound is in `onItemRightClick` or other paths (buckets, lily pad, bonemeal, fire charge, flint and steel pitch is random), hoe tilling, dispenser placement, mob steps (`mob-steps.js` uses the same `footstepSound`; the step cell rule was already probed in b71), hit sounds while digging (formula only, b0x token window).
- Native steps of the client player play at the player's own position, not at the block; the port plays the footstep with no position (same effect).
- 1119 sweep records were skipped in the placement replay: items without a port mapping, or placements the port treats differently (cake via its own branch, seeds, flint). Not a sound gap.
