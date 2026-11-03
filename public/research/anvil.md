# Anvil (ContainerRepair, SlotRepairOutput, BlockAnvil damage)

Ported from the unchanged 1.7.10 classes (obfuscated `zu` ContainerRepair, `zw` output slot, `zv` input inventory; names from `joined-1.7.10.srg`). Code: `src/anvil.js`, a standalone module. **The anvil block, GUI, packet handler and repair transactions are not live**: nothing in `main.js` connects `ContainerRepair` to gameplay. A separate [item-tag persistence foundation](anvil-persistence.md) now carries `RepairCost`, `display.Name`, enchantments and stored enchantments through supported inventory and Java save paths. Tests: `src/anvil.test.js`. Evidence: `public/research/anvil-reference.json`, written by `tools/verify-anvil.mjs` from `tools/probes/AnvilProbe.java`. This covers the repair/rename/combine rules and the take step only. Full parity is not claimed.

## Evidence

The probe loads the unchanged client classes (client SHA-1 `e80d9b3b...`, SHA-256 of 22 class files stored in the JSON) after `Block`/`Item` registration and builds a real `ContainerRepair` with its real constructor. Test doubles:
- a constructor-less `EntityPlayer` carrying capabilities, experience fields and a seeded `Entity.rand`
- a `World` exposing one anvil cell (`getBlock`, `getBlockMetadata`, `setBlockMetadataWithNotify`, `setBlockToAir`, `playAuxSFX`), logging what the container asks of it
- an empty `en_US.lang` on the classpath: the client JAR has none, so an unnamed stack's `getDisplayName` is its unlocalised key (for example `item.swordDiamond.name`). The replay uses the same recorded table. Real English names are language data, not anvil logic, and are not recorded.

Each repair row puts the left stack, the right stack and the typed name, then reads the output slot, `maximumCost` and `stackSizeToBeUsedInRepair`, checks `canTakeStack` at a recorded experience level and, for about a third of cases that can be taken, runs `onPickupFromSlot` (experience deduction, input slots, block damage roll with a seeded Random, world calls).

| Records | Count | What |
| --- | --- | --- |
| repair | 9000 | random pairs: tools, swords, axes, hoes, bow, rod, shears, flint and steel, carrot on a stick, all armour, books, enchanted books and plain items with counts up to 64. Damage 0 to near broken, random enchantments (compatible, conflicting, over max, level 0, duplicates), `RepairCost` 0 to `Integer.MAX_VALUE` and negatives, custom names, renames (null, blank, Unicode whitespace including no-break spaces, same as current name, new name), 15% without a right stack, survival and creative, remote worlds, anvil damage stages 0-2 in four facings. 3326 produce an output, about 800 are taken. |
| material | 720 | every repairable item with its material at counts 1, 2 and 64, damage 1, half and maximum, with and without enchantments |
| conflict | 2505 | every enchantment ID on every ID (576 pairs) as a book on enchanted books, diamond sword, pickaxe, chestplate, boots, bow, axe, rod and shears |
| block | 84 | repeated takes on one anvil until it breaks (up to 70 uses): all three stages and four facings, creative, remote and a missing block. 57 breaks in 1041 uses |
| roll | 24 | 400 `nextFloat() < 0.12f` results per seed |

Also stored: all 315 item IDs and the repair-material table over every item pair (`getIsRepairable`), and the name table. `node --test src/anvil.test.js` replays every record exactly: stacks (ID, count, damage, enchantment and stored lists, unbreakable, `RepairCost`, custom name), `maximumCost`, `stackSizeToBeUsedInRepair`, `canTake`, the slots, experience fields, world calls and the next `nextInt()` of the Random. The JSON is 1.65 MB from JVM 19.0.1 and regenerates byte for byte.

## Rules as found in the 1.7.10 bytecode
The task brief mentioned an `* 2 + 1` prior-work penalty; **that is not in 1.7.10**. The bytecode has the additive scheme below, and the port follows it.

- **Costs**: `maximumCost = base + cost`. `base` starts as the left `RepairCost` plus the right `RepairCost`. `cost` collects the operation costs.
- **Material repair** (`item.getIsRepairable(left, right)`, left damageable): each unit restores `min(damage, maxDamage / 4)`, up to the stack size. Each unit costs `max(1, restored / 100) + number of enchantments on the left`. Nothing to repair gives no output. The units used are `stackSizeToBeUsedInRepair`.
- **Combining two damaged tools** (same item, damageable, right not a book): `remaining(left) + remaining(right) + maxDamage * 12 / 100` is the new durability, capped at full. If damage drops, `cost += max(1, bonus / 100)` with `bonus = remaining(right) + 12% of max`.
- **Enchantment merge** (not material repair; right is an enchanted book or the same damageable item): for each right enchantment, equal levels give level + 1, else the higher. Allowed if `canApply` to the left stack, or the player is creative, or the left is an enchanted book. Every conflicting left enchantment (not `canApplyTogether`) blocks it and adds the level difference to `cost`. Levels are capped at the enchantment maximum, and `cost += multiplier * (newLevel - oldLevel)`. The multiplier comes from the weight: 10 gives 1, 5 gives 2, 2 gives 4, 1 gives 8; halved (minimum 1) when the right is an enchanted book with stored enchantments.
- **Final enchantment cost**: for every enchantment in the output, `base += n + level * multiplier` with `n` counting 1, 2, 3, and so on. A book on the right halves `base` (minimum 1).
- **Rename**: blank text with a named left stack removes the name; any other text differing from `getDisplayName()` sets it. Cost is 7 for a damageable stack, else `5 * stackSize`. When the left was already named, half of it is also added to `base`.
- **Limits**: no operation cost (`cost <= 0`) gives no output. A rename-only result at `maximumCost >= 40` is clamped to 39. `maximumCost >= 40` in survival gives no output ("Too Expensive!"); creative is allowed. Early failures set `maximumCost` to 0. The no-output case from `cost <= 0` keeps its computed `maximumCost`.
- **Output `RepairCost`**: `max(left, right)`, minus 9 if the output is named, floored at 0, plus 2.
- **Take** (`SlotRepairOutput`): possible when `(creative or level >= maximumCost) and maximumCost > 0 and an output exists`. Survival pays `addExperienceLevel(-maximumCost)`. Input 0 is cleared; the material stack loses `stackSizeToBeUsedInRepair` (that field keeps its old value when the left slot was emptied, as in the original) or is cleared. Then the anvil block, if the player is in survival, the world is not remote and the block is an anvil: `nextFloat() < 0.12f` damages it (metadata bits 2-3: 0, 4, 8 plus facing; the next use breaks it with sound 1020, else sound 1021 with metadata flag 2). Otherwise sound 1021 plays on the server. The Random is only drawn when the first three conditions hold.
- **Arithmetic**: all costs are Java `int` arithmetic, so huge `RepairCost` values wrap. Enchantment IDs missing from the registry throw (the original throws a NullPointerException).

## Not ported / open items
- **Not wired**: anvil block (BlockAnvil, falling anvil, placement metadata), anvil GUI (`GuiRepair`, text field, cost display, red "Too Expensive!"), the `MC|ItemName` packet and its character filtering, shift-click behaviour (`transferStackInSlot`), closing the container (`onContainerClosed` drops inputs), and `canInteractWith` distance check.
- **Localised names**: `updateRepairOutput` takes an `itemName(stack)` callback. The default returns `""`, so a name equal to the localised default is only detected when the caller supplies the item names. Without it, retyping an item's default name charges a rename.
- **Not tested**: enchantments on non-registered IDs, `RepairCost` stored as a non-int NBT type (the original reads it as 0), and anvil sound/particle playback.
- **Item data**: durability and enchantability come from `enchantments.js`; the repair-material table is in `anvil.js` and checked against all 315 items by the test. Hoes, bows, shears, fishing rods, flint and steel and carrot on a stick have no repair material in 1.7.10. Enchantment gameplay effects and glint remain unimplemented; see [item-tag persistence](anvil-persistence.md) for save/interchange coverage and limits.
