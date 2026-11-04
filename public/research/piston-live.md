# Live piston motion (Java 1.7.10)

`src/piston-live.js` adds drawing, entity pushing and saving to the piston logic that `src/redstone.js` already replays exactly (`piston-reference.json`). It is not full parity.

## Evidence

`tools/probes/PistonLiveProbe.java` runs the unchanged original classes (TileEntityPiston `aps`, BlockPistonMoving `apr`, BlockPistonBase `app`, BlockPistonExtension `apq`) in the PistonProbe world with scripted entities (EntityItem stand-ins that record `moveEntity` deltas). `tools/verify-piston-live.mjs` replays the same 6 scenarios through `redstone.js` plus `installPistons` and writes `piston-live-reference.json`: 40 tile states, 200 render offsets (progress and x/y/z offsets at partial ticks 0, 0.25, 0.5, 0.75, 1 from `aps.a/b/c/d`), 40 push boxes (`apr.a(world, x, y, z, block, progress, facing)`), 34 native entity moves (`TileEntityPiston.func_145863_a` through `updateEntity`). All identical. `src/piston-live.test.js` replays the reference.

## What works

- Rendering: `frame(partial)` builds, per `redstone.pistonTiles()` entry, the parts TileEntityRendererPiston draws (read from its bytecode): nothing when the stored block is air or progress >= 1; an extending head below progress 0.5 with the short arm (0.25..0.75 along the axis, half the piston_side texture); a retracting base (`renderHead`) as the head with the base's top icon (full arm before 0.5, short after) at the offset plus the base in its own cell; otherwise the stored block with every face. Offsets are the native float formulas. `src/scene.js` gets `setMovingBlocks` / `updateMoving` (meshes moved by the offset; piston quads reuse `pistonQuads`, other blocks go through the scene's `cube`/`stairs`/`box` with a one-cell world view so no face is culled).
- Entity pushing: the installer wraps `redstone.updateTileEntities` on the instance and applies updateEntity's `func_145863_a` after the native tile loop (extending: progress delta + 0.0625; final update: 1.0, 0.25). Targets: the runtime player, mobs (`EntityWorld`), extras (drops, orbs, carts) via `entities.extra`. Mobs move with `moveEntity` so walls still stop them.
- Saving: `save()` / `restore()` keep moving tiles (x, y, z, stored original block and meta, facing, extending, renderHead, progress, lastProgress; restore sets progress = lastProgress as readFromNBT does). Java export: `region-export.js` writes a `Piston` tile entity (blockId, blockData, facing, progress, extending) for each `state.pistons` entry.
- Sounds: `tile.piston.out` / `tile.piston.in` come from `redstone.js` through `hooks.sound`.

## Limits

- The audio manifest has no `tile.piston.out/in` events and `public/audio/1.7.10/tile/piston/*.ogg` is not imported, although `assets-1.7.10.json` lists `minecraft/sounds/tile/piston/in.ogg` and `out.ogg`. `tools/import-vanilla-media.mjs` (agent "witch") must add them, or the pistons stay silent.
- A tick that never calls `redstone.updateTileEntities()` never moves tiles or pushes entities; the live engine must run the tile loop after the block events, as World.updateEntities does.
- The head's push box is the full cube, as recorded natively (Blocks.piston_head keeps its last-set bounds; a fresh game is 0..1). Real play can leave a different stale box. Stored blocks use `blockBounds`, not each block's exact getCollisionBoundingBoxFromPool.
- Render: flat cell brightness, not per-vertex smooth lighting; special shapes besides stairs, stone slabs and fences draw as cubes. The drawing branch choice comes from bytecode, not from native pixel output.
- Entity pushing is verified with free-moving scripted boxes; the live mover uses entities.js `moveEntity` (default player mover without `player.move` writes the delta through it with a temporary body).
- `renderHead` and `lastProgress` are saved by the browser but not by Java; Java import of an in-motion `Piston` tile is not done (it stays lost).
- Persisting `pistons.save()` per chunk needs `'pistons'` in `ARRAYS` of `chunk-runtime.js` (not added: `chunk-runtime.test.js` pins the record shape), otherwise store it beside `redstone.save()`; `state.pistons` entries may be plain or `{ value }`.

## 0.39.0 additions

- Contract: see the "CONTRACT FOR THE COORDINATOR" block at the top of `src/piston-live.js` (tick order, frame(partial), save/restore, entities adapter). `installPistons({ redstone, scene, world, entities, blocks })` is unchanged.
- Rendering: `scene.updateMoving` caches one mesh per tile part and only repositions it per frame; geometry is rebuilt (old one disposed) when the stored block, the shortened arm or the cell light changes, and removed parts are disposed. The static cell (internal moving block 130 / original 36) is skipped by `buildChunk`, so it never draws as a cube. Tested headless in `src/piston-scene.test.js` (stub scene object, real three geometry).
- Sounds: `tile.piston.out` volume 0.5, pitch `nextFloat*0.25+0.6`; `tile.piston.in` volume 0.5, pitch `nextFloat*0.15+0.6` (BlockPistonBase `app` bytecode; the "in" span is 0.15, not 0.25). They arrive through `LiveRedstone` `hooks.sound`.
- Persistence: browser record field `pistons` (per column via chunk-runtime, sanitised in world-import). Java: `region-export.js` writes `Piston` tile entities, `region-import.js` reads them where the cell converted to the moving block and returns them in `record.pistons`; the round trip is tested in `src/piston-live.test.js`. A finished head without a base breaks on its neighbour update, as natively.
- Limits: entity pushes use the player/mob/extras adapters, not every Java entity type; main.js wiring is the coordinator's.
