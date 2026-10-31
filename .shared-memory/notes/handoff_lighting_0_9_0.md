Claude handoff — 2026-10-30, version 0.9.0 (commit f67c927).

Changed: replaced the renderer's lighting and sky with bytecode-derived 1.7.10 rules (EntityRenderer blt, RenderGlobal bma, RenderBlocks blm).
- src/lighting.js: LightVolume 0–15 sky/block propagation (water 3, leaves 1, torch 14, lit furnace 13; edits relight ±15 columns, returning a change box); updateLightmap with torch flicker and gamma; smooth-lighting AO (smoothFace/getAoBrightness); celestial angle, sun brightness, skylight subtraction; sky colour, fog colour, sunrise colours; JavaRandom; star field.
- src/light-material.js: world/entity shaders (lightmap texel × shade × AO, linear 0.75–1.0 radial fog, exp 0.1 underwater; two RenderHelper item lights).
- src/sky.js: separate sky pass (sky plane, void, sunrise fan, sun/moon phases, stars) and fancy clouds (alpha > 25 test, since clouds.png empty texels have alpha 1).
- src/drop-renderer.js: RenderItem drop piles.
- scene.js rewritten: AO cubes, tallgrass jitter, crossed crops, liquid corner heights with still/flowing textures and a depth-first translucent pass, fancy leaves, 0.4-alpha selection box.
- Chests, mobs, the first-person hand and particles now use lightmap lighting; Brightness option in Options.
- Colour management off and textures without colour space (raw GL colour).
- Dev-only window.__mc handle for browser checks (stripped from builds).
Notes: public/research/lighting.md.

Tests: npm test 73/73 (new src/lighting.test.js with JDK-matched Random values); npm run build OK. Browser on the dev server: day AO, sunset fan, night stars/moon, clouds, torch light, underwater fog, water surface, Brightness slider labels and lightmap change, drop piles; about 120 fps, no console errors.

Remaining: void fog (skipped because the world is 64 blocks tall), weather, Fast graphics, entity shadows, the fire overlay (burning uses a tint), queue-based incremental light updates. Cloud height is SEA+65. Pushed with npm run push:github; Sites publication not run.