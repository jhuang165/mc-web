# Batch 18 font track (branch b18-font)

## Summary
- `src/bitmap-text.js` (new): cached wrapper over the existing `menu-ui.js` `textHtml` glyph renderer (no second renderer). Call sites: item tooltips (`tooltipHtml`, box geometry from `GuiScreen.drawHoverText`), stack counts (`countHtml`, `RenderItem.renderItemOverlayIntoGUI`: right edge x+17, top y+9), container titles and "Inventory" labels (`drawLabels`, 0x404040 no shadow), held-item name, record "Now playing" (jukebox.js), boss bar title (boss-bar.js), F3 overlay, XP level (four black copies + 0x80FF20).
- `src/entity-names.js` (new): `entityDisplayName` (customName first, then `entity.<EntityList>.name` via `translate`). Used by the F3 overlay and death messages.
- Boss bars use `e.customName` when set (dragon.js, wither-boss-renderer.js).
- `death-messages.js`: attacker deaths (mob, arrow, fireball, explosion.player, indirectMagic, `.item` variants, explosion/magic without attacker) via `translate`; `Survival` records `lastSource`/`lastAttacker`; main.js passes them.
- Native evidence: positions/colours read from unchanged 1.7.10 bytecode with javap (bny, bdw, bbv), not probed at runtime. Widths already replayed from the real FontRenderer by LanguageProbe.
- CSS: appended block at the end of `src/container-ui.css`; `note-jukebox.test.js` HUD double updated.

## Tests
New `src/bitmap-text.test.js`, extended `src/death-messages.test.js`. See the final report for counts.

## Remaining gaps
- Signs: canvas + TTF, ASCII only.
- Nothing verified in a browser (tooltip box CSS rewrite, counts alignment, XP outline layering, F3 panel look).
- Wither/Dragon summon NBT does not set `customName`; own-player arrow deaths read "shot by arrow"; falls/drowning/burning/lava/cactus deaths still print no message.
- DOM-only invented dialogs (pause notes, command block) still use the page font. F3 colour 0xE0E0E0 not re-read from bytecode.

## Proposed remaining-gaps replacement (font/translation clause of the "One local player" line)
Item, block, container and HUD text is drawn with the 1.7.10 FontRenderer glyphs (bitmap-text.js), and entity names and attacker death messages are translated; still English or page-font: signs (canvas TTF), `Durability:`, a few invented dialogs, and fall/drowning/fire death messages.
