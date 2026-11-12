# trackerorder b49 track

Branch `batch49-trackerorder` from ac7027870 (0.77.0).

## Summary
- New `src/java-hashset-order.js`: `JavaHashSetOrder` (add(key, id) / remove(key) / keys() in iteration order, `capacity`) and `hashSetOrderOf(ops, mode)`. Models java.util.HashSet over int-hashed entries: 16 buckets to start, load factor 0.75, doubling when size exceeds the threshold, no shrink on removal, tail insertion in a chain, order kept across a split, and the "chain of nine in a table under 64 doubles it" rule (treeifyBin).
- `MobTracker` (`src/entity-tracker.js`, and so `ObjectTracker`) keeps one such set (`order`). An entry joins at creation with hash = entity id (`hashId`: a numeric id, the number in a mob's `"mob-<n>"`, else a per-tracker counter) and leaves with `forget(e)` when its entity leaves. The `sendLocation` walk and the flagged `tryStart` walk now run in `walk()` order, so S14/S15/S17/S18/S19/S12/S1C etc. are emitted in bucket order, as `EntityTracker.updateTrackedEntities` visits `trackedEntities`.
- Java version decision: the reference models **Java 8 and later** (default `"java8"`); the executed probe ran on JDK 19.0.1 and recorded it. 1.7.10 shipped for Java 6/7/8, and Java 7 orders differently (front insertion, other hash, resize before insert, transfer reverses chains); `"java7"` exists in the helper, written from the OpenJDK 7 source and NOT executed. Java 6 not modelled.
- Not changed: spawn packets still go out when the entry is created (native trackEntity at spawn), the client copies still flush and step in entry creation order (the native client steps in spawn-packet arrival order), and the mob tracker and object tracker are two sets (mob ids are the port's `mob-<n>` counter, object ids start at 1<<24), so entries of the two trackers are not interleaved by id.
- No committed reference disagreed: object-tracker, -extras, -hits, -vehicles, entity-tracker, tracker-mounts, tracker-timing-b48 all pass unchanged (they compare per-entity streams).

## Evidence
- Bytecode-read (`javap -c -p`): `mn` (EntityTracker) field `c` is `new HashSet()`; trackEntity `new my(...)` then `c.add`; untrackEntity `c.remove`; `mn.a()` (updateTrackedEntities) iterates `c` calling `my.a(List)` (updateEntity), collects tracked players, then iterates `c` again calling `my.b(player)` for every entry but the player's own. `my.hashCode()` returns `sa.y()` (the entity id); `my.equals` compares ids.
- Executed: `tools/probes/TrackerOrderProbe.java` + `tools/verify-tracker-order.mjs` -> `public/research/tracker-order-reference.json`: real `my` objects for real boats given ids by `Entity.setEntityId`, added to and removed from a real `java.util.HashSet`, iteration order recorded after every op: small, sequential (60 ids across the 12/24/48 thresholds), collide (ids sharing buckets, chain of nine), high (ids over 65536 and 1<<24), noShrink, readd, 4 seeded random histories (713 recorded orders). The Java 8 model matches all 713; the Java 7 model matches 41 of them (expected, not executed).
- The tracker scenarios (mobs 3,2,35,1 walk 1,2,3,35; orbs 18,2,34,1 walk 1,18,2,34) are port tests of the walk, not probe rows.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-tracker-order.mjs` -> 10 histories, java 19.0.1.
- `node --test src/tracker-order-b49.test.js` -> 8 pass, 0 fail.
- `node --test src/object-tracker*.test.js src/entity-tracker*.test.js src/tracker-*.test.js src/mobpush-b46.test.js src/blaze-ghast-world.test.js src/vehicle-render-b48.test.js` plus entity tests mentioning mob-riding/leash/horse/bat/squid/dragon/away/ring -> 313 pass, 0 fail. `npm run build` once. No full `npm test`, no browser run.

## Follow-ups (proposed gap lines)
- Mobs and objects have separate hash sets and id spaces; natively one counter numbers every entity, so the relative send order of a mob and an item is not modelled (each tracker's own order is).
- Client copies are stepped and flushed in entry creation order, not packet arrival (walk) order.
- The Java 7 HashMap model is source-recalled, not executed; treeified bins (9+ colliding ids at 64+ buckets) are not modelled; a user on Java 6/7 would see other orders.
- Spawn order of live entities is the port's list order, which matches native spawn order only where the port lists entities when they are created.
