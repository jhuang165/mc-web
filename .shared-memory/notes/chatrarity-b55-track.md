# chatrarity b55 track

Branch `batch55-chatrarity` from be55d463b (0.83.0).

## Summary
- New `src/item-component.js`: `itemComponent(stack, name)` is `ItemStack.func_151000_E`: "[" with the name and "]" as siblings, coloured by EnumRarity, with a `show_item` hover whose value is the stack NBT text. `stackRarity` follows the executed table: common, rare while an `ench` list exists, golden apple rare at damage 0 and epic above, records rare, enchanted book uncommon while it stores enchantments. Nether star, beacon, potions and exp bottle are common in 1.7.10 (executed), not uncommon.
- The task text said "italic if renamed"; the executed component sets no italic (JSON has color, hoverEvent, extra, text only). Not ported as italic.
- Used in: death messages with a named held item (player killer, mob killer with a stored stack, fall assist/finish; `CombatTracker.message` returns `stack`; `main.js` passes `selfStack`), `/give` success (`host.give` returns `component`), and item statistic names (`commands-extra.js statName`: new ItemStack(item), damage 0). `/enchant` success takes no item argument, so it is unchanged.
- Hover NBT text is written for id, Count, Damage, ench, display.Name and StoredEnchantments in the HashMap order the rows show; RepairCost, Unbreakable, book and firework tags are not written.
- `gui.js tooltipLines`: a record's string `rarity` was indexed as an array (colour "r"); now only array rarities are indexed, so the record name is aqua.

## Evidence
- Executed: `ChatRarityProbe` runs the real `add.E()` / `add.w()` (ItemStack) over all 315 registered items in plain, `ench` and `StoredEnchantments` variants (damage 0..299 plus potion damages) and 10 named-stack component rows (JSON, formatted, unformatted, NBT text), into `public/research/chat-rarity-reference.json` via `tools/verify-chat-rarity.mjs`.
- Source-recalled: where 1.7.10 calls func_151000_E (DamageSource, CombatTracker, CommandGive, StatBase). The command and damage classes are not in the client jar.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-chat-rarity.mjs` (315 items, 10 rows)
- `node --test src/chat-rarity-b55.test.js src/chat-names-b54.test.js src/chat-component-b52.test.js src/cmd-tell-b53.test.js src/team-names.test.js src/combat-tracker.test.js src/death-messages.test.js src/commands-extra.test.js src/commands.test.js src/achievements.test.js src/cmd-output-b50.test.js src/cmd-texts-b51.test.js src/gui.test.js src/books.test.js src/food-items.test.js src/note-jukebox.test.js src/chat-component.test.js src/anvil.test.js`: 147 pass, 1 failure fixed afterwards (gui tooltip change reverted to a one-line guard; gui, note-jukebox, food-items rerun: 41 pass). `npm run build` ok. No full `npm test`, no browser.

## Follow-ups
- Multiplayer death and achievement broadcasts (server/) were not touched or inspected.
- Mob held stacks are read from `equipment[0]`/`heldItem`/`held` only when they carry an id; mobs in the port rarely hold enchanted named items.
- Hover NBT omits tags other than ench/display/StoredEnchantments.
