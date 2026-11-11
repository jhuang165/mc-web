# modelfaces track, batch 45

## Summary
- Entity model faces: `tools/probes/ModelFacesProbe.java` runs the unchanged ModelRenderer/ModelBox/TexturedQuad (bix/bis/bhv) for boxes of every size class and mirror setting and writes `public/research/model-faces-reference.json` (`tools/verify-model-faces.mjs`). `src/model-faces.test.js` replays every face's vertices and uvs against `skinBox`. Only the bottom face was wrong: native v runs z1 to z2 there, BoxGeometry's -y face ran the other way. Fixed once in `skinBox` (src/first-person.js), so all ~35 model callers are corrected; the chest-only bottom override of batch 44 is removed from `src/chest-renderer.js`.
- Third-person held poses after the batch 44 `renderItemIn2D` change: `tools/probes/HeldPoseProbe.java` executes the unchanged RenderPlayer.renderSpecials (bop.a), RenderBiped.renderEquippedItems (bnw.a), RenderWitch.renderEquippedItems (bpb.a) and the real ItemRenderer.renderItem (bly.a) against a recording GL11 and writes `public/research/held-pose-reference.json` (blocks, sprites, tools, bow, rod cast/uncast, carrot on a stick, potion with two passes, sword in use, child biped, witch). `src/held-pose.test.js` replays the player, biped and witch matrices against `heldItemMatrix` and the `isFull3D` flags. Bow, flat sprites, blocks and tools already matched.
- Port fixes (src/player-renderer.js): fishing rod and carrot on a stick got the native `shouldRotateAroundOrigin` pre-transform (R180z, T(0,-0.125,0)) via a new "rod" kind; a cast rod is drawn as a stick in the third-person hand (native swaps in a stick while the bobber is out; first person keeps `fishing_rod_cast`); `heldItemMatrix` gained a `blocking` option (player sword in use pose) and an `origin: "nose"` option (witch nose frame plus R-15x and R40z), both matching the executed events.

## Verification
- `node --test src/held-pose.test.js src/player-renderer.test.js src/mob-equipment.test.js src/models.test.js src/model-faces.test.js src/hand-models.test.js src/leather-items.test.js src/fishing*.test.js src/witch*.test.js`: 92 pass, 0 fail.
- Reference files were generated from the jar classes by the verify scripts. Everything in the references is executed, not bytecode-read, except the field/method choice of which items get a stick (read from bop.a bytecode and confirmed by the executed cast case).
- No full `npm test` run (batch rules); `npm run build` result is in the final report.

## Follow-ups
- Sword blocking (use count > 0 with EnumAction.block) is not wired: `heldItemMatrix(..., { blocking: true })` is correct but nothing passes it.
- The witch's held item is not drawn; the nose-frame matrix exists (`origin: "nose"`), the potion's two render passes (requiresMultipleRenderPasses, reference case 373) and the nose postRender are not wired in `witch-renderer.js`.
- Child biped prefix (T(0,0.625,0), R(-20,-1,0,0), S0.5 before the arm postRender) is in the reference but not applied to baby mobs' held items.
- The first-person arm in `src/first-person.js` (~line 263) is hand-flipped and was not re-analysed after the skinBox bottom face change.
- Shared files touched: `src/first-person.js` (skinBox), `src/chest-renderer.js`, `src/player-renderer.js`, `tools/probes/gl/GL11.java` (additive no-op stubs).
