# tiles96 (batch 96): jukebox stack tags and Damage, raw skull drops, unregistered Record ints, tile coverage

Branch `batch96-tiles96`, worktree `wt96-tiles`. Target is 1.7.10. This does not claim full parity.

## Summary
- `src/jukebox.js`: the tile keeps the whole stack. `writeJukeboxTile(tile, x, y, z, original, entryOf)` writes the stack through `entryOf` (region-export's `stackNbt`: tag compound, raw Damage). `readJukeboxStack` keeps a registered item the port cannot draw as `{ id: 0, rawId, count }` and a legacy `Record` int that names no registered item as `{ id: 0, ghost: true, count: 1 }` (native writes Record 0 and a RecordItem of id 0, Count 1, Damage 0). `restore` keeps the tag fields, rawDamage, rawId and ghost; `insert(x, y, z, item, stack)` stores the held stack's tag and damage (BlockJukebox stores stack.copy()); ejection spawns nothing for a stack with no port item.
- `src/region-import.js`: `jukeboxStackFromNbt` returns the full stack with its tag; a Damage the port cannot hold (a disc at 5) is `rawDamage` on damage 0 (the b82 convention), written back by `stackNbt`. New `pistonFromNbt`: blockId through the block registry (an unregistered id is air, executed 70000 and -3 write back 0).
- `src/region-export.js`: `stackNbt` exported; the jukebox tile passes it. `src/falling-tiles.js`: a RecordPlayer data tag leaves the old stack alone unless it carries a RecordItem compound or Record above 0 (readFromNBT), instead of a lossy write/overlay round trip.
- `src/skull.js` `skullDrops(type)`: the raw SkullType byte is the item damage (7 drops Damage 7, 100 drops 100, negative reads 0): damage 0 plus `tags.rawDamage` above 4. `installSkullBreak`, `block-break-simulation.js`, `redstone-drops.js` pass `tile.rawType ?? tile.type`; `placeSkull` places a rawDamage skull stack as its raw type.
- Hooks: `redstone-runtime.js` `use(x, y, z, held, stack)`, `multiplayer/server-music.js` (insert with `s.held`, ejection `makeStack(..., stack)`), `main.js` two one-line edits (code-read only): `music.use(..., survival.held)` and the eject spawn carries the stack.
- New: `src/tiles96-b96.test.js` (8 tests), `public/research/tiles96-reference.json` (68 records, 8 drops, the 315-id item registry), `tools/probes/Tiles96Probe.java`, `tools/verify-tiles96.mjs`.

## Evidence
- Executed (real `aor.c` / `aor.b`, `BlockSkull.breakBlock`, real authlib 5.0.47): jukebox with disc Damage 5 / -3, tags, a sword with Damage 12, RecordItem id 0, Count -5, Record ints 26..70000 (registered: 51, 90, 95, 119, 175, 256, 408, 2256, 2267; null item: 26, 36, 140, 176, 255, 2268, 5000, 32767 and up); skull drops of raw types 0, 4, 5, 7, 100, -1, -128; Skull Owner on type 3 and 7 and as a string; hopper, dispenser, dropper, brewing stand, chest (CustomName, cooldown, BrewTime, slots, Count 0 and -1); note byte/short/int edges; end portal and daylight sensor (no fields); moving piston (wrong types, doubles, out of range).
- Skull Owner and ExtraType: Owner replays through the real classes with authlib (`item-tags2-reference.json` `tiles`, already executed in batch 58; the batch 95 "missing netty" note was stale: only the ExtraType network lookup, `MinecraftServer.I()`, cannot run offline, and its read still keeps the profile).
- Bytecode-read: `apn.d()` (the ExtraType lookup needs a server).
- Port-read: ejection of a null-item stack (native `EntityItem` with a null item not read, so the port drops nothing), the single-player insert and eject hooks, the browser save round trip (`save`/`restore`).

## Verification
- `node --test --test-concurrency=2 src/tiles96-b96.test.js`: 8/8. Without `jukebox.js` and `skull.js` fixes: 3 pass, 5 fail.
- Targeted run, 175 test files naming the edited modules (jukebox, skull, falling-tiles, region-import/export, setblock-tags, redstone-runtime, server-music, drops): 2309 tests, 2307 pass, 2 fail before the two old-test edits below; after them `falling79-b79`, `tiles95-b95`, `tiles96-b96`, `plants83-b83` rerun 34/34.
- `npm run build` once: ok.
- Old tests edited (they encoded non-native behaviour): `tiles95-b95.test.js` expected no stack for `Record 9999` (native keeps a null-item stack, executed); `falling79-b79.test.js` jukebox projection now compares id, count and port damage only (the old native projection ignored tag and Damage).
- No full `npm test`, no browser, no build.

## Found wrong in the batch 95 list
- "Skull Owner and ExtraType were not re-executed" was stale (item-tags2 already holds them against real authlib); the remaining gap is only the ExtraType lookup, not provable offline.

## Follow-ups
- Unknown tag keys on a jukebox stack (`Extra:7` in the probe) are not kept: the port's item model keeps only the tags it models.
- A null-item stack in a jukebox: native ejection and tick behaviour not read; the port drops nothing.
- The single-player ghost stack keeps the block metadata of the save.
- Browser-only: ejecting a tagged or damaged disc, drop and placement of a type 7 skull, raw items in a jukebox.
