# dimtracker b55 track

Branch `batch55-dimtracker` from be55d463b (0.83.0).

## Summary
1. Executed respawn and dimension change. `TrackerJointProbe.runX` (tag b55dt) runs the real `mn` with up to two worlds (own HashSet and list each). Respawn: real `mn.b(old player)`, a new EntityPlayerMP stand-in with a new id at the end of the list, real `mn.a(new player)`. Dimension change: real `mn.b` in world A, same player object (same id) added at the end of world B's list through the real `mn.a`; B's entities are created at that moment. Cases `respawn`, `respawnLast`, `dimension`, `dimensionLast`, `earlySpawn`, `earlySpawnLast`; the seven older cases are byte-identical in the regenerated file.
2. The b54 respawn re-send (`resendWorld`) replays equal to the executed record with no port change. The port's dimension change already builds a new EntityWorld, tracker pair and client world, and the first update is a join; that replays equal too (new world's entities before the player, ids after it, spawns in the new set's order).
3. `MobTracker.leaveWorld(others)` / `EntityWorld.leaveWorld`: the old world's tracker lets the player go (copies cleared, dying/queues dropped, player key out of the set). main.js calls it before the new EntityWorld is made (one line).
4. Early spawns. `EntityWorld.joined` marks an object spawned during the entity pass while the current slot (`this.slot`) is before the player (`earlySpawns`); `jointUpdate` creates those entries before the due-destroy flush (`spawnEarly` hook). Spawns after the player's slot keep the old order (flush, then spawn).

## Evidence
- Executed: `tracker-joint-reference.json` cases above (real mn, my, entity and packet classes).
- Bytecode-read: the ServerConfigurationManager respawn / transferPlayerToDimension calls (only the mn calls are executed), World.updateEntities and the player's flush at its slot (probe stand-ins).
- Model limits: world B is created at the arrival (no entries ticked while the player is away); only objects (walk kinds) get the early-spawn mark, a mob spawned in the pass (baby, reinforcement) is still seen after the flush; spawns made by the network thread between ticks and by the tile-entity pass are not marked.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-tracker-joint.mjs` -> 13 cases x 60 ticks.
- `node --test src/tracker-dim-b55.test.js` -> 10 pass. Tracker/entity-ids/joint/dimension/portal/respawn test files plus every file mentioning MobTracker, jointUpdate, playerJoined, tickMobs or EntityWorld (142 files) -> 2475 pass, 0 fail. `npm run build` ok. No full `npm test`, no browser.

## Follow-ups
- Tracker: mobs spawned inside the pass by an entity before the player's slot still come after the flush; spawns from the network phase and the tile-entity pass are unmodelled.
- Tracker: world B in the probe does not tick before the arrival; a world that was ticking while the player was away would have moved entries' encoded positions.
