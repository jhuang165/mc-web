# tiles95 (batch 95): tile entity NBT audit and the idle away stop

## Summary
- `src/away-world.js`: an idle stop now calls `cmds.skipTicks(plan.ticks - ran)` and sets `ran = plan.ticks`, as batch 94 did for the budget stop. A command block firing after the 1200-tick gate can change `doDaylightCycle`; the ticks never run were counted at the rule in force at the start.
- `src/spawner-data.js`: `readEntry` reads Type with `getStringAny`; a missing Type is `""`, not Pig.
- `src/region-import.js`, `src/cart-summon.js`: command-block cart reads Command through getString (any tag), CustomName kept when a string tag even if empty, TrackOutput only from a byte tag.
- Skull: `skullBytes(type, rot)` in `src/skull-profile.js` keeps the raw SkullType/Rot bytes (`rawType`/`rawRot`) while the drawn type falls back to 0 out of range; `skull.js`, `region-export.js`, `falling-tiles.js` carry the raw bytes through save, export and /data.
- Jukebox (`src/jukebox.js`, `region-import.js` `jukeboxStackFromNbt`, `falling-tiles.js`, `setblock-tags.js`): the tile holds any stack (RecordItem, else legacy Record 1..32767 as a Count 1 stack); export writes the original id; ejection spawns any positive-count stack. `insert` is still disc-only (player right-click).
- New: `src/tiles95-b95.test.js` (8 tests), `public/research/tiles95-reference.json` (81 executed records), `tools/probes/Tiles95Probe.java`, `tools/verify-tiles95.mjs`.
- Old tests edited because they encoded non-native behaviour: `falling79-b79.test.js` (skull projection clamped type to 4 instead of keeping raw / drawing 0; jukebox projection was disc-only through the port reader) and `plants83-b83.test.js` (a stone RecordItem was expected to be dropped as "Not kept"; native keeps it).

## Evidence
- Executed: furnace, beacon, note, jukebox, sign, skull, flower pot, comparator, command block, spawner, enchanting table and ender chest read/write through the real `aor.c`/`a`/`b` (`tiles95-reference.json`, probe in `tools/research/tiles95-probe/`, git-ignored). Scalar fields matched; the divergences above are the ones found.
- Bytecode-read: skull renderer `bms` default case (out-of-range type draws as type 0); shared command logic `agp`.
- Port-read: idle-stop reasoning; browser save round trip (skull raw bytes via `Skulls.toJSON/fromJSON`, jukebox record via `writeJukeboxTile`).

## Verification
- `node --test --test-concurrency=2 src/tiles95-b95.test.js`: 8/8. Fails without the fixes (full revert fails at import; `away-world.js` alone fails test 8; `spawner-data.js` alone test 6; `cart-summon.js` alone test 5).
- 143 test files naming the edited modules, `node --test --test-concurrency=2`: 1590 tests, 1590 pass, 0 fail (after the two old-test edits above).
- `npm run build` once: ok. No full `npm test`, no browser.

## Found wrong in the batch 94 list
- Nothing in the list itself; the disc-only jukebox and the skull clamp were port assumptions encoded in batch 79/83 tests.

## Follow-ups
- Jukebox stack item tags are not kept; a disc with nonzero Damage reads Damage 0 (item model has no damage on undamageable items).
- A skull of raw type 7 drops damage 0 instead of 7.
- Skull Owner and player-head ExtraType were not re-executed (excluded: missing netty in the probe); earlier ItemTags2Probe evidence stands.
- A `Record` int with an unregistered id writes a null-item stack natively; not matched.
- Browser-only: rendering of a raw-type-7 skull, ejection of a non-disc stack from a jukebox, the clock after an idle-stopped away run.
