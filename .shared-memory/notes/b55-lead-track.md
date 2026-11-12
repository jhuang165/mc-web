# Batch 55 lead (2026-11-12) — PAUSED

Paused at the user's request ("pause them for now we'll resume later"). Five Sonnet tracks were cut from be55d463b (release 0.83.0) in `../wt55-<name>` on `batch55-<name>`. Nothing is pushed and game/ main is unchanged.

## State
- Merged --no-ff on `batch55-lead`: chatrarity (12093f15c), instantbreak (bdcd9e7f2).
  - Lead fix 4f39d9878: a record's tooltip name is aqua (its string rarity `'rare'` had been indexed like an array).
- dimtracker: stopped while writing its final report. It has 3 commits (a9c664382 probe records b55dt, 5f54a0ad8 tracker change, 5ac499c75 note). Review it and merge it; it was not merged.
- horserear: stopped mid-work, all of it uncommitted in `../wt55-horserear` (HorseRearProbe.java, verify-horse-rear.mjs, horse-rear-reference.json, horse-copy.js, horse-live.js, ServerPlayerProbe.java, the b47h reference). It was rewriting the tail of the verify script.
- effects3: stopped mid-work, all of it uncommitted in `../wt55-effects3` (mob-effects.js, status-effects.js, witch*.js, wither-boss-mobs.js, enchantment-effects.js, MobEffects2Probe.java, the mob-effects reference, a new mob-effects-b55.test.js).

## To resume
1. Review and merge dimtracker.
2. Restart horserear and effects3 in their worktrees, telling each to continue from the uncommitted work (check `git status` and `git diff` first).
3. Then the usual lead pass: one full `npm test`, `npm run build`, the bridge unittest, `git diff --check be55d463b`, and a muted headless smoke (template: `../artifacts/b54-lead/smoke.mjs`). The smoke should cover instantbreak's click-time break and place (one sound, no flicker, long tasks while placing) and a death message with a named weapon.
4. Release 0.84.0, fast-forward main and push.
