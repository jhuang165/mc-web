# Batch 62 mpsmall2: Creative on C10, window 0 result slot, dead player's window, taming, grass eating

## Summary
- `server-items.js`: `authority(p)` is true for everyone; the hotbar/rest mirror is retired for Creative too. It only runs when a test sets `ServerItems.prototype.mirror = true` (four old test files do: mpcontainers-b59, multiplayer, client-screens, tile-edits). Nothing in production reads `hotbar`/`rest` any more; `main.js` always sends `inventoryFields(..., true)` (only `ack`). The client still has the mirror branch of `inventoryFields` for tests.
- `client-inventory.js`: `creativeDiff` (shared by `wireCreative`), `creativePick`. `main.js pickBlock` runs the pick through `creativePick` in a Creative connection: C10 for slot 36 + current (always sent, as native) plus any other changed slot.
- `server-inventory.js` / `client-inventory.js`: window 0 result slot (slot 0) is part of the snapshot; `invSet.result` and `invItems.result` go out when it differs from what the client was told, and the client sets `container.result.stack` after the grid.
- `server-survival.js discardWindow`: a chest or station window still open at respawn is closed (S2E `windowClose`), its cursor and grid are lost, not thrown.
- Animals: `entities.js` calls `this.mobStatus?.(e, 6|7)` after taming, `18` for wolf/ocelot love, `8` for the wolf shake; `eatGrass` event carries `meta`. `owner-links.js ownerPresent` accepts `ownerHere`. `server-mobs.js`: `target(e)` makes the owner's view the AI player of a tamed wolf/ocelot (`ownerUuid` = owner's resume key, `ownerHere` set per tick), `interact` stamps the owner on taming and treats other players as strangers, `makeBaby` keeps the parent's `ownerUuid`, `p.survival.onRevenge` records the attacker on the owner's view (wolves defend), `eatGrass` hook sends S28 2001 to players within 64 blocks.
- Wire: new fields `invSet.result`, `invItems.result`; `mobStatus` statuses 6, 7, 8, 18 for wolf/ocelot; `aux` 2001 for grass eating. No new message names.
- Tests: `src/mpsmall2-b62.test.js` (12).

## Evidence
- Bytecode-read (jar SHA1 e80d9b3b): `GuiContainerCreative.handleMouseClick` (bfl.a(aay,int,int,int)): in the survival tab it runs `inventoryContainer.slotClick`, then for mode 2 sends C10 for the 9 hotbar slots (36+i) and otherwise only the clicked slot (`slot.g - (size - 9) + 36`). The port sends every changed main/armour slot (diff), a superset: native shift-clicks in the survival tab would desync the server, the port does not.
- Bytecode-read: the 2x2 grid slots are moved to -2000 in the survival tab and are never clicked, so "grid not sent" is not a native packet. Gap closed as not applicable.
- Bytecode-read: `GuiContainer.updateScreen` (bex.e) calls `EntityPlayerSP.closeScreen` (bjk.k: C0D for the open window id) as soon as the player is dead; the server's C0D handler closes the container whatever the health, so natively the cursor in a chest is thrown at death-time close. The port client's `die()` already calls `closeContainer` (C0D). The leftover case is a client that never sends it; `respawnPlayer` does not close the old container (b61 read), so the port drops it silently.
- Bytecode-read: `EntityAIEatGrass.updateTask` (ud.e): tall grass at the feet -> `func_147480_a(x,y,z,false)` (event 2001 with id + meta<<12, no drop); grass below -> `playAuxSFX(2001, x, y-1, z, id(grass))` then dirt; both need mobGriefing; `playAuxSFX` has no excluded player (S28 within 64 blocks).
- Bytecode-read: Minecraft.func_147112_ai middle click Creative sends the hotbar slot packet; `setCurrentItem` logic is the existing `PlayerInventory.pick` (executed earlier batches).
- Recalled: EntityTameable owner by UUID (`owner-links.js` header, probed b21); wolf AI owner tasks (probed earlier).
- Not executed: no Java probe this track.

## Verification
- `node --test src/mpsmall2-b62.test.js`: 12 pass.
- Targeted run of mp*, multiplayer*, dedicated*, server*, client*, tile-edits, wolf*, ocelot*, interchange*, enderman-wolf*, leash*, sheep*, entities*, ai*, creative*, b61*, entity-tracker*, inventory*, animal*, owner* test files: see the lead report for the count.
- `node --check` on touched files; main.js scope: `creativePick` imported, `survival`, `multiplayer`, `active` are module scope names already used in `pickBlock`/`edit`.
- `npm run build`. Full npm test not run (batch rule). No browser check (batch rule).

## Follow-ups
- Still open: the `animalsBred` statistic (the server has no statistics system; stats are client-side in `stats-live.js`).
- Still open: `spawnWither` / `killWither` on the server. The server world has no wither: it is not in `SUPPORTED`, `placeSkull` on the server gets no `spawnWither` hook and `difficulty: 0`. Not built here.
- Creative's cursor stack is local only (native too); nothing sent.
- Wolves tamed in a loaded single-player save have no `ownerUuid`: the nearest player counts as owner for them (old behaviour).
- Only a browser could show: Creative pick block and survival tab traffic, the tamed wolf following its owner, heart/smoke particles on the copy, the grass-eating break particles.
- Merge risk: `server-mobs.js` (`target`, `interact`, constructor wrappers), `simulation.js` untouched, `main.js` two lines (import, `pickBlock`) plus the `inventoryFields` argument. Other tracks' tests that seed a Creative inventory via `input({ hotbar })` need `ServerItems.prototype.mirror = true` or direct seeding.
