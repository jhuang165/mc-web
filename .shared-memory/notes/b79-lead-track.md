# Batch 79 lead: merges, fixes and release 0.108.0

## Merged (git log --first-parent on batch79-lead)
- riderpose79, potspacks79, mpperf79, mplanes79, catalogue79, explfx79, corpse79, spswing79, falling79, spexec79. No textual conflicts.

## Full-test problems and fixes (536376793)
- The first full `npm test` never finished: `explosion-simulation.test.js` and `block-break-simulation.test.js` ran at 100 % CPU for over 20 minutes. Cause (spexec79): `ItemEntities.spill` now draws gaussians through `gaussianFrom` (polar method), and those tests build `ItemEntities(() => 0.5)`; a constant 0.5 gives v1 = v2 = 0, s = 0, which the loop rejects forever. Fix: `gaussianFrom` returns 0 after 1000 rejections in a row. A real source is rejected 1000 times in a row with probability (1 - pi/4)^1000, so no real draw changes.
- 14 `creeperwitch-b45` replays failed on "player motion" (found on the explfx79 branch alone). explfx79 now gives the single-player player the S12-quantised server copy motion after a hurting blast (bytecode-read `bjb.a(hy)` assigns motion). The b45 reference records the probe's server-side player, so the harness (`enderman-wolf-replay.js`) now records the server copy's motion (`ew.ai.player.motion`) for every set, as b46mp already did. 78/78 pass; all 12 files that use the harness plus explfx79, explosion and block-break tests: 512/512.

## Verification
- One full `npm test` on 536376793: 8964 tests, 8964 pass, 0 fail (205 s). `npm run build` ok; bridge tests ok. No browser checks (by request).

## Open
See "Still open from batch 79" in `public/research/remaining-gaps.md` and the ten `*-b79-track.md` notes. Batch 80 tracks were cut from 6c0bf72a3 (before the lead fix) and are merged on `batch80-lead`.
