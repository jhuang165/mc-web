# Batch 59 smallchecks: comparator toggle, sneak light drop, advanced tooltip titles, effect-order Java version

## Summary
- `tools/probes/SmallChecksProbe.java`, `tools/verify-smallchecks.mjs`, `public/research/smallchecks-reference.json` (new): ItemStack.getTooltip with advanced tooltips on and off for 64 stacks, plus a sweep of all 315 registered item ids.
- `src/advanced-tooltip-id.js` (new) and `src/gui.js` (2 lines): with F3+H the title gets " (#0035/14)" (original id padded to 4 digits, "/damage" only for the 37 items with subtypes; a sweep-derived list). The map title, which the port had without the suffix, is now right.
- `src/comparator-toggle.js` (new, not wired): the full BlockRedstoneComparator.onBlockActivated rule for prediction5 to adopt; `src/client-prediction.js` untouched.
- `src/smallchecks-b59.test.js`: 6 tests.

## Evidence
- Executed: the tooltip rows and the 315-id sweep on the unchanged 1.7.10 jar (no registry-name or NBT line exists in 1.7.10; "Durability: x / y" follows only for damaged items).
- Bytecode-read (akc = BlockRedstoneComparator): new meta = (bit 4 flipped on) | (lit if block 150 or m&8) | m&3, set with flag 2, click random.click 0.3 at pitch 0.55 into subtract else 0.5; then c() updates the output signal and, unless the output is unchanged and the mode is subtract, sets or clears bit 8 from shouldBePowered (input 15+, none, or input >= side). The 12 executed records all have an unpowered input, so they match the port shortcut `m & 4 ? m & 3 : m | 4/12`. It is wrong only when the input is powered: leaving subtract mode keeps bit 8 (149 m12 -> 8, 150 m4 -> 8, not 0).
- Bytecode-read (sneak): EntityPlayerSP.e (blk) sets ySize (V) to at least 0.2 when the sneak key is down, then super.e() reaches Entity.moveEntity (sa.d) which does ySize *= 0.4 and posY = minY + yOffset - ySize. EntityPlayer.yOffset stays 1.62 (no sneak change). So the tick posY is 0.08 low: the held-light cell in `src/held-light.js` is right (`nextYSize` already models it). Gap closed, no change.
- Recalled (labelled): the 2014 launcher did not bundle a JRE; it ran the user's installed Java, mostly Java 6 or 7 then, 8 from March 2014 on. So Java 7 ordering was common for 1.7.10 players.
- Effect order: `JavaHashSetOrder` already models both. For small effect ids (1..15) the Java 7 and Java 8 bucket order is identical (spread leaves them unchanged); they differ for ids 16 and up (absorption 22, saturation 23, health boost 21) because Java 7's spread folds `h >>> 4` in. The gap is real but narrow: only mobs holding one of those ids with another. No code change: neither runtime is the unique native behaviour.

## Verification
- `node --test src/smallchecks-b59.test.js src/gui.test.js src/sign-font.test.js src/itemtags2-b58.test.js src/rendering-b58.test.js src/prediction4-b58.test.js`: 45 pass, 0 fail.
- `node --test src/books.test.js src/chat-rarity-b55.test.js src/food-items.test.js src/item-tags-b57.test.js src/mob-effects-b52.test.js src/mob-effects-b54.test.js`: 47 pass, 0 fail. `npm run build`: ok.
- `node tools/verify-smallchecks.mjs`: 64 tooltip rows, 315 sweep rows.
- Full npm test not run (batch rule). No browser check.

## Follow-ups
- prediction5: wire `comparatorToggle` (needs the client world's input and side power, tile output and computed output) into `dryActivate`.
- A named stack's title: natively "§oBob§r (#0035/5)", the suffix is not italic; the port draws the whole line italic.
- Java 7 versus 8 order for effect ids 16+ stays unchosen; a browser could show nothing here.
