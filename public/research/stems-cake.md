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
- No darkness pop (BlockBush.canBlockStay light test); stems only pop when farmland is lost.
- Left click does not eat a slice; only right click does (not checked in the original).
- Melon Fortune cap of 9 is not implemented (melon drops 3-7 slices without Fortune).
- Clicking a cell to place the cake uses the door replaceable set, slightly wider than ItemReed's snow, vine, tall grass and dead bush rule.
- Bone meal sparkles are generic; villages and structures do not place stems or cake; the render path was not checked in a browser; region import/export relies on the registry mapping and was not tested separately.
- Stem growth uses its own `JavaRandom`, not the world's tick random.
