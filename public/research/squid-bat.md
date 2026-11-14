# Squid and bat (1.7.10)

EntitySquid (EntityList id 94, class `ws`) and EntityBat (id 65, class `we`). No parity claim: the sections below say what was probed and what was only read from bytecode.

## Behaviour

- Squid: 10 health, 0.95 x 0.95, no gravity or friction. The native tentacle angle, rotation velocity and random swimming in `onLivingUpdate`; out of water it drops with the original pitch/body handling; drowning damage 2 through the shared hazard path. Drops 1-3 ink sacs (dye 351, damage 0) plus looting; 1-3 experience. No living, hurt or death sound (probed: null).
- Bat: 6 health, 0.5 x 0.9, constructed hanging. Wakes when a player is within 4 blocks or when hit, roosts under normal cubes, random flight toward spawn-position targets, takeoff sound (aux 1015, volume 0.05), no entity collisions (`canBePushed` false), no fall damage. Sounds `mob.bat.idle/hurt/death` at volume 0.1, pitch times 0.95. No drops, no experience. Saved as `BatFlags` (bit 1 = hanging).
- Ambient spawn rule `batCanSpawn` with an injectable date: light limit 4, or 7 from Oct 20 to Nov 3.
- Integration: `/summon Squid|Bat`, region export (`Squid`, `Bat`, `BatFlags`) and import, shadow sizes 0.7 and 0.25, `ModelSquid` and `ModelBat` in `src/squid-bat-renderer.js`.

## Evidence

- Probed: `tools/probes/SquidBatProbe.java` (run by `tools/verify-squid-bat.mjs`) drives the unchanged obfuscated classes; output is `public/research/squid-bat-reference.json`. `src/squid-bat.test.js` replays attributes, seeded squid swim updates, bat flight and hanging decisions, drops, talk intervals, spawn predicates and BatFlags NBT against it.
- Probed in `spawn-lists-reference.json` since batch 13 ([natural spawning](natural-spawning.md)): the spawn caps, 4 per chunk, the 24-block distance rule and `canCreatureTypeSpawnAtLocation` for water and air. Bytecode-derived (not probed): the squid's flow push (applied twice per tick), model box layouts and poses, renderer transforms, the engine-side wiring in `src/squid-bat-mobs.js`.

## Gaps

- Natural spawning is the SpawnerAnimals port ([natural spawning](natural-spawning.md)) with the biome water and ambient lists; its seeded replays include squid, but no replay reached a bat (the probe terrain is above y 63).
- The probe's bat `h()` tail is a hand-applied Euler step, not the real method.
- Squid flow push untested against the original.
- Models and renderer were not run or visually checked; no browser check was made.
- No spawner or spawn egg support. Bats and squid are not breedable.
- Batch 70 (docs sweep, 2026-11-14): half closed. Spawn eggs work: `SPAWN_EGGS` lists Bat (65) and Squid (94) in `src/spawn-eggs.js`, and `eggMobType` in `src/spawn-egg-use.js` resolves them through `SUMMONABLE` (`src/commands.js`, which has `Squid` and `Bat`). Mob spawners are still a real gap: `SPAWNER_ENTITY_IDS` in `src/mob-spawner.js` has no `Squid` or `Bat` entry, so such a spawner returns before any roll. Breeding: native squid and bats are not breedable (EntityWaterMob and EntityAmbientCreature are not EntityAnimal), unchanged.
- Batch 71 (mobfixes71): spawners closed. `SPAWNER_ENTITY_IDS` now has `Squid`, `Bat` and `LavaSlime` (and `Villager`); the spawner display entity and the server spawner path (`server-spawners.js` uses the same table and `spawnerHooks`) follow. Bytecode-read: `ws.by` (EntitySquid.getCanSpawnHere) is `45 < posY < 63 && EntityWaterMob.getCanSpawnHere`, and `wu.by` is only `World.checkNoEntityCollision`: a squid spawner needs no water natively (the brief's "squid needs water" is wrong; the port's `squidCanSpawn` already matched). `we.by` (bat): box minY below 63, then `Calendar` month/day, `nextBoolean` for the normal limit 4, `light > nextInt(limit)` refuses, so light 4 or more never passes outside Halloween. `src/spawner-mobs-b71.test.js` (seeded). Not seen: the spinning model in a browser.
