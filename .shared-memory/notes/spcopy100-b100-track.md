# spcopy100 (batch 100): which screens pause the integrated server, End credits clock under a public LAN server

## Summary
Does not claim full parity.
- `src/screen-pause.js` (new): table of `GuiScreen.doesGuiPauseGame` per screen kind, `screenKind` (port screen state to native kind), `gamePaused` (Minecraft.isGamePaused: singleplayer, pausing screen, server not public) and `TickClock` (updateScreen ticks while the world loop is stopped).
- `src/main.js` (shared, 4 small hunks): import; `running()` now `!gamePaused({...})` (before: every "inventory" state ran, so a sign editor, book and command block screen never stopped the world); `else if (screen === "inventory") pausedGui.run(dt, () => gui.tick())` so the sign editor blink still counts ticks while paused; `const pausedGui`; host `creditsRuns: () => lan.public`. The `main.js` lines are code-read only (not importable).
- `src/dimension-live.js` `travel`: for the End exit, with `creditsRuns()` true (public LAN) the credits' wall time is added to `away.tripMs` (before `finishAway`) and to `advanceTicks`, like a loading screen. Paused (default): unchanged.
- `src/spcopy100-b100.test.js` (6 tests).

## Item 1 (credits): native pauses, unless LAN public
- Bytecode-read: GuiWinGame = `beg` (only class with "end.txt"); `beg.d()` (doesGuiPauseGame) is `iconst_1`. `bao.runTick` (offset 557-597): `T = G() && n != null && n.d() && !X.a()` (isSingleplayer, currentScreen, doesGuiPauseGame, !IntegratedServer.getPublic). `bsx.u` (IntegratedServer.tick) reads `bao.V()` into `l`, on pause start logs "Saving and pausing game..." and saves, and skips `MinecraftServer.tick` while `l`.
- Port: credits already stopped the loop always (`running()` had no credits case); the lan.paused rule was only in music. Divergence found: with a public LAN server native keeps ticking during the credits, the port added no time. Fixed as clock credit afterwards (the world is mid-trip during the credits, so it is not ticked live). Port-read, tested with a fake host (credits 200 ms: tripMs >= 190, advanceTicks >= 4; paused or no host hook: 0).

## Item 2 (other screens): bytecode-read `d()` of every GuiScreen subclass
- Default `bdw.d()` = true. Overrides false: GuiChat `bct`, GuiGameOver `bdc` (strings deathScreen.*), GuiDownloadTerrain `bdu`, GuiContainer `bex` (all container and creative screens). GuiSleepMP `bdi` extends `bct`.
- True (inherit or explicit): GuiWinGame `beg`, GuiEditSign `bfx`, GuiScreenBook `bfe`, GuiCommandBlock `bfh`, GuiIngameMenu `bdp`, GuiYesNo, options screens.
- Port divergence fixed: sign editor, book and command block screens (all state "inventory") ran the world; now they pause in single player unless LAN is public or multiplayer. Chat, sleep and containers still run (native).
- Not fixed, open: GuiGameOver pauses nothing natively, but the port's "dead" branch stops the world (only deathTime, effects, body tick). A full tick on the death screen needs the whole running loop to cope with a dead player (b26 playerpose note already lists it). GuiDownloadTerrain: port loading screens are not a tick loop.
- The Game menu's own `gui.tick` is still not run while paused (no ticking widget there); `tickMusic` still uses `lan.paused` itself.

## Item 3 (terrain beside the picked portal): no exact source
Unchanged from b99 item 2: generated Overworld terrain is not stored, only edits and `StoredIndex.tops` (no block ids), so "is this cell air" beside a player-built portal cannot be answered without the worker. Left open.

## Verification
- `node --test --test-concurrency=2 src/spcopy100-b100.test.js`: 6 pass; with `dimension-live.js` reverted, 5 pass 1 fail (credits clock).
- Related list (30 files naming dimension-live, lan.js or screen-pause): 237 tests, 237 pass, 0 fail.
- No build (the new import is plain), no full `npm test`, no browser. (One accidental whole-suite start from an empty list was stopped by me within seconds.)

## Follow-ups
- Death screen should tick the world (native GuiGameOver does not pause).
- Browser-only: sign/book/command block pausing, the sign blink while paused, credits with a public LAN server.
