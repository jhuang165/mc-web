# Batch 99 credit99: removed-body Thorns side effects, tamed wolf kill credit, dispenser arrow / fire charge kills

## Summary
- **Logged-out shooter killed by Thorns (multiplayer/server-survival.js `goneHit`, `dieGone`; server-dispense.js one call).** On top of b98 (health, death message, item drop): the hurt sound (death sound when lethal) is broadcast at the removed body to everyone but it; a lethal hit counts the `deaths` stat and the killing mob's `entityKilledBy` stat (and so the `deathCount` scoreboard objectives, through `Stats.onIncrement`); the saved logout record's `stats` are refreshed after any hit (damage-taken too), since the native StatisticsFile outlives the logout. Still not modelled: death throw, S19, XP orbs, kill credit.
- **Tamed wolf kill credit: already native, no code.** `entities.js` attackEntityFrom sets `recentlyHit = 100` for a tamed wolf attacker, `hitMob` passes no Looting, drops/rare drop/XP follow recentlyHit; the combat tracker and server-stats clear attackingPlayer and give the owner no `mobKills`.
- **Dispenser arrow / fire charge kill: already native, no code.** No shooter gives no player flag and no attacker, so recentlyHit stays 0 (no XP, no rare drop), as native.
- Tests: `src/credit99-b99.test.js` (5).

## Evidence
- **Bytecode-read:** sv.a(ro, F) 453-528 (aU/aT sound call, then onDeath via a(ro)); yz.a(String,F,F) is playSoundToNearExcept; mw.a(ro): deathCount objectives, sg.a(aX()) killed-by stat, `a(pp.v, 1)`; mw.a(ph, int) -> pg.b (StatisticsFile by UUID); oi.e(mw) saves NBT only, never touches the stats file map. sv.a(ro) onDeath: looting `afv.i` only for a yz source; drops and rare drop on `aS > 0`. sv.aF: XP on `aS > 0 || isPlayer`, e(aR) with aR null for a wolf. sv.a(ro, F) 208-296: tamed wv -> aS = 100, aR = null. zc.h 864-892: null shooter -> ro.a(arrow, arrow); zi.a: causeFireballDamage with a null shooter is an `onFire` rq with the ball as entity (not sv/yz).
- **Port-read:** the entity code paths named above; the removed body never ticks (no onDeathUpdate).
- Not executed: no live-class probe (needs EntityPlayerMP and a world). The StatisticsFile being saved on the next world save and shared on rejoin is bytecode-read only (oi line 571 `pg.b()`), not executed.

## Verification
- `node --test --test-concurrency=2 src/credit99-b99.test.js`: 5/5; with server-survival.js and server-dispense.js reverted 3 pass / 2 fail (the sound and stats tests; the wolf and dispenser tests pass as they record already-native behaviour).
- Neighbour run, 31 files (credit89-99, stats, mpscoreboard, every test naming serverSurvival/server-survival/dieGone): 259 tests, 259 pass. No build, no full npm test, no browser.

## Found wrong in the batch 98 list
- Nothing. (The task text says a wolf's kill "credits its owner"; natively it does not: no kill score, no Looting, only the drop/XP flag.)

## Follow-ups
- Removed-body death throw, S19, XP orbs, kill credit remain unmodelled (nothing ticks the entity).
- Stats of a removed body only reach the saved record while `savedPlayers` still holds it; a relog before the hit is the only case, and a server restart reads that record.
- Browser-only: nothing checked.
