# Batch 43 track: trackermounts

## Summary
- Mobs are now drawn from the tracker's client entity for mounts, riders, leash holders and the self-moving flyers.
- Server side (`src/entity-tracker.js`): S1B attach packets as EntityTrackerEntry sends them (on tryStart, on a change of vehicle, resent every 60th tick while riding, leash set/clear at once). Entries are all created before any sendLocation, so spawn and attach order match Java. Spawn, head and look packets carry byte angles. A custom `meta` packet carries the bat hanging flag.
- Client side (`ClientEntity`): handles attach (the vehicle is looked up at apply time, so an attach that arrives before the vehicle exists does nothing until the 60-tick resend), rotation interpolation, body turn, updateRidden/updateRiderPosition (mount first, then rider with motion zeroed; chicken seat yaw; skeleton copies an EntityCreature mount's renderYawOffset).
- `src/entities.js`: client water/lava flags come from the client entity's own box (`clientEnvironment`), not the live mob. Per-type client physics: ghast (move then 0.8/0.91/0.546 friction), squid (move only), blaze and wither (vy factor 0.6), bat (hanging pins y, flying vy 0.6, tail after body turn). Ghast and squid use the legacy body turn. A mount the player rides keeps its live position (camera and physics untouched). Lead rope is drawn between client positions.
- Evidence: `tools/probes/TrackerMountsProbe.java` runs the executed 1.7.10 classes (EntityTrackerEntry plus real client entities on a client world double); `tools/verify-tracker-mounts.mjs` writes `public/research/tracker-mounts-reference.json`. Cases: ridePig, rideChicken, rideSpider, riderFirst, leash, flyGhast, flyBlaze, flyWither, flyBat, flySquid. Packets per tick and every client value are replayed at 1e-9 in `src/tracker-mounts.test.js`. Mutation checks (no 60-tick attach, no chicken seat yaw, rider keeps motion, no legacy turn for ghast/squid) fail the replay. Handle details read only from javap are bytecode-read.

## Verification
Focused only (the full suite and build were left to the lead): tracker-mounts 14/14, entity-tracker 24/24, entities 21/21, object-tracker 13/13, horse-gear 21/21, mob-riding 12/12, squid-bat-mobs 3/3, squid-bat 13/13, blaze-ghast-world 7/7, blaze-ghast 7/7, dragon-world 7/7. No browser check was run for this track.

## Follow-ups (proposed gap lines)
- Ender Dragon ring buffer is not ported to the client entity (it stays on live physics).
- Squid tentacle/rotation fields (client Entity.rand) and the in-water flow push are not modelled.
- Drawn yaw of mobs still comes from the live mob; only position, motion, leash and mount links come from the client entity.
- The live `endRidden` turns the rider with the mount, the executed client does not; the live skeleton should copy an EntityCreature mount's renderYawOffset.
- Packets use one global order, not per-entry queues. A look-only packet is not exercised by the records.
- A player-ridden mount stays on live position. Draw order is the list order.
