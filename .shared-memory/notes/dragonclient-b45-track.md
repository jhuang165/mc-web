# dragonclient (batch 45)

## Summary
Client copies of mobs in `src/entity-tracker.js` (ClientEntity), with executed evidence from `tools/probes/TrackerMountsProbe.java`
(unchanged `my`, `xa` EntityDragon, `ws` EntitySquid on a client world double; `tools/verify-tracker-mounts.mjs` writes
`public/research/tracker-mounts-reference.json`, replayed by `src/tracker-mounts.test.js`).

- Ender Dragon client copy (executed: cases `flyDragon`, `dragonDeath`): the client has its own seven parts (placed by the client's onLivingUpdate,
  no wing sweep, head attack or block breaking), its own health from the spawn packet and S1C (data watcher 6), and its own death branch
  (onDeathUpdate: deathTicks, hugeexplosion puffs at 180..200, climb 0.1 a tick without clip, spin 20 degrees a tick). Server `spawnParticle` is a
  no-op, so the particles (largeexplode every dying tick, hugeexplosion) and the wing sound come only from the client copy, drawn from the client's own
  Entity.rand. Part ids on the client are dragonId + 1..7 (executed in the probe). The boss bar and death rays in `dragon-renderer.js` read the
  client health and deathTicks.
- Squid air (executed: case `squidAir`): the client counts its own air out of water (300 when wet or dead, -20 wraps to 0) and the server's per-tick
  air change dirties the data watcher, so S1C and a location packet go out every tick; the port now sends and applies it.
- Player-ridden mounts: bytecode-read and executed for the pig. A ridden pig client is moved by packets alone (no client code reads its rider), so
  the port no longer follows the live pig. A ridden horse does steer on the client (EntityHorse, from the rider); that is not ported and the horse
  still follows the live one. Boats and minecarts (object-tracker.js) were not examined.
- Browser check (muted headless Chrome, port 5531): a squid in a pool had a client copy distinct from the live entity (client x 72.576 vs live 72.720
  at the same moment, client air 300). The screenshot in `artifacts/b45-dragonclient/` (uncommitted) does not show the squid clearly through the water,
  so the drawn-from-client-copy claim rests on the numbers and the renderer reading the client copy, not on the image.

Not executed (bytecode-read only): the NetHandlerPlayClient spawn dispatch, the ridden-pig and horse analysis.

## Verification
- `node tools/verify-tracker-mounts.mjs` regenerated the reference (14 cases).
- `node --test src/tracker-mounts.test.js`: 20 tests pass (a mutation of the air decrement made 3 fail).
- `node --test` over tracker-mounts, entity-tracker, entities, dragon-renderer, dragon-world, dragon, dragon-sweep, dragon-model, squid-bat-mobs,
  squid-bat, mob-riding, player-mount: 127/127; dimension-live, end, object-tracker-extras: 50/50. No full `npm test`; no build run.

## Follow-ups
- The horse the player rides steers on the client copy (EntityHorse client branch); port it.
- A ridden pig now trails the camera by the interpolation lag because the camera still uses the live seat.
- The dragon's client crystal search (only its nextInt(10) draw is modelled) and the client playing the living sound (draws only, `silent`).
- Boat and minecart client copies of a player rider (object-tracker.js) are unexamined.

## Lead change on merge
- The ridden pig's copy follows the live pig again (`MobTracker.serverTick`, `tracker-mounts.test.js`). With the copy packet-driven while the camera and seat use the live pig, the drawn pig trailed its rider by the interpolation lag, which native does not show (natively the rider sits on the client pig). Moving the seat and camera to the client copy is the follow-up; the bytecode finding (no client code reads the pig's rider) stands.
