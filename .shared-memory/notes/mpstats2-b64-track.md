# Batch 64 mpstats2: server fishing, stats gaps, server flags

## Summary
- `src/multiplayer/server-fishing.js` (new): `ServerFishing` runs the existing `Fishing` class per player on the dedicated server. Cast and reel use C08 (use item) and the no-target swing. Bobbers tick inside the player's dimension, bite, roll the 1.7.10 loot (Luck of the Sea, Lure), wear the rod, give 1-6 XP, hook and pull mobs, and count fishCaught, junkFished, treasureFished. Hooks are removed on dimension change and disconnect.
- `src/fishing-loot.js` (new): `liveFishStack` converts native loot ids to live ids and keeps tool wear. Single player drop code now uses it too (it used native ids before, which was a bug).
- `src/multiplayer/client-fishing.js` (new), `client.js`, `fishing-renderer.js` (`FishingPool`), `scene.js`, `main.js`: clients draw their own and other players' bobber and line.
- `src/multiplayer/server-use.js` (new): server use of seeds, spawn eggs and nether wart, each counting the `use` stat. `server-dimensions.js` counts `use` for flint and steel.
- `server-stats.js`, `entities.js`, `stats-live.js`: damageDealt for a mob target is now round(damage*10) of the landed hit. A 100-tick attacker credit (recentlyHit) gives mobKills and kill stats for mobs that die later from fire or a fall.
- `server/server.js`: `--command-blocks` / `MC_WEB_COMMAND_BLOCKS` and `--legacy-owner` / `MC_WEB_LEGACY_OWNER`, same pattern as `--pvp`.
- `src/mpstats2-b64.test.js` (new, 10 tests).

New wire messages: `fishHooks` (server to client, hook list per dimension), `fishFx` (server to client, splash/particle effects).

## Evidence
- bytecode-read (javap -c -p on 1.7.10 classes): yz.f adds round(f*10) to damageDealt for any EntityLivingBase after a successful attackEntityFrom. So the old mob path (health lost) was wrong.
- bytecode-read: sv.a(ro) credits the CombatTracker best attacker (rn.c: most-damage player, with a 1/3 rule against the best non-player). Implemented as an approximation using recentlyHit; the 1/3 rule is not modelled.
- bytecode-read: ItemStack.tryPlaceItemIntoWorld counts the use stat when onItemUse returns true.
- executed: tests in src/mpstats2-b64.test.js.
- recalled: fishing timings and loot tables come from the existing src/fishing*.js (earlier batches).

## Verification
- `node --test src/mpstats2-b64.test.js src/mpstats-b63.test.js src/stats.test.js src/pvp-b63.test.js src/fishing.test.js src/fishing-simulation.test.js src/b63-lead.test.js src/mpprojectiles-b62.test.js src/mpanimals-b61.test.js`: 72 pass, 0 fail.
- `node --test src/mpend-b63.test.js src/mpnether3-b63.test.js`: 14 pass, 0 fail.
- `npm run build`: ok.
- `node --check` on every touched file: ok.
- main.js identifiers (remoteFishing, tickRemoteFishing, rodState, liveFishStack, RemoteFishing) checked for scope.
- Full npm test not run (batch rule).

## Follow-ups
- Fire charge, bone meal and eye of ender `use` stat on the server.
- Hooking other players, saving server hooks across restart.
- CombatTracker 1/3 rule and exact damage-window timing.
- Browser check: bobber and line drawing for other players.
