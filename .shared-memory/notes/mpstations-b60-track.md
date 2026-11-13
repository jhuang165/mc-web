# Batch 60 mpstations: crafting table, enchanting table and anvil over the multiplayer connection

## Summary
- New `src/multiplayer/server-stations.js` (`ServerStations`, owned by `ServerContainers.stations`): a right click on the crafting table (port id 13), enchanting table (86) or anvil (85) opens a server window through the batch 59 protocol (S2D `openWindow`, S30, S2F, S32, S31, S2E, C0E, C0D). The server runs the same port classes as single player (`WorkbenchContainer`, `EnchantingContainer`, `AnvilContainer`) over `p.survival.inventory`.
  - Workbench: 3x3 grid, result slot, shift-click, grid and held stack thrown on close (existing drain), distance and block check (`canInteract`, 8 blocks). `stations.onCrafted(player, stack, count)` is called on every result take and a `{ type: 'crafted', id, item, count }` event is pushed on `sim.events`; mpcommands2 can attach the achievement and statistics hook there.
  - Enchanting table: the server rolls the three costs from its own Random (the player's server inventory Random) with the bookshelf count and the item enchantability, whenever the item slot changes. S31 ids 0..2 carry the costs. New client packet `stationEnchant {windowId, slot}` (C11): the container re-checks cost and XP, charges levels, enchants (book becomes enchanted book). No lapis exists in 1.7.10 and none is modelled.
  - Anvil: new client packet `stationItemName {windowId, name}` (MC|ItemName). S31 id 0 carries the repair cost. XP is paid on the server (`p.experience.addLevels`) and sent to the client as `playerOp addLevels`. After a take, outside Creative, a 12% chance (server Random) damages or breaks the block, then aux 1021 (used) or 1020 (broken) goes to every player within 64 blocks, including the user.
- `server-containers.js`: station branch in `use`, `win.stationProps`, `afterServerChange`, and `click` now also sends changed S31 properties with the slot changes (as `detectAndSendChanges` does).
- `client-containers.js`: `buildWindow` builds workbench, enchanting (`remote: true`, costs from S31) and anvil; local XP payment is a no-op (the server's playerOp follows). `wireStation` sends C11 instead of enchanting locally and sends the anvil name after each name change (a rename caused by the local click itself is sent after that click's C0E). `refreshStation` recomputes derived slots (anvil output, workbench result, enchant item) after S30/S2F.
- Hooks (short): `simulation.js` `station()`, `server/server.js` one dispatch line, `client.js` `stationEnchant`/`stationItemName`, `main.js` `mpStation` host object, `wireStation`, the anvil text field `oninput`, aux 1020/1021 sounds in `onAux`.
- New wire messages: `stationEnchant`, `stationItemName`. Reused: `openWindow` (kinds `workbench`, `enchanting`, `anvil`), `windowItems`, `setSlot`, `confirmTransaction`, `windowProperty`, `windowClose`, `clickWindow`, `aux`, `playerOp`.

## Evidence
- Bytecode-read (javap on the 1.7.10 jar): `ContainerEnchantment` (aag) `addCraftingToCrafters` and `updateProgressBar` use S31 ids 0, 1, 2 only; the name seed is not sent. `ContainerRepair` (zu) uses S31 id 0 for `maximumCost`. `NetHandlerPlayServer` MC|ItemName: only while the open container is a `ContainerRepair`; an empty or missing payload sets "", else the UTF-8 text goes through `ChatAllowedCharacters.filterAllowedCharacters` and is applied only if it is at most 30 characters (the GUI field allows 40, so a 31 to 40 character name is silently ignored natively).
- Executed earlier (unchanged jar probes, batches before 60): `tools/probes/AnvilProbe.java`, `EnchantingTableProbe.java`, `EnchantmentProbe.java` cover the container rules and costs the server now runs. No new Java probe this batch.
- Recalled: aux 1020/1021 sound pitch `rand * 0.1 + 0.9` at volume 1 (the old single-player play used pitch 1); the aux goes to everyone within 64 blocks (`broadcastSound`).
- Executed (node): `src/mpstations-b60.test.js`, 9 tests.

## Verification
- `node --test src/mpstations-b60.test.js`: 9 pass.
- `node --test` on mpstations-b60, mpcontainers-b59, mpitems-b59, client-screens, multiplayer, multiplayer-refusal, module-names, anvil-container, enchanting-container, anvil tests: 61 pass, 0 fail.
- `npm run build`: ok (chunk size warning only). Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Only a browser can show: the three screens opening and clicking, the anvil text field and the enchant buttons with S31 costs, the book animation, the anvil sounds.
- The enchant level-up sound and the crafted achievements are not sent (the hook is `stations.onCrafted`). Crafting statistics and the "Taking Inventory" style triggers for stations are not connected.
- The server Random for the enchant costs is the player inventory Random, not a fresh `new Random()` per container (same distribution; the seed is not observable).
- The client trusts nothing: a stack the client claims is only compared with the server result. Tags on stacks the client puts into the anvil still come from the batch 59 whitelist copy (`cleanStack`).
- Inventory window 0, the 2x2 grid and armour are still mpinventory's. The workbench is not a recipe book; recipes are the port's `craftingResult` (the same list as single player).
