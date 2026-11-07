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

There is no lagometer or frame-time graph in 1.7.10 (the only reader of `showDebugProfilerChart` is the pie and its digit keys), so none was added. No F3+G, F3+D, F3+N or F3+Q. F3+H, F3+P, F3+A and F3+F already existed in the port; F3+B (hitboxes), F3+S/T (resource reload) and F3+C are native but not ported.

## Approximations (assumed, not native values)

- Chunk updates: `scene.buildChunk` calls in the last second (the port meshes 16x16 columns; 1.7.10 counts 16^3 renderers).
- `C:`/`F:`: resident columns times height/16 sections; rendered = sections in the camera frustum; O and E stay 0 (no occlusion queries, no render pass skipping).
- `E:`/`B:`/`I:`: frustum sphere test over mobs, items, XP orbs, carts, boats and hanging entities, sampled four times a second, plus the local player (counted rendered only in third person).
- Memory: `performance.memory` (Chromium: heap limit, total, used); other browsers fall back to `navigator.deviceMemory` or 0.
- Biome name is the port's `biomeAt(x, z).name`; `fl:` scans the column for the topmost light-opaque block.

Tests: `src/debug-overlay.test.js`.
