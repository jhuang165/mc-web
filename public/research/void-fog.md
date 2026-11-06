# Void fog (1.7.10)

Evidence: `tools/probes/VoidFogProbe.java` via `tools/verify-void-fog.mjs` writes `void-fog-reference.json` (316 records: provider 12, colour 56, distance 144, particle 104). `src/void-fog.test.js` replays it. EntityRenderer needs GL, so the formulas are transcribed from `javap` of `blt` and replayed in the probe rather than run natively. The provider methods (`aqo`) are run natively.

Bytecode-verified:
- `WorldProvider.getWorldHasVoidParticles` = `terrainType != FLAT && !hasNoSky`; `getVoidFogYFactor` = 1.0 for flat, else 0.03125.
- Colour (`updateFogColor`): `d = posY * factor`; if `d < 1`, clamp at 0, square, multiply rgb. `posY` of the 1.7.10 client player is the eye height, so `main.js` passes `position.y + PHYSICS.eye`.
- Distance (`setupFog`): `d = skyLight/16 + (y+4)/32`; if `d < 1`, clamp at 0 and square, `f = 100*d` with minimum 5, `far = min(far, f)`. Skipped in creative.
- Particles: `rand.nextInt(8) > y` is drawn before the provider check, then `depthsuspend` with zero velocity (`display-ticks.js`, already in `fx-reference.json`).

Approximate / gaps:
- The distance term is applied only in 256-high worlds (`scene.js`). The legacy 64-high world would fog every cave, so it is skipped there.
- Fog near is set to 0.75 of far, an approximation of the linear-fog start.
- Sky darkening below the horizon is not changed.
