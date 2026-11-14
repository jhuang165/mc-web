# Batch 66 mppistons: pistons on the dedicated server

## Summary
Finding first: the server already ran the piston block rules. `LiveRedstone` on the server world runs `BlockPistonBase`, the push limit of 12, immovable blocks and tile entities, the sticky pull and `TileEntityPiston` progress (0.5 per tick) from the shared `src/redstone.js`. What was missing: no entity pushes, no S24, no moving block on clients, no piston sounds (the server's `LiveRedstone` had no `sound` hook). Quasi-connectivity and BUD stay in the shared engine, untouched.

- `src/multiplayer/server-pistons.js` (new): `ServerPistons`. Uses `installPistons` (piston-live.js) with the server's players (pushed with `pushPlayer` on the server position, which the position stream carries to the client), mobs (`EntityWorld.pushMove`), items, orbs, primed TNT and falling blocks (`pistonPushExtras`). Records S24 events and new `TileEntityPiston`s, sends tile.piston.out/in through the S29 sound queue, and flushes a per-player `pistonTiles` message to players within 64 blocks.
- `src/multiplayer/client-pistons.js` (new): `ClientPistons` steps the server's moving blocks (+0.5 per tick, removed the tick after progress 1 or when the cell stops being block 130) and draws them with `movingParts` through `scene.setMovingBlocks`.
- Hooks: `simulation.js` (construct + `flush()` after the world systems), `server-nether.js` (Nether and End get their own `ServerPistons`, `n.pistons.flush()`), `server/server.js` (send `player.pistonOut`), `client.js` (queue and dispatch `pistonTiles`), `main.js` (declare, create, tick, frame, whitelist `tile.piston.*` sounds).
- Wire message: `pistonTiles` `{ events: [[x,y,z,originalBlockId,event,facing]], tiles: [[x,y,z,block,meta,facing,extending,renderHead,progress,lastProgress]] }`.

## Evidence
- Bytecode-read (`javap -c -p mt.class`, WorldServer): `sendQueuedBlockEvents` (mt.Z) calls `fireBlockEvent` (mt.a(ags)) and sends S24 (gg) only when it returned true, to players within 64.0 blocks (`oi.a(x, y, z, 64.0, dim, packet)`), raw integer block coordinates. `fireBlockEvent` is just `block.onBlockEventReceived`.
- Executed (existing, replayed by piston*.test.js, passing unchanged): block rules, progress, entity push order and box maths.
- Recalled, not re-checked: the native client replays `onBlockEventReceived` on S24 and builds its own `TileEntityPiston`; `EntityPlayerMP` is pushed by the server's tile entity and the client player by its own. Here the client takes the server's tile description instead, and the player's push arrives in the server position stream (the port's player positions are server-authoritative).
- New tests are code replays of this port, not a new Java probe (no Java probe was run this track).

## Verification
- `node --test src/mppistons-b66.test.js`: 8 pass (extend + S24 + moving head tile, sound range 16, S24/tile range 64, player pushed, sticky pull, push limit 13 and obsidian, client stepping, Nether system).
- `node --test` one at a time: piston-live 193, pistonpush-b48 27, piston-order-b49 14, pistons 38, ring-pistons 3, redstone-live 17, multiplayer 5, mpdispense-b61 15, b63-lead 1: all pass.
- `node --check` on every touched file; `npm run build` ok. Full npm test not run (batch rule). No browser checks (batch rule).

## Follow-ups
- A server player cannot yet collide with a moving piston block (block 130 has no collision on the server; `collisionBoxes` of piston-live is not wired into `movePlayer`). Pushes work, standing on a moving block does not carry exactly as natively.
- A push that lands a player does not apply fall damage (`pushPlayer`'s landing return is dropped); `movePlayer` overwrites `landedFall` next tick.
- Minecarts and boats are not pushed on the server (their server systems differ from the single-player `minecarts()` / `boatSystem()` interface).
- A client that joins or enters range while a tile is mid-move misses that tile (it lasts two ticks) and sees the finished block only.
- Only a browser could show: the moving head and block drawn between cells, the push feeling on the client, the piston sounds at distance.
