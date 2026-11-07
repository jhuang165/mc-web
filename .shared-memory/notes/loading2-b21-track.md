# Batch 21, track loading2 (sliced world start, bonus chest at creation)

## Summary
- Resident-window population moved to the worker: `spawn-worker.js` builds population cell (0, 0) after the spawn (`solveResidentCell`, `java-world.js`), `presolveWorld` (`spawn-presolve.js`) parks it in `presolvedCells`, `generateJavaWorld` adopts it. `presolveSpawn` keeps its old signature (spawn only).
- `launch` meshes the 64 resident columns in 12 ms slices behind the loading screen: `scene.setWorld(world, { defer })` + `scene.buildPending(ms)`; only title-screen starts defer.
- Bonus chest placed during creation: new `src/bonus-world.js` (`bonusChestDue`, `placeBonusChest`), called from `openWorld` after the spawn and before `launch`; replaces the in-launch `placeBonusChest` in `main.js`. Tile handed to survival in `launch` through `pendingBonusChests`.
- GuiDownloadTerrain shown at the end of "Building terrain" (title-screen starts). GuiScreenWorking left unwired.
- Hot-file hunks: `main.js` (imports, openWorld, launch, removed old placeBonusChest), `java-world.js` (cell cache, adopt), `scene.js` (setWorld defer + buildPending). New: `bonus-world.js`, `bonus-world.test.js`. Docs: `public/research/loading-screens.md`, `superflat.md` bonus paragraph.

## Native evidence
- Bytecode-read (javap on the unchanged jar, nothing executed): `mt` = WorldServer: `b(ahj)` = createSpawnPosition ends with `if (ahj.c()) k()` (createBonusChest) after `setSpawn`; `a(ahj)` = initialize calls it before `ahb.a`. `bjb` = NetHandlerPlayClient: `a(hd)` join game and `a(hs)` respawn each `loadWorld` then `displayGuiScreen(new bdu)`; `a(fu)` (position/look) sets the first-packet flag and `displayGuiScreen(null)`. `bdu`: keyTyped empty, pause false, text at h/2 - 50. Only `brc` references `bdt` (GuiScreenWorking).
- Assumed: native duration of "Downloading terrain" in the integrated start (not probed); World.rand being unseeded (previous batch); that the page's meshing order is irrelevant (pure function of world data, covered by the equality tests for the world, not by a mesh diff).
- No new probe: the cell is the same `StreamingPopulation` class the prefetch worker already ran.

## Measurements (muted headless Chrome 1280x720, Vite dev server :5182, same machine and harness, PerformanceObserver longtask)
- Before (88e1158): seed 4 longest tasks 1307 ms and 961 ms; seed 11 1386 ms and 1171 ms; rAF gaps equal.
- After: seed 4 121, 126 ms (a busy-machine run 175 to 208); seed 11 147 ms. The remaining task is the light volume build in `launch`.

## Tests
- `src/bonus-world.test.js` (3): due conditions; chest, 10 slot writes in order and four torches against the native replay record on a live Superflat World; old records unchanged.
- `src/loading-screen.test.js` (+2): presolved cell gives identical 64 columns, biome ids, spawn, origin, cell records and `claimFreshColumns()` (default and Superflat) with zero generation on the page; spawn-only request builds no cell, mismatched origin is dropped, worker dying after the spawn keeps the spawn and falls back for the cell.
- `npm test`: 4163 pass, 0 fail; `npm run build` passes. Browser: created seed 4, 11 and a bonus-chest world (one chest, 8 to 9 stacks), saved, reloaded and reopened: same chest, no second one; screen sequence Loading world, Building terrain, Downloading terrain, game.

## Remaining gaps
- Light volume build (about 120 to 150 ms) not sliced; `LightVolume.relight` is a whole-window flood.
- Portal trips: no GuiDownloadTerrain, no slicing. Generation 13 to 17 saves keep the synchronous constructor population.
- GuiScreenWorking has no native counterpart in this flow (save-format conversion only) and stays unwired.
- Download-terrain duration is assumed.

## Proposed remaining-gaps lines
- World loading (batch 21, [loading-screens.md](loading-screens.md)): the resident window is built in the worker and the column meshes are built in 12 ms slices; the longest remaining main-thread task during creation is the light volume build (about 120 to 150 ms, was 1.3 s and 1.0 s). GuiDownloadTerrain is shown after "Building terrain" (bytecode-read join/respawn handlers; duration assumed). Open: portal trips show no download screen and are not sliced, generation 13 to 17 saves still populate in the constructor, GuiScreenWorking is unwired (no native screen in this flow), the boot overlay is page HTML.
- Bonus chest: now placed during world creation (WorldServer.createSpawnPosition order, bytecode-read); contents and placement replayed; the Random is unseeded so native contents differ per creation.
