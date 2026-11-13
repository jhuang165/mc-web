# Batch 60 mpinventory: the player's inventory window, partial pickup fly-in, tool breaks

## Summary
- `src/multiplayer/server-inventory.js` (new, `ServerInventory`, reached as `serverItems.inv`): one `PlayerContainer` per player (`p.invWin`) over the server inventory. `invClick` (C0E, window 0) runs `Container.click` (main slots, 4 armour slots, 2x2 grid, craft result, shift-click, drag modes 5, double-click, drop). A result equal to the client's claim sends `invConfirm accepted` only (the client already drew it, so nothing flickers); a different one sends `invConfirm accepted:false` plus `invItems` (S30: main, armour, grid, cursor, `seq`), and clicks are ignored until `invAck` (C0F) or 100 ticks. Armour, grid and cursor changes the server makes are diffed each tick and sent as `invSet` (S2F). `invClose` (C0D) and leaving throw the cursor and the grid as items; opening a chest-type window closes window 0 first.
- Armour is now saved and restored (`savePlayer` writes `player.armor`; the join record carries it), so the server's damage code sees what the player wears.
- Tool break: `ServerItems.settle` calls `inv.broke` when `survival.broken` is set: `random.break` 0.8 / `0.8 + rand*0.4` to everyone near except the breaker, and `invBroke` to the breaker (not for armour) so its client plays its own sound and 5 crumbs.
- Partial pickup: `taken` now goes out for a partial take too, with `partial: true`; clients fly the item in as for a full take (`ServerItems.pickup`).
- Client: `src/multiplayer/client-inventory.js` (`wireInvClicks`, `applyInv`); `client.js` (`onInv`, `invClick`, `invAck`, `invClose`, buffering); `main.js` (inventory open wires clicks when connected and not Creative, close sends `invClose`, `onMultiplayerInventory`, `random.break` among server sounds); `simulation.js` and `server/server.js`: short dispatch hooks; `server-items.js` hooks; one line in `server-containers.js` `use`.
- Wire names: out `invItems`, `invSet`, `invConfirm`, `invBroke`; in `invClick`, `invAck`, `invClose`.
- Tests: `src/mpinventory-b60.test.js` (9). `mpitems-b59.test.js` line 152 changed (it pinned "no taken on a partial pickup").

## Evidence
- Bytecode-read (javap, 1.7.10 jar): `ItemStack.damageItem` (`add.a(int, sv)`) calls `sv.a(add)` = `renderBrokenItemStack`: `playSound("random.break", 0.8, 0.8 + world.rand.nextFloat() * 0.4)` then 5 particles from `Entity.rand` and `Math.random`. `EntityPlayer.playSound` (`yz.a(String,float,float)`) calls `World.playSoundToNearExcept(this, ...)`, so the sound skips the breaker; `EntityPlayerMP` (`mw`) does not override it. So the answer to the brief's question is: neither an entity status nor an S2F carries the break; the server sends only the S29 sound to others, and the breaker's own client runs the damage and draws the crumbs.
- Bytecode-read: `NetHandlerPlayClient.handleCollectItem` (`bjb.a(ij)`) plays `random.pop` from the client's own Random, spawns `EntityPickupFX` and removes the entity by id. S0D is sent by `EntityPlayer.onItemPickup` after any successful `addItemStackToInventory` (recalled for the partial case, read in b59 for the pop).
- Recalled: `processClickWindow` flow (S32 true then changes; false then resend), the client's C0F after a refusal, that the particles of `renderBrokenItemStack` do nothing on the server, that tools and armour are damaged on the client for tools (`PlayerControllerMP`, `attackEntity`, `onPlayerRightClick`), that logout closes the container.
- Executed: only the node tests below (no Java probe this track).

## Verification
- `node --test src/mpinventory-b60.test.js`: 9 pass.
- Targeted: mpinventory, mpitems-b59, mpcontainers-b59, mpstate-b59, mpmobs-b59, mpeating-b58, mpsurvival-b58, mp-dig-b57, multiplayer, multiplayer-refusal, client-screens, module-names, accounts: all pass (87 tests).
- `npm run build`: see the report. Full `npm test` not run (batch rule). No browser check (batch rule).

## Follow-ups
- Natively the client removes the item entity on any S0D, so a partially taken stack vanishes on screens until it is tracked again; this port keeps the remainder visible (the client still asks for pickups). Not copied on purpose.
- The fly-in of a partial take draws the whole old stack.
- Accepted clicks send no corrections (a divergence in a slot other than the returned stack is noticed only at the next refusal or server change). Natively S2F follows every click.
- Crafting and smelting achievements/stats from the server's result slot are not wired (`onCraft` unset on the server container). Death does not call `inv.close`; mphealth should call `serverItems.inv.close(p)` if the cursor and grid should drop at death.
- Workbench, anvil and enchanting windows (mpstations) are not part of this. The main-slot mirror (input hotbar/rest) still exists beside the clicks; the clicks make it agree, but drops with Q, creative slots and pickups are still client-first.
- Only a browser could show: the screen refresh after a refusal, the crumbs, and the sounds.
