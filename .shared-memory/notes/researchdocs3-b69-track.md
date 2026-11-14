# Batch 69 researchdocs3: research-doc sweep, minecarts.md to zombie-villager.md

## Summary
Docs only (no code, no generators, no catalogues). Each changed claim carries a "Batch 69 (docs sweep)" marker. All evidence is code reading (grep and module reads in `src/`, batch notes); no probes, no browser.

Docs touched and claims changed (evidence):
- `minecarts.md`: furnace/TNT/hopper/command/spawner carts (`cart-variants.js`, `cart-hopper.js`, `command-cart.js`, `cart-spawner-display.js`, `carts.test.js`); powered/detector/activator rails (`powered-rails.js`, `powered-rails.test.js`); chest cart read by comparators (`redstone-runtime.js` `inventory` query); cart shadow 0.5 (`shadows.js`).
- `mineshaft-blocks.md`: fence gate (`shaped-blocks.js`, `gate-item.test.js`), enchanted book glint (`armor-enchantments.js`), anvil (`anvil-container.js`), `StoredEnchantments` import (`region-import.js`), powered rails.
- `mineshafts-live.md`: powered rails, hopper carts, comparators, SpawnPotentials (`mob-spawner.js`, `spawner-data.js`), streaming exists.
- `mob-equipment.md`: mob weapon knockback on the player (`mobKnockbackKick` called in `entities.js`).
- `nether-blocks.md`: Nether and End exist (`dimension-live.js`).
- `ocelots.md`: `public/audio/1.7.10/mob/cat/*.ogg` installed.
- `mooshroom-golem.md`: `snowballpoof` drawn (`object-tracker.js`).
- `particles.md`: portal, note, reddust, enchantmenttable, instantSpell, fireworks exist (`portal-particles.js`, `fx.js`, `extra-particles.js`, `redstone-particles.js`, `potion-fx.js`, `firework-particles.js`); boats and carts exist.
- `plants.md`: deserts and cactus (`biome-decorator.js`, `decoration-features.test.js`).
- `piston-live.md`: piston sounds in manifest and `public/audio/1.7.10/tile/piston/`; Java `Piston` import (`region-import.js`); `'pistons'` in `chunk-runtime.js` ARRAYS.
- `player-step.md` (entity box hooks noted, line kept open), `population-live.md` (wolves/horses/mooshrooms in `population-runtime.js` ANIMALS, golden apple Absorption in `food-items.js`, structures and streaming exist), `powered-rails.md` (carts exist).
- `redstone-blocks-2.md`, `redstone-blocks.md` (plates, tripwire live), `redstone-live.md` (dispenser/dropper `dispense.js`; carts trigger plates; TileTicks export `region-export.js`), `region-import.md`, `shaped-blocks.md` (Silk Touch exists), `sheep.md` (dye click `dye()` in `entities.js`, carpets, beds, paintings, spawning via `spawner-animals.js`).
- `sneaking.md` (Knockback enchantment defined), `spawn-eggs.md` (dispenser behaviours, small fireball `blaze-ghast.js`), `spawner-cart.md` (Painting/ItemFrame/LeashKnot summon, `summon-coverage.test.js`), `stats.md` (playerKills on the server).
- `strongholds.md`, `villages.md` (live generation for generation 14/15), `structure-nbt.md` (fortress ids ported, `structure-nbt.js:223`).
- `villager.md` (trading, zombie infection, mob import), `wither.md` (`wither-boss.js`, wither skeleton import in `java-mobs.js`), `wolves.md` (spawn egg, region import), `witch.md` (brewing `brewing.js`, glass bottle), `webs.md`, `mining-and-layout.md` (snowball throwing), `zombie-villager.md` (bed exists, line kept open).

## Evidence
Code reading only (label: bytecode not involved). Generators: no generator row calls any of these docs stale, none edited.

## Verification
`node --test src/catalogue-consistency.test.js src/content-catalogue.test.js` and `npm run build`: see the final report. Full npm test not run (batch rule).

## Follow-ups
Real code gaps found on live paths: none confirmed. Still true and left: `minecart-variants`-area client interpolation (`setPositionAndRotation2`) not found in `src/`; block hoppers do not pull from cart inventories (`inventory-transfer.js` says so); `snowshovel`, cloud, footstep, witchMagic, mobappearance particles absent; witch sounds have no assets (`public/audio/1.7.10/mob` has no witch dir); mob-vs-mob Smite/Bane (`creatureAttribute` is not used by `hitMob`); `mob.attack` has no manifest event for the slime.
Claims left open (unverified): `stone-utility-blocks.md` eye insertion/portal and glass bottle/armour washing; `player-step.md` entity box collision in single player; `redstone-blocks-2.md` daylight sensor recipe registration; `shaped-blocks.md` double wood slab Silk Touch; `redstone-live.md` trapped chest signal and redstone tile ticks in exports; `region-import.md` biome/light import; `sheep.md` despawn and `jeb_`; `zombie-villager.md` real-bed cure boost and weakness; `xp-orbs.md` one-player line; `mob-steps.md` fence rule; `slime.md` shadow and 40-mob cap; `mob-riding.md`, `mob-gear-nbt.md`, `music.md`, `natural-spawning.md`, `streaming.md`, `parity-roadmap.md`, `structure-seeds.md`, `structure-area.md`, `structure-data.md`, `superflat.md`, `trees.md`, `wood-types.md`, `spiders.md`, `sprinting.md`, `squid-bat.md` (spawner/spawn-egg support for squid and bats), `stems-cake.md`, `stairs.md`, `render-settings.md`, `resource-packs.md`, `post-shaders.md`, `projectile-nbt.md`, `potions.md`, `potion-fx.md`, `note-jukebox.md`, `ocelots.md` other lines, `pig-saddle.md`, `plants.md` other lines, `polish.md` (heads on mobs may now exist: `mob-equipment-renderer.js`, `wearable-heads.js`), `portal-particles.md`, `third-person.md`, `models.md`, `modal-dialogs.md`, `signs.md`, `void-fog.md`, `villager-offers.md`, `villager-trading*.md`, `wither-boss.md` were only skimmed for gap sections.
