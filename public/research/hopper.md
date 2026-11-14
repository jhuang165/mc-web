# Hopper (original 154, internal 133) and live comparator container reads

Target: Minecraft Java 1.7.10 (client JAR SHA1 e80d9b3bf5085002218d4be59e668bac718abbc6). Not full parity.

## Evidence

`tools/verify-hopper.mjs` compiles `tools/probes/HopperProbe.java` over the `RedstoneProbe` World/Chunk fixture and runs the
unchanged original `BlockHopper` (aln), `TileEntityHopper` (api), `TileEntityChest`, `TileEntityFurnace`, `TileEntityDispenser`/
`TileEntityDropper`, the redstone block, comparators and scripted `EntityItem`s. 25 scenarios, 1190 ticks. Per tick it records
block id/metadata, every slot, the hopper cooldown, live item entities, the comparator-override signal of every container and the
`TileEntityComparator` output, and stores only the changes (1152 records). `src/hopper-replay.js` replays the same scenarios through the
browser port (real `World`, the live redstone runtime, `Hoppers`) and the verifier requires identical output;
`src/hopper.test.js` replays `public/research/hopper-reference.json`. Run: `MC_RESEARCH=<tools/research> node tools/verify-hopper.mjs`.

Scenarios: push into a chest, suck from a chest, hopper chains, horizontal pushes (chest, dropper), furnace from above (input),
beside (fuel only, merge, refused non-fuel), furnace as a source (output first; an empty bucket from the fuel slot only),
item pickup (inside, overlapping, too low/high, beside, partial merge, full hopper, late spawn, empty chest above blocks pickup),
power disable (redstone block placed/removed, placed next to power), double chests as target and source, a chest closed by a stone
block (above, or above only the partner half), dispenser/dropper as source and target, stack rules (unstackable, 16-stacks, damage
split), a full target, and three comparator scenarios (chest, hopper, furnace).

## Verified (native)

- Block facts: class aln, hardness 3, resistance field 24 (stored as 4.8), selection/ray box the full block, collision floor
  [0,0,0,1,0.625,1] plus four 1/8 walls full height, placed metadata per clicked side [0,0,3,2,5,4] (never up), not opaque, not a
  normal cube, render type 38, comparator override true, item stack 64. The hopper item is original id 154 (`Item.getItemById(154)`),
  not 410.
- `TileEntityHopper.updateEntity`/`updateHopper`: cooldown decrement per tick, 8-tick cooldown after any transfer, push one item to the
  facing inventory first, then suck from the inventory above (read from side 0; an empty-for-side inventory blocks entity pickup) or
  pick up the first overlapping `EntityItem` in (x, y+1, z)-(x+1, y+2, z+1); inserting into a hopper sets that hopper's cooldown;
  powered (metadata bit 8) hoppers do nothing; `BlockHopper` toggles the bit on add and neighbour change (flag 4, no notify).
- Sided furnace rules, double chest order (west/north first), chests blocked by a normal cube above themselves or their partner,
  stack merging by item/damage/tags up to the item's stack size, unstackable and 16-stacks.
- Live comparator reads: every transfer, furnace fuel/smelt result, open-screen click and screen close calls
  `containerChanged` (World.func_147453_f path), so comparators follow containers tick by tick (three comparator scenarios).
- Recipe `I I / ICI / _I_` (five iron ingots, one chest) is checked against the original crafting manager by `tools/recipe-audit.mjs`.

## Port wiring (approximated, not natively probed)

- 5-slot screen `HopperContainer` (176x133, slots at (44+18i,20), inventory at (8,51); texture `gui/container/hopper.png`, already imported),
  title "Item Hopper" or the CustomName; shift-click merges both ways.
- Saves: browser `hoppers` store ({items, cooldown, name}), Java export `Hopper` tile (Items, TransferCooldown, CustomName) and import,
  runtime chunk containers and residency; contents spill when the block is broken or exploded.
- Render model from `RenderBlocks.renderBlockHopper` bytecode (bowl box, inner walls/floor, funnel, spout box per facing). Not compared pixel-by-pixel.
- Creative placement/catalogue and survival crafting use item 1133; plain-item ids 413-415 unused.

## Known limits

- Furnace smelting is not in the native probe (the furnace is not ticked there); furnace sided behaviour is natively verified, cooking progress is the repo's existing port.
- Batch 69 (docs sweep): hopper minecarts pull from containers and item entities (`src/cart-hopper.js`, probe-verified in `carts-reference.json`). Ocelots sitting on chests were not re-checked.
- Droppers share the `dispensers` store (as the original TileEntityDropper extends TileEntityDispenser); dispenser/dropper firing must call `containerChanged` itself (owned by the dispenser track).
- Hopper minecarts (item 408) are not part of this change.
- The browser pass was not completed: the dev server full-reloaded repeatedly while five agents edited sources.
