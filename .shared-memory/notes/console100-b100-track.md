# console100 (batch 100) track note

Scope: `/netstat` accounting of a tracked player seen by another player (spawn, per-tick S1C / S20, then S0B and S12). Claims are marked Executed, Bytecode-read or Port-read. No browser checks were run.

## Summary (file by file)
- `tools/probes/Console100Probe.java`, `tools/verify-console100.mjs`, `public/research/console100-reference.json`: new probe on the real classes (probe dir `tools/research/console100-probe/`, git-ignored).
- `src/multiplayer/server-player-tracker.js` (shared-ish, named): the master entry's dirty attribute set is now sent only inside the gated branch (entry tick % 2, jump, or a changed watcher), and a joining player's set starts with `movementSpeed` (plus `maxHealth` when a Health Boost modifier is present), so the first gated pass counts the S20 of 41 to his viewers and to himself. A `joined` set tells a join from a dimension change. Viewer rows get `velSent` where the owner's row had `vel`.
- `src/multiplayer/net-packet-ids.js` (named): `playerPackets` counts S0B(0) when a row's `swing` is 6 (first) and an S12 for `vel` / `velSent` (last); the self row counts its own S12; `sleepWake` and `pfx73` use the VarInt entity id (self id / `pl`).
- `src/console97-b97.test.js`: first step now expects `[[32, 41]]` (the old test encoded an empty first pass, which is not native, see Evidence).
- `src/console100-b100.test.js`: 4 tests.

## Evidence
- Executed (Console100Probe, ids 1 / 200 / 70000): S0C 94 / 95 / 96 for "Steve", offline profile with 0 properties (87 + VarInt id + name); whole S1C 37; S0A 14; S1B (ride and dismount) 10; S12 11 (a component of 9.0 clamps, still 11); S0B 3 / 4 / 5 for animations 0, 2, 4, 5 (VarInt id + byte); sprint on 66 and off 41 (movementSpeed S20). All equal the port's constants, except that S0B was a flat 3.
- Executed (`real`, the real `yz(world, profile)` constructor on the world double): watched set maxHealth + movementSpeed, dirty set after construction = movementSpeed only (S20 41). The first gated pass of the entry (m = 0) sends it to every tracker and the player himself.
- Bytecode-read (my.b(mw)): the leash S1B is inside `instanceof sw` (EntityLiving) and EntityPlayer extends `sv`, so a player never sends one. S12 in b(mw) needs the entry's velocity flag (false for players). `sv.ba` (swingItem) sends S0B(0) with `mn.a(entity, packet)` (every tracker, not the swinger) when no swing runs or the progress is at least 3. `my.a(List)` ends with `if (velocityChanged) b(new hy(entity))`, and `my.b(ft)` also sends to the entity's own connection.
- Port-read: the old master pass counted the dirty set every tick with no gate and had no first-pass set.

## Verification
- `node --test --test-concurrency=2 src/console100-b100.test.js`: 4 pass; with the two source files reverted: 4 fail.
- Regression: 22 files naming the tracker, net-packet-ids, netstat, watcherSig or the velocity module: 186 tests, 185 pass before the console97 edit, then console97 + console100 10 of 10 pass.
- `MC_RESEARCH=tools/research node tools/verify-console100.mjs`: 3 player records.
- `npm run build` not run (no import changed).

## Found wrong in the batch 99 list
- Nothing wrong; item 3 (empty textures property) was left open there and stays open.

## Follow-ups
- A respawn builds a new EntityPlayerMP natively (new entry, new first pass); the port keeps the master per player id, so no second first-pass S20 or S13 + S0C pair.
- Swing: the port's `swing === 6` stands for an accepted C0A; the native condition (progress at least 3) is not replayed.
- Hurt: 1.7.10 sends the hurt animation as S19 status 2, not S0B(1); whether a tracked player's hurt S19 reaches viewers in `/netstat` was not checked. A crit S0B on a mob target stays flat 3 (port mob ids are not native ids). The wake-up S0B(2) to trackers of a sleeper is not counted.
- Browser-only: nothing visible changes.
