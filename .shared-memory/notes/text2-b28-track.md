# text2 (batch 28) track note

Branch `batch28-text2` (from main 7b67a97). Target 1.7.10; no full parity claim.

## Summary
- **Bidi multi-paragraph**: `tools/probes/FontStyleProbe.java` has a new `levels` mode (ICU `Bidi` direction, paragraph levels, per-char levels of the unchanged flags). Finding: the "trivially LTR" shortcut is lost only when a later strong-less paragraph with content, directly after a level-0 paragraph, raises ICU's RTL flag (`a\n(` mirrors, `a\n\n(` does not); explicit embedding codes only count with a character under an odd embedding. `src/bidi.js` `laterParagraphIsRtl` / `embeddedRtl`. 600 seeded separator strings added to the reference (1033 bidi strings total).
- **§k**: probed with a seeded `java.util.Random` in `bbu.b` (`random` mode, 224 rows incl. stream position). Candidates are all 256 ascii.png cells; table characters only; the cell is replaced, not the character (unicode flag: no visible change, numbers still drawn); shadow pass draws first on the same stream. `font-quads.js` already matched; `randomGlyphIndex` is shared by `font-quads.js`, `sign-font.js` (which wrongly swapped the character, even with the unicode flag) and `textHtml` (which used printable ASCII only, frozen in caches). DOM `§k` spans (`kr`) are re-picked every animation frame.
- **Anaglyph § colours**: `colorCodeTable(anaglyph)` in `font-renderer.js` (constructor table, anaglyph conversion before the /4 shadow division; `colors` probe mode, 64 entries replayed). Only the constructor reads the flag, so `main.js` calls `setFontAnaglyph(options.anaglyph)` once at startup (one line + import); no in-game toggle effect, as natively. Used by `textHtml`, `sign-font.js`, `font-quads.js`. Side fixes: native gold shadow is 0x2a2a00 (the +85 red is entry 6 only); unknown `§z` resets styles and gives white.
- **Other**: book pages right-align reordered lines under bidi (`book-ui.js`). `Durability:` is hard-coded English in 1.7.10 as well (no change). Sign bidi already ran through `layoutString`.
- Files: src/bidi.js, font-renderer.js, font-quads.js, sign-font.js, menu-ui.js, book-ui.js, main.js (2 lines), font-style.test.js, bitmap-text.test.js, tools/verify-font-style.mjs, tools/probes/FontStyleProbe.java, public/research/font-style-reference.json, languages.md.

## Verification
- `node tools/verify-font-style.mjs` regenerates the reference from the unchanged jar (ICU4J 51.2 from the 1.7.10 libs): 140 draw, 224 random, 64 colour rows, 1033 bidi strings; `src/font-style.test.js` 9 tests pass. Scratch fuzz (seeded, up to 40,000 strings per seed, mixed Latin/Arabic/Hebrew/digits/marks/separators/§): 0 differences without explicit embedding codes or BN after a separator; with them 58-74 per 40,000.
- Muted headless Chrome (vite 5287 `?silent`, `--mute-audio`, master volume 0): `artifacts/b28-text2/check.mjs`, `text-styled-random-rtl-anaglyph.png`: bars/italic/bold, §k text different on three consecutive samples with accented and box-drawing glyphs, RTL row, anaglyph row (`§c` -> #888888 shadow #222222), no page errors (one 404 for an optional resource, not investigated). No world was entered.
- npm test / build: see the commit message and final reply.

## Follow-ups
- Explicit embedding codes after a separator-only paragraph, and BN characters at the start of a later paragraph, still differ from ICU in multi-paragraph strings (ICU level-run behaviour across paragraphs not reproduced).
- Signs with §k are not re-picked per frame (static sign texture).
- Not pixel-compared against a native screenshot; the Language screen was not driven with ar_SA / he_IL (flag forced in the check).
- Proposed `remaining-gaps.md` lines (not edited):
  - "Bidi: multi-paragraph strings with explicit embedding codes or format characters after a separator differ from ICU 51; ordinary separators and strong-less paragraphs match."
  - "§k obfuscation matches the native pick (all 256 cells, seeded replay) but sign textures are not re-picked per frame."
  - "Anaglyph § colours match the constructor table and are fixed at startup; GUI textures other than text follow the existing upload conversion."
