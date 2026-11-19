# mpthrown84 (batch 84) track

Branch `batch84-mpthrown84`. Task: tracker cadence for thrown entities on the wire.

## Summary

1. **Arrows, thrown balls, potions, bottles, rockets and eyes of ender now go out as tracker packets.**
   - New `src/multiplayer/thrown-tracks.js` (`ThrownTracks`, server): one `ObjectEntry` per (player, entity), the same entry the single-player `ObjectTracker` and the cadence item lane use, so range, frequency, S0E, S12 tail, S1C and the 1/32 rounding are the executed ones.
   - New `src/multiplayer/thrown-copy.js` (`ThrownCopies`, client): one `ObjectClient` per row id. Each copy runs its own onUpdate (flight, block ray, onImpact particles, rocket trail) between packets.
   - Wire: `dispEnts` gains `trk: [{ i, k, p: [packets] }]` (`k` an `OBJECT_KINDS` key). The server sends the message every tick while a player tracks anything, so each copy updates once per tick. Old messages without `trk` still apply (the `ents` path is unchanged and still used by TNT, fireballs, skulls, golem balls and the extra-dimension stand-in lanes).
   - Client order is native: the copies update first, then take the message's packets; a new copy is only placed (`Minecraft.runTick`: updateEntities before processReceivedPackets).
2. **Cadence table (bytecode-read, correcting batch 83's note).** arrow 64/20/no velocity; snowball, egg, pearl, potion, exp bottle 64/10/velocity; eye 64/4/velocity; rocket 64/10/velocity; fishing hook 64/5/velocity. "Balls 64/10/false" was the fireballs' line.
3. **Destroy** goes out one tick after the entity ends (the held S13), so a copy takes two more updates (same port-read as the fireball copies). A rocket that exploded sends S1A 17 before the destroy; the copy's `makeFireworks` runs from that. The server rocket now ticks with `clientCopies: true` (no server sparks or burst fx).
4. **Gate:** a new `thrown` channel in `server-chunk-view.js` FRESH re-lists a player's entries when columns change; entries start only in columns the player was sent (`sees`).
5. **main.js:** four small hooks in `makeRemoteDispense` (`copyParticle`, `copyWorld`, `copyPlayer`, `copyBalls`) give the copies particles, the live world and player, and the scene effect renderer for snowballpoof.

## Evidence

- Bytecode-read (javap, 1.7.10 jar): EntityTracker.addEntityToTracker table above; EntityTrackerEntry.func_151260_c S0E types and data (arrow 60 shooter id, snowball 61, egg 62, pearl 65, eye 72, rocket 76, potion 73 with the potion damage, exp bottle 75, hook 90 angler id); `bjb.a(fw)` zeroes the data of 73, 75, 90 so those copies take their motion from the S12 after the spawn, an arrow keeps it; Minecraft.runTick order.
- Executed (reused): the entry and copy classes are the ones checked against tracker-items/hits/extras-reference.json. The new test replays a flying snowball and compares the copy after each update with the single-player tracker's copy (packets-then-update vs update-then-packets, offset one tick).
- Port-read: destroy delay of one tick (EntityPlayerMP destroyedItemsNetCache), the stand-in per-entity shared tick count.

## Verification

- `node --test --test-timeout=600000 src/mpthrown84-b84.test.js`: 6 pass (cadence table, snowball copy vs single-player tracker, potion damage in S0E, out of range, rocket status 17 then destroy then one burst, old rows without `trk`).
- Existing tests that encoded the old `ents` rows were updated (they now read `trk` rows or replay a `RemoteDispense`): `mpdispense-b61.test.js` (arrow, egg poof now 8 particles per impact update by the copy, rocket trail and burst by the copy), `b62-lead.test.js` (streams columns first; spawn y is 1/32 blocks), `mpend2-b64.test.js`, `mpprojectiles-b62.test.js`.
- 30 test files touching dispense/chunk view/fireworks: 287 tests, all pass after the updates; 27 more files touching dispOut/throwHeld/shootBow: 229 pass. `npm run build` ok. No full `npm test`, no browser.

## Follow-ups

- Fishing hooks (64/5/true, type 90) are not on the lane: `server-fishing.js` sends `fishFx` particles that would duplicate the copy's, and the client copy needs the angler lookup.
- Spawn state is the first-seen state at flush (thrown spawn sites call no `recordBirth`, only boats and carts do).
- Client copies do not yet feed hit targets (mob copies) to arrows and balls from this lane; they fly with an empty target list.
- Extra-dimension stand-in lanes keep exact `ents` rows.
- Browser-only: that the copies draw smoothly, snowball poof/portal particles show, rocket trail and burst look right.
