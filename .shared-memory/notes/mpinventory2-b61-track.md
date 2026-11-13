# Batch 61 mpinventory2: server-only Survival inventory, corrections after clicks, C10, partial pickup, stations leftovers

## Summary
- `server-inventory.js`: window 0 no longer marks a click's changes as already seen. After an accepted click the main slots go out as `slot` (S2F style, via `ServerItems.settle`, numbered by `seq`) and armour, grid and cursor as `invSet`, at the end of the tick, even when the client predicted the same. A second settle sends nothing (diff, not a resend). The refused path is unchanged (S32 false + S30). Other server windows already did this (`changes` after every accepted click and every tick, `setSlot` slots and cursor -1, S31 props); a test now pins it.
- `server-items.js`: `authority(p)` = Survival sim and not Creative. For such a player `adopt` ignores the input's `hotbar`/`rest` (the old mirror is retired). `server-containers.js` `inventory()` (the client's 36 slots after S2D) no longer overwrites a Survival inventory. `inventoryFields(..., authoritative)` makes the client send only `ack` (main.js passes `active.mode === 'survival' && !survival.creative`).
- Pickup: for an authority player the server adds the stack with `InventoryPlayer.add` on its own inventory; the client's `fit` list is only a hint now. The `collect` stack carries `invAdded: true`; the client then skips its own add (the slots arrive as `slot`). The client still asks for pickups; the server still repeats the box test.
- C10 `invCreative {slot, item}` (`ServerInventory.creative`, `simulation.invCreative`, one dispatch line in `server.js`, `client.js invCreative`): Creative players only; stack null or valid (item exists, 0 < size <= 64, damage >= 0; else ignored); slot 1..44 puts the stack (null clears; result slot 0 and slots > 44 ignored); slot < 0 drops it through the per-player `SpamCounter` (20 per drop, refused at 200, 1 per tick) with the item age set to 4800. `client-inventory.js wireCreative` wraps the Creative screen's `send`, diffs main and armour slots and sends C10 for each change and for each thrown stack (no local item entity).
- Partial pickup: `takenDrops` in `main.js`: on a `taken` with `partial` every client keeps the entity in its pickup list but stops drawing it until it leaves the server's list (native hides it). Pickups keep working.
- Stats: `buildWindow(..., { crafted })` sets `onCraft` on a workbench and `onSmelt` on a furnace output slot to `statsLive.crafted` (client-side statistics; window 0 already did).
- Wire: new `invCreative` (in). Changed: `collect.stack.invAdded`. No new out names.
- Tests: new `src/mpinventory2-b61.test.js` (12). Seed changes in mpitems-b59, mpstate-b59, mpsurvival-b58, mp-dig-b57, mphealth-b60, mpeating-b58 (`seed` helper = `adopt(p, msg, true)`), and the two partial pickup tests (mpitems-b59, mpinventory-b60) now fill the server inventory instead of passing a fit hint.

## Evidence
- Bytecode-read (javap, jar SHA1 e80d9b3b): `NetHandlerPlayServer.processCreativeInventoryAction` (nh.a(jm)): `mx.d()` isCreative; slot range `1 <= slot < 36 + 9`; valid = null or (item != null, damage >= 0, 0 < size <= 64) for the stack; put or clear for the range; for slot < 0 `m < 200` then `m += 20` then `mw.a(stack, true)` and `xk.e()`; `xk.e` sets age 4800. A null stack still raises the counter in native (here `creativeDrop` also counts null).
- Bytecode-read: `EntityTrackerEntry.b(mw)` (updatePlayerEntity) only sends the spawn packets when the player is not yet in the tracking set (`o.contains`); `NetHandlerPlayClient.a(ij)` (handleCollectItem) removes the entity (`bjf.b(int)`). So natively a partly taken stack stays invisible on every client that saw the S0D until it is tracked again; the batch 60 note said "not copied on purpose", the brief said the next tracker update re-adds it. The bytecode says it does not, so the port now matches native. `EntityItem.onCollideWithPlayer` is server-driven natively (contact, not a client request); the client-request flow stays here, so ghosts remain collectable.
- Bytecode-read: `EntityPlayer.addExperienceLevel` (yz.a(int)) is the only class with "random.levelup" and plays it only for `levels > 0`. `ContainerEnchantment.enchantItem` (aag) calls it with the negated cost. So **the enchant level-up sound is not native** (gap wrong). Same for the anvil (negative levels).
- Bytecode-read: `GuiRepair` (bey) sets the name field with `bcd.f(40)` = `setMaxStringLength(40)`; the client port already has 40 (`anvilName`); only the server's MC|ItemName rule is 30 (the batch 60 note). The brief's "30 client-side" is wrong; test pins 40 client, 30 server.
- Recalled: native `Container.detectAndSendChanges` runs after each click and each tick (not re-read this track); `StatList.objectCraftStats` increments client and server side natively; here the server has no statistics system.
- Executed: node tests only (no Java probe this track).

## Verification
- `node --test src/mpinventory2-b61.test.js`: 12 pass.
- All test files importing `multiplayer/` or `server/server` (24 files): 189 pass, 0 fail.
- `node --check` on every touched file; `npm run build`: ok (chunk size warning only). Full `npm test` not run (batch rule). No browser check (batch rule).
- main.js scope check: `wireCreative` (imported), `takenDrops` (module const next to `remoteItems`), `active`, `multiplayer`, `statsLive` (module scope) all exist.

## Follow-ups
- Creative still mirrors `hotbar`/`rest` (pick block, hotbar swaps in the survival tab and other Creative edits are not C10 yet), so C10 and the mirror both reach the server for Creative; and a Creative world sim keeps the mirror for everyone. The grid of the Creative survival tab is not sent.
- Crafting statistics: the server has no statistics system; stats stay client-side (now also for workbench and furnace takes). The crafted/award events exist on the server.
- The result slot (0) of window 0 is not sent as a correction (the client derives it from the grid).
- Rapid clicks can blink for one tick when a correction for click N arrives after the client predicted click N+1 (native has the same S2F pattern).
- Merge risk: other tracks' tests that seed a Survival inventory through `input({ hotbar })` will fail after merging; use `s.serverItems.adopt(p, msg, true)` or set `p.survival.inventory` directly.
- Only a browser could show: the partial pickup remainder hiding, the creative screen C10 traffic and thrown items, window 0 after rapid clicks.
