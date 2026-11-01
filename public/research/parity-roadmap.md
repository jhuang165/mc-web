# Vanilla Java 1.7.10 parity roadmap

Owner accepted 2026-11-01. The complete roadmap and rationale are durable shared memory in `.shared-memory/notes/parity_roadmap.md`. This is the execution tracker; [coverage](parity.md) describes current behavior. Full parity remains unfinished. Forge/mod compatibility is outside this vanilla roadmap. Do not infer completion percentages from test counts or registry mappings.

Status: **Missing** = no implementation; **Partial** = some behavior exists; **Implemented** = acceptance behavior works; **Verified** = named evidence passes, limited to its stated scope. Original-class execution, bytecode inspection, browser observation and port-only regression tests are distinct evidence. A work package is complete only when all its criteria pass.

## Immediate backlog

| ID | Priority | Work | Status / acceptance |
| --- | --- | --- | --- |
| PLAN-01 | P0 | Persist full roadmap and link project memory | Implemented; shared `parity_roadmap` note and PROJECT entry |
| PLAN-02 | P0 | Enumerate all original base block IDs conservatively | Implemented: [171-row catalogue](block-parity-catalogue.md), regenerate with `node tools/build-parity-catalogue.mjs`; behavior/metadata audit remains open |
| PLAN-03 | P0 | Expand catalogue to metadata, items, recipes, entities, biomes, structures, GUIs, commands, gamerules | Partial; enumeration packages below have explicit statuses/dependencies/acceptance; semantic feature inventory remains open |
| PLAN-03a | P0 | Original item registrations and Creative subtypes/NBT books | Implemented enumeration: [315 registrations / 606 search entries](item-parity-catalogue.md), 629 audit rows including unlisted items; 167 exact browser listings remain Partial; arbitrary NBT/durability/potion/other semantic variants open |
| PLAN-03b | P0 | Block metadata storage-domain audit | Partial scaffold: [171 block rows](block-metadata-catalogue.md), native Creative item-damage lists and all 16 raw values per registration; classify 2,736 raw combinations as semantic, alias/ignored or invalid/unreachable cases before completion |
| PLAN-03c | P0 | Entity registrations, biome slots and default gamerules | Implemented enumeration: [57 entity IDs](entity-parity-catalogue.md), [61 biome slots](biome-parity-catalogue.md), [9 default gamerules](gamerule-parity-catalogue.md); entity variants/nonregistered entities, biome behavior and rule effects remain open |
| PLAN-03d | P0 | Recipes/smelting, structures, GUIs, commands and remaining semantic variants | Open; extract original registries where available; each remaining feature needs explicit status, dependency, acceptance and evidence |
| SAVE-01 | P0 | Preserve fluid/fire pending delays, block identity and ordering | Implemented; `src/scheduled-ticks.test.js`: JSON round trips, remaining delay, stale blocks, duplicate suppression, equal-time order, overdue entries, malformed data, empty queues and legacy migration |
| SAVE-02 | P0 | Preserve all current runtime fields on export/import | Implemented; `src/world-import.test.js`: weather/projectiles/arrows/TNT/tick queues and existing payload fields survive; subsystem loaders validate on launch |
| SAVE-03 | P1 | Audit other pending work and simulation random streams | Open; falling-block deadlines, player fire counter and random-stream/reload differences; fluid/fire queues remain separate rather than a unified WorldServer queue |
| FX-01 | P1 | Particle options and shared EffectRenderer pools | Open; original spawn filtering, caps and ordering across all particle types |
| PLAYER-01 | P1 | Remaining collision/damage/reward differences | Partial; entity pushing, water, hurt resistance, difficulty and kill eligibility against original scenarios |
| WORLD-01 | P1 | Define chunk and registry interfaces without changing old terrain | Open; negative coordinates, 16x16 chunk sections, 256 height, ID/metadata capacity and legacy migration fixtures |
| WORLD-02 | P1 | Stream chunks with scalable storage | Depends WORLD-01; load/unload/reload preserves blocks, light, entities and pending work at boundaries |
| SIM-01 | P1 | Separate authoritative tick from browser input/rendering | Open; replay input into headless simulation before networking |

TNT placer omission is intentional Java 1.7.10 save behavior (`EntityTNTPrimed.writeEntityToNBT`), not a defect to fix. Recheck original evidence before promoting a documented difference into implementation work.

## Dependency-ordered milestones

| Phase | Scope | Dependencies and exit criteria |
| --- | --- | --- |
| 1. Measurable checklist | Complete feature/variant catalogue, evidence labels, reference worlds/scripts/screenshots, stale-doc reconciliation | In progress; every vanilla feature has explicit acceptance criteria |
| 2. World/simulation foundations | Streamed chunks, negative coordinates, 256 height, chunk/entity ownership, metadata/tile entities/IDs/attributes/item NBT, update order, saved ticks, Java RNG, simulation boundary, old-world migration | PLAN-03 plus incremental work now; boundary/load-order scenarios match without shifting edits |
| 3. Player/survival/combat | Entity collisions, fluids, damage/armor/hurt resistance/knockback/attribution/XP, difficulties, beds/sleep/spawns, Adventure/Hardcore, item use/blocking, all foods/effects/UI | Phase 2 interfaces; original tick scenarios and reload cases pass |
| 4. Ordinary content | Ores/materials; all wood/tree variants; shaped building blocks; plants/crops; decorative variants; beds/signs/paintings/frames/books/maps; fishing/foods/tools; recipes/smelting; Creative ordering/search/pick-block | Phases 1–2; complete ordinary Overworld acquisition and building in both modes |
| 5. Storage/redstone | Trapped/ender chests, hoppers/dispensers/droppers, power/update ordering, dust/torches/repeaters/comparators, switches/sensors, pistons/collision, powered doors/lamps/TNT, notes/jukeboxes, transfers/cooldowns/output | Update/metadata foundation; original circuits, clocks, sorters and automation pass including reload/boundaries |
| 6. Progression | Enchanting/bookshelves/all enchantment effects, anvils/costs, brewing/splash potions, effects/attributes, beacons/pyramids, dyed leather/books/glint | Items/NBT/attributes/combat; complete original costs and progression outcomes |
| 7. Mobs/spawning | Full roster/variants, villagers/trades/villages/golems, breeding/taming/riding/leads/equipment, jockeys, difficulty, caps/chunks/biomes/packs/despawn, remaining AI/loot/XP/audio/render/persistence | Chunk and entity foundations; individual and population reference scenarios pass |
| 8. Java generation | Seed parsing/RNG/order, biome layers/noise/all biomes, surface/caves/ravines/ores/lakes/springs, decorators, trees, structures/loot/population, world types/options | Chunks/registries; reference blocks/biomes/structures match independent of exploration order |
| 9. Dimensions/endgame | Nether/End providers/generation/mobs, portal creation/search/scaling/travel, fortresses, pearls/eyes/strongholds/End portals, crystals/dragon, Wither, dimension saves/respawn, credits/return | Generation, progression, entities; fresh Survival reaches dragon and Wither unaided |
| 10. Transport/entities | Boats/all carts/rails, mounts/passengers/dismount/collision, fishing hooks, remaining projectiles/special entities and cross-system interactions | Entity/update foundation and mechanisms; reference transport/contraptions and edge cases pass |
| 11. Java saves | NBT/Anvil/sections/metadata, entities/tile entities/item tags, world/player/dimensions/maps/scoreboards/ticks, import/export/recovery | Stable registries/chunks/state; browser→Java→browser round trips preserve supported data |
| 12. Multiplayer | 1.7.10 packets/metadata/chunks, authority/sync/correction, inventories/combat/tracking, chat/lists/permissions/server UI, sessions/auth/admin, browser transport bridge and LAN/hosting companion | Design boundary in phase 2; browser and Java clients where claimed share persistent authoritative worlds |
| 13. Commands/UI/presentation | Commands/selectors/rules/teams/scoreboards/stats/achievements, menus/settings/controls/chat/debug/containers/server UI, overlays/particles/poses/glint, fog/graphics/lighting/transparency, positional sounds/music/records/resource packs | Continuous alongside gameplay; fixed scene and interaction comparisons pass with explicit browser limits |
| 14. Integrated acceptance | Differential mechanics, long deterministic runs, seed/structure checks, screenshot/audio comparisons, saves/network/reconnect, memory/performance/streaming/long sessions, fresh Survival/Creative runs | All prior criteria; no unlabelled approximations; isolated probes alone are insufficient |

## Sequence and constraints

Finish PLAN-03 while closing confirmed existing-system persistence defects, then FX-01/PLAYER-01 and WORLD-01/SIM-01. Build new block families and containers on those foundations; advance redstone, progression, mobs and generation before dimensions and interoperability. User-reported correctness takes precedence. Do not rewrite the entire world engine in one change: keep migration/replay checks at each interface step. Estimate dates after foundation tasks are decomposed. Continue localhost development; do not publish the Site without owner instruction.

## Current evidence limits

The scheduled-tick persistence tests are port regression tests, not execution of original Anvil/TileTicks serialization. Existing native water/lava/fire behavior probes remain unchanged. Fire tests hold the world RNG state equal to isolate scheduling; whole-world random continuity is still SAVE-03. Relative delays and ordering are preserved within each scheduler; cross-system WorldServer priority/order is not yet unified. Old exports without tick snapshots use the existing wake migration. Invalid snapshot envelopes fall back to migration; invalid individual entries are skipped.

## Catalogue evidence and regeneration

`node tools/verify-catalogue.mjs` executes unchanged original registration/subtype classes from the SHA-1-pinned 1.7.10 client JAR. It enumerates all items and blocks, reproduces all 606 entries of the independently captured Creative search list, retains 76 enchanted-book NBT entries, reads EntityList's full ID map, scans occupied biome slots and records GameRules constructor defaults. Native registration/subtype execution verifies enumeration only. It does not execute feature behavior or establish browser equivalence.

`node tools/build-content-catalogue.mjs` regenerates the five linked audit catalogues without a JDK. It validates native identities, subtype uniqueness including NBT, independent Creative-reference equality and exact coverage of all 167 current browser search entries. Unmapped rows require review; mapped listings remain Partial. Metadata item damage and world block metadata are different domains. Biome registry slot 161 has native declared biomeID 160; both identities are retained. Registered abstract entity bases are marked, and nonregistered entities/semantic variants remain separate open work. Catalogue changes do not change the app runtime/version or publish the Site.
