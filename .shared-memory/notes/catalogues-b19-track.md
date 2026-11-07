# catalogues (batch 19) track

Branch worktree-agent-af7aaa7c4429e1acd. Generated parity catalogues brought up to date. No `src/` game code changed.

## Summary
- The committed catalogue Markdown had been hand-edited in later batches while the builders' status tables stayed old, so regenerating
  regressed rows (WitherSkull/EnderDragon/WitherBoss, doMobSpawning, mobGriefing, ANAGLYPH). Builders now carry the current text.
- Re-audited every Missing and stale Partial row. GUI: GuiScreenResourcePacks and its three list classes are Partial (resource-packs-ui.js);
  GuiSnooper$List and GuiMemoryErrorScreen are Out of scope; GuiVideoSettings/GuiOptions/GuiControls/GuiLanguage text refreshed.
  Settings: FORCE_UNICODE_FONT Implemented; ANAGLYPH Partial; Twitch stream options and keys, SNOOPER, ADVANCED_OPENGL, FBO_ENABLE Out of scope;
  Music/Records/Ambient sound rows no longer claim "no MusicTicker"; screen table refreshed. Structure: WorldGeneratorBonusChest Implemented,
  MapGenNetherBridge persistence stale text fixed.
- Recipes: the five dynamic handlers are Partial with native evidence. `tools/recipe-audit.mjs` `auditSpecials()` replays the probe references
  (leather dye 324, fireworks 78, book cloning 13, map cloning 17, map extending 17) and the builder asserts zero mismatches. Wooden slab
  variants and the mossy cobblestone wall are now mapped in the audit (audit-side table, no src change): 302 -> 308 recipes, 2710 -> 2744 samples.
  The four chainmail recipes (fire block ingredient, no item) are "Not replayed".
- Every header carries a computed status-count sentence (`tools/catalogue-audit.mjs`) and the batch 19 audit label.

## Method
Ran all builders (JDK-free, from checked-in references), diffed against committed files, patched the builder tables, grepped src/ for every
Missing row and read the relevant research docs. Native references were not regenerated (no jar probes needed).

## Counts (Implemented/Partial/Missing/Out of scope, status column)
- gui: 0/92/8/24 -> 0/96/2/26 (screens + support classes)
- settings: 14/51/20/0 -> 15/51/2/17
- structure: 81/22/1/0 -> 82/22/0/0
- recipe: Partial 324, Unmapped 10, Missing special 5 -> Partial 331 (incl. 5 specials), Not replayed 4
- biome 61 Partial, block 171 Partial, command 32 Partial/16 Out of scope, item 629 Partial/technical, entity and gamerule unchanged (builders corrected to existing text).

## Tests
`npm test` 4001 pass, `npm run build` ok. New `src/catalogue-consistency.test.js` (counterpart table with export checks, KNOWN_ABSENT
allowlist for every remaining Missing row, evidence links resolve, batch-19 header); `src/recipe-catalogue.test.js` extended (special replays, new counts).

## Remaining gaps
Still Missing: SATURATION, TOUCHSCREEN, GuiErrorScreen, GuiScreenWorking. Special recipes are replayed from fixtures, not from the manager extractor
(tagged stacks/world data); arbitrary NBT combinations and pickup-time map ids open. Item/block/biome rows are Partial by rule, not per-row verified.

## Proposed remaining-gaps lines
- Catalogues: regenerate with the builders after any status change; `catalogue-consistency.test.js` KNOWN_ABSENT lists the intentional Missing rows.
- Recipe special handlers: no manager-level native samples with NBT; extend RecipeCatalogueProbe to emit tagged samples.
