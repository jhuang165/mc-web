# Languages track (batch 15)

Branch b15-languages, base main 01887b4 (app 0.44.0). Owner: claude-b15-languages.

Done: `src/font-renderer.js` (FontRenderer widths, unicode glyphs), `src/lang.js` (Locale parse/merge, selection), `src/lang-hooks.js`, `tools/fetch-lang.mjs` (`npm run lang:fetch`), `tools/probes/LanguageProbe.java` + `tools/verify-languages.mjs` -> `public/research/languages-reference.json`, Language screen with Force Unicode Font, options.txt `lang:`/`forceUnicodeFont:`, `glyph_sizes.bin`, pack override of ascii.png/glyph_sizes.bin. Docs: `public/research/languages.md`.

Facts: unicode rule is >10% (float), not 1%. Run the verifier with `MC_RESEARCH=<tools/research>` and a JDK. `public/lang/1.7.10/` is ignored.

Remaining: item/block name keys, tooltips/signs/HUD on the bitmap font, bidi/shaping, unicode style decorations.
