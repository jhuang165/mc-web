# packs2 (batch 15) track: resource pack follow-ups

Branch `b15-packs2`, base main 01887b4, app 0.44.0 (version not bumped). Owner claude-b15-packs2.

## Done
- In-place refresh: `src/resource-refresh.js` (TextureLoader registry, versioned urls via `src/media-version.js`, CSS/img rewrite, hook list), wired in `main.js` (first import, `menuContext.reloadResources`), `resource-packs-ui.js` Done, block atlas `reload()`, `scene.reloadStrips()`, `SoundBank.refreshPacks()`, lang restore (`applyLangLayer`), spawn egg/clock/compass/achievement caches.
- Texture animation: `src/texture-animation.js`, probe `tools/probes/TextureAnimationProbe.java` -> `tools/verify-texture-animation.mjs` -> `public/research/texture-animation-reference.json` -> `src/texture-animation.test.js`. No `interpolate` in 1.7.10. Strips in `scene.js` are mcmeta-driven; vanilla phases reproduced exactly.
- Pack mcmeta hide rule in `resolveOverrides` (bytecode-read), service worker answers 404 for hidden mcmeta.
- `sounds.json`: `src/pack-sounds.js`, `audio.js loadPackSounds/refreshPacks`.
- HD chest (scale by width/64) and colormap linear reinterpretation (`src/colormap-source.js`); `tint()` untouched.
- Delete control: Delete pressed twice over a pack row (`deleteStoredPack`), documented as not native.

## Gaps
- Item icons are `<img>`: no animated or HD item strips; compass/clock keep 32/64 frames.
- Pack mcmeta on ordinary atlas tiles is not animated; sky clouds, title panorama and sign editor images are not refreshed in place.
- Native loading overlay for refreshResources unverified. Compass/clock/chest/colormap HD paths not exercised in a browser.
