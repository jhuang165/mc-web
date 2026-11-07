# Signs (1.7.10)

Native evidence: `tools/probes/SignProbe.java` runs the unchanged 1.7.10 jar; `node tools/verify-signs.mjs` writes
`public/research/sign-reference.json` (1577 records: facts 2, item 1, shape 32, place 494, neighbour 1056, remove 15,
nbt 6, tile 1, chars 1, filter 1, plus javap constants for render, GUI and server). `src/signs.test.js` replays it.

Ids: blocks 175 (standing, original 63) and 176 (wall, original 68); item 480 (original 323). Recipe: 6 planks over a
stick make 3 signs. Stack 16, hardness 1, drops the sign, no collision, light opacity 0.

Implemented: placement (yaw meta in float32, side 0 refused, solid click target, replaceable cell), neighbour pop,
per-metadata bounds and ray boxes, tile store persisted in saves, chunk-runtime and region import/export ("Sign"),
the model/text renderer (`sign-renderer.js`, 64-block cull) and the edit screen (`sign-editor.js`).

Not done: no multiplayer packet path (the edit is applied locally) and the editor layout is approximate against the native screen. Not a claim of full parity.

Merge notes: ids 175-176 overwrite the reserved placeholders that `installNoteJukeboxBlocks` pushes up to 176, so `BLOCKS` stays contiguous. The browser check after the merge found the text plane drawn as a white board: `entityMaterial` compiles the texture lookup only when it gets a map at creation. `sign-renderer.js` now passes the canvas texture up front.

## Batch 19: sign text through the FontRenderer
Sign text (world plane and edit screen) is drawn by `src/sign-font.js` with the same glyph model as every other text path: widths, the
unicode flag (selected language or forceUnicodeFont) and glyph_sizes.bin from `font-renderer.js`, glyphs cut from the live ascii.png and
unicode_page_XX.png images (so resource-pack fonts apply; `onResourcesRefreshed` and font changes redraw the plane). Colour 0, no shadow,
line k at y = k * 10 - 20, x = -getStringWidth / 2 (int division), the edited line wrapped in `> ` and ` <`; section-sign colours and
bold/italic/underline/strikethrough/obfuscation follow FontRenderer.renderStringAtPos. The text plane is 150 font pixels wide (the original
90 only bounds the board; the original text is not clipped).

- Probed (executed natively): FontRenderer.getStringWidth of sign lines with both unicode flags (`tools/probes/SignFontProbe.java`,
  `tools/verify-sign-font.mjs` -> `sign-font-reference.json`, `src/sign-font.test.js`), plus the earlier ChatAllowedCharacters probe.
- Bytecode-read (javap): TileEntitySignRenderer (bmr) text translate/scale/line placement and the `> ` / ` <` markers, GuiEditSign (bfx)
  keyTyped (only `length < 15` and isAllowedCharacter; there is no 90 px limit in the native screen), FontRenderer glyph quads and the bold
  offset (1 px, or 0.5 px with the unicode flag).
- Not executed: GL drawing. The glyph pen advances by the float (end - start) / 2 + 1 for page glyphs while getStringWidth truncates, so
  centring uses the integer width exactly as the original does.
- The advanced tooltip line `Durability: x / y` is hardcoded English in ItemStack.getTooltip (1.7.10 en_US.lang has no item.durability), so
  it is correctly not translated; `Unbreakable` and `item.dyed` do use lang keys.
