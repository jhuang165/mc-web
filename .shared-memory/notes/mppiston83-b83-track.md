# Batch 83 mppiston83: redstone drops on the dedicated server, native crush drops, no second spread in single player

## Summary
- Server drop hook (new `src/multiplayer/server-redstone-drops.js` `serverRedstoneDrop(sim, itemsOf)`):
  - Before this, the server LiveRedstone in the Overworld (`simulation.js`) and in the Nether and End (`server-nether.js`) had no `drop` hook. Everything the engine drops was lost:
    - every piston-destroyed block, and a pot's plant along with it;
    - every redstone component that loses its support: dust, torches, levers, buttons, plates, repeaters, comparators, tripwire and hooks, iron and wooden doors (the engine's door rule), the extended base behind a broken head, and powered rails.
  - The hook spawns one EntityItem at the engine's position with pickup delay 10 and keeps the stack tags (rawDamage, SkullOwner). It drops into the dimension's own ItemEntities (`this.items` / `n.items`).
  - A Creative server keeps none. This is the same convention as `ServerItems.stacksDrop`, not native.
  - Both constructions also pass `skulls: () => tileEntities.skulls`.
- Native crush drops (new `src/redstone-drops.js` `crushDrops`, used by `redstone-live.js` `LiveRedstone.dropBlockAsItem`):
  - The engine's generic `dropBlockAsItem` drew one chance float and dropped the block's own id. So a piston pushing into water or lava dropped a "Water"/"Lava" item, fire a Fire item, and wheat the crop block. Tall grass dropped itself, and a bed or skull dropped an item id that does not exist (1138/1172).
  - Now each of these drops what its 1.7.10 class drops:
    - Liquids, fire, snow layer, cake and vine drop nothing and draw nothing.
    - Dead bush, stems and the double plant's top half, double grass and large fern draw only the chance float.
    - The bed head drops nothing and draws nothing; the foot drops the bed item.
    - Web drops string and reeds drop the reeds item.
    - Tall grass drops seeds 1/8, after its `1 + nextInt(1)` quantity draw.
    - Melon drops `min(9, 3 + nextInt(5) + nextInt(1))` slices.
    - Stems drop three `nextInt(15) <= meta` seed rolls.
    - Nether wart drops 1, or `2 + nextInt(3)` when ripe; cocoa drops 1 bean, or 3 at age 2.
    - Leaves drop a sapling (1/20, jungle 1/40) and the apple (1/200).
    - Crops drop the crop or seed, plus three seed rolls and the poisonous potato when ripe.
    - The sapling's damage is `clamp(meta & 7, 0, 5)`. A rose keeps its rawDamage through `plantDropDamage`. The double plant drops `meta & 7`.
    - The skull drops its tile's type, with SkullOwner for a player head, unless bit 8 is set. Its `dropBlockAsItemWithChance` is empty; the drop happens in breakBlock.
  - The other mobility-1 blocks (mushrooms, torch, ladder, cactus, pumpkins, lily pad, the redstone parts and the pot) keep the engine path.
  - Small fix: `DROP_ITEMS` now maps 122 to 171, so the dragon egg drops item 171 rather than the nonexistent 1171.
- doTileDrops: `LiveRedstone.dropBlockAsItem` ANDs its own `doTileDrops` with `gameRule("doTileDrops")`. That gameRule source is set by `main.js` and by `simulation.js` tick.
  - So the rule now skips the three position floats while the chance and item rolls still draw, as natively.
  - Before, single player drew the floats and then filtered in the `items.dropBlock` wrapper. The server had no filter at all.
- Single-player double spread (`main.js` redstone `drop`):
  - The old hook called `items.dropBlock` on the already offset position. That added a second 0.15..0.85 spread (up to 1.7 blocks off the cell) and three more item-random draws.
  - It now calls `spawnRedstoneDrop(items, x, y, z, d)` (`redstone-drops.js`): `items.spawn` at the engine position with delay 10, which is native `dropBlockAsItem_do`. The rest tags (rawDamage, skull) stay on the stack.
- Audit, SP-only drops the server lacked:
  - The server's `NetherLive` (in `server-dimensions.js`, both Overworld and Nether) had no `drop`. Nether wart losing its soul sand dropped nothing; now it uses `stacksDrop`, as single player does (checked once: 0 items before, 3 after).
  - The server already had Rails, Torches, Doors, Beds, Plants and falling blocks.
  - Single player's inert `RedstoneBlocks` watcher only duplicates rules the engine already runs (tripwire included), so it needs no server copy.

## Evidence
- Bytecode-read (`javap -c -p`, 1.7.10 jar). Class names come from the `aji` registry: bed ajh, web aok, tallgrass anz, deadbush akh, fire alb, snow_layer ann, reeds ane, cake aju, stems anu, vine aoh, waterlily aoj, nether_wart amf, skull anl, cocoa ajz, double_plant ako, melon aly, liquids alw/akr/ant.
  - `aji.a(ahb,IIIIFI)`: quantityDroppedWithBonus, then `nextFloat <= chance`, then getItemDropped, damageDropped and `dropBlockAsItem_do`.
  - `a(Random)` returns 0 for alw, alb, ann, aju and aoh.
  - getItemDropped is null for akh, anu and aoh. In ako it is null for the top half and types 2 and 3; ajh returns null for the head, else `ade.aV`.
  - `ajh.a(ahb,IIIIFI)` skips super for the head.
  - `anu.a(ahb,IIIIFI)`: super, then three `nextInt(15) <= meta` pumpkin/melon seeds.
  - `amf.a(ahb,IIIIFI)`: no super; `2 + nextInt(3)` at meta >= 3.
  - `ajz.a(ahb,IIIIFI)`: age `c(I) = (meta & 12) >> 2`; 3 beans at age >= 2.
  - `anl.a(ahb,IIIIFI)` is empty, and `anl.a(ahb,III,aji,I)` (breakBlock) drops `bL` skull with SkullOwner when meta bit 8 is clear.
  - `aly.a(I,Random)`: `min(9, a(rand) + nextInt(1 + fortune))`.
  - `anz.a(I,Random)`: `1 + nextInt(fortune * 2 + 1)`.
- Executed (existing): leaves, crops, tall grass, web and melon go through the enchantment-effects rules (`enchantment-effects-reference.json`). The new test checks that `crushDrops` matches `harvestBlock` at fortune 0 in items and Random state over 60 seeds per case.
- Port-read:
  - The piston mobility table (PistonProbe) and `tryExtend`'s dropBlockAsItem-then-setBlockToAir order.
  - The world.set funnel skips untracked sets.
  - `ServerDimensions.swap` swaps `sim.items`, which is why the hooks take the dimension's items explicitly.

## Verification
- `node --test src/mppiston83-b83.test.js`: 10 pass. It covers:
  - the item map against `itemFromOriginal`;
  - blocks that draw nothing;
  - parity with harvestBlock;
  - the exact position floats;
  - the class overrides;
  - doTileDrops through the gameRule source;
  - LiveRedstone with a real World (water, wheat, skull from a hooked store, dragon egg);
  - `spawnRedstoneDrop`;
  - a server piston crushing a poppy and dust popping off, with drops in Survival and none in Creative;
  - the server wart.
- Neighbour batch 1 (29 files: away-*, block-audit-columns, block-sweep, chests, command-block, dispense, mpcmd81/82, mpnether2/3, note-jukebox, piston-order, piston-live, powered-rails, pots82, redstone-live, ring-*, smallfixes72, spdispense76, temple-traps, tick-tree*, tile-ticks, tripwire-live): 452 tests, 451 pass, 1 fail. The failure was the pots82 source regex on the old `main.js` hook; it is updated, and pots82 now gives 13/13.
- Neighbour batch 2 (26 files: mpbuckets75, mpbooks66, mpcmd80, mpcontainers2, mpdispense61, mpend3, mpfixes69, mpitems59, mpinventory/2, mpping68, mppistons66, pistons, pistons4/5, pistonpush48, dispenser-piston(+world), piston-item, potspacks79/80/81, flowerpots72, item-entities, enchantment-effects, redstone): 335/335 pass.
- skull, redstone-blocks and tripwire-live: 23/23 pass.
- mpnether-b61/2/3, nether-portal-wart and mpend3 (with the new file): 616/616 pass.
- `npm run build` ok. No full `npm test` and no browser checks, per the track rules.
- Old test updated: `pots82-b82.test.js` matched the old `main.js` drop text (`d.rawDamage ? { rawDamage: d.rawDamage } : undefined`). It now matches the `spawnRedstoneDrop` hook.

## Follow-ups
- BlockSkull.breakBlock drops on any setBlock removal natively, but the port has it only for the piston path (and player break). Explosions, /setblock and the dragon do not drop a skull.
- Carpet support loss (single player `main.js` `carpetNeighbourChange`) has no server counterpart. It is not redstone and was left out.
- The away world has no LiveRedstone drop path checked.
- Double plant: the lower half losing its top after a crush is the Plants system's rule and was not re-checked.
- The Creative-server no-drop convention is not native. 1.7.10 drops in Creative worlds too; only a Creative player's harvest skips drops.
- Browser-only: whether single-player piston drops now sit inside the crushed cell as expected, and whether the server's drops show and can be picked up on a client.
