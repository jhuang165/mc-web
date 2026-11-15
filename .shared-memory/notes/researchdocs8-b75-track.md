# Batch 75 researchdocs8: docs sweep of docs no earlier sweep covered

## Summary
Docs only. `public/research/parity.md` got "Batch 75 (docs sweep, 2026-11-14)" additions on 11 table rows (Mobs/eggs/eye of ender, Chests/crops/mobs, Third person, Spiders, Chickens, Flowers/dyes, Fishing, Wolves, Paintings/frames, Thrown items, Movement) and on the two header paragraphs ("Anaglyph is still missing", "Still missing: magma cubes ..."). Old text is kept. Eleven more docs got a closing Batch 75 line: projectiles, chat-options, extra-particles, books, iron-golem, damage-fx, fluids, hardcore, game-rules, anvil-blocks, horse-inventory. No code, generators or catalogues changed (the catalogue rows checked were already current).

Swept and found current (no edit): cauldron-wash, colored-blocks, container-screens, ender-pearl, fire-fx, food-items, fortress, horse-gear, item-durability, item-names, leather-dye, nbt, region-file, region-inspection, redstone-ore, server-performance, shadows, structure-seeds, attributes3, and the biome, gamerule, gui, settings, structure, entity, command and recipe catalogues (keyword scan of their limitation text).

Stale claims closed: End dimension, magma cubes, spawn eggs, ender chest recipe and EnderItems, horse screen/leads/jump bar, egg dispenser, ocelot/wolf/mooshroom spawning, Anaglyph, cape and ears, cave spiders and jockeys, cocoa/lapis/ink sacs/stained clay/double plants, fishing stats and wake, wolf region import, maps in frames, ender pearls, silent snowball throw (`random.bow` is in the manifest), Tab list second player, redstone ore touch, flowing water sound.

## Evidence
All recalled from code reading (grep of `src/`, `src/multiplayer/`, `server/`, the sound manifest and the existing research docs). Nothing executed, no javap: no claim about native behaviour was found wrong, so no jar check was needed. Not rechecked: the Movement row details (entity boxes, vines), big-stem geometry, melon Fortune cap.

## Verification
`node --test src/catalogue-consistency.test.js src/content-catalogue.test.js`: 6 pass, 0 fail. `npm run build`: ok (7.6s). Full npm test not run (batch rule). No browser checks.

## Follow-ups
1. Skeleton-horse traps (lightning with a horse nearby, native since 1.6): no code found by grep in `src/` or the docs (recalled, not bytecode-read). Not in the batch 74 open list.
2. `parity.md` Movement/Hunger/Mining/Crafting rows are still batch-1 text; a proper audit of each remaining-differences cell would need per-row test reading.
3. `.shared-memory/PROJECT.md` still says "There is no horse GUI" (lead owns that file).
