# legacyai track, batch 39

## Summary

Branch `batch39-legacyai` (cut from 12940159e, release 0.67.0). Slimes, magma cubes, ghasts and blazes replay the native 1.7.10 flows Random draw for Random draw against probes that run the unchanged classes (ym, yf, yd, xx).

- Probe: `tools/probes/LegacyAiProbe.java` (33 `la-*` scenarios; a small `immediateSlimes` flag was added to `VillagerProbe.World.d`), `tools/verify-legacy-ai.mjs` -> `public/research/legacy-ai-reference.json`.
- Replay: `src/legacy-ai-replay.js`, test `src/legacy-ai.test.js` (36 tests, every record exact).
- Slime and magma cube: dying slimes run the squish start/finish, the melee plays `mob.attack` with the native two pitch draws, split children get native seeds and tick in the same pass (`entitySeed`, `tickOrder` hooks), landing over 3 blocks sends level event 2006 for every living mob (`moveLanding`, `landingDust`, hooked in `main.js`), `faceEntity` uses the float constant 3.1415927410125732 (`slime.js`).
- Ghast: already matched once the probe and replay were fixed (waypoints, charge, fireball launch seeds, despawn).
- Blaze: now EntityCreature's legacy flow. `blazeThink` (`blaze-ghast-mobs.js`) drives `creatureActionState`; `silverfish.js` gained optional `hasAttacked` (skips re-path and wander, strafes with MathHelper's table). `blazeUpdate` follows the native draw order (wet damage, hover, crackle roll, damping, six smoke doubles even with no particle system). The task list is gone for the blaze (`buildBlazeGhastTasks` is a no-op).
- Shared engine fixes found by the records: swim and splash sound volume use the motion before the water drag (`e.moveMotion`, double math with 0.20000000298023224), jumping persists between ticks, blaze `attackEntityFrom` resets entityAge, hover constant 0.30000001192092896, level events truncate coordinates, blaze paths use (openDoors, no breakDoors, no avoidWater, canSwim).
- No change to `legacy-creature.js` or `village-fight-replay.js`.

## Verification

- `node --test src/legacy-ai.test.js`: 36 pass.
- Focused suites, one at a time, all passing: slime 11, slime-world 8, blaze-ghast 7, blaze-ghast-world 5, magma-pigman 12, magma-pigman-world 6, silverfish 75, giant 6, spider 11, cave-spider 8, mob-steps 14, ai 12, entities 21, module-names 1, away-entities 8, explosion-entities 5, village-fight 4, village-fight-b31..b38 5/6/33/27/9/24/19/32. No full `npm test`, no build.
- Bytecode-read (not executed): `sw.a(sa,F,F)` float constant, `sv.a(DZ)` landing event, `td.bq`, `xx.e`, `sv.attackEntityFrom`.
- Headless Chrome (muted, port 5393, `artifacts/b39-legacyai/smoke.mjs`): a slime, a ghast and a blaze in a fresh world moved and fought sensibly (slime hunted the player, ghast flew off tracking, blaze hovered); no page errors, one 404 resource response (not traced). Load average was about 5.1 at the start.

## Follow-ups (proposed gap lines)

- Fireball flight and impact on the player are not native evidence: the probe never ticks spawned fireballs (`World.d` adds only slimes), so only launches are replayed.
- The blaze targets only the player; a mob that hurts it does not become entityToAttack.
- Other `faceEntity` copies may still divide by Math.PI instead of the float constant (only slime.js was fixed).
- The blaze's client crackle (`fire.fire`) is emitted by the server-side port; natively it is the isRemote half.
- Slime melee `mob.attack` has no audio in the manifest.
- Probe records cover difficulty and light levels used by the scenarios only; no Nether-world blaze/ghast spawn flow.
