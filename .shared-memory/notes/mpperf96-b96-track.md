# Batch 96 mpperf96: tracker and tick loops without iterators (eachValue96)

## Summary
- New `src/mpperf96-fast.js`, `MC_MPPERF96=on|off|verify` (default on). `eachValue96(c, fn, self)` walks a Map's values, a Set or an array through `forEach` / an index loop with the live semantics of `for (const v of c)`; off runs the for-of loop; verify walks both in lock-step (a live iterator advanced inside each callback, compared per element and at the end).
- `src/multiplayer/server-mob-entries.js`: `updatePlayerList` (once per entry per tick, a Map iterator each), `removeWatcher`, `beforePass`, and the five watcher loops of `serverStep` use `eachValue96`; the `order` / `look` array loops are index loops.
- Plain index loops (a source change, not switched; an array iterator reads `length` every step, so the visited elements are identical): `mpperf77-fast.js` nearbyLate (on path), `mpperf83-fast.js` pickupHits, `ai.js` nearby, `entities.js` noteMobSpawns, `player-physics.js` movePlayer axis pair (no `["x","z"]` literal), `server-portal-travel.js` step (lists and entities), `java-hashset-order.js` keys, `server-chunks.js` order.
- `tools/bench-alloc81.mjs` prints `mode96`; mode regexes of mpperf86..90 tests allow `mode96=`.

## Evidence
- Executed heap sampling with stack traces (travel, 150 ticks, `--heapprof`): the `next` frames are 15.2 MB of 259 MB, spread over about 60 callers (largest: serverStep 1.56, movePlayer 0.62, nearbyLate 0.55, portal step 0.50, hash-set keys 0.44, pickupHits 0.42, ai nearby 0.37, chunk order 0.36, deliverSounds 0.34, noteMobSpawns 0.32). The b95 "tracker iterators 15.6 MB" were therefore not one tracker site. Other top self-allocators seen (not touched): the `itemList`/`presence`/`itemsField` map closures in `multiplayer/simulation.js` (2.1 + 1.5 + 0.5 MB), `server-mobs.js:481` closure 1.1, `server-vehicles.js:393` 0.9.
- Executed after: `next` 10.4 MB, total 251 MB (-3%); remaining `next` sites are the rest of the tail (tick 1.0, world.onChange 1.0, ...).
- Executed bench (`--runs=3 --ticks=150`, base commit / off / on alternated twice): heap growth KB/tick 1276, 1270 / 1268, 1267 / 1269, 1267; ms/tick 4.3-5.4 for all (noise). The bench's heap-growth metric (sum of heapUsed increases between ticks) does not resolve a 1% change; the sampled profile is the evidence. Claimed: about 5 MB less allocation per 150 travel ticks (about 3%), no measurable tick-time change.
- Executed world hashes (`--state`, 150 ticks): equal base commit = off = on = verify (travel also verify): travel `8739d6266090f4ba,ff999ef463b1dfa9,c48866327711946f`, pen `d086204fea891b9e,ae05bf9079f7a664,3af862547ec8f96a`, terrain `f924502c999eb782,446240d4e983e152,38f38c4ab6dfde24`.

## Verification
- `node --test --test-concurrency=2 src/mpperf96-b96.test.js`: 3 pass (eachValue96 off/on/verify over Map/Set/array with adds and deletes during the walk; hash-set keys and chunk order against the old loops; bench hashes pen and travel off/on/verify plus `mode96`). Mutation (executed): `i = -radius + 1` in the chunk order loop fails the chunk-order test.
- Neighbours: see the last lines below.
- No full npm test intended, no build (imports only between existing modules), no browser. Incident: one early command chained after a failed `sed` ran `node --test` with an empty `$FILES` and started the whole suite; I stopped it with TaskStop after about 2 minutes (it had reported one failure in a dragon test, unrelated, not rerun).

## Found wrong in the batch 95 list
- The b95 baselines for travel (`7459b9003fda4e13,...,d5aa46cad2ae3123`) are stale on this main: the unmodified commit 0e2854338 gives `8739d6266090f4ba,ff999ef463b1dfa9,c48866327711946f`. Pen and terrain are unchanged.
- "tracker `next` iterators 15.6 MB" is all `next` frames of the server, over about 60 sites, not the tracker.

## Follow-ups
- Open: the `simulation.js` map closures (`itemList`, `presence`, `itemsField`, about 4 MB), `server-mobs.js:481` closure, `blockBoxesFast`, `tickMobs` shapes, `moveEntityBody`'s `bb.slice()`, and the remaining `next` tail (about 10 MB, many small sites). Single-player frame time is browser-only.
