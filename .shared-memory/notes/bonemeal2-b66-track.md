# Batch 66 bonemeal2: bone meal on every IGrowable, single player and server

## Summary
- `src/bone-meal.js` (new): `useBoneMeal(host, x, y, z)` is ItemDye.func_150919_a for all 1.7.10 IGrowable blocks; `sparkleHeight` gives the aux 2005 particle height. Single player and the server both call it.
- New targets: mushrooms (40 % gate, WorldGenBigMushroom, failed growth restores the mushroom), tall grass and ferns (become double tall grass / large fern), double plants (sunflower, lilac, rose bush, peony drop themselves; grass and fern refuse), cocoa (+1 age below 2). Saplings, grass blocks, crops and stems keep their existing code, now called from the same function.
- `src/player-edit-simulation.js`: the bone meal branch calls the module. `src/multiplayer/server-use.js`: same, plus S28 2005 to players of the dimension within 64 blocks (data 0).
- `src/multiplayer/client-containers.js` (`dispenserAux` gets a `sparkle` callback for id 2005) and one `sparkle:` entry in `src/main.js` onAux draw the server sparkles.
- `tools/probes/BoneMealProbe.java`, `tools/verify-bone-meal.mjs`, `public/research/bone-meal-reference.json` (223 executed records), `src/bonemeal2-b66.test.js` (4 tests).

## Evidence
- bytecode-read: the implementers of IGrowable (ajo) in the jar are exactly alh (grass), anj (sapling), akf (crops: wheat, carrots, potatoes), anu (stems), amc (mushroom), anz (tall grass), ako (double plant), ajz (cocoa). Reeds, cactus, flowers, nether wart, lily pad, vines, melon, pumpkin and dead bush are not IGrowable (executed: all refused, stack kept).
- executed (`BoneMealProbe`, unchanged `acj.a(ItemStack, World, x, y, z)` on the PlantProbe world double): returned flag, stack, writes, dropped items and the next world Random draw for each case. The JS replay matches all 223, including huge mushroom cells, the failed-growth restore, drop positions and draw counts.
- bytecode-read ItemDye.onItemUse: canPlayerEdit first, then func_150919_a; on the server side the stack is spent and aux 2005 data 0 is sent whenever canFertilize is true, even when the random gate fails. Data is always 0 (15 particles): there is no per-block particle count in 1.7.10. Found wrong: that part of the brief.
- bytecode-read: shouldFertilize is true for everything except mushroom (nextFloat < 0.4) and sapling (nextFloat < 0.45). Tall grass dead bush (meta 0) and double grass/fern (2, 3) and cocoa age 2 are not fertilisable. Light and soil rules of the random tick do not apply to bone meal.
- bytecode-read sparkle bounds: bush family 0.4*2 = 0.8, mushroom 0.4, crop 0.25, stem (meta*2+2)/16, cocoa 0.75, double plant and blocks 1. Recalled for the client: aux 2005 is played by RenderGlobal after the server change arrives.

## Verification
- `node tools/verify-bone-meal.mjs` (one JVM): 223 records.
- `node --test src/bonemeal2-b66.test.js`: 4 pass. `src/mpstats3-b65.test.js` 7, `src/mpstats2-b64.test.js` 10, `src/dyes.test.js` 11, `src/farming.test.js` 7, `src/block-clicks-b52.test.js` 6, `src/attributes2.test.js` 14: all pass.
- `npm run build`: ok. `node --check` on every touched file: ok. `world`, `scene`, `itemRand` and `sparkleHeight` used by the main.js hook are declared at module scope / imported.
- Full npm test not run (batch rule). No browser checks (batch rule).

## Follow-ups
- Dispenser bone meal (BehaviorDispenseBoneMeal) still handles only saplings and wheat-family crops (`dispense.js`, `main.js` and `server-container-ticks.js` host.boneMeal); it could call `useBoneMeal` too.
- The sapling and grass gates use the trees' / bone-meal Random, not one shared world Random; the replay checks the cells, not the sapling stream.
- Only a browser would show the sparkle placement and the huge mushroom meshes after growth.
