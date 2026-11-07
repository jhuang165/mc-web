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

## Gaps
- The light volume build (about 120 to 150 ms in one task) still runs on the page thread inside `launch`; `LightVolume.relight` floods the whole window and is not split.
- Reopening saved generation 18 and 19 worlds uses the worker for the spawn and the cell as well; generation 13 to 17 saves have no worker spawn and still build their window in the constructor.
- Portal trips (dimension changes) neither show GuiDownloadTerrain nor slice their work.
- No progress bar is shown (natively none either); the console percentage is coarse.
- No save screen on quit (natively blank).
- Boot failure still uses the page overlay's HTML text.
