# modal2 (batch 27) track note

Branch `batch27-modal2` (from main 8ab44f2). Target 1.7.10; no full parity claim.

## Summary
- Goal 1 (modal() -> GuiScreen): audit found no `modal()` call left in `src/main.js` (batches 21-22 already rebuilt GuiGameOver, the GuiYesNo quit question, GuiEditSign, Export World, the notes page and the container/book screens). `modal-dialogs.md` corrected: `#modal` is only the GuiContainer shell host. Export World and the notes page stay port-only (documented as non-native).
- Goal 2 (§n §m §o on every glyph page): `src/font-quads.js` replays renderStringAtPos / renderUnicodeChar / doDraw (pen `(int)advance`, shadow pass +1,+1 with -f offset for non-ascii glyphs, style flags leaking from the shadow pass, bold, italic corners, bars on the float advance). `menu-ui.js textHtml` now draws bars (`.tu`/`.ts`) and a skew (`.ti`) instead of CSS text-decoration/font-style; `glyphHtml` and `sign-font.js` advance by `(int)`.
- Goal 3 (bidiReorder): `src/bidi.js` + generated `src/bidi-data.js` (`tools/gen-bidi-data.mjs`). `font.bidi` follows `lang.bidirectional` (`setBidiFlag`); applied in `textHtml`, `Gui.splitText` (right aligned on the reordered width) and sign layout.
- Native evidence: `tools/probes/FontStyleProbe.java` (+ GL11 / Tessellator stubs) runs the unchanged jar `bbu` and ICU4J 51.2; `tools/verify-font-style.mjs` writes `public/research/font-style-reference.json` (140 draw rows, 418 bidi strings); `src/font-style.test.js` replays them.

## Verification
- `npm test`: 4619 pass, 0 fail (includes 5 new tests in `src/font-style.test.js`). `npm run build`: ok.
- Bidi port vs unchanged class: ~15,000 random strings over Latin/Arabic/Hebrew/digits/marks/explicit embeddings/presentation forms/punctuation, 0 differences. Only known difference: multi-paragraph strings (separator characters inside one string) whose later paragraph has no strong character.
- Muted headless Chrome (vite 5275 `?silent`, `--mute-audio`, master volume 0): `artifacts/b27-modal2/` styled-text-ascii-and-unicode.png, bidi-chat.png, gui-edit-sign.png, pause-menu.png, export-world.png, gui-game-over.png, gui-yes-no-quit.png, live-check.mjs. One 404 console error (a missing resource, not investigated). The bidi screenshot forces `setBidiFlag(true)` because the lang files are not shipped; no ar_SA / he_IL language was selected through the Language screen.

## Follow-ups
- Multi-paragraph strong-less paragraphs in `bidi.js` (see above).
- `§k` obfuscation is not replayed against the native random stream.
- Bars/skew in the DOM are not pixel-compared with a native screenshot; the primitive replay is exact only in `font-quads.js` (not used by the DOM renderer, only by tests).
- Proposed `remaining-gaps.md` lines (not edited, per the track rules):
  - "Bidirectional text (ar_SA, he_IL) is ported (bidi.js) and replayed against ICU4J 51; separator-containing strings with strong-less later paragraphs differ."
  - "§n/§m/§o are drawn on unicode glyph pages in the DOM text; not pixel-compared with a native screenshot."
  - "Export World and the notes page are port-only dialogs (no 1.7.10 screen)."
