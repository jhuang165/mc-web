# console96 (batch 96) track note

Scope: dedicated server `/netstat` packet accounting for players entering a viewer's tracked set and the per-tick packets of tracked players. Claims are marked Executed, Bytecode-read or Port-read. No browser checks were run.

## Summary (file by file)
- `src/multiplayer/net-packet-ids.js`: `peerRemovals` (b95) now also counts the spawn of a player who enters `ctx.peers`: S0C (87 + VarInt(id) + name string), whole-watcher S1C (37 for id < 128), S20 (69, +25 with the sprint modifier), then S1B for a rider, S04 for a held item, S0A for a sleeper, S1D for invisibility. The `tick` message no longer counts one S18 per other-player row: far rows count nothing and a tracked row counts the packet kinds in its `pk` field (S15/S16/S17/S18/S19/S1B). A row without `pk` (a caller that bypasses the tracker) keeps one S18.
- `src/multiplayer/server-player-tracker.js`: the shared per-player entry records the packet kinds it sent this tick (`st.kinds`); `rowsFor` puts them on the viewers' tracked rows as `pk` (extra wire field, ignored by the client).
- `tools/probes/Console96Probe.java`, `tools/verify-console96.mjs`, `public/research/console96-reference.json`: new probe (Console95Probe's world double plus DifficultyProbe.player).
- `src/console96-b96.test.js`: 4 tests.

## Evidence
- Executed (Console96Probe, real `gb`, `hw`, `il`, `hz`, `in`, `hx`, `yz`): S0C = 89 + name length for entity id 0 (names of 1, 5, 15, 16 chars: 90, 94, 104, 105; held item or empty hand identical, the item is a short); one profile property "textures" (400 value, 684 signature) adds 1097. Whole S1C 37, S20 69 (2 watched attributes: max health, movement speed), 94 with the sprint modifier (25 each), S04 with a sword 14, S1D 9, S1B 10.
- Bytecode-read (`my.b(mw)`, tryStartWatching): after `c()` (S0C for an EntityPlayer, `gb`) it sends S1C whole when the watcher is not blank, S20 when the attribute set is non-empty, S12 only with sendVelocityUpdates (false for players), S1B(0) for a rider, S04 for slots 0 to 4 that are non-null, S0A for a sleeper, S1D per active effect.
- Bytecode-read / Port-read (cadence): `my.a(List)` runs the position block when `ticks % frequency == 0` (players: 2) or airborne or the watcher changed, so an off-beat tick sends nothing; the port's shared TrackerEntry (batch 74/75) already models it, I only expose what it sent. The 400 counter increments on beat ticks only, so the resync S18 comes about every 800 ticks (test: at least 2 teleports in 2000 ticks).
- Port-read: tracked membership is the tracker's (range 512 clamped to the tracker limit, chunk watched); rows outside it are `far`, so only in-range players count.

## Verification
- `node --test --test-concurrency=2 src/console96-b96.test.js`: 4 pass, 0 fail. With `net-packet-ids.js` and `server-player-tracker.js` reverted: 0 pass, 4 fail.
- `node tools/verify-console96.mjs` OK (8 s0c records, 2 follow records).
- Regression: 36 files that name net-packet-ids, the tracker, netstat or the dedicated server, 305 tests, 305 pass, 0 fail. No old test was edited (none encoded the per-row S18).

## Found wrong in the batch 95 list
- None. The follow-up "tick counts an S18 per other-player row each tick, far rows included" was right and is closed.

## Follow-ups
- Armour S04s (slots 1 to 4) of a spawning player are not counted: the wire row carries only `held`.
- A changed player watcher sends an S1C of the changed entries (and S20 for changed attributes) from the entry; not counted (the master entry emits no packet for it). Effects other than invisibility (S1D) and a profile with texture properties (online mode, +1097) are not counted at spawn.
- A newly tracked player's first tick also counts the entry's packets of that tick (native order: the spawn is sent before the position block); the count order inside the tick is S13/spawn first, then positions, which matches.
- Browser-only: nothing visible changes.
