# Extra particles: reddust, enchantmenttable, slime (Java 1.7.10)

`src/extra-particles.js` ports `EntityReddustFX` (`bku`) and `EntityEnchantmentTableParticleFX` (`bjz`); `src/redstone-particles.js` ports the `randomDisplayTick` of their emitters, called from `display-ticks.js`. Both kinds go through `Fx.spawn`, so the Particles setting and 16-block filter apply first.

- **reddust**: the 7-argument `EntityFX` constructor with zero velocity, motion x 0.1F, then `Math.random` for brightness, the three colours and the lifetime (8 / (r * 0.8 + 0.2)); a zero red argument becomes 1. Update: texture 7 down to 0 over the life, no gravity, 0.96 drag, 1.1 x horizontal when `posY` did not change, 0.7 on the ground. The render scale grows over the first 1/32 of the life.
- **enchantmenttable**: `Entity.rand` gives brightness and size, `Math.random` a 30-39 tick life and a glyph cell 225-250. The particle moves from its origin along the velocity with `(1 - age/max)`, sagging by `1.2 * (age/max)^4`, and its block light is lifted like the portal's.
- **slime**: `RenderGlobal` builds `EntityBreakingFX(world, x, y, z, Items.slime_ball)`, the 5-argument constructor, which has no 0.1 motion factor. Slime landings used `iconcrack_341` (which does scale by 0.1); they now spawn `slime`, so landing motion matches the original (about 10x larger).
- **Emitters** (this build's ids): the powered wire (level-based colour), the lit redstone torch (also on walls), lit redstone ore (the sparkle, which draws from `World.rand`, with the original `y < 0` bound), the powered repeater (torch and delay slot) and the enchanting table (bookshelf glyphs, one 1/16 roll per ring cell).
- The `note` kind and its block emitter already existed (`note-blocks.js`).

## Evidence

`node tools/verify-extra-particles.mjs` runs `tools/probes/ExtraParticleProbe.java` (on the `FxProbe` world double and Tessellator harness) against the unchanged client and writes `extra-particle-reference.json`:

- 14 particle lifetimes (constructor state, every onUpdate, through `RenderGlobal.doSpawnParticle`);
- 4 draw records (renderParticle vertices and brightness at three partial ticks and two camera bases);
- 17 display-tick cases with seeded `Random` (spawn calls plus the tick and World.rand states after);
- the repeater over all 16 metadata, lit and unlit.

`src/extra-particles.test.js` replays all of it.

## Skipped and open

- `cloud` and `footstep` have a handler in `RenderGlobal.doSpawnParticle`, but no class of the unchanged 1.7.10 client spawns them (only `bma` contains the strings), so there is no emitter.
- Touching redstone ore does not light it in this build, so the sparkle only shows for ore that is already lit.
- Repeater particles read the redstone runtime's lit set. Not browser-checked.
