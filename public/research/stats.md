# Statistics (1.7.10)

Evidence: `tools/probes/StatsProbe.java` + `tools/verify-stats.mjs` (run with `MC_RESEARCH=<dir with minecraft-1.7.10.jar>`; needs a JDK and the guava, log4j-api, commons-lang3, authlib and commons-io jars) load the unchanged StatList (`pp`) and write `public/research/stats-reference.json` and the generated `src/stats-data.js`. `src/stats.test.js` replays the reference.

## Bytecode-verified (probe or javap)
- StatList registration order, ids, formatter kind and the awardLocallyOnly flag of the 23 general stats (`stat.leaveGame` ... `stat.treasureFished`). This jar has no startGame/createWorld/loadWorld/joinMultiplayer stats.
- Per-item arrays: mineBlock (137 ids, 127 stats after merging variant blocks), craftItem (201), useItem (318), breakItem (50); the GuiStats block and item lists (pp.e, pp.d); the 24 EntityEggInfo kill / killedBy stats in EntityList HashMap order.
- Formats: simple (US thousands separators), time (`########0.00`, s/m/h/d/y thresholds at 0.5), distance (cm/m/km), decimal (value * 0.1); sample replay in the reference.
- File shape: `stats/<uuid>.json` is one flat object, stat ids and `achievement.<id>` ids with int values; unknown keys are ignored on read.
- Trigger sites (javap): see `triggers`/`mining` in the reference and the comments in `src/stats-live.js`.
- GuiStats layout, tab buttons, column offsets, header icon tiles of `stats_icons.png`, and the click-to-sort cycle (`beq.h`).

## Export
`exportJavaSave` adds `stats/<uuid>.json` (statistics plus unlocked achievements). The browser has one local player named "Player", so the UUID is `UUID.nameUUIDFromBytes("OfflinePlayer:Player")` = `a01e3843-e521-3998-958a-f459800e4d11` (verified against Java by the probe; `md5` in stats.js reproduces it). Stats ride in `blockworld.json` (`record.stats`, `record.achievements`). Since batch 13 the Java save import (`tools/import-java-region.mjs --save`, [level-dat](level-dat.md)) reads `stats/<uuid>.json` with `parseStatsFile`; `achievement.exploreAllBiomes` keeps its `progress` list of visited biomes both ways.

## Approximations (not bytecode-exact)
- Movement stats use per-tick position deltas instead of the packet deltas of `processPlayer`; moves over 10 blocks in a tick (teleports) are skipped.
- Use stat: placed or applied items only for the branches in `USE_BRANCHES` (blocks, seeds, nether wart, flint and steel, fire charge, spawn eggs, bone meal; bone meal counts even when nothing grew), tool hits on mobs and tool block breaks. Hoeing, buckets, signs, doors and other `onItemUse` successes are not counted.
- killedBy: last mob that hit the player within 300 ticks; projectile killers and the exact CombatTracker rule are not modelled.
- damageTaken is counted in `Survival.damage` from the amount it receives (difficulty scaling happens in callers); damageDealt is the mob's health drop.
- animalsBred counts any breeding, not only the one the player fed; playerKills is never awarded (no PvP).
- GuiStats item names and column headers use `title` tooltips, not the vanilla tooltip box; hover states were not compared pixel for pixel and the screen was not browser-checked.
