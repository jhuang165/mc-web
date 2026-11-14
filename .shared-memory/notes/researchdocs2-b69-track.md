# Batch 69 researchdocs2: docs sweep, anvil-blocks.md to minecart-variants.md

## Summary
Docs only, all in `public/research/`. Each change carries a "Batch 69 (docs sweep)" marker; old text is kept where it still gives history. No code, generators, catalogues or `remaining-gaps.md` touched.

Docs touched and claims changed (code evidence by reading):
- `anvil-persistence.md`: server anvil rename (`multiplayer/server-stations.js` `rename`), glint (`gui.js`), region import/export of minecarts (`region-import.js`, `region-export.js`).
- `beacon.md`: Beaconator achievement (`achievements.js` `beacon()`, `main.js`), Wither and nether star (`wither-boss*.js`, `wither-boss.test.js`), dedicated beacons (`dedicated-beacon.test.js`).
- `blaze-ghast.md`: fireballs saved and `/summon Fireball` (`saved-order.js`, `summon-coverage.test.js`), blaze rod achievement (`achievements-live.js`).
- `biome-colors.md`: lily pad hash rotation (`lily-pad.js`, `chunk-mesher.js`).
- `buckets.md`: lakes, dungeons, springs run in generation (`world.js`, `population-stage.js`, `lake-generator.js`, `springs.js`); Nether exists.
- `chests.md`: ender chest recipe (`recipe-catalogue.test.js`), EnderItems import (`level-dat.js`, `region-import.js`).
- `chickens.md`: step sounds (`mob-steps.js`), burning/Looting drops (`entities.js` mobDrops call), natural spawning, `sheep.md` pointer.
- `chunks.md`: pointer that region format, streaming and per-chunk generation exist.
- `commands.md`: stale early /summon list, no-Hardcore sentence, "multiplayer unsupported".
- `controls.md`: anaglyph conversion uses the native formulas (`anaglyph.js`, `gui-anaglyph.js`).
- `creepers.md`: ocelot avoid task (`ocelot-ai.js`), redstone TNT (`redstone.js` primeTnt), disc drop (`combat.js`), Blast Protection (`armor-enchantments.js`, `explosion-simulation.js`).
- `crops.md`: trampling and server random ticks (`farming.js`), golden carrot (`brewing.js`), carrot on a stick.
- `difficulty.md`: cave spider poison (`entities.js`), Hardcore (`hardcore.js`).
- `dispense.md`, `dispenser-piston.md`, `doors-panes.md`: dispenser behaviours (`dispense.js` header), piston movement and block 36 (`piston-live.js`), live redstone doors, stained glass panes in `world.js`.
- `dyes.md`: cactus green smelting, squid ink, cocoa bone meal, lapis ore, 4-string wool, stained clay/glass, double plants, bone meal particles.
- `effects.md`: potion items, brewing and effects exist.
- `end.md`, `entity-portal.md`: dragon and End exist; carts and boats travel (batch 37).
- `enchantment-effects-tools.md`: quartz ore rows.
- `fireworks.md`: skull item registered by default; `fishing.md`: stats system and server fishing; `hopper.md`: hopper minecarts (`cart-hopper.js`).
- `horses.md`, `inventory.md`, `inventory-player.md`, `interpolation.md`, `items.md`, `ladders.md`, `lava.md`, `lighting.md`, `loading-screens.md`, `level-dat.md`, `detection.md`, `generation.md`, `maps-clock.md`, `minecart-variants.md`, `magma-pigman.md`: see the Batch 69 lines in each (horse inventory/leads/jump bar/steps, containers, leather dye, player shadow, move/look helpers, hoppers and ice, vines and zombie steps, lava sounds and buckets, weather/shadows/fire overlay, portal trip screens, Ambient carried, multiplayer, streaming, map render/first-person/frame/Nether map, command cart, portal pigmen).

## Evidence
Code reading only (grep and module headers in `src/`, existing tests named in the doc lines). No probes, no Java, no browser. Tests named were not rerun beyond the catalogue tests.

## Verification
`node --test src/catalogue-consistency.test.js src/content-catalogue.test.js` and `npm run build` (results in the lead report). Full npm test not run (batch rule).

## Follow-ups
Real code gaps found (checked against live code):
- Ender chest portal particles: `enderDisplayParticles` (`chest-blocks.js`) is imported in `main.js` but never called (still true, doc left as is).
- Chickens breed/tempt only with wheat seeds (`BREED_ITEM.chicken = 309`, `entities.js`); pumpkin and melon seeds do not work.
- `armor-enchantments.js` comment: Resistance potion step in the protection formula is "not ported" (`enchantment-effects-armor.md` limit left).
- Cape and deadmau5 ears: no `cape` code in `src/` (inventory-player.md left).

Claims left open (not verified, doc text kept):
- `dragon.md` "second kill egg is not modelled": `exit-portal.js` places the egg unconditionally. 1.7.10 recalled to do the same, so the doc claim is likely wrong; not verified by bytecode.
- `block-sounds.md` footstep cell and fall sounds; `boats.md` mob passengers; `brewing.md` selection box; `enchanting-book.md` table CustomName; `enderman.md` pumpkin helmet reachability; `fishing.md` single-player stats; `creative.md` bedrock/y=0; `leash.md` player UUID; `crops.md` Fortune; `difficulty.md` creeper follow-range roll and villager conversion; `enchantment-effects-tools.md` Bane slowness application (`entities.js` reports it; applied to the mob not confirmed); `lava.md` remaining bullets; `loading-screens.md` and `blaze-ghast.md` audio import line.
- Large generated docs (`block-metadata-catalogue.md`, `commands-b13.md` approximations, `biome-decoration-audit.md`, `chunk-nbt.md`, `colored-blocks.md`, `command-blocks.md`, `damage-fx.md`, `languages.md`, `investigation.md`, `item-durability.md`, `item-names.md`, `leather-dye.md`, `cauldron-wash.md`, `chat-options.md`, `books.md`, `anvil-container.md`, `bed.md`, `block-sounds.md` rows, `fluids.md`, `food-items.md`, `fortress.md`, `game-rules.md`, `hanging-entities.md`, `hardcore.md`, `horse-gear.md`, `horse-inventory.md`, `enchanting-table.md`, `ender-pearl-live.md`, `extra-particles.md`, `enchantment-effects-armor.md` beyond the above) were scanned by grep for gap phrases and contain no clearly stale claim I could close.

Generator rows calling a doc stale: only Arrow and Skeleton (`bows.md`, outside my range, already reworded in batch 68).
