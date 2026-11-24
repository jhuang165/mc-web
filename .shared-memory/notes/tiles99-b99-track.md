# tiles99 (batch 99): inert null-item drop wired (single player, save, export, import); known tag key with the wrong type stays raw

Branch `batch99-tiles99`, worktree `wt99-tiles`. Target is 1.7.10. This does not claim full parity.

## Summary
- `src/redstone-runtime.js`: the runtime owns an `InertDrops`; `installJukeboxes` gets `spawnInert` (a ghost disc ejection, `markUnsaved`); `tickBegin` ticks it once per game tick; `music.save()` / `music.restore()` carry it as `{ kind: "inert", x, y, z, count, age, pickupDelay }` records inside `musicTiles`. Because `musicTiles` already rides the world save, the away runs (`away-world.js`, `away-plan.js`), `chunk-runtime.js` and `world-import.js`, no other store changed. `main.js` is untouched (no line needed).
- `src/inert-drops.js`: new `inertItemNbt`, `inertFromNbt`, `inertRecords`. `inertDropNbt` no longer writes `PickupDelay` (1.7.10 `xk.b(dh)` writes only Health, Age, Thrower, Owner, Item; the batch 98 helper wrote a 1.8 field) and writes `Health 5`.
- `src/region-export.js`: `inert` records in `musicTiles` are written as `Item` entities through the same entity path as ordinary drops (Pos y+0.125, Fire, Health, Age, UUID...), `Item {id 0s, Count, Damage 0s}`; they are no longer treated as note/jukebox tiles.
- `src/region-import.js`: an `Item` entity with id 0 is read as an inert record (pickup delay restarts at 0, age 6000 or more ends it at once as natively), counted `Item (null item, inert)`, capped by `IMPORT_DROP_LIMIT`. Before, it was lost as "Item (unsupported stack)".
- `src/tag-types.js` (new) + `readItemTag` in `region-import.js`: a known tag key whose type the 1.7.10 accessor would not accept (`ench` / `StoredEnchantments` not a compound list with numeric id and lvl, `RepairCost` not int, `display` not compound, `display.Name` not string, `display.color` not int, `Unbreakable` / `map_is_scaling` not byte, `CustomPotionEffects` not a list, `pages`, `author`, `title`, `Explosion`, `Fireworks` (and its Flight / Explosions)) is no longer modelled or dropped: it is kept as `extraRaw` / `displayExtraRaw` and written back unchanged, and it does not enchant, rename or colour the stack.
- Not done: the dedicated server (`multiplayer/server-music.js`) still ejects nothing for a ghost disc; it needs a per-tick hook on the server sim plus saving, not small. `tools/probes/Tiles99Probe.java`, `tools/verify-tiles99.mjs`, `public/research/tiles99-reference.json` (28 records) are new.
- It draws nothing: an id-0 item has no icon, the port has no model for it, and there is no pickup, merge or physics (position stays at the spawn point, no motion).

## Evidence
- Executed (Tiles99Probe, real `aor.c` / `aor.b` through a Chest): 26 stacks with a known key of the wrong type written back byte for byte (ench string / int / entries with string id, StoredEnchantments, display int / string, Name int, color string / short, Lore string / compound list, RepairCost string / short / long, Unbreakable string / int, CustomPotionEffects, map_is_scaling, SkullOwner int, pages / title / author / resolved, Fireworks string and bad Flight, Explosion). A stack whose own `tag` is a string or list loses the tag (`hasKey("tag", 10)`).
- Executed / Bytecode-read (batch 97, `xk.h`, `yx.a`, `alq.e`): null-item EntityItem inert, unpickable, no merge, dies at 6000. Bytecode-read (`xk.b(dh)`): Health, Age, Thrower, Owner, Item written, no PickupDelay.
- Port-read: `redstone-runtime.js` tick and save wiring, export/import paths.

## Verification
- `node --test --test-concurrency=2 src/tiles99-b99.test.js`: 6/6. With `region-import.js`, `region-export.js`, `redstone-runtime.js` reverted: 2 pass, 4 fail.
- Targeted run of 147 files naming region-import/export, redstone-runtime, jukebox, item-tags, world-import, command-tags (plus the new test): 1804 tests, 1804 pass. (A first run, before two tolerance fixes, failed `command-tags` /give ench ints and `item-tags-b57` customIntList; both fixed in `tag-types.js`, no old test edited.)
- `npm run build`: ok.
- No full `npm test`, no browser. The `redstone-runtime.js` tick/save lines are covered by the node test (runtime built on a World); nothing in `main.js` was needed.

## Follow-ups
- Numeric tags the port reads tolerantly (`Unbreakable`, `map_is_scaling`, enchantment `id`/`lvl`) are rewritten as byte / short whatever their width (native keeps the tag as read). Entries of an `ench` list with extra keys, `Fireworks.Explosions` entries and the inside of `Explosion` are still read into typed fields and rewritten (extras lost).
- Dedicated server ghost disc (above). Inert drops have no motion or physics; not visible in a browser by design.
- Browser-only: none.
