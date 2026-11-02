# 0.23.2 native settings values (2026-11-01)

Closed the five PLAN-03i port differences in `src/settings.js` + main.js/audio.js/scene.js: FOV 30–110 default 70; render distance 2–16 chunks default 12 (scene fog uses chunks × 16); sensitivity 0–1 default 0.5 on EntityRenderer's (s·0.6+0.2)³·8 × 0.15°/px curve (bytecode-checked in blt/sa.c(FF)); master volume default 1.0; GUI scale four values. Labels from en_US.lang in the original JAR. `settingsVersion: 2` marks converted saves; `migrateSettings` converts older saves once.

Tests: npm test 708/708, build OK. `settings-catalogue.test.js` now asserts native equality instead of pinned mismatches. Browser check on a separate port with audio disabled: old save migrated, sliders/labels/fog/FOV correct, no console warnings; synthetic pointer events did not drive mouse-look, so the look rate rests on unit tests.

Open: invert mouse, smooth camera, ±90° pitch clamp, per-category volumes, key rebinding, options.txt persistence.
