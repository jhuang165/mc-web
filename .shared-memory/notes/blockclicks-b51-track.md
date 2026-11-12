# Batch 51 blockclicks track

Branch `batch51-blockclicks` (from 119a6db93). Labels: bytecode-read = read from the jar, not run.

## Summary
- Block right clicks (C08 on a block: placement, doors, containers, item use) and digs (C07) join batch 50's pending-edit queue and run from `mobs.afterEntities` (network tick), in arrival order with the entity actions.
- `defersToNetworkTick`: also true when an action is already queued (nothing overtakes it) and for a right click with a block target. `pendingEdits` entries keep the click's `target` (restored while replaying, like `aimed`), plus `{ fn }` entries.
- `breakBlockPacket(p, creative, accept)`: creative and instant breaks (the `breakBlock` hook of `applyPlayerEdit`) and a survival dig that finished in `tickMining` are queued as a C07; the server's 6-block/y range check (`serverClick`) now runs when the packet is handled. Singleplayer only; multiplayer and a replay already running apply at once.
- Client side kept at once: the swing of a left click, mining progress, dig sounds and hit particles, the survival dig start (`mining` state, as `PlayerControllerMP.clickBlock`). A right click's swing, the placed block and a GUI now wait up to one tick (<= 50 ms), as a GUI waits for the server's open-window packet natively.

## Evidence
- Bytecode-read: `MinecraftServer` (jar `net/minecraft/server/MinecraftServer.class`) per world calls `mt.b()` (tick), `mt.h()` (updateEntities), the tracker `mn.a()`, then after the worlds the profiler sections "connection" -> `nc.c()` (NetworkSystem.networkTick), "players", "tickables". No Java probe: the dig/place handlers depend on the client jar's world and the order is a main.js scheduling matter; no executed record added.
- The client-prediction details (what PlayerControllerMP applies locally) were not re-read; the kept-at-once list above follows the existing port.

## Verification
- `node --test src/block-clicks-b51.test.js src/melee-order-b50.test.js src/player-throw-replay.test.js src/block-actions-replay.test.js src/redstone-ore.test.js src/player-mining*.test.js`: all pass (player-throw-replay needed `breakBlockPacket` in its extracted-main.js bindings). `npm run build` once, ok. Full `npm test` not run. No browser smoke.

## Follow-ups
- Left-click side effects at dig start (dragon egg teleport, note block click, redstone ore touch) still run at click time; only the block break is queued.
- The queued dig finish replays `breakBlock` at the next walk; no check that the block is still the dug type (native checks the server-side damage).
- Placement is not drawn client-side before the walk (single shared world); a client/server world split would be needed for exact prediction.
