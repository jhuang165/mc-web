# Potion client effects (0.41.0)

Target is Minecraft Java 1.7.10. Full parity is not claimed. Code: `src/potion-fx.js`; evidence: `public/research/potion-fx-reference.json`, written by `tools/verify-potion-fx.mjs` from `tools/probes/PotionFxProbe.java` and replayed by `src/potion-fx.test.js`.

## Native-verified (unchanged client classes run by the probe)
The probe runs the unchanged EntityRenderer (blt), RenderGlobal (bma) and World (ahb) methods against Unsafe-allocated objects (no constructors, scripted world). LWJGL 2 types are stubbed for class loading; the GL calls at the end of `updateFogColor` throw after the colours are stored, and the stored fields are read back.
- `nightVision` (1300 rows): `getNightVisionBrightness` for durations 1..260 and five partial ticks (1 above 200 ticks, flicker below).
- `fogColor` (1824 rows): `updateFogColor` with the void factor (feet y / 32), Blindness (zero below the effect, easing over the last 20 ticks) and Night Vision across render distances 2, 8 and 16. The test replays the tail from the colour before those terms. A Blindness of 20 or more with Night Vision gives native NaN (0 times Infinity); the port draws it as black.
- `lightmap` (111 rows): all 256 texels of `updateLightmap` with and without Night Vision, three gamma settings, flicker and sun levels. The port matches within 1/255 (integer rounding of the colour).
- `detection` (20 cases): `World.getClosestVulnerablePlayer` range scaling for sneaking (0.8), invisible (0.7 times max(0.1, armour pieces / 4)). Native only; AI wiring below.
- `splashBreak` (36 cases, 12 potions times 3 seeds): `playAuxSFX` 2002 gives 8 `iconcrack` plus 100 `spell` / `instantSpell` particles, with seeded positions, velocities and tint, and the sound `game.potion.smash` at the block centre with pitch from the world random. Native iconcrack names use item 373; this repo's potion is internal id 385 (the test maps one to the other).
- Replays of bytecode formulas (flagged `kind: replay`, not run natively because they need GL or a full client): Blindness `setupFog` distances (far plane 5, widening over the last 20 ticks, start at a quarter), the `EntityPlayerSP` portal timer for Nausea (+1/150 while above 60 ticks, otherwise -0.05) and the warp scale `(5 / (a*a + 5) - a*0.04)^2`.

## Live
- Night Vision: the lightmap and the fog colour use the native brightness.
- Blindness: fog distance 5 (widening over the last 20 ticks), no fog density curve, the sky is hidden like underwater, fog colour darkened as in 1.7.10.
- Nausea: the portal-style warp, as a projection matrix R * S * R^T about axis (0,1,1) with the native scale, rotation of 7 degrees per tick.
- Invisibility: the player's body mesh is hidden (armour and held items still draw) and the shadow is skipped; mobs hide their body but keep skeleton bow and creeper shell as in 1.7.10; swirl particles are the ambient kind.
- Splash potions: break particles and sound on impact, and potions in flight are saved with the world (`thrownPotions`).

## Approximated or missing
- The warp uses the scene tick as `rendererUpdateCount`, and Night Vision uses partial 0 for the per-tick lightmap; renderer pixels are not byte-exact.
- The sky pass is hidden while blind rather than drawn through fog.
- `detectionRangeScale` is exported but not wired into mob AI (`src/ai.js` and `src/entities.js` belong to another track); 1.7.10 does have the scaling in `getClosestVulnerablePlayer`, but mobs here use their own target search.
- Potions in flight are not exported to region files; a witch-thrown potion loses its owner when loaded.
- The splash particles' motion after `multiplyVelocity` is not compared to native (colours and spawn arguments are).
