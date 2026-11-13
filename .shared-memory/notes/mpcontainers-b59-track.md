# Batch 59 mpcontainers: container windows over the multiplayer connection

## Summary
- New `src/multiplayer/server-containers.js` (`ServerContainers`): right-click on a chest (single, double, trapped), furnace, dispenser, dropper, hopper, brewing stand or ender chest opens a server window. Messages are JSON named after packets: `openWindow` (S2D), `windowItems` (S30), `setSlot` (S2F, slot -1 is the held stack), `confirmTransaction` (S32), `windowProperty` (S31), `windowClose` (S2E), `blockActions` (S24 lid counts) out; `clickWindow` (C0E, with action number and the stack the client's own slotClick returned), `confirmTransaction` (C0F), `closeWindow` (C0D) and `windowInventory` in.
- The server runs the port's own `Container.click` over `p.survival.inventory`. A click whose result equals the client's claim is confirmed and only changed slots are sent; otherwise S32 accepted=false and the whole window is resent, and further clicks are ignored until the client acks (C0F) or 100 ticks pass.
- The server only mirrors the hotbar (no counts). So after S2D the client sends its 36 slots once (`windowInventory`); while a window is open `DedicatedSimulation.input` ignores the hotbar mirror. No server inventory accessor existed in this branch, so this uses `p.survival.inventory` directly. If mpitems adds one, replace `inventory()` and the `input` guard.
- Server tick now smelts furnaces (`tiles.tickFurnaces`) and brews (`brewingView.tick`); hoppers and dispenser firing are still not ticked. A removed container block spills its items (`reap`) and closes windows on it; players beyond 8 blocks are closed.
- Ender chest contents are per player (`p.survival.enderItems`), now saved in `savePlayer`.
- `src/multiplayer/client-containers.js`: builds the local container from S2D, wraps `container.click` to send C0E (nested shift-click repeats are not resent, local drops discarded; the server throws the held stack), applies S30/S2F/S31 (player slots keep the client's own stack when equal so tags survive), applies lid counts. Hooks: `simulation.js` (constructor, input guard, edit, closeWindow, dropTiles, tick, savePlayer), `server.js` (dispatch, windowOut delivery), `client.js` (`onWindow`), `main.js` (`onMultiplayerWindow`, blockActions, close drops, join text without "Containers").

## Evidence
- Executed: `src/mpcontainers-b59.test.js` (8 tests): chest open/click/confirm/close, refused click resend, large chest and blocked lid, S24 counts, furnace S31 and S2F, the other four block types and per-player ender chest, shift-click and broken-block spill, hotbar guard and range close.
- Recalled (not re-read from bytecode this batch): processClickWindow flow (S32 true then detectAndSendChanges; false then full resend), furnace S31 ids 0 cook / 1 burn / 2 item burn, brewing id 0.

## Verification
- `node --test src/mpcontainers-b59.test.js`: 8 pass. `node --test src/client-screens.test.js src/multiplayer.test.js src/multiplayer-refusal.test.js src/tile-edits.test.js src/module-names.test.js src/accounts.test.js`: 23 pass. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Only a browser can show: the window opening and clicks in the real screen, lid animation, furnace flame and arrow. Chest models of never-opened chests still have no client record, so they are not drawn as models (lid records are made on first block action).
- Hoppers, dispenser firing, lit furnace block light are not ticked or synced on the server. Server trusts client stack tags up to a whitelist. Trapped chest redstone power not wired. Other windows (anvil, enchanting, workbench, inventory) are not connected.
