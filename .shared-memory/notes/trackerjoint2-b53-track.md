# trackerjoint2 b53 track

Branch `batch53-trackerjoint2` from 5ea7bb4d1 (0.81.0).

## Summary
1. The player's place in loadedEntityList. `EntityWorld.playerJoined(fresh)` (called at the first `tickMobs`, and from `respawnPlayer` in main.js with `fresh = true`): every entity the world holds is placed first (`withBalls`), then the player takes a real stamp in `orderSeqs` under `playerKey` (`beforePlayer` reads it; `playerStamp` stays as the fallback) and an entity id from the shared counter (`ids.playerId`). Model (bytecode-read): at login the entities loaded with the world's chunks are in the list first and the player is appended; entities spawned or loaded later stand after it; a dimension change keeps the player and its id (the new world's list gets it at its first tick); a respawn is a new EntityPlayerMP: new id, end of the list. A chunk that streams in after the first tick therefore counts as after the player, as natively.
2. The player's tracker entry is a key of the HashSet (`MobTracker.joinPlayer(id)`, `addPlayerKey`): its id takes a slot (this was a test-only phantom key in b52). It enters the set at the first update, after the entities the world already held and before the later spawns.
3. A joining player is sent spawns in HashSet order. In `jointUpdate` the first update creates the entries of the entities before the player with their spawn held, adds the player's key, then sends them in `order.keys()` order; entities after the player enter by id with their spawn at once. The `playerLast` first tick is now compared in order, not as a set (the b52 test's set workaround is gone). Respawn re-stamps and re-ids the player but does not re-send the entries (the client copies of the port survive a respawn).
4. Same-tick order of a destroy and a spawn: the due destroys of `dying` entries are applied at the start of the joint tick, before the tick's new spawns (the player's flush runs in the entity loop, before the spawns at its end). Matches the executed `vehicles` record where a destroy and a spawn share a tick.
5. Executed joint record for vehicles, hanging entities, eyes and hooks: `TrackerJointProbe.java` gets the real boat (xi), minecart (xl.a types 0 and 1), painting (tb), item frame (st), eye of ender (zd) and fish hook (xe, the angler is the player stand-in) and two new 60-tick cases, `vehicles` (player mid-list, ids 1..16) and `vehiclesLast` (ids in the 16-bit fold range, player after the 9 initial entities), tag `b53tj`. Entities are born and removed before and after the player's slot. The three batch 52 cases are byte-identical in the regenerated file (checked per case). The replay needed no change for the new kinds beyond the join and the destroy-before-spawn order above.

## Evidence
- Executed: `public/research/tracker-joint-reference.json` cases `vehicles`, `vehiclesLast` (real mn/my with xi, xl, tb, st, zd, xe; EntityTracker range clamp 144).
- Bytecode-read: the login/respawn/dimension-change list placement (above), mw.h flush point inside the world's entity loop. The probe's World.updateEntities and its place of births (after the list loop) are stand-ins: a spawn made by an entity before the player's slot would reach the client before the same tick's flush; the port cannot tell who spawned an entity, so it sends the due destroys first.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-tracker-joint.mjs` -> `mix=60 playerFirst=60 playerLast=60 vehicles=60 vehiclesLast=60`.
- `node --test src/tracker-joint2-b53.test.js` 10 pass (5 replays, record coverage, 2 mutation checks, playerJoined, rejoin); `node --test src/tracker-flush-b52.test.js` 8 pass.
- `node --test` over 142 files named tracker/entities/entity-ids/eye/fishing plus every file mentioning EntityWorld, tickMobs, MobTracker or ObjectTracker -> 2481 pass, 0 fail. `npm run build` ok. No full `npm test`, no browser check (not visible).

## Follow-ups (proposed gap lines)
- Tracker: a respawn does not re-send the world's entries to the new player (the client copies survive; natively a new client world gets every spawn again in HashSet order).
- Tracker: the same-tick order of a due destroy and a spawn is the probe's (flush, then spawns); a spawn by an entity before the player's slot comes first natively. The serverTick (non-joint) path adds the player's key but keeps creation-order spawns.
- Tracker: the player takes its entity id at the first `tickMobs`, not at login; entities loaded before that moment have lower ids (matches native order), but a save loaded in a dimension other than the Overworld takes it in that world.
- Tracker: leash knots, fireworks, falling blocks, TNT and thrown potions are still outside the executed joint record.
