# Live Java Overworld population (0.25.0, generation version 11)

Target: Minecraft Java 1.7.10. This is finite population integration, not full parity.

New default, amplified and large-biome Java worlds now run terrain, biome surfaces, caves and ravines, then the population chain: mineshafts first on the population Random, water/lava lake gates, eight dungeon attempts, biome decoration (ores, every ported tree/plant/biome override, springs), passive worldgen animals, then ice/snow. `src/population-world.js` composes the previously standalone ports. Villages, strongholds and temples are absent: their RNG draws, writes and village lake-suppression result are absent too.

## Finite order and compatibility

All 64 live chunks get their terrain and mineshaft start search before population. The 64 population calls run x outer, z inner in absolute Java chunk coordinates. Reads/writes outside the live 8×8 area use lazy terrain/cave/ravine chunks; these halo chunks are never populated or searched for additional structure starts. Their final writes/entities are discarded. This deliberately replaces the v10 ring/load-trigger schedule only for v11. The first eight columns at the negative edges receive no population from outside the area; features crossing a boundary are clipped by the finite playable viewport. This is not an infinite-world exploration-order claim.

Generation has one deterministic World.rand seeded 0, separate from the provider's population-seeded Random. Every world gets fresh biome/decorator/tree state. Saved v9 and v10 worlds keep their generators. SHA-1 fingerprints for four worlds of each version match the pre-population adapter from f42986f; internal block IDs are appended, never renumbered. Population writes never enter the saved edit list.

The original-ID generation world uses real-layout Chunk storage and the ported notifications, chest/spawner callbacks, rail/torch behavior, immediate liquids and falling blocks. A new v11-only callback handles water washing mineshaft cobwebs into string. Generation light remains an explicit fixture: full/block light 0, saved sky 15. The native probe uses the same services. Native propagated-light population acceptance remains open; the live renderer computes its light volume after generation.

## Content audit and play

`node tools/enumerate-population-blocks.mjs` builds [population-blocks.json](population-blocks.json): 243 conservative ID/metadata states in 60 original block families, plus 183 biome-slot/world-type entries. The write-domain table comes from the setter arguments and metadata expressions of all ported generators and callbacks; the executable decorator scan supplements it, rather than pretending sampling proves rare branches absent. All 61 occupied slots are inventoried. Nether/End slots 8/9 are explicitly excluded from the Overworld execution scan; their dimension-specific decorators are not Overworld population targets. Conservative legal metadata supersets are not claims that every value occurs naturally.

Added internal blocks 63–84: lapis/redstone/lit redstone/emerald ore, pumpkin, monster egg, double plants, second log/leaves families, vines/cocoa, mossy cobblestone, both small and giant mushrooms, dead bush, packed ice, melon, sandstone slab, dead shrub and fern. Existing log/leaves/sapling/plank metadata now exposes all six tree species; old internal IDs stay fixed. Original textures, selection/collision, mineral tiers/variable drops/XP, plant support breaks, cocoa growth, redstone activation, vine climbing, fire/material/light properties, Creative ordering, relevant crafting and ore/log smelting are wired. Native shadow and normal-cube censuses were extended. Sand/red sand, podzol, sandstone, mycelium and stained/hardened clay keep their original metadata. Saplings select the existing ported native tree generators; spruce/jungle squares and required dark-oak squares are recognized. The old oak growth path remains for old oak-only worlds.

New drop/loot items include emeralds, melon slices, cookies, bowls/stew, golden apples, two music discs, name tags and remaining horse armor. Cocoa is the existing dye damage 3; lapis damage 4 and redstone item 360 remain unchanged. Item mappings and inventory validation retain subtype damage and stored book enchantments. `tools/build-population-creative.mjs` regenerates the native tab/search order.

## First launch, saving and import

`world.generatedStructures` now also lists dungeon chests with facing/slots and passive animals. `restoreStructureEntities` still handles all dungeon/mineshaft spawners and chest minecarts. `restorePopulation` imports generated chests and supported animals only while the record has no saved structure state. Afterwards the saved spawner/cart marker, player chest tiles and entity array win, including empty arrays and empty inventories. A preexisting live chest is never overwritten. Broken spawners remain gone; looted chests remain looted.

Supported population animals: pigs, cows, sheep (native fleece) and chickens. Horses, wolves and mooshrooms are recorded in generation but not instantiated because their browser entity types are absent. Ocelots are absent from browser play too, but are not part of 1.7.10's passive `performWorldGenSpawning` lists. Entity-specific unseeded Random outcomes remain outside the native replay contract.

The existing export/import path carries validated Survival chest slots/facing, entities, spawners and minecarts. It does not re-import generation loot on reload. Pending generated liquid ticks enter the live fluid queue only on first launch. Non-liquid generation ticks and generation-time item drops are recorded/counted, not instantiated as live state.

## Native and browser evidence

`tools/probes/PopulationWorldProbe.java` + `node tools/verify-population-world.mjs` execute unchanged `ChunkProviderGenerate.provideChunk` and `populate`, with map features enabled and no-op village/stronghold/temple objects. The mineshaft classes and World/Chunk block callbacks are unchanged. The client JAR is SHA-1 pinned to e80d9b3bf5085002218d4be59e668bac718abbc6. The classpath includes its resources and Commons IO so native horse construction actually succeeds; any probe exception rejects the run.

[population-world-reference.json](population-world-reference.json) contains twelve 8×8 worlds: seeds 0, 17, 10 and 8675309 in each of default, amplified and largeBiomes. `population-world.test.js` replays all 768 populates: initial and final chunk hashes, ordered call/write hashes, provider and World RNG, every chest/spawner, cart inventory, animal, and pending tick, then checks all 50,331,648 live mapped cells end to end. Original IDs remain in the reference. Java 8+ HashMap iteration order is used, as with the mineshaft port.

Port acceptance tests cover all six saplings, native mineral tiers/drop metadata, paired-plant support, lit redstone, exact write-domain mappings, assets, and JSON/export-import reloads with looted chests and killed animals. These are browser-port regressions, not original WorldServer tick acceptance.

Local browser check at localhost:5179, game sound disabled for the QA tab without changing saved options: seed 17 forest, cave-wall coal/iron, a dungeon at local chest (10,39,92) with live loot and spawner, and a mineshaft corridor near (14,43,63); seed 7 taiga spruce near (8,64,23). The dungeon name tag was shift-transferred, saved, page-reloaded and verified in player inventory with its old chest slot empty. No console errors/warnings. All three scratch worlds (17, 2, 7) were deleted. Temporary visual QA controls were removed from source.

Warm Node generation benchmark, seed 17 default, median of three measured runs after one warmup: v9 441.5 ms; v10 549.0 ms; v11 765.9 ms. V11 adds about 217 ms over v10 on this machine; this is generation time, not renderer build time.

## Remaining losses

No villages, strongholds, temples, streaming, structure NBT or native light propagation during population. Wolves/horses/mooshrooms are omitted live. Silverfish release/AI from monster eggs, pumpkin golems, giant-mushroom growth from small mushrooms, vine random spread, complete bush/mushroom random ticking and every native plant placement nuance remain open. Cocoa and giant-mushroom face UVs and sunflower head geometry are simplified. Golden apples currently provide food without their potion buffs; discs, name tags and horse armor are collectible items without their associated systems. These content behavior/rendering gaps remain tracked separately from exact generation writes. No full parity claim.
