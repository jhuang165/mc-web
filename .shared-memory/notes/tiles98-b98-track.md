# tiles98 (batch 98): raw tag keys on hand-built copies, command block / sign round trip, inert null-item drop module

Branch `batch98-tiles98`, worktree `wt98-tiles`. Target is 1.7.10. This does not claim full parity.

## Summary
- `src/mob-equipment.js` `skullFields`: also copies `extraRaw` and `displayExtraRaw` (deep), so mob gear saves, reads and pickups (`saveGear`, `readGear`, `java-mobs.js`, `mob-equipment-live.js`) keep unknown tag keys.
- `src/minecarts.js` `itemTagsNbt` / `toNBT`: cart item tags write `extraRaw` keys and `displayExtraRaw` keys inside `display`; an empty `extraRaw` (`tag: {}`) is written. Reading (`put`) already went through `readItemTags`.
- `src/item-component.js`: already native, no change. `stackTagCompound` goes through `writeItemTags`, which writes both raw maps (display extras inside `display`); test added.
- `src/inert-drops.js` (new): `InertDrops` (spawn, tick, save, restore) and `inertDropNbt`: the null-item EntityItem as a record (age to 6000, pickup delay 10, saved as `Item {id 0, Count, Damage 0}`). `src/jukebox.js`: new `spawnInert` hook, called when a `ghost` stack is ejected (the port's item entity cannot hold an id-0 stack). `entities.js` and `main.js` untouched.
- New `src/tiles98-b98.test.js` (6 tests).

## Evidence
- Executed (tiles95-reference.json, real classes, batch 95): 13 Control and 4 Sign records replayed through read, browser save (`save`/`restore` JSON, `Signs.toJSON`/`fromJSON`) and write: all equal to native (LastOutput normalised, SuccessCount any int incl. negative, TrackOutput byte-only, sign cut at 15 UTF-16 units incl. a lone surrogate). Item 2 was already native, no code change.
- Executed (batch 97, tiles97-reference.json) and Bytecode-read (`alq.e`, `xk.h`, `yx.a`): null-item EntityItem is inert, unpickable, non-merging, despawns at 6000, writes id 0.
- Port-read: the three hand-built copy sites above.

## Verification
- `node --test --test-concurrency=2 src/tiles98-b98.test.js`: 6/6. With `minecarts.js`, `mob-equipment.js`, `jukebox.js` reverted: 3 pass, 3 fail.
- Targeted run of 110 files naming minecarts, mob-equipment, jukebox, java-mobs, cart-variants (plus the new test): 1516 tests, 1515 pass, 1 fail: `cmd-exec-b83` (/summon keeps Fire...) is the known flake, passes alone 4/4.
- No full `npm test`, no build (`inert-drops.js` is not imported by a bundled entry yet), no browser.

## Follow-ups
- Not wired: nothing in `main.js`, the save, the away/dimension records or `region-export.js` creates an `InertDrops` or calls `spawnInert`, so a ghost disc still leaves nothing visible in the live game. Needs: an `InertDrops` instance ticked each game tick, `spawnInert` passed to `installJukeboxes` (`main.js`, `multiplayer/server-music.js`), its `save()` in the dimension record, and `inertDropNbt` written as entities in the Java export, and read back from `Item` id 0 on import. Physics (motion, gravity) is not modelled; position stays at the spawn point.
- A known key with a wrong type (e.g. `ench` as a string) is still dropped. Skull ExtraType cache hit still needs a server lookup.
- Browser-only: none seen (ghost drop is invisible by design).
