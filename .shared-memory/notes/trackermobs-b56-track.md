# trackermobs b56 track

Branch `batch56-trackermobs` from 626a467c3 (0.84.0).

## Summary
1. Mob spawns follow the object rule. `EntityWorld.noteMobSpawns(early)` marks a mob that appeared in `entities` since the last call: early when made by an entity before the player's slot (checked at the top of each loop iteration when the list length changed, and after the loop), before the loop (natural spawning), or in the network phase (seen at the start of the next tick); late after the player's slot and in the tile entity pass. `MobTracker.jointUpdate`'s `spawnEarly` hook already created early entries before the destroy flush; mobs just were never marked.
2. Objects use the same rule through `spawnsEarly()`: a spawn outside the entity pass is early (network phase: spawn egg, thrown item, a block's drop) unless `tilePass` is set. `tilePass` is true while `afterEntities` runs its tile part; main.js `tickServerDig` (first in the hook's network part) calls `endTilePass()`, and the spawner pass in main.js calls `noteMobSpawns(false)` so a mob spawner's mobs are late. No player in the world yet (opening population) is never early.
3. Horse flags through the tracker. `TrackerEntry` keeps `lastHorse` (watcher 16 bits from `horseFlagsOf`), puts them in the spawn packet (`watched()`) and sends a `meta {horseFlags}` in its own update when they change; `observe` counts the change as dirty watcher data. `ClientEntity.horseFlags` holds them. `entities.js clientAfterMove` feeds `c.horseFlags` to `stepHorseAnim`, and the tracker's `c.steered` reads the client's saddle bit (flag 4) instead of the live horse. `horse-copy.js` is untouched.
4. Other directly copied watcher values: none found beyond the horse flags (bat hanging, dragon health and squid air already travel through meta packets). `c.dead = e.health <= 0` still reads the live health (the client's health watcher is only sent for the dragon).

## Evidence
- Executed (real mn, my, entity and packet classes): `tracker-joint-reference.json` cases `mobSpawn`, `mobSpawnLast` (chickens spawned by c1 and c2 before the player, by c4 after it, in the tile pass after the loop, and in the network phase before the loop, plus a network item and arrow) and `horseMeta`, `horseMetaLast` (real EntityHorse, watcher 16 scripted per tick through `wi.b(int, boolean)`; S0F lists and S1C pairs recorded). Tag b56tm. The 13 older cases are byte-identical in the regenerated file.
- Findings in the record: a spawn is sent at once, so the network-phase spawn is the first packet of its tick, before that tick's flush; the tile-pass spawn follows it; a flag change is an S1C in the tracker update of the tick it changed in; the entry also resends the full initial list once at its first update (not modelled, same values).
- Bytecode-read / stand-ins: the World.updateEntities loop, the player's flush, the network phase as "before the loop"; SpawnerAnimals before the loop (WorldServer.tick, bytecode-read in earlier batches); chickens stand for every mob (same spawn packet and entry).

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-tracker-joint.mjs` -> 17 cases x 60 ticks.
- `node --test src/tracker-mobs-b56.test.js` -> 10 pass (mutation checks for both rules). 140 test files that name the tracker, EntityWorld, `joined`, tickMobs, horses or tracker-* (`ls src/tracker-*.test.js src/entity-tracker*.test.js src/horse*.test.js` plus grep for MobTracker, earlySpawns, horseFlagsOf, copySteered, .joined(, jointUpdate, tickMobs, EntityWorld) -> 2584 tests, 0 fail. `npm run build` ok. No full `npm test`, no browser.
- `tracker-dim-b55.test.js`'s EntityWorld test was changed: a spawn outside the pass is now early (network phase).

## Follow-ups
- A network spawn is marked early in the update that first sees it (the start of the next tick, with the previous tick's record); natively it belongs to the next record, so a destroy due in the next flush can fall on the other side of it by one update. Deferring it one update would be exact but delays the copy by a tick.
- Chunk-load entities and portal arrivals count as network-phase spawns (early); their real phase is not recorded.
- The first-update full S1C resend and attribute packets are not modelled. Eating-grass and `bq` flag sources for the horse still do not exist on the server side.
- remaining-gaps.md still lists the Tracker and Vehicles lines from b55; the lead should reword them.
