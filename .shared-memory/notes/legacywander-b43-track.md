# Batch 43 track: legacywander

## Summary
- New native records `public/research/fireballs-b43-reference.json` (`FB_PREFIX=fb43-`, 27 records) from the unchanged 1.7.10 classes in `FireballProbe`. Rows gain a seventh section: the draws each entity's own Random made that tick (`draws: true`). `replayFireballs` compares them (`fireballDivergence` returns `[t, "draws", i, want, got]`).
- Idle wanderers: the other replay harnesses (`legacy-ai-replay`, `zombie-wander-replay`, `village-fight-replay`, `enderman-wolf-replay`) already set `brightnessLevel`. The real causes were in the port and the fireball harness. 120 sweep records (seeds 4301 to 4330 for spider, pigman, blaze, silverfish) replay exactly after the fixes; 13 are kept as records.
- Silverfish: (1) the port dropped the x0.98 moveForward decay carry, (2) it did not keep `entityAge` (the wander gate `< 100`, +2 in light above 0.5) so second wanders diverged (`silverfishThink` in `src/entities.js`). (3) The seed 4213/4214/4222/4226 "death at tick 0" was the harness: native `setDead` (despawn or hiding as a monster egg) keeps health and sets isDead, the port marks health 0. `replayFireballs` now maps a despawn to the recorded convention (`gone` map; setDead may run twice in one update).
- Corpses: native EntityLivingBase.onLivingUpdate keeps running for a dead mob. `dying()` now zeroes moveStrafing and runs `blazeUpdate(..., corpse=true)` (hover push toward entityToAttack, 0.6 fall damping, crackle and smoke draws) for a blaze corpse. `blazeUpdate` skips the water check for a corpse.
- Golem and blaze: the golem's first attack matched native on all 168 layouts I swept (3 player spots x 7 distances x 4 heights x 2 angles), including layouts whose first hit is tick 9. The batch 42 miss was not reproduced; the corpse bugs above were what differed. 10 layouts are recorded (4486 is a no-contact control).
- Files: `src/entities.js`, `src/blaze-ghast-mobs.js`, `src/fireballs-replay.js`, `tools/probes/FireballProbe.java`, `tools/verify-fireballs.mjs`, `src/fireballs-b43.test.js`, the new reference JSON.

## Verification
Focused only, the full suite left to the lead: fireballs-b43 28, fireballs-b42 20, fireballs-native 28, fireballs-b41 11, legacy-ai 36, silverfish 75, blaze-ghast 7, blaze-ghast-world 7, iron-golem 12, zombie-wander 20, enderman-wolf-b42 60, village-fight 4 / b31 5 / b32 6 / b33 33 / b34 27 / b35 9 / b36 24 / b37 19 / b38 32 / b39 22 / b41 22, entities 21, ai 12, pathfinding 8. All pass. Load average about 6 to 7. No browser.

## Follow-ups (proposed gap lines)
- Two golem and blaze sweep layouts (seeds 4476 at tick 37, 4517 at tick 30) differ from native by about 1e-7 in one value at one tick; cause unexplained, probably float rounding. They are not recorded.
- The idle sweep only covered the player far away; a near-player sweep (target and attack paths of spider, pigman, silverfish) is not recorded.
- Draws logging covers `FireballProbe` only; other probes' records still compare state, not draws.
