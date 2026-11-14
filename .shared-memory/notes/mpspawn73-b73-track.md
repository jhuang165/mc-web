# Batch 73 mpspawn73: native per-type spawn caps on the dedicated server

## Summary
- `src/multiplayer/server-mobs.js`: `MOB_LIMIT` is now `SPAWN_RUNAWAY_GUARD` (5000) instead of 80, and the per-tick cull of mobs over 80 is removed. Natural spawning is limited only by `findChunksForSpawning`'s per-type test `count > max * eligibleChunks / 256` (monster 70, creature 10, ambient 15, water 5), which `spawnPass` already ran over the union of all players' 17 x 17 windows (`unionChunkOrder`, `capChunks = union size`). The same constant is the limit passed to server spawners, golem/silverfish eggs and village loading, so those are guard-only too.
- Per dimension: each dimension has its own `ServerMobs` (Overworld, Nether, End), so counts and unions are per world, as natively. Unchanged.
- Tests: new `src/mpspawn73-b73.test.js` (6). `mpwither-b63`, `summon2-b68`, `mpfixes69-b69` keep their "past 80 mobs" counts through a local `MOB_LIMIT = 80`; the wither test no longer expects a cull.

## Evidence
- Bytecode-read (`javap -c -p` on `aho`, `sx`): the window loop is `bipush 8` (-8..8, edges put true only when absent, inner put false), a constant, so eligible chunks do not depend on view distance. The test is `World.countEntities(type.class) > sx.b() * HashMap.size() / 256` then skip. `sx` values: monster 70, creature 10, ambient 15, waterCreature 5 (`bipush` in `sx.<clinit>`).
- Executed (node): the test replays the server pass: 90 pigs block animals but monsters still spawn past 80 mobs; a union of two players raises the monster cap; view distance 3 and 16 give 289 chunks.
- No new Java probe: the existing SpawnReplay probes already cover the control flow; nothing new executed against the jar.

## Wire budget review
- Mobs go to a player only inside the tracker range (`SharedMobTracker`, `rules.trackerLimit`) and only for columns the player was sent (`chunkViews.sees`, mpstream72). So bytes per player depend on mobs near that player, not on the world total.
- Measured in the test (first packet, 100 mobs in range): one player 16,978 bytes of mob packets; two players with 200 mobs in total, 100 near each, 18,801 bytes for one of them (+11%, longer ids). No global budget was added. The worst realistic load is the native cap itself (about 79 monsters + 11 animals + 16 ambient + 5 water per 289 chunks, all inside 80 blocks only for a small part), so a single player's first packet stays near the 100 mob figure.
- A per-player budget in the tracker was not needed; none added.
- The dedicated world is a 128-block window (players clamp to it), so the test cannot place players 400 blocks apart; spread was done inside the window (13 chunks apart).

## Audit of other server-only caps
- `entities.length` caps in `src/multiplayer`: only `ctx.add` (natural spawn, now guard), `spawnSilverfishAt` (golems, guard), `loadVillages` (guard). Server wither, golem building, `/summon`, eggs: no count cap (summon and eggs use `summonKeep`, now harmless). Single player was done in spawncaps72.

## Verification
- `node --test src/mpspawn73-b73.test.js src/mpwither-b63.test.js src/summon2-b68.test.js src/mpfixes69-b69.test.js src/mpmobs-b59.test.js src/mpmobs2-b60.test.js src/mpmobtypes-b61.test.js src/spawncaps72-b72.test.js src/mpspawners2-b65.test.js src/mpgolems-b66.test.js`: 90 pass, 0 fail.
- Full npm test not run (batch rule). No browser checks.

## Follow-ups
- A real mob-heavy multi-hour server soak (tick time with several hundred mobs) was not run; a browser/client would show draw cost of 100+ remote mobs.
- `summonKeep` is now unused by the cull; left in place.
