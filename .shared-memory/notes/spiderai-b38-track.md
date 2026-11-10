# Batch 38 track: spiderai

## Summary

- Ported `EntityCreature.updateEntityActionState` (`td.bq`) for the spider (`yn`), cave spider (`xy`) and zombie pigman (`yh`) in `src/legacy-creature.js`, running the `creatureActionState` flow of `silverfish.js` with their `findPlayerToAttack` / `attackEntity` / path weight overrides. The adapted `spiderThink` and `pigmanThink` (timers, `Math.random` wander) are removed. State lives in the existing `silverfishState` WeakMap; `e.idle` is `entityAge`.
- Spider rules (bytecode-read, confirmed by records): hunt only in brightness < 0.5 with no sight test; in brightness > 0.5 a 1 in 100 roll forgets the target; 2 < d < 6 rolls a 1 in 10 leap (ground only), else EntityMob melee. Pigman: no target while `angerLevel == 0`, then a visible player within 16. Path weight `0.5 - brightness`; EntityMob adds 2 to entityAge in light.
- `EntityMob.attackEntityFrom`: any living attacker becomes `entityToAttack` (player, golem, mob), except the mob's own rider or mount. Pigman group anger sets each angered pigman's target. Cave spider poison now lands on mob targets too. Pigman `attackEntityFrom` runs EntityZombie's reinforcement roll (a Hard `nextFloat` draw, nothing spawns). The pigman angry-sound draws now come before the ambient say roll (`yh.h` order).
- Bugs found in the shared legacy flow (giant and silverfish tests did not see them): the look timer is a post-decrement (`g-- <= 0`), and `randomYawVelocity *= 0.9F` runs every tick after the action state. Fixed in `silverfish.js` and applied in the giant and silverfish think functions too.
- A despawning mount frees its rider in the same tick (`freeRider` in `mob-riding.js`), so the jockey skeleton falls the tick its spider's `i800` despawn roll fires.
- Evidence: `public/research/village-fight-b38-reference.json`, 27 records of the unchanged 1.7.10 classes (probe: real light table and `getClosestVulnerablePlayerToEntity` in `VillagerProbe`, defaulting to the old answers). Idle wander day/night/dark patches, night hunts with leaps, hits from far away, golem hits, two spiders, cave spider poison on Easy/Normal/Hard (0/140/300), pigman group anger on Easy/Normal/Hard, and five 450-tick spider jockey records. Older reference files were not regenerated (the 24 first b38 records were byte-identical after the jockey records were added).
- Replay: `village-fight-replay.js` gains S/T/P, `bright`/`patches`, entityToAttack rows for b38 records, the player's Poison per tick, the extra mobs' arrow Random, and compares a spider's draws whole for b38 records. Docs: "Batch 38" in `village.md` and `pathfinding.md`, one line in `spiders.md`.

## Verification

- `node --test --test-concurrency=1 src/village-fight-b38.test.js`: 32 pass, 0 fail (27 record replays with search sizes, 5 targeted tests).
- Other focused files, one at a time, all 0 fail: village-fight-b37 19, b36 24, b35 9, b34 27, b33 33, b32 6, b31 5, village-fight 4, spider 11 (two tests rewritten for `entityToAttack` and `attackTime`), cave-spider 8, detection 6, silverfish 75, giant 6, pigman-jockey 5, magma-pigman 12, magma-pigman-world 6, mob-riding 12, mob-riding-nbt 2, riding-nbt 5, entities 21, attributes2 14, difficulty 16, spawn-eggs 15, interchange 13, interchange-spawn 11, combat 8, iron-golem 12, dimension-ticks 7, spawner-animals 23, witch 13, module-names 1, plus pathfinding 8, ai 12, entity-portal 23, mob-steps 14, mob-equipment 13, webs 6, village-aggressors 2, zombie-door-walk 2, mineshaft-integration 11, death-messages 4.
- Load average while testing: about 5.5 to 7. The full `npm test` and `npm run build` were left to the lead. No browser check (nothing visible changed beyond mob behaviour).

## Follow-ups (proposed gap lines)

- Climbing a wall by the legacy flow has no native record: the b38 wall record never climbed (the path went around). Record a spider against a wall it must climb.
- Two night spider jockey records were dropped: the skeleton's arrow hit its own mount point blank and `Entity.knockBack` draws its direction from `Math.random`, which cannot be replayed. A native probe with a seeded `Math.random` hook would allow them.
- Creative-player target clearing in `td.bq` is bytecode-read only (the probe's player is not an `EntityPlayerMP`).
- Slimes, ghasts and blazes still have their own adapted AI; the same legacy flow could carry them.
- Spider-dies-mid-fight draws: a dead spider's death-tick draw (`b`) is not compared in the b37 records (still compared only up to the first sound roll there); a b38 record with a kill would settle it.
