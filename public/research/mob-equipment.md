# Mob equipment (0.22.x)

Zombies, zombie pigmen, skeletons and wither skeletons spawn with 1.7.10's equipment. Worn armour protects them, the held weapon hits harder, a skeleton's bow shapes its arrows, a killed mob drops what it carries by the original's chances, and a mob with `canPickUpLoot` takes better items off the ground. This does not claim full parity: see Gaps.

## Evidence

`tools/probes/EquipmentProbe.java` and `tools/verify-mob-equipment.mjs` run the unchanged 1.7.10 classes (`EntityLiving` sw, `EntityLivingBase` sv, `EntityMob` yg, `EntityZombie` yq, `EntityPigZombie` yh, `EntitySkeleton` yl, `EntityItem` xk, `EntityArrow` zc, `EnchantmentHelper` afv) and write [mob-equipment-reference.json](mob-equipment-reference.json): 10,936 records with the client jar's SHA-1 and each class's sha256. `src/mob-equipment.test.js` replays every record. Run it with `MC_RESEARCH=<tools/research> node tools/verify-mob-equipment.mjs` (needs a JDK).

| Case | Records | What is checked |
| --- | --- | --- |
| spawn | 5,760 | `onSpawnWithEgg` of a zombie, pigman, skeleton and Nether skeleton at difficulty 1 to 3, four local difficulties, two dates (a normal day and October 31), 60 seeds: every stack, drop chance, pickup flag, follow range, attack and armour value, and the next value of both random streams |
| armor | 864 | `damageEntity`: armour points, then enchantment protection, and the enchantment random |
| attack | 168 | the attack attribute with the weapon's modifier, and `attackEntityAsMob`'s Sharpness, Smite, Bane of Arthropods, Knockback and Fire Aspect |
| arrow | 144 | a skeleton's arrow: damage, Punch knockback and fire for Power, Punch and Flame bows |
| drop | 1,440 | `dropEquipment` with looting, the damage roll, and `getExperiencePoints` |
| pickup | 2,560 | the pickup loop's swap rules, the old item's drop roll, the drop chance of 2.0 and persistence |

## What the original does

- **Armour tier.** `func_82161_a` orders the tiers leather, gold, chainmail, iron, diamond (not the item-id order). The spawn roll (`bC`): with chance 0.15 x local difficulty a mob wears armour. The tier is `nextInt(2)` plus one for each of three 0.095 rolls; pieces fill from the helmet down, and after the helmet each further piece stops the chain with chance 0.25 (0.1 on Hard). Armour points per piece (helmet, chestplate, leggings, boots): leather 1, 3, 2, 1; chainmail 2, 5, 4, 1; iron 2, 6, 5, 2; diamond 3, 8, 6, 3; gold 2, 5, 3, 1.
- **Enchantments (`bD`).** The held item at 0.25 x local difficulty, then each armour piece (boots up) at 0.5 x local; the level is `trunc(f(5 + f(local * nextInt(18))))` into `EnchantmentHelper.addRandomEnchantment`, so the same enchantment table as the enchanting table (`src/enchantments.js`).
- **Held items.** A zombie has a 1% (5% on Hard) chance of an iron sword (1 in 3) or an iron shovel; a pigman a golden sword; a skeleton a bow; in the Nether a skeleton is a wither skeleton with a stone sword and no armour or enchantments 4 in 5 times. Skeletons wear armour like zombies.
- **Attack.** The held item's attribute modifier adds to the mob's attack attribute from any slot: a sword is 4 plus the tier's damage (wood 0, stone 1, iron 2, diamond 3, gold 0), a shovel 1, a pickaxe 2, an axe 3, plus the tier. A zombie (3) with an iron sword hits for 9, a pigman (5) with its golden sword 9, a wither skeleton (4) with a stone sword 9. `attackEntityAsMob` then adds Sharpness (1.25 per level), Smite and Bane (2.5), applies Knockback and sets the target alight for 4 s per Fire Aspect level (160 ticks at level 2).
- **Arrows.** Power adds 0.5 x level + 0.5 damage, Punch sets the knockback, Flame or a wither skeleton gives fire 2000.
- **Armour.** `damageEntity` takes the armour first, `f(f(amount x (25 - armour)) / 25)`, where a zombie or pigman counts 2 natural points plus what it wears (at most 20) and a skeleton only what it wears. Armour does not apply to generic damage. Enchantment protection follows over all five stacks, with `EnchantmentHelper`'s shared Random.
- **Halloween.** On October 31, a mob with an empty helmet slot has a quarter chance of a pumpkin (a tenth of those a jack-o'-lantern), and its helmet drop chance becomes 0.
- **Drops.** Each slot has a 0.085 drop chance (0 for a Halloween head). `dropEquipment` goes slot by slot: only a player kill (or a chance above 1) can drop; the roll is `f(nextFloat() - 0.01 x looting) < chance`; at a chance of at most 1 a damageable item is damaged `clamp(1, max - 25, max - nextInt(nextInt(k) + 1))`. An item the mob picked up has chance 2.0 and drops whole. The experience is 5 plus 1 + nextInt(3) per stack with a chance of at most 1.
- **Pickup.** With `canPickUpLoot` (0.55 x local difficulty at spawn) a mob checks every item entity within its box grown by (1, 0, 1), under gamerule `mobGriefing`. A sword replaces a non-sword; two swords compare the attack modifier, then damage, then a tag; armour replaces a non-armour item or a lower armour value (then damage, then a tag); a pumpkin counts as a helmet. The replaced stack drops with `f(nextFloat() - 0.1) < chance`. The mob keeps the whole stack, sets that slot's drop chance to 2.0 and becomes persistent (no despawn).

## In the game

- `src/mob-equipment.js` has the rolls, tables, drops and pickup rules, free of item registries, so `src/difficulty.js` can import it. `zombieSpawnRolls` and `skeletonSpawnRolls` return every stack, chance and pickup flag in the original's order, with no `diverged` cut; the replay ends on the original's entity and world random streams.
- `src/mob-equipment-live.js` converts the native stacks (original item ids, kept in `equipment` so the enchantment code reads them directly) to the browser's item ids, gives each type its constructor gear, restores saves, and runs the pickup loop on `ItemEntities`.
- `entities.js`: `onSpawnWithEgg` applies the rolls (the Halloween date comes from `world.currentDate()` in tests); `damageEntity` adds worn armour and protection; `hitPlayer` and `hitMob` add the weapon's modifier, Sharpness and Fire Aspect, and `hitMob` Knockback; `onDeath` forwards enchantments with each dropped item; `lootPickup` runs each tick for mobs with `canPickUpLoot`. `bow.js` applies Power, Punch and Flame to a skeleton's arrows. `combat.js` computes the armour and the drops and experience.
- `src/mob-equipment-renderer.js` draws the worn armour with the player's armour textures on the head, body, arms and legs of zombies, pigmen and skeletons, the held item in the right hand, and a Halloween pumpkin on the head, replacing the pigman's fixed sword and the skeleton's fixed bow.
- **Saves.** The browser save keeps `equipment` (five native stacks, slot 0 the hand, 1 boots to 4 helmet, with enchantments), `dropChances` and `canPickUpLoot` for these four types. A save from before this change gets the type's constructor gear: the pigman's saved `held` becomes its golden sword, a skeleton its bow, a wither skeleton its stone sword, a zombie nothing.

## Gaps

- **Java save interchange.** `region-export.js`, `region-import.js` and `java-mobs.js` do not yet write or read `Equipment`, `DropChances` or `CanPickUpLoot`; a mob exported to Anvil and imported again loses its gear and gets the constructor gear. These files belong to other work and were left alone.
- **Knockback from a mob's weapon on the player.** The port knocks no player back from mob melee yet, so only Sharpness and Fire Aspect (and all of it against other mobs) apply to the player. Knockback applies when a mob hits a mob.
- **Mob-versus-mob Sharpness types.** `hitMob` uses the undefined creature type, so Smite and Bane do not add against undead or arthropods.
- **Wither skeleton type roll.** `dimension-spawning.js` picks wither or ordinary skeleton on its own random before the entity exists. `skeletonSpawnRolls` takes that type and still draws and drops the original's `nextInt(5)` in the Nether, so the entity stream matches but the chosen type does not come from it.
- **Rendering.** The enchantment glint and leather dye are not drawn on mobs. Zombie villagers wear no armour in the model. A mob's helmet is not drawn when the browser has no block atlas. A zombie's armour does not follow the villager rig's taller head.
- **Held item damage.** Mob weapons and armour never wear out from use; only the drop roll damages them.
- **Other rolls** remain as in [difficulty](difficulty.md): the jockeys, door breaking and the leader's extra health are now live: see [mob-riding](mob-riding.md).
