# Batch 72 flowerpots72: flower pot sweep, legacy big oak, structure-seed spawn

## Summary
- `tools/probes/PotSweepProbe.java`, `tools/verify-pot-sweep.mjs`, `public/research/pot-sweep-reference.json` (new): the unchanged BlockFlowerPot / TileEntityFlowerPot over every item id 1-2300 at damage 0-15 (both modes), NBT reads, support over every block id and metadata.
- `src/stone-utility.js`: `potNbtOf` / `potFromNbt` (native `Item` / `Data`). `src/gen-world.js`: `FLOWER_POT_CONTENTS` exported for the replay (values unchanged, all 16 metas match).
- `src/doors-panes.js`: `solidTopSurface` counts the redstone block (123); native pot support, bed and door floors allow it (found by the sweep).
- `src/tree-growth.js` `growBigOak`, `src/trees.js` `growTree`: legacy 64-high oaks run the ported WorldGenBigTree on the 1-in-10 roll.
- `tools/find-structure-seeds.mjs` uses `solveNativeSpawn` (generation 18) for spawn and origin; `public/research/structure-seeds.md` regenerated (0-200); stale `src/fluids.js` comment fixed.
- Dated Batch 72 lines in `stone-utility-blocks.md`, `trees.md`, `world-spawn.md`. Tests: `src/flowerpots72-b72.test.js`.

## Evidence
- executed: pot acceptance (113 native stacks: items 6, 32, 37, 38, 39, 40, 81 at any damage 0-15, tall grass 31 at damage 2; ItemBlock only), stored item/data, block meta = held damage, break drops, NBT Item/Data, NBT reads (unknown ids give an empty pot), full pot and missing tile refuse, `canPlaceBlockAt` over all blocks/metas.
- bytecode-read: `ald.a(aji,int)` rule list, `ald.a(...,yz,...)` flow, `ahb.a(ahl,III)` (blocksMovement + renderAsNormalBlock, so redstone block is solid), `apf` read/write, `ahb` bounds not checked by `WorldGenBigTree` (reads air above build limit).
- recalled: the exact cut-off of a big oak at the native 256 limit (code-read only); no executed big-oak-at-64 probe exists.

## Verification
- `node --test src/flowerpots72-b72.test.js src/stone-utility.test.js src/trees.test.js src/dimension-trees.test.js src/block-sweep.test.js src/catalogue-consistency.test.js src/content-catalogue.test.js src/fluids.test.js`: all pass.
- `npm run build` once at the end. Full npm test not run (batch rule). Nothing checked in a browser; a browser could show the cut-off big oak shape and the pot render of redstone-block-standing pots.

## Follow-ups
- Native stacks the port cannot hold (dandelion damage 1-15, red flower 9-15, sapling 6-15, etc.) are not representable; `/give` of them is refused earlier. The meta quirk (block metadata = held damage, so a reloaded pot may show another plant) is kept only through `world.pots`.
- No pot-specific chunk NBT import/export (`chunk-nbt.js` keeps `TileEntities` opaque); `potNbtOf`/`potFromNbt` are ready but unwired.
- Legacy big oak truncation at y 63 is by convention; an executed 64-high probe is not possible (native has no such world).
- Only 0-200 seeds in the atlas; regenerate for more with `node tools/find-structure-seeds.mjs 0 N --write`.
