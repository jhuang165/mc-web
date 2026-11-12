# respawntracker b54 track

Branch `batch54-respawntracker` from 20bbab13b (0.82.0).

## Summary
1. Respawn re-send. `MobTracker.joinPlayer(id)` after the first update (a respawn: new EntityPlayerMP) now sets `resendPending`. The next update (`jointUpdate` and the serverTick path through `beginTick`) calls `resendWorld`: the client copies are reset in place (`dropClients`: not present, no queue, no mount/leash links, `dying` dropped, client list cleared) and every entry of the shared HashSet is sent its spawn again in set order (`tryStart` + `flush` per entry), before that tick's new entities. Copies keep their identity (renderers key on them). A respawn before the first update changes only the id.
2. serverTick (non-joint) path. `beginTick(add = true)` now does what `jointUpdate` does at the join: mobs before the player (`beforePlayer`) enter held, the player's key is added, then they are sent in `order.keys()` order; later spawns enter one by one. Without `beforePlayer` (no world) creation order stays.
3. Executed joint record extended: `TrackerJointProbe` has the real leash knot (su), firework rocket (zf), falling block (xj), primed TNT (xw) and thrown potion (zo) in cases `extras` (player mid-list, ids 1..) and `extrasLast` (ids 65530.., player last), tag `b54rt`. The five earlier cases are byte-identical in the regenerated file. Both new cases replay with no port change.
4. Not done: a spawn made by an entity before the player's slot reaching the client before the same tick's flush (the port cannot tell who spawned an entity; the probe's births are also a stand-in). Dimension change re-send is not touched.

## Evidence
- Executed: `public/research/tracker-joint-reference.json` cases `extras`, `extrasLast` (16 entities each, 16 spawns, 10 destroys, real mn/my).
- Bytecode-read: respawn = new EntityPlayerMP whose addEntityToTracker walks trackedEntities (HashSet order) with tryStartWachingThis per entry; client world cleared on respawn (setDimensionAndSpawnPlayer). The re-send itself is not an executed record.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-tracker-joint.mjs` -> `mix=60 playerFirst=60 playerLast=60 vehicles=60 vehiclesLast=60 extras=60 extrasLast=60`.
- `node --test src/tracker-joint2-b53.test.js src/tracker-respawn-b54.test.js` -> 13 + 5 pass.
- `node --test` over every test file named tracker/entity-ids/joint (206 pass) and 22 more files mentioning MobTracker, jointUpdate, playerJoined or tickMobs: 0 fail. `npm run build` ok. No full `npm test`, no browser smoke.

## Follow-ups (proposed gap lines)
- Tracker: the respawn re-send is bytecode-read, not executed; a dimension change does not re-send either.
- Tracker: a spawn by an entity before the player's slot comes before the same tick's flush natively; the port flushes first.
