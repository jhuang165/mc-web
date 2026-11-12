# Batch 49 hurtdrops track

Branch `batch49-hurtdrops` (from ac7027870, release 0.77.0). Labels: executed = real 1.7.10 classes run in a probe and replayed; bytecode-read = read from the jar, not run.

## Summary
- **Drops spawn at the hurt call.** New `EntityWorld.emitLoot(ev)` spawns a drop or orb at once through the `spawnLoot` host hook (queues for drain() without one). `onDeath`'s drops, a slime-less death's orbs (`deathUpdate`), breeding orbs, shear wool and chicken eggs use it. A kill outside the walk (player hit, outOfWorld/`/kill` damage, a blast) joins the list at its hurt call, not after the tick. `flushLoot` stays for anything else queued.
- **onKillEntity before loot (bytecode-read, `sv.a(ro)`):** the attacker's `onKillEntity` (zombie converts a villager) runs before `dropFewItems`/`dropEquipment`/rare drop; `onDeath` now calls `zombieKilledVillager` before the drops.
- **Blast list snapshot:** natively `Explosion.doExplosionA` collects its entity list before any `attackEntityFrom`, so a mob the blast kills drops items that are not blasted. `applyExplosion` now splits `explodeMobs` out (iterating a snapshot of the mob list) and passes `itemsBefore` to `explodeNonLiving`, which sets the new items aside during the blast. Without it the earlier spawn would have regressed blast kills.
- **Randoms (bytecode-read):** EntityItem's constructor draws hover, yaw, motionX, motionZ from `Math.random`, EntityXPOrb's draws yaw and three motion values from `Math.random`; `entityDropItem` draws nothing. Loot rolls (counts, looting, rare drop) use the dying mob's `Entity.rand`, orb value uses the mob's rand and `World.rand` for animals (already ported). Port: constructor draws stay on the host `random`; push-out, fizz and orb pickup sound now use `ItemEntities.rng(e)` / `ExperienceOrbs.rng(o)`: one generator per entity (fresh `JavaRandom`, WeakMap) when the host uses the default Math.random, the shared injected generator otherwise (replays, away runs keep determinism).

## Evidence
- Executed: `EntityListProbe` 78 -> 88 cases, tag `b49hd`: player hit before / after the walk, outOfWorld 1000 before / after, arrow kill (cow listed before / after the arrow), TNT blast of two cows (both list orders), kill then another spawn (before / after the walk). New `hit` spec (player shell `Hr`, outOfWorld) runs the hurt call. Old 78 records byte-identical; two regenerations identical except `launches` (restored from the old reference as in b48).
- The replay (`src/entity-list-replay.js`) gained `hit` specs, the arrow hook (`arrowOptions`) and the mob half of the blast (`explodeMobs`). Control `without "hurtCall"` (old timing) diverges for both kill-then-spawn records only; for the others the old end-of-step flush gave the same list order, so they pin positions/motions rather than order.
- Observed in the records: the probe's player hit pre-walk gives items age 1/delay 9 at the hurt tick (walked in the same pass); post-walk age 0/delay 10.

## Verification
- `node --test src/hurt-drops-b49.test.js src/entity-list.test.js src/deathdrops-b48.test.js src/explosion-simulation.test.js src/ring-events.test.js`: 122 pass, 0 fail.
- Wider targeted run (entit*, living*, experience*, item*, explo*, death*, away*, creeper*, village*, chicken, sheep, slime, combat, mob, zombie, wolf, arrow, horse, piston, ... in 4 batches): all pass except two tests that stubbed `items` without `.items` (fixed, now pass).
- Probe regenerated: `cd tools && MC_PROBE_LIBS=<netty-all-4.0.10.Final.jar> MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node verify-entity-list.mjs`. Full `npm test` not run (by instruction).

## Follow-ups (proposed gap lines)
- `/kill` and outOfWorld damage are only replayed on a cow (`ew.attackEntityFrom` with name outOfWorld); the port's `EntityWorld.kill` (player-style, sets recentlyHit 100) differs from native outOfWorld (no recentlyHit).
- A player's melee in main.js happens before the mob walk in the live frame; natively the packet runs after the world tick. Order unprobed.
- Orbs a mob's death spawns are still created in `deathUpdate`; the xp orb constructor's Math.random motion is fixed in the probe, not compared.
- Villager conversion order vs loot is bytecode-read only (a villager has no drops to compare).
- Items and orbs keep per-entity rand only in the live default host; tracker client copies and away runs share one stream.
