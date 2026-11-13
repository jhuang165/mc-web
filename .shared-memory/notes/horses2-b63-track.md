# Batch 63 horses2: skeleton/zombie spawn rolls and the chest under a sitting cat

## Summary
- `tools/probes/Horses63Probe.java` + `tools/verify-horses63.mjs` write `public/research/horses63-reference.json` (570 KB): 4000 lone `onSpawnWithEgg(null)` rolls, 300 herds of six (each horse takes the previous group), and 96 chest scenes.
- `src/horses2-b63.test.js` replays them against `horse.js`, `chest.js` and `entities.js` (5 tests).
- Fix: `EntityWorld.ocelotSitsOn` (`src/entities.js`, one line) no longer skips a dead cat. A dying sitting cat still blocks the chest natively (`BlockChest.o` reads only `isSitting`); the port skipped `health <= 0`.
- `tools/verify-endermanwolf.mjs` and `public/research/enderman-wolf-b47h-reference.json`: the b47h `method` text now describes the horse set (it was the generic batch 42 text). No record changed.

## Evidence
- Executed: type histogram of 4000 lone rolls is `[3582, 418, 0, 0, 0]` and of 1800 herd members `[1590, 210, 0, 0, 0]`. `onSpawnWithEgg` never makes types 2, 3 or 4 without group data; a type 3 or 4 only appears when the group data passed in carries it (the existing 60 `spawnGroup` rows, types 0 to 4, already replay in `horse.test.js`). The port matches every row, including the next Random draw.
- Executed: `ajx.m` (the inventory a click opens) and `ajx.a` (onBlockActivated) on normal and trapped chests, single, east and north double, and a normal chest beside a trapped one, with real `EntityOcelot` objects in the entity list (sitting, standing, dead, on the chest, on its partner, on the far side, at the box edge, inside, too high, two cats). A cat on either half blocks both halves; a cat beside a mixed pair blocks only its own chest. The click returns true in every case. The port matches all 96.
- Executed by earlier batches (so these gaps in `remaining-gaps.md` were stale, not open): the run-around buck, temper and tame rolls, the angry rear, the eat and angry sound draws, skeleton/zombie horse behaviour and foal growth beside a wall are the 62 `b47h` records (`horse-ride-b47.test.js`, 63 tests, pass). The ridden horse's client copy is `horse-copy.js` (batch 54, `HorseCopyProbe`, 8 steer rows) and the buck dismount is in `horse-rear-reference.json` (batch 55).
- Bytecode-read: `ajx.o` queries `EntityOcelot` only (class `wn`), so a sitting wolf never blocks a chest. The world double supplies block, tile entity and entity-list queries; the entity-list box test is the double's, as in `OcelotProbe`.
- Recalled: nothing new.

## Verification
- `node tools/verify-horses63.mjs`: spawn=4000 herd=300 chestCat=96.
- `node --test src/horses2-b63.test.js`: 5 pass. Without the entities.js line the sitDead scenes fail (checked).
- `node --test src/horse-ride-b47.test.js`: 63 pass.
- Other targeted runs and the build are listed in the final report. Full npm test not run (batch rule).

## Follow-ups
- Skeleton and zombie horses still have no natural source in 1.7.10 (summon/NBT only); nothing to port.
- The chest scenes use a stubbed entity list, so the native `getEntitiesWithinAABB` chunk walk is not exercised.
- Browser-only: a visual check that a sitting cat stops a chest click was not done (no browser checks allowed).
