# Batch 65 itemsprites2: tinted flat items, item sprite animation, first-person map pose

## Summary
- `src/item-passes.js`: `itemPasses` now also returns a one-layer pass for the tinted flat block items (tall grass damage 1 and fern, double plant grass and fern, vine, lily pad): base is the grey `/media/1.7.10/blocks/<tile>.png` (a cell of the blocks sheet), tint is the render colour, no overlay. New `flatTintOfTile`. Until the colormaps load, grass uses the executed vanilla colour 7cbd6b.
- `src/first-person.js` (`itemTexture`): no longer asks `flatBlockTileUrl` for a baked data url; it returns the blocks png. Held view, dropped items, frames (they build drops), third-person hand (`player-renderer.js`) and `held-sprite.js` take the tint through the existing pass colour. Three guards `leather` -> `leather?.overlay` so a one-layer pass has no overlay mesh.
- `src/main.js` (`icon`): inventory icon of a tinted flat item is a `tinted-item` span (grey png times `--tint`), not the baked block icon.
- `src/item-atlas.js`, `src/item-animation.js`: every item sprite with a pack `.mcmeta` strip now animates inside the item atlas. `item-animation.js` already stepped every strip (`SpriteAnimation`); it now also calls `setItemAtlasFrame(sprite, frame)` each tick, and the atlas maps a cut frame data url back to its sprite (`setFrameUrlResolver`), so held, dropped, framed and projectile views share the atlas cell, as the native cell upload does. Pack change resets the frame to 0.
- `tools/probes/FirstPersonProbe.java`, `fp/bnn.java`, `fp/bao.java`, `gl/GL11.java` (no-op `glNormal3f`), `tools/verify-first-person.mjs`: 25 filled-map cases (5 map stacks x 2 views, plus steep and negative pitch views) in `first-person-reference.json` (67 cases; the 42 old ones are byte-equal). Markers `["A"]` (renderFirstPersonArm) and `["M", frame]` (MapItemRenderer) stand in for RenderPlayer and the map colour renderer; the pose and background quad are the unchanged `bly.a`.
- `src/itemsprites2-b65.test.js` (new, 5 tests); `src/babyrender-b64.test.js` count 42 -> 67 with map cases skipped (they are replayed in the new test).

## Evidence
- Executed: map pose of ItemRenderer.renderItemInFirstPerson. The port's `mapHandMatrices` (map-render.js) already matched every case (base, both arms, map matrix) within 3e-4 on the first run: the gap was an unverified pose, not a fault. The pitch input is the interpolated rotationPitch.
- Executed (earlier, b52dx `leafcolor-reference.json`): item colours. Tall grass white at damage 0, grass colour for 1 and 2; double plant grass and fern (damage 2, 3 mod 8) grass colour, others white; vine foliage basic 48b518; lily pad 208030. The test compares to this file.
- Bytecode-read: bly.a map branch (arms, quad, adh.a, bbx.a call).
- Recalled: TextureMap animation for every item sprite in 1.7.10 (from the task brief and TextureAtlasSprite.updateAnimation); leaves as items are cubes (renderItemIn3d), so not flat.

## Verification
- `node --test` one at a time: itemsprites2-b65 5 pass; babyrender-b64 22; item-atlas-hd-b64 6; first-person-pose 3; tint-items-b54 3; item-render 6; item-atlas 4; item-passes 3; leather-items 2; heldrender-b63 3; held-pose 2; bow 30; models 13. All 0 fail.
- `node tools/verify-first-person.mjs` rerun (67 cases). `node --check` on touched src files. Full npm test not run (batch rule). Build: see final report.

## Follow-ups
- Browser only: the tint look (inventory span via mask and multiply; 3D via vertex colour), a pack with an animated item strip in held, dropped and framed views, Anaglyph of tinted sprites (the old baked path converted colours; the new multiply is not Anaglyph-converted).
- `flatBlockTileUrl` / `flatTileImpl` in `block-textures.js` is now unused (file off limits for this track); remove later.
- Block icons of the blocks sheet itself (animated block tiles at pack size) stay with the terrain atlas track.
- Map colours and decoration icons drawn by MapItemRenderer were not recorded (stand-in marker only); the colour quad geometry is bytecode-read in map-render.js.
