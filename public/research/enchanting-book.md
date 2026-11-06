# Enchanting table book and galactic text (Minecraft Java 1.7.10)

Ports `TileEntityEnchantmentTable` (apd), `RenderEnchantmentTable` (bmn), `ModelBook` (bhf), `EnchantmentNameParts` (bfp) and the book/text parts of `GuiEnchantment` (bfq). Full parity is not claimed.

## What is live

- **Book state** (`src/enchanting-book.js`, `BookTile`). Every table block in a resident column has a tile (`enchanting-book-live.js`: a chunk scan every 20 ticks, plus placement/removal through `world.onChange`). Each client tick runs `updateEntity`: the closest player inside 3.0 blocks of the block centre (`World.getClosestPlayer`, strict `<`) opens the book (+0.1 spread), points it at the player (`atan2`, turning 0.4 of the way) and, while spread is under 0.5 or on a 1/40 roll, picks a new page-flip target; with nobody near, the book closes and turns +0.02 per tick. Page flip follows `flipA += (clamp((flipT - flip) * 0.4, +-0.2) - flipA) * 0.9`. All arithmetic is `float` (fround). The original uses one static, unseeded `Random` for every table; this build uses one shared `JavaRandom` (`tileRandom`).
- **Book drawing** (`enchanting-book-renderer.js`). Pose from `RenderEnchantmentTable`: translate (0.5, 0.75, 0.5), bob `0.1 + sin(tick * 0.1) * 0.01`, yaw `-(rotationPrev + shortest delta * partial)` and 80 degrees about z, page angles `frac(flip + 0.25 / 0.75) * 1.6 - 0.3` clamped to 0..1, spread interpolated. The seven `ModelBook` boxes use a port of `ModelBox` (so UVs and vertex order match the original) and the original `setRotationAngles`. Tiles beyond 64 blocks are skipped.
- **Texture.** `textures/entity/enchanting_table_book.png` is a Mojang asset and is not copied. `bookTexturePixels()` paints an original 64 x 32 texture (violet leather with a gold border, parchment pages with ruled lines) onto the same UV regions; it is procedural and deterministic.
- **GUI book.** `GuiBook` ports `GuiEnchantment.updateScreen` (page flip rerolled whenever the stack in the slot changes, spread +-0.2 per tick while any of the three levels is nonzero). `EnchantingGuiBookView` draws the model with the original projection (shift -0.34, 0.23; fov 90; near 9, far 80; 320 x 240 viewport centred on the screen) and modelview chain on a transparent canvas laid behind the slots.
- **Galactic names.** `enchantNames(nameSeed)` reproduces `EnchantmentNameParts`: `setSeed(container.nameSeed)`, then for each of the three buttons `nextInt(2) + 3` words from the 55-word list joined by spaces. `enchanting-glyphs.js` draws them with an original glyph set (a few strokes on a 5 x 7 lattice per letter; `ascii_sga.png` is not copied) wrapped at 104 pixels and tinted with the button colours: normal 6839882 (0x685E4A), hover 16777088 (0xFFFF80), unaffordable `(6839882 & 0xFEFEFE) >> 1`, and the level number 8453920 (0x80FF20) or 4226832 (0x407F10) when the player cannot pay (all read from the `GuiEnchantment` bytecode). Level-0 buttons show no text.
- **Particles.** The bookshelf glyph particles (`BlockEnchantmentTable.randomDisplayTick`, `EntityEnchantmentTableParticleFX`) were already ported with their own probe; see [extra-particles](extra-particles.md).

## Evidence

`node tools/verify-enchanting-book.mjs` (with `MC_RESEARCH` pointing at the research folder) runs `tools/probes/EnchantingBookProbe.java` against the unchanged client and writes `enchanting-book-reference.json`:

- the `ModelBook` model: every box, rotation point, initial angle and the six quads (vertices and UVs) of all seven parts;
- 60 `setRotationAngles` poses over tick/page/spread inputs;
- 12 tile scenarios of 260 ticks: a seeded `Random` replaces `apd.r`, the World double keeps the real `playerEntities` list and `World.getClosestPlayer`, and the player walks an approach-and-leave circle, hovers on the 2.99 / 3.01 edge, crosses through, jumps above, stays far and comes and goes; six start from a mid-turn state to cover the angle wrap and clamps. Every tick records all ten fields; the final `nextInt` proves equal random consumption;
- 40 seeds (edge values and random longs) of `EnchantmentNameParts` (three consecutive names) and the word list;
- 6 GUI sequences of 220 ticks through the unchanged `GuiEnchantment.updateScreen` (an allocated GUI, a seeded `Random`, scripted item and level changes).

`src/enchanting-book.test.js` replays all of it exactly (including `Math.atan2` results), and `enchanting-book-renderer.test.js` / `enchanting-glyphs.test.js` cover geometry, texture and glyph layout.

## Gaps

- The two render transforms (`RenderEnchantmentTable.renderTileEntityAt`, `GuiEnchantment.drawGuiContainerBackgroundLayer`) call OpenGL and are transcribed from bytecode, not probed. The GUI book was not compared with a native screenshot and the world book was not browser-checked in this change.
- Glyph shapes and widths are original, so a name wraps differently from the real font on long lines; the real `ascii_sga.png` width table is not used. The book texture is original, so it will not look like the vanilla book.
- The GUI book is lit by the two item lights with a white lightmap; the exact GL light/normal rescale is approximated by the entity shader.
- The original tables' tile entities are only ticked while loaded; this build resets a table's book when its chunk streams back in. The table `CustomName` (anvil-renamed tables, region import) is not stored.
- The level text sits 7 pixels below the glyph origin in the original (`y + 16 + 19n + 7`); the existing CSS places it at `top: 7u` inside a button that starts 14 pixels down, which was left unchanged and not compared pixel by pixel.
