# endermanwolf b42 track

## Summary
- New probe `tools/probes/EndermanWolfProbe.java` + `EndermanWolfScenarios.java` (prefix `b42-`, own entry points) run native enderman and wolf against a real EntityPlayerMP; `tools/verify-endermanwolf.mjs` writes `public/research/enderman-wolf-b42-reference.json` (58 records).
- `src/enderman-wolf-replay.js` + `src/enderman-wolf-b42.test.js` replay them (59 tests).
- Port fixes: enderman stare teleport only within 4 blocks (`sa.f(sa) < 16.0D`, bytecode-read); a mob attacker becomes the enderman's target; a creative target is dropped after the tick. `enderman.test.js` chase test updated.
- Wolf targeting matched with no change inside the compared windows.
- Probe note: the player is added to the world entity list (zombie targeting reads selectEntitiesWithinAABB).

## Verification
Commands (load average 4-11, shared Mac): `node --test src/enderman-wolf-b42.test.js src/enderman.test.js` (74 pass); `node --test` on enderman-wolf-b42, enderman, enderman-live, eye-height, wolf, wolf-world, mob-griefing, mob-steps, village-fight-b41 before the test edit: 154 of 155, the failing one was the old 16-block chase test, now fixed and re-run (pass). No full npm test or build (brief).

## Follow-ups
- Windows cover 2843 of 11270 ticks: native wander draws (i180, i120, f, f) are not made by the port, and the chase starts a tick earlier natively. Moving the enderman to `creatureActionState` and adding wolf wander/look-idle draws would extend coverage.
- Replay burns recorded wander draws and filters ambient sounds (idle, scream, bark, growl, step); positions compared only within 0.5 block.
- Not touched: remaining-gaps.md, parity.md, PROJECT.md, version.
