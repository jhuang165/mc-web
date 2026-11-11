# handmodels b44 track

## Summary
- Held and dropped 3D sprite items (`ItemRenderer.renderItemIn2D`, `RenderItem` sprite branch) are now matched to executed vertices. New probes `tools/probes/ItemSpriteProbe.java` and `DroppedSpriteProbe.java` (stand-ins in `tools/probes/drop/`) run the unchanged `bly`/`bny` with the real Tessellator and the recording GL11; `tools/verify-item-sprite.mjs` writes `public/research/item-sprite-reference.json` (4 sprite cases, 26 dropped cases, class sha256 inside).
- `src/sprite-geometry.js` rewritten in native draw order with float32 arithmetic and the half-texel uv offset. Dropped sprite stacks: fancy graphics draws 1/2/3/4 copies (stack < 2, < 16, < 32, else) stacked along z by 0.084375; fast graphics keeps the block rule's count with the 0.3 random scatter applied before the turn to the view (`src/drop-sprite.js`, `drop-renderer.js`). The old rule (5 copies above 40, z step 0.042) was wrong for sprites.
- Chest hand and drop model: only the bottom faces of the ModelChest boxes had wrong uvs (v run the wrong way). Fixed in `chestModel` in `src/chest-renderer.js`; it also corrects world chests.
- Cactus item: native type 13 is not a box (full top and bottom, sides inset 1/16, not turned). `CACTUS_ITEM_QUADS` in `src/render-shapes.js`, `cactusItemGeometry` in `src/first-person.js`.
- Turn rule: `blockItemTurn` (hand, third-person hand, drops). renderBlockAsItem turns only types 0, 16, 22, 26, 31, 39 by 90 degrees; stairs, fences, gate, beacon, anvil, wall, dragon egg and cactus stay at 0. The port used 90 for every held block and none for drops. Drops now apply the item's own turn inside the spin.
- Plain cubes: `blockCubeGeometry` (shared by hand and drops) flips the bottom face's v to the executed renderFaceYNeg orientation, and draws the dispenser and dropper as metadata 3 and pistons as metadata 1 as native does (previously by damage).

## Verification
- Native evidence: the executed records `item-sprite-reference.json` (new), `item-render-reference.json` and `chest-item-reference.json`. No existing probe or stub was changed, so no other verify script needed re-running.
- Focused tests, one command at a time: hand-models 6/6 (new: chest, cactus, pistons, dispenser and dropper, plain cubes 1/4/5/12/17/45/58, turn rule), item-sprite 3/3 (new), chest 5, chests 9, chest-icon 2, ring-chests 2, icon-quads 8, item-render 6, first-person-pose 3, gate-item 3, player-renderer 26, mob-equipment 13, item-entities 10, bow 30, dyes 11, leather-items 2, models 13: all pass. `git diff --check` clean.
- Muted headless Chrome (Playwright headless, `--mute-audio`, `?silent`, port 5455, closed in finally, vite killed): held sword, stick, chest, cactus and piston screenshots in `artifacts/b44-handmodels/`; no page errors (one console 404 for a resource, not traced).
- The full suite and the build were left to the lead.

## Follow-ups (proposed gap lines)
- The cactus inventory icon is still a full cube; native renderItemIntoGUI draws the type 13 quads (sides inset 1/16).
- The item atlas (`textures/atlas/items.png`) is not yet laid out by the executed Stitcher; not started.
- `skinBox`'s bottom-face v may be wrong in other entity models; only the chest was checked.
- Dropped fast-graphics sprites turn with the camera direction; native uses 180 minus the render manager's view yaw (recorded) and a different phase was not compared in a browser.
- The drop's +0.125 y offset and the dropped chest/block turn were checked by rules and quad tests only, not by an executed full RenderItem block path.
- Held 3D sprites in third person (`player-renderer`, `mob-equipment-renderer`) use the new geometry but their poses were not re-verified.
