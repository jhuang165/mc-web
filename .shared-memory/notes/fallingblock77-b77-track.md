# Batch 77 fallingblock77: falling-block drops, TileEntityData, anvil Data above 15, item entity tags

## Summary
Closed: a falling block that times out or cannot land drops `ItemStack(block, 1, damageDropped(Data))`, not damage 0 (src/falling-drops.js; wool, logs, slabs, stained clay, quartz, double plants and the rest use the native formula over Data 0-255). A block whose Item.getItemFromBlock is null (doors, signs, beds, cauldron, flower pot, skull, repeaters and 20 more) drops nothing.
Closed: FallingSand TileEntityData is read (compound only), kept as an nbtToJson tree, saved, restored, exported, read by /summon, and on landing copied into the placed tile for chest, trapped chest, furnace, dispenser, dropper, hopper, brewing stand and sign (src/falling-tiles.js, wired in main.js through the `tile` hook of FallingBlocks).
Closed: the anvil damage roll ran for every landed anvil. Native rolls only when HurtEntities is set and the fall exceeds one block; a summoned anvil with HurtEntities 0 never changes. The anvil keeps its whole Data int (Data 20 drops damage 5, not 1: BlockAnvil.damageDropped is meta >> 2 of the int, the port masked to 15 first).
Closed: Java import of an item entity dropped Owner, Thrower and PortalCooldown (the live item and its own save already hold them); import and export now carry them.
Found wrong in the task brief: native plays aux 1022 only on landing (BlockAnvil.onFinishFalling); an anvil that breaks plays nothing in xj.h (1020 belongs to the repair container). Port already matched.
Found wrong: BlockDoublePlant (175) damageDropped is `(m & 8) ? 0 : m & 7`, my first reading of 16 values said `m < 8 ? m : 0`; the 256-value test caught it.

## Evidence
Executed: tools/probes/FallingBlock77Probe.java -> public/research/falling-block77-reference.json. Block.damageDropped (aji.a) for original blocks 1-175 and Data 0-255, Item.getItemFromBlock (adb.a), and EntityFallingBlock.fall(float) (xj.b) on an anvil: Data in {0,3,4,7,8,11,15,16,17,20,31,64,255}, HurtEntities on and off, distances 0-20, seeds 0-7 (1248 rows kept of 3120).
Command: unzip the jar's classes to a dir, javac with guava, log4j-api, commons-lang3 from tools/research/libs-1.7.10 on the classpath, `java FallingBlock77Probe`, then keep non-zero damage rows, null-item ids and seed < 8 fall rows.
Bytecode-read: xj.h (landing: setBlock with the raw Data int, onFinishFalling with it, then for an ITileEntityProvider with a tile entity the TileEntityData keys except x/y/z are overlaid on writeToNBT and read back; drops use `new add(block, 1, block.a(meta))` through sa.a(add, float), which returns null for a null item or size 0); xj.b(float) (the roll is nested inside HurtEntities and i > 0; stage = a >> 2, damage bits a & 3, stage > 2 breaks); xj.a(dh)/b(dh) (TileEntityData is read when the tag type is 10 and written when non-null); xk.a(dh)/b(dh) (Owner and Thrower: hasKey then getString; written when non-null).
Port-read: tile stores (survival.chests etc., Signs) and the reader readContainerTile are the importer's own.

## Verification
node --test src/fallingblock77-b77.test.js: 8 pass, 0 fail.
Neighbours (anvil-blocks, anvil, anvil-container, falling, falling-damage, entityaudit75-b75, regionimport76-b76, region-export, region-import, summon-coverage, summon-reference, summon2-b68, mpsummon-b67, item-entities, neg-stacks 1-3, zero-stacks, object-tracker*, nbtexport73-b73, away-*, dimension-away): 363 pass, 0 fail. One run showed one failure in away-commands "block light ... re-floods after the throttle" (away-light.js times each flood with performance.now); three reruns passed. Wall-clock dependent, unrelated to this track; not investigated further.
npm run build: ok. Full npm test not run (batch rule). No browser checks.

## Follow-ups
The dedicated server (multiplayer/simulation.js) builds FallingBlocks without a `tile` hook, so TileEntityData is kept and saved there but not applied on landing.
Landing TileEntityData is not applied for mob spawner, skull, flower pot, command block, note block, jukebox, beacon or comparator blocks (the port keeps them in other stores).
Drop item ids for blocks with port-specific item families come from itemForBlock / itemOfBlock2 / blockItemId; water, lava, fire and portal blocks have a native item (ItemBlock) but probably no port item.
An item entity exports Fire -1 (the shared entity() default); native Fire for a ticked item was not probed. Owner or Thrower tags that are present but not strings read as "" natively and are treated as absent here.
