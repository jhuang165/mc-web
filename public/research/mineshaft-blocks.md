# Mineshaft blocks and loot items (1.7.10)

These are the blocks and items an abandoned mineshaft needs: oak fence, rail, monster spawner and torches, plus the chest-loot items. Each one is real playable content. This is not a claim of full parity; the gaps are listed at the end.

## Evidence

`tools/verify-fence-rail.mjs` compiles `tools/probes/FenceRailProbe.java` against the 1.7.10 client (sha1 `e80d9b3b…`). The probe runs the unchanged classes BlockFence, BlockRailBase (with its inner Rail class), BlockRail, BlockMobSpawner and BlockTorch on a world double, and patches no game classes. It writes `fence-rail-reference.json`:

- 4 block-fact records
- 171 per-block masks: fence connection, solid top, rail below, torch support
- 16 fence collision/bounds/selection cases
- 16 rail-bounds and 16 rail-support cases
- 80 RailLogic placement replays
- 6 torch-bounds cases and 32 torch placement/keep replays
- 32 spawner-XP seeds
- the en_US item names

The render vertex streams (fence, rail and torch) were transcribed from the decompiled RenderBlocks (`blm`) and are not probe-checked.

## IDs

Internal blocks are appended after the previous end of `BLOCKS`; nothing was renumbered.

| Internal | Constant | Original |
|---|---|---|
| 60 | `FENCE` | 85 `fence` |
| 61 | `RAIL` | 66 `rail`, metas 0–9 exact |
| 62 | `MOB_SPAWNER` | 52 `mob_spawner` |

| Internal item | Original | Name | Stack |
|---|---|---|---|
| 360 | 331 | Redstone | 64 |
| 361 | 361 | Pumpkin Seeds | 64 |
| 362 | 362 | Melon Seeds | 64 |
| 363 | 329 | Saddle | 1 |
| 364 | 417 | Iron Horse Armor | 1 |
| 365 | 403 | Enchanted Book | 1 |
| 366 | 328 | Minecart | 1 |
| 450 | 342 | Minecart with Chest | 1 |

`ORIGINAL_ITEMS` (src/region-import.js) and `MC_IDS` (tools/inventory-replay.mjs) carry the same entries.

## Ported behaviour

### Fence (`src/fences.js`)

- **Connections:** `canConnectFenceTo` connects to other fences, and to opaque non-pumpkin blocks with a normal render. It agrees with the probe for every port block.
- **Collision:** the addCollisionBoxesToList boxes are 1.5 high, with the post plus each connected arm. `world.collides` uses the true boxes.
- **Bounds and selection** follow setBlockBoundsBasedOnState.
- **Render:** renderBlockFence draws the post plus bars at 0.75–0.9375 and 0.375–0.5625. The item icon is the inventory fence model.
- **Block facts:** light opacity 0, hardness 2, axe effective, drops itself, furnace fuel 300.
- **Crafting and Creative:** 6 sticks make 2 fences; listed in the Decorations tab.
- Fence gates are not ported.

### Rail (`src/rails.js`)

- **Metas 0–9:**
  - 0–5 render with `rail_normal`: straight, and ascending with +1 on the raised corners.
  - 6–9 are curves with `rail_normal_turned`.
  - The quad is drawn two-sided at y+1/16.
- **No collision.** The selection box is 1/8 high flat and 5/8 high ascending.
- **Support:** canPlaceBlockAt and onNeighborBlockChange need `World.doesBlockHaveSolidTopSurface` below. Ascending rails also break without solid ground under the raised end. A broken rail drops itself.
- **Shape:** placement shape and neighbour reshaping are a native port of `BlockRailBase.Rail`:
  - connect, setConnections and refreshConnectedTracks
  - the onBlockAdded/func_150052_a sequence
  - replayed against 80 probe scenarios
- **Mining and drop:** hardness 0.7; ItemPickaxe lists the rail as effective.
- **Crafting and Creative:** 6 iron plus 1 stick make 16 rails; listed in the Transportation tab.
- Empty and chest minecarts travel on these rails; see [minecarts](minecarts.md).

### Monster spawner (`src/spawner-block.js`)

- **Render:** a full cube with the alpha-tested `mob_spawner` cage. It is not an opaque cube and does not hide neighbour faces.
- **Block facts:** light opacity 0, hardness 5, needs a pickaxe, no drop.
- **XP:** a harvested break in Survival gives `15 + rand(15) + rand(15)` XP. This matches the probe for seeds 0–31.
- **Not obtainable:** no Creative listing, no item, no `MC_IDS` entry.
- **Tile-record hook:**
  - `placeSpawner(world, {x,y,z,entityId,...}, spawners)` writes the block and calls `spawners.add(record)`.
  - `watchSpawnerBlocks(world, spawners)` removes the record when the cell stops being a spawner.
  - Spawning itself is in `mob-spawner.js`, owned elsewhere.

### Torches (`src/torches.js`)

- **Metas:** wall metas 1–4 (attached to the block at −x, +x, −z, +z) and floor meta 5. The port stores a standing torch as meta 0, which the registry writes as 5.
- **Placement:** onBlockPlacedBy and func_150107_m:
  - the clicked side picks the wall when possible
  - otherwise the first valid fallback in BlockTorch order
  - floor support uses canPlaceTorchOnTop (solid top, fence, glass)
- **Keeping:** a torch drops when its support goes (func_150108_b).
- **Render:** renderTorchAtAngle, leaning 0.4 and raised 0.2 on walls.
- Bounds and support are probe-checked.

### Loot items (`src/survival.js`, `src/enchanted-books.js`)

- **Inert items:** redstone, the two seeds, the saddle and iron horse armor have icons, names and stack sizes, but no use.
- **Enchanted book:** carries `stack.stored = [{id, lvl}]`.
  - `makeStack`, `copyStack`, split, save/read and the merge checks all preserve it, and books with different lists do not stack.
  - The tooltip uses ItemEnchantedBook.addInformation: a yellow name, then gray "Name Level" lines, with lang names from en_US.
  - Creative listing: Tools and Combat tabs get the max-level books of their enchantment types; Search lists every level, as in `content-registry-reference.json`.

## Gaps

- `main.js` does not yet color the tooltip title or render the gray lines' class. The watchers, spawner saves and minecart runtime are wired; see [live mineshafts](mineshafts-live.md).
- Ascending rails' extra notify of the block above is not replayed.
- Enchanted books have no glint and no anvil use.
- Region import does not read `StoredEnchantments`.
- Fence gates and powered/detector/activator rails are not ported; empty/chest cart travel and empty-cart riding are live (see [minecarts](minecarts.md)).
