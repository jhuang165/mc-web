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
- `workingScreen` (GuiScreenWorking) and `downloadTerrainScreen` (GuiDownloadTerrain) are built and tested but not shown anywhere yet.

## Browser check (muted headless Chrome 1280 x 720, Vite on :5202)
- New default world, seed 4 (the slowest reference seed, a 241-step walk, about 1 s of walking in Node, 1.9 s in the worker including its start):
  the screen read "Loading world / Loading world" for 1.9 s while no animation frame was longer than 17 ms, then "Building terrain" for
  0.9 s, then the game. Spawn (-710, 64, 569), origin (-784, 496), generation 18, no console errors.
- Seed 11: the walk finished within 0.15 s; "Building terrain" 2.5 s.
- Reopening that saved seed-4 world: the same spawn and origin, sequence "Loading world" 2.5 s then "Building terrain" 1.8 s.
- Error screen forced by making `dims.createWorld` throw: the gradient, centred title, wrapped message and Cancel button render and Cancel returns to the title screen.
- Frames longer than 100 ms remain, all after the spawn walk: the `World` constructor populates the 8 x 8 window synchronously (0.9 to 1.3 s on seed 4/11, 1 s in
  Node) and the post-construction restore/storage/launch work adds 0.9 to 1.2 s. The screen is static during those; they are the next thing to move off the page thread.

## Gaps
- The `World` constructor's initial population and `launch` still block the page for about 1 to 2 s total; only the spawn walk moved.
- No progress bar is shown (natively none either); the console percentage is coarse.
- GuiScreenWorking and GuiDownloadTerrain are not wired (the port has no conversion step; portal arrival uses no screen); no save screen on quit (natively blank).
- Boot failure still uses the page overlay's HTML text.
