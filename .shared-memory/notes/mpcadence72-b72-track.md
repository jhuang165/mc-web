# Batch 72 mpcadence72: item and orb packets at tracker cadence, client item physics, dimRespawn cut, rotation-only carts

## Summary
- `src/multiplayer/server-object-tracker.js`: new "cadence mode" (third constructor argument; the Simulation turns it on). Each (player, object) entry is now the single-player `ObjectEntry` (spawn + S1C + S12) built with the executed size class. Its packets go out in the player's tick as `itrack` rows `{ i, k: 'item'|'orb', p: [packets] }`; the tick's `items` and `xp` lists are no longer sent. Entries start on the object's own tick count so every player sees the same 20-tick beat. A removed object sends S13 (destroy) to its trackers. The orb spawn packet carries its value.
- `src/multiplayer/client-itrack.js` (new, `ItemTrackClient`): one `ObjectClient` per tracked object. Packets are applied as NetHandlerPlayClient does; every client tick runs `ObjectClient.step` (EntityItem / EntityXPOrb onUpdate: gravity, drag, collision, the orb pull to the local player). `lists()` rebuilds the `items` / `xp` rows that `syncMultiplayerItems` / `syncMultiplayerOrbs` already draw.
- `src/main.js` (3 short hooks): the `itrackClient` constant, one line in `applyMultiplayerTick` before the orb sync (`itrackClient.tick(...)` then `Object.assign(message, itrackClient.lists())`), and `itrackClient.clear()` before the two snapshot item syncs.
- Item rows (`simulation.js itemList`, `server-dimensions.js list`) carry `mx/my/mz`; orb rows (`server-items.js xpField`) carry `vx/vy/vz`, so the entry can send S12.
- `server-dimensions.js`: the `dimRespawn` snapshot goes through `objectTracker.snapshot` (item range cut).
- `server-cart-track.js`: S15 releases the position only, S16 the rotation only, S17/S18 both (native packets); a look-only update no longer sends the position.
- Wire names: `itrack` (tick field). Tests: `src/mpcadence72-b72.test.js` (10), `mptrackers71-b71.test.js` fixture uses list mode (`cadence = false`) and the real-server test accepts packets.

## Evidence
- Executed: `public/research/tracker-items-reference.json` (`TrackerItemsProbe`, unchanged `EntityTrackerEntry`, real client `EntityItem` / `EntityXPOrb` ticked from the packets). The new test feeds its server inputs to the cadence-mode server tracker and the client copies; packet types per tick and the client entity's x/y/z/motion each tick must match for itemDrop, itemToss, itemFar, orbPull, orbDrop (140 ticks each, 1e-9). A mutation check (no client item physics) fails.
- Bytecode-read (earlier batches, reused): S15 carries dx/dy/dz, S16 yaw/pitch, S17 both; EntityTracker table (item 64/20/true, orb 160/20/true).
- Recalled: other players' orb targeting on the client (the copy only homes to the local player here).

## Deviations
- The executed client takes an orb spawn packet's integers as block coordinates (x*32 as x), so an orb copy sits far outside the world until its first position packet (up to 20 ticks). The port now shows that for server orbs too (it is what the real handler does, executed). Orbs from a kill may therefore appear up to a second late. If this looks wrong in play, the fix would be a deliberate deviation in `client-itrack.js` (place the copy at its row position on spawn).
- Client pickup delay is 0 (not in the packets); the server still decides pickups.
- Hover phase on the client is random per copy (as the native constructor).

## Verification
- `node --test src/mpcadence72-b72.test.js`: 10 pass. `mptrackers71-b71`: 10 pass. `mpitems-b59` 10, `multiplayer` 5, `mpvehicles-b61` 10 pass. `node --check` on touched files. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Only a browser would show items and orbs popping in, the late orbs, and item landing at the 20-tick corrections.
- Away-run and Nether tick paths use the same message hook; the Nether (`alt`) message gets the same cadence (tested by the dimension change in mptrackers71 in list mode only).
