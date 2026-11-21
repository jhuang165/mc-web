# console93 (batch 93) track note

Scope: dedicated server `/netstat` packet accounting for the tracker. Claims are marked Executed, Bytecode-read or Port-read. No browser checks were run.

## Summary (file by file)
- `tools/probes/Console93Probe.java`, `tools/verify-console93.mjs`, `public/research/console93-reference.json`: new probe (copy of the 92 probe's world double). Records `cmdcart` (18 records: command 0/6/10/127/128/2-char UTF-8 x last output none/short/100 bytes, set through the real `agp.a(String)`, `agp.b(fj)` and `xo.e()`, whole-watcher S1C size), `cmdchange` (S1C of one changed string entry) and `s13` (S13PacketDestroyEntities with 0/1/2/5/127/128 ids).
- `src/multiplayer/server-cart-track.js`: `joinWatcher(boat, type, command, output)` adds the two strings' real size for a command cart; `stringChange(prev, cur)` gives the S1C entry bytes of watcher strings that differ.
- `src/multiplayer/server-vehicles.js`: per-view `cartStr` memory of a command cart's [command, watch24]; a changed string is `info.strings` on the row, or a `{ type: 'strings', bytes }` quiet kind when no row is sent (an output change does not change the wire row). Counting only, no wire change.
- `src/multiplayer/net-packet-ids.js`: `vehicleRecords` and `kindRecords` count the string S1C; `dispEntRecords` queues a vanished row's S13 on `ctx.destroyed` when the connection has a queue (else the old immediate count); `drainDestroyed` sends the queue in packets of at most 127 ids.
- `src/multiplayer/tnt-tracks.js`: `GolemTracks`, one native-style entry per golem snowball (64 / 10 / velocity, stand-in from `ObjectTracker.read('snowball')`).
- `src/multiplayer/server-dispense.js`: creates and updates `golemTracks` (after the entity pass, in `flush`), puts its kinds on the golem ball rows' info. Small local edits.
- `server/server.js`: passes `destroyed: ws.netDestroyed` for dispEnts messages and drains it at the top of each player's slot in the next tick (before that tick's sends).
- `src/console93-b93.test.js`: 6 tests (5 replay / unit, 1 live server test).

## Evidence
- Executed (Console93Probe, unchanged 1.7.10 classes): a fresh command cart's S1C is 42; with command n bytes and last output m bytes it is 42 - 4 + (1 + vint(n) + n) + (1 + vint(m) + m); watcher 24 holds the component's JSON, so an output of "[12:00:00] Hello" is 18 bytes with its quotes and an empty output after `xo.e()` is `null` (4 bytes, S1C 46). One changed string entry: S1C 6 + 1 + vint + bytes ("say hi" 14, "null" 12). S13 = 2 + 4 per id (127 ids 510).
- Executed (port, live server test): a Nether player's baby pig, whose age (watcher 12) changes every tick and which no port packet carries, adds S1C records on that connection through the per-dimension lookup (`mobsOf(dim)`). With the lookup replaced by the Overworld list the test fails (count stalls). This replaces "code-read only" for the Nether. The End uses the same `mobsOf(1)` branch and was not run live.
- Bytecode-read: `xn.c` creates watchers 23 and 24 as empty strings; they change only through `xo.e()` (called by `agp.a(fj)` after an output, and by the MC|AdvCdm handler) and `xn.a(dh)` (NBT read). EntitySnowball is tracked 64 / 10 / velocity true (`mn.a(sa)`, same as thrown-tracks.js). `mw.d(sa)` (func_152339_d) adds the id to `mw.bN`; `my.a()`, `my.a(mw)`, `my.b(mw)` and `my.c(mw)` call it; `mw.h` (onUpdate) drains `bN` after the container update, `hq` packets of `min(size, 127)` ids until the list is empty.
- Port-read: that the removal and the drain land in different ticks in the usual entity order (the player is earlier in the list than the entity); a removal during network handling of the same tick would send the S13 at once. Not modelled.

## Verification
- `node --test --test-concurrency=2 src/console93-b93.test.js`: 6 pass, 0 fail.
- Fails-without-fix: with `net-packet-ids.js` and `server-cart-track.js` reverted the file fails at import (no `drainDestroyed`); with the Nether lookup in `server/server.js` replaced by the Overworld list the live test fails ("S1C count 8 -> 9"), the other 5 pass.
- `node tools/verify-console93.mjs` OK (18 command cart records, 6 S13 records). `node --check server/server.js` OK.
- Regression: `node --test --test-concurrency=2 $(grep -l "net-packet-ids\|net-watch-bytes\|server-cart-track\|server-vehicles\|server-dispense\|tnt-tracks\|fireball-copy\|server/server.js\|server-cart-commands\|net-row-info" src/*.test.js)`: 51 files, 497 tests, 497 pass, 0 fail. `npm run build` once at the end: OK.

## Found wrong in the batch 92 list
- "Snow golem snowballs and other `b` rows get no tracker packets": only the golem snowballs lacked them. Fireballs and wither skulls already send their entry's packets (`ballTracks`), and arrows, thrown balls, hooks and rockets are `trk` rows with their own entries.
- "A vanished row's S13 has no one-tick delay": already delayed for mobs (`server-mobs.js` destroys held a tick), `trk` rows (`ThrownTracks.late`) and items. Only the `ents` rows (TNT, fireballs, skulls, golem balls) were immediate; those now wait.

## Follow-ups
- A dead cart or boat's S13 (`vehicles` `del`, not the 4-block re-check `leaving` path, which already waits a tick) is still counted in the message where the row goes.
- The S13 queue holds only dispEnts rows; natively one packet carries every kind's ids of the tick (mobs, items, carts together), counted here as separate packets.
- The End's lookup and the native per-world EntityTracker were not executed.
- Browser-only: nothing visible changes; /netstat output was not viewed in a browser.
