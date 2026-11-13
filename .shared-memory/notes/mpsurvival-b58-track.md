# Batch 58 mpsurvival: Survival mining and item drops over a multiplayer connection

Branch `batch58-mpsurvival` (from 0.86.0). Labels: executed = run; bytecode-read = read from the 1.7.10 jar; recalled = from memory, not checked.

## Summary
- `server/server.js`: new `gameMode` option and `--gamemode survival|creative` flag (default creative, so the live server behaves as before). Routes a `pickup {ids}` message and sends `{type:'collect', stack}` per collected item after the tick (same place as `crack`). Edits kept to a few lines.
- `src/multiplayer/simulation.js`: the world now owns an `ItemEntities`. A Survival break (`breakDug`) passes it as the `items` host, so `breakPlayerBlock` drops exactly what single player drops (harvest tool rule, crops, leaves, ore, enchanted tools; each item is its own entity of one with the 0.7 spread and a 10 tick delay). Items tick in `tick()` (EntityItem physics, merging, 6000 tick life), capped at 300. The tick message carries `items` (`{i, stack, x, y, z, age, hover, delay}`) while any exist and once empty afterwards; `snapshot()` carries `gameMode` and `items`. `pickup(id, eids)` repeats `ItemEntities.collect` (delay over, box grown 1/0.5/1) for the named items only, Survival only, and queues each stack in `collectedOut`.
- `src/multiplayer/client.js`: `onCollect`, `pickup(ids)`, `collect` is buffered while terrain loads.
- `src/main.js`: the remote record's mode follows the server's `gameMode`. In a Survival world a left click calls `multiplayerDigStart()` (status 1 if another dig is open, status 0, an instant block just returns with no delay) and sets the same `mining` object as single player. `tickPlayerMining` then runs unchanged: crack overlay, step sound every 4th hit, progress `+= playerMiningState().progress` per tick. At progress 1 `breakBlockPacket` sends status 2 (the server breaks, or resends and waits), `tickPlayerMining` sets the 5 tick hit delay. An unfinished stop sends status 1 through the existing `watchClientDig`. Remote item entities are drawn through the normal drop renderer (one stable object per wire id, positions interpolated from the previous tick); items in reach with room in the inventory are requested with `pickup`, a `collect` stack is added to the local inventory with the pop sound.
- `src/mpsurvival-b58.test.js`: 7 tests.

## Evidence
- Bytecode-read (`tools/research/player-controller-1.7.10-bytecode.txt`, PlayerControllerMP = `bje`): `onPlayerDamageBlock` (`c(IIII)`) decrements the hit delay field `i` first; a block of the same cell adds `getPlayerRelativeBlockHardness` to `g`, plays the step sound, and at `g >= 1` sends `ji` (C07) status 2, runs `onPlayerDestroyBlock`, resets `g`/`h` and sets `i = 5`. `clickBlock` (`b(IIII)`) sends status 0 (`ji(0,...)`), an instant block (rate >= 1) is destroyed at once. This is the model `player-mining.js` already ports; the client loop is reused unchanged.
- Executed: the server timer (status 0/1/2, 0.7 rule) is the b53/b54 `createServerDig`, 1741 records still passing; the new test replays the client loop against it (broken between the 0.7 line and damage 1, cooldown 5) and a real WebSocket server dig, item tick, pickup and collect round trip.
- Recalled: the pickup pop sound pitch formula (as `itemPicked` in main.js uses it); that vanilla's item pickup goes through the server (S0D collect, then inventory add on the server). Here the client inventory is the authority (the server only mirrors the hotbar, with fake counts of 64), so the client decides room and the server decides reach and delay.

## Verification
- `node --test src/mpsurvival-b58.test.js`: 7 pass.
- With mp-dig-b57, multiplayer, multiplayer-refusal, dedicated-beacon, item-entities, dig-finish-b53, dig-abort-b54, instantbreak-b55: 59 pass. All 42 test files that mention `main.js`: 388 pass. `npm run build` passes. Full `npm test` not run (batch rule). No browser check.

## Follow-ups
- Not tool wear, hunger/exhaustion, XP orbs or health for a Survival server player: the server mirrors only the client's hotbar, so there is no real Survival state (damage, food, tool durability, inventory counts) on the server. Placing a block in Survival does not consume the client's stack.
- No break sound or particles for the breaker on the final block (the cell arrives with the tick, no local effect); no pickup fly-in animation; no sound when the server picks up for others.
- Item drops from the world systems (trees/leaves decay, plants, rails, torches, falling blocks, doors) are still `noop` on the server; only player breaks and container spills drop. Items are not saved with the dedicated world.
- A full inventory leaves the item on the ground (the client never requests it); a pickup racing an inventory change can still overflow by a stack.
- Mob/entity attacks, containers and eating remain unconnected. The live ledoge0 server was not touched or restarted; it stays Creative unless started with `--gamemode survival`.
