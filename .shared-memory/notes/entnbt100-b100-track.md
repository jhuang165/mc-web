# entnbt100 (batch 100): XP bar cap, level number, int wraps in XP/Score/death drop, food timer

## Summary
- `src/experience.js`: `levelCost` is now `xpBarCap` (yz.bP, int-wrapping); `add` follows yz.s/yz.v (Score is a wrapping int add, n is clamped to MAX_INT - total, bar step is float n / float cap, level + 1 is an int and a wrap below 0 resets level, bar and total); `addLevels` wraps the level as an int; `death()` returns int `level * 7` capped at 100 (a negative or wrapped value is returned as is; spawning drops nothing for it).
- `src/bitmap-text.js`: `xpLevelHtml` draws only for level > 0 (was any nonzero level, so a negative level showed).
- `src/main.js` (shared, one line, code-read only): the `.experience-track` (fill is its child) is hidden when `xpBarCap(level) <= 0`; import of `xpBarCap`. The level number div is a sibling, so it stays.
- `src/survival.js` (shared): `foodTick` timer increments as an int (`|0`).
- Test `src/entnbt100-b100.test.js` (6 tests).

## Evidence
- Item 1 Bytecode-read (`bbv`, after "expBar"): the track and fill are inside `if (bP() > 0)`; after it, outside that branch, `if (bjk.bF > 0)` draws the "expLevel" number (text `"" + bF`). So a nonpositive cap hides track and fill but the level number is still drawn.
- Item 2 Bytecode-read (`yz.e` getExperiencePoints): keepInventory -> 0; `i = bF * 7` (imul); `i > 100 ? 100 : i`, so negative levels return a negative count; level 400000000 gives -1494967296. `yz.s` (addScore) is `DataWatcher(18) = getScore + n`, int wrap. `yz.v`: `n = min(n, MAX - bG)` then total and bar. `yz.a(int)`: `bF += n; if (bF < 0) {bF = 0; bH = 0; bG = 0}`. Death screen Score is the int printed as is (port prints `score` unchanged; negative prints with `-`).
- Item 3 Bytecode-read (`zr.a(yz)` FoodStats.onUpdate): timer is int `d`, `++d >= 80`; rest of the port logic (exhaustion > 4, saturation > 0, food >= 18, starvation) matches; NaN saturation/exhaustion compare false in both. Only the int wrap differed.
- Not executed: no probe this track (bytecode reading only, no `entnbt100-probe` directory).

## Verification
- `node --test --test-concurrency=2 src/entnbt100-b100.test.js`: 6 pass, 0 fail; with the old `experience.js` restored 4 of the 5 XP tests fail (fails-without-the-fix checked for experience.js; food test and the bitmap-text one not reverted).
- Related run over 73 test files naming the edited modules: 991 tests, 990 pass, 1 fail (the b98 wrap expectation above, corrected). After the timer edit: entnbt98, entnbt100, experience, survival tests: 58 tests, 58 pass.

## Found wrong in the batch 99 list
- None. Follow-up "nonpositive cap hides the whole bar" confirmed; the level number is NOT hidden natively.

## Follow-ups
- Death screen Score for a huge level is unaffected (Score is its own int). The aria-label on `#experience-hud` still uses the unwrapped cost formula (not visible).
- A native Infinity bar loops forever in `yz.v`; the port keeps a 1,000,000 iteration guard.
- Browser-only (not viewed): the track hiding at wrapped levels.

## Old test edited
- `src/entnbt98-b98.test.js` line 118 expected the total to wrap (-2147483648) when 1 XP is added at total MAX_INT. Not native: `yz.v` clamps `n` to `MAX_INT - experienceTotal` (bytecode-read), so the total stays 2147483647. That b98 test was not an executed record (the b98 probe covered only NBT round trips).
