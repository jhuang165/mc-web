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
