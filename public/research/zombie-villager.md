# Zombies, villagers and zombie villagers (1.7.10)

Ported from EntityZombie (`yq`), EntityVillager (`yv`) and the tasks AttackOnCollide (`uq`), NearestAttackableTarget (`vo`), MoveThroughVillage (`us`). Code: `src/zombie-villager.js` (pure rules), `src/ai.js` (tasks), `src/entities.js` (hit, kill, cure, conversion timer, save/load), `src/mob-effects.js` (Nausea), `src/mob-renderer.js` (zombie villager model, `zombie_villager.png`), `src/java-mobs.js` with `src/region-import.js` / `region-export.js` (Java NBT).

## Native evidence

`tools/probes/ZombieVillagerProbe.java`, run by `tools/verify-zombie-villager.mjs` (needs `MC_RESEARCH`), drives the unchanged classes of `minecraft-1.7.10.jar` (SHA1 e80d9b3b...) and writes `public/research/zombie-villager-reference.json` (26 records), replayed by `src/zombie-villager-reference.test.js`:

- facts and task lists: zombie task and target priorities (swim, break door, attack players, attack villagers with long memory, restriction, move through village, wander, watch, look idle).
- target (13): which villager the zombie picks.
- kill (80 per difficulty): Normal converts about half through `nextBoolean`, Hard always, Easy/Peaceful never.
- interact: golden apple with Weakness only; timer `nextInt(2401) + 3600`.
- boost: cure boost 1, plus an iron bars or bed scan when `nextFloat() < 0.01` (0.3 per block, up to 14).
- convert: the conversion result, sounds remedy (state 16), unfect (aux 1017), infect (aux 1016).
- villages.dat round trip, and six entity NBT records (zombie villager, golem).
- The villager avoid-zombie task (`tw`, 8 blocks, 0.6 / 0.6) is replayed by the earlier `villager-reference.json` (`avoid` cases).

## Approximated or missing

- Weakness does not reduce zombie damage here.
- Batch 69 (docs sweep): the bed block exists now (`src/bed.js`); whether the cure boost reads real beds was not checked, so the stand-in id statement is left open: only iron bars boost the cure (beds are replayed with a stand-in id).
- The BreakDoor task is run for zombies with `canBreakDoors` or a leader: see [mob-riding](mob-riding.md). Villager zombies share the task list.
- Profession is not tracked or rendered on zombie villagers (1.7.10 has a single texture).
- The follow-range spawn bonus and the spawn-with-egg child/jockey rolls use unseeded Randoms natively, so only bounds are verified.
- The conversion timer runs only while the mob is loaded.
- Default reputation +5 is applied at the first village refresh.
- Villages outside the imported Java area are dropped; imported mobs lose AI timers and the home area; importing mobs skips animal seeding.
- Parity is not complete.
