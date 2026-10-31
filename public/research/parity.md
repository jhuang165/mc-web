# Minecraft Java 1.7.10 feature coverage

The target is the complete Java 1.7.10 feature set. **This build does not yet provide full parity.** “Implemented” below means a working browser implementation with the limitations stated; it does not mean original-client equivalence.

## Working systems

| System | Current browser implementation | Remaining differences |
| --- | --- | --- |
| Movement | 20 Hz controller, jumping, sprinting, gravity, collision, swimming, Creative flight | Simplified collision, stepping, water behavior, float arithmetic and camera effects |
| Survival health | 20 health (float, as in Java), fall damage, drowning, death, respawn; armor reduces mob damage | Combat, fire/lava, status effects, full damage rules and difficulty selection |
| Hunger | Food, saturation, exhaustion, natural regeneration, Normal-difficulty starvation | Seven isolated original-bytecode cases verified; other player/world interactions remain partial |
| Inventory | Java 36-slot `InventoryPlayer`, four armor slots and a cursor; per-stack counts and damage; `Container.slotClick` modes 0–6 and `GuiContainer` drags, double-clicks, hotbar/drop keys; single and large chests (`ContainerChest`, `InventoryLargeChest`); 61 cases match the original classes ([inventory](inventory.md)). The creative screen is the `GuiContainerCreative` tab GUI: original tab order and contents (checked against the original classes), scrolling, search, `handleMouseClick` copy rules and the survival inventory tab with the Destroy Item slot ([creative](creative.md)) | Creative tabs list only implemented items; trapped/ender chests, hoppers, dispensers and other storage |
| Mining | Java-float break progress, recovered effective tools/harvest tiers, water/air penalties, instant breaks and correct wear; 2,640 original-tool cases verified | Not all block/tool combinations, enchantments or animations |
| Crafting | 2 × 2 and workstation 3 × 3 slot grids; shaped recipe offsets and mirroring; result pickup, shift-crafting and tool repair as in `SlotCrafting`/`CraftingManager`; 60 recipes | Complete vanilla recipe registry and the remaining shapeless/special recipes |
| Tools | Wooden, stone, iron, diamond and gold pickaxes, axes, shovels, swords and hoes; shears; per-stack durability that breaks past the maximum; repair by combining; durability bars and F3 + H durability tooltips | Full combat mechanics, anvils and enchantments |
| Furnace | Original slot container, any item by hand in input/fuel, 200-tick smelting, original flame/arrow sprites, persistent progress; fuel times and smelting results checked against the original classes for every mapped item | Hoppers; recipes for unimplemented items |
| Item drops | Broken blocks, mob kills, thrown stacks, death drops and spilled chests/furnaces become `EntityItem` entities with original spawn offsets, pickup delays, gravity, drag, bounce, push-out, merging, 6,000-tick despawn, pickup box and `EntityPickupFX` flight; see [items](items.md) | No water push, lava burning, hoppers or item frames; collision uses simplified block boxes |
| World | Custom caves and coal/iron/gold/diamond ores; fixed 128 × 128 × 64 terrain | Original noise generator, infinite chunks, 256-block build height, Java seed compatibility |
| Lighting & sky | 0–15 sky/block light propagation with original opacities, the `updateLightmap` lightmap with torch flicker and Brightness option, smooth lighting/AO, `renderSky` sky, void plane, sunrise fan, sun, moon phases and seeded stars, `setupFog` linear/underwater fog, fancy clouds, liquid corner heights with still/flowing textures, item lighting on entities, lit item drops; see [lighting](lighting.md) | Void fog, weather, Fast graphics, entity shadows and the fire overlay; light updates relight areas instead of the original queue |
| Entity shadows | `Render.renderShadow` (Fancy graphics) for items, XP orbs, pigs, cows and zombies: original sizes/opacities, 16-block distance fade, height fade, block-light brightness, `renderAsNormalBlock` surfaces from probe evidence | No player shadow (no third-person view); orbs and mobs are not interpolated between ticks |
| Blocks | 42 internal block states including air, water, bedrock, dry/wet farmland, eight wheat stages, tall grass, hardened clay and chests | Original registry contains 171 base registrations, plus metadata variants and behaviors |
| Textures / HUD | Original block face textures, biome colormaps, item sprites, hearts, hunger, bubbles, crosshair, hotbar, sun and eight moon phases; entire 941-PNG texture tree preserved | Many imported textures belong to features still unimplemented; renderer and menus remain adapted |
| Farming | Five hoe tiers, tilled soil, moisture, water radius four, wheat planting/eight growth stages, bone meal, wheat/seed drops and bread | Approximate light and random-tick sampling; no trampling, full block-support updates, other crops or remaining animal breeding |
| Animation / audio | First-person hand/item animation, view bob, eating, cracks, debris, animated water; 135 original sound clips | Not all original animations/effects; adapted transforms, simplified particles and stereo positioning |
| Creatures / combat | Pigs, cows, night-time zombies, melee hits, food drops, persistent health, simple wandering/chasing | Simplified AI/spawning/combat; cow wheat attraction/breeding and calves; no pig breeding, ranged attacks, full pathfinding or complete mob roster |
| Experience | Original 1.7.10 level costs, points/level HUD, XP orbs and attraction, ore/smelting/kill/breeding rewards, death loss/drop and persistence | No enchanting/anvil XP spending; approximate orb physics, entity reward eligibility and pickup timing |
| Menus / UI | Original title artwork, button sprites, traced original bitmap font, inventory/workbench/furnace sheets, pause menu and 1.7.10 death screen | Browser controls, settings and aggregate inventory/crafting interactions still differ; menus are reimplementations |
| Armor | Leather, chain, iron, gold and diamond pieces with original defense, durability and recipes; armor slots, right-click equip, HUD armor bar, cows drop leather | Armor rendering on the player, dyes, enchantments, pumpkins/skulls as helmets |
| Food | Apples, bread, raw/cooked pork, raw beef/steak, rotten flesh; 32-tick eating | Remaining foods, exact presentation and status effects |
| Persistence | World edits, mode, health/hunger, 36 inventory slots, armor, furnace stacks, clock, selected slot, XP/orbs, animal age/love timers, soil moisture, crops and item entities; pre-0.7 saves migrate | Original Anvil region files, NBT interoperability and migrations between Java versions |

## Systems not yet implemented or still incomplete

- Complete block and item registries, metadata variants, block shapes, fluids and block update rules.
- Full mob roster, original spawning/AI/pathfinding, remaining animal breeding, bosses, ranged combat and advanced entity interactions. Pigs, cows and zombies have a basic implementation; cows can breed with wheat.
- Remaining crops/plant growth, saplings, leaf decay, fishing and animal-derived resources. Wheat farming is now implemented with the limits above.
- Enchanting, brewing, potions, status effects, hunger/damage difficulty variants; armor rendering on the player.
- Redstone, circuits, pistons, rails, minecarts, boats, mechanisms and storage containers such as trapped/ender chests, hoppers and dispensers.
- Original biomes, world generation, structures, villages, dungeons, weather, Nether and End.
- Java multiplayer protocol/server compatibility, authentication, LAN play and server management.
- Java save compatibility, commands, gamerules, achievements/statistics, resource packs and mod support.
- Complete animation and rendering parity, remaining sound events, music, remaining menu and GUI behavior. Selected original media and recovered animation curves are now present; see [animation and audio](animations-and-sounds.md).

## Evidence

- [Original base block registry](block-registry-1.7.10.json): all 171 ID/name pairs extracted from the original registration method. This inventory does not imply these blocks are implemented.
- [Original FoodStats reference outputs](foodstats-reference.json): seven boundary scenarios from the unchanged original class, run with minimal test doubles for its world/player dependencies. The JavaScript results agree within 1e-6 for all 28 numeric comparisons.
- [Original inventory/container reference outputs](inventory-reference.json): 60 scripted click, crafting, furnace, chest and armor cases plus fuel/smelting results for every mapped item, from the unchanged original classes. The JavaScript port matches all 61, including eight chest and large-chest cases. See [inventory](inventory.md).
- [Investigation](investigation.md): target integrity, REA inventory, mapped symbols, bytecode locations and known limits.

Existing pre-update worlds keep generation version 1. Version 2 worlds preserve their caves and ores. New worlds use generation version 3, adding tall grass for seed collection. The generation version travels with exports so old edits do not shift onto different terrain.

[Mining and layout evidence](mining-and-layout.md) records the 0.6 corrections, exact container/count coordinates and original-tool checks. Shears, snowball/flint/book drops and three additional recipes extend the implemented content.
