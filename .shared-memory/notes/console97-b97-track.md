# console97 (batch 97) track note

Scope: dedicated server `/netstat` packet accounting for a player's spawn extras and watcher/attribute changes. Claims are marked Executed, Bytecode-read or Port-read. No browser checks were run.

## Summary (file by file)
- `src/multiplayer/server-player-tracker.js`: `watcherEntries(p)` models the nine player watcher entries (0, 1, 6, 7, 8, 9, 16, 17, 18) and the modifier counts of maxHealth and movementSpeed. The shared master entry diffs them each tick and keeps `wp`: an S1C of the changed entries (6 + their bytes) and an S20 of the dirty attributes (9 + 28 or 32 + 25 per modifier). `rowsFor` puts `pw` on tracked rows AND on the player's own row, plus `arm` (non-empty armour stacks), `fxn` (active effect count) and `am` (modifiers in the spawn S20).
- `src/multiplayer/net-packet-ids.js`: a tracked row counts its position kinds then `pw`; the self row counts `pw`. The spawn counts armour S04s after the held one, one S1D per active effect (`fxn`; rows without it keep the invisibility S1D), the S20 with 25 bytes per modifier (`am`). Whole S1C is now 37 for every entity id.
- `tools/probes/Console97Probe.java`, `tools/verify-console97.mjs`, `public/research/console97-reference.json`: new probe on the real classes.
- `src/console97-b97.test.js`: 5 tests.

## Evidence
- Executed (Console97Probe): whole player watcher = 9 entries (31 bytes), whole S1C 37; one changed entry: flag/arrows/ambient/cape 8, air 9, health/colour/absorption/score 11; three at once (0, 1, 6) 16; writing an unchanged value marks nothing. S20 for one dirty attribute: maxHealth 37 / 62 / 87 / 112 with 0 to 3 modifiers, movementSpeed 41 / 66 / 91 / 116. S04 plain iron helmet 14, Protection IV chestplate 65. S1D 9, S1E 6.
- Bytecode-read: S1C (`hw.b`) and S20 (`il.b`) and S04 (`hz.b`) write the entity id with `writeInt`. `my.b()` (private, EntityTrackerEntry) sends S1C when `DataWatcher.hasChanges`, and S20 for the dirty watched attributes, with `b(ft)` = to every viewer and to the player himself (`mw.a.a`); it is called only inside the `ticks % 2 == 0 || isAirBorne || hasChanges` block, so a change goes out in its own tick. `mw.a(rw)` / `mw.a(rw, boolean)` / `mw.b(rw)` send S1D / S1D / S1E only through the player's own handler (`nh.a`), never the tracker. tryStartWatching order: S1C whole, S20, S04 slots 0 to 4, S0A, S1D per effect.
- Port-read: the port's potion colour (`potionColor`) is used for entry 7; speed / slowness / health boost / sprinting are the modifiers.

## Verification
- `node --test --test-concurrency=2 src/console97-b97.test.js`: 5 pass, 0 fail; with both source files reverted: 0 pass, 5 fail.
- `MC_RESEARCH=.../tools/research node tools/verify-console97.mjs` OK (9 entries, 9 s1c, 8 s20 records).
- Regression: 49 files naming the tracker, net-packet-ids, netstat or the dedicated server (mp*, console*, streamfix73, offline87): 420 tests, 420 pass, 0 fail. No old test edited.

## Found wrong in the batch 96 list
- Item 3 ("S1D/S1E when an effect is added or removed while tracked"): not native. Add, change and finish go only to the player himself; viewers learn from the watcher colour (S1C). Spawn S1D for every effect is native and now counted.
- b96 `spawnRecords` grew the whole S1C by the VarInt size of the id; S1C holds an int id, so it is 37 for every id.

## Follow-ups
- `watcherSig` (b75) still forces the off-beat position block when an effect's amplifier changes though the real colour can stay equal; native only forces it when a watcher value differs. Left as is (cadence change, out of scope).
- `arm`, `fxn` and `am` now ride only on the row of the tick a viewer starts tracking a player (the tracker marks `tracked.entered`); `pw` only on change.
- Attributes other than the Health Boost / Speed / Slowness / sprint modifiers (e.g. other potions, enchant or item modifiers on watched attributes) are not modelled. Profile texture properties at spawn (+1097) still not counted.
- Browser-only: nothing visible changes.
