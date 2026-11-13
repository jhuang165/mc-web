# Batch 57 itemtags: Lore, SkullOwner, CustomPotionEffects, map_is_scaling on item stacks

## Summary
- New `src/item-tags.js`: stack fields `lore`, `skullOwner`, `customPotionEffects`, `mapScaling`; read/clone/compare/NBT helpers.
- Carried through inventory (`inventory.js` makeStack, merge check, read), anvil and enchanting containers, books `hasItemTag`, minecart/chest saves (`minecarts.js`), `world-import.js`, Java import (`region-import.js`) and export (`region-export.js`), NBT text (`item-component.js`), and `/give` dataTag (no `commands.js` edit; the generic reader now keeps the tags).
- Use: Lore lines (dark purple italic, after enchantments, before the attack block) and a Dyed / `Color: #HEX` line in `gui.js`; "<name>'s Head" in `item-names.js`; custom effects override the damage value in the name, tooltip and glint, on drink (`potion-use.js`, ambient kept), on throw and in flight saves (`witch-potions.js`), and on impact (`witch.js`).
- `witch.js` `splashImpact` now takes the stack's custom effects, falls back to the PotionHelper effects for any splash damage value (it only knew the 8 witch potions), and returns ordered `steps` so heal and harm interleave as `Potion.affectEntity` runs them.
- Probe `tools/probes/ItemTagsProbe.java`, script `tools/verify-item-tags.mjs`, reference `public/research/item-tags-reference.json`, replay `src/item-tags-b57.test.js`. `src/command-tags.test.js` updated: `display.Lore` is no longer reported as not kept.

## Evidence
- Executed: 48 tag rows (name, tooltip with and without F3+H, effects, hasEffect, liquid colour, NBT text) and 342 `EntityPotion.onImpact` rows (instant health / harm at amplifiers 0..3, four offsets, direct hits, undead kinds, a living thrower, timed and mixed custom lists), run on the unchanged 1.7.10 classes. All replay green.
- Executed: a compound `SkullOwner` without `Name` crashes native with an NPE (the port shows "Head"). Wither ignores damage from an undead thrower (replayed in the test). The wither takes no effects.
- Bytecode-read: `EntityPotion` keeps its ItemStack, so CustomPotionEffects do apply on splash. The liquid colour (`getColorFromItemStack`) uses the damage value only. The only vanilla map tag is `map_is_scaling`.
- Recalled: map tooltips need a player world, so the probe skipped them (id 358); the dispenser splash path was not checked.

## Verification
- `node --test src/item-tags-b57.test.js`: 10 pass, 0 fail.
- 74 targeted test files (gui, potions, item-names, inventory, anvil, enchanting, region import/export, minecarts, world-import, witch*, books, item-component, chat, commands, mob-effects, brewing, survival, entities, player-throws, potion-fx, deathdrops and others): 618 pass, 0 fail.
- `npm run build`: ok.
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-item-tags.mjs` regenerates the reference.
- Full npm test not run (batch rule).

## Follow-ups
- A Lore list that is not strings (or other malformed lists) is dropped on import; native keeps it as raw NBT (the tooltip is empty either way).
- Extra `SkullOwner` profile fields (Id, Properties) and extra fields of a custom effect are not kept; a profile skin does not render.
- Dispenser splash potions do not carry CustomPotionEffects yet.
- Map tooltips and the map tag on a created map item are not replayed (needs a map storage world).
- Liquid colour and the potion brewing of custom stacks follow the damage value, as native does.
