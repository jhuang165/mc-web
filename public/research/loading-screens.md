# Loading screens and non-blocking world creation (1.7.10)

Target: Minecraft Java 1.7.10 (client SHA-1 `e80d9b3b...`). Parity with 1.7.10 is not claimed. Code: `src/loading-screen.js`
(screens, layouts, `LoadingState`, `SpawnAreaLog`), `src/spawn-presolve.js` + `src/spawn-worker.js` (off-thread spawn walk),
`solveNativeSpawn` / `presolvedSpawns` in `src/java-world.js`, `openWorld` in `src/main.js`. Test: `src/loading-screen.test.js`.
Javap dumps of the classes read are in the ignored research folder `loading/` (`bbo`, `bdh`, `bdt`, `bdu`, `bao`, `bsx`, `MinecraftServer`).

## Evidence: bytecode-read only (javap, nothing here was executed natively)
- `LoadingScreenRenderer` (`bbo`): `displayProgressMessage(s)` (`a`) sets the title field and `resetProgresAndWorkingMessage(s)` (`c`)
  sets the message field and calls `setLoadingProgress(-1)`. Drawing happens in the scaled GUI space. Background: `options_background`
  quads 32 units per tile, colour 0x404040 (the same as the menus' dirt: 25 % brightness). Title: drawStringWithShadow white at
  `(w - width) / 2, h / 2 - 4 - 16`; message at `h / 2 - 4 + 8`. The bar (progress >= 0 only): 100 x 2 units, x = `w / 2 - 50`,
  y = `h / 2 + 16`, track 0x808080, fill 0x80FF80 `progress` wide. `setLoadingProgress` returns without drawing when less than 100 ms
  passed since the last drawn frame; `resetProgresAndWorkingMessage` zeroes that timestamp.
- `Minecraft.launchIntegratedServer` (`bao`): `loadingScreen.displayProgressMessage(I18n "menu.loadingLevel")`, then until the server runs it
  polls `IntegratedServer.getUserMessage()` every 200 ms and calls `resetProgresAndWorkingMessage(I18n of it, or "" when null)`.
  The title therefore stays "Loading world"; the message is the server's user message.
- `MinecraftServer.loadAllWorlds` sets the user message `menu.loadingLevel` (or `menu.convertingLevel`), `initialWorldChunkLoad` sets
  `menu.generatingTerrain` and loads a 25 x 25 chunk square (625 chunks, -192..192 step 16 around the spawn) calling
  `outputPercentRemaining("Preparing spawn area", i * 100 / 625)` at most once a second.
- Finding that corrects the track brief: `outputPercentRemaining` (`a_`) only stores the text and percent in two fields and logs
  `"Preparing spawn area: N%"` through log4j. The client never reads them (it polls the user message `Q`, which the call does not touch),
  and it never calls `setLoadingProgress` during the integrated start, so natively there is no progress bar and no percentage on screen:
  just "Loading world" over "Loading world", then over "Building terrain". The port copies that: the percentage is printed to the console
  (`SpawnAreaLog`, at most once a second, `i * 100 / total` truncated) and the bar code exists (`BAR`, `LoadingState.setLoadingProgress`
  with the 100 ms throttle) but is not driven by the integrated start.
- Mapping of the console percentage: the port's resident window is 8 x 8 = 64 columns (not the native 625 chunks), so the total passed to
  `SpawnAreaLog` is 64 and the value is `resident columns * 100 / 64`. It prints 0 % when the terrain stage starts and 100 % when the window
  is built; the intermediate values are rarely seen because the window is populated inside the `World` constructor (see Gaps).
- `GuiErrorScreen` (`bdh`): `drawGradientRect(0, 0, w, h, 0xFF402020, 0xFF501010)`, title centred at y 90, message at y 110 (both white, shadow),
  a `gui.cancel` 200 x 20 button at `(w / 2 - 100, 140)`; `keyTyped` is empty (Escape does nothing); the button does `displayGuiScreen(null)`.
  Batch 25: GuiSelectWorld (`bdx.initGui`) catches a `loadSaves` failure with `new GuiErrorScreen("Unable to load worlds", e.getMessage())`; the
  port shows the same screen when the boot-time `readWorldShelf` fails, and does not rewrite the shelf while it could not be read (no retry until reload).
- `GuiScreenWorking` (`bdt`): `displayProgressMessage` sets the title (and the message "Working..."), `resetProgresAndWorkingMessage` sets the line and progress 0,
  `setLoadingProgress` the percent, `drawDefaultBackground`, title at y 70, `"<line> <progress>%"` at y 90. `GuiDownloadTerrain` (`bdu`):
  `drawBackground`, `multiplayer.downloadingTerrain` centred at `(w / 2, h / 2 - 50)`, no buttons, sends a keep-alive-style packet every 20 ticks.
- Quit to title: `GuiIngameMenu` ends in `Minecraft.loadWorld(null)` which draws `displayProgressMessage("")` and an empty message; the
  "Saving chunks for level" / "Saving players" / "Saving worlds" strings in `MinecraftServer` are log lines only. The jar's `en_US.lang` has no
  `menu.savingLevel` or `menu.savingChunks` (checked), so there is no text for a save screen. The port saves on quit without a screen.
- Lang keys used (verified in the jar's `en_US.lang`): `menu.loadingLevel` = Loading world, `menu.generatingTerrain` = Building terrain,
  `multiplayer.downloadingTerrain` = Downloading terrain, `gui.cancel` = Cancel. They live in `menu-screens.js` `LANG` and go through `t()`, so a
  selected language replaces them. The `Could not open this world` title and the error message are the port's own wording (natively these
  texts are hardcoded in their callers, not lang keys).

## What the port does
- Starting a world from the title screen (`openWorld`, Play Selected World, Create New World, re-create, imports) shows `loadingScreen`
  (`id: "loading"`, dirt background, centred title and message in the bitmap font). The browser overlay "Loading terrain" remains only as the
  page boot cover before the GUI exists. Portal trips between dimensions keep the game on screen and do not show the screen.
- Stage order: "Loading world" while the spawn walk runs, "Building terrain" while the `World` is constructed and populated and the saved
  columns are read; `launch` then hides the GUI.
- The spawn walk no longer blocks: `presolveSpawn(record)` runs `solveNativeSpawn` (the same `nativeWorldSpawn` over a fresh generator) in a
  dedicated module worker and parks the result in `presolvedSpawns`; `generateJavaWorld` consumes it (keyed by seed, generation, world type
  and normalised options) instead of walking. Without Worker support or when the worker fails/times out (60 s) nothing is parked and the constructor
  walks synchronously as before. It also covers reopening a saved generation 18/19 world, whose constructor re-ran the walk each time.
  Results are identical (replayed: `solveNativeSpawn` equals the probed reference on 12 records, and the constructor's spawn and origin are equal
  with and without a presolved result).
- Load errors from the title screen use `errorScreen` (red gradient, title, wrapped message, Cancel back to the title screen) instead of the toast;
  loads started in-game (portal trips) keep the toast.
- `workingScreen` (GuiScreenWorking) is built and tested but not shown; `downloadTerrainScreen` (GuiDownloadTerrain) is shown since batch 21 (below).

## Browser check (muted headless Chrome 1280 x 720, Vite on :5202)
- New default world, seed 4 (the slowest reference seed, a 241-step walk, about 1 s of walking in Node, 1.9 s in the worker including its start):
  the screen read "Loading world / Loading world" for 1.9 s while no animation frame was longer than 17 ms, then "Building terrain" for
  0.9 s, then the game. Spawn (-710, 64, 569), origin (-784, 496), generation 18, no console errors.
- Seed 11: the walk finished within 0.15 s; "Building terrain" 2.5 s.
- Reopening that saved seed-4 world: the same spawn and origin, sequence "Loading world" 2.5 s then "Building terrain" 1.8 s.
- Error screen forced by making `dims.createWorld` throw: the gradient, centred title, wrapped message and Cancel button render and Cancel returns to the title screen.
- Frames longer than 100 ms remain, all after the spawn walk: the `World` constructor populates the 8 x 8 window synchronously (0.9 to 1.3 s on seed 4/11, 1 s in
  Node) and the post-construction restore/storage/launch work adds 0.9 to 1.2 s. The screen is static during those; they are the next thing to move off the page thread.

## Batch 21: the freezes during "Building terrain" are sliced
- Before (batch 20, measured again in batch 21 on the same machine with the same harness, muted headless Chrome 1280 x 720, Vite dev server): seed 4 had main-thread tasks of 1307 ms
  (the `World` constructor populating the 8 x 8 window) and 961 ms (`launch`: light volume plus 64 column meshes); seed 11 had 1386 ms and 1171 ms.
- The resident window is exactly population cell (0, 0) (`CELL` is 8 and the origin is chosen so the window starts at a cell edge). `spawn-worker.js` now posts the spawn, then
  builds that cell with `solveResidentCell` (same `StreamingPopulation.export` the prefetch worker already uses) and posts its buffers with a transfer list. `presolveWorld`
  (`spawn-presolve.js`) parks the cell in `presolvedCells`, keyed like the spawn; `generateJavaWorld` calls `population.adopt(cell)` when the origin matches, so the constructor's 64-column copy
  finds the cell and generates nothing (`population.generated === 0`). Only the 64 `Uint8Array` pairs are copied on the page thread. The screen switches to "Building terrain" as soon as the spawn
  arrives, so that stage now covers the worker building the window.
- `launch` from the title screen calls `scene.setWorld(world, { defer: true })`, which queues the resident columns in `pendingBuild`; `openWorld` then shows `downloadTerrainScreen` and `launch` builds the meshes
  12 ms at a time with a paint between slices (`scene.buildPending`) before it hides the GUI. Meshing is a pure function of the world data, so the order and timing change nothing; a column rebuilt meanwhile by an edit is skipped.
  Portal trips and every other caller keep the synchronous build.
- After: the longest main-thread task during creation is the light volume build (`StreamingLight`, `LightVolume.relight` over the whole window, not sliced): 121 to 147 ms on seed 4 and 11
  (three runs; one 175 to 208 ms run while the machine was busy). No other task over 100 ms, `Loading world`, `Building terrain` and `Downloading terrain` all repaint. Seed 4: "Building terrain" from 1.0 s to 2.0 s,
  "Downloading terrain" about 1.4 s (slices), total about 3.4 s against 4.0 s before.
- Equality: tests build the same world with and without the presolved cell (3 generator records: default seed, Superflat, plus a mismatched-origin cell that is dropped) and compare all 64 columns' blocks and metadata,
  biome ids, spawn, origin, the cell's records and `claimFreshColumns()`. Worlds below generation 18 (no worker spawn) and any worker failure take the old synchronous path.
- GuiDownloadTerrain is now shown: bytecode-read (`bjb` = NetHandlerPlayClient): `handleJoinGame` (`a(hd)`) and `handleRespawn` (`a(hs)`) both do `loadWorld` then `displayGuiScreen(new GuiDownloadTerrain(this))`, and the
  player position/look handler (`a(fu)`) sets a first-packet flag and calls `displayGuiScreen(null)`. In single player the integrated server logs the player in through the same handler (`launchIntegratedServer`
  connects with `provideLocalClient`), so "Downloading terrain" follows "Building terrain" natively. Its draw (`bdu`) is the dirt background and the string at `h / 2 - 50`, `keyTyped` is empty, `doesGuiPauseGame` is false. The port shows it
  from the end of "Building terrain" until the column meshes are built and the player is placed. The native duration is assumed (not probed): a few client ticks of packet exchange, longer when the server is busy.
- Not wired: portal trips. Natively `handleRespawn` shows GuiDownloadTerrain for a dimension change as well; the port keeps the game on screen there because showing a GUI mid-game also pauses input and the loop, so this stays a gap.
  GuiScreenWorking has no counterpart in this flow: bytecode-read, the only class referencing `bdt` besides itself is `brc` (the save-format list); the conversion progress goes to the server's `outputPercentRemaining`
  log line, never a screen, in the integrated start; the port has no world conversion either. It stays built and unused.

## Batch 22: light slicing, portal-trip screens, generation 13 to 17 presolve
- Light: `LightVolume` and `StreamingLight` take `{ defer }`; `buildSteps()` and `relightSteps()` are generators that yield per x column in the setup, sky-seed, inflow and diff loops and every 4096 queue
  entries in the flood. `relight()` is `drain(relightSteps())`, so the synchronous result is the same. `scene.setWorld(world, { defer })` queues `buildSteps()`; `launch` runs `scene.buildLight(12)` with a frame between slices.
  Sky, block and height arrays were compared with the previous implementation on seeds 4, 11 and 17 (probed, temporary script) and `light-slicing.test.js` keeps the stepped-equals-drained checks.
- Portal and dimension trips: bytecode-read (`bjb.a(hs)`, handleRespawn, see batch 21) does `loadWorld(world, "")` - one blank LoadingScreenRenderer frame (empty title and message) - then GuiDownloadTerrain, only when
  the dimension changed. `openWorld` for a trip now shows one blank frame (`blankLoading`, `travel-loading.js`) then `downloadTerrainScreen` for the whole transfer. While the screen is up the game is paused
  (`screen = "home"`, `tripLoading` keeps the in-world music); if the transfer throws, the old world is restored and a toast shown. The Stage lines of the new-world path are not shown (natively none).
- Slicing: `Teleporter.placeInPortalSteps`, `placeInExistingPortalSteps` and `makePortalSteps` yield per column; the old methods drain them (the 36 native replay records still pass). The 257 x 257 portal search was
  the freeze: `TerrainPeek.portalColumns` lists the columns that can hold a portal (assumed invariant, not probed: terrain never contains a portal block, so portals a peek sees come from its edits) and the search visits only those, in the same x-then-z order.
  `arrivalWarmer` builds the terrain the synchronous readers will touch ahead of them: Overworld cells through a `StreamPrefetch` worker (`whenHas`), Nether/End columns on the page into `pregenerated` in 12 ms slices.
  The End's dragon crystals (`endCrystalSteps`, 441 chunk populations, 0.4 s) are sliced in `launch` too.
- Measurements (muted headless Chrome 1280x720, Vite dev server, longtask observer, own profile and DevTools port; before = main at 674d91b):
  - World creation longest task: seed 4 117 ms -> 66 ms (runs 0 to 66); seed 11 202 ms -> 65 to 82 ms.
  - Overworld -> Nether trip: seed 4 5259 ms -> no task over 97 ms (3.4 s wall); seed 11 6932 ms -> 109 ms once, otherwise under 100 ms.
  - Nether -> Overworld: seed 4 12900 ms and 1752 ms -> 55 ms max (8.3 s wall, the worker building population cells); seed 11 19012 ms -> 65 ms.
  - End trip (seed 4): 421 ms and 129 ms tasks before the crystals were sliced, none afterwards over 3 runs (1.6 s wall); End exit: none (3.6 s wall). End before-numbers were not measured.
  - The screen sequence in all trips: blank frame at 8 to 450 ms, then "Downloading terrain" until the arrival.
- Generation 13 to 17 saves: `spawn-worker.js` now also handles them. `solveLegacySpawn` runs the constructor's own `findBiomePosition(0, 0, 256, ...)`, `solveResidentCell` builds cell (0, 0) for that origin,
  and `generateJavaWorld` adopts it when the origin matches (otherwise it is dropped). Generation 12 has no population and Superflat starts at 15, so those are not presolved. Equality tests compare 64 columns, biome ids, origin,
  cell records and `claimFreshColumns()` for generations 13, 15 (Superflat), 16 (amplified) and 17, plus a mismatched-origin cell.

## Gaps
- Light: sliced, but each slice still runs on the page thread (identical results); no worker light.
- Portal trips depend on the `portalColumns` invariant (assumed); a future structure that places portal blocks in terrain would need `portalColumns` removed or extended.
- The Overworld return trip still takes about 8 s wall (worker population cells); the screen stays live and no frame exceeds 100 ms. Native duration is assumed.
- The native download-terrain duration is assumed in every path.
- Console output during trips was not collected by the harness.
- No progress bar is shown (natively none either); the console percentage is coarse.
- No save screen on quit (natively blank).
- Boot failure still uses the page overlay's HTML text.

## Batch 28: dimension trips off the page thread
Gameplay and generated data are unchanged (workers run the same `DimensionWorld.netherChunk`/`endChunk` and `StreamingPopulation.export`); only where the work runs changed. Muted headless Chrome 1280x800, vite dev server, `artifacts/b28-dimperf/trip.mjs` (new world, 8 s idle, then Nether, Overworld, End, Overworld; long-task observer; ring size polled every 0.5 s). Numbers are from two or three runs each; the machine has 18 cores.
- Causes found: the Nether/End ring generated one column every other tick on the page (`createRing` with a `generate` source, 40-60 ms each): that was the 50-164 ms long-task train (53 tasks over 50 ms in 45 s) and the 44 s ring fill (28-30 s in earlier measures). The window shift and the arrival warm-up also generated Nether columns on the page (`chunk` in `nether-generator.js`, `pathCost`). The Overworld return waited on three population cells built one after another by a single worker (5.1 s of the 8 s).
- Changes: `createStreamWorker` accepts `dimension`/`dimensionSeed` and builds Nether/End columns in a worker (a Nether column's chest/spawner records ride along and are adopted on the page unless the column is already materialized); `StreamPrefetch` takes `ringPorts`, extra workers that only build ring columns (up to 3, `hardwareConcurrency - 3`), for every dimension; `startPrefetch` runs for the Nether/End; `arrivalWarmer` asks workers for Nether/End columns and deals a large request (cells or columns) over up to 3 workers; `HeadlessColumns.units()` returns nothing before the ring is centred.
- Before (main 7b67a97, 2 runs) vs after (6 runs):

| | before | after |
|---|---|---|
| Nether: tasks over 50 ms, first ~50 s | 53 (max 164 ms) and 9 (max 261 ms) | 1-4 (max 61-85 ms) |
| Nether ring (441 columns) | 44 s | 8-10 s |
| End ring | 44 s | 6.5-7 s |
| End trip long tasks | none | 0-1 (max 60-122 ms) |
| Overworld return from the Nether, wall | 8.1 s (5.4 s in one run) | 4.5-6.9 s (4.5 s in the last run) |
| Overworld ring after return | 10.6-12.6 s | 3.5-5.7 s |

- Remaining: an End-to-Overworld return sometimes (about one run in three, before and after) shows a train of 70-170 ms tasks for 1-3 s, about 9-16 s after arrival, once the ring is complete; the profile points at spawn-side ring reads (`canLightningStrikeAt`, `RingLight` `heightAt`/`search`), not at loading. The 1.3 s first Nether arrival task from the page (`launch`: meshes, light) stays near 60-70 ms. A one-off 1.1 s task seen in one run (first run after a source edit) did not repeat.

## Batch 29: arrival and return time, idle workers
Gameplay and generated data are unchanged (same columns, same game state); only when and where the work runs changed. Muted headless Chrome 1280x800, vite dev server, `artifacts/b29-dimperf2/trip.mjs` (new world, 8 s idle, then Nether, Overworld, End, Overworld), three runs each, baseline run on a clean copy of 0.57.0 (port 5396) interleaved with the changed tree (5296); the `trip:*` marks in `main.js` (`performance.mark`) time the phases.
- Where a return spent its time (Nether to Overworld, 4.1-4.6 s): the spawn walk and resident cell 1.1-1.9 s, the Teleporter and the window cells 1.3 s, light 0.15 s, column meshes 1.5-1.8 s. A column mesh costs about 22 ms (Overworld and Nether, 42-44 ms worst, End 8 ms), 64 columns, so meshing is CPU-bound once nothing waits between slices.
- Changes: (1) the Overworld's `presolveWorld` runs when a Nether/End world launches (not below 4 cores), so a return finds the spawn cell parked in `presolvedCells` instead of waiting for it; (2) `taskPause` (`steps.js`) replaces `nextPaint`/`nextFrame` between mesh, light and Teleporter slices: a MessageChannel task, with a real frame at least every 100 ms (a mesh slice cost 12 ms of work per two frames, 33 ms, before); (3) the random-tick refcounts of the resident columns (`WorldChunk.sectionTickCount`, 20-40 ms on the first tick after arrival) are counted in 8 ms slices at the end of launch; (4) ring workers: `StreamPrefetch` takes `ringSpawn`/`ringMax` (`hardwareConcurrency - 3`, at most 3, none up to 3 cores where batch 28 always made one; the main worker then serves the ring when idle), starts them with the prefetch, ends them after `RING_IDLE_TICKS` (100) updates with the ring complete, and makes them again when ring units stay unserved for 3 updates.
- Before (3 runs) and after (3 runs, final tree):

| | before | after |
|---|---|---|
| Nether trip wall | 2.2-2.8 s | 1.75-1.9 s |
| Overworld return from the Nether, wall | 3.8-4.6 s | 2.2-2.6 s |
| End trip wall | 1.2-1.4 s | 1.1 s |
| Overworld return from the End, wall | 2.8-3.3 s | 1.1-1.4 s |
| Tasks over 50 ms during the arrival (Nether/End) | 0-1 (max 59) | 0 |
| Tasks over 50 ms during the arrival (Overworld returns) | 0-1 (max 55) | 0-1 (max 56) |
| Nether / End ring (441 columns) | 7-7.6 s / 6.5-7.1 s | 7-7.5 s / 6.5-6.6 s |
| Overworld ring after a return | 2.5-4.1 s | 2.5-3.6 s |
| Workers once the ring is full | 4 (44-57 MB JS heap, 8-12 MB each) | 1 (11-12 MB) |

- Worker memory: per-worker JS heap through CDP `Runtime.getHeapUsage` on each worker target (`mem.mjs`); `performance.measureUserAgentSpecificMemory` needs cross-origin isolation, which the dev server does not set, and the renderer's RSS cannot be split by thread. The isolate and thread overhead of an ended worker is not in these numbers.
- Return waits that remain: the Teleporter's window cells (1.0-1.3 s, three workers), a second window fetch when the Teleporter moves the player to another cell (about 1.3 s; queueing the neighbouring windows behind the first made it slower, 4.5 s extra, and was dropped), and the column meshes. Meshing in a worker is the next cut.
- Not fixed here (ringlight track): after a return, mostly End to Overworld, a train of 60-200 ms tasks runs for 1-8 s once the ring is complete (`HeadlessColumns.search`/`heightAt` and `canLightningStrikeAt` with biome-layer `getInts`). It also showed on a new world (1 in about 20 loads on the changed tree, 0 in 12 on the baseline, too few to compare). 3 of 6 final-tree End returns showed 3-13 tasks of 50-100 ms.
- The 1.1 s task after a source edit (batch 28): not seen again in about 40 dev loads, and in three `vite build` + `vite preview` runs (new world, 20 s) the longest task after load was 140 ms (the first two, 94-97 and 133-140 ms at 0.3-0.5 s, are page start-up), so it is consistent with dev-server dependency optimisation or HMR. `window.__mc` is dev-only, so trips cannot be driven in the production build with `trip.mjs`.

## Batch 30 (mesh worker pool, End shader warm-up)

- Column meshes are built in a worker pool (`mesh-pool.js`, `mesh-worker.js`, up to min(3, cores - 2) workers) from a snapshot of the column plus 2 cells on every side (blocks, metadata, sky and block light, biome palette, lit furnaces and repeaters, flower pots, fancy/AO/anaglyph options). The worker runs the same `ChunkMesher` code (`chunk-mesher.js`) and returns transferable typed arrays; the page only builds the buffers. `?meshWorkers=0` or no `Worker` keeps the page-thread mesher. Live edits (`updateBlock`) still mesh on the page thread at once; a result that is stale (world change, a sync rebuild of the same column, a newer dirty stamp) is dropped or re-queued.
- Byte identity: `mesh-worker.test.js` compares the page mesher and the snapshot path (strict reads) over fluids, fancy/fast leaves, AO on/off, the anaglyph multiplier, Nether and End columns; in Chrome 64 columns (239 layers, 668,516 vertices) differed by 0 values.
- Fixed on the way: the mesher's `endFrame` was shadowed by `VoxelScene.endFrame`, so End portal frames were never meshed; the mesh method is now `endFrameBlock`.
- The End's sky/portal programs are linked behind the loading screen (`scene.warmShaders()`, `renderer.compileAsync`) while the workers mesh; the image is unchanged.
- Measured (muted headless Chrome, load average 45-80 from other tracks, so absolute times are inflated), three trips each, page-thread mesher against workers: Nether 3.4-3.6 s to 1.9 s; Overworld return 5.5 s to 2.6-2.8 s; End 1.6-1.8 s to 1.35 s; second Overworld return 2.0-2.2 s to 0.8-0.9 s. Tasks over 50 ms during the arrival: 1-3 (return 12-14 in two of three) to 0-2. Walking 120 blocks: frames over 50 ms 72/63 to 40/44, tasks over 50 ms 82/76 to 42/50.
- Teleporter second window fetch: seen once in three instrumented returns (1.9 s, when the placed player was in another population cell than the target); in the others it cost 1 ms. Not fixed: the cell is only known after the search.
