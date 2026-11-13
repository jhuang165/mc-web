# Batch 62 mpriding2: chest and hopper carts, rail redstone, pig riding, mob riders, leads on the server

## Summary
- `src/multiplayer/server-vehicles.js`: chest (1) and hopper (5) carts are placeable (held item, dispenser, `spawnVehicle`). C02 on them opens a server window (`openCart`). The hopper cart sucks through `cartHost.transfer` (the server hopper host). New `connect(redstone)` installs `installPoweredRails` and the detector `blockHook`; `cartsIn` feeds LiveRedstone modes "minecart" and "inventory". The mob push now passes the mob itself, so a fast empty cart picks a mob up. `syncVehiclePassengers` runs after the tick. `riderInput()` is split out and also runs before the mobs tick.
- `src/multiplayer/server-containers.js`: `openCart`, and `canInteract` for cart windows (alive, within 8 blocks). `client-containers.js`: `buildWindow` builds a blank 27-slot chest or 5-slot hopper window for `m.cart`.
- `src/multiplayer/server-riding.js` (new): saddled pig riding. Mount through `EntityWorld.pigMount` and `horseSeats`, steering by the existing `ControlledByPlayer` task, stick boost and wear (`stickUse`, `wearStick`, fishing rod swap), and `flyPig` through `onLand` and `sim.achievements.award`. `animal-use.js`: feed, then mount, then saddle (a saddled pig is no longer re-saddled instead of ridden). `server-mobs.js` `target` points a ridden pig at its rider.
- `src/multiplayer/server-leads.js` (new): ItemLead on a mob (C02), the fence knot click, `leash.holderId` per player, the lead following its holder, a lead drop when the holder leaves or goes to the Nether. The tracker's S1B mode 1 packets are forwarded in `mobs` as `{type:'attach', mode:1, i, holder}`. Client: `remote-leads.js` plus `RemoteMobs.attach` mode 1, drawn by the single-player `HorseGearRenderer` through one `main.js` line.
- Hooks: `simulation.js` (entitiesIn mode, dispense map, `connect`, `leads`, edit fence line, stick line, `riderInput` before mobs), `server-mobs.js` (target, ctx.ride, ctx.lead, attach forward), `main.js` (import, `mpLeads`, two list spreads).
- New wire messages: none new by name. `openWindow` gains `cart: 'c<id>'`; the `mobs` list now carries `attach` mode 1 with `holder` ({kind:'player',id} | {kind:'knot',x,y,z} | null). Pig rides use `riding: 'm<id>'` in presence.

## Evidence
- Bytecode-read: activator rails do not eject riders in 1.7.10 (`xl.a(IIIZ)V` is empty and `xs` does not override it). That part of the gap list was wrong.
- Bytecode-read / earlier executed (single-player tests): all rules reused (Minecarts, cart-hopper, pig-saddle-reference.json, leash-reference.json, leads3-reference.json). No new Java probe was written this batch.
- Executed: `src/mpriding2-b62.test.js` replays the server on DedicatedSimulation (and the real client window builder).
- Recalled: native order in EntityPlayer.interactWith (feed, then pig mount, then ItemSaddle); a lead only breaks for the holder's click.

## Verification
- `node --test src/mpriding2-b62.test.js`: 15 pass. Targeted run of mpanimals, mpvehicles, mpdispense, mpmobs, mpmobs2, mpmobtypes, mpnether, mpcontainers, mpcontainers2, mpstations, mpstate, multiplayer and server-handlers plus mine: 145 pass after one old assertion in `mpdispense-b61.test.js` (a chest cart stays undispensable) was updated.
- `node --check` on every touched file. Every identifier the `main.js` hook reads (`leadViews` import, `remoteMobs`, `multiplayer`, `remotePlayers` at module scope, `mpLeads` declared on the line before) was grepped.
- `npm run build`: passed. Full npm test not run (batch rule).

## Follow-ups
- Not checked in a browser: the chest/hopper window on screen, the lead rope between two players, the knot model, the pig ride feel and seat height.
- Third-person seat height for riders seen by others: not done.
- A lead held by another player cannot be stolen with a second lead (native allows it); knot-held mobs are freed by breaking the knot, not by clicking the mob.
- Placing the held carrot/stick boost ignores a clicked block that has its own use (the server takes the stick first).
- A never-moved pig has aiMoveSpeed 0 and does not walk under the stick (same as single player); the test sets it.
- Cart pickup of a mob depends on entering the 0.2 push margin before the mob box blocks the cart (single-player order, kept).
- The command-block cart is still not connected. mpsmall2 owns taming status 6/7.
- Merge risks: `simulation.js` (several one-line hooks), `server-mobs.js` target and track, `main.js` line near `horseGearRenderer.update`.
