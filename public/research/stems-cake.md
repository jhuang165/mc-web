# Pumpkin stem, melon stem and cake (Java 1.7.10)

Original blocks 104 (pumpkin stem), 105 (melon stem) and 92 (cake) map to internal BLOCKS 159, 160 and 161. The cake item (original 354) is internal item 1930. Seeds (361, 362), melon slices (368), milk bucket (343), sugar, egg and wheat reuse existing items.

## Evidence

`tools/probes/StemCakeProbe.java` drives the unchanged BlockStem (`anu`), BlockCake (`aju`), ItemReed (`abi`) and FoodStats (`zr`) with a map-backed world double and Random subclasses that record every `nextInt`. `tools/verify-stem-cake.mjs` writes `public/research/stem-cake-reference.json` (5290 records: 2048 stem ticks, 192 fruit placements, 256 bone meal, 512 seed drops, 80 bounds/colour/direction, 24 pops, 7 cake bounds, 1176 eating cases, 176 support and 176 canPlace rows, 7 cake pops, 20 ItemReed placements). `src/stems-cake.test.js` replays all of them against `src/stems-cake.js`, consuming the recorded rolls with their bounds.

## Behaviour

- Stems (`stemTick`): light at y+1 must be 9 or more, growth rate from the crop formula (farmland 1, wet 3, neighbours a quarter, halved by row-and-column or diagonal stems of the same kind), age +1 on `nextInt(25/rate + 1) == 0`. At age 7 and with no fruit on a side, the fruit goes to `nextInt(4)` on a free cell above farmland, dirt or grass.
- Bone meal: age + 2 + nextInt(4), capped at 7; refused at 7. Break and pop: three rolls of nextInt(15) <= age, one seed each. Bounds 0.375..0.625, height (age*2+2)/16, colour `(a*32)<<16 | (255-a*8)<<8 | a*4`. Seeds plant a stem on farmland with air above.
- Cake: item places the block on a solid block (ItemReed rules), 7 bites (meta 0..6), bounds shrink from x = (1+2*meta)/16. Right click when food < 20 and not Creative: +2 food, 0.4 saturation (capped at food), meta + 1, removed at the seventh. The click is consumed even when full. No drops; it pops when its support is not Material.isSolid (the table from `signs.js`, checked against all 176 probed ids). Milk buckets in the recipe (`AAA/BEB/CCC`) leave empty buckets (`craftContainer`).
- Browser wiring: block registry, textures (8 tiles), tinted crossed stem and boxed cake in `scene.js`, farming (`Farming.grow` and `fertilize`), creative Foodstuffs tab, drops, lighting, explosion resistance, crafting container return.

## Gaps

- The big-stem geometry beside a fruit is approximated, not replayed from `RenderBlocks.func_147740_a`.
- Batch 71 (docs sweep, 2026-11-14): closed. `src/render-vessels.js` 82-84 ports `func_147795_a` and `func_147740_a` (bytecode-read) and the mesher uses it for stems 104 and 105 (`src/chunk-mesher.js` 729-735); [post shaders](post-shaders.md) records the stem streams matching the native vertex record (`render-types-2-reference.json`, 432 vertices).
- Batch 80 renderfx80: now executed, not only bytecode-read. `RenderFx80Probe` calls the unchanged `blm.a(anu, meta, dir, height, x, y, z)` (func_147740_a) and `blm.a(aji, meta, height, x, y, z)` (func_147795_a) for both stems, four directions, heights 1, 0.875, 0.5 and 0.125 and four cells out to +-30000 (160 records in `renderfx80-reference.json`); `src/renderfx80-b80.test.js` matches `render-vessels.js` `stemBig` / `stemSmall` vertex for vertex (float positions and uvs). The legacy `stemQuads` in `stems-cake.js` (an approximation, not used by the mesher) is now the same quad list in block-local coordinates, checked against the same records.
- No darkness pop (BlockBush.canBlockStay light test); stems only pop when farmland is lost.
- Left click does not eat a slice; only right click does (not checked in the original).
- Batch 71 (docs sweep, 2026-11-14): wrong, and a real gap. BlockCake (`aju`) overrides `Block.onBlockClicked` (`a(ahb,int,int,int,yz)`): javap shows its body calls the private eat method `b(...)`, which tests `EntityPlayer.canEat(false)` (`yz.g(Z)Z`) and calls `FoodStats.addStats` (`zr.a(IF)V`); the base `aji` method at the same signature is empty. So a left click eats a slice in Survival. The port wires `onBlockClicked` for the dragon egg, note block and redstone ore only (`src/player-edit-simulation.js` 599-605 `serverClicked`), not for cake; the right click path is `player-edit-simulation.js` 337-345.
- Melon Fortune cap of 9 is not implemented (melon drops 3-7 slices without Fortune).
- Batch 71 (docs sweep, 2026-11-14): closed. `src/enchantment-effects.js` 71 gives melon (103) `Math.min(9, 3 + nextInt(5) + nextInt(1 + fortune))`.
- Clicking a cell to place the cake uses the door replaceable set, slightly wider than ItemReed's snow, vine, tall grass and dead bush rule.
- Bone meal sparkles are generic; villages and structures do not place stems or cake; the render path was not checked in a browser; region import/export relies on the registry mapping and was not tested separately.
- Stem growth uses its own `JavaRandom`, not the world's tick random.
- Batch 71 (docs sweep, 2026-11-14): still open. `Farming.growStem` (`src/farming.js` 31) draws from `this.stemRandom`, a `JavaRandom` seeded from `Math.random`, not the world tick random; crops pass the caller's random (`farming.js` 38).
- Batch 71: found wrong, no code change. The "no darkness pop" gap assumed the 1.6 `BlockBush.canBlockStay` light test. Bytecode of 1.7.10 `ajr` (BlockBush): `j` (canBlockStay) is only `canPlaceBlockOn(block below)`; `anu` (BlockStem) overrides neither `j` nor the light test, and its `updateTick` runs `checkAndDropBlock` (soil only) before the `light >= 9` growth test. A stem therefore never pops in the dark natively, and the port is correct.
- Batch 72 (2026-11-14): closed. A left click on a cake eats a slice (`BlockCake.onBlockClicked`, `aju`: same eat method as the right click, `canEat(false)` then food 2, saturation 0.1, metadata + 1, cleared at 6, no Creative eating). Single player: `src/player-edit-simulation.js` `serverClicked` calls `eatCakeSlice` (also used by the right click); the dig of the cell then goes on as natively. Dedicated server: new `src/multiplayer/server-cake.js` (`serverCakeEat`) on a dig start (`handleDig` status 0) and on a right click, which had no cake handling there at all. Tests: `src/cakefog-b72.test.js`. The eat path is bytecode-read, not executed against the jar. Note: `aju.b` has no playSound call in the bytes read; the single-player right click still plays `random.eat`, not re-checked.

Batch 72 (spawncaps72, 2026-11-14): stem growth draws from the caller's world random (`Farming.randomTick` passes it to `growStem`), as BlockStem.updateTick does; the private `stemRandom` is only the fallback of the legacy hash tick.
