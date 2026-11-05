# Horse gear: inventory screen, leads, name tags, jump bar (Minecraft Java 1.7.10)

Evidence: `tools/probes/HorseGearProbe.java` runs the unchanged original classes (`aam` ContainerHorseInventory, `aan`/`aao` slots, `zt` AnimalChest, `wi` EntityHorse, `sw`/`td` leash code, `adf` ItemLead, `su` EntityLeashKnot, `adm` ItemNameTag, the CraftingManager lead recipe) on the HorseProbe world double. `tools/verify-horse-gear.mjs` writes `public/research/horse-gear-reference.json` (client sha1 e80d9b3b...). Record counts: container 7, slotValid 98, transfer 80, usable 12, drops 4, leash 24, leashHolderDead 1, leashUse 16, unleash 2, knot 10, knotNoFence 1, knotClick 4, nameTag 30, recipe 1, itemIds 1. `src/horse-gear.test.js` replays them.

## Horse screen (GuiScreenHorseInventory, horse.png)

- Opens with the inventory key while riding a saddled tame horse, or with sneak and right-click (the existing "gui" action).
- Slots: saddle (8, 18), armour (8, 36, only a horse), a chested donkey or mule adds 3 x 5 slots at (80 + 18c, 18 + 18r). Player slots at y 84 and 142.
- Saddle slot takes a saddle only when empty; armour slot takes iron, gold or diamond horse armour for a horse only; chest slots take anything. Shift-click goes armour slot, saddle slot, then chest slots; out of the horse goes into the inventory in reverse.
- Usable while the horse is alive and under 8 blocks away. Title "HorseChest" at (8, 6), "Inventory" at (8, 72).
- Contents live in `e.horse.items` (saddle, armour, 15 chest slots); the `saddled` and `armor` flags are derived. A chested horse drops every stack and the chest block on death.
- Chest attach (right-click a donkey or mule with a chest) already existed in the horse track; it now also grows the stack list.
- NBT: `Items` (slots 2 to 16), `ChestedHorse`, `SaddleItem`, `ArmorItem` through region export and import and `/summon`.

## Leads (item 420, internal id 2020)

Recipe 4 string, 1 slimeball gives 2 (checked by `recipe-catalogue.test.js` against the original CraftingManager). Right-click ties a leashable mob (monsters, bats, the dragon refuse); the lead is used up even in Creative; a click by the holder frees it and drops the lead outside Creative. Beyond 6 blocks the mob is pulled by delta times |delta| times 0.4 per unit-vector axis, beyond 10 the lead breaks and drops (both on the same tick). Fence click moves the player's leashed mobs within 7 blocks to a knot. NBT: `Leashed`, `Leash` (X/Y/Z of the knot, or UUIDMost/UUIDLeast for the player).

## Name tags (item 421, internal 375)

Rename at the anvil, right-click a mob: any mob that is not a player, only if the tag has a display name (even empty). It sets `CustomName`, `PersistenceRequired` (named mobs do not despawn) and uses up the tag, also in Creative. Plate shown for `CustomNameVisible` or the mob looked at, under 64 blocks (32 sneaking), not while ridden. Persisted by serialize, region export and import, `/summon` and spawn eggs.

## Jump bar

GuiIngame.renderJumpBar replaces the experience bar while riding a saddled tame horse: icons.png (0, 84) track and (0, 89) fill, fill width (int)(power * 183) of 182 pixels, driven by the existing `jumpPower`.

## Gaps

- Leash path-following between 4 and 6 blocks (td.bL pathing toward the holder) is not ported; only the pull and break rules are.
- The leash catenary, knot box and name plate geometry are the recalled vanilla algorithm and are not bytecode verified or pixel compared.
- Knots are derived from mobs tied to them, not persistent entities; an empty knot never lingers. Knot clicks go through the fence block.
- Fence clicks are intercepted when a lead is held, the player has leashed mobs in range, or a knot exists there; vanilla BlockFence also blocks placing against fences, so this differs slightly.
- Stack tags (enchantments, names) on gear stacks are kept in the list but the screen does not show the horse preview model.
- The ridden horse's health hearts in place of hunger are not drawn.
- The leash holder position uses the player's feet; the leash UUID is not a real entity UUID (single player).
- Nothing was run in a browser; the screen, jump bar and renderer are verified only by unit tests and the build.
