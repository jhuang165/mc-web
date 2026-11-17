# Batch 79 catalogue79: sweep of the parity catalogues and research docs

## Summary
- Generated catalogues fixed in their generators, then regenerated (never hand-edited): `tools/build-content-catalogue.mjs` (19 item rows said "no item form natively"; now "native ItemBlock exists but is not in the Creative lists", linked to the new `item-form79-reference.json`) and `tools/build-settings-catalogue.mjs` (ANAGLYPH said "applied to final pixels", DIFFICULTY said the hardcore lock and server difficulty were open). Regenerated `item-parity-catalogue.md` (19 rows) and `settings-parity-catalogue.md` (2 rows). Status words did not change (all still Partial or Implemented as before), so the status counts and the `KNOWN_ABSENT` table in `src/catalogue-consistency.test.js` needed no edit. `recipe-parity-catalogue.md` not touched.
- Docs (old text kept, dated "Batch 79 (docs sweep, 2026-11-16)" lines added): `parity.md` (15 Working-systems rows: Vehicles, Movement, Survival health, Creatures/combat, Bows, Ladders, Creepers, Weather, Snow and ice, Fire, Armor, Sugar cane/falling blocks, Experience, Nether/End/boss row, Farming), `nether.md` (portal gap), `streaming.md` (sign and beacon UI), `commands-b13.md` (server scoreboard), `note-jukebox.md` and `music.md` ("Now playing" claim), `fire.md` (fire item), `villager-trading-live.md`, `wolves.md`, `spawn-eggs.md` (Adventure), `resource-packs.md` (b78 description and frames), `sneaking.md`.
- New: `tools/probes/ItemForm79Probe.java`, `public/research/item-form79-reference.json`, `src/catalogue79-b79.test.js` (2 tests).

## Evidence
- Executed: `Item.getItemFromBlock` over blocks 1 to 175 with the unchanged jar. All 19 ids the catalogue called "no item form" (8, 9, 10, 11, 43, 51, 52, 60, 62, 90, 99, 100, 119, 122, 125, 127, 137, 141, 142) return an `ItemBlock` (`abh`, or `aeg` for the slabs) whose item id equals the block id. 31 blocks return null (26, 34, 36, 55, 59, 63, 64, 68, 71, 74, 75, 83, 92, 93, 94, 104, 105, 115, 117, 118, 124, 132, 140, 144, 149, 150, 165 to 169); none of those had a row. This agrees with the batch 78 falling-block record for 8, 9, 10, 11, 51, 90.
- Bytecode-read (taken from `spexec78-b78-track.md`, not redone): the jukebox "Now playing" claim in `note-jukebox.md` and `music.md` is wrong for 1.7.10.
- Port-read (grep of `src/`, `src/multiplayer/`, existing docs and track notes): every other correction, for example vines, villagers, Looting, powered rails, anaglyph upload conversion (`post-shaders.md` already said so), sign and beacon sends in `main.js`, `hardcore.js` `difficultyLocked`, `server-scoreboard.js`. Each new doc line says "stale" or "not rechecked" only where that is what was read.

## Verification
`node --test` on catalogue79-b79, catalogue-consistency, content-catalogue, settings-catalogue, recipe-catalogue, block-metadata-catalogue, docs-sweep-b70, item-names, vite-base-path: all pass (26 + 19 in two runs, 0 fail). `npm run build` ok. No full npm test, no browser.

## Follow-ups
1. Real code gap, unchanged: `nether-generator.js` `canNeighborBurn` throws "unported". Reachable only when fire has no solid top below; `WorldGenFire` places on netherrack, so not hit in practice. The structure catalogue rows (WorldGenFire, GlowStone1/2, HellLava, "not ported") stay Implemented as before; Partial would be more honest and needs a generator change in `build-surface-catalogue.mjs` (`NETHER`).
2. Not swept row by row: the remaining `parity.md` rows (Hunger, Mining, Crafting, Tools, Item drops, Boats, Buckets, Pigs), the "Not ported" lists in `dimensions.md`, `region-import.md`, and the entity and gui catalogue limitation text. `buckets.md` still says "there is no Nether" (single-player Nether water fizz not checked).
3. `wolves.md`: whether the port lets a wolf take a lead, and wolf owners on the server, were not checked.
4. `.shared-memory/PROJECT.md` "There is no horse GUI" (lead's file).
5. `settings-parity-catalogue.md` RENDER_DISTANCE still says chunk loading by distance is open; streamed worlds and the server load by view distance (batch 71), but the finite-world wording was left.
