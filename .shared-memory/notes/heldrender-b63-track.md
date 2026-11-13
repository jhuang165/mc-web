# Batch 63 heldrender: held items, sword blocking and the first-person arm

## Summary
- Three of the four listed gaps were already drawn by batches 45 and 47; the gap line was stale. This batch added the missing executed checks and found two real bugs.
- `src/first-person.js`: the first-person arm box is now `firstPersonArmGeometry()`. Every corner takes the uv of the native ModelBox vertex at the same model position. The old per-face row flip left the side faces mirrored and the top, bottom, front and back regions swapped. This is the "arm not re-checked after the bottom-face fix" gap: it was wrong.
- `src/mob-equipment-renderer.js`: `childHeldMatrix(limbMatrix, lift)` (exported, used by `followChildHeld`). The baby biped's held item was 1/256 block too low because the rig root's 0.5 halved the frame's 1/128 lift; the lift is added back.
- `tools/probes/ModelFacesProbe.java`, `tools/verify-model-faces.mjs`, `public/research/model-faces-reference.json`: a fifth executed record, the player's right arm box (`playerArm`, 64x32, uv 40,16, from -3,-2,-2, 4x12x4).
- `src/heldrender-b63.test.js`: new, 3 tests.

## Evidence
- Sword blocking, third person (player and remote players): executed. `held-pose-reference.json` has player sword cases with use > 0; `held-pose.test.js` replays them against `heldItemMatrix(kind, {blocking})`. `heldItemRight = 3` is in `bipedPose` (`rightArm.rotX * 0.5 - 0.31415927 * 3`, recalled from ModelBiped, same code path as heldItemRight 1) and remote players pass `blocking` from the synced use flag (`multiplayer/presence.js` `useFlags`). Already correct; found nothing to change.
- Sword blocking, first person: bytecode-read (bly.a, EnumAction.block: translate(-0.5, 0.2, 0), rotate 30 y, -80 x, 60 y after the 0.4 scale). The new test only pins the port to those numbers; it is not an independent execution (ItemRenderer needs a live Minecraft instance).
- Witch held item: executed (`held-pose-reference.json` witch cases, replayed in `held-pose.test.js`). Already correct.
- Baby mob held item: the executed `babyBiped` cases were skipped by `held-pose.test.js`. The new test replays them (executed child prefix, then the arm pivot and angles, then the item) against the port's real chain (rig root 0.5, frame lift, ZYX limb, follow group, flip, item matrix) for three arm poses including the zombie's raised arms. It found the 1/256 lift error, now fixed. Block items are skipped (the port has no baby-held block path).
- First-person arm: executed quads (`playerArm` record) compared with the geometry corner by corner in ModelBiped's own axes. The old geometry failed on all six faces; the new one passes. Selectors in `MODEL_QUADS` come from the `plain` record, the test uses the separate `playerArm` record.

## Verification
- `node --test src/heldrender-b63.test.js src/held-pose.test.js src/first-person-pose.test.js src/model-faces.test.js src/passes2-b47.test.js src/hand-models.test.js src/bow.test.js`: 50 pass, 0 fail.
- `node tools/verify-model-faces.mjs` (one JVM): 5 records.
- `node --check` on both edited sources. `npm run build` once at the end (see the report).
- Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Only a screenshot could confirm: the first-person arm's texture (the sleeve and skin split, the hand tip) looks right with the new uvs; the baby zombie's sword position by eye; the blocking sword's look in first person; the light level on the arm sides (normals unchanged).
- The first-person blocking transform has no executed record (needs an ItemRenderer probe with a stand-in Minecraft instance).
- Baby biped block items (a held block on a baby zombie) are not drawn by the port's sprite path.
- Natively a child's head is drawn at 0.75 scale and the body at 0.5 (ModelBiped.render isChild); the port halves the whole rig. Not touched here.
