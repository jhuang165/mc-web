# level.dat, player data and stats import (1.7.10)

`src/level-dat.js` reads a 1.7.10 `level.dat`, the singleplayer player and `stats/<uuid>.json`, and `importJavaRegionArea(regions, { level, player, stats })` (`src/region-import.js`) turns them, with the region area around the player, into a Blockworld export that continues as the source world: same seed, same WorldType and generator options, streamed (endless) in the generator's native frame. The CLI is still a one-way conversion of one 8×8 chunk area. The browser Import screen (batch 15, `whole-save-import.js`) imports the whole save: every chunk of `region/`, `DIM-1/region` and `DIM1/region` becomes a stored full column, see [region-import](region-import.md#whole-save-import-batch-15).

```sh
# The 8x8 chunks around the player (else the world spawn), with level.dat, the player and stats/<uuid>.json:
node tools/import-java-region.mjs --save ~/minecraft/saves/World --out world.blockworld.json
# A chosen area; a dedicated-server world or a second player:
node tools/import-java-region.mjs --save World --area -3,30 --player-file World/playerdata/<uuid>.dat --out base.blockworld.json
# level.dat with explicit region files:
node tools/import-java-region.mjs --level World/level.dat --stats World/stats/<uuid>.json --out w.blockworld.json World/region/r.0.0.mca
```

With `--save`, the player is `Data.Player`; when level.dat has none (a server world), the only `playerdata/<uuid>.dat` (1.7.6+) or else the only `players/<name>.dat` is used (several need `--player-file`), and the stats file follows the player's uuid (or the only file). `--generation 13|15` overrides the streamed generation version. `--destination`, `--landscape` and other dimensions are refused: a level import keeps the overworld in the generator's native frame.

## Evidence

`tools/probes/LevelDatProbe.java` + `tools/verify-level-dat.mjs` (run with `MC_RESEARCH=<dir with minecraft-1.7.10.jar>`; needs a JDK and the guava, log4j-api, commons-lang3, authlib, commons-io, gson and netty jars) drive the unchanged classes and write [level-dat-reference.json](level-dat-reference.json):

- `worldTypes`, `parseWorldType`: the WorldType table (id, name, generator version, `getWorldTypeForGeneratorVersion`) and WorldType.parseWorldType on 9 names.
- `gameRules`/`ruleValues`: GameRules' 9 defaults and the boolean/int readers.
- `settings` (5): WorldInfo built from WorldSettings (default Survival, Superflat Creative with cheats, Large Biomes hardcore, Amplified Adventure without structures, default_1_1) and written with `cloneNBTCompound`, then read and written again.
- `reads` (17): hand-made Data compounds read by WorldInfo(NBTTagCompound) and written again: generator version 0/missing, upper-case and unknown names, missing generatorName, flat options, missing DayTime/allowCommands/MapFeatures/initialized, GameType 7, weather, custom game rules, a player dimension, Difficulty.
- `players` (16): EntityPlayer through its real constructor, loaded with Entity.readFromNBT and saved with writeToNBT (SaveHandler's calls), with the loaded getters: fresh, a rich survival player, creative flying, legacy Health, health over 20, SelectedItemSlot 12, food over 20, XP progress over 1, odd inventory and ender slots, the Nether, no spawn, no abilities, no food, fire/air, odd effects.

`src/level-dat.test.js` replays every record (11 tests): WorldType parsing, game-rule defaults, every `reads`/`settings` field through `readLevelData`, the generator choice, every `players` record through `javaPlayerFromNbt` and then the live `Survival`/`Experience` loaders, the export's `levelNbt` key set and tag types against the native `settings` and rich player written compounds, stats progress both ways, a browser world exported to Java and imported back with its level.dat (same seed and generator, the edits equal, 64 columns, all biomes matching, player, hanging entities, all cart types, stats), a gzip level.dat with a Nether player, and the 11 native painting/item-frame `nbt-read` records of [hanging-reference.json](hanging-reference.json) through the region reader (direction, wall block, art, item, rotation and the live entity's position). `src/world-import.test.js` covers the new backup fields.

The user's own saves (read-only) are 1.8+ (Border*, DataVersion), so no real 1.7.10 save was checked; one 1.12 Forge save imported through `--save` and reported its newer keys as ignored or lost.

## Verified mappings (probe)

- **Generator.** `generatorName` is parsed case-insensitively; an unknown name is `default`; `default` with `generatorVersion` 0 or missing is `default_1_1` (now a browser streamed type). `generatorOptions` is kept for Superflat. The written `generatorVersion` is 1 for default and 0 for the others.
- **WorldInfo defaults.** Missing `MapFeatures` and `initialized` are on; missing `DayTime` is `Time`; missing `allowCommands` is `GameType == 1`; an unknown GameType is Survival; `Difficulty` is not a 1.7.10 WorldInfo key (read nowhere, not written by the export any more). GameRules start from the 9 defaults and keep custom rules and values verbatim.
- **Mode.** The player's `playerGameType` (EntityPlayerMP) wins over `GameType`; Adventure imports as Adventure.
- **Player.** `HealF`, else the legacy short `Health`, clamped to 20 as setHealth does; Inventory slots 0-35 and 100-103, EnderItems 0-26, others lost; effects with an unregistered id dropped, amplifier -1 and duration 0 kept; food level, saturation, exhaustion, timer, XP level/total/progress, Fire, Air and FallDistance kept as read (no clamping); `SelectedItemSlot` read as is (the browser clamps it to the hotbar and reports it); missing `abilities` gives the PlayerCapabilities defaults; the bed spawn needs all of SpawnX/Y/Z.
- **Export.** `levelNbt` writes the native key set and tag types: Health (short, ceil) and HealF, AbsorptionAmount, Air, Fire, ActiveEffects, SpawnX/Y/Z and SpawnForced from the bed, HurtTime/DeathTime/AttackTime, base Attributes, MapFeatures, hardcore, allowCommands, the record's game rules and total time.
- **Stats.** `stats/<uuid>.json` fills `record.stats` and `record.achievements`; `achievement.exploreAllBiomes` keeps its `progress` list (visited biome names) both ways, also while it is locked.

## Region entities added with this track

- **Paintings and item frames** (EntityHanging.readEntityFromNBT; checked against the 11 native read records): `Direction`, else the legacy `Dir` mapped 0→2, 1→1, 2→0, 3→3; TileX/Y/Z; `Motive` (unknown names are Kebab, as hanging.js loads them); a frame's Item, ItemRotation and ItemDropChance. These now import in every region import, not only level imports.
- **Minecarts of every type** (EntityList MinecartRideable … MinecartCommandBlock): Pos, Motion, Rotation, FallDistance, Fire, OnGround, CustomName; furnace Fuel/PushX/PushZ; TNT TNTFuse; hopper TransferCooldown; spawner cart through the mob-spawner reader; command cart Command, SuccessCount, TrackOutput, LastOutput; container Items with their tags. Checked by the export→import round trip only, not against native-written carts.
- Thrown potions already imported (see [projectile NBT](projectile-nbt.md)).

## MapFeatures off (generation 17, batch 18)

`MapFeatures` false imports generate as streamed generation 17 for every WorldType: the generation 16 chain (native mutated-biome rule, terrain,
caves, ravines, population, lakes, dungeons, decoration) without any structure generator, as `ChunkProviderGenerate` and `ChunkProviderFlat` construct
none when `mapFeatures` is false. The Superflat population is replayed natively for this case (`superflat.md`). `levelGenerator` no longer
reports an approximation for it. Worlds saved at 13, 15 and 16 keep their output; only new imports with MapFeatures off use 17.
`options.generationVersion` accepts 13, 15, 16 or 17.

## Approximations (not exact)

- One clock: the browser's day clock is `DayTime`; `Time` is kept as `totalTime` for export only.
- Hardcore is carried and played as hardcore (hardcore.md). `initialized`, LastPlayed, SizeOnDisk and newer-version keys are reported as ignored.
- Not carried (reported in `report.level.player.lost`): non-default fly/walk speeds, effect `Ambient`, large Motion, Count 0 stacks (native keeps them; item losses are in `report.items`), Attributes beyond the base values, and any key the reader does not know.
- A player in the Nether or End is placed at the world spawn, and the area is the spawn's.
- The UUID is not written; the export's stats file uses the offline UUID of "Player".
- Only one 8×8 chunk area is imported; the rest of the save regenerates from the seed and is not the player's edits.

- Applied since batch 14 (hardcore track): `abilities.flying` (a Creative player starts flying), `SpawnForced` (becomes the browser's /spawnpoint, `record.playerSpawn`, and is exported back as a forced spawn), `Sleeping` (native `readEntityFromNBT` wakes the player at once, bytecode-read, not probed: the launch frees the bed and stands the player beside it, `record.wakeFromBed`) and the hardcore flag. A Survival player's flying flag is dropped (the game mode resets capabilities).
- In-browser save-folder import (Import screen, `save-folder-import.js`): level.dat, the player (Data.Player, else the newest playerdata/*.dat or players/*.dat), stats and the region files covering ONE 8x8 chunk area around the player (else the world spawn). Not imported: all other regions (they regenerate from the seed) and DIM-1/DIM1 regions. A whole-save import is not done: the streamed world stores chunk edits as a diff against its generator, so arbitrary chunk writes would need that diff for every chunk.

## Batch 17: Player.Riding

A player riding a boat, minecart, pig or horse is saved as `Player.Riding` (probed in `player-riding-reference.json`) and comes back mounted on import; see `region-import.md`. An unknown or missing `id` in `Riding` leaves the player unmounted (native `createEntityFromNBT` returns null).
