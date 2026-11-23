# Batch 97 lead (2026-11-22)

Ten Sonnet tracks in `../wt97-<name>` on `batch97-<name>97`, cut from main b5fa6dc3d (0.125.0) and merged --no-ff on `batch97-lead`. Rules: `../artifacts/b97-lead/track-rules.md`, which add an echo-the-list rule before every `node --test` and a rule to stop all background work before the final reply. Released as 0.126.0.

## Merged
- credit97 773a3e311: a real reload drops the stashed thrower body (`forgetOwnerBodies`, one `main.js` line under `realLoad`); on the server, a mob's Thorns hits an arrow whose shooter logged out.
- mpperf97 559f82c54: `MC_MPPERF97`; the move scratch list keeps its backing store (pops instead of `length = 0`); `itemList` and `presence` use one loop (verify mode compares them with the old bodies).
- mpobjects97 76fbe2097: `redstone.lit` is the set at the flush (Overworld `flushedLit`, Nether and End `flushDimension().lit`); orb id and S24 order pinned.
- console97 652789ee4, 0dd153894: armour S04s, per-effect S1D, S20 modifier bytes, changed-watcher S1C and dirty-attribute S20 (`Console97Probe`). The lead sent it back once: `arm`/`fxn`/`am` rode on every tracked row each tick, and now ride only on the tick a viewer starts tracking.
- spcopy97 20b0e438a: End portal arming (`nearEndPortal` every 10 ticks), finite-root hints (`FinitePeek`), nearest-first prewarm order in `travel-loading.js`.
- horse97 d5e4b195d: `death-ride.js` with about four `main.js` lines (code-read only); the server's cart and boat riders stay seated through death (`Kill97Probe`).
- portals97 3da0325fa: `endArrival` pitch 0 (`Portals97Probe`).
- tiles97 0b6f64598: raw unknown tag keys (`extraRaw`, `displayExtraRaw`); `command-tags.test.js` edited (it expected stripping, which is non-native).
- mobrec97 96daa9627: no bat push; count-0 shears stay in the hand (bytecode-read: `EntitySheep.interact` returns false, so `interactWith` does not destroy them); `leads2.test.js` helper and a `mobrec96` source-pin regex edited.
- entnbt97 34ea391c9: player and mob NBT edge cases (`Entnbt97Probe`, `Entnbt97MobProbe`); `survival.test.js` food assert and `entnbt96` NaN asserts edited (they encoded clamping, which is non-native).

## Lead checks
- No merge needed a manual resolution. I reviewed every `main.js` change (credit97, horse97, entnbt97) and the shared-file diffs (`simulation.js`, `server-player-tracker.js`, `dimension-live.js`, `item-tags.js`, `survival.js`, `inventory.js`).
- I checked the mobrec97 count-0 shears claim against the 1.7.10 `interactWith` and `EntitySheep.interact` logic.
- One full `npm test` on the merged tree: 10774/10774. Build and bridge tests ok. No browser checks.
- spcopy97 started the whole suite once by accident (a BSD `sed` left the list empty) and stopped it at once. Flakes seen in track runs and left unedited: `mpchunks71-b71` snapshot square, `horse89-b89` sneak tick, `cmd-exec-b83`.

## Open
"Still open from batch 97" in `public/research/remaining-gaps.md`. Villager records, generic entity NBT and the null-item jukebox drop are the larger leftovers.
