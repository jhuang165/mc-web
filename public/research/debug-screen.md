# F3 debug screen (batch 21)

Target: Minecraft Java 1.7.10. Every format string, position and colour is in `debug-screen-reference.json` (bytecode-read with javap from GuiIngame `bbv.a`, Minecraft `bao`, RenderGlobal `bma`). Full parity is not claimed.

## What the port draws

Left column, GUI-scaled pixels, drawStringWithShadow, no background box (bytecode-read):

| y | Colour | Text |
|---|---|---|
| 2 | white | `Minecraft 1.7.10 (N fps, M chunk updates)` |
| 12 | white | `C: rendered/loaded. F: clipped, O: occluded, E: skipping` |
| 22 | white | `E: rendered/total. B: hidden, I: total-hidden-rendered` |
| 32 | white | `P: particles. T: All: entities` |
| 42 | white | `MultiplayerChunkCache: n, n` |
| 64/72/80 | 0xE0E0E0 | `x: %.5f (%d) // c: %d (%d)`, `y: %.3f (feet pos, %.3f eyes pos)`, `z: ...` |
| 88 | 0xE0E0E0 | `f: <0-3> (SOUTH/WEST/NORTH/EAST) / <wrapped yaw as Float.toString>` |
| 96 | 0xE0E0E0 | `lc: <top segment + 15> b: <biome> bl: sl: rl:` (only with the chunk loaded and 0 <= y < 256) |
| 104 | 0xE0E0E0 | `ws: 0.100, fs: 0.050, g: true, fl: <height>` |

Right column, right aligned at `scaledWidth - width - 2`: `Used memory: x% (yMB) of zMB` (y 2) and `Allocated memory: x% (yMB)` (y 12).

Shift+F3 (Shift held when F3 goes down) draws the Profiler pie in raw pixels: black 200/255 panel, ellipse sectors with side walls, labels `[0]root`, `[n]name`, `[?]unspecified`, percentages. Digit 0 goes up, 1-9 descend, as in `Minecraft.b(int)`. The port's pie reads a second Profiler over the frame: `root.tick` (particles, tick, bed, effects, player phases, shared with /debug) and `root.render`.

## Not in 1.7.10

There is no lagometer or frame-time graph in 1.7.10 (the only reader of `showDebugProfilerChart` is the pie and its digit keys), so none was added. No F3+G, F3+D, F3+N or F3+Q. F3+H, F3+P, F3+A and F3+F existed before batch 22; batch 22 added F3+B, F3+S/T and F3+C and checked all seven live.

## Approximations (assumed, not native values)

- Chunk updates: `scene.buildChunk` calls in the last second (the port meshes 16x16 columns; 1.7.10 counts 16^3 renderers).
- `C:`/`F:`: resident columns times height/16 sections; rendered = sections in the camera frustum; O and E stay 0 (no occlusion queries, no render pass skipping).
- `E:`/`B:`/`I:`: frustum sphere test over mobs, items, XP orbs, carts, boats and hanging entities, sampled four times a second, plus the local player (counted rendered only in third person).
- Memory: `performance.memory` (Chromium: heap limit, total, used); other browsers fall back to `navigator.deviceMemory` or 0.
- Biome name is the port's `biomeAt(x, z).name`; `fl:` scans the column for the topmost light-opaque block.

Tests: `src/debug-overlay.test.js`.

## F3 combinations (batch 22)

All of F1, F3, F4 and the F3 combinations run in Minecraft.runTick's keyboard loop after the open screen's own key handling, with no screen test (bytecode-read), so they work in every GUI; the port now handles them on every screen except the title. F3 itself toggles on its press, so every F3+key combination also toggles the overlay (as in 1.7.10).

| Combo | Native 1.7.10 | Label |
|---|---|---|
| F3+B | `RenderManager.debugBoundingBox` toggle (bnn.p) | bytecode-read |
| F3+S, F3+T | the same `refreshResources` call (bao.c), which ends with `loadRenderers`. No separate sound reload | bytecode-read |
| F3+C | held: timestamp set when C and F3 are both down; on any later keyboard event 6000 ms or more after it, throws "Manually triggered debug crash" | bytecode-read |
| F3+H, F3+P | toggle advancedItemTooltips / pauseOnLostFocus, `saveOptions`, no chat line | bytecode-read, port verified live |
| F3+A | `RenderGlobal.loadRenderers`, no chat line | bytecode-read, port verified live |
| F3+F | saves options only here (no render-distance branch), no chat line | bytecode-read, port verified live |

Later versions print chat feedback for H, P, A and others; the 1.7.10 key block contains no chat call, so the port prints nothing.

### Hitboxes (F3+B)

`RenderManager.renderEntityWithPosYaw` calls the hitbox routine (bnn.b) when `debugBoundingBox`, the entity is not invisible and the shadow-only flag is false. The box is `(x - width/2, y, z - width/2)` to `(x + width/2, y + height, z + width/2)` from the entity's `width` and `height` fields, not grown and not the collision box; it is drawn in white (0xFFFFFF) as a bottom and a top line strip plus four vertical lines, with depth writes, texture, lighting, cull and blend off and the depth test on. 1.7.10 draws no eye-height line and no look vector (1.8 additions), so none is drawn. The line width is never set there: it stays at whatever the last `glLineWidth` left (2.0 after a block selection outline, assumed), and WebGL lines are 1 px, so the port's outlines are 1 px (assumed gap). Port: `src/debug-keys.js` collects mobs, items, XP orbs, carts, boats, hanging entities, primed TNT, arrows, throwables, rockets, fireballs and the local player (third person only).

Assumed sizes: calves half-size, primed TNT 0.98, hanging entities 0.5 x 0.5. Not collected: falling blocks, lightning, fishing bobbers, eyes of ender, ender crystals and the dragon's native parts.

### F3+C

Port flow (assumed presentation): the game menu opens and a dialog shows the crash report text with the native description and a "Back to game" button; nothing is closed or lost. Native writes crash-reports/ and exits.

### Over GUIs

GuiIngame draws before `currentScreen.drawScreen`, so the overlay lies under the GUI's dark gradient and panel (bytecode-read order). `#debug` sits in `#hud` below `#modal`, and `updateDebugOverlay()` now runs on the playing, inventory, game-menu and death frames. Checked in headless Chrome over the inventory (`artifacts/b22-debugkeys/f3-over-inventory.png`).

Tests: `src/debug-keys.test.js`.
