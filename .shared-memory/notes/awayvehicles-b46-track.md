# awayvehicles (batch 46)

## Summary
- **Vehicles in the one walk (gap 1).** `src/away-entities.js` no longer deletes the live `cart`, `boat` and `hanging` walkers from `entityWalkers`; it adds a local `rocket` walker (`FireworkRockets.tickOne` / `reap`, new in `src/fireworks-live.js`, `tick` now loops over them). `joined` hooks on `Minecarts`, `Boats`, `Hanging` and `FireworkRockets.launch` (new `this.joined?.(r)`) stamp the join place, as `main.js`/`entity-list-replay.js` do. The walk state gets `minecarts`, `boats`, `hanging`, `alive: false`, a far stand-in `position` and the `carts`/`boats`/`hangingActive`/`hangingDrop` hooks. After the walk only `finishMinecartSimulation` / `finishBoatSimulation` (passenger links, drops) and the portal travel run; `park` is no longer used. A mob riding a cart or boat updates right after its mount (live `seatRiders`). Every walked entity keeps the per-tick 32-block check. Labels: walk order = the live code that `entity-list-reference.json` (probe-executed) replays; the new away order has no probe of its own, only unit order tests. Native `World.updateEntities` single list is bytecode-read from earlier batches, not re-read.
- **Observable changes.** Carts and boats are blocked by mobs and push them (the live `vehicleBlockers` / `pushMobOnVehicles`; before, the away run passed no blockers). Saved vehicles/rockets (no stamp) go after the mobs in walker order; spawned ones join the end and tick in the same pass.
- **Death screen (gap 2).** Kept at the return, reasoning in `public/research/dimensions.md` "Batch 46". Native (bytecode-read earlier): the player dies when the damage applies on the server tick and GuiGameOver opens at once. The port cannot show it at that moment because the worker runs after the trip and reads the live player's trace samples; showing it earlier needs a live worker ticking with the Nether or a re-run of the dimension. No code change; derived, not executed.

## Verification
- `node --test src/away-*.test.js src/entity-list.test.js src/entities.test.js src/dimension-away.test.js src/dimension-live.test.js src/dimension-ticks.test.js src/fireworks*.test.js`: 196 pass, 0 fail (before the final comment edit; `src/away-*.test.js` alone re-run after it: 78 pass).
- New tests in `src/away-vehicles.test.js` (4): saved order mob, cart, boat, hanging, rocket per tick (spies on `tickOne`); rider after its cart; far cart and rocket never tick; a launched rocket reports its join and stamps after an existing mob.
- `npm run build`: ok. Full `npm test` not run (shared machine).

## Follow-ups
- A native probe of an away-style list order (cart, boat, rocket, mobs) is still missing; the order rests on the live walk.
- Live `main.js` still ticks rockets after the walk (`rockets.tick`, with `clientCopies`); the live rocket could join the walk the same way (`rocket` walker, `rockets.joined`), touching `object-tracker` hooks owned elsewhere.
- Death screen at the moment of a shadow kill: needs a live worker or a re-run design; not bounded.
- Saved entities carry no native list order; the stamp for saved non-mobs is "after the mobs".
