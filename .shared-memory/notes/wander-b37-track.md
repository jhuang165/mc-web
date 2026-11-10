# Batch 37 track: wander

## Summary
- Chicken wander target underground (seed 1406): not a game bug. The replay harness floor below y 0 answered the port's grass id, so tries over a floor weighed 10; the probe world is stone. Fixed in `src/village-fight-replay.js`; the port path finder (partial path choice, tie order bytecode-read identical) was right. Native records for seeds 1406, 1401, 1402, 1408, 1413 on stone and 1402, 1413 over a grass patch replay exactly, search sizes included.
- Hard nearby-chicken jockey at seed 113 (3e-4 on a regular zombie at tick 155): real port bug. A rider's own move and push were skipped; natively `Entity.updateRidden` runs the full `onUpdate` and the seat is taken afterwards. `Entities.ridden()` now only runs the AI and `walk()` does the move and push. Record `b37-jockey-nearby-113-d3`.
- Skeleton spider jockeys: the port's jockey roll, Hard potion roll and skeleton `onSpawnWithEgg` match native (seven records: jockey with Speed, Regeneration, Invisibility, Strength, none, a no-jockey Strength spider, and one at Normal), plus two player hits on the rider and a golem killing the mount. `spawnSpiderJockey` calls `entitySeed(sk, "jockey-skeleton")` for the replay.
- Probe additions: `spawnspider` and `hitmob` script ops, `mobs` record field, row element 7, `local` (regional difficulty), `VF_PATHS`/`VF_ERR` dev outputs. `tools/verify-village-fight.mjs` writes `village-fight-b37-reference.json` only; the older files and b36 are written only with `VF_REWRITE_OLD=1`.
- Gap found, not fixed: the spider's own legacy `EntityCreature.updateEntityActionState` (idle `nextInt(180)`, `nextInt(120)`, two `nextFloat` per update on Entity.rand; target on hit; the port uses an adapted timer wander). The b37 replay therefore compares a spider's draws only up to its first update and its place, health and target every tick; records stop at tick 80.
- Reference: `public/research/village-fight-b37-reference.json` (15 records). Docs: "Batch 37" in `public/research/pathfinding.md` and `village.md`.

## Verification
Focused tests (`--test-concurrency=1`, one command at a time), all passing: village-fight-b37 19; the older fight tests village-fight 4, b31 5, b32 6, b33 33, b34 27, b35 9 and b36 24 (127 together with b37); mob-riding, chicken, pigman-jockey, spider, cave-spider, spawn-eggs, pathfinding and ai 91 together; entities 21. Load average at the runs was about 5 to 6 (`sysctl -n vm.loadavg`). The probe ran against the unchanged 1.7.10 classes (client SHA-1 e80d9b3b...). No browser check (nothing visible changed). No timing measurements. The full suite and build were left to the lead.

## Follow-ups (proposed gap lines)
- Spider legacy `EntityCreature.updateEntityActionState` (idle wander draws, entityToAttack set by a hit, leap, `getBlockPathWeight`) is not ported; spider draws are compared only through the spawn rolls (spawn-tick), so spider jockeys are only recorded to tick 80.
- Hits on a spider jockey's mount, and arrows from a jockey skeleton (shooter draws are not wired for extra skeletons), are not recorded.
- Underground-target wander is recorded on a stone floor with one grass-patch variant; other floors (water, sand, farmland weights) are not.
