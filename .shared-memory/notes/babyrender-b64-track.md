# Batch 64 babyrender: baby model frames, held blocks on mobs, first-person item record

## Summary
- `tools/probes/BabyModelProbe.java`, `tools/verify-baby-models.mjs`, `public/research/baby-model-reference.json` (new): run ModelBase.render for adult and child on 11 models (biped, zombie, villager, zombie villager, pig, cow, sheep, sheep fur, chicken, wolf, ocelot).
- `tools/probes/gl/GL11.java`: new `markLists` flag; glCallList then also emits `["L", id]`. Off by default, so older outputs are unchanged.
- `src/mob-renderer.js`: a baby pigman head now scales 1.5 like a baby zombie (it is the same ModelBiped).
- `src/ocelot-renderer.js`: kitten head moved to the native frame (3 px down, 6 px back, scale 0.75 of adult).
- `src/held-sprite.js` (`heldBlock`) and `src/mob-equipment-renderer.js`: mobs now draw a held block (cube, torch-like block models, chest family), adult and baby. The baby path reuses the batch 63 child matrix.
- `tools/probes/FirstPersonProbe.java`, `tools/probes/fp/*`, `tools/verify-first-person.mjs`, `public/research/first-person-reference.json` (new): runs the unchanged ItemRenderer.renderItemInFirstPerson (bly.a) with stand-in Minecraft, player and world; 42 cases.
- `src/first-person-pose.js`: the swing translate is skipped while the stack is in use (blocking sword, bow); new `turnAround` option (fishing rod, R180 y after the 0.4 scale). `src/first-person.js` passes `turnAround` for the rod (one line).
- `src/babyrender-b64.test.js` (new, 22 tests).

## Evidence
- Executed: all frames in baby-model-reference.json (unchanged client classes through the recording GL stand-in). Pigman and ocelot were real bugs. Zombie, pig, cow, sheep, chicken and wolf child paths already matched. Villager has no child branch in the model; adult and child events are equal, the 0.5 comes from RenderVillager.
- Executed: first-person-reference.json. It showed three port faults: the swing translate must not apply while an item is in use (sword block, bow); the fishing rod was missing its 180 turn; the old blocking comment was wrong. All 42 cases replay within 3e-4 (native swing angles use the MathHelper sine table).
- Executed earlier (batch 56): horse foal, HorseModelProbe. Not touched.
- Bytecode-read: bpa.b (villager 0.9375, times 0.5 for a child). Biped headwear (bhm.d) draws in the 0.5 body frame natively; invisible on zombie and pigman textures.
- Recalled: none relied on.

## Verification
- `node --test src/babyrender-b64.test.js`: 22 pass, 0 fail.
- Also, one at a time: first-person-pose (3), heldrender-b63 (3), held-pose (2), mob-equipment (13), models (13): all pass.
- `node --check` on every touched src file.
- Full npm test not run (batch rule).
- Build: see final report.

## Follow-ups
- Screenshot only: baby pigman and kitten head look, held block look on zombies (adult and baby), first-person blocking sword view, the rod turn, lighting.
- The camera hand bob before bly.a is not in the probe record (bob is zero in the replay).
- Map mode in first-person.js has its own pose and was not compared.
