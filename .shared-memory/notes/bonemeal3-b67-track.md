# Batch 67 bonemeal3: dispenser bone meal and the world Random

## Summary
- `src/dispense.js`: BehaviorDispenseBoneMeal calls `host.boneMeal(x, y, z, original, w.rand)`; a host that declines still gets the inline wheat family (the away world's `() => false`). Stack spend, aux 2005 data 0 and the 1000/1001 shared flag are unchanged.
- `src/main.js` (hook only) and `src/multiplayer/server-container-ticks.js`: the `boneMeal` hooks run `useBoneMeal` (every IGrowable) with the dispenser's world Random, redraw changed cells (single player) or drain farming (both).
- `src/bone-meal.js` / `src/trees.js`: a `host.rand` (world Random) now drives the sapling gate and tree generators (`Trees.boneMeal(x, y, z, rand)` swaps `trees.random` for the call and restores it), grass spread (`growGrass`), and the rest. Without `host.rand` the old per-host streams remain (the single-player item click and the server click still pass none).
- `tools/probes/BoneMealProbe.java`, `PlantProbe.java` (W now answers `getBiomeGenForCoords`), `tools/verify-bone-meal.mjs` output: 308 records (223 old + 13 grass + 72 marked saplings of types 0-5, 12 seeds each). `src/bonemeal3-b67.test.js` (5 tests); `bonemeal2-b66.test.js` filters out the new record names.

## Evidence
- bytecode-read `kq` (BehaviorDispenseBoneMeal): damage 15 only; `ItemDye.func_150919_a` on the facing block; when it returns true and the world is not remote, level event 2005 data 0; when false the instance flag is cleared and the sound becomes 1001 (1000 otherwise); other damages go to the default behaviour. `func_150919_a` itself spends the stack (`stackSize--` server side), also when the growth gate fails.
- executed: the 308 records (unchanged `acj.a`), checked cell by cell and by the next world Random draw. Saplings and grass, replayed with a different seed in the trees' and grass' own Random, match, so the world Random alone is used and the draw counts agree (tree generators for oak/spruce/birch/jungle/acacia, big-tree 1 in 10, dark oak without a 2x2).
- recalled: the sapling meta bit 8 marking step and the single-player item-click path (still its own streams).

## Verification
- `node tools/verify-bone-meal.mjs`: 308 records. `node --test`: bonemeal3-b67 5, bonemeal2-b66 4, dyes 11, farming 7, dispense 7, dispenser-container 3, dispenser-piston 6, dispenser-piston-world 4, away-dispense-b51 5, mpdispense-b61 15, mpstats3-b65 7: all pass. `npm run build` ok. `node --check` on touched files ok; `world`, `trees`, `farming`, `items`, `FLOWERS`, `boneRandom`, `scene`, `applyFarmUpdates` used by the main.js hook are module-scope. Full npm test not run (batch rule).

## Follow-ups
- The player's own item click (single player and server) still passes no `rand`; passing the real world Random there would need one shared world Random object.
- Only a browser would show the dispenser sparkles and the grown trees' meshes.
