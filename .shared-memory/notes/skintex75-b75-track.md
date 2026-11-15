# Batch 75 skintex75: straight-alpha texture upload for skins, capes and the item sheet

## Summary
- New `src/straight-texture.js`: `straightTexture(rgba, w, h)` (three `DataTexture`, RGBA, unsigned byte, `flipY = true`, `premultiplyAlpha = false`, nearest filters, no mipmaps, default colour space, the same settings as the `CanvasTexture` it replaces), `skinTextureOf(blob)` and `capeTextureOf(blob)` (decode, else the old canvas path as the fallback).
- `src/skin.js`: new `skinPixels(blob)` (decode + `normalizeSkinPixels`, null when the decoder refuses) and `capePixels(blob)` (64 x 32 only, pixels as stored). `skinCanvas` now calls `skinPixels` first; `capeCanvas` is unchanged (still used by the cape preview UI and as the fallback).
- `src/multiplayer/presence.js` (remote skins and capes, `cape-wire` hashes), `src/sp-skin.js` (`skinTexture`), `src/sp-cape.js` (`capeTexture`) build their textures through the new helpers. Skull heads (`skull-skins.js`) read the loaded player texture (`skinOf`), so they get the DataTexture with no change.
- `src/item-atlas.js`: the items/blocks sprite sheets were `CanvasTexture`s filled with `drawImage`. They are now DataTextures over a `Uint8Array`; each sprite strip is fetched and decoded with `png-decode.js` and its frame is copied into the cell as is (`drawEntry`, exported for the test). Fallback: the `Image` path read back through a canvas (the old rounding). A relayout swaps `texture.image` (siblings share the Source).
- Test: `src/skintex75-b75.test.js` (24).

## Evidence
- Executed: the 13 `SkinParseProbe` inputs (skin-parse-reference.json): each is written as a PNG, run through `skinTextureOf`, and the texture's array equals the native `parseUserSkin` output byte for byte (the accepted-size cases; the rejected sizes have no output).
- Executed (node): every `items/*.png` sprite is copied into a sheet cell and equals the file's decoded bytes (over 100 files, 5+ with partial alpha); `compass.png` frame 5 equals the strip's rows; ice, water, portal, stained glass, slime, shadow and rain upload arrays equal their decoded bytes.
- Audit (executed scan of `public/media/1.7.10` with `png-decode.js`): partly transparent texels whose premultiply round trip changes a colour channel: terrain water/ice/portal/stained glass/glass pane tops/underwater (at most 1 step), cauldron_side, paeonia, trip_wire, cave spider, slime (up to 13), creeper (1 pixel), rain (up to 8), icons.png, book_enchanted, salmon, pufferfish, name_tag, porkchop. Clouds, particles, widgets, pumpkinblur, horse markings, the dragon death texture round-trip exactly (alpha is 0, 255 or white colour).
- Where each reaches the GPU: the terrain atlas and its mip levels are already DataTextures from decoded bytes (atlas-texels.js, earlier batch). Entity, particle, rain, shadow, sky, experience orb, beam and weather textures use `TextureLoader` (an `Image` upload, no 2D canvas), so there is no canvas premultiply in the port. This is recalled browser behaviour (the image element upload is un-premultiplied); not executed here.
- Recalled: a 2D canvas stores premultiplied alpha, so canvas upload re-rounds partial-alpha colour.

## Verification
- `node --test src/skintex75-b75.test.js`: 24 pass.
- Related files (item-atlas, hd, atlasunify, itemsprites2, item-passes, skins73, cape-b70, mpcapes, spcapes72, order74, skintex75): 104 pass, 0 fail. `node --check` on every touched file. `npm run build` ok.
- Full npm test not run (batch rule).

## Follow-ups
- Not changed: `item-animation.js` cuts pack animation frames into data URLs through canvases (vanilla items have no `.mcmeta`, so only resource packs); the baked tint icons and potion composites in `block-textures.js` stay 2D-canvas data URLs (their partial-alpha note is in atlas-texels.js); GUI sheets (widgets, icons) are drawn onto the 2D screen canvas, where the screen blend is premultiplied anyway.
- Only a browser could confirm: the GPU upload of the DataTexture (flipY on a typed array, the skin orientation on the model), alpha blending of hat pixels, the item sheet after a resource pack relayout, and that `TextureLoader` images are not premultiplied by the browser.
