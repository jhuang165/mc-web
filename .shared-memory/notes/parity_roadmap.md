# Full vanilla Java 1.7.10 parity roadmap

Accepted by the owner on 2026-11-01; instruction: save the roadmap and start the highest-priority work. Baseline: app 0.22.0, commit 2f845f0. Full parity remains unfinished. Prioritize reported correctness issues, then measurable coverage, nearby existing-system gaps, and architecture before broad additions. No Site publication requested; localhost remains the development target.

## Definition and tracking

Full parity covers vanilla Java 1.7.10 gameplay, world generation, presentation, saves and multiplayer. Forge/mod compatibility is a separate scope. Maintain public/research/parity-roadmap.md as the executable tracker and public/research/parity.md as current coverage. Track missing, partial, implemented and verified separately; isolated probe success never establishes whole-game equivalence. Evidence categories: original-class execution, bytecode inspection, browser observation and port regression tests. Inventory every original block/metadata variant, item, recipe, entity, biome, structure, GUI, command and gamerule. The 171 original base block registrations cannot be compared directly with internal state IDs. Reference seeds, worlds, scripts and fixed screenshots define acceptance.

## Dependency-ordered work

1. Measurable parity checklist. Enumerate the complete target catalogue, attach status, dependencies, acceptance criteria and evidence; reconcile stale documentation. Done when every vanilla feature has a status and testable acceptance criteria. The first tracker can be a clearly marked work-package scaffold; exhaustive catalogue extraction remains open until actually complete.

2. World/simulation foundations. Replace fixed 128 x 128 x 64 arrays and edge clamps with streamed chunks, negative coordinates and 256-block height; loading/unloading, chunk/entity ownership, scalable saving. Generalize metadata, tile entities, entity IDs, attributes and item NBT. Match scheduled/random ticks, neighbor updates, ordering and Java random streams. Preserve pending work on save. Separate authoritative simulation from rendering/input for multiplayer reuse. Migrate old worlds without shifting edits. Gate: movement, lighting, fluids, entities and saving across boundaries without load-order differences.

3. Player/survival/combat. Finish entity pushing/collision and water edge cases; damage sources, hurt resistance, armor, knockback, attribution and reward eligibility; all difficulties; beds/sleep/spawn/respawn; Adventure/Hardcore; blocking, equipment, use/reach rules; foods, effects and presentation. Gate: scripted survival cases match original ticks, including reloads.

4. Ordinary content/resource acquisition. Complete ores/materials/drops; all wood, leaves, saplings/tree variants; slabs/stairs/fences/gates/walls/doors/trapdoors/panes/bars; plants/mushrooms/crops/vines/cocoa/double plants; glass/clay/snow/ice/decorative variants; beds/signs/paintings/item frames/books/maps; foods/fishing/tools/utilities; all shaped/shapeless/special/smelting recipes; Creative ordering/search/pick-block. Each block includes placement, metadata, bounds, support, light, mining/drops, sound, rendering and persistence. Gate: full ordinary Overworld catalogue in Creative and Survival.

5. Storage/mechanisms/redstone. Trapped/ender chests, hoppers/dispensers/droppers; dust connections/propagation/update ordering; torches/repeaters/comparators/blocks; switches/plates/tripwire/daylight sensors; pistons/moving collision; powered doors/lamps/TNT; note blocks/jukeboxes; transfers/cooldowns/comparator output/state. Gate: reference circuits, clocks, pistons, sorters and furnace automation including boundaries/reload.

6. Progression. Enchanting/bookshelf power/selection/applicability; all enchantment effects; anvils/repair/combine/rename/costs/degradation; brewing/ingredients/recipes/splash potions; effects/attributes/stacking/particles; beacons/pyramids/range; leather dyeing/books/glint. Gate: original equipment/potion progression, costs and outcomes.

7. Mobs/spawning/interactions. Remaining passive/tameable/aquatic/ambient/hostile/utility roster; villagers/trading/villages/golems; breeding/taming/ownership/riding/saddles/leads/equipment; cave spiders/jockeys/variants/difficulty effects; categories/caps/chunk eligibility/light/biomes/packs/despawn; existing navigation/wandering/daylight/targeting differences; loot/XP/sounds/animation/persistence. Gate: individual scenarios and population behavior in reference worlds.

8. Java generation. Original seed parsing/random/call order, biome layers/noise, all Overworld biomes/variants, surfaces/caves/ravines/ores/lakes/springs, trees/decorators/snow/ice; villages/mineshafts/strongholds/dungeons/temples/other original structures, loot/population; original world types/options. Gate: matching sampled blocks/biomes/structures for reference seeds under different chunk-generation orders.

9. Dimensions/endgame. Nether and End generation/lighting/sky/fog/environment; Nether portal creation/search/scaling/travel; fortresses/resources/mobs; pearls/eyes/strongholds/End portals; End islands/pillars/crystals/dragon; Wither; dimension saves/travel/respawn; credits/return. Gate: fresh Survival to dragon and Wither without developer intervention.

10. Vehicles/entities. Boats, all minecart variants, rails/powered/detector/activator behavior; mounting/dismount/passengers/collision; fishing hooks/outcomes; remaining projectile/special entities; portal/blast/redstone/container/unloading combinations. Gate: transport and contraption reference cases including edge conditions.

11. Java saves. NBT/Anvil/chunk sections/metadata; tile entities/entities/inventories/attributes/tags; world/player/dimension/map/scoreboard/tick data; 1.7.10 import/export; scalable storage/recovery replacing edit caps. Gate: browser -> Java -> browser round trips preserve supported state.

12. Multiplayer. Design simulation boundaries in phase 2. Implement 1.7.10 packets/metadata/chunks; authority/sync/correction; inventory transactions/combat/tracking; chat/player lists/permissions/server selection/disconnect; authentication/session integration/server administration; browser-to-Java transport bridge; LAN/hosting companion infrastructure. Gate: multiple browser clients and Java clients where compatibility is claimed sharing persistent authoritative worlds.

13. Commands/menus/presentation (continuous work). Commands/selectors/gamerules/scoreboards/teams/stats/achievements; world menus/settings/controls/chat/debug/container/server screens; fire overlay/all particles/settings/shared pools; animations/poses/glint/entities; void fog/graphics/transparency/lighting; sound/positioning/ambient/music/records; resource packs. Gate: fixed scenes/interactions match supported settings, documented unavoidable browser differences.

14. Integrated acceptance. Differential original-class tests; long deterministic integrated scenarios; seed/structure comparisons; fixed screenshots/audio; Java save/network/reconnect tests; performance/memory/streaming/long sessions; fresh Survival and Creative runs. Gate: all catalogue criteria pass, with no unlabelled approximations.

## Immediate execution order

A. Persist roadmap, create work-package tracker, reconcile stale docs. B. Close confirmed existing-system persistence gaps: scheduled fluid/fire delays and import/export state. C. Particle settings/shared pools and remaining collision/damage rules. D. Chunk storage, generalized registry/NBT and simulation boundaries. E. Content/containers, redstone/progression/mobs/generation, then dimensions/interoperability/final acceptance. Estimate dates after breaking foundation tasks down; do not invent completion percentages.

Correction discovered during implementation: EntityTNTPrimed.writeEntityToNBT intentionally does not save the placer in Java 1.7.10 (src/main.js and public/research/creepers.md record this). Preserve that native behavior; do not treat owner persistence as a parity defect without contrary original evidence.
