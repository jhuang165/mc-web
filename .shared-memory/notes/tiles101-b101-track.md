# tiles101 (batch 101): item NBT kept raw through the server wire, world-import minecart items and item frames; tile tests

Branch `batch101-tiles101`, worktree `wt101-tiles`. Target is 1.7.10. This does not claim full parity.

## Summary
- `src/multiplayer/server-containers.js` (`cleanStack`, the one stack whitelist for C0E click windows, window 0 clicks, `windowInventory` and the Creative slot / drop): it kept only the legacy `EXTRAS` keys, so a Creative stack from a client lost lore raw, skull, custom potion effects, map_is_scaling, Explosion / Fireworks, `rawForms`, `extraRaw`, `displayExtraRaw`, `loreRaw`, `skullRaw`. It now merges `readFireworkTags(s)` and `readItemTags(s)` (the validators a save uses; a malformed raw tag is dropped) and refuses a stack whose tag fields exceed 32767 JSON characters (port bound, not a native number). Enchantment entry `raw` already passed (the lists are copied whole).
- `src/world-import.js`: the minecart item sanitiser `stored()` rebuilt enchantment entries as `{id, lvl}`, dropping entry `raw`; it now keeps a `raw` object. The other fields go through `readItemTags` (already carries `rawForms`, `extraRaw`, ...).
- `src/hanging.js` (`interact`): the frame item was `{ ...held, count: 1 }`, sharing `rawForms` / enchantment arrays with the held stack; now `structuredClone(held)` first.
- New: `src/tiles101-b101.test.js`.

## Evidence
- Port-read, wire: server -> client is a plain JSON clone for window items / set slot (`wireStack`), equipment (`stackCopy` in `server-mob-entries.js`), dropped items (`itemList` / `metaValues` with `copyStack`); the client rebuilds with `makeStack(..., s)` (spreads every key). So only client -> server (`cleanStack`) lost data. The server JSON state save (`server-save.js` `snap`) is a JSON copy; load goes through `PlayerInventory.read` / tile readers, which already carry the raw fields (batch 99/100).
- Port-read: world-import has one item copy (minecart items); `redstone` / other imported fields go through their own loaders.
- Tests (Executed in node): stacks with Unbreakable int, ench entry with int widths and extra key, unknown tag key, display extra key, and a firework star with extra Explosion keys survive: client->server `cleanStack`, `wireStack`, `importedRuntime` minecarts, frame placing + save + load (`hangingFromNbt`), all five container tile kinds (dispenser and dropper) through `writeContainerTile` / `readContainerTile`, and a live dispenser throw (thrown and remaining stack).

## Verification
- `node --test --test-concurrency=2 src/tiles101-b101.test.js`: 6/6. With `server-containers.js`, `world-import.js`, `hanging.js` reverted: 3 pass, 3 fail (wire, world import, frame).
- Targeted run of 59 files naming server-containers, world-import, hanging, server-inventory, cleanStack, multiplayer, server-handlers: 914 tests, 914 pass.
- `npm run build`: not run (new imports item-tags.js and fireworks.js are already loaded by inventory.js, no node: built-in). No full `npm test`, no browser.

## Found wrong in the batch 100 list
- None. Batch 100's "server wire / world-import not audited" is now audited: one loss on the wire (client -> server only) and one in world-import.

## Follow-ups
- Single-player and server item frames: the frame item is cloned on place, but frame drops on break (`dropItem(e, e.item)`) hand the same object to the item entity; harmless as the frame is removed.
- The 32767-character bound on a client stack's tag fields is a port choice; native allows what the packet size allows.
- Browser-only: none.
