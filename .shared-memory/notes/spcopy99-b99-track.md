# spcopy99 (batch 99): Teleporter search beyond the exit window, cheaper in-tick hint (limit), End exit audit

## Summary
Does not claim full parity.
- `src/dimension-world.js`: `TerrainPeek.searchGet(x, y, z)` (new): the block as saved data alone knows it (edits, then a kept stored column), air elsewhere. Only valid for portal-block questions (terrain holds none, the premise `portalColumns` already relies on).
- `src/dimensions.js` `Teleporter.placeInExistingPortalSteps`: when the world lists its portal columns (`portalColumns`) and has `searchGet`, the 257 x 257 search's own reads (`visit`: the top-down scan and the drop to the stack bottom) go through `searchGet`. Before, `visit` read `get` for every y of a listed column, which builds that column's terrain: a saved portal outside the 8 x 8 exit window (the search reaches 128 blocks) made `arrivalTerrain` throw "not built", so no hint (and a page-thread column build in `arrive`). Same pick, no terrain read for the search.
- `src/spcopy99-b99.test.js` (3 tests).

## Item 1 evidence
- Port-read: `visit` -> `w.get` -> `TerrainPeek.column` -> `generateTerrainChunk`; `announceNow` terrain throws on a column outside the shell. Test 1: a decoy saved portal in a cell the shell lacks; hint arrives at the nearer portal. Test 3: same pick through `searchGet` and through `get`.
- Not covered / precise limit: after the pick the Teleporter reads terrain only within a few blocks of the picked portal (neighbours, the 2-block safe-side air checks) and, when no portal exists, `makePortal` reads a 33 x 33 area round the target. The shell window is focused on the picked portal (`savedPortalFor`, same rule as the search incl. cache hit), so those are covered; a destinationCoordinateCache entry whose portal has since been removed still focuses the cached spot, as native uses it unchecked. Native generates every column of the search (Bytecode-read, ahp.b via World.getBlock); the port needs none (portal blocks are edits).

## Item 2 (verdict: not possible beyond item 1)
The portal search no longer needs terrain at all. What remains for an existing linked portal is the neighbourhood of the picked portal (air checks beside the frame, solid floor not read). Generated Overworld terrain is not saved (chunked worlds keep edits only); the only saved heights are the imported-save `StoredIndex.tops` (top block per column, no block ids) and kept marker columns, which cannot answer "is this cell air" for generated terrain beside a player-built portal. So no cheaper exact source exists; a wait shorter than one cell build still gets the hint from `announceArrival` after the worker delivers (b98). I did not guess air from heights (would risk a wrong hint). Port-read.

## Item 3 (End to Overworld exit): audit
- Bytecode-read `mw.b(int)` (EntityPlayerMP.travelToDimension) with dimension 1 -> 1: triggers achievement `pc.D` (theEnd2), `ahb.e(sa)` (removeEntity, not removePlayerEntityDangerously), sets `i` (playerConqueredTheEnd), sends `gv(4, 0)` (change game state 4 = credits). No Teleporter and no copy at a scaled position: the port matches (`exit` skips `announceNow`/hint; `listSkip` false for the exit, as b92 recorded). Respawn after the credits uses the spawn point (bed/world spawn, `applyWrites` `this.exit` verifies the bed), not the Teleporter: matches.
- Port-read timing: `travel` saves, then `showCredits`, then opens the Overworld; the credits' wall time is not added to `tripMs`/`advanceTicks`. main.js already pauses the tick loop on the credits screen unless LAN is public (`lan.paused(true)`), i.e. the integrated-server-pause rule; I could not confirm `doesGuiPauseGame` of GuiWinGame in the obfuscated jar (string search for its resource found nothing), so that part stays Port-read and no change was made. A LAN-public host's credits time is therefore not added to the clock: open, unmeasured.

## Verification
- `node --test --test-concurrency=2 src/spcopy99-b99.test.js`: 3 pass; with `dimensions.js` reverted, test 1 fails (2 pass).
- Related list (54 files naming dimensions.js, dimension-world.js or dimension-live.js): 410 tests, 410 pass, 0 fail.
- No build (no new imports), no full `npm test`, no browser.

## Found wrong in the batch 98 list
- Nothing wrong; the "Teleporter read outside the 8 x 8 window" gap was real for the SEARCH (not only for the portal pick), now closed.

## Follow-ups
- LAN-public credits wall time not added to the world clock/away ticks (unmeasured).
- Hint still needs the picked portal's neighbourhood from the shell; no exact cheaper source (item 2).
- Browser-only: nothing seen.
