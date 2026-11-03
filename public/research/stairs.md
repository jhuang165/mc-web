# Stairs (BlockStairs), Minecraft Java 1.7.10

Internal ids 87-96 map to the original ids 53 (oak), 67 (cobblestone), 109 (stone brick), 128 (sandstone), 134 (spruce), 135 (birch), 136 (jungle), 108 (brick), 163 (acacia) and 164 (dark oak). The metadata domain is the original one: bits 0-1 give the facing (0 ascends towards +x, 1 towards -x, 2 towards +z, 3 towards -z) and bit 2 marks an upside-down stair. Villages, strongholds, temples and witch huts place stairs with raw metadata, so nothing is translated.

## Method

`tools/probes/StairsProbe.java` runs the unchanged `ans` (BlockStairs), `aji` (Block) and `blm` (RenderBlocks) classes from the research JAR against a minimal `ahb`/`ahl` world double (an Unsafe-allocated stub over a cell map; no renderer or entity world is created). `tools/verify-stairs.mjs` compiles and runs it and writes `public/research/stairs-reference.json` with the class hashes. `src/stairs.test.js` replays it. The reference holds:

- 10 block records (material, hardness, resistance, light opacity, render type, step sound, drops, tick rate, solid-top mask, creative tab).
- 32 render shapes and 32 collision shapes, indexed by 16 metadata values x 6561 neighbour states (9^4: each of x-1, x+1, z-1, z+1 is air/other or a stair of metadata 0-7), 104,976 states.
- 4000 mixed cases: random centre stair type and metadata, random neighbours of other stair types, stone, or air.
- 3072 `collisionRayTrace` rays (16 metadata x 192) plus the selected box and the block bounds left after a trace.
- 1520 placement cases: 216 `onBlockPlaced` (side, hit y, incoming metadata) and 1304 `onBlockPlacedBy` (yaw edge cases, existing bit 2).

## What is implemented (`src/stairs.js` and the consumers)

- Shape: the half box, a second box with the outer-corner reduction (`func_150145_f`), and an inner-corner third box only when the second box was not reduced (`func_150144_g`). A neighbour connects when it is any stair with exactly the same full metadata; other blocks count as air.
- Collision uses the same boxes in order, for the player (the 0.5 step height lets a stair be climbed), mobs, thrown and dropped items, particles, minecarts, projectiles, arrows, buckets and explosions. One-box callers get the union.
- `raycast` skips the octants the shape leaves empty and returns the exact entry vector; the selection outline is the model block's full cube.
- Placement: the lower face or the upper half of a side face gives bit 2; the facing comes from `floor(yaw * 4 / 360 + 0.5) & 3` mapped to [2, 1, 3, 0]. The camera yaw (radians) converts to `rotationYaw = fround(180 - degrees)`.
- Properties: light opacity 255, not opaque, not a normal cube, neighbour-brightness lighting, solid top only when upside-down (rails, torches, doors, display ticks), fences do not connect, drops itself with damage 0, mined with an axe (wood stairs) or a pickaxe (rock), wood step sound for wood stairs, explosion resistance model resistance / 5.
- Rendering: `scene.js` draws the box set per state with the base block's textures (sandstone uses top, side and bottom; wood stairs use the matching planks); held, dropped and inventory icons use the two item boxes of render type 10.
- Recipes: six base blocks in the "#  ", "## ", "###" pattern (either mirror) craft four stairs; planks match their exact damage 0-5, the other base blocks any damage. Creative order is oak, cobblestone, brick, stone brick, sandstone, spruce, birch, jungle, acacia, dark oak.

## Quirks kept

- `collisionRayTrace` never resets the bounds: after a trace they stay at the last octant tried, `[0.5, 0.5, 0.5, 1, 1, 1]` (recorded as `boundsAfterTrace`). The browser has no stale block bounds, so this is a record only.
- The same stale bounds make the original's placement entity-collision test use that octant; this is documented, not modelled.

## Limits

- The `RenderBlocks.renderBlockAsItem` item boxes (`STAIR_ITEM_BOXES`) come from the bytecode by reading, not from a probe run.
- Recipe C90 (stone brick stairs) depends on the stone-bricks item mapping 98 -> internal 101; the recipe already accepts internal id 101 with any damage. Item 5:1-5 (planks damage variants) is now mapped in `region-import.js`, so those recipes are audited.
- Full parity is not claimed: stair AI path costs, redstone and stair-specific mob spawning rules are not checked, and shape logic was verified only against the stair class with the neighbours described above.
