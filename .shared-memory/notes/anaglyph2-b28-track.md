# anaglyph2 batch 28 track

## Summary
- Native readers inventoried (javap, bytecode-read): see public/research/anaglyph-colors-reference.json and post-shaders.md. blt.a is read only by RenderBlocks (13 sites); bbj.e by bqi, bbu, bma, blt.
- Ported: mesher colour multiplier conversion (src/anaglyph.js meshAnaglyph/anaglyphMultiplier, Mesher.tint in scene.js, stem tint), unconverted paths kept raw (water, vine, lily, wire); sunrise fan centre conversion (sky.js, rim raw); toggling remeshes all chunks (scene.js onAnaglyphChange).
- scene.js hunks: import, Mesher.tint, onAnaglyphChange, vine/liquid tint flags, stem tint, sky.update anaglyph arg.
- Not done: FontRenderer table (text2), @515 chunk-update skip.

## Verification
- npm test 4688 pass / 0 fail (before the final doc edits); npm run build ok.
- Muted headless Chrome (artifacts/b28-anaglyph2/smoke.mjs, smoke.json), driven through Options > Video Settings: mean chunk vertex shade rgb off [0.4593,0.5608,0.4087], on [0.5136,0.5304,0.4238], off again identical to the first; no page errors (one 404 resource, see follow-ups).

## Follow-ups
- Proposed gap line: "3D Anaglyph: FontRenderer colour table and DOM GUI unconverted; bma chunk-update skip while anaglyph not modelled."
- Identify the one 404 in the smoke run (likely unrelated asset; not checked against main).
