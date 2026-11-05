# Fireworks (batch 6): firework star, rocket, explosion effects

Target: Minecraft Java 1.7.10. Evidence: `public/research/fireworks-reference.json`, written by `tools/verify-fireworks.mjs`
from the unchanged client jar through `tools/probes/FireworksProbe.java` (125 records: 78 recipe, 12 tooltip, 12 rocket,
15 starter, 6 lifecycle, 1 starterThrows, 1 facts). `src/fireworks.test.js` replays them.

## Classes

ItemFireworkCharge `acr`, ItemFirework `acs`, RecipeFireworks `aey`, EntityFireworkRocket `zf`, EntityFireworkStarterFX `bke`,
EntityFireworkSparkFX `bkd`, EntityFireworkOverlayFX `bkc`, dispenser behaviour `ky`.

## What is implemented

- Items: star (original 402, internal 2070) and rocket (401, 2071) with NBT `Explosion` (Type, Colors, FadeColors, Flicker, Trail)
  and `Fireworks` (Flight, Explosions); tooltips and the star tint (`src/fireworks.js`).
- Crafting: RecipeFireworks as a dynamic recipe (star, rocket, fade), hooked into `craftingResult` (probed on 78 grids).
- Rocket entity (`src/firework-rocket.js`, `src/fireworks-live.js`): spawn, lifetime, acceleration, spark trail, explosion.
  Flight and lifetime replayed exactly on 12 probe records.
- Explosion effect (`src/firework-particles.js`): five shapes, colour, fade, trail, twinkle, sounds. Replayed against 15 starter
  and 6 lifecycle records (particle counts, motion, colour, age, scale, alpha, sounds).
- Launch from a block (`useFirework`), dispenser behaviour, save/load of rockets, NBT import/export of both tags.

## Gaps

- Skull shape: the skull item has no internal id until the wither track merges; call `registerSkullItem(id)` with it.
- A star explosion with no Colors makes the original starter throw (probe `starterThrows`); the port skips it instead.
- The rocket moves with the shared particle mover (`moveParticleEntity`), not the full entity mover. Probed rows match in the
  open field; collisions with blocks are approximate.
- `ItemFirework.onItemUse` and the dispenser behaviour (aux 1002, spawn position) come from bytecode, not the probe.
- A rocket without a star carrying an Explosion tag has no Flight NBT in the original (probe evidence); kept.
- Sounds `fireworks.*` need the media importer (the regex now includes `fireworks/`); the importer was NOT run here, so the
  sounds are silent until it is.
- `/summon FireworksRocketEntity` is not wired (`summonFirework` exists in `fireworks-live.js`, command host not hooked).
- Star icon overlay tint (`starTintComponents`) is exported but the layered inventory icon is not wired; the star shows its base texture.
- No browser check was done (no dev server by rule), so rendering and audio are unverified.
