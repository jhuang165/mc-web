# Batch 58 itemtags2: raw Lore, SkullOwner profiles, dispenser potions, map tooltips

## Summary
- A Lore list that is not a list of strings is kept as raw NBT (`loreRaw`). It shows nothing and round-trips through import, export, saves and moves.
- SkullOwner compounds keep every field (Name, Id, Properties.textures with Value and Signature) as raw NBT (`skullRaw`) plus a GameProfile model (`src/skull-profile.js`).
- The profile flows through moves, saves, Java import and export, /give, drops, pickups, the placed skull tile (`Owner`), tile sync, and the broken skull drop.
- Skins are not fetched (no network). A head with or without textures draws the default Steve skin.
- Dispenser splash potions pass a copy of the stack's CustomPotionEffects to the thrown potion (main.js and away-world.js read it).
- Map tooltips: "Unknown map" or "Scaling at 1:N" and "(Level L/4)" show only with F3+H. An unnamed filled map is titled "Map #damage" without F3+H.
- A skull tile only reads a profile when SkullType is 3 (found by the executed probe; the old port read it for any type).
- `src/commands.js` was not edited.

## Evidence
- Executed: `tools/probes/ItemTags2Probe.java` runs on the unchanged 1.7.10 jar. `tools/verify-item-tags2.mjs` writes `public/research/item-tags2-reference.json` (profiles, tiles, drops, maps, dispense). The new test replays it.
- Executed: NBTUtil read and write of profiles, null profile rules, TileEntitySkull Owner and ExtraType reads, the Owner-only write, BlockSkull drops, ItemMap lines (14 rows), dispenser potion effects.
- Bytecode-read: dv (NBTUtil), aeb (ItemSkull), anl (BlockSkull), apn (TileEntitySkull), adh.addInformation, kw (splash dispense: `new EntityPotion(world, x, y, z, stack.copy())`).
- Recalled: a null profile in the title throws a native NPE. The port shows "Head" instead.
- Recalled: skin download is a network lookup in native and is skipped here.

## Verification
- `node --test src/itemtags2-b58.test.js`: 10 pass, 0 fail.
- `node --test src/item-tags-b57.test.js src/command-tags.test.js src/skull.test.js src/itemtags2-b58.test.js src/away-order-b50.test.js src/block-audit.test.js src/maps-clock.test.js src/dispense.test.js src/dispenser-container.test.js src/minecarts.test.js src/region-import.test.js src/region-export.test.js src/tile-sync.test.js`: 89 pass, 0 fail.
- `node --test src/gui.test.js src/gui-screens.test.js src/away-world.test.js src/block-break-simulation.test.js src/inventory.test.js src/inventory-player.test.js src/item-names.test.js src/player-edit-simulation.test.js`: 91 pass, 0 fail.
- `npm run build`: built, exit 0.
- Full npm test not run (batch rule).
- No browser check was done.

## Follow-ups
- Skins are never fetched, so textured heads look like Steve.
- A map tooltip reads the stored map data and never creates it. A client that has not received the data shows "Unknown map", as native does.
- The advanced-tooltip title "Map (#0358/N)" is not part of this track's test; only the extra lines and the plain title are.
- Browser check worth doing: place a /give head with textures, break it in Survival, pick it up, and open F3+H on a filled map.
