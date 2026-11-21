# Batch 93 mobrec93: squid, bat, wither skeleton, wither, pigman and giant records (executed)

## Summary
- `public/research/enderman-wolf-b93mr-reference.json` (1.7 MB: 14 squid and bat records) and `enderman-wolf-b93mr-wither-reference.json` (1.7 MB: 18 wither skeleton, wither, pigman and giant records). 32 executed per-tick records on the real 1.7.10 classes, all replaying with no divergence.
  - squid `squid-swim-9501/9502`, `squid-push-9503`, `squid-hit-9504`, `squid-dry-9505`, `squid-dry-hit-9506`; bat `bat-*` (hit, wake, kill, squid fight and others, 8 records); wither skeleton `wskel-*` (fight x2, kill, golem, day, two, dark, fire); wither `wither-spawn-9531`, `-far-9532`, `-fight-9533`, `-cow-9534`, `-wskel-9535`, `-corpse-9536`; pigman `pigman-hit-9541`, `pigman-two-9543`; giant `giant-golem-9542`, `giant-fight-9544`.
- `tools/probes/EndermanWolfProbe.java` / `EndermanWolfScenarios.java` / `VillagerProbe.java`: flag `B93`, types `s b k w`; wither skeleton as `yl` with `a(1)`, stone sword and attack 4; wither row flags (`ca`, `bv`, `bt`, `bu`); World.getEntityByID override (the head pass); `run93()` plus `sc88` lines. `tools/verify-endermanwolf.mjs`: set `b93mr`, count 32, two output files.
- `src/enderman-wolf-replay.js`: `reference93`; wither, squid and bat flags; the wither starts at Invul 220 and a third of its health; the probe's bare pigman (no golden sword); sound filters for client-side aux events; wither skull seeding; blast hook that does not remove the wither.
- Port fixes: `src/entities.js` (the player's hit always reaches `attackEntityFrom`, also in the hurt window; no pitch draw for the squid's null hurt/death sound; wither skeleton burns in daylight), `src/squid-bat-mobs.js` (squid corpse tail, head yaw, bat stale box, null-sound events removed while loot/xp events are kept), `src/corpse-living.js` (bat corpse tail), `src/spider.js` (`mob.skeleton.*` sounds for the wither skeleton), `src/combat.js` (coal 301 and bone 311), `src/ai.js` (the wither never despawn-rolls), `src/wither-boss-mobs.js` (tasks tick offset while Invul, corpses are candidates), `src/wither-boss.js` (yaw `(float)atan2`).
- `src/mobrec93-b93.test.js`: 39 tests.

## Evidence
- Executed: all 32 records (squid yaw and corpse, bat box, wither spawn/despawn/blast, wither skeleton sounds/drops/sunburn, pigman second hit).
- Bytecode-read: `yh.a(ro,F)` calls `c(sa)` before `yq.a` and after only the `aw()` test; `yh.c` rolls `bs` then `bt`; `sv.a` tests the sound for null before `bf`/`bg`; `xc.w()` resets entityAge; `wr` (snow golem) has no `aT`, so its hurt sound is the default and does draw.
- Port-read: item id mapping (301/311 against the native 263/352).

## Verification
- `node --test --test-concurrency=2 src/mobrec93-b93.test.js`: 39 pass, 0 fail. With entities, ai, combat, wither-boss and squid-bat-mobs reverted it fails 20 of 39 (checked once).
- Regression: 1180 tests over the 69 test files naming squid, bat, corpse, entities, enderman-wolf, mobrec, wither, skull, spider, sound, pigman, nether-melee, village-fight, attack, combat, hurt, silverfish, wolf and dragon: 1180 pass, 0 fail.
- `npm run build`: succeeded (one run).

## Old tests edited
- None.

## Found wrong in the batch 92 list
- "No per-tick native record for squid, bat, wither skeleton and the wither": true, closed here. The port was wrong in more places than the list named: wither skeleton drops used native ids (263/352), it used `mob.wither_skeleton.*` sounds (native `mob.skeleton.*`), the wither rolled a despawn, its yaw lacked the d2f, corpses were skipped as wither targets, and the player's hit inside the hurt window skipped pigman anger.
- Not wrong: the b88/b89/b92 snow golem records still replay (the squid-only null-sound guard keeps their pitch draws).

## Follow-ups
- Probe artifacts handled in the replay: the probe never removes dead entities, its explosion double does not push other skulls, its player is a world entity (so the wither pool includes it).
- Wither later behaviours have no record: blue skulls, the armoured half-health phase, block breaking, and the pigman/giant fights beyond these four.
- Browser only: bat and squid motion, wither spawn and shoot sounds (client-side aux events), the angry pigman look.
