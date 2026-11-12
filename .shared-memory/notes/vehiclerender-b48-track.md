# vehiclerender b48 track

Branch `batch48-vehiclerender` from 61e069a4a (0.76.0).

## Summary
- Boats, minecarts, paintings, item frames and leash knots are drawn from their b47 client copies, not the live entities. New exports in `src/object-tracker.js` (after `objectViews`): `vehicleViews` / `vehicleView` (boat, cart), `hangingViews` (painting, item frame), `knotViews`. A view is `Object.create(live)` with the copy's x/y/z/posY, previous position, yaw/pitch, previous rotation, box and watched fields laid over it, so renderers keyed by the live entity (and fields the port keeps only on the live side: TNT cart fuse, spawner cart logic) keep working. Views are cached per entity (no per-frame object or box allocation; only the small result arrays).
- `src/main.js`: minecart, boat and hanging renderer calls, the boat shadow, the spawner-cart display mob and the horse-gear knot list use the views. The boat or cart the client player rides keeps the live entity (`rider.vehicle === live`, as in `clientTargets`).
- Copy side additions in `ObjectClient` (object-tracker.js only; entity-tracker.js, boats.js, minecarts.js untouched): `prevYaw`/`prevPitch` (the previous tick's rotation for the renderer lerp), `cartType` (S0E data), painting `title`/`art` (S10), and `stepWobble` (below).
- Watched fields the renderers read: boat/cart timeSinceHit / rolling amplitude (17), forward / rolling direction (18), damage (19); frame item (2) and rotation (3); painting art from the S10 title. No new packets were needed (the b47 metadata already carried them).
- Not drawn when the tracker follows the entity but its copy is absent (before the spawn packet, after destroy, beyond 80 / 160 blocks); an entity the tracker has not listed yet falls back to the live one. A summoned leash knot is drawn on its floored tile (the copy), as the executed b47 spawn gives.
- Aiming (`aimedCart`, `aimedHanging`, `pickMinecart`, `pickHanging`) stays on the live entities. Decision: natively `EntityRenderer.getMouseOver` searches the client world's copies (bytecode-read) and the interaction packet names the entity id; the port's interactions (use, attack, ride) need the live entity, and mapping a copy hit back is a separate change. The difference is at most the copies' 8 tick lag.

## Evidence
- Executed (b47, unchanged): the copies' position, interpolation, box, watcher values and rotation (`tracker-vehicles-reference.json`, `object-tracker-vehicles.test.js`). The boat copy sits 0.3 above the live posY until its first position packet (the constructor's yOffset twice), so a freshly spawned, never moved boat draws 0.3 high, as executed.
- Bytecode-read (`javap` on xi = EntityBoat, xl = EntityMinecart): `h()` (onUpdate) starts with `timeSinceHit - 1` while above 0 and `damage - 1` while above 0 (cart: rolling amplitude, damage), with no isRemote test, so the client copy counts the wobble down itself between S1C updates; `prevRotationYaw` is set by the super call at the start of the update. RenderBoat/RenderMinecart wobble from the watcher getters and plain-lerp the rotation.
- Not modelled: the cart display tile and offset (watched 20-22) have no custom-display renderer in the port, so only the type's own display block is drawn; the TNT cart's flash fuse (client status 10 fuse) still reads the live fuse; the client copy of a ridden vehicle's full physics.

## Verification
- `node --test src/vehicle-render-b48.test.js` -> 10 pass, 0 fail (boat follows the copy not the live entity, interpolation, wobble decrement, cart type/rolling fields, previous rotation, out of range/ridden/untracked/dead cases, loaded-chunk test on the copy position, painting/frame S10/S1C, knots on their tile, view stability).
- Targeted: `node --test src/object-tracker*.test.js src/boats.test.js src/carts.test.js src/minecarts.test.js src/hanging.test.js src/spawner-cart.test.js` -> 237 pass, 0 fail (was run with the change). `node --check src/main.js`; `npm run build` ok. No full `npm test`.
- Muted browser (vite on 5561, Chrome `--mute-audio`, master volume 0; `artifacts/b48-vehiclerender/smoke.mjs`, screenshots `all.png`, `right.png`, `pushed.png`, `wobble.png`): a boat, painting, item frame (sword in the copy's watcher) and a summoned knot render; the boat given motion 0.2 moved (live 51.50 -> 51.70, copy 51.87 after 1.5 s, box and yaw from the copy); a cart's watched wobble (17/19) counted down 7,5,3,1,0 and 27..17 between S1C updates. Frame/knot/painting look identical to the pre-change build in the same scene (`base-right.png`). The test cart fell through the not-yet-placed floor (setblock commands run asynchronously), so its on-screen look is not confirmed in the browser; the unit tests cover its view.

## Follow-ups (proposed gap lines)
- `aimedCart` / `aimedHanging` pick the live entities, natively the client copies (the interaction then names the entity id).
- The ridden boat or cart is drawn from the live entity; the native client copy runs full physics and renders from that.
- Cart watched display tile/offset (20-22) are not rendered; the TNT cart's client fuse (status 10) is still the live fuse.
- Cart and boat shadows: only the boat has one in the port (RenderMinecart also has shadowSize 0.5).
