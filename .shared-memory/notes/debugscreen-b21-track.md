# Batch 21 debugscreen track (claude-b21-debugscreen)

## Summary
F3 now draws the native 1.7.10 GuiIngame debug overlay instead of the custom BLOCKWORLD text: left column (title with fps and chunk updates, C/F/O/E, E/B/I, P/T, MultiplayerChunkCache, x/y/z with chunk coordinates, f facing, lc/b/bl/sl/rl, ws/fs/g/fl), right memory lines, no background, white then 0xE0E0E0 with shadow at the bytecode y positions. Shift+F3 draws the profiler pie with digit navigation. New `src/debug-overlay.js`; small hunks in `src/main.js` (import, `clientProfiler`/`tickProf`, F3 key, frame hooks, the update call) and one counter line in `src/scene.js`.

## Native evidence
bytecode-read (javap on bbv, bao, bma, bkn, bjd, ahb, qh, qj, yw, p): all format strings, y positions, colours, F3 combos, pie geometry, digit keys. See `public/research/debug-screen-reference.json` and `debug-screen.md`. No lagometer in 1.7.10 (bbj.ay is only read by bao).

## Tests
`src/debug-overlay.test.js` (11 tests): facing names, yaw wrap and Float.toString, port-to-native yaw, chunk-coordinate floor math, light line, ws/fs line, renderer/entity/particle/cache lines, left column order/y/colours, memory lines, pie colours/navigation/model. Headless Chrome (port 5187, muted) check in a created world; screenshots in `artifacts/b21-debugscreen/`.

## Remaining gaps
- Chunk updates, C/F/O/E and E/B/I are approximations (see debug-screen.md); no occlusion culling numbers.
- Memory is performance.memory (Chromium only).
- F3+B hitboxes, F3+S/T resource reload, F3+C crash not ported; shader line (y 112) not drawn.
- The pie profiles the port's frame phases, not the 1.7.10 client sections (gameRenderer, level, ...).
- The overlay is drawn only while the game screen is `playing` (native also draws over GUIs).

## Proposed remaining-gaps lines
- F3 debug screen: native text, positions and Shift+F3 pie ported; renderer/entity/chunk-update counts are approximations; F3+B hitboxes, F3+S/T and F3+C not ported.
