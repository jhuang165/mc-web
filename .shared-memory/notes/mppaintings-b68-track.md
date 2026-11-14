# Batch 68 mppaintings: paintings, item frames and leash knots on the dedicated server

## Summary
- `src/multiplayer/server-hanging.js` (new): `ServerHanging`, one per `ServerVehicles`, so the Overworld, the Nether and the End each keep a list (`sim.vehicles.hanging`, swapped with the dimension). It wraps the single-player `Hanging` (hanging.js) and the knots of `EntityWorld`. Placing (`useHeld`), C02 interact and hit (`act`), drops into the dimension's items, the 101st-update surface check (`tick`, only in a chunk with a player within the view distance), blast hits (`explode`), thrown and arrow hits (`thrown`, `arrowHost`, `targets`), tracker records (`track`) and saving (`save`, under `vehicles.hanging`).
- `src/multiplayer/client-hanging.js` (new): `ClientHanging` builds copies from the spawn records (geometry from hanging.js), lists them for `HangingRenderer`, gives the knots to the lead renderer and picks them for the crosshair.
- Hooks (one commented line each): `server-vehicles.js` (construct, add/remove player, key regex `[bchk]`, act, tick, track, save), `simulation.js` (`hanging.useHeld` before the minecart/boat click), `server-mobs.js` (blast), `server-dispense.js` (targets, `ballHit`, pearl hit, arrow ctx, `hangingOf`), `server-summon.js` (`UNKEPT_ENTITIES` is empty; `hosts.hanging` is the dimension's `Hanging`), `remote-vehicles.js` (owns a `ClientHanging`), `main.js` (a hanging renderer in the two `remoteVehicles.renderers` objects; the knots list).
- Catalogue rows for Painting, ItemFrame and LeashKnot updated and regenerated. `mpsummon-b67.test.js`: the two "summon fails" asserts now expect success.
- Wire: no new message type. `vehicles` gains `hset` [record] and `hdel` [key]. Records: painting `{k:'h<id>',p:'S10',x,y,z (tile),dir,title}`; frame `{k:'h<id>',p:'S0E',t:71,x,y,z (tile*32),data:dir,meta:[[5,2,item],[0,3,rotation]]}`; knot `{k:'k<id>',p:'S0E',t:77,x,y,z (floor(pos*32))}`. Client to server reuses `vehUse` / `vehHit` with an 'h' or 'k' key; a painting or frame item on a wall is the ordinary `edit`.

## Evidence
- Executed (reused, not re-run): hanging-reference.json (art choice order, setDirection box, onValidSurface, drops, interact, the 101st update), entity-throw-frame-reference.json (thrown hits at empty and loaded frames), tracker-vehicles-reference.json (client copy geometry).
- Bytecode-read earlier (object-tracker.js header): EntityTracker range 160 clamped to 144; S0E 71 and 77, S10 packet fields, frame watcher slots 2 and 3.
- Recalled (not re-read this batch): S10 carries the raw tile, S0E 71 tile * 32, S0E 77 floor(pos * 32); a Creative player's stack is restored after ItemHangingEntity.onItemUse; EntityTracker has no hysteresis in this port (as for vehicles). Two frames can be placed in one cell: this is the native quirk already executed (hanging entities never overlap).
- Not re-verified: the "every 100 ticks" check is the 101st update (`tickCounter1++ == 100`), already in hanging.js and its executed reference.

## Verification
- `node --test src/mppaintings-b68.test.js`: 12 pass.
- `node --test` on hanging, mpsummon-b67, mpvehicles-b61, mpvehicles3-b63, mpriding2-b62, mpdispense-b61, mpprojectiles-b62: all pass. Full npm test not run (batch rule).

## Follow-ups
- Maps in frames: the server has no maps; a map item shows as a plain item.
- Pistons and moving blocks do not push or break hanging entities on the server; a witch potion at a frame and a player's pearl through a real player shell are unprobed.
- Not seen in a browser: the connected frame, painting and knot drawing, aiming and clicking.
- A knot is clicked through the client copy; a knot summoned at 0,0,0 draws at tile 0,0,0 as in single player.
