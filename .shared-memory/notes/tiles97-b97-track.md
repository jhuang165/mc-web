# tiles97 (batch 97): unknown item tag keys kept, null-item jukebox entity read and executed, skull ExtraType offline

Branch `batch97-tiles97`, worktree `wt97-tiles`. Target is 1.7.10. This does not claim full parity.

## Summary
- `src/item-tags.js`: new raw maps on a stack, `extraRaw` (unknown keys of the item `tag`) and `displayExtraRaw` (unknown keys of `display`; Name, color, Lore stay modelled), stored as the existing `{t, v}` raw JSON. `readExtraRaw` fills them; `writeItemTags` writes them back (modelled keys win on a clash); `readItemTags`, `cloneItemTags`, `sameItemTags`, `hasItemTags` carry, deep-copy, compare and flag them, so container moves, splits, merge identity and the browser save (`Inventory.read`) keep them. An empty `tag` compound is `extraRaw = {}` (executed: native writes `tag: {}` back, and `areItemStackTagsEqual` then refuses to merge it with a plain stack).
- `src/region-import.js` `readItemTag`: calls `readExtraRaw`; unknown keys are no longer reported as ignored or counted in `tagsStripped`.
- `src/region-export.js` `stackNbt` and `src/item-component.js` `stackTagCompound`: write the `tag` compound when `extraRaw` exists even if empty.
- `src/jukebox.js`: a registered item the port cannot draw (`rawId`, e.g. 119) now keeps its whole tag (`rawTag`, raw JSON) and its positive Damage (`rawDamage`) and writes both back.
- New: `src/tiles97-b97.test.js` (8 tests), `public/research/tiles97-reference.json` (16 records, 9 entity steps), `tools/probes/Tiles97Probe.java`, `tools/verify-tiles97.mjs` (needs netty-buffer and netty-common on the library path for the stub server).

## Evidence
- Executed (real `aor.c` / `aor.b`): unknown keys (Extra int, byte, long, string, nested compound with a list, display.Foo, display.Deep, ench next to them) on a jukebox disc, and on a sword in chest, hopper, dispenser, dropper, plus furnace, brewing stand; all written back unchanged. Empty `tag` compound written back as `{}` (jukebox, chest).
- Executed (stub `MinecraftServer` with a profile cache, probe-only): skull type 3 with `ExtraType: Notch` and a cache miss (offline / integrated server that does not know the name) writes `Owner: {Name: Notch}` and no ExtraType; type 1 or an int/empty/ExtraType writes no Owner; `Owner` beats `ExtraType`; a cache hit with textures would write Id, Name and Properties (only a server lookup can, the port keeps the name). Without any server (`MinecraftServer.I()` null) `readFromNBT` throws and the tile does not load (batch 95 "type 3 missing" row).
- Executed (real `xk`/`add`): `new ItemStack((Item) null, 1, 0)`, `.copy()`, `new EntityItem(world, ..., stack)` and `World.spawnEntityInWorld` all succeed; `EntityItem.combineItems` returns false (null item); `Entity.writeToNBT` writes `Item {id 0, Count 1, Damage 0}`. Tick `h()` could not be run on the world double (NPE in the double, not native).
- Bytecode-read: `alq.e` (BlockJukebox.dropRecord): world rand three nextFloat, `add.m()` copy, `new xk`, pickup delay 10, spawn; the ejection is unconditional for any non-null stack. `xk.h()` only ends the entity for a null stack or past 6000 ticks; `yx.a(add)` (addItemStackToInventory) returns false for a null item, so a player cannot pick the entity up; `xk.c(int)` merge never merges it. `xk.a(dh)` keeps a stack with a null item (stack is non-null).
- Port-read: ejection spawns nothing for a null-item stack.

## Verification
- `node --test --test-concurrency=2 src/tiles97-b97.test.js`: 8/8. With `item-tags.js`, `region-import.js`, `jukebox.js`, `region-export.js`, `item-component.js` reverted: 3 pass, 5 fail.
- Targeted run of 126 test files naming item-tags, region-import/export, item-component, jukebox or world-import: 1602 tests, 1600 pass, 2 fail: `cmd-exec-b83` (/summon Ozelot air) is a flake, passes alone 4/4; `command-tags.test.js` encoded non-native behaviour (below), edited, 6/6.
- No full `npm test`, no browser, no build (no import added to a bundled entry beyond `jukebox.js` -> `item-tags.js`; build not run).

## Old test edited
- `command-tags.test.js` expected `/give ... {unused:1}` to report "Not kept in this build: unused"; native keeps the whole tag (executed), so it now expects `extraRaw` and no such line.

## Found wrong in the batch 96 list
- "Unknown tag keys on a jukebox stack are not kept": true, now fixed everywhere a stack passes through item-tags.js (all containers too).
- "A null-item stack: native ejection and tick not read": now read; native spawns an invisible, unpickable, non-merging EntityItem that despawns at 6000 ticks.

## Follow-ups
- Not matched: the port ejects nothing for a null-item stack (`jukebox.js` eject). Native leaves an inert `EntityItem` (id 0 when saved). Needs an inert drop entity (no render, no pickup, no merge, 6000 tick despawn) in `entities.js`/main/multiplayer; left out as it touches shared files and cannot be seen without a browser.
- Stack copies that build fields by hand (`mob-equipment.js skullFields`, `minecarts.js` cart item tags, `item-component.js` network text for display extras) do not carry `extraRaw`; only paths through `makeStack`, `readItemTags` and `stackNbt` do. A known-key with a wrong type (e.g. `ench` as a string) is still dropped.
- Skull ExtraType cache hit (Id, textures) needs a server lookup; not provable or matchable offline.
- Item 4 (sign edge cases, command block LastOutput/SuccessCount/TrackOutput round trip): not examined this batch.
- Browser-only: moving a tagged stack between containers in the UI, ejecting a tagged disc.
