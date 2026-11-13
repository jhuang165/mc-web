# Batch 59 mpitems: items, XP and inventory authority on a Survival dedicated server

Branch `batch59-mpitems` (from 0.87.0). Labels: executed = run; bytecode-read = read with javap from the 1.7.10 jar; recalled = from memory.

## Summary
- `src/multiplayer/server-items.js` (new): `ServerItems` plus client helpers `inventoryFields`, `applySlots`, `pickupFit`.
  - Authority: the server mirrors all 36 main slots (counts, damage, full tags through the inventory reader), not only the hotbar with fake 64 counts. Server-made changes (placement spending, tool wear, anything else) are diffed at the end of each tick and sent as `slot` corrections numbered by `seq` (S2F style). The client acks the last seq in its input; the server ignores the client's copy of a slot it corrected after that ack, so a stale input cannot undo a correction. Without a pending correction the client's arrangement is adopted (container clicks are still client side).
  - World drops (leaf decay, plants, rails, torches, doors, beds, falling blocks) go to the server item entities in a Survival world. A Creative world keeps the no-op, so the live Creative server is unchanged.
  - XP: ore breaks spawn real `ExperienceOrbs` on the server. Orbs tick toward the nearest player, are collected per player (own xp cooldown), play random.orb for everyone in range, and reach the collector as a `playerOp addExperience`. Orbs ride in `tick.xp`. XP is saved with the player and restored through the welcome record.
  - Saved items and orbs: `save()` has `items` and `xpOrbs`; the constructor restores them.
  - Break effects: `afterBreak` sends aux 2001 (`id + (meta << 12)`) to players but the breaker within 64 blocks.
  - Pickup: `pickup(ids, fit)` takes at most `fit[i]` of each stack, leaves the rest on the ground, reports `taken` (S0D) when an item is gone, and plays random.pop for others in range.
- `src/multiplayer/simulation.js`: hooks only (construct, join/save fields, `input` adopts, `pickup` delegates, `afterBreak` around both break paths, orbs tick, settle before sounds, tick and save fields). `cleanHotbar` is kept but unused.
- `server/server.js`: `fit` passed to pickup, `itemsOut` messages sent per player, `maxPayload` 8192 to 32768 (full tagged inventory).
- `src/multiplayer/client.js`: `onSlot`, `onAux`, buffered while loading, `pickup(ids, fit)`.
- `src/main.js`: input carries `inventoryFields`; `slot` applies S2F; `aux` plays break sound and particles; the breaker plays its own effect when it sends status 2, on an instant block, and on a Creative break; orbs from `tick.xp` are drawn as plain objects in `xpOrbs.orbs`; `taken` calls `scene.drops.pickup` toward the collector; pickup requests carry the fit; random.pop and random.orb join the server sounds; the join record gets `experience`.
- `src/mpitems-b59.test.js`: 10 tests.

## Evidence
- Bytecode-read (`mx` ItemInWorldManager.tryHarvestBlock): `World.playAuxSFXAtEntity(breaker, 2001, x, y, z, blockId + (meta << 12))` before the removal, and `mp.a(yz, ...)` sends S28 with `sendToAllNearExcept(player, x, y, z, 64.0, dim, ...)`. So the server does not send it to the breaker; the breaker's own client plays it in PlayerControllerMP (b58 note).
- Bytecode-read (`xk` EntityItem.onCollideWithPlayer): needs delay 0; `addItemStackToInventory` returning true (also for a partial fit) then `playSoundAtEntity(player, "random.pop", 0.2, ((r - r) * 0.7 + 1) * 2)` with the item's Random, `onItemPickup` (S0D), and setDead only when the stack is empty. `playSoundAtEntity` goes to everyone near including the collector (WorldManager `sendToAllNear`, 16 blocks). So a partial fit does pick up and leave the rest; the full-inventory case leaves the item on the ground, as kept.
- Executed: node tests in `src/mpitems-b59.test.js` (no Java probe this batch).
- Recalled: the item's own Random draws the pop pitch (the server uses its sound Random, the same distribution); EntityPlayerMP.yOffset 0 so the pop sits at the feet.

## Verification
- `node --test src/mpitems-b59.test.js`: 10 pass.
- All 55 test files that mention `multiplayer/`, `server/server` or `main.js`: 468 pass, 0 fail.
- `npm run build`: see report. Full `npm test` not run (batch rule). No browser check (batch rule).

## Follow-ups
- Container clicks, the armour slots, the cursor stack and the crafting grid are not mirrored: a client can still claim any stack for a slot the server has not corrected (needs the mpcontainers window clicks). The server cannot yet judge pickup room itself; the client reports `fit`.
- `PROTOCOL` was not bumped: an older client sends hotbars without counts (the server then keeps its own count for the same item, else 64).
- A partial pickup shows no fly-in animation (only a full take sends `taken`). A pickup that races an S2F for the same slot can lose the picked part.
- Creative servers still drop nothing from world systems and cannot pick items up. Systems that were never given a drop host on the server (live redstone blocks, flowers, farmland crops popping) remain silent. The server does not tell clients about a tool breaking (no break sound or crumbs).
- Only a browser could show: the breaker's break effect timing, the fly-in toward another player, orbs drawn from plain objects and the HUD after an `addExperience` op, and the pop and orb sounds.
