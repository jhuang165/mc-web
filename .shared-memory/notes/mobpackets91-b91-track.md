# mobpackets91 (batch 91) track

Branch `batch91-mobpackets91` (from 0.119.0, 94e060855). Scope: the three mob-packet leftovers of batch 90. This is not full parity.

## Summary

1. **Watcher 8 (ambient).** `src/copy-meta.js`: `copyMetaOf` / the diff (reference and fast paths, same key order: potion, ambient, invisible, ...) carry `ambient` = every active effect is ambient, false with no effects. It goes out in S0F and S1C, and `applyCopyMeta` (already there) sets `potionAmbient`, which `copyPotionSwirl` reads.
2. **Gate forced by a dirty watcher.** `copyMetaDirty(last, e)` (new, read-only) and `changedOf` in `src/entity-tracker.js`: native `my.a(List)` enters its gated branch on `ticks % freq == 0 || isAirBorne || DataWatcher.hasChanges()`. The port only counted health, bat, squid and horse flags, so a potion, ambient, invisible, burning, air, scream or wither change sent S1C but waited for the next frequency tick for S20, the head and the position. Now any copy-meta change opens the branch.
3. **Mid-pass spawns.** `src/entities.js` `adoptSpawns(order)`, run after each entity's turn: mobs pushed onto `entities` during the pass are appended to the order and update in the same pass. This covers babies, zombie reinforcements, slime children, an egg's chick and converted villagers. `probeFixedList` turns it off for the b45 horse replays (see below).
4. **S12 after head: executed.** `tools/probes/MobPackets91Probe.java` + `tools/verify-mobpackets91.mjs` -> `public/research/mobpackets91-reference.json`.

## Evidence

- **Executed:** the real EntityTrackerEntry on a real cow: at a tick that is not a frequency tick, Speed added + head turned 90 + velocityChanged sends `S1C, S20, S19, S12` in that order (tick 10 of the record). velocityChanged alone sends only S12 (tick 20), the head alone only S19.
- **Bytecode-read:** sv.bo (updatePotionEffects): empty effects set watcher 8 = 0, 7 = 0; otherwise watcher 8 = aen.b(effects) (all rw.e() ambient), 7 = aen.a(effects). my.a(List) gate and S12 at 1277.
- **Bytecode-read:** ahb.d(sa) (spawnEntityInWorld) does `List.add` on loadedEntityList (e) directly; updateEntities re-reads size per index.
- **Port-read:** the b45 probe (EndermanWolfProbe) walks a fixed `ents` array, so born foals are not updated there.

## Verification

- `node --test --test-concurrency=2 src/mobpackets91-b91.test.js`: 3 pass. With copy-meta.js and entities.js stashed: 2 fail; with entity-tracker.js stashed: the order test fails.
- Neighbour run (files naming copy-meta, ambient, entity-tracker, tracker classes, breeding, spawns, village fights, mobpackets): `node --test --test-concurrency=2` over the files naming those (about 190 files): 3948 pass, 0 fail (after the old-test edits below; the first run before them had 20 fails, all the babies, the b45 horse replays and the S0F meta list).
- `npm run build` not run (no new imports beyond existing modules). No browser checks.

## Old tests changed (they encoded the gap)

- chicken, crops (pig), entities (cow), sheep tests: a baby made by breeding has `growingAge` -23999 after its spawn tick (it updates once in that pass), was -24000. The b44 record's [0, 5999] is only the parent; the probe never ticks the foal.
- mobcopies2-b61 `meta` test: the S0F list now holds `ambient: false` (native watcher 8 exists on every living entity).
- The b45 horse breed records still replay: `enderman-wolf-replay.js` sets `ew.probeFixedList` for records with `init`.

## Found wrong in the batch 90 list

- None. The comment in entities.js ("a mob spawned during the loop joins the next tick") was stale and is replaced.

## Follow-ups

- Dispenser / spawn-egg mobs made in the network phase (between passes) are not mid-pass and unchanged.
- Spawns that remove an entity in the same turn (equal list length) would be missed by `adoptSpawns`' length test.
- Browser-only: the beacon particle look on a remote client.
