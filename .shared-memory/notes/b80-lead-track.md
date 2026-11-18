# Batch 80 lead: merges, fixes and release 0.109.0

## Merged (git log --first-parent on batch80-lead)
- docs80, genguards80, corpse80, spswing80, mpperf80, mpcmd80, fluids80, then release 0.108.0 (batch79-lead, 087e0e4ba), renderfx80, potspacks80, mpfx80.
- Conflicts: `src/projectile-renderer.js` (renderfx80 vs fluids80) keeps both imports, `EntityFireRenderer` and `fireballTurn`; `src/wither-boss-mobs.js` (mpfx80 vs renderfx80) runs `fireballTurn(b, ...)` first, then mpfx80's bubbles and smoke.

## Full-test problems and fixes (cabe0d28e)
- `mpperf78-b78.test.js` "seeded pens" failed after the mpfx80 merge (bisected: passes at 2fd81dd39, fails at bfdc858f3). mpfx80 passes `flaming` through to the server's `explode`, so a ghast fireball now lights fire. `explodeBlocks` rolls the fire with `own`, which defaults to `new JavaRandom(Date.now())`, so the fires (and so the burning mobs' hits) changed with the clock and repeated seeded runs gave different hashes. Fix: `ServerMobs.explode` passes `own: new JavaRandom(Math.floor(Math.random() * 2 ** 48))` for a flaming blast only. Explosion's explosionRNG is an unseeded `new Random()`, so this is the same kind of draw; non-flaming blasts make no extra Math.random call. The single-player `explodeBlocks` default is unchanged (still Date.now).
- `prediction5-b59.test.js:125` failed on the mpcmd80 branch alone: its source match on `main.js`'s command block `done` did not allow mpcmd80's remote `multiplayer.blockCommand` branch in front of the Creative/cheats check. The regex now requires that branch, then the check.
- Load-only failures in the full run (timeouts in `entity-portal`, `headless-columns`, `interchange`; `exit-prewarm` "the portal window is held") pass when run alone and in the rerun.

## Verification
- One full `npm test` on bfdc858f3: 9001 tests, 8994 pass, 4 fail, 3 cancelled (the two real failures and the load-only ones above). After cabe0d28e, the failed files plus every file touching flaming blasts, ghasts, explosions, fire, mpperf7x and all b80 tests (68 files): 1017/1017 pass. No second full run, by request. `npm run build` ok; bridge tests ok. No browser checks (by request).

## Browser-only, not checked
End portal 16-pass shader compile, wither skull model, burning thrown items and fireballs, tall grass and cobweb pots, the pack screen's `translate` descriptions, the client's S27 block clearing, the remote command block GUI.

## Open
See "Still open from batch 80" in `public/research/remaining-gaps.md` and the ten `*-b80-track.md` notes.
