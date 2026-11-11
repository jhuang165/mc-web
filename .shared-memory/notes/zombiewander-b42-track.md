# zombiewander b42 track (claude-b42-zombiewander)

Branch `batch42-zombiewander` from a41fdcff3 (0.70.0).

## Summary
- Root cause of the batch 41 seed 4109 "idle zombie turns differently from tick 19": a replay world gap, not a port AI bug. The FireballProbe world answers light brightness 15 for every cell (below the floor too); `fireballs-replay.js` had no `ew.brightnessLevel` hook, so the port weighed `findRandomTarget` tries under the floor (stone, dark) as `0.5 - 0` and picked the third try `(+5, -7, -4)`, while native weighs all ten at -0.5 and takes the first `(+6, +5, -6)`. Same Random draws, different target, so a different path (10 points to (77,0,60) versus 13 points to (78,0,58)) and a different move helper target; the yaw difference shows at tick 19 where native clamps to -136.797 and the port to -130.941.
- Fix: one line in `src/fireballs-replay.js` (`ew.brightnessLevel = () => 15`). No change to `ai.js`, `pathfinding.js` or `entities.js`: the port's draws, path, helpers and tasks matched native exactly in every record.
- New evidence: `tools/probes/ZombieWanderProbe.java` + `tools/verify-zombie-wander.mjs` -> `public/research/zombie-wander-reference.json` (18 records: flat incl. seed 4109 as `zw-flat-41091`, slope, water, daylight burning, scripted fire; per tick position, motion, yaw, pitch, head, body yaw, fire, health, Random draws, path, move helper, look helper, running tasks, navigator, body helper). `src/zombie-wander-replay.js`, `src/zombie-wander.test.js` replay them exactly.
- `public/research/fireballs-b42-reference.json`: the original seed 4109 blaze volley (FireballProbe fb41 scenario with `s = 4109`, temporary local edit, reverted) now replays exactly through `fireballs-replay.js`; tested in `zombie-wander.test.js`. `fireballs-b41-reference.json` untouched.
- Doc: `public/research/pathfinding.md` (Batch 42 section). `remaining-gaps.md`, `parity.md`, `PROJECT.md` and the version are left to the lead.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-zombie-wander.mjs` (regenerates the reference; two runs byte-identical; each family alone equals the full run).
- `node --test src/zombie-wander.test.js src/fireballs-native.test.js src/fireballs-b41.test.js`: 58 pass (before adding the volley test), `zombie-wander.test.js` alone 20 pass.
- `node --test src/ai.test.js src/pathfinding.test.js src/legacy-ai.test.js src/village-fight-b37.test.js`: 75 pass, 0 fail.
- No full `npm test`, no build, no browser. Load average 8.7 to 14.7 (8 tracks).

## Follow-ups
- A player 3 to 10 blocks away never became the zombie's target in the ZombieWanderProbe double while the port's zombie walks to it from tick 0 (the `zw-near` scenarios were dropped). The village-fight `b38`+ records cover hunts; find what they set that this probe does not (probably the player double or entity list) before recording hunts here.
- Other replay harnesses that build `EntityWorld` over `plain()` without `brightnessLevel` would hit the same gap for mob wander (check any new probe that ticks a zombie, pigman, skeleton or creeper).
- Records have one wander each; multi-wander sequences and a path ending in an arrival are only incidentally covered (120 ticks).
