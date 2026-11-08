# anaglyph3 (batch 29)

## Summary
- DOM GUI now converts under 3D Anaglyph: stylesheet rules, inline styles, `<img>`, canvas-screen images and the extra WebGL contexts, using exact PNG decoding and the `src/anaglyph.js` formula, cached per source and media generation, no CSS filters.
- New: `src/gui-anaglyph.js`, `src/png-codec.js`, `src/anaglyph-gui.test.js`, `tools/verify-anaglyph-gui.mjs`, `tools/probes/Anaglyph3Probe.java` (+ GL11 stub), `public/research/anaglyph-gui-reference.json`.
- Edited: `resource-refresh.js` (prepares GUI images, rewrite moved to gui-anaglyph), `post-shaders.js` (`syncAnaglyph`), `inventory-player.js`, `horse-preview.js`, `enchanting-book-renderer.js`, `menu-panorama.js`, `achievements-ui.js`, `sign-editor.js`, `item-animation.js`, `maps-clock-live.js` (read `rawImgSrc`).
- Tiny `scene.js` hunks: import `setGuiAnaglyph`, call it from `onAnaglyphChange`, and call `post.syncAnaglyph()` in `setRenderSettings` (title-screen toggle used to do nothing).
- Chunk-update skip (`bma` @515): needs occlusion queries and ADVANCED_OPENGL, neither exists in the port, so it is unobservable (documented in `post-shaders.md`).
- Native evidence: unchanged `bqi.a(int[])` run over 263 jar textures; port hashes match (test).

## Verification
- `npm test`: 4745 tests, 4745 pass on the final full run (an earlier run had one timing-test failure under machine load that passed alone). `npm run build` passes.
- Muted headless Chrome (vite 5291, `?silent`, `--mute-audio`, scripts in `artifacts/b29-anaglyph3/`): title and world, forced anaglyph on: 53 rules converted, 0 raw; off restores all. Screenshots of HUD and inventory on/off.
- The real Options > Video Settings click was not driven; the toggle was forced via `scene.post.anaglyph` (it reaches the same `setRenderSettings`/`onAnaglyphChange` path).

## Follow-ups
- Tints baked into the atlas before conversion (native: convert then tint).
- Resource-pack blob icons and `steveSkin` unconverted; brief transparent flash while converting; legacy anaglyph mode leaves GUI raw.
- Proposed gap lines for remaining-gaps.md: "3D Anaglyph GUI conversion is async (native is synchronous in refreshResources) and skips resource-pack blob icons and the profile skin." and "Anaglyph biome/grass tint is applied before texture conversion (native: after)."
