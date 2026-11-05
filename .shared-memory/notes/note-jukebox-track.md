# Note blocks, jukebox and discs track handoff

Details in `public/research/note-jukebox.md`.

## Changed

- New: `src/note-jukebox-content.js` (ids and installers), `src/note-blocks.js`, `src/jukebox.js` (rules and the record HUD), `src/note-jukebox.test.js`, `tools/probes/NoteJukeboxProbe.java`, `tools/verify-note-jukebox.mjs`, `public/research/note-jukebox-reference.json`, `public/audio/1.7.10/note/*.ogg`.
- Ids: internal blocks 177 note block and 178 jukebox (items 1177, 1178), discs 530-541 (original 2256-2267). Internal ids 140-176 are `reserved` placeholders until the other tracks define them.
- Small hooks: `world.js` (install call), `block-registry.js` (two MAP entries, count check ignores placeholders), `survival.js` (three install calls), `original-items.js` and `tools/inventory-replay.mjs` (spread last), `redstone.js` (comparator for 84), `redstone-runtime.js` (music object), `player-edit-simulation.js` (two lines), `block-placement-simulation.js`, `block-textures.js`, `gui.js` (disc tooltip), `fx.js` (note particle), `chunk-runtime.js` (`musicTiles`), `combat.js` (creeper disc), `region-import.js`, `region-export.js`, `main.js` (hooks, HUD, save).
- Tests touched: `media.test.js` (274 sounds), `recipe-catalogue.test.js` (214 checked, 2002 samples), `combat.test.js` (discs now drop), `item-names.test.js`, and the registry-wide tests that skip `reserved` blocks.

## Merge hints

- When another track defines blocks 140-176, `installNoteJukeboxBlocks` stops padding; keep it last in `world.js`. If a track appends past 176, change `RESERVED_UP_TO` and the 177/178 ids.
- Regenerate `population-creative.js` and `item-parity-catalogue.md` after merging.

## Remaining

Record music is silent (not imported). See Gaps in `note-jukebox.md`.
