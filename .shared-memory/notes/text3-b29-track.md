# text3 batch 29 track (bidi paragraphs, §k signs, language screen)

## Summary
- bidi.js now follows ICU 51 for multi-paragraph text: per-character paragraph levels, level runs across the text with sor/eor, removed characters (explicit codes, BN) taking the next retained character's level. The two batch 28 "Still different" cases are gone.
- tools/fuzz-bidi.mjs (seeded, `heavy` mode) and tools/fuzz-bidi-levels.mjs added; about 1.1M strings, 0 differences versus the jar. font-style-reference.json grew to 2537 bidi strings.
- §k on signs: sign-font.js reports random picks; sign-renderer.js redraws only §k lines of visible §k signs each frame (budget 16, frustum sphere test); sign-editor.js repaints the preview per frame. main.js, scene.js, entities.js untouched.
- Language screen: bao and bdk set the bidi flag from brr.b() (read from bytecode); ar_SA and he_IL true, others false.

## Verification
- npm test: 4742 tests, 4741 pass; the one failure was the timing test "a natural spawn tick stays cheap on a streamed world" (mean 2.64 ms under load), which passes alone (23/23). npm run build passes.
- Muted headless Chrome on vite 5292 (--mute-audio, ?silent): artifacts/b29-text3/check.mjs (Language screen) and sign-check.mjs (obfuscated sign ahead 77 uploads/s, plain sign and sign behind camera 0).

## Follow-ups
- No pixel comparison of bidi or §k rows against native screenshots (§k picks are unseeded per frame).
- Proposed remaining-gaps lines:
  - Bidi: ICU 51 level-run behaviour is reproduced for strings with separators, embedding codes and BN (0 differences in about 1.1M seeded strings); no pixel comparison against a native screenshot.
  - §k signs re-pick per frame for visible signs only (16 per frame); native redraws every sign in range every frame, and the picks are not seeded.
