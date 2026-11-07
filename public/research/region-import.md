# Import a Java 1.7.10 region area (WORLD-03g)

`src/region-import.js` converts up to 8×8 chunks (128×128 blocks, Y 0–255) from one or more 1.7.10 `.mca` files into a new Blockworld export. The existing **Import** screen accepts it unchanged. It extends the single-chunk [terrain preview](chunk-preview.md) and composes [region containers](region-file.md), [chunk NBT](chunk-nbt.md) and the block registry. It is a one-way conversion. It does not open a Java world in place or write anything back, and it is not full save migration.

```sh
# Generator area of the source seed (recommended): surrounding and untouched terrain match.
node tools/import-java-region.mjs --seed -4172144997902289642 --out spawn.blockworld.json world/region/r.-1.0.mca world/region/r.-1.1.mca
# Any area of up to 8x8 chunks, north-west corner at chunk (-3, 30):
node tools/import-java-region.mjs --area -3,30,4,4 --out base.blockworld.json world/region/r.-1.0.mca
```

A whole save (`--save World`, or `--level level.dat`) imports level.dat, the player and stats/<uuid>.json and continues the world with its own seed, WorldType and generator options: see [level-dat](level-dat.md).

Options: `--landscape java|javaAmplified|javaLargeBiomes` (match level.dat `generatorName`), `--destination cx,cz`, `--missing generated|air`, `--survival`, `--name`, `--no-sky`, and `--report report.json`. Inputs open read-only, are capped at 64 MiB each, and must have canonical `r.<x>.<z>.mca` names. Outputs must be new files. The JSON report goes to stdout. A rejected conversion still prints its report when one exists.

## How the export is built

The browser has no Java save loader. An imported version-9 Java world is its seed's generated 128×128 area plus a list of per-cell `edits` (`World.restore`). The converter generates the base world for `--seed`, maps every source cell through `fromOriginal`, and records only the cells that differ.

- **Placement.** Source chunk `(area.chunkX + i, area.chunkZ + j)` becomes live chunk `(destination.chunkX + i, destination.chunkZ + j)`. Local cell offsets and Y are kept. Region, slot and embedded `xPos`/`zPos` are all checked. Negative chunks use Java signed shifts. Tile entities and dropped items move by the same block offset. The default destination is the generator position when the area lies inside the base world's generated chunks; otherwise the area is centred.
- **Edit budget.** `World.restore` accepts 100,000 edits, and the Import screen accepts files of at most 8 MiB. When the base seed is the source world's seed and the area is its generator area, only player edits and population need edits: ores, trees and structures. Terrain shape, caves and ravines regenerate identically. An unrelated base seed differs at nearly every surface and cave cell. With an unrelated seed, expect only a few chunks to fit; check the report's `edits`. A full 8×8 area does not fit. Over-budget conversions fail and report the edit count. They are never truncated.
- **Missing chunks** (an empty slot or a region file that was not supplied) are listed with the reason. `generated` (default) keeps the base world's terrain there. `air` clears the full column to void, which costs edits.
- **Light** is not carried. The browser recomputes sky and block light from cells on launch, as it does for every import. Source `SkyLight`/`BlockLight` arrays are only validated.
- **Biomes** are not carried: the export format has no biome field, and the generator supplies biomes. The report compares source `Biomes` bytes with the base world's: `compared`, `matching`, `differing`, `unset` (255).

## Contents

- **Blocks** use `fromOriginal`. Unsupported states become air; the report lists them by `id:meta` as `unmapped` (registered) or `unregistered` (unknown, including Add-nibble high IDs). Approximations list the browser target and any runtime state the export cannot hold: fluid `flowing`, farmland `moisture`, furnace `facing`/`lit`. Chest facing is not counted as an approximation because each chest cell gets a chest record with its facing.
- **Chests** (`Chest` tile entities on a chest cell) carry 27 slots (`Slot & 255`, like TileEntityChest). **Furnaces** carry three slots (signed Slot), `BurnTime` and `CookTime`. The fuel's burn time is recomputed, matching TileEntityFurnace.readFromNBT. These records go in `player.chests`/`player.furnaces`, which `legacyPlayer` and `Survival` already load. Omitting `player.slots` keeps the default Creative hotbar.
- **Items** map through the same original-ID table as the item catalogue (`tools/inventory-replay.mjs` `MC_IDS`, checked equal in the tests). Durability is kept (clamped to the maximum). Wool, flower and dye damage are kept as variants. Other non-zero damage values are unsupported. Item NBT tags (enchantments, names) are stripped and counted. Counts above the browser stack limit are clamped. Non-positive counts and unmapped items are lost by `id:damage`.
- **Entities**: dropped items (`Item`) convert to saved drops. Pos, Motion, Age (≤5,999) and PickupDelay (≤40, the browser cap) are kept, up to the 512-drop load limit.
- **Mobs** convert to saved EntityWorld mobs (`java-mobs.js` `importedMobType`, up to 256):
  - `JAVA_MOBS` ids use their own readers: Villager, VillagerGolem, Zombie, Slime, LavaSlime, Enderman, Squid, Bat, PigZombie, Ozelot, EntityHorse, Blaze, Ghast, WitherBoss, Skeleton, EnderDragon and EnderCrystal.
  - `JAVA_SUMMON_MOBS` ids use the `/summon` reader: Pig, Cow, MushroomCow, Sheep, Chicken, Wolf, Spider, CaveSpider, Creeper, Witch, Silverfish and SnowMan. EntityList.createEntityFromNBT is the same call for chunks and `/summon`.
  - Their layouts and read-back come from [mob-nbt-reference.json](mob-nbt-reference.json) (MobNbtProbe, 22 records). HealF is clamped to the saved `generic.maxHealth`, because EntityLivingBase reads Attributes first. A tamed wolf whose Attributes still say 8 therefore loads with 8 health. The sheep fleece is `Color & 15`. Fire is kept, and so are CustomName and PersistenceRequired.
  - Creeper `Fuse` (short) and `ExplosionRadius` (byte) are kept as the mob's `maxFuse` and `explosionRadius`, which the live creeper uses for its fuse, flash, fall and explosion size (powered doubles the radius). The chicken-jockey flag has no browser state and is dropped.
- **In-flight projectiles** (`java-projectiles.js`) convert to the browser's saved projectile lists: `Snowball` and `ThrownEnderpearl` (`projectiles`), `ThrownPotion` and `ThrownExpBottle` (`thrownPotions`) and `Arrow` (`arrows`), with Pos, Motion and Rotation, a potion's `Potion` stack (or the legacy `potionValue`), and an arrow's tile, `inTile`/`inData`, `shake`, `inGround`, `pickup`, `damage`, `life` and `Fire`. A named `ownerName` becomes the local player. An ender pearl with no owner, a potion that is not item 373, projectiles outside the area or past the list limit, and fireballs (the browser saves none) are counted as lost, with the reason in the id. Layouts: [projectile-nbt.md](projectile-nbt.md).
- **Paintings and item frames** become `hanging` records and **minecarts of every type** become `minecarts` records (since batch 13; [level-dat](level-dat.md)).
- **Boats and mounts**: `Boat` entities become `boats` records. A `Riding` chain whose mounts are mobs, boats or minecarts keeps the pairs: mobs link by id and a vehicle at the end of the chain is named by the rider's `riding` (`boat-<id>`, `cart-<id>`); nothing rides beyond a vehicle (native chains never do). Verified on native chains in [riding-nbt-reference.json](riding-nbt-reference.json).
- Other entities and entities outside the area are counted as lost by ID.
- **Other tile entities** (signs, spawners, chests without a chest cell, entries outside their chunk) and **scheduled ticks** (`TileTicks`) are counted as lost.

The default mode is Creative. The start position is above the area's centre column.

## Evidence

`src/region-import.test.js` writes regions with the JS NBT/region writers, then re-imports every export through the Import screen's acceptance path: the envelope checks, `World.restore`, `importedRuntime`, `Survival` and `ItemEntities.load`. Cases:

- a 2×2 area across four negative/positive regions, with a missing region and an unused region;
- chest, furnace and item-entity conversion, plus mob conversion and lost signs, riders, bad slots, tags and an off-chunk tile;
- unmapped, unregistered high-ID and approximated states;
- a full 8×8 generator area rebuilt from its own seed in exactly two edits, with all 16,384 biome bytes matching; the same chunks under a misaligned base exceed the budget;
- three original AnvilChunkLoader payloads from [chunk-nbt-reference.json](chunk-nbt-reference.json), whose cell inventory equals [region inspection](region-inspection.md);
- malformed names, duplicates, oversized areas and slot/payload coordinate mismatches.
- `src/projectile-nbt.test.js`: the native projectile and creeper Fuse/ExplosionRadius records import, restore live, survive a whole region import (report counts them as converted) and survive export→import.
- `src/mob-nbt.test.js`: each of the 22 native mob compounds imports with the native getters' values, restores live, survives a whole region import, and survives export→import (13 browser mobs, including a charged creeper and an owned wolf).

No real Java save with tile entities is checked in. Chest/furnace NBT layouts were read from the pinned JAR's `aow`/`apg` readFromNBT.

## Open

The browser still lacks streaming beyond 128×128, a compact cell payload (the 100,000-edit limit dominates), biome and light import, tile-entity factories beyond chests/furnaces, mob riders and the remaining entity ids, item NBT, pending ticks, and Java write-back. level.dat/player/stats import is in [level-dat](level-dat.md) (one area per import).

## Whole-save import (batch 15)

The browser Import screen's "Java save folder..." now imports every chunk of `region/*.mca`, `DIM-1/region` and `DIM1/region` (`src/whole-save-import.js`). The CLI (`tools/import-java-region.mjs --save DIR --whole-save --out w.blockworld.json`) converts the same whole save and embeds the stored columns as JSON `bases` (`src/whole-save-cli.js`, `src/whole-save-json.js`); without `--whole-save` it stays area-only. The browser Export JSON now also carries `bases` (base64 columns keyed by dimension, capped at 96 MiB of JSON under the importer's 128 MiB limit; columns that do not fit are counted in `wholeSave.basesOmitted` and regenerate from the seed, which the import toast says). The Java ZIP export still keeps its blockworld.json backup without bases, because the Anvil regions carry them. Not browser-checked end to end; covered by `whole-save-json.test.js` and `whole-save-cli.test.js`.

- **Stored full columns.** Each saved chunk becomes a record in a new IndexedDB store `bases` (database version 5, keyed `[world, x, z]`; Nether and End use the `<id>~-1` / `<id>~1` view ids). A record holds the non-empty 16-high sections (block ids and metadata nibbles), the biome bytes and the TerrainPopulated/LightPopulated flags (`src/whole-save-columns.js`). `World.terrainFor` returns a stored column instead of running the generator, so a native chunk loads exactly as saved; chunks missing from the save generate from the seed. Player edits made afterwards are the usual per-column edit records replayed on top of the stored column.
- **Streaming.** One region file is held at a time, converted chunk by chunk through the existing converter (`importJavaRegionArea`, with a stand-in sink world and a one-chunk region file per call), and written in batches of 16 with yields to the event loop. The Import screen shows the chunk count and region file number; Cancel aborts and deletes the partial store. A damaged chunk or region file is skipped and listed in `report.save`. A streamed world hydrates stored columns only for the 8x8 window around the player (exact-key reads).
- **Runtime state.** Tile entities and containers, entities (mobs, items, vehicles, riders, hanging entities, projectiles), pistons and similar records come through the existing converters and are merged into the world record (Overworld) or the dimension record. Rider ids and vehicle ids (boats and carts, which the area importer numbers from 1000000 in every call) are remapped to stay unique across the save, and the `riding` links follow (`whole-save-import.test.js`, two chunks each with a ridden boat).
- **Population.** Imported columns are marked claimed (`populatedColumns`) so the streaming population does not add generated chests, animals or structures to them. The browser's population is stateless per 8x8 cell and cannot run `Chunk.populateChunk` on one imported column, so a chunk saved with TerrainPopulated false loads bare as saved (no ores, trees or structures). The flag is kept: the Java export writes TerrainPopulated back as it was, so Java populates such chunks natively. LightPopulated is always exported false. A generated neighbour may still receive overhang (trees, ores) from the cell population that would have run for an imported chunk; this approximates the Java rule that populate also touches the +x/+z neighbours.
- **Export.** The Java ZIP export reads the stored base of every column that was not edited live and writes it back (blocks, metadata, biomes, flag), so an imported world round-trips; the export limit is raised to 16384 columns for an imported world.
- **Evidence.** `src/whole-save-import.test.js` (10 tests): a fake save of region files across the three dimensions built with the repo's NBT and region writers, the codec, batching, claim bits, lazy exact-key hydration, generation of missing chunks, damaged columns, ZIP round-trip and delete. Bytecode-read, not probed: the population neighbour rule. No real 1.7.10 save of large size was imported.
- **Not covered.** Portal-search and `/spreadplayers` height peeks do not see stored columns for non-resident columns; the prefetch worker generates terrain that is then not used for imported columns; the Blockworld JSON export omits stored columns (use the Java ZIP); the `world-import.js` list caps (4096/1024 entries) still apply to the merged record; biomes are stored and exported but not used for rendering; lighting is recomputed. Not full parity.
