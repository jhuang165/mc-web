# Batch 91 mobrec91: dead server copy, legacy closest player, aux pitch random, slime and magma cube records (executed)

## Summary
- `public/research/enderman-wolf-b91mr-reference.json` (about 1.6 MB) holds 22 executed records (the b90mr harness: counting world `Random`, row element 11). All 22 replay with no divergence.
  - dead probe player: `dead-flight-9101/9102`, `dead-spider-9111/9112`, `dead-silverfish-9124/9126`, `dead-giant-9131`, `dead-zombie-9151`;
  - slime and magma cube: `slime-fight-9201/9202`, `slime-small-9203`, `magma-fight-9211/9212`, `magma-big-9213`, `magma-creative-9214`;
  - iron golem against other mobs: `golem-slime-9301`, `golem-magma-9302` (both size 1), `golem-silverfish-9303`, `golem-witch-9304`, `golem-pigman-9305`, `golem-giant-9306`, `golem-hurt-9307`.
- `tools/probes/EndermanWolfProbe.java`: set `b91mr` (implies `b90mr`); slime and magma types `i j l u v` (slime 2, slime 1, magma 2, magma 4, magma 1; jump delay fixed to 20); silverfish, giant and pigman targets read from `td.bT`; `World.immediateSlimes` on.
- `tools/probes/EndermanWolfScenarios.java`: `run91()`. `tools/verify-endermanwolf.mjs`: set `b91mr`, `EW_OUT` env var, count assert, method text.
- `src/enderman-wolf-replay.js`: `reference91`, the new types and slime fields, the b90 rules extended to `b91mr`, legacy targets for silverfish, giant and pigman.
- `src/entities.js` (port fixes):
  - the dead copy of the player keeps ticking (`serverPlayerUpdate` no longer needs `alive`); `p.inWorld` (alive, or dead for at most 20 ticks) replaces `p.alive` in the spawn-blocked test and the mob pushes;
  - the legacy envs use a `closestPlayer` without an alive test and a `lookGone` ending on `isDead` (deathTime 20);
  - slime contact hit: `slimeTouch` runs inside `serverCopyUpdate` after the copy's move and pushes (EntityPlayer.collideWithPlayer inside `mw.i`), at the copy's moved position; the slime's own tick only hits when no copy is ticked (harnesses);
  - slime hurt volume is `volumeOf(e)` (0.4 * size), head yaw follows yaw, eye height is the float 1.62F.
- `src/ai.js`: `PlayerView.inWorld`. `src/legacy-creature.js`: the same closest-player rule. `src/slime.js`: `faceEntity` takes a float square root.
- `src/wither-boss-mobs.js`, `src/zombie-door.js`: aux event pitch uses `clientAuxRandom`, not the world random.
- `src/mobrec91-b91.test.js`: 30 tests.

## Evidence
- Executed: all 22 records (dead copy keeps moving and pushing; slime hit order and knockback position; slime hurt volume, head yaw, faceEntity bits; golem targets).
- Bytecode-read: `nh.a(jd)` has no isDead test; `ahb` getClosestPlayer has no alive test, getClosestVulnerablePlayer tests isEntityAlive; `sw.bq` look target ends on `K`; `yz.e` calls `sa.b_(yz)` after `sv.e` (collideWithPlayer, in the player's own update); `vu.a(sv, boolean)` offsets 0-24: null returns false, target == taskOwner returns false, then isEntityAlive (the batch 90 self-target rule is confirmed); `bma.a` plays aux events from the client world's random (wither and zombie-door pitch).
- Port-read: nothing left unproved in the changed code.

## Verification
- `node --test --test-concurrency=2 src/mobrec91-b91.test.js`: 30 pass, 0 fail. With the six port files reverted (entities, ai, legacy-creature, slime, wither-boss-mobs, zombie-door) it fails 19 of 30 (checked once).
- Regression: `node --test --test-concurrency=2` over the 295 test files that import or name `entities.js`, `ai.js`, `legacy-creature`, `slime.js`, `wither-boss`, `zombie-door`, `enderman-wolf-replay` or `EntityWorld`: 4715 tests, 4714 pass, 1 fail on the first run: `src/spcopy89-b89.test.js` line 197 matched the source text of the old gate `if (p?.alive && !p.unticked && !p.left)`. That test encoded the non-native behaviour (a dead copy stops ticking; executed b91mr-dead-flight records show it keeps ticking), so its regex now matches `if (p && !p.unticked && !p.left)`; the file then passes 12 of 12.
- `npm run build`: succeeded (one run).

## Old test edited
- `src/spcopy89-b89.test.js` line 197: source-text regex for the gate in `tick` updated, because it pinned the old non-native dead-copy gate (evidence above).

## Found wrong in the batch 90 list
- The "legacy mobs need alive-less closest player", "dead copy stops ticking", and "wither and zombie-door pitch random" items were all right.
- The "deadTicks may be off by one" worry: the records of dead players (flight, spider, silverfish, giant, zombie) replay exactly with `deadTicks > 20`, so no off-by-one.
- Found beside them: slime hurt volume (1 instead of 0.4 * size), slime head yaw, the float `faceEntity` square root, and the hit order (collideWithPlayer runs in the copy's tick, not in the slime's).

## Follow-ups
- The probe keeps a split slime child as a static, targetable entity (it is never ticked), so records where a size 2 or 4 slime or magma cube dies and splits are not comparable; the golem records use size 1. Splitting is port-read only (b39 records cover the split draws).
- The dead silverfish burrows into the y=-1 floor cell of the probe world, which the replay world does not mirror, so only two silverfish seeds are kept.
- A real death of the probe player by damage crashes the probe (`mw.i` server field null); deaths are scripted with `health n 0`.
- Browser only: the audible slime and wither pitch, the look of a corpse-chasing mob.
