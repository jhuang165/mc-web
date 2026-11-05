# Trapped chest and ender chest (1.7.10)

Evidence: `tools/probes/ChestsProbe.java` run by `tools/verify-chests.mjs` against the original client, written to `public/research/chests-reference.json` (356 records: pair 300, power 36, ender 11, enderNbt 3, lid 4, display 2). Tests: `src/chests.test.js`.

## Mapping

- Trapped chest (original 146) is internal block 162, item 1940. It is BlockChest type 1: the existing chest code (`src/chest.js`, `chest-renderer.js`, the `survival.chests` store) is reused, and pairing is now same-kind only (a chest and a trapped chest never join).
- Ender chest (original 130) is internal block 163, item 1941. Facing is cell metadata 2-5. Hardness 22.5, resistance 3000, light 7, drops 8 obsidian (Silk Touch drops itself), pickaxe harvests.
- Pure rules live in `src/chest-blocks.js`.

## Behaviour verified against the probe

- Trapped chest: weak power is the viewer count clamped to 0..15 on every side; strong power only to the block below. Opening or closing notifies the chest and the block below (`chestViewersChanged` in `redstone-runtime.js`).
- Pairing, facing and the cover refusal for 300 random placements.
- Ender chest: opens only when no normal cube is above (probe: only stone of the 11 covers refused), 27-slot per-player inventory `Survival.enderItems`, saved as `enderItems` in the player record and exported as `EnderItems` in level.dat.
- Lid steps 0.1 per tick, sounds `random.chestopen` and `random.chestclosed` at volume 0.5 (ender at the block centre).
- Portal display particles: draw order x, y, z floats, two nextInt(2), then velocity floats (`enderDisplayParticles`).
- Region export/import: trapped chest uses the `Chest` tile; ender chest cells import (`EnderChest` tile accepted, no data).
- Creative: both in Decoration Blocks and Search at the native positions.

## Gaps

- Ender chest recipe (8 obsidian + eye of ender) is not added: the eye of ender is not in the port.
- `EnderItems` is exported but not imported (no level.dat player reader).
- Portal particles: `enderDisplayParticles` is verified but not yet called from the render loop; the particle system has no portal sprite hookup.
- No `EnderChest` tile entity is written on export (Java creates it on load).
- Inventory icons use the chest and obsidian atlas tiles, not the entity textures.
- Ender chest per-player data is single-player only; `chestopen` sound on the ender lid is played from `tickChests` only for loaded chests.
