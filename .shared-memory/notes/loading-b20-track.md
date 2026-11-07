# Batch 20, track loading (native loading screens, non-blocking spawn)

## Summary
- `src/loading-screen.js`: LoadingScreenRenderer-style "Loading world" screen (dirt, bitmap font, native positions), GuiErrorScreen (gradient, Cancel), GuiDownloadTerrain and GuiScreenWorking factories, `LoadingState` (100 ms throttle), `SpawnAreaLog`.
- World start from the title screen shows the native message sequence "Loading world" / "Loading world", then "Building terrain". Load errors from the title screen use the error screen instead of the toast (in-game portal trips keep the toast).
- Spawn walk moved off the page thread: `spawn-presolve.js` + `spawn-worker.js` run `solveNativeSpawn` (same function as `nativeWorldSpawn`) and park the result in `presolvedSpawns`, which `generateJavaWorld` consumes. Also removes the walk from reopening saved generation 18/19 worlds. Synchronous fallback kept.
- Lang keys added to `menu-screens.js` LANG (through `t()`): menu.loadingLevel, menu.generatingTerrain, multiplayer.downloadingTerrain (gui.cancel existed).
- Doc: `public/research/loading-screens.md`. Shared hot files touched minimally: `main.js` (openWorld, 3 imports), `java-world.js` (cache + solve fn), `menu-screens.js` (3 LANG lines), `menu-screens.css` (error background, bar).

## Native evidence
- Bytecode-read (javap, none executed): `bbo` LoadingScreenRenderer, `bdh` GuiErrorScreen, `bdt` GuiScreenWorking, `bdu` GuiDownloadTerrain, `bao.launchIntegratedServer` and `loadWorld`, `MinecraftServer.loadAllWorlds/initialWorldChunkLoad/outputPercentRemaining`. Dumps in `tools/research/loading/` (ignored).
- Correction to the brief: natively "Preparing spawn area: N%" is only a server log line (`a_` writes two fields the client never reads); the client screen shows no percentage and no bar during the integrated start. The port prints the line to the console at the native one-second cadence (total 64 resident columns instead of 625 chunks) and does not draw it. `menu.savingLevel`/`menu.savingChunks` do not exist in 1.7.10's en_US.lang; quit-to-title natively shows a blank dirt screen (title "" and message "").
- No probe was added (nothing executed natively); the walk's own native evidence is batch 19's SpawnProbe.

## Tests
- `src/loading-screen.test.js` (9): layouts (loading/error/download/working), en_US strings, LoadingState sequence and throttle, SpawnAreaLog cadence, `spawnRequest` normalisation, `solveNativeSpawn` equal to the probed reference on 12 records (default/large/amplified/flat), presolved World constructor equal to the walked one (3 seeds, entry consumed), worker failure fallbacks.
- `npm test`: 4062 pass; `npm run build` passes. `world-spawn.test.js` unchanged and passing.
- Browser (muted headless Chrome, :5202, CDP :9402, profile deleted, servers stopped): create seed 4: "Loading world" 1.9 s with max frame gap 17 ms during the walk, "Building terrain" 0.9 s; seed 11 walk 0.15 s; reopen: same spawn/origin, 2.5 s + 1.8 s; error screen rendered and Cancel returned to the title. Screenshots in the scratchpad only (not committed).

## Remaining gaps
- `new World` still constructs and populates the 8 x 8 window synchronously (0.9 to 1.3 s) and the restore/storage/launch part adds 0.9 to 1.2 s: frames of 0.8 to 1.3 s remain during "Building terrain" (not the spawn walk). Next step: pre-build the cells in a worker and adopt them before the constructor, or slice `launch`.
- GuiScreenWorking and GuiDownloadTerrain exist but are unused; no save screen (natively blank).
- Boot overlay (`#loading` "Loading terrain"/failure text) still page HTML.

## Proposed remaining-gaps lines
- Loading screens: LoadingScreenRenderer "Loading world" / "Building terrain" screen and GuiErrorScreen for title-screen load failures are native-style (bytecode-read); the spawn walk runs in a worker. The World constructor's initial population (about 1 s) and launch (about 1 s) still freeze the page during "Building terrain". GuiScreenWorking and GuiDownloadTerrain are built but unused; the boot overlay is still page HTML.
- GUI catalogue: GuiErrorScreen now used (title-screen load errors); GuiScreenWorking built, not shown.
