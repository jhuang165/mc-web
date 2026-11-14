# Batch 71 mptrackers71: per-player item and orb tracking on the dedicated server

## Summary
- New `src/multiplayer/server-object-tracker.js` (`ObjectTracker`): one `TrackerEntry` (the entry the single-player object tracker uses) per player and per dropped item or XP orb. Item range 64, orb range 160, frequency 20, velocity true; each range is clamped by `rules.trackerLimit` (`v*16-16`); square test; the tracking list is re-evaluated at the first pass, when the object moved over 4 blocks, and when the player moved over 4 blocks (the join counts).
- Hooks (one line each): `simulation.js` builds `this.objectTracker`; `server/server.js` `broadcast` passes each player's tick message through `objectTracker.messageFor(pid, m, dim, shared)` (all three dimensions, since it works on the final message), and the welcome snapshot is cut by `objectTracker.snapshot`.
- A player's tick carries only the `items` / `xp` rows he tracks; an absent list clears his copies, so leaving range removes the entity on his client (S13) and entering range spawns it (the client already diffs the list: `syncMultiplayerItems` / `syncMultiplayerOrbs` in `main.js`). `taken` (S0D) goes to players that tracked the item (previous or current pass) plus the collector. No client or `main.js` change, no new wire name (`itrack` unused).
- Orb targeting and collection are untouched (`tickOrbs` still uses every player of the dimension).

## Evidence
- Bytecode-read (`javap -c -p` on `mn` = EntityTracker, unchanged jar): `xk` (EntityItem) -> `a(sa, 64, 20, true)`, `sq` (EntityXPOrb) -> `a(sa, 160, 20, true)`; `mn.a(sa,int,int,boolean)` starts with `if (range > this.e) range = this.e`. (`ss`, the hanging entity, is the 160 / MAX_INT / false row, not the orb.)
- Executed (earlier batches, reused not re-run): `tracker-items-reference.json` / `TrackerItemsProbe` for the entry cadence and spawn/destroy; `tracker-reference.json` for the square test with `lastScaled / 32` integer division and the 4-block re-evaluation. `TrackerEntry` is the code those replay.
- Recalled: S0D for a pickup is sent to the trackers of the collected item (`EntityTracker.func_151247_a`).
- No new Java probe: the cadence was already executed; this track only moves it onto the server.

## Deviation (honest)
- The dedicated server sends items and orbs as full snapshots every tick (positions each tick), not packets. The entry's 20-tick position cadence and S12 thresholds are not applied to those positions because the client has no item physics to fill the gaps; only the tracking membership follows the entry. A real packet stream would need client item/orb physics.
- The welcome snapshot is cut by a plain square at the join position (not an entry pass). The `dimRespawn` snapshot (`server-dimensions.js`) is not cut; the first tick corrects it.
- `watches(pid, cx, cz)` (constructor arg, default always true) is the chunk-watch gate of `tryStartWachingThis`; mpchunks71 can set it once columns stream by view distance. The server world is finite (about 128 wide; players are clamped to it), so real distances above ~127 can only be tested on the tracker directly.

## Verification
- `node --test src/mptrackers71-b71.test.js`: 10 pass (ranges, two simulated players with one out of range, square test, view-distance clamp, enter/leave, 4-block threshold, S0D filtering, dimension change, snapshot, and a real two-WebSocket server run).
- `node --test` on mpitems-b59, multiplayer, mpvehicles-b61, mpnether3-b63, b63-lead, mpstate-b59: 47 pass, 0 fail. `node --check` on server.js, simulation.js, the new module: ok. `npm run build`: ok. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Client-side item/orb physics between 20-tick position packets (needed to apply the frequency).
- Cut the `dimRespawn` snapshot; plug mpchunks71's chunk gate into `watches`.
- Only a browser could show items popping in and out at the edge of range.
