# Batch 59 mpmobs: mobs in the dedicated multiplayer world

## Summary
- `src/multiplayer/server-mobs.js` (new): `ServerMobs` runs one `EntityWorld` on the dedicated world. Each server player gets a PlayerView, an AI survival adapter (damage goes to `sim.damagePlayer`), an own `MobTracker` (server half only) and an own SpawnerAnimals state. Natural spawning runs once per player with the cap counting the union of the 17 x 17 windows. Creeper blasts hit mobs, players and blocks. Only pig, cow, sheep, chicken, zombie, skeleton, creeper and spider are kept (80 mobs at most).
- `src/multiplayer/remote-mobs.js` (new): `RemoteMobs` replays the tracker packets (JSON) on `ClientEntity` copies, with stand-in records from `EntityWorld.create` for the existing `MobRenderer`; `pick` is the client's ray test.
- `src/entities.js`: two one-line hooks, `beforeMob?.(e)` in the tickMobs loop and `capChunks` in `naturalSpawn`. Single player is unchanged (hooks unset).
- `src/multiplayer/simulation.js`: `mobs` field, `damagePlayer(player, amount, source)` no-op returning true, `queueAttack`, `mobs.tick()` each tick, save/restore of mobs, `options.mobs === false` to leave spawning off.
- `server/server.js`: `attack` message (C02), `mobs` message with each player's packets.
- `src/multiplayer/client.js`: `onMobs`, `attack(mob)`; mobs messages are never dropped while terrain loads.
- `src/main.js`: RemoteMobs created at join, ticked in the multiplayer branch of movementTick, drawn through the existing mobRenderer call, aimed with `aimedRemoteMob`, attack sent from `edit()`. Chat text no longer says mobs are unconnected.

## Evidence
- Executed (node): `src/mpmobs-b59.test.js`, 10 tests. Spawn/move/destroy round trip through JSON, sheep colour and baby flags, nearest player per mob, attack damage and reach, sword kill with drop, `damagePlayer` call from a zombie, natural spawning plus save/restore, CPU.
- CPU, executed: 80 mobs (cap reached by spawning), two players: mean 2.3 ms, p95 3.2 ms, max 9.6 ms per mob tick plus tracking.
- Bytecode-read / recalled: none new. The tracker, AI and attack rules are the existing ports.
- Recalled (not verified here): native World.getClosestPlayerToEntity picks the nearest player; native SpawnerAnimals runs one pass over the union of players' chunks.

## Verification
- `node --test src/mpmobs-b59.test.js`: 10 pass, 0 fail.
- `node --test` on dedicated-beacon, mp-dig-b57, mpeating-b58, mpsurvival-b58, multiplayer-refusal, multiplayer, serverbroadcast-b58, entity-tracker: 71 tests, all pass after moving one call (mpsurvival-b58 checks the line shape of movementTick's multiplayer branch).
- `node --test` on entities, spawner-animals, spawner-replay2, spawner-replay3: 60 pass.
- `npm run build`: ok. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Only a browser shows: copies drawn at the right place and turning, chicken wing flap (stand-ins do not run it), creeper swell, death tilt, hurt flash timing, the aim and attack feel.
- Several players: per-player spawn passes in one tick can double-spawn animals where windows overlap; `velocityChanged` and `airBorne` are cleared by the first player's tracker, so a second watcher can miss a knockback packet.
- Mob sounds, particles, riding, leads, xp orbs, other mob types, chest contents of blasted blocks, crits and sprint knockback on attacks are not connected.
- PROTOCOL was not bumped (new `mobs` and `attack` messages are additive); the lead decides.
- Player health: `damagePlayer` is a no-op until mpstate replaces it; creative players are never targeted.
- The live ledoge0 server was not touched.
