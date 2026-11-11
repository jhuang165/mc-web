# bosstracker b44 track

## Summary
- Ender Dragon: `ClientEntity` now keeps its own 64-sample ring buffer, wing `prevAnim`/`anim` and the dragon's own interpolation (`dragonUpdate` in `src/entity-tracker.js`), filled from client motion. `src/dragon-renderer.js` reads the client copy. `renderYawOffset = rotationYaw` after interpolation, then the legacy body turn.
- Squid: client copy holds `squidState` (pitch, yaw, rotation, tentacle). The client rand is drawn per tick for the living-sound roll and the splash on entering water, which decides the `rotationVelocity` re-roll. The renderer reads the client copy.
- Ridden mount: a mount the local player rides gets a client entity that follows the live mount (`followLive`). `clientPosition` no longer returns null for `e.rider`. Camera and physics still use the live entity.
- Drawn mob yaw (`renderYawOffset`, head yaw, pitch) comes from the client copy (`clientAngles` in `src/mob-renderer.js`). The angler end of the fishing line uses the player body's interpolated position and `renderYawOffset` (`src/fishing-renderer.js`, `src/main.js`).
- Fix found on the way: the S0F spawn packet angles are truncated `(byte)(int)`, not floored. Negative angles were off by one step.
- Probe: `TrackerMountsProbe` gained a water slab, `swimSquid` and `flyDragon` cases and per-tick `extra` records. Reference regenerated with `tools/verify-tracker-mounts.mjs` (12 cases).
- Tracker set order (item 5): not modelled. `trackedEntities` is a `HashSet`; its order only affects the order of packets between different entries within one tick. Each entry's own packets stay ordered, and the client applies them per entity, so no client state in this port depends on cross-entry order. The entry hash being the entity id is from memory, not checked against bytecode.

## Verification
Focused tests only (full suite and build left to the lead): tracker-mounts 17/17, entity-tracker 24/24, entities 21/21, dragon-renderer 4/4, dragon-world 7/7, squid-bat-mobs 3/3, squid-bat 13/13, mob-riding 12/12, player-mount 4/4.
- Mutation checks: ring index off-by-one, dropped living-sound roll and dropped ridden-mount follow all fail the replay. Removing the after-move squid splash draw is NOT detected (weak evidence).
- Replay seeds the client rand (`Random(77)`) and the squid `rotationVelocity` from the record; the probe executes the 1.7.10 classes. The wing/ring formulas and the RenderFish angler end were bytecode-read, not executed.
- Muted headless Chrome (Playwright, port 5458; scripts and shots in `artifacts/b44-bosstracker/`): the dragon is drawn with the wing pose from the client ring (`dragon-squid-1.png`); client ring index equalled the live one. The squid client copy was in water with changing fields, but the squid is not visible in the shots (`dragon-squid-2.png`). I did not confirm it visually. One console "404 Not Found", source not identified.
- Angler end checked only visually/by reading; no replay.

## Follow-ups (proposed gap lines)
- Dragon client parts / hit boxes are not ported; dragon death branch and S1C health are not modelled (client uses live health as a stand-in).
- Squid air/drowning on the client is not modelled.
- Verify the tracker entry hash and set order in bytecode.
- Angler end of the fishing line has no native replay.
- Squid render in the browser still needs a visible check (shot with the squid in view).
