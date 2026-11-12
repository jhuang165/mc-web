# aimcopies b49 track

## Summary
- Aiming at boats, carts, paintings and item frames uses the client copy's box. New `aimBox(tracker, e, rides)` in `src/object-tracker.js` (the copy's `box()`; the live `bb` for an entity the tracker does not follow yet or the ridden vehicle; `null` when followed but the copy is absent, i.e. not aimable), the same cases as `vehicleViews` / `hangingViews`. `pickMinecart` (structure-simulation.js) and `pickHanging` (hanging.js) take an optional `boxOf(live)`; the result still names the live entity, so use/attack/ride work as before (native: the packet names the entity id). `main.js` passes `aimBox` for carts, boats and hanging.
- Mobs were already aimed via their copies (`entities.js pick` uses `clientPosition`). Difference kept: an untracked or absent-copy mob falls back to the live position there, whereas absent-copy vehicles are not aimable (matches rendering). Leash knots are not aimable in the port (not changed).

## Evidence
- Bytecode-read (no new probe): EntityRenderer.getMouseOver searches the client world's entities (box grown by the 0.1 collision border, already in the picks); the interaction packet carries the entity id. Copy boxes come from the executed b47 tracker (`ObjectClient.box()`).

## Verification
- `node --test src/aim-copies-b49.test.js src/vehicle-render-b48.test.js src/hanging.test.js src/minecarts.test.js` -> 33 pass, 0 fail. `node --check src/main.js`. Not browser-checked.

## Follow-ups
- Leash knots have no crosshair pick; the ridden vehicle aims nothing (ignored) and has no client physics copy.
- Absent-copy mobs are still aimable at their live position.
