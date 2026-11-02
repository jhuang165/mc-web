# 0.23.1 fan-out integration (2026-11-01)

Three parallel worktree branches merged onto 6b8a72c (GEN-04e) and released as 0.23.1:

- PLAYER-01 suffocation (`src/suffocation.js`, `Survival.damage` top-up + 60-tick spawn protection, `EntityWorld.suffocate`); 218 native records. See handoff in commit 4151628 / combat.md.
- PLAN-03b block metadata classification (`handoff_plan_03b_metadata.md`).
- PLAN-03i settings/controls catalogue (`handoff_plan_03g_settings.md`).

Tests: npm test 705/705, npm run build OK; bridge unchanged. Browser: suffocation hit cadence 10 ticks when enclosed; single head block triggers native client push-out. No Site publish.

Open follow-ups: suffocation death message and top-up hurt sound in main.js; settings mismatches (FOV 70 / 30–110, render distance in chunks, sensitivity curve, master volume 1.0, GUI scale "Larger") are pinned in `src/settings-catalogue.test.js` as known mismatches — fixing one requires updating that test and the catalogue.
