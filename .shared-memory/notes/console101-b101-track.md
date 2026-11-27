# console101 (batch 101) track note

Scope: dedicated server packet model and `/netstat`: respawn tracker entry, hurt S19 and wake S0B counts, default-skin S0C, swing condition. Claims are marked Executed, Bytecode-read or Port-read. No browser checks, no new probe (everything below is bytecode-read or port-read).

## Summary (file by file)
- `src/multiplayer/server-player-tracker.js`: `respawned(id)` queues a respawn; the next `update` for the player's dimension drops the shared master entry (and its `joined` mark), the viewers' entries of him and his own viewer state. Viewer sets carry `reborn` (viewers that tracked the old entry) and `selfReborn`; rows get `rs` 1 (S13 then a new first pass) or 2 (the respawner's own new first passes). The new master entry gives a fresh first gated pass (S20 41 to trackers and himself).
- `src/multiplayer/net-packet-ids.js`: `peerRemovals` counts S13 + spawn records for `rs`; `playerPackets` counts S19 (26 bytes) for `hurt` and S0B for `woke` next to the swing S0B.
- `src/multiplayer/server-sleep.js`: `wake` sets `p.woke`; `field` emits `woke: true` on one presence tick (idempotent per tick).
- `src/multiplayer/server-survival.js`: `respawn` calls `playerTracker.respawned(p.id)` (one line).
- `src/multiplayer/server-swing.js` (new) and `simulation.js` (import + one line in addPlayer): `p.swing` becomes an accessor; assigning 6 (the accepted C0A) is ignored unless sv.ba's condition holds.
- `src/console101-b101.test.js`: 4 tests.

## Evidence
- Bytecode-read (`oi.a(mw, int, boolean)`): order is `mn.a(old)` (untrackPlayer), `mn.b(old)` (untrackEntity), world removal, new `mw`, ..., `mt.d(new)` spawn. `mn.b(sa)` runs `my.a(mw)` per entry for the old player as viewer and `my.a()` for his own entry, which calls `mw.d(entity)` (destroyedItemsNetCache) on every tracker: an S13 per tracker. Adding the new entity creates a new entry with its first pass, and every entry gets a first pass for the new viewer.
- Bytecode-read (`sv.ba`, `sv.j`, `sv.bb`): S0B(0) goes out only when `!isSwingInProgress || progress >= end/2 || progress < 0`; the end is 6, `6 - (amp+1)` Haste (rv.e), `6 + (amp+1)*2` Mining Fatigue (rv.f); `bb` adds one per update and ends the swing at `progress >= end`. With end 6 a spammed C0A is taken every 4th tick.
- Port-read: hurt S19 reaches viewers as presence row `hurt` (one tick); wake S0B(2) to trackers was carried by no row. Sizes: S19 26 and S0B 2 + VarInt id come from the b100 executed reference.
- Item 3 (default-skin S0C): offline-mode profile has 0 properties (executed b100, 94/95/96 for "Steve"); whether a live session server adds a `textures` property for a no-skin account cannot be proven offline. Left open as in b99.

## Verification
- `node --test src/console101-b101.test.js`: 4 pass; with the five source files reverted: 3 fail, 1 pass.
- Regression: 46 files (console*, mpsleep*, mphealth*, pvp, mpplayerfx75, mpvelocity77, mpwatched76, mpnether, mpdragon*, mpend, abilities100, credit*, mpstate, mpperf97, attack83, horse96, offline87, mpsmall2): 350 tests, 350 pass.
- `npm run build` not run (no new import reaches a `node:` module).

## Found wrong in the batch 100 list
- Nothing wrong.

## Follow-ups
- A same-dimension respawn counts no S07 (only a Nether respawn goes through `dimRespawn`); not added.
- Swing: at count 0 the port cannot tell how long an end above 11 (Mining Fatigue III+) lasts; it accepts there.
- Death status S19(3) to trackers is still not counted.
- Browser-only: nothing visible changes except that a spammed swing no longer restarts a remote copy's arm animation every click.
