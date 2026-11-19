# Batch 82 pots82: pot removal drops, rawDamage pick/place/persistence/wire, Mining Fatigue V crack and meter

## Summary
- Pot removal drops (`src/stone-utility.js` `potBreakDrop` / `potHeldDrop` / `potEntryStack`):
  - Native BlockFlowerPot.breakBlock runs inside every server setBlock that replaces a pot. It drops the tile's `ItemStack(Item, 1, Data)` through `Block.dropBlockAsItem(world, x, y, z, stack)`, which skips without doTileDrops and otherwise draws three world.rand floats (`rand * 0.7F + 0.15`).
  - The helper returns `potDropEntry` at that position. For an undrawn item the port lacks it returns `{ id: 0 }`, and the floats are still drawn.
  - Explosions (`explosion.js` `explosionOutcome`, drop part only): the pot item's chance roll, then the plant on three more floats, whatever the chance. `explosion-simulation.js` and `server-mobs.js` forward `tags`.
  - Wither block sweep (`wither-boss-mobs.js`): the pot item, then the plant, on the wither's rand.
  - Dragon (`dragon-mobs.js` `removeBlock`): plant only, because setBlockToAir has no dropBlockAsItem. It is a `blockSpread` drop event that `item-entities.js` `dropMob` spreads like `dropBlock`. It uses the item random rather than the dragon's, since native uses world.rand.
  - Water and lava (`fluids.js`):
    - `blocked()` no longer blocks FLOWER_POT, because Material.circuits does not block movement.
    - Water washes the pot item and the plant (`fluid-wash.js` `washStacks`).
    - Lava drops only the plant (new `burn` hook, `burnStacks`). It is wired in `main.js`, `multiplayer/server-bucket.js` `installFluidHooks` (Overworld and Nether) and `away-world.js`.
  - Buckets (`buckets.js` `placeContainedLiquid`): a pot is replaceable, because circuits is not solid. The existing `destroy` hook washes it: pot item and plant. The dispenser path already treated pots as replaceable and goes through `fluids.wash`.
  - Pistons (`redstone-live.js` `LiveRedstone.dropBlockAsItem`, id 140): after the pot item, the plant drops on the same Random, with doTileDrops respected. The `main.js` redstone `drop` hook forwards `rawDamage`.
  - /setblock (`command-host.js`): a replaced pot drops its plant through the new env hook `dropStacks`, and its record is removed. This covers pot to pot with another meta too, since native removes the tile entity. Hook providers: `main.js` (items.dropBlock) and `multiplayer/server-worldcmds.js` (`serverItems.stacksDrop`, which now keeps rawDamage).
  - Player break, creative harvest and support loss were already right (b81).
- rawDamage pick, placement, persistence and wire:
  - `potPick` keeps `rawDamage`.
  - `inventory.js`:
    - `pick(id, creative, damage, rawDamage)` makes the stack with it.
    - `find(id, damage, rawDamage)` matches the native damage, so a rawDamage stack is its own subtype.
    - `main.js` `pickBlock` passes `stonePick?.rawDamage`. The MP Creative pick sends the slot through `wire()`, which keeps it.
  - `inventory.js` `read` keeps a valid `rawDamage` (integer 1..32767). This covers SP saves, chests, ground items and the MP `applySlots` / server load. `multiplayer/server-containers.js` `cleanStack` keeps it as well (Creative C10 and clicks).
  - Placement (`block-placement-simulation.js`): a rose or sapling stack with rawDamage places `rawDamage & 15`. ItemMultiTexture returns the damage from getMetadata, and the chunk stores a nibble.
  - New `src/plant-damage.js` `plantDropDamage` applies the matching drops at metas past the variants:
    - A rose keeps its meta, as rawDamage when it is 9 or more.
    - A sapling drops `clamp(meta & 7, 0, 5)`.
    - It is used in `block-break-simulation.js`, `explosion.js` (which also fixes a pre-existing bug where every exploded sapling dropped oak), `fluid-wash.js` and `main.js` flower support loss.
  - `block-textures.js`: a rose past its icons draws the poppy, and sapling 6 and 7 draw roofed oak.
- Mining Fatigue V (new `src/mining-crack.js`):
  - `clientCrackStage(p)` = `(int)(p * 10F) - 1`, using Java float-to-int (NaN is 0, saturating), kept only for 0..9. So progress 0, NaN and any negative progress show no crack, and every stage is one below the old `floor(p * 10)`. `effects.js` `crack()` uses it.
  - `meterPercent(p)` is 0 for NaN or p <= 0. `main.js` uses it for the meter width and `aria-valuenow`, so neither can be NaN.

## Evidence
- Bytecode-read (1.7.10 jar, `javap -c -p`):
  - `ald` BlockFlowerPot extends `ajc` BlockContainer. `ald.a(ahb,III,aji,int)` breakBlock builds `new add(item, 1, data)` → `aji.a(ahb,III,add)`, then super. `ajc.a(...)` breakBlock calls `ahb.p` removeTileEntity.
  - The pot material is `awt.q` = `awq` MaterialLogic: `c()` blocksMovement is false and `a()` isSolid is false.
  - `apx.a(IIILaji;I)Z` Chunk.func_150807_a calls the old block's breakBlock when `!isRemote`, including for the same block with another meta.
  - `aji.a(ahb,III,add)` dropBlockAsItem: the isRemote/doTileDrops check, then three `rand * 0.7F + 0.15` floats, then an EntityItem with delay 10.
  - `agw.a(Z)` doExplosionB order: dropBlockAsItemWithChance, setBlock, onBlockDestroyedByExplosion.
  - `akr.h` (lava: fizz only; water: dropBlockAsItem; then setBlock) and `akr.p` (blocksMovement).
  - `bje` PlayerControllerMP onPlayerDamageBlock / clickBlock: `(int)(g*10F)-1`.
  - The Item registry `adb`: yellow and red flower and sapling are `adl` ItemMultiTexture, tallgrass and vine are `abr` ItemColored, and double plant is `aci` (extends `adl`). `adl.a(I)I` and `abr.a(I)I` return the damage.
  - `alc.a(I)I` (meta) and `anj.a(I)I` (`clamp(meta&7,0,5)`) damageDropped. `alc.a(II)` and `anj.a(II)` getIcon: icon 0 past the array, and the sapling clamp.
- Executed: none new. The b72/b79/b81 pot sweeps were replayed unchanged.
- Port-read:
  - Piston mobility 1 for 140 (PistonProbe dump) and the `tryExtend` dropBlockAsItem → setBlockToAir order in `redstone.js`.
  - `world.put` drops the pot record when the cell stops being a pot.
  - `replaceableCell` already treats pots as replaceable.
  - Server `sim.items.dropBlock` has no doTileDrops filter. This is pre-existing and unchanged.

## Verification
- `node --test src/pots82-b82.test.js`: 13 pass, 0 fail. It covers:
  - the drop draws;
  - explosion order and chance;
  - plant damage and textures;
  - water and lava over a pot in a real World with Fluids;
  - bucket, piston and /setblock;
  - pick and find;
  - read and cleanStack;
  - rose and sapling placement;
  - dropMob rawDamage and blockSpread;
  - the crack stage table and the meter.
- Neighbour batch 1, 22 files (potspacks79/80/81, flowerpots72, stone-utility, explosion, fluids, fluids80, buckets, buckets-simulation, mpbuckets75, redstone-live, piston-live, inventory, inventory-player, item-entities, block-placement-simulation, block-break-simulation, player-mining, mining, creative, wood-types): 404 tests, 402 pass, 2 fail before the test updates. Both failures were the updated assertions below. After the updates, potspacks79 and potspacks81 give 15/15 pass.
- Neighbour batch 2, 32 files (wither-boss, mpwither63/64, wither-targets, dragon-world, dragon, mpdragon64, mpcmd80/81, command-block, commands, command-tags, mpworldcmds68, away-world, away-commands, living-simulation, mpinventory60/61, mpbooks66, mpcopies81, smallfixes72, recheckgaps74, render81, dispense, spsounds76, mob-griefing, ladders, neg-stacks3, corpse81, spfixes75, block-actions-replay, dimension-live): 302/302 pass.
- block-sweep and player-throw-replay: 10/10 pass. block-textures and the atlas tests (with pots82): 32/32 pass.
- `npm run build` ok. No full `npm test` and no browser checks, by the track rules.
- Old tests that encoded the fixed gap: `potspacks79-b79.test.js` and `potspacks81-b81.test.js` expected `potPick` without `rawDamage`. Both now expect the stored stack.

## Follow-ups
- Server pistons drop nothing at all: the server LiveRedstone has no `drop` hook. This is pre-existing. With a hook, the plant would follow automatically.
- The away world's /setblock env has no `dropStacks`, so a replaced pot drops nothing there.
- `/setblock ... flower_pot <meta> replace {Item, Data}` ignores the tile tag. It is listed in ignoredTagKeys, as before.
- Dandelion and tall grass rawDamage cannot be placed natively, because the port registry holds no metadata for 43 and 83/39/84. Double plants (`aci`, damage as metadata) were not checked.
- The SP redstone `drop` hook adds a second dropBlock spread on top of the native offset it receives. This is pre-existing and was not changed.
- Browser-only: how the crack overlay looks at stage 0 versus none at the first hit; that the meter shows empty (not stale) under Fatigue V; and that the poppy and roofed oak icons appear for odd metas.
