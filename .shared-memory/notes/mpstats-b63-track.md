# Batch 63 mpstats: server statistics and S37

## Summary
- `src/multiplayer/server-stats.js` (new): `ServerStats`, `sim.stats`. Each server player has `p.stats` (a `Stats` from `src/stats.js`) and `p.statsLive` (the single-player `StatsLive`). Saved in the player record as `stats`.
- Hook for other tracks: `sim.stats.add(p, id, n = 1)` with ids from `STAT` in `src/stats.js` (mppvp: `sim.stats.add(killer, STAT.playerKills)`). Unknown ids and non-positive counts are ignored.
- Awards: play time, walk/swim/dive/climb/fly/fall distance, minecart/boat/pig distance, jump, damage taken, deaths + killed-by (mob), mob kills + per-entity kill stat, damage dealt, tool use on hit, animalsBred, items crafted and smelted, blocks mined + tool use on break, items used (placed blocks), tool breaks, drops, leaveGame.
- Wire: client `{type:'requestStats'}` (C16 action 1) answered by `{type:'stats', stats:{id:value}, full}` (S37). Client side: `src/multiplayer/client-stats.js` `applyStatsMessage`; `client.requestStats()`; `onStats` in `main.js`; the in-game menu Statistics button asks the server and shows "Downloading statistics" until S37 arrives (5 s fallback to the local copy).
- Hooks (one-liners, all marked `b63 mpstats`): `simulation.js` (construct, join, leave, savePlayer, tick, breakDug/edit harvested, placed use), `server-survival.js` (death, tool break), `server-stations.js`, `server-inventory.js`, `server-containers.js` (crafted/smelted with count), `server-dimensions.js` (Nether item drops), `server-vehicles.js` (mounted distance), `server-mobs.js` (watchMobs), `server/server.js` (requestStats), `client.js`, `main.js`, `menus.js`.
- breedCow was already awarded on the server (b61 `server-mobs.js` spawnBaby wrapper); only the `animalsBred` stat was missing. No 1.7.10 achievement depends on a stat counter, so nothing else needed awarding.

## Evidence
- Bytecode-read (javap, 1.7.10 jar, `pg` StatisticsFile, `mw` EntityPlayerMP, `nh`): `mw.addStat` calls `pg.b(player, stat, n)`, which adds the value and puts the stat in the dirty set; `pg.d()` marks all stats dirty; `pg.c()` returns and clears the dirty set and the announce flag; `pg.a(mw)` sends S37 (`gd`, a Map of stat to int) with the dirty stats only when the announce flag is set or more than 300 ticks passed since the last send (`f` starts at -300), otherwise an empty map; the C16 request handler in `nh` calls `pg.a(mw)`. `ServerStats.request` copies this, so a second request within 300 ticks answers empty.
- Existing executed evidence for the stat table, formats and trigger sites: `public/research/stats-reference.json` (b-earlier `tools/verify-stats.mjs`). Movement, jump, damage and death awards reuse that code unchanged.
- Recalled: the client merges S37 values over its local copy (func_150872_a), and marks all stats dirty at login. Not re-read.

## Verification
- `node --test src/mpstats-b63.test.js`: 7 pass (play time, walk, save/restore, add hook, jump/damage/death, S37 full/empty/delta, client merge, breeding animalsBred, mob kill stats).
- Related targeted tests (stats, mpanimals-b61, mpvehicles-b61, mpnether2-b62, mpcommands2-b60 plus the new file): 57 pass, 0 fail. Full npm test not run (batch rule). `npm run build` passed.
- Only a browser could show: the "Downloading statistics" screen and the Statistics tabs filled from S37.

## Follow-ups
- Mob kills credit only the attacker of the moment (`sim.achievements.attacker`), not the 100-tick `attackingPlayer` of a mob that dies later from fire or fall.
- Fishing stats (fishCaught, junkFished, treasureFished): the server has no fishing yet.
- Armor/other `use` stat branches (bone meal, flint and steel, spawn eggs, seeds) on the server only count the block-placing path.
- Achievements are not in S37 (they keep their own path); the announce-flag immediate S37 on a new achievement is not modelled.
- Stat ids are not shown to other players or the scoreboard criteria on the server.
- The client still counts its own stats while connected; S37 replaces them on the first Statistics open.
