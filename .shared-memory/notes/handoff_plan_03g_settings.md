# PLAN-03g settings/controls catalogue handoff

- Added `tools/verify-settings-catalogue.mjs` (+ `tools/probes/SettingsProbe.java`, verifier-only LWJGL/authlib stubs in `tools/probes/stubs/`) -> `public/research/settings-reference.json`; `tools/build-settings-catalogue.mjs` -> `public/research/settings-parity-catalogue.md`; `src/settings-catalogue.test.js`.
- Run: `MC_RESEARCH=<tools/research> node tools/verify-settings-catalogue.mjs` (needs a netty-all jar in the usual library dirs or MC_PROBE_LIBS), then `node tools/build-settings-catalogue.mjs`.
- Native-executed: Options enum, GameSettings constructor (Minecraft allocated without init, only isJava64bit set), KeyBindings, SoundCategory, value arrays, screen option arrays. Bytecode-read: save/load order, initGui widget order.
- Port mismatches (reported, code unchanged): FOV 75 / 50-100 vs 70 / 30-110; render distance blocks 70-200 vs chunks 2-16 (default 12); sensitivity 1.0 (0.2-2) vs 0.5 (0-1); master volume 0.65 vs 1.0; GUI scale extra "Larger".
- Open: English lang file for controls-screen order and display strings, key rebinding, chat/video options, per-category sound volumes, options.txt persistence.
