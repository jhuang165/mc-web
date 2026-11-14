# Mining and container alignment (0.6)

## Original GUI coordinates

The earlier 2×2 input positions (98,18) were incorrect. `ContainerPlayer` (`aap`) places them at (88,26) on an 18-pixel pitch, with its output at (144,36). `ContainerWorkbench` (`aaf`) places its 3×3 inputs at (30,17) and its output at (124,35). Item icons occupy 16×16 logical pixels. Those original coordinates now drive the browser sheets without the extra one-pixel margin.

`RenderItem` (`bny`) draws stack counts only above one, anchored at item x+17−textWidth and y+9. Counts now use the native eight-pixel font size, a fixed line height, native shadow and that exact anchor. Counts also appear on multi-item crafting results. The stray Inventory label on the player inventory has been removed; workbench/furnace labels follow their native positions. GUI Scale in Options uses integer scaling with a minimum 320×240 logical viewport. Containers, HUD, glyphs and counts scale together.

Inventory resource storage and crafting clicks remain browser adaptations, not Java's complete cursor/36-slot system. Clicking an ingredient no longer changes the hotbar; Shift-click assigns it to the selected hotbar position.

## Mining rules

The implementation uses the recovered tool/material effectiveness sets and harvest checks, original hardness for supported blocks, per-operation Java float rounding and 20 Hz accumulated damage:

`progress = toolStrength / hardness / (canHarvest ? 30 : 100)`

Wood/stone/iron/diamond/gold material speeds are 2/4/6/8/12 on effective blocks. Dirt and grass now receive the shovel bonus. Inadequate pickaxe tiers can retain their mining speed while losing the harvest and using the 100 divisor. Bare hands, hoes and ineffective tools have strength one; swords use strength 1.5 on the applicable plant/leaf materials. Water and being airborne independently divide strength by five.

Negative hardness is unbreakable. Strength sufficient for an instant break now breaks on the initial click, without the five-tick cooldown used after accumulated breaking. Repeated clicks on the same target no longer erase progress. Changing tool/target or releasing cancels it. Creative swords cannot break blocks. Supported damage overlays follow actual progress.

Durability costs are one for ordinary tools on nonzero-hardness blocks and two for swords. Hoes do not wear from mining. Shears wear on supported leaf/tall-grass cutting, but not wool. Full enchantment/status-effect gameplay, every vanilla block, packet/server timing and exact durability-limit semantics remain incomplete. Pure strength calculation includes the recovered Efficiency/Haste/1.7.10 linear Fatigue/Aqua Affinity modifiers for later integration.

## Further content

Shears can be crafted from two diagonal iron ingots, collect leaves/tall grass, and cut wool faster. Snow requires a shovel and drops four snowballs; four snowballs craft a snow block. Snowballs stack to 16; throwing is ported since this line was written (`src/projectiles.js`, [projectiles](projectiles.md); Batch 69 docs sweep). Gravel has a one-in-ten flint drop, and bookshelves drop three books. Six planks and three books craft a bookshelf.

## Original-tool verification

`tools/verify-mining.mjs` extracts and executes unchanged original `acg`, `adn`, `abf`, `ady`, `aeh` and `adx` classes (ItemTool, Pickaxe, Axe, Spade, Sword and Shears) from the SHA-1-verified client. Minimal material/block/world/item test doubles isolate their behavior; supplied hardness/material fixtures do not execute the original world or controller. A Java harness calculates float damage and accumulation using the recovered formula.

All **2,640 cases** agree on strength, harvest eligibility, damage increment, accumulated break ticks and wear. [Reference results](mining-reference.json) are regression-tested by the browser code's test suite. Raw game classes stay in ignored research storage.

Float accumulation can add a tick relative to a simple real-number formula: hand-mining a log takes 61 accumulated client ticks (3.05 seconds), while a diamond pickaxe takes 188 ticks (9.4 seconds) for obsidian. Instant-break cases are recorded as zero accumulated ticks because the initial click destroys the block.

Browser geometry checks verify both crafting grids, output positions and count anchors against the original logical coordinates. UI interactions and the automated suite validate crafting, tool behavior and existing gameplay.
