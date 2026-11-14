# Batch 70 researchdocs5: settling batch 69's open doc claims

## Summary
Docs, one test, this note. No game code changed. Each doc got a "Batch 70 (docs sweep)" line naming the code (`public/research/`: `block-sounds`, `boats`, `brewing`, `creative`, `crops`, `difficulty`, `enchanting-book`, `enchanting-table`, `enchantment-effects-armor`, `enchantment-effects-tools`, `enderman`, `fishing`, `lava`, `leash`, `loading-screens`, `blaze-ghast` (audio line only)). New `src/docs-sweep-b70.test.js` pins three of the facts (crop Fortune, Fire Protection against lightning, zombie villager conversion rolls). `dragon.md` untouched (researchdocs4).

Verdicts:
- Stale doc, now corrected: `block-sounds.md` fall sounds, `enderman.md` pumpkin helmet, `fishing.md` single-player stats, `creative.md` y = 0 exception (wrong: Creative breaks bedrock at y = 0, as natively), `leash.md` player UUID (real exported UUID), `crops.md` Fortune (live), `difficulty.md` creeper roll and villager conversion (both live), `lava.md` Nether flag, sunlight `setFire(8)`, fire hiss (not an entity sound natively), `blaze-ghast.md` audio (files imported), `enchantment-effects-armor.md` Resistance and lightning Fire Protection (both live).
- Confirmed, doc stands: `boats.md` mob passengers, `enchanting-book.md` / `enchanting-table.md` CustomName (no EnchantTable tile imported or exported), `enchantment-effects-tools.md` Bane slowness (never applied), `loading-screens.md` gaps, `block-sounds.md` footstep cell.

## Evidence
- Bytecode-read (`javap -c -p` on the extracted jar): `ajq` (BlockBrewingStand) bounds; the string `fire.fire` occurs only in `alb` (BlockFire) and `xx` (EntityBlaze).
- Code-read through callers (no execution): all other rows. Executed in `src/docs-sweep-b70.test.js`: `harvestBlock` crops with Fortune, `struckByLightning` with Fire Protection IV (64 ticks), `killConverts` on Hard/Easy.
- Recalled, not re-read: `Entity.moveEntity` step cell `floor(posY - 0.2 - yOffset)` with the fence/wall/gate (render type 11/32/21) rule. `mob-steps.md` already records it as bytecode-read in batch 17.
- Large generated docs (`block-metadata-catalogue`, `commands-b13`, `biome-decoration-audit`, `chunk-nbt`, `colored-blocks`, `command-blocks`, `damage-fx`, `languages`, `investigation`, `item-durability`, `item-names`, `leather-dye`, `cauldron-wash`, `chat-options`, `books`, `anvil-container`, `bed`, `fluids`, `food-items`, `fortress`, `game-rules`, `hanging-entities`, `hardcore`, `horse-gear`, `horse-inventory`, `enchanting-table`, `ender-pearl-live`, `extra-particles`, `enchantment-effects-armor`): phrase scan for "not implemented / not wired / not ported / not modelled / still open / none yet", then read the hits. Only `enchantment-effects-armor.md` had a stale claim. The others contain no checkable stale claim (their "not run" lines describe evidence method, not gaps).

## Verification
- `node --test src/docs-sweep-b70.test.js`: 3 pass.
- `node --test src/catalogue-consistency.test.js src/content-catalogue.test.js` and `npm run build`: 6 pass, 0 fail; build ok.
- Full npm test not run (batch rule). Nothing here needs a browser; brewing outline targeting could only be judged in one.

## Follow-ups
Real code gaps found:
- Player footstep cell (`main.js`, `Math.floor(position.y - 0.05)`): native is `floor(y - 0.2 - yOffset)` plus the fence/wall/gate rule. A one-line change, but `main.js` is hot and has no test seam; left for a track that already edits the step block.
- Brewing stand selection: native keeps the shared bounds at the 0.125 base slab (`ajq.g()` runs last in `addCollisionBoxes`, no `setBlockBoundsBasedOnState`); the port selects 0.875 high (`BREWING_SELECTION`). Needs a probe (before-first-query state is the unit cube) before changing targeting.
- Bane of Arthropods slowness is never applied (`info.slowness`), owned by `spfixes70`.
- Stale source comment: `armor-enchantments.js` line 65 says Resistance is not ported; `survival.js` applies it for the player. Mob Resistance not checked. Left as is (comment only, not in my doc scope).
- `lava.md` "water eye test" and "flammable blocks lava flows into" bullets were not re-checked.
