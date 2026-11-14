# Batch 65 mpuse2: refused item use, server player drops, wither level-event cells

## Summary
- `src/player-item-use.js`: with `predicted` (connected client) a food or drink use no longer ends at count 0. It runs on below zero (crumbs / drink sound at every 4th count, `before % 4 === 0`) like the native client, with no final 16-crumb burst, no eat, no burp.
- `src/multiplayer/client-use-predict.js`: new `slotReplacesUse(message, current)`.
- `src/main.js` (one line, `onSlot`): a set-slot message for the held slot clears `eating`.
- `src/wither-boss-mobs.js`: `levelEvent` (1012 / 1014) now truncates the cell toward zero (`Math.trunc`, `-0` normalised); exported for the test. The brief named `server-wither.js`, but the cell is computed in this shared file (single player and server).
- `src/mpclientanim-b64.test.js`: the predicted-eat test now expects the use to stay alive past 32 ticks.
- `src/mpuse2-b65.test.js` (27 tests).

## Evidence
- Bytecode-read (`javap -c -p yz`, EntityPlayer.onUpdate `h()`): if `itemInUse != null` and `inventory.getCurrentItem() == itemInUse` (identity): updateItemUse(5) when count <= 25 and count % 4 == 0, then `--count == 0 && !world.isRemote` runs `onItemUseFinish` (`p()`); if the stack object differs, `clearItemInUse` (`bB`). So the client never finishes a use itself, and the count goes negative while the button stays down.
- Bytecode-read (`yz.a(byte)`): status 9 calls `p()`. No server class in `mw`/`yz` sends status 9 for a player (grep of `mw` found no such call); recalled, not exhaustively searched across all classes. **Corrected by the b65 lead:** `mw.p()` (EntityPlayerMP.onItemUseFinish) does send `new gt(this, (byte)9)` to the eater's own connection; the port now sends `useDone` (see `b65-lead-track.md`).
- Result for gap 1: when the server refuses (food full), it sends nothing, so the client animation continues (sounds and crumbs keep coming) until the button is released (`key.use` handler, already there), the held item changes (already cancelled) or a set-slot message for the held slot arrives. When the server accepts, its S2F for the held slot replaces the stack object and ends the animation. Recalled: S2F always puts a new object (`handleSetSlot`); the port's `applySlots` also always replaces.
- Gap 2 (food bar): native `onItemUseFinish` / `ItemFood.onEaten` only runs server side because of the `!isRemote` test above, so the client's food bar changes only through S06. The port already does this; found right, no change.
- Gap 3: the server paths (`dropHeld` / Q, window close with cursor or grid stacks, Creative drop slot -1) all call `ItemEntities.dropPlayer`, the code already replayed against the executed EntityFlightProbe record. Nothing differed. The new test replays the 14 non-wall records' spawn rows (position, motion, delay) through the real server paths (`sim.dropHeld`, `invClose`, `invCreative`). Executed evidence (existing record), no code change. Native close-window drop is `dropPlayerItemWithRandomChoice(stack, false)` = thrown, matching.
- Gap 4: bytecode-read `xc.a(IDDDZ)` and `xc.bn`: `getfield s/t/u; d2i` before `ahb.a(Lyz;IIIII)`. The port used `Math.floor`; fixed. (Block sweep cells use `qh.c`, floor, unchanged; the 1013 event call in the port keeps floor too, not read here.)

## Verification
- `node --test src/mpuse2-b65.test.js`: 27 pass.
- `node --test src/mpclientanim-b64.test.js`: 4 pass. `src/entityprobes-b64.test.js`: 18 pass. `src/mpwither-b64.test.js`: 7 pass. `src/player-item-use.test.js src/use-hold.test.js src/wither-boss.test.js`: 28 pass.
- `node --check` on every touched JS file. `eating` in `main.js` is module scope (declared in the big `let` near line 505).
- Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Browser: a refused eat (server food full, client mirror hungry) should keep bobbing until release; the held-slot S2F then stops it. The first-person eat render with a negative count was not looked at (native keeps the bob via cos of the count).
- The 1013 spawn event cell (`Math.floor(e.x)` in `witherAITick`) was not checked against bytecode.
