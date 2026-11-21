# spcopy94 (batch 94): the single-player sent-column gate for the entity trackers

## Summary
The integrated server's trackers now start an entity only once its chunk column was SENT to the player, at login and at every portal arrival, five columns per tick in the native spiral. Does not claim full parity.

- `src/sp-chunk-gate.js` (new): `SpChunkGate` wraps the dedicated server's `ChunkWatch` (`multiplayer/server-chunk-view.js`: queue, spiral, move, five per tick). Interface: `restart()`, `step(x, z, radius)`, `sees(cx, cz)`, `takeFresh('mobs'|'objects')`. `spGateConfig.enabled` (off by default) and `newMobTracker` decide whether a tracker gets a gate.
- `src/entity-tracker.js`: `setChunkGate`, `shareChunkGate` (the object tracker takes the mob tracker's gate in `jointUpdate`), `beginTick` steps the gate right after `watch.update` (before any entry is tried, as `mw.h` runs in the player's tick), `flagPlayer` treats "columns sent this tick" as a flag so the second loop re-lists the entries (func_85172_a), `joinPlayer` and `leaveWorld` call `restart()` (login, respawn, arrival all queue the square again, nothing sent).
- `src/entities.js`: the three `new MobTracker` sites go through `newMobTracker`. `src/main.js`: `spGateConfig.enabled = !active?.remote` each movement tick (multiplayer replica keeps the old behaviour; trackers made from then on are gated).
- `src/spcopy94-b94.test.js` (5 tests).

## Evidence
- Executed (spcopy93 / chunk-view probes, reused): nothing is sent at track time for an unsent column; five columns per tick, spiral from the player's chunk; each sent column re-tests its entities.
- Bytecode-read (spcopy93): `my.b(mw)` needs `my.d(mw)` (column sent); `mn.a(mw, apx)`.
- Port-read: `PlayerWatch.gate` and the `fresh` re-list already existed for the dedicated server; the tracker's second loop is the re-list.

## Verification
- `node --test --test-concurrency=2 src/spcopy94-b94.test.js`: 5 pass. With the re-list line removed from `flagPlayer`: 3 fail, 2 pass (restored).
- Tracker family (`tracker*`, `*tracker*`, `spcopy9*`, `entities*`, mptrackers71, mpchunks71, awaytracker-b60): 388 pass, 0 fail. `npm run build` once: ok. No full `npm test`, no browser.

## Found wrong in the batch 93 list
Nothing. The "too wide" estimate was right in cost but the gate fit behind `PlayerWatch.gate` plus one flag.

## Follow-ups
- Held target with a near arrival: not attempted. The Teleporter result is still computed only after the old world's save point; unchanged from spcopy93.
- Simplifications: the gate steps in `beginTick` (the dedicated server does the same order), so at login the first five columns are already sent when the join pass sends the held entities (first-pass order among them is the HashSet order as before). Unloading a column does not remove tracked entities (the tracking range does, as before). The gate radius follows `viewChunks`; all columns exist (infinite world). A tracker created in the very first movement tick may precede the `spGateConfig` switch in main.js.
- Browser-only: entities now pop in over about 1 to 4 seconds (89 ticks for view 10) after a portal arrival and at login, nearest columns first; mobs near the player should appear in the first tick or two. Check that nothing near the player stays missing and that item drops and arrows in sent columns still show at once.
