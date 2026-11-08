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

## Batch 20 (pistons): pushing every entity system and moving-block collision

Probed natively (executed on the unchanged jar; `tools/probes/PistonLiveProbe.java`, driver `tools/verify-piston-live.mjs`, reference `piston-live-reference.json`, replay `src/piston-live.test.js`): 49 scenarios (was 6), 160 `World.getCollidingBoundingBoxes` boxes, 244 push boxes, 200 entity pushes, all identical.

- New scenarios: pistons facing south (plain and sticky), entities standing exactly on a block pushed up, pushed down and lifted then pulled (sticky), and about 30 stored blocks with non-cube boxes (slabs, fence, gate, stairs, trapdoor in several facings and states, wall, bars, pane, cactus, bed, cauldron, soul sand, farmland, carpet, brewing stand, anvil, hopper, flower pot...). All six facings appear in the reference.
- `World.getCollidingBoundingBoxes(entity, box)` is called natively over each moving cell (the mover is an unconstructed EntityItem subclass; scripted entities are in the world). Only BlockPistonMoving's own box meets the cell: the stored block's pool box shifted by `func_149964_a` at partial 0 (progress = `lastProgress`; extending uses 1 - p, retracting p itself). `src/piston-live.js` `collisionBoxes(box)` returns the same boxes and `src/entities.js` `collisionBoxes` (the one function the player, mobs and every `moveEntity` caller use) now appends them through `setMovingBoxes`, installed by `redstone-runtime.js`. An entity falling onto a moving block lands on its box, and a box beside an entity blocks it.
- Native quirk, reproduced: the stored block's box is read with the world cell holding the MOVING block. A top slab (44, 126) comes out as the bottom slab; carpet comes out zero high; fences, nether fences and farmland come out as the full cube; soul sand is 7/8, a cobblestone wall its 1.5 high post, a fence gate its 1.5 high slab (even metadata thin on z, odd on x). Table `POOL_OVERRIDES` plus the gate rule in `piston-live.js`; every other stored block uses `blockBounds` with its own metadata and matched the native box in all probed scenarios. Blocks that were not probed use the same path unverified.
- Entity pushes (`src/piston-push.js`, wired in `redstone-runtime.js`): player and mobs (unchanged), dropped items, primed TNT, experience orbs, falling blocks, minecarts and boats now move with `moveEntity` (stepHeight 0 for non-living) on a body copy written back, so walls stop them; before, items and TNT were teleported through walls and orbs, falling blocks, carts and boats were never pushed.
- 1.7.10 has no sticky entity pulling: the native moves of the sticky scenarios are only forward pushes (+0.0625 per tick extending, the final 0.25), never a backward delta on retract; the replay asserts it.

Limits (remaining): the native push uses scripted `moveEntity` stand-ins, not a real EntityLivingBase/EntityMinecart `moveEntity` (their collision tails are the browser's own); a pushed rider's passenger and player velocity/ySize are not modelled (the player body copy is written back to the position only); entity-vs-entity collision with a pushed boat or cart is not re-run; blocks outside the probed list use the render bounds and may differ in their pool box.

## Batch 24 (pistons2): real entities pushed through their own moveEntity

Probed natively (same driver and reference): 124 scenarios (was 49), 646 push boxes, 420 collision boxes, 525 scripted pushes, plus 104 per-tick states and 19 moves of real entities. All identical to the jar.

- Real entities: `PistonLiveProbe` can now construct an EntityPig, an EntityMinecartEmpty and an EntityBoat in the probe World (`live` event). Their own `Entity.moveEntity` runs against the World's block boxes, BlockPistonMoving's box and the other entities' boxes; the subclasses only record the delta first. Each tick records [label, posX, minY, posZ, motion, onGround, isCollidedHorizontally, fallDistance]. `PistonProbe.W` gives a real entity's live boundingBox to the entity queries and leaves the mover out of `getEntitiesWithinAABBExcludingEntity`. The collision-box readout asks for block boxes only, because EntityBoat.getBoundingBox is not null.
  - Scenarios:
    - a pig pushed into a wall (with motion: the blocked axis zeroed, collidedH);
    - pigs lifted under a ceiling and free (onGround false after an upward push, vertical motion kept);
    - a grounded pig stepping 0.5 onto a slab, and one stopped by a full block;
    - a cart and a boat pushed into walls;
    - a pig pushed into a boat (the boat's box blocks it);
    - a pig in the cell the pushed stone enters.
  - Native quirk: after a sideways push, onGround is false (no downward move). A later push of the same entity does not step. No onUpdate ran in these scenarios.
- Port:
  - The player is pushed with `piston-push.js` `pushPlayer`, which uses the player's own motion, onGround, sneaking (sneak edge), ySize (×0.4), fallDistance, web flag and inWater. It writes back position, motion, flags, ySize and the web flag (main.js `player()` adapter).
  - Mobs are pushed with `EntityWorld.pushMove`, which runs the same moveEntity, hooks, step events and landing as `moveWith`.
  - Carts and boats are pushed with `Minecarts.move` / `Boats.move` (detector rail hook, block hurts, fall state). They are blocked by the player and living mobs.
  - The moving box is now also a collider for carts, boats and dropped items (`src/moving-boxes.js`, shared by entities.js, minecarts.js and item-entities.js).
- More stored blocks (`odd-block2-*`):
  - every stairs id, the stone and wooden slab variants, carpet colour 5, the mossy wall, anvil metadata, the dragon egg, an open gate, wet farmland, trapdoor metadata 1–4 and 12–13, ladders, snow depths 0 and 7, the end portal frame with an eye, and stone;
  - rails (66, 27, 28, 157).
  - Rails and an open fence gate have no pool box. The native `func_149964_a` returns null for them, so they push nothing and give no collision box (`NO_POOL_BOX` in `piston-live.js`). All other new blocks matched `blockBounds`.

Limits (remaining):
- Pushes still run after the whole tile loop rather than inside each tile's `updateEntity`. This matched natively in every probed scenario, but it could differ when two tiles push the same colliding entity in one tick.
- A landing caused by a push on the player does not deal fall damage (`land` is not wired in main.js). The player's cactus and fire tail does not run on a push.
- Dropped items, TNT, orbs and falling blocks still use the body copy, not their own move.
- Riders follow on their next tick.
- Stored blocks outside the probed lists remain unverified.
