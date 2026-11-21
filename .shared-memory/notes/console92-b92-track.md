# console92 (batch 92) track note

Scope: dedicated server `/netstat` packet byte counts. Claims are marked Executed, Bytecode-read or Port-read. No browser checks were run.

## Summary (file by file)
- `tools/probes/Console92Probe.java`, `tools/verify-console92.mjs`, `public/research/console92-reference.json`: copies of the 91 probe/verifier. They add a "changeall" record per living class (each non-string watcher entry changed alone, with S1C size and S0F size) and "object" records (Boat, Minecart*, PrimedTnt, Fireball, SmallFireball, WitherSkull, FallingSand, Item, XPOrb, Arrow: S0E, S0E data, whole-watcher S1C) plus an S12 record.
- `src/multiplayer/net-watch-bytes.js`: `watchState` now derives creeper state/powered/ignited (16/17/18), enderman carried block and data (16/17), wither head target ids (17-20, via `hooks.witherHeads`). Scream (18) and invul (20) are not derived: the port's meta packets already count them.
- `src/multiplayer/net-packet-ids.js`: `watchSweep` (count-only per-tick S1C for mobs whose native watcher state changed, so a still mob is counted), `kindRecords`, `dispEntRecords` (TNT/fireball: S0E once on first sight, S1C whole watcher, S12 if velocity, then tracker moves; one S13 when a row vanishes), cart join adds the S1C whole-watcher record before S12.
- `src/multiplayer/net-row-info.js` (new): WeakMap side channel on dispEnts rows (no wire change).
- `src/multiplayer/tnt-tracks.js` (new): a TrackerEntry per primed TNT at 160/10/velocity, supplies the tracker packet kinds.
- `src/multiplayer/server-dispense.js`: small local edits only (creates `tntTracks`, calls update in `flush`, wraps rows in `setRowInfo`). `simulation.js` untouched.
- `src/multiplayer/server-cart-track.js`: `CART_WATCH`, `joinWatcher`.
- `src/multiplayer/server-vehicles.js`: join watcher size on the row info; quiet-view kinds go to `p.vehNet`.
- `server/server.js`: per-dimension `mobIndex` (Nether/End mobs via `dimensions.mobsOf`), per-connection `mobWatch` memory cleared on dimension change, `sweepWatch`, `vehNet` counting, `objs` memory passed for dispEnts.
- `src/console92-b92.test.js`: 7 tests.

## Evidence
- Executed (Console92Probe on the real 1.7.10 classes): whole-watcher S1C sizes Boat 26, minecarts 38, furnace cart 40, command-block cart 42, PrimedTnt/Fireball/SmallFireball 11, WitherSkull 13. One changed byte entry = 8 bytes, one changed int entry = 11, changed air short = 9, S12 = 11. S1C = 6 + changed entry bytes.
- Bytecode-read (`my` EntityTrackerEntry, `mn` EntityTracker): S1C sent on any tick of the gated branch when the watcher has changes; after spawn the whole watcher is sent if not blank, then S12 if velocity; TNT (xw) 160/10/velocity true, S0E `fw(sa, 50)` data 0; fireballs (ze) 64/10/false; carts and boats 80/3/true; S0E carries 6 motion bytes only when data > 0.
- Port-read: TNT/fireball tracker details beyond registrations, the `mobsOf` lookup for Nether/End (not unit-tested), the per-tick ordering in server.js.

## Verification
- `node --test --test-concurrency=2 src/console92-b92.test.js`: 7 pass, 0 fail.
- Regression: `grep -l "net-packet-ids\|net-watch-bytes\|server-cart-track\|server-vehicles\|server-dispense\|fireball-copy\|server/server.js\|server-mobs\b" src/*.test.js | xargs node --test --test-concurrency=2`: 655 tests, 655 pass, 0 fail (69 files; the first attempt hit an argument-list error from my own shell invocation, not a code failure).
- Fails-without-fix: with net-packet-ids.js and net-watch-bytes.js reverted, the new test fails at import ("does not provide an export named 'hooks'"). That is an import-level failure, not a per-assertion one.
- `node --check server/server.js` OK. `node tools/verify-console92.mjs` OK (29 classes, 16 objects).
- `npm run build` run once at the end (see commit message / lead).

## Found wrong in the batch 91 list
- "Derive scream and invulnerability": already counted via the port's own meta packets (META_ENTRY); deriving them would double count. Not added.
- "Nether/End mobs use class defaults for S0F/S1C": the values are fixed-size per class, so the defaults were already correct. Only changed-entry counts and the Nether/End mob lookup needed work.

## Follow-ups
- Command-block cart command strings add bytes to the join S1C (not counted).
- Golem snowballs and other 'b' rows get S0E/S1C/S12 on join but no tracker packets.
- dispEnts S13 is counted in the message where the row vanishes, with no one-tick delay.
- Nether/End mob lookup is code-read only.
- Browser-only: nothing visible changes in the client; /netstat output was not viewed in a browser.
