# Batch 18 mobdoors track (branch b18-mobdoors)

## Summary
- Tripwire: boats (xi) and falling blocks (xj) now trip strings in the live game (`entitiesIn`, `game.boats()` / `game.falling()`); witch and dispensed potions (`mobs.potions.projectiles.balls`) join the sense list. RedstoneProbe entity2 kinds 9/10/11 (boat, falling block, exp bottle) and 4 "-hold-line" scenarios: 40 scenarios in `tripwire-reference.json`. javap `collisionCallers` shows moveEntity true for xi and xj; thrown potions/bottles remain sense-only. main.js: two one-line edits in the game hooks (`thrown`, `boats`/`falling`).
- MoveThroughVillage: new `MoveThroughVillageProbe.java` + `tools/verify-mob-doors.mjs` -> `mob-doors-reference.json` (120 records) -> `src/mob-doors.test.js`. Fixed in `village-ai.js`: startExecuting/resetTask no longer touch the navigator door flag, visited doors compared by coordinates, nocturnal gate documented.
- Door breaking (EntityAIBreakDoor): already probed in batch 16 (MobRidingProbe, 32 records). New: `CanBreakDoors` exported (was always 0) and imported (region import, `/summon`).
- Iron golem reach check (`NearestMonster.pathEndsNear`) runs with `getPathToEntityLiving(t, true)`, exempt from the per-tick budget; test with an exhausted budget.

## Tests
`npm test` and `npm run build` pass (see final report for counts). New: mob-doors.test.js (2), villager-polish.test.js (+1), tripwire-live.test.js (+1), java-mobs.test.js assertions.

## Remaining gaps
- Pigmen: canBreakDoors rolled natively, not stored or run; export writes 0.
- Zombie walking a door path in a ticking world (shouldExecute through arrival) is not probed; only task-level calls are.
- Boat/falling block `onUpdate` through a string is javap-checked, not executed. Boats and falling blocks now also count for pressure plates and weighted plates via the shared "all" mode (native-correct, not separately probed).
- Thrown potions/bottles still never trip an idle string (native: no moveEntity), only hold one.

## Proposed remaining-gaps replacements
- Temples: "Jungle/desert traps are live; tripwires sense every entity class natively probed (boats, falling blocks, witch/dispensed potions included, 40 scenarios); only a moving boat/falling block's own onUpdate through a string is javap-checked, not executed."
- Villager: "MoveThroughVillage (visited doors by coordinates, navigator door flag, nocturnal gate) and the golem's nearbyOnly reach check (no search budget) are probed; zombie door walking in a ticking world and pigman CanBreakDoors remain."
