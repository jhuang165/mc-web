# anaglyph4 (batch 30)

## Summary
- Toggle converts ahead: `requestGuiAnaglyph` prefetches; `refreshResources` prepares the GUI PNGs and texture pixels, then `commitGuiAnaglyph()` flips the GUI in one step (old state kept until ready). Pending first-seen inline styles show a transparent pixel, never raw. A toggle during a running refresh gets its own pass.
- Persistence: converted PNGs in the Cache API (`mcag-1`, SHA-1 of source bytes), last session's paths in localStorage `mcag.manifest`; with the option stored on the page is held hidden (max 1.5 s) until the manifest is converted, so the first visible frame is converted.
- Tint order: item atlas tiles are converted per tile, then tinted with the converted multiplier (`block-textures.js` `drawAtlas`, `agColor`); the canvas is flagged `__agDone` so the upload hook and `atlas-upload.js` skip it. Item icons carry `#mcicon=id:damage[:ag]`, rebuilt by `refreshIcons` after the atlas reload.
- Resource Packs blob icons converted from PNG bytes (`resource-packs-ui.js`); profile screen skin preview converted (`multiplayer/screen.js`, `convertGuiCanvas`).
- Legacy mode: port-only comparison switch, not native. The DOM GUI now converts whenever the option is on (native converts every texture at upload), including legacy.
- Upload hook: Images with a known /media url upload exact converted straight-alpha pixels (`png-codec.js` registry, `convertExact`); flagged canvases pass through.
- Touched: `gui-anaglyph.js`, `png-codec.js`, `anaglyph.js`, `resource-refresh.js`, `block-textures.js`, `atlas-upload.js`, `resource-packs-ui.js`, `multiplayer/screen.js`, `post-shaders.md`, new `anaglyph-gui2.test.js`. One-line `scene.js` change (import and `requestGuiAnaglyph(on)` call). `main.js` untouched.

## Verification
- Native evidence: no new jar run. The batch 29 `bqi.a(int[])` probe hashes still cover the conversion; the tint order and `anaglyphEnable` read sites are the batch 28 bytecode-read result. Tint pixel check ran in the page (`artifacts/b30-anaglyph4/world.mjs`, COLOURED=1): coloured grass_top matches convert x convert-multiplier within 1, old order 14 away.
- Flash: `artifacts/b30-anaglyph4/flash.mjs` (before.json, after.json): load raw-GUI frames 23 (500 ms) -> 0; toggle mixed frames 0 -> 0 on the title screen; inventory-open toggle 0 mixed/transparent frames.
- Muted headless Chrome, vite 5316, `?silent`, `--mute-audio`; no application errors (one 404 for an optional resource).

## Follow-ups
- Resource-pack blob icon path was not exercised live (no pack with an icon installed); only the unknown_pack default was seen converted. Profile screen not opened live (needs a multiplayer account); `convertGuiCanvas` is unit tested with a stub canvas.
- Atlas canvases (terrain and item) are still converted through a 2D canvas (premultiplied rounding on translucent pixels); item atlas mips are built from converted pixels (may differ by 1 from per-level conversion).
- Lazily created TextureLoader textures while the option is on use the canvas path unless their exact pixels were prepared by a refresh.
- Tinted multiplier is rounded to a byte for the canvas multiply (native multiplies in float): up to 1 off.
- Proposed gap lines: "Anaglyph item-atlas tint uses a byte-rounded converted multiplier (max 1 off); atlas canvases convert through premultiplied canvas pixels; blob pack icon and profile skin paths are unprobed live." and remove the batch 29 anaglyph GUI line (async, blob icons, tints, legacy).
