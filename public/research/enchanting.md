# Enchantments and the enchanting table (Enchantment, EnchantmentHelper, ContainerEnchantment)

Ported from the unchanged 1.7.10 classes. Obfuscated names come from `joined-1.7.10.srg`. Code: `src/enchantments.js`, a standalone module. It is **not** wired into `main.js`, combat, mining, the GUI or saves yet. Tests: `src/enchantments.test.js`. Evidence: `public/research/enchantment-reference.json`, written by `tools/verify-enchantments.mjs` from `tools/probes/EnchantmentProbe.java`. This covers enchantment rules and the table's server logic only. Full parity is not claimed.

## Evidence

The probe loads the unchanged client classes after `Block`/`Item` registration and runs them in a JVM. The test doubles are:
- a constructor-less `World` (`ahb`), whose `getBlock` reads a 5x2x5 fixture around the table; `isAirBlock` stays native
- a constructor-less `EntityPlayer` (`yz`) carrying only the experience fields and capabilities
- a constructor-less `EntityLivingBase` (`sv`) exposing the held item, the last-active items and the creature attribute

The static `EnchantmentHelper` Random and the container Random are reseeded by reflection. Every case's inputs are printed with its result. After each case, the record also holds the RNG's next `nextInt()`, so the test proves the same number of draws was consumed.

| Records | Count | What |
| --- | --- | --- |
| registry | 24 | ID, class, name, weight, min/max level, type, min/max enchantability for levels 0..max+1, compatibility with every other ID, living modifier per attribute (levels 0-7), protection damage modifier per source (levels 0-7) |
| types / bookList / sources | 11 / 24 / 22 | EnumEnchantmentType order, `enchantmentsBookList`, DamageSource flags |
| items | 315 | every registered item: kind, armour type, enchantability, max damage, `canEnchantItem` per type, `canApply` per enchantment |
| variants | 18 | item-stack variants: counts, damage, unbreakable, enchanted or not |
| slots | 1012 | `calcItemStackEnchantability` (slot 0-2, 0-30 shelves, seeded) |
| maps | 1332 | `mapEnchantmentData` results in HashMap iteration order |
| build | 2036 | `buildEnchantmentList` (156 null results, 927 with more than one enchantment) |
| addRandom | 84 | `addRandomEnchantment`, including books |
| table | 260 | `ContainerEnchantment` sequences: put, enchant, replace and remove. 460 enchant clicks, 159 accepted, 31 of them books turned into enchanted books. 7 remote worlds, 24 creative players. Random shelf fixtures with blockers. |
| damage / living | 400 / 296 | `getEnchantmentModifierDamage` (armour sets, every source, static Random) and `getEnchantmentModifierLiving` |
| getters | 240 | knockback, fire aspect, respiration, efficiency, silk touch, fortune, luck, lure, looting, aqua affinity, fire-protection ticks, blast knockback, `func_92099_a` |
| unbreaking / negate / thorns | 500 / 288 / 140 | `ItemStack.attemptDamageItem`, `EnchantmentDurability.negateDamage`, thorns hit and damage rolls |
| nbt | 120 | `getEnchantments`, `setEnchantments`, `ItemEnchantedBook.addEnchantment`, `ItemStack.addEnchantment` (byte cast) |

That is 7,087 records (587 KB) from JVM 19.0.1. The JSON stores the client JAR's SHA-1, the SRG's SHA-256 and the SHA-256 of all 31 class files used: `aft`, `afu`, `afv`, `agc`, `aag`, `aah`, `aai`, `acm`, `abk`, `add`, `adb`, `qv`, `ro`, the 16 enchantment subclasses, `yz` and `ahb`. `node --test src/enchantments.test.js` replays every record exactly: integers and floats are equal, and stacks, lists and RNG states are identical.

## What is ported
- **Registry**: all 24 enchantments (IDs 0-7, 16-21, 32-35, 48-51, 61, 62). Each has its weight, level range, min/max enchantability formula and EnumEnchantmentType. `canApplyTogether` covers the protection family (feather falling excepted), the damage family and silk touch vs fortune; everything else defaults to "different IDs combine".
- **Items**: `ITEM_ENCHANTING` holds enchantability and max damage per original item ID: armour by material, tools and swords by tool material, bow 1, fishing rod 1, book 1. Type checks follow the originals: books accept everything, shears and other damageables take only Unbreaking, and axes are `digger`, not `weapon`.
- **EnchantmentHelper**:
  - `calcItemStackEnchantability`: shelves clamp to 15, using the original integer expressions.
  - `mapEnchantmentData`: uses the type check, not `canApply`.
  - `buildEnchantmentList`: float jitter rounded with `Math.fround`, then `f2i` truncation. Weighted picks use `WeightedRandom`, and incompatible entries are removed while iterating.
  - `addRandomEnchantment`: books become enchanted books with stored enchantments.
  - Protection points capped at 25 and then halved with the random top-up, plus the living damage modifier and every level getter.
- **Java HashMap order**: the candidate map iterates in Java 8+ `HashMap<Integer,…>` bucket order (bucket = id & (capacity-1), resizing from 16). This order decides which weighted pick wins.
- **ContainerEnchantment**:
  - The bookshelf scan is the 8 neighbours with two air blocks, counting diagonal side cells, at table height and one above.
  - The slot levels and the client-only `nameSeed` draw.
  - `enchantItem`: the player needs the level (or Creative), and the cost is taken through `addExperienceLevel(-cost)`. A book with more than one enchantment loses one random entry. The stack count is clamped to the table inventory's limit of 1.
- **Durability**: Unbreaking's skip chance (armour uses the 0.6 check), unbreakable stacks, the break test.

## Not ported / open items
- **Table GUI**: `GuiEnchantment`, the three button costs, the enchanting book model and the `EnchantmentNameParts` galactic text. `nameSeed` is kept but only cosmetic.
- **Costs**: 1.7.10 has **no lapis lazuli cost and no per-player XP seed**. Both arrived in 1.8. The table charges whole XP levels from its own container Random, rerolled whenever the slot changes. Do not add lapis.
- **Anvils**: `ContainerRepair` (combining, repair cost, prior-work penalty, renaming, "Too Expensive!") is not ported. `canApply` is ported because the anvil needs it.
- **Rendering**: glint on items, armour and enchanted books is not ported, and neither are tooltips with roman numerals or translated names (only the `enchantment.*` keys).
- **Applying effects**: nothing is wired yet. Missing:
  - combat: Sharpness/Smite/Bane damage, Knockback motion, Fire Aspect ignition, Bane slowness, Thorns damage to attackers, armour protection in damage handling
  - mining: Efficiency, Silk Touch, Fortune drops, Aqua Affinity
  - other: Respiration air, Feather Falling, Looting drops, fishing Luck/Lure, bow Power/Punch/Flame/Infinity, Unbreaking in the item-damage paths
  
  Only the RNG decision helpers for thorns, bane and fire protection are recorded. Their entity side effects were not probed.
- **Persistence and commands**: the stack shape in saves and `/enchant` are not done.
- **Deviations and assumptions**:
  - HashMap order is that of the recording JVM. Java 6/7 used a different hash spreader, so a 2014-era JVM could order candidates differently.
  - An empty `enchantments` array is treated as "no tag". The original treats an empty `ench` list as enchanted, but that never arises from normal play.
  - Setting an unregistered ID on an enchanted book throws here. The original throws a NullPointerException there too, and it was not recorded.
