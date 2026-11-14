# Batch 64 atlas3: HD sprite sheets and block-atlas items

## Summary
- `src/stitcher.js` (new): the 1.7.10 Stitcher in JS (largest first, slot tree, power-of-two growth, holder rounding to 2^mip, `mipLevelsFor`, native "Unable to fit" error).
- `src/item-atlas.js`: now two sheets, items (256x256) and blocks (512x256). Each starts on the executed layout. When a sprite image has another size (HD pack), the sheet is stitched again with the sizes seen so far (unseen sprites keep the vanilla size) and sprites are drawn at their own size 1:1 (the old code scaled 16 px cells up). Sprite uv follows `initSprite` for the new layout. A `/media/1.7.10/blocks/<name>.png` url (flowers, torch, web, bars, lever, sapling, redstone torch, tripwire hook items) is now a cell of the blocks sheet with the block-atlas uv, as natively (ItemBlock sprite number 0); before it was its own texture.
- `src/light-material.js` (`liveSpriteTransform`), `first-person.js` glint, `projectile-renderer.js`: materials hold the sprite's own uv vector, so a re-stitch moves every user (was a copy). Three one-line edits.
- `tools/probes/StitcherProbe.java`, `tools/verify-stitcher.mjs`: new `hdCases` (32 executed Stitcher runs: x2/x4/x8, mixed, one 128 px, an 8 px sprite, HD plus 8 px, wide mix; mip 0 and 4; blocks and items) and `spriteNumbers` (Item.getSpriteNumber of all 315 items) in `stitcher-reference.json`. Doc: `public/research/atlas-stitcher.md`.

## Evidence
- Executed: Stitcher positions, atlas sizes, mip level limit and initSprite uv for the HD cases; sprite numbers. Result: only ItemBlock-family items (ids below 256) have number 0; the hopper (154) is the one ItemBlock on the items map, which the port already draws from `items/hopper.png`. No item of the item atlas is a block.
- Bytecode-read: `javap -c` of bpv, bpw, bpx and qh.b (Stitcher, Holder, Slot, roundUpToPowerOfTwo). The port matched the executed output on the first run.
- Recalled / unchanged: item atlas mip level 0 (b46 note).

## Verification
- `node --test` over item-atlas-hd-b64, stitcher-b64, item-atlas, atlas-layout, light-material, first-person-pose, projectile*, item-render, hand-models, item-entities, module-names, compass, drop*, hanging: 172 pass, 0 fail. `npm run build` ok. Full npm test not run (batch rule). `node tools/verify-stitcher.mjs` rerun (vanilla parts unchanged).
- Browser: none (batch rule).

## Follow-ups
- The terrain atlas the chunk mesher samples (`block-textures.js`, `TILE_ORIGINS`, fixed 16 px cells, ATLAS_WIDTH constants in mesher and worker) is not re-stitched for HD packs; the Stitcher module is ready for it. Block tile animation at the pack's size is therefore also open.
- Tinted flat block items (grass, fern, vine, lily pad, double plants) keep baked data urls instead of a blocks-sheet cell times a vertex colour.
- Item sprites other than the clock and compass do not read pack `.mcmeta` animation.
- Only a screenshot could confirm: an HD pack's held/dropped items and flowers look sharp and unshifted after the sheet re-stitches (uv vectors are shared, but GPU re-upload on resize was not seen); Anaglyph with the blocks sheet; very large packs (a 8192 px sheet) on real GPU limits (GL_MAX_TEXTURE_SIZE assumed 16384).
