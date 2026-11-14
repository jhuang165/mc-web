# Batch 66 mpvillage: villagers and villages on the dedicated server

## Summary
- `src/multiplayer/server-villagers.js` (new): `VILLAGE_KINDS` (`villager`, `iron_golem`) join `SUPPORTED`; `installServerVillagers` (player lookup by name for the golem's reputation target, a `damage` wrapper that adds `source.playerName` so reputation is kept by player name); `loadVillages` / `saveVillages` (collection saved as `villages` in the world save, as the browser save keeps it); villagers of generated village structures join a fresh version 11+ world once (`world.generatedStructures.animals`).
- `server-mobs.js`: import, `SUPPORTED` loop, `s.prof` in `mobState` (profession; baby already `s.baby`), install call, villagers exempt from the mob cap cut, `villager` hook in the interact context.
- `remote-mobs.js`: copy takes `mob.profession` from the state (applied before the rig is built on spawn).
- `animal-use.js`: golden apple on a weakened zombie villager calls `mobs.cure`; a villager click calls `ctx.villager` (stub).
- `simulation.js`: loads and saves the collection (2 lines).
- `src/mpvillage-b66.test.js`: 9 tests.
- Villager AI (move indoors, restrict door, mate, open door), door scanning, the 20-door golem spawn, conversion by zombies and curing already ran inside the EntityWorld each ServerMobs wraps; they work once `villager` is a supported kind.
- Wire: no new messages. `mob` state gains `prof`.
- Stub for the trading track: set `sim.mobs.villagerUse = (player, mob) => boolean`; it is called first on a villager click.

## Evidence
- Executed: all village, villager and zombie villager rules are single player's (existing reference JSONs, unchanged).
- Bytecode-read: `ahb` constructor loads the collection under the key "villages" for every world (no dimension suffix); `wc` constructor. Not reproduced: each server dimension holds its own collection; only the Overworld is saved.
- Recalled: 1.7.10 villager mating needs only free doors and mating season (no food willingness, that is 1.8).
- Gap found wrong/inapplicable: sieges are not in single player (nothing to bring over); no probe added.

## Verification
- `node --test` one at a time: mpvillage-b66 9/9, mpanimals-b61 11/11, mobcopies2-b61 50/50, mobcopies3-b63 12/12, mpmobs-b59 10/10, mpmobtypes-b61 10/10, village 5/5, village-live 8/8, multiplayer 5/5.
- Full npm test not run (batch rule). Build: see final report.

## Follow-ups
- Zombie sieges (VillageSiege) in single player and server.
- Reputation under the legacy "Player" key of a single-player village is not mapped to a player name.
- Nether/End village collections are not saved; native shared-key behaviour not reproduced.
- Browser-only: villager skins by profession, door swings and the golem on a live client.
