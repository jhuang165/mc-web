# Potions (Minecraft Java 1.7.10)

Evidence: `tools/probes/PotionProbe.java` runs the unchanged 1.7.10 jar (SHA1 e80d9b3bf5085002218d4be59e668bac718abbc6); `tools/verify-potions.mjs`
checks record counts and class hashes and writes `public/research/potions-reference.json`; `src/potions.test.js` and `src/brewing.test.js` replay it.
Obfuscated names: aen PotionHelper, rv Potion, rw PotionEffect, adp ItemPotion, aov TileEntityBrewingStand, bfg GuiBrewingStand, zo EntityPotion.

## Native-verified (replayed from the reference)
- All 23 Potion types: liquid colour, instant/bad flags, effectiveness, attribute modifiers.
- PotionHelper over every one of the 32768 damage values: effects (id, amplifier, duration), colour, prefix, English name (incl. Splash), tooltip lines.
- applyIngredient for every ingredient effect string over all 32768 values (digest plus samples); the requirement/amplifier tables.
- TileEntityBrewingStand canBrew/brewPotions over 780 seeded bottle layouts (list-equality semantics, bottle bit mask, 400-tick brew).

## Live in the game
- Potion item 385 (original 373) with any damage value; glass bottle 384 (374). Layered icon (tinted potion_overlay under the bottle or splash bottle), name and tooltip from potions.js, glint on effect potions.
- Glass bottle: recipe (3 glass), fill from a water source (trace like an empty bucket) or from a cauldron level (level -1).
- Drinking: 32 ticks, effects added through `survival.effects`, glass bottle returned in Survival (`src/potion-use.js`). Splash potions: thrown through `mobs.potions` (witch flight, gravity 0.05, velocity 0.5, inaccuracy 1, pitch offset -20), 4 x 2 x 4 box, distance scaling, instant effects.
- Player effects (src/status-effects.js and hooks): speed/slowness, haste/mining fatigue, strength, weakness, instant health/damage, jump boost, regeneration, resistance, fire resistance, water breathing, health boost, absorption, hunger, poison, wither, saturation, night vision (id kept), blindness/nausea/invisibility (id kept). The inventory screen lists active effects (GuiInventory layout).

## Approximated or missing
- Night vision, blindness, nausea and invisibility are stored and shown in the effect list but have no render effect; the potion bubble particle colour uses the real liquid colours.
- The thrown potion sprite is not tinted; the held potion is not drawn in 3D; the splash break particles are not replayed.
- The thrown-aim gaussian is unseeded. Potions in flight are not saved.
- Nether-only ingredients have no natural source: nether wart 386, blaze rod 387, ghast tear 389, magma cream 390 are Creative-only (blaze powder 388 from rods; glistering melon 392 and golden carrot 393 from gold nuggets 394).
- No HUD effect icons (1.7.10 draws effects only in the inventory screen).
- Full parity is not claimed.
