# Minecraft Java 1.7.10 feature coverage

The target is the complete Java 1.7.10 feature set. **This build does not yet provide full parity.** “Implemented” below means a working browser implementation with the limitations stated; it does not mean original-client equivalence.

## Working systems

| System | Current browser implementation | Remaining differences |
| --- | --- | --- |
| Movement | 20 Hz controller, jumping, sprinting, gravity, collision, swimming, Creative flight | Simplified collision, stepping, water behavior, float arithmetic and camera effects |
| Survival health | 20 health, fall damage, drowning, death, respawn | Armor, combat, fire/lava, status effects, full damage rules and difficulty selection |
| Hunger | Food, saturation, exhaustion, natural regeneration, Normal-difficulty starvation | Seven isolated original-bytecode cases verified; other player/world interactions remain partial |
| Inventory | Collected resources, hotbar, stack caps, per-tool durability, saving | Native-looking inventory sheet; aggregate storage still differs from Java's 36-slot container/cursor implementation |
| Mining | Java-float break progress, recovered effective tools/harvest tiers, water/air penalties, instant breaks and correct wear; 2,640 original-tool cases verified | Not all block/tool combinations, enchantments, animations or item entities |
| Crafting | 2 × 2 and workstation 3 × 3 grids; shaped recipe offsets and mirroring; 43 recipes | Complete vanilla recipe registry, remaining shapeless/special recipes, shift crafting, full cursor/slot UI semantics |
| Tools | Wooden, stone, iron, diamond and gold pickaxes, axes, shovels, swords and hoes; shears and durability | full combat mechanics, repair, enchantments |
| Furnace | Input/fuel/output storage, 200-tick smelting, coal/charcoal/wood/stick fuel, persistent progress | Hoppers, original cursor/container semantics, complete fuel/recipe set |
| Death drops | Recoverable inventory piles, 6,000-tick lifetime, save/reload | Simplified pile rendering/pickup, no individual stack entity physics |
| World | Custom caves and coal/iron/gold/diamond ores; fixed 128 × 128 × 64 terrain | Original noise generator, infinite chunks, 256-block build height, Java seed compatibility |
| Lighting | 24,000-tick day, sun/moon, dusk/night, nearby torch lights | Native 0–15 block/skylight propagation, weather and renderer parity |
| Blocks | 40 internal block states including air, water, bedrock, dry/wet farmland, eight wheat stages and tall grass | Original registry contains 171 base registrations, plus metadata variants and behaviors |
| Textures / HUD | Original block face textures, biome colormaps, item sprites, hearts, hunger, bubbles, crosshair, hotbar, sun and eight moon phases; entire 941-PNG texture tree preserved | Many imported textures belong to features still unimplemented; renderer and menus remain adapted |
| Farming | Five hoe tiers, tilled soil, moisture, water radius four, wheat planting/eight growth stages, bone meal, wheat/seed drops and bread | Approximate light and random-tick sampling; no trampling, full block-support updates, other crops or remaining animal breeding |
| Animation / audio | First-person hand/item animation, view bob, eating, cracks, debris, animated water; 135 original sound clips | Not all original animations/effects; adapted transforms, simplified particles and stereo positioning |
| Creatures / combat | Pigs, cows, night-time zombies, melee hits, food drops, persistent health, simple wandering/chasing | Simplified AI/spawning/combat; cow wheat attraction/breeding and calves; no pig breeding, ranged attacks, full pathfinding or complete mob roster |
| Experience | Original 1.7.10 level costs, points/level HUD, XP orbs and attraction, ore/smelting/kill/breeding rewards, death loss/drop and persistence | No enchanting/anvil XP spending; approximate orb physics, entity reward eligibility and pickup timing |
| Menus / UI | Original title artwork, button sprites, traced original bitmap font, inventory/workbench/furnace sheets, pause menu and 1.7.10 death screen | Browser controls, settings and aggregate inventory/crafting interactions still differ; menus are reimplementations |
| Food | Apples, bread, raw/cooked pork, raw beef/steak, rotten flesh; 32-tick eating | Remaining foods, exact presentation and status effects |
| Persistence | World edits, mode, health/hunger, resources, tools, furnace progress, clock, hotbar, XP/orbs, animal age/love timers, soil moisture, crops and death piles | Original Anvil region files, NBT interoperability and migrations between Java versions |

## Systems not yet implemented or still incomplete

- Complete block and item registries, metadata variants, block shapes, fluids and block update rules.
- Full mob roster, original spawning/AI/pathfinding, remaining animal breeding, bosses, ranged combat and advanced entity interactions. Pigs, cows and zombies have a basic implementation; cows can breed with wheat.
- Remaining crops/plant growth, saplings, leaf decay, fishing and animal-derived resources. Wheat farming is now implemented with the limits above.
- Armor, enchanting, brewing, potions, status effects, hunger/damage difficulty variants.
- Redstone, circuits, pistons, rails, minecarts, boats, mechanisms and inventories such as chests/hoppers.
- Original biomes, world generation, structures, villages, dungeons, weather, Nether and End.
- Java multiplayer protocol/server compatibility, authentication, LAN play and server management.
- Java save compatibility, commands, gamerules, achievements/statistics, resource packs and mod support.
- Complete animation and rendering parity, remaining sound events, music, remaining menu and GUI behavior. Selected original media and recovered animation curves are now present; see [animation and audio](animations-and-sounds.md).

## Evidence

- [Original base block registry](block-registry-1.7.10.json): all 171 ID/name pairs extracted from the original registration method. This inventory does not imply these blocks are implemented.
- [Original FoodStats reference outputs](foodstats-reference.json): seven boundary scenarios from the unchanged original class, run with minimal test doubles for its world/player dependencies. The JavaScript results agree within 1e-6 for all 28 numeric comparisons.
- [Investigation](investigation.md): target integrity, REA inventory, mapped symbols, bytecode locations and known limits.

Existing pre-update worlds keep generation version 1. Version 2 worlds preserve their caves and ores. New worlds use generation version 3, adding tall grass for seed collection. The generation version travels with exports so old edits do not shift onto different terrain.

[Mining and layout evidence](mining-and-layout.md) records the 0.6 corrections, exact container/count coordinates and original-tool checks. Shears, snowball/flint/book drops and three additional recipes extend the implemented content.
