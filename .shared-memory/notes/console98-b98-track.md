# console98 (batch 98) track note

Scope: `/netstat` accounting of a player spawn's profile properties, `watcherSig`, attribute modifiers on watched attributes. Claims are marked Executed, Bytecode-read or Port-read. No browser checks were run.

## Summary (file by file)
- `src/multiplayer/profile-properties.js` (new): `profilePropertyBytes(row)` = the bytes a "textures" profile property adds to S0C for a row with a `skin` and/or `cape` hash (0 without either): 9 + (VarInt + value) + (2 + 684). The value is the base64 length of Mojang's pretty-printed textures JSON (SKIN, plus CAPE if present); about 1065 for "Steve" with a skin.
- `src/multiplayer/net-packet-ids.js`: `spawnRecords` adds `profilePropertyBytes(p)` to the S0C.
- `src/multiplayer/server-player-tracker.js`: `watcherSig` is now the nine `watcherEntries` values joined, so it differs exactly when a DataWatcher value differs (it no longer reads effect id / amplifier / ambient strings).
- `src/console98-b98.test.js`: 4 tests.

## Evidence
- Bytecode-read: `gb.b` (S0C) writes uuid string, name string, VarInt property count, then per property three strings (name, value, signature; no flag), then the ints. Matches the executed b96 figure: 400 value + 684 signature = 9 + 402 + 686 = 1097.
- Bytecode-read (`yj` static init): only `generic.maxHealth` and `generic.movementSpeed` call `setShouldWatch(true)`; followRange, knockbackResistance and attackDamage do not. `tq.a(tn)` adds an attribute instance to the dirty set only when `th.c()` (shouldWatch) is true, and the spawn S20 sends the watched set. EntityPlayer registers only attackDamage on top of the living attributes. So Strength, Weakness and weapon item modifiers (all attackDamage) never produce an S20: item 3 is already native; the port's `mods` (Health Boost, Speed, Slowness, sprint) is the complete set.
- Executed (b97 console97-reference.json): writing an unchanged value marks no watcher entry changed.
- Port-modelled (not provable): the port signs nothing and has no Mojang session, so the textures value size follows the native JSON shape (64 hex hashes, 13 digit timestamp); a native offline-mode server sends no property. Counted only for accounts with a skin or cape.

## Verification
- `node --test --test-concurrency=2 src/console98-b98.test.js`: 4 pass; with the two source files reverted: 2 pass, 2 fail (the textures and watcherSig tests).
- Regression: 19 files naming the tracker, net-packet-ids, netstat or watcherSig: 165 tests, 165 pass, 0 fail. No old test edited. `npm run build` not run (server-only module, no client import).

## Found wrong in the batch 97 list
- Item "other potions / item modifiers on watched attributes are not modelled": nothing to model; they modify an unwatched attribute (see above).

## Follow-ups
- The exact value size of a real Mojang textures property varies with the name and cape; a player with the default skin on a real online server may still carry an (empty-textures) property, not counted.
- Browser-only: nothing visible changes.
