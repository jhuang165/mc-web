# console94 (batch 94) track note

Scope: dedicated server `/netstat` S13 accounting. Claims are marked Executed, Bytecode-read or Port-read. No browser checks were run.

## Summary (file by file)
- `src/multiplayer/net-packet-ids.js`: `queueDestroys(ctx, n, late)`. Every kind's S13 ids (mobs `destroy`, `itrack` / `trk` rows, `vehicles` `del`, dispEnts rows) now go to one per-connection queue `ctx.destroyed = { n, next }` instead of a record per kind. `n` = ids the port already held a tick (mobs, items, thrown rows, a cart that left the 4-block re-check), due in this tick's drain; `next` = immediate removals (TNT, fireball, skull and golem rows, a dead cart or boat), due one drain later. `drainDestroyed(q)` sends `n` in packets of at most 127 ids, then rolls `next` into `n`. Without a queue the ids still count at once.
- `src/multiplayer/server-vehicles.js`: the `vehicles` message carries `delLate` (how many `del` ids had already waited a tick, the `leaving` path). Extra wire field, ignored by the client.
- `server/server.js`: the queue is passed for `tick`, `mobs`, `vehicles` and `dispEnts` messages; the drain moved to the END of each player's slot (the mob, vehicle and entity messages are sent in the slot, so the ids they carry join the same packet).
- `src/console93-b93.test.js`: three assertions adapted (field `next`, one extra roll drain). They encoded the b93 single-kind queue, not native behaviour.
- `src/console94-b94.test.js`: 4 tests (3 unit, 1 live End).

## Evidence
- Bytecode-read (re-checked): `hq` (S13) writes one byte count then an int per id (executed sizes in console93-reference.json: 2 + 4 per id). `mw.d` adds to `bN`; `mw.h` sends `min(size, 127)` ids per `hq` until `bN` is empty, so one onUpdate sends ONE packet for every kind's ids unless more than 127.
- Executed (port, live server): an End player's baby pig (watcher 12 changes each tick, no port packet carries it) adds S1C records through `mobsOf(1)`. With the lookup replaced by the Overworld list the test fails ("S1C count 21 -> 22"). Closes "the End lookup was not run live".
- Port-read: the delayed kinds (mobs, items, thrown rows, `leaving` carts) are already held a tick by the port, so they count in the drain of the tick they are sent; immediate kinds wait one drain.
- Not extended: Console93Probe already executed S13 with 0/1/2/5/127/128 ids; no new probe records were needed.

## Verification
- `node --test --test-concurrency=2 src/console94-b94.test.js`: 4 pass, 0 fail. Fails without the fix: unit tests need `queueDestroys` (old code returns separate records); with the End lookup replaced the live test fails.
- Regression: 52 files that name the touched modules, 501 tests, 501 pass, 0 fail. `node --check server/server.js` OK.

## Found wrong in the batch 93 list
- None.

## Follow-ups
- A removal during network handling of the same tick would send the S13 at once natively (not modelled).
- Browser-only: nothing visible changes.
