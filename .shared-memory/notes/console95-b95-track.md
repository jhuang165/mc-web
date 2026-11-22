# console95 (batch 95) track note

Scope: dedicated server `/netstat` S13 timing for removals during network handling. Claims are marked Executed, Bytecode-read or Port-read. No browser checks were run.

## Summary (file by file)
- `src/multiplayer/net-packet-ids.js`: `peerRemovals(m, ctx)`. `ctx.peers` is the connection's set of tracked player ids; a `tick` message that stops carrying another player's full row (row `far`, or gone because of a disconnect) counts one immediate 6 byte S13 per player, outside `ctx.destroyed`. Without `ctx.peers` nothing is counted.
- `server/server.js`: passes `peers: ws.netPeers` for `tick` messages; `dimRespawn` clears it (the rebuilt client world holds no player entities, no S13).
- `tools/probes/Console95Probe.java`, `tools/probes/stub95/ej.java`, `tools/verify-console95.mjs`, `public/research/console95-reference.json`: new probe (Console93's world double). The stub stands in for NetworkManager `ej` only, because the real class cannot initialise on the newer netty in the probe libraries.
- `src/console95-b95.test.js`: 4 tests.

## Evidence
- Executed (Console95Probe, real `mw`, `nh`, `hq`): `mw.d(pig)` adds the id to `bN` and sends nothing; `mw.d(otherPlayer)` adds nothing and `nh.a` is handed one `hq` (6 bytes after the id VarInt). So the premise of the track ("a removal during network handling sends its S13 at once") holds only for PLAYER entities.
- Bytecode-read: `mw.d` is `instanceof yz` ? `nh.a(new hq(int[]{id}))` : `bN.add(id)`. `mw.h` (onUpdate) is the only drain; `nh` calls `mw.i` (onUpdateEntity), not `mw.h`. `MinecraftServer` tick order (`ms` listing): world `mt.b`, `mt.h` (entities), tracker `mn.a`, then `ai().c()` (networkTick), players `oi.e`. A C02 kill, an item pickup or a cart break during networkTick only calls `setDead`; the tracker removal (WorldManager.onEntityDestroyed -> `mn.b`) runs in the next tick's entity loop, so the id is queued and drained by the player's own onUpdate there, exactly the batch 94 queue. `ahb.e` (removeEntity) only sets dead and drops a player from `playerEntities`.
- Port-read (packet order): natively a tick's order for one connection is the queue drain (entity loop), then tracker S0E/S0F/S14.., then immediate player S13 (networkTick). In the port `server-mobs.js` puts the held destroys at the head of the next tick's packet list (`outs ... [...v.destroys]`), before that tick's spawns, which matches; vehicles and dispEnts are separate messages in the slot and /netstat records only counts and sizes, so a different record order inside the tick cannot show.

## Verification
- `node --test --test-concurrency=2 src/console95-b95.test.js`: 4 pass, 0 fail. With `net-packet-ids.js` reverted: 1 pass, 3 fail.
- `node tools/verify-console95.mjs` OK (2 removed records, 1 S13 record). `node --check server/server.js` OK.
- Regression: 29 files that name net-packet-ids, net-watch-bytes, server/server.js or netstat, 257 tests, 257 pass, 0 fail.

## Found wrong in the batch 94 list
- "A removal during network handling of the same tick would send the S13 at once": wrong for mobs, items and carts (queued even then, see Executed). Only player entities are immediate. The batch 94 queue was already right for the non-player kinds.

## Follow-ups
- The S0C spawn of a player entering the tracked set is still not counted (its size depends on name, uuid and watcher; not probed).
- `tick` still counts an S18 per other-player row each tick, far rows included (not changed, existing tests encode it).
- The tick in which a player's removal lands inside the networkTick versus the tracker phase is not distinguished (counts only).
- Browser-only: nothing visible changes.
