# Batch 72 cakefog72: cake punch and Nether/End fog

## Summary
- `src/player-edit-simulation.js`: new `eatCakeSlice` (shared by right click and dig start); `serverClicked` eats on a punch (cake added to the serverTask condition).
- `src/multiplayer/server-cake.js` (new) and `src/multiplayer/simulation.js` (two short hooks plus imports): the dedicated server eats cake on a dig start and on a right click (it had no cake handling).
- `src/void-fog.js` `dimensionFogRange`, `doesXZShowFog`; `src/scene.js` applies them (short block before `const sky`).
- `src/cakefog-b72.test.js` (7 tests). Docs: stems-cake.md, void-fog.md, render-settings.md "Batch 72" lines.

## Evidence
- bytecode-read: `aju` `a(ahb,III,yz)` calls private `b(...)`: `yz.g(false)`, `zr.a(2, 0.1f)`, meta + 1, `ahb.f` at 6. No Creative branch beyond `canEat`.
- bytecode-read: `blt.a(int,int)` 587-637 as above; `aqo.b` false, `aqp.b` true, `aqr.b` true (End). Gap text said Nether only; the End also gets it.
- Not executed against the jar (no Java probe written: a stub world for `aju` needs many classes).
- recalled: nothing.

## Verification
- `node --test src/cakefog-b72.test.js src/block-clicks-b52.test.js src/void-fog.test.js src/stems-cake.test.js`: 22 pass, 0 fail. `src/player-throw-replay.test.js src/prediction5-b59.test.js src/redstone-ore.test.js`: 22 pass.
- Full npm test not run (batch rule). Nothing checked in a browser (fog look, cake slice mesh).

## Follow-ups
- The server cannot place a cake item; only existing cakes work there.
- `random.eat` on single-player cake use has no native playSound in `aju.b`; unverified whether another path plays it.
