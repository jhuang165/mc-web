# Batch 90 mobrec90: blaze target semantics, blaze shot pitch, a skeleton jockey climbing a ring (executed records)

## Summary
- `public/research/enderman-wolf-b90mr-reference.json` (about 470 KB) holds 8 executed blaze records and `public/research/village-fight-b90-reference.json` (about 1.1 MB) holds 5 executed spider-jockey records. All 13 replay with no divergence.
- `tools/probes/EndermanWolfProbe.java`: set `b90mr` (implies `b89mr`). The world's `Random` is a counting subclass, and row element 11 is `[draws so far]`. A blaze row's target is `td.bT` (entityToAttack).
- `tools/probes/EndermanWolfScenarios.java`: `run90()`. `blaze-shot-9001/9002` (fight, 200 ticks), `blaze-creative-9011/9012/start-9013` (creative on and off), `blaze-dead-9021/9022/9023` (player health set to 0 at tick 60, 45 and 20).
- `tools/probes/VillageFightProbe.java`: `b90-` joins the b38 layout and the `mathRandom` list; five `b90-jockey-ring-3-<seed>` scenarios (the `spawnspider` op, a 4-block stone ring, seeds 47, 2231, 1713, 972, 1003).
- `tools/verify-endermanwolf.mjs`, `tools/verify-village-fight.mjs`: the `b90mr` and `b90` sets, count asserts, method text.
- `src/enderman-wolf-replay.js`: `reference90`, a world random draw counter, a `health` op for the player, the burning tick after fireball hits (5 damage, `setFire(5)`, 1 per 20 ticks) for b90 records, comparison of element 11. `src/village-fight-replay.js`: `fightReference90`.
- `src/blaze-ghast-mobs.js` (port fixes):
  - `levelEvent` draws the shot pitch from a client stream (`m.clientAuxRandom`), not the world random.
  - The hover no longer clears a creative or dead player target before reading it; `td.bq` (`creatureActionState`) clears it afterwards.
  - The player's eye height is the float 1.62F, so faceEntity's pitch matches to the last bit.
  - `closestPlayer` has no alive test (`World.getClosestPlayer` has none), and `lookGone` ends a look target on `isDead` (deathTime 20) instead of health.
- `src/silverfish.js`: `livingActionState` uses `env.lookGone` when a mob supplies it (only the blaze does). `src/ai.js`: `Brain.deadTicks`.
- `src/ai.js` `isSuitableTarget`: the owner is never its own target. `src/revenge-target.js` `sourceEntity`: a shooter that is the victim still counts (its own arrow).
- `src/mobrec90-b90.test.js`: 20 tests.

## Evidence
- Executed (real 1.7.10 classes, the records):
  - The blaze shot draws 0 values from the world random (all 8 records stay at 0 draws). The pitch is the client's draw (RenderGlobal.playAuxSFX).
  - A creative or dead player stays the blaze's target through `xx.e`'s hover read; the target is cleared on the tick of the switch by `td.bq`.
  - A dead player (health 0) stays the closest player and the look target until `Entity.isDead` at deathTime 20.
  - Fireball hit: 5 damage, then fire for 1 damage per 20 ticks.
  - Jockey (seed 2231 tick 198, seed 1713 tick 282): the skeleton's own arrow hits the jockey. The rider's revenge target becomes itself, its attack target stays the player. With `mathRandom` recorded, the knockback nudge of a coincident attacker (Math.random) is deterministic. Without it the record diverged between runs.
  - The spider climbs the ring (`isCollidedHorizontally`, ladder clamp 0.15) and the seat follows; all five match every tick (position, health, targets, draws up to the spider's first `i1000`, the skeleton whole).
- Bytecode-read: `sw.bq` look-target block (`K` isDead, deathTime), `sv.g()` float eye height, `td.bq`. The self exclusion in `EntityAITarget.isSuitableTarget` is read from the record (target 3 not 5), not from bytecode: I did not locate the class.
- Port-read: `wither-boss-mobs.js` and `zombie-door.js` draw their aux event pitch from `worldRandom` too.

## Verification
- `node --test --test-concurrency=2 src/mobrec90-b90.test.js`: 20 pass, 0 fail. Without the four port files (`ai.js`, `blaze-ghast-mobs.js`, `silverfish.js`, `revenge-target.js`) it fails 14 of 20 (checked by a temporary stash).
- `xargs node --test --test-concurrency=2` over 110 test files that import or name `blaze-ghast-mobs`, `silverfish`, `ai.js`, `revenge-target`, the two replay modules, or mention revenge, isSuitableTarget, HurtByTarget, jockey, blaze: 2639 tests, 2639 pass, 0 fail. No old test was edited.
- `npm run build`: succeeded (one run).

## Found wrong in the batch 89 list
- The "blaze hover clears a dead or creative target early" item was right. Found beside it: the closest-player and look-target semantics for a dead player, the eye-height float and the missing burn tick were also off.
- The sound-pitch item was right: the port drew from the world random; natively it draws none.

## Follow-ups
- A dead server copy of the player stops ticking physics in the port, natively it keeps its own motion (a 9022 draft killed the player in flight and diverged on motion; the committed record kills it at rest).
- Other legacy mobs (spider, pigman, silverfish) still require `alive` for `closestPlayer` and `lookTarget`, natively `isDead`.
- `wither-boss-mobs.js` and `zombie-door.js` aux event pitch still use `worldRandom`.
- The `deadTicks` ordering may be off by one tick against the player's own update.
- `isSuitableTarget` self exclusion: confirm in bytecode.
- Browser only: the audible blaze pitch spread, the jockey's look while climbing.
