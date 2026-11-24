# entnbt99 (batch 99): F3 ability speeds, XP bar width, dedicated-server ability speeds / raw XP / vitals

## Summary
- `src/player-movement.js`: `normalAbilitySpeeds` (the old `setAbilitySpeeds` sanitising, now reusable per player), `shownAbilitySpeeds()` (F3 values; walk shown raw, a negative stays negative, while the movement value clamps at 0), `flySpeed`, `moveSpeed`, `groundAccel` take an optional speeds object (default: the module pair, so single player is unchanged).
- `src/main.js` (shared file; three small hunks, code-read only): F3 `walkSpeed`/`flySpeed` read `shownAbilitySpeeds()`; the XP fill width is `calc(xpBarFill(...) * var(--u))`; imports.
- `src/experience.js`: `xpBarCap(level)` (int-wrapping `yz.bP`) and `xpBarFill(progress, level)` = `(int)(xpP * 183F)`, drawn only above 0 and only when the cap is above 0.
- `src/player-physics.js`: `movePlayer` passes `state.abilitySpeeds` (server players only) to `flySpeed` / `groundAccel`.
- `src/multiplayer/simulation.js`: a saved `abilitySpeeds` is read at join into `player.abilitySpeeds` and written back by `savePlayer`; so loaded walkSpeed/flySpeed drive server movement per player.
- `src/multiplayer/server-survival.js`: `vitalsOf` wraps health/saturation/exhaustion in `jsonFloat` (a server save lost infinity as JSON null, which read back as NaN).
- Test `src/entnbt99-b99.test.js` (6 tests).

## Evidence
- Item 1 Port-read: the debug fields were the `WALK_SPEED`/`FLY_SPEED` constants; F3 now reads the loaded values.
- Item 2 Bytecode-read (`bbv`, "expBar" section): `cap = player.bP()`; if `cap > 0`, track drawn 182 wide; `w = (int)(bH * 183F)` (`bjk.bH` = XpP); fill (u 0, v 69) drawn only if `w > 0`. NaN -> f2i 0 (no fill), negative -> none, above 1 -> fill wider than the track (texture repeats beyond 256 wide; the port stretches nothing, it just sets the CSS width). `yz.bP` is plain int arithmetic: 17 below level 15, `17+(l-15)*3` from 15, `62+(l-30)*7` from 30, wrapping (level 1000000000 gives a negative cap, bar not drawn).
- Item 3: raw XP (Experience.serialize/readProgress, strings "NaN"/"Infinity") already round-tripped on the server (`ServerItems.join/savedFields`); the test confirms it through JSON. Gap found and fixed: ability speeds had no server path at all, and vitals infinity was lost.
- Item 4 Bytecode-read: `to.a(D)D` (RangedAttribute clamp) uses `dcmpg`/`dcmpl`, so NaN passes both bounds unchanged (NaN movementSpeed -> NaN motion and position); +infinity clamps to the attribute max (Double.MAX_VALUE), negative clamps to 0. Deliberate divergence stays: the port ignores a non-finite walk/fly speed (defaults), because NaN would poison the position and cannot be saved or rendered. A negative walkSpeed already matches (clamped 0).
- Not executed: no probe this track (bytecode reading only).

## Verification
- `node --test --test-concurrency=2 src/entnbt99-b99.test.js`: 6 pass, 0 fail. Related run over the 275 test files naming the edited modules: 2793 tests, 2792 pass, 1 fail (`mpeating-b58.test.js` "milk plays random.drink", passes alone: 5 pass; flake).
- Fails-without-the-fix: not checked by reverting; the new exports (`xpBarFill`, `shownAbilitySpeeds`, `normalAbilitySpeeds`) do not exist on unchanged code, so the file cannot load there.
- `npm run build`: run once.

## Found wrong in the batch 98 list
- None; the batch 98 follow-ups (F3 constants, unclamped XP bar) were accurate. The "dedicated server not checked" item was a real gap (speeds, vitals infinity).

## Follow-ups
- A nonpositive `xpBarCap` hides the whole bar natively (track included); the port only zeroes the fill. Only reachable at level ~3e8+ with wrapping ints.
- XpP above 1 draws a fill wider than the track; the native texture sampling beyond 256 px (GL repeat) is not replicated.
- Server clients do not receive per-player speeds (movement is server-authoritative, the client predicts with its own pair); a joined client with loaded speeds mispredicts until corrected.
- Browser-only (not viewed): the F3 line, the XP bar at odd XpP.
