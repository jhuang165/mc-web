# packs3 (batch 16) track: resource packs round 3 and capture polish

Branch `b16-packs3`, base main 60d9af0, app 0.45.0 (version not bumped).

## Done
- `src/item-animation.js`: pack `.png.mcmeta` item animation (texture-animation.js frame logic, probed); `itemTexture()` returns the current frame data url (and versioned urls after a refresh); ticked from `MapsClock.tick`; first-person key has a frame tag. Clock/compass untouched.
- Refresh hooks: `Clouds.reload`, `Panorama.reload` (hooked in menu-ui.js), versioned ascii.png/glyph_sizes.bin/glyph pages/sign image, clone registration in resource-refresh.js (plus `registeredTextureUrls/Image` diagnostics).
- F2 composites the DOM GUI over the canvas frame (`src/screenshot-compose.js`, main.js capture wrapper).
- options.txt Import/Export buttons (Controls screen, non-native, main.js `exportOptionsTxt/importOptionsTxt`, menus.js two buttons).

## Tests
`npm test` 3693 pass, `npm run build` ok. New: screenshot-compose.test.js. Browser checks (vite 5217, muted headless Chrome, CDP): see resource-packs.md Verification and controls.md.

## Shared files touched
main.js (hook line, capture wrapper, options.txt helpers, 2 menuContext entries), menus.js (2 buttons), menu-ui.js (panorama hook), first-person.js, maps-clock-live.js, sky.js, menu-panorama.js, font-renderer.js, sign-editor.js.

## Remaining
- Dropped items, item frames and mob-held items do not tick item animations; pack mcmeta on atlas tiles; in-world HUD F2 and held-item animation not browser-run; panorama canvas transparent in F2; item-animation has no unit test (browser-only Image/canvas).
