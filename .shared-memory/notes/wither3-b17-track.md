# Wither round 3 (batch 17, branch b17-wither3)

## Summary
- New native evidence: `tools/probes/WitherRound3Probe.java` + `tools/verify-wither-round3.mjs` (run with `MC_RESEARCH=<dir with minecraft-1.7.10.jar>`) write `public/research/wither-targets-reference.json` and `wither-model-reference.json`; `src/wither-targets.test.js` replays them.
- Target selection: unchanged `xc.bn()` run on real `Chunk` lists with the genuine `World.getEntitiesWithinAABB`, selector and line of sight (8 scenarios: mixed mobs, creative and survival players, wall, kills, box edges, Easy/Normal/Hard). The port already matched; the head loop is now the pure `src/wither-targeting.js` (`headPass`, `witherPool`) that `witherAITick` calls, so the tested code is the shipped code.
- Head particles: `xc.e()` run on a client-flagged world with entity and world Random logged. `headParticleSpecs` (wither-boss.js) replays names, positions, motion and every draw. Real bug found: `headPosition` used Math.sin/cos instead of MathHelper's sine table (up to ~5e-5 blocks, also moves skull spawns); fixed.
- ModelWither: boxes, points, texture offsets and per-part matrices probed through the stub GL11 and replayed (`witherPose`, `partMatrix`). Renderer fixes: angle constant 57.295776 (was 1/57.3), side heads use tracked angles unlerped and unwrapped, growth scale uses the partial tick, armour pass shows whenever health <= 150 (also during the spawn), the pass re-draws the same model at translate(0,-0.01,0) scale 1.1 (not a 0.5-grown copy).
- Entity Random order is untouched: the head loop draws are identical to native (replayed draw by draw); particles use the separate client Randoms as before.

## Tests
`npm test` and `npm run build` from the worktree (full npm test: 3811 pass, 0 fail). New file `src/wither-targets.test.js` (14 tests).

## Probed vs bytecode-read
Probed: head target selection and draws, head particles and draws, ModelWither boxes and poses. Bytecode-read (bpc): armour pass texture scroll, blend and colour, texture flashing and growth scale formula (formula/constants only; the pass transform is read from bytecode, not recorded).

## Remaining gaps
- Entities that crossed a slice/chunk are re-appended natively; the port orders by current position.
- Armour pass GL state (scroll, blend, colour) not recorded by the stub; skull model orientation approximate; whole `super.bn` AI order versus head loop still ported as Brain order; not browser-checked.

## Proposed remaining-gaps Wither line
- Wither: batch 17 probes head target selection (genuine chunk entity query, selector, line of sight), head particles with both Randoms, and ModelWither boxes and per-part pose matrices (`wither-boss.md`); open: slice/chunk re-append order for moved entities, armour-pass GL state and skull model orientation are bytecode-read or approximate.
