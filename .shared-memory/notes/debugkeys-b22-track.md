# Batch 22 debugkeys track (claude-b22-debugkeys)

## Summary
F3+B draws the 1.7.10 entity hitboxes, F3+S/T run the in-place resource refresh, F3+C is a held (6 s) simulated crash dialog, and every F1/F3/F4 combination now works on every screen but the title (native has no screen test). The F3 overlay is updated and drawn on the inventory, game-menu and death frames, under the GUI as natively. New `src/debug-keys.js` (+ test); `src/main.js` hunks: import, `debugKeyDown`/`debugCrashTick` replacing the playing-only F3 block, `debugHitboxList`, a hitbox update line, the `if (debug)` block moved into `updateDebugOverlay()` and one extra call after the screen chain.

## Native evidence
bytecode-read (javap bnn, bma, bao): hitbox = width/height box at the feet, not grown, white 0xFFFFFF, two line strips + four verticals, depth test on, depth mask off, no eye line / look vector in 1.7.10; F3+S and F3+T are the same bao.c (refreshResources then loadRenderers, no separate sound reload); F3+C timestamp logic and the 6000 ms threshold, checked on every keyboard event before the key test; F3+H/P/A/F contain no chat call, so no feedback is printed; the F1/F3/F4 block has no screen test. Assumed: native line width (2.0 only if a block outline was drawn earlier), hanging/TNT sizes, calf half size, crash dialog presentation.

## Tests
`src/debug-keys.test.js` (5 tests): hitbox box, outline vertex order, entity collection, crash timer, report text. Live in headless Chrome (muted, :5192, own profile): F3+B with mobs/item/orb/boat/cart nearby, F3 over the inventory, F3+C crash dialog after a 6.5 s hold (not at 3 s), F3+H/P/F/A/S/T state changes (options saved, dirty meshes, refresh event). Screenshots in `artifacts/b22-debugkeys/`.

## Remaining gaps
- Hitbox width is 1 px (WebGL); falling blocks, lightning, bobbers, eyes of ender, crystals not collected; hanging and TNT sizes assumed; no frustum or renderer-existence test per entity.
- F3+C does not exit or write a crash report; only a dialog.
- Overlay is not drawn on the title screen (native does not either; world-less) and is stale only if the world is not running a frame.

## Proposed remaining-gaps lines
- F3 debug keys: F3+B hitboxes (1 px, some entity kinds not collected), F3+S/T refresh, F3+C simulated crash dialog and the overlay over GUIs are ported; F3+C does not exit, hitbox line width and a few entity sizes are assumed.
