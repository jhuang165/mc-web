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

- Batch 69 (docs sweep): the skull item is registered by default (`SKULL_ITEM_IDS = new Set([2050])` in `fireworks.js`, skull.js `ITEM_SKULL`), so the creeper-shape ingredient works without a `registerSkullItem` call.
- A star explosion with no Colors makes the original starter throw (probe `starterThrows`); the port skips it instead.
- The rocket moves with the shared particle mover (`moveParticleEntity`), which is `Entity.moveEntity` for a body with no step
  height. Batch 68 executed it against blocks (`firework-collide-reference.json`, `FireworkCollideProbe`, 31 records: stone and
  slab ceilings, a fence, a cobweb, walls, the void): all replay exactly. One real gap was the void (posY < -64 kills the rocket
  in `Entity.onEntityUpdate`, no status 17), now fixed. Batch 69 added fluids and entity boxes
  (`firework-fluid-reference.json`, `FireworkFluidProbe`, 34 records: still and flowing water, lava, a boat and a minecart): the rocket takes
  the 0.014 flow push, the first-entry splash draws 32 random floats, and boat and cart boxes block it; all replay at 1e-12.
- `ItemFirework.onItemUse` and the dispenser behaviour (aux 1002, spawn position) come from bytecode, not the probe.
- A rocket without a star carrying an Explosion tag has no Flight NBT in the original (probe evidence); kept.
- Sounds `fireworks.*` need the media importer (the regex now includes `fireworks/`); the importer was NOT run here, so the
  sounds are silent until it is.
- `/summon FireworksRocketEntity` is not wired (`summonFirework` exists in `fireworks-live.js`, command host not hooked).
- Star icon overlay tint (`starTintComponents`) is exported but the layered inventory icon is not wired; the star shows its base texture.
- Batch 82 (entities82, 2026-11-18): the two lines above are stale. `/summon FireworksRocketEntity` is in `commands.js` SUMMONABLE, and the star draws two passes (`item-passes.js` `itemPassColor`/`itemPasses`): `fireworks_charge.png` untinted and `fireworks_charge_overlay.png` tinted by `starTint(stack, 1)`, in the inventory, as a drop, held and in a frame. Bytecode-read: `acr.a(int,int)` returns the overlay icon for pass > 0, `acr.a(add,int)` returns 16777215 for pass 0 and for pass 1 the integer per-channel Colors average or 9079434 without Colors. Still open: native throws on a star with no Explosion tag (the port draws 9079434) and divides by zero on an empty Colors array; the sounds were not re-checked; no icon is compared with a native screenshot.
- No browser check was done (no dev server by rule), so rendering and audio are unverified.
- Batch 82 fireext82 (2026-11-18): correction. A rocket keeps Entity's fire counter (`firework-rocket.js` `tickRocket`, bytecode-read: `zf.h` calls `sa.h` and `moveEntity`; `zf` overrides no fire method and no `attackEntityFrom`, so the old "fire damage is refused" note was wrong: Entity.attackEntityFrom sets velocityChanged). Water puts it out, a client copy zeroes it, lava sets 300, a fire or lava cell in the moved box adds 1 (setFire(8) = 160 from -1), out of fire it rests at -1. `Fire` saves, loads, imports and exports; the flames draw over a burning rocket (not checked in a browser). The wet fizz needs isWet's rain half, which is not modelled.
