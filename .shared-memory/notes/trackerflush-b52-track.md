# trackerflush b52 track

Branch `batch52-trackerflush` from 8cd3f1725 (0.80.0).

## Summary
1. Executed joint walk. `tools/probes/TrackerJointProbe.java` runs the real 1.7.10 `mn` EntityTracker (tag `b52tf`) with chickens, items, arrows, snowballs, xp orbs and an EntityPlayerMP stand-in, driven by a World.updateEntities stand-in (list order, removal at the entity's own index, the player's onUpdate flushing its destroy queue as one S13). Three 60-tick cases: `mix` (player mid-list), `playerFirst`, `playerLast`; entities born and removed during the run. `tools/verify-tracker-joint.mjs` writes `public/research/tracker-joint-reference.json`.
2. Same-tick destroy flush modelled. An entity removed before the player in loadedEntityList is destroyed in its own tick, one after the player a tick later (playerFirst: all late, playerLast: initial entities same tick, later spawns late). `MobTracker.applyParts` uses `t.beforePlayer(live)` (default false = old one-tick-late rule); `EntityWorld.beforePlayer` answers from the order stamps (known at the first `tickMobs` = before the player, spawned later = after it). The joint walk hands the hook to the ObjectTracker.
3. Entity ids at creation. Eyes of ender (`launch`, `load`), fish hooks (`use`/cast, `load`) and restored items/arrows/orbs (`EntityWorld.withBalls`, new `takeId`) take `EntityIds.take()` when created or loaded; saves do not store the id. `main.js` wires `ids` into both (2-line hunk).
4. Replay equals the executed record per tick (kind, entity id) for all three cases: spawn order, the one HashSet order (the player's own entry occupies a slot: a phantom key), moves, looks, velocity, heads, destroys.

## Evidence
- Executed: `tracker-joint-reference.json` (real `mn`, `my`, `mw`/stand-in; EntityTracker range clamp 144). Replay in `src/tracker-flush-b52.test.js`.
- Bytecode-read: `mw.h` offsets 74-179 (destroyedItemsNetCache flush), `ahb.h` removal; the port's player order is an approximation (entities known at the first tickMobs are before the player).
- Model limits: the Java first update merges with the join (setup then tick 1); the replay builds entries from row 0 and shows row 1 at the first walk. playerLast: the late-joining player gets the spawns in HashSet order, the port's player is present from the start, so that first tick compares as a set.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-tracker-joint.mjs` -> `tracker-joint: mix=60 playerFirst=60 playerLast=60`.
- `node --test src/tracker-flush-b52.test.js` -> 8 pass (3 replays, flush cases in the record, mutation check, beforePlayer, restored item id, eye and hook ids).
- `node --test` over the 127 test files named tracker/object-tracker/entities/eye/fishing/projectile-nbt/entity-ids plus every file mentioning EntityWorld or tickMobs -> 2383 pass, 0 fail. `npm run build` ok. No full `npm test`, no browser check (not visible).

## Follow-ups (proposed gap lines)
- Tracker: the player's place in loadedEntityList is approximated (before = existed at the first tick, after = spawned later); an entity restored from a chunk after the first tick counts as after the player.
- Tracker: a player that joins a running walk is sent spawns in HashSet order natively; the port sends in id order at the first tick.
- Tracker: entities other than mobs, items, arrows, thrown entities and orbs (vehicles, paintings, hooks, eyes) are not in the executed joint record.
