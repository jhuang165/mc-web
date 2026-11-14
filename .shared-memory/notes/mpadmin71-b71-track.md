# Batch 71 mpadmin71: dedicated-server user lists and generate-structures

## Summary
- `src/multiplayer/server-admin.js`: `/banlist`, `/banlist ips`, `/whitelist list` print HashMap order (`userListValues` / `userListKeys`); `/deop`, `/pardon`, `/whitelist remove` find the name in that order. `save()` writes the lists in that order. Profile cache is a `UserMap` keyed by lowercase name; `seen()` removes the old key of the same uuid and puts the name again (last in its bucket); `profileNames()` returns the keySet order.
- Four list files (`ops.json`, `whitelist.json`, `banned-players.json`, `banned-ips.json`): `listFiles` hook, `loadFiles()` at start-up (file wins over the save's `admin` lists; a missing file keeps the save's list and is created by the first flush = one-time migration; an unreadable file keeps the save and is not overwritten until that list changes), `flush()` after every admin command and after an expired entry is dropped (writes only lists whose text changed). The b70 `whitelistFile` hook still works.
- `server/server.js` (one block): `listFiles` read/write beside the world file; write is temp file + `renameSync`.
- `src/multiplayer/server-tabcomplete.js`: `/whitelist add` uses `profileNames()` (lowercase, HashMap order).
- generate-structures: `World` takes a 6th argument `mapFeatures` (default true; `world.mapFeatures`). `population-world.js` `generateLivePopulation` passes `structures` and `mapFeatures` as off; `java-world.js` skips the generation-10 mineshaft pass. `simulation.js`: a saved `generateStructures` wins over the property (creation-time value), the flag is passed to the World, and `snapshot()` carries `mapFeatures: false` only when off; `client.js` `restoreReplica` passes it to the replica.
- Test: `src/mpadmin71-b71.test.js` (7). `src/mptabcomplete-b69.test.js` line 73 now expects the lowercase `newbie`.
- No new wire messages (one optional `mapFeatures` field in the welcome snapshot).

## Evidence
- Bytecode-read (client jar, javap): `ax` CommandServerBanlist: ips = `oi.i().a()` (the IP list name array), players = `oi.h().a()`; messages `commands.banlist.ips` / `.players` with the count, then the nice-joined list. `cc` CommandWhitelist: list = `oi.l()` (`or.a()`, whitelist values) and `oi.q()` (the world's playerdata names, second count); remove completes `oi.l()`, add completes `ns.a()`; reload calls `oi.a()` (empty in the base class). `ns` PlayerProfileCache: `HashMap<lowercase name, entry>` (`c`), `a()` = `c.keySet()` as an array; adding a known uuid removes the old name key and puts the new one. `aqv` ChunkProviderHell: no map-features field; the fortress generator `atd` runs in populate unconditionally. `aqz` ChunkProviderGenerate: boolean field `o` (mapFeaturesEnabled) guards the structure search in provideChunk, populate and recreate. The Nether and End are therefore unaffected (no change made there).
- Executed: the HashMap order model is the b70 `UserListProbe` evidence; a generation 14 world on seed `3` has one mineshaft with the flag on, none and 38595 fewer structure cells with it off.
- Recalled: `UserList.saveToFile` (gson over `values()`, written after every add and remove); the dedicated list reload reading `whitelist.json`; `oi.q()` counts playerdata files, the repository counts known profiles (unchanged difference).
- Found different from the brief: there is no `/op` listing command in 1.7.10 (only completion lists, already ordered in b70).

## Verification
- `node --test src/mpadmin71-b71.test.js`: 7 pass. Related: sptab-b70, mpadmin-b68, mptabcomplete-b69, serverprops-b69, serverprops2-b70, multiplayer, multiplayer-refusal, accounts, mpping-b68, map-features-off (86 pass); mpnether-b61, mpstate-b59, mpclicks-b70, mpsurvival-b58, serverprops-b69, biome-generation-gate (53 pass). `node --check` on every touched file. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- The server's default world is generation 9, which has no structure step at all, so `generate-structures=true` still builds none; the flag only changes worlds saved at generation 10 or later (11 adds the population, 14 all MapGen structures). A native-structure server default is a separate change.
- The profile cache is saved uncapped (native keeps the 1000 newest and an expiry date); the playerdata count of `/whitelist list` is not modelled.
- Only a browser could show: a client joining a generation 14 server with the flag off (the replica is built from the snapshot flag).
