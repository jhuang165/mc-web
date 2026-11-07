# Minecraft Java 1.7.10 — Web recreation

A partial browser recreation of Minecraft Java 1.7.10, investigated with [REA](https://github.com/morluto/rea), MCP SRG mappings and original-client bytecode. Full 1.7.10 parity is unfinished.

[Play the owner-private Site](https://blockworld-mc-web-1030.jhuang165.chatgpt.site) · [Feature coverage](public/research/parity.md) · [Parity roadmap](public/research/parity-roadmap.md) · [Codex/Claude setup](docs/collaboration.md)

## Run

```sh
npm ci
npm run dev
```

Node 20.19+ and a browser with WebGL 2 and Web Locks (HTTPS or localhost) are required. Build with `npm run build`; output is `dist/`.

## Browser multiplayer

The title screen’s Multiplayer button connects browsers to an always-on Creative world on ledoge0 (Tailscale required). Movement, building, chat and player presence are server-authoritative; the first milestone has a 128 × 128 border and eight-player limit. Containers, mobs, Survival and dimensions are still separate work. See [setup, deployment, protocol choice and limits](public/research/multiplayer.md). Start the Node service with `npm run server` after setting `MC_WEB_TOKEN`.

## Current implementation

Version **0.32.0** loads saved edits only as columns enter range, stores entity/container/pending-tick payloads per column, and prevents stale saves from competing tabs with one writable app per origin. Export now offers Java 1.7.10 ZIP saves (`level.dat` + Anvil regions), alongside the browser backup and explicit conversion notes. Runtime payloads still hydrate globally; full Java save parity remains unfinished. Native village/temple candidate decisions and stronghold positions are researched and replayed against the installed JDK; their buildings/population are still missing. See [streaming](public/research/streaming.md) and [structures](public/research/structures.md).

Version **0.31.0** stores streamed-world edits per chunk column: a save writes only the columns you changed since the last one, together with the world record in one transaction. Worlds saved by earlier versions, and imported files, convert on their first save, and exports still contain every edit; see [streaming](public/research/streaming.md).

Version **0.30.0** makes the streamed light shift about five times cheaper (roughly 15–20 ms per chunk crossing instead of about 100 ms) and full light builds about three times cheaper, with the same light values; see [streaming](public/research/streaming.md).

Version **0.29.0** moves streamed-world generation off the main thread: a Web Worker builds upcoming areas ahead of the player, and the light volume follows the player by relighting only the strips a move can change (about 100 ms per chunk crossing instead of a full ~265 ms rebuild plus a full remesh). The rest of this paragraph describes 0.28.0.

Version **0.28.0** adds Java population to the opt-in **Java streaming preview** in Create New World (new worlds use generation 13): explore terrain, caves, ravines, ores, trees, lakes, dungeons with loot, mineshafts, animals and snow beyond the starting map, including negative coordinates, with 64 resident chunk columns. Population is computed per 8 × 8-column area from the seed (about a second of synchronous generation per new area) and is a labelled approximation at area borders. Edits, containers and paused unloaded work survive return, local reload and export/import; streamed records use IndexedDB. Villages, strongholds and temples are still missing from streamed worlds. Streamed worlds saved by 0.27.0 stay terrain-only, and existing populated Java worlds retain their generators. Native chunk tickets, per-chunk durable records and per-chunk light arrays remain open (0.29.0 added asynchronous generation and incremental light shifts). See [streaming scope and evidence](public/research/streaming.md).

Version **0.26.0** makes empty minecarts placeable and rideable on rails: Use the cart item on a rail, right-click to board, W to push at low speed, and Shift to dismount. F5 shows the sitting pose. Chest carts can also be crafted and placed; generated mineshaft chest carts keep their container behavior. Local saves and export/import restore a saved rider mounted. The existing 34 chest-cart cases still pass, with 38 new native vehicle records (449 travel ticks) and live localhost loop/mineshaft/reload/import checks. Powered/detector/activator rails, other vehicle types and native chunk unloading remain unfinished; the finite edge stops carts safely. See [minecarts](public/research/minecarts.md). Full parity is unfinished.

Version 0.25.0 enables the full ported Java 1.7.10 Overworld population in new Java worlds (generation version 11): ores, biome trees/plants, lakes, dungeons with live loot chests and spawners, mineshafts first on the population Random, supported passive animals and snow/ice. Twelve native 8×8 area replays cover four seeds and all three world types; v9/v10 fingerprints are unchanged. Population content now has textures, subtype items, mining/drops, Creative listings and six sapling species. Saved live state wins after first launch, so looted dungeon chests stay looted. Generation remains finite with explicit halo/edge and light-fixture rules; villages/strongholds/temples, some animal types and several content behaviors remain unfinished. See [live population](public/research/population-live.md). No full parity claim.

Version 0.23.4 opens the void: in Creative you can break the bedrock floor and fall out of the world, which kills you below y −64 as in 1.7.10 (mobs too); respawn keeps your game mode.

Version 0.23.3 fixes fall damage: as in 1.7.10, a fall has to be more than 3 blocks to hurt (a jump off a 2-block ledge no longer does), because the landing move itself no longer counts. Suffocation, starvation and void deaths now post the original chat message, the hurt sound plays only for hits that start a new hurt window, and void damage passes spawn protection. Options gain Invert Mouse, the cinematic camera and the nine original sound-category sliders, and looking up or down stops at ±90°. The block-metadata audit now classifies all but 468 of the 2,736 raw values from the original classes.

Version **0.23.0** makes the Java generation ports playable: Create New World offers **Java Overworld**, **Java Amplified** and **Java Large Biomes**, with native 1.7.10 biome layers, terrain surfaces, caves and ravines in a finite **128 × 128 × 256** area. Java worlds default to Creative because trees, ores, decoration and structures are still to come. Existing worlds and the legacy landscape choices keep their terrain and 64-block height. Native probes and runtime persistence checks are documented in [generation](public/research/generation.md).

Version 0.22.12 ports the original mob hurt and death rules. Hurt resistance, top-up hits, the zombie's armour, hurt and death sound pitch, drops (cooked meat from burning mobs, the skeleton's worn bow, the zombie's rare iron, carrot or potato), experience at the end of the death animation, sun burning and mobs pushing each other and the player follow the unchanged classes on each mob's own random stream. 1,113 original cases are replayed ([combat](public/research/combat.md)). Version 0.22.13 makes kills in Creative drop experience orbs too, as in the original.

Version 0.22.11 adds the Difficulty option (Peaceful, Easy, Normal, Hard; Normal by default). It scales mob and explosion damage to the player and sets Peaceful regeneration, hunger and starvation. Peaceful has no monsters. Local difficulty comes from inhabited time and the moon phase. On Hard, spiders can spawn with Speed, Strength, Regeneration or Invisibility, shown with their potion swirls (an invisible spider shows only its eyes), and struck zombies can call reinforcements. Zombies roll their spawn bonuses in the original order, and burning zombies set the player alight. Skeleton arrows, fire spread and path tries follow the difficulty. 5,928 cases from the unchanged original classes are replayed ([difficulty](public/research/difficulty.md)).

Version 0.22.10 rebuilds the cow, pig and zombie from the 1.7.10 model classes (the cow was too narrow) and fixes the skeleton and zombie torsos, which sat too low; 11 original models are checked box by box. Particle drawing (billboard corners, texture coordinates, colours and brightness) is now replayed exactly against the original renderers for 25 kinds, and thrown-item crumbs face and light like the original. Version 0.22.9 adds the player's death poof and death camera roll, the original box and eye water tests for the player, mob air and drowning bubbles, the 1.7.10 living-sound roll and the rain-only leaves drip. 88 cases from the unchanged original classes are replayed. 0.22.8 put every particle into one shared 1.7.10 EffectRenderer pool and added the particle types of existing content: torch, furnace and fire flames and smoke, water and lava drips, lava pops and liquid sounds, water-entry splashes and bubbles, crits, feeding hearts, death poofs, potion swirls, eating and broken-tool crumbs, bone-meal sparkles and lava rain smoke. 79 cases from the unchanged original classes are replayed. Mobs still have no potion swirls (nothing gives them effects), and the GL drawing formulas are not probe-checked.

Version 0.22.7 adds the 1.7.10 Particles option (All, Decreased, Minimal). The original RenderGlobal filter runs before particles are made, including the Decreased `nextInt(3)` draw and the large/huge explosion exemptions. Rain splashes are halved or removed. 504 cases from the unchanged original class are replayed. A shared native particle pool remains unfinished.

Version 0.22.6 connects authoritative explosion rays, sound pitch, block drops/ore XP and chained TNT fuses to the saved World.rand stream. Repeated JSON/import reload regressions compare complete blast results interleaved with weather/chunk ticks. Client particles keep their separate stream; entity randomness and unified tick ordering remain unfinished.

Version 0.22.5 connects fluid and tree updates to the restored World.rand already used by weather and fire. Lava slowdown/fizz, sapling growth and leaf drops now advance that shared stream and retain it across saves/imports. Interleaved reload regressions cover these interactions; other random streams and unified tick ordering remain unfinished.

Version 0.22.4 preserves the player’s signed fire counter across saves/imports (15 original Entity NBT cases), and snapshots the weather World.rand state plus block-tick updateLCG for browser reload continuity. Other random streams and cross-system update ordering remain unfinished. The random snapshot is a browser save extension, separate from Java WorldInfo fields.

Version 0.22.3 preserves pending sand/gravel update deadlines, block identity and queue order across local saves and export/import. Repeated reloads mid-fall match uninterrupted column updates in port regression tests; old saves retain the legacy wake migration. World random continuity and unified cross-system tick ordering remain open.

Version 0.22.2 adds the original clay-block and snow-layer recipes and fixes cooked chicken's missing 0.35 smelting XP. The [recipe catalogue](public/research/recipe-parity-catalogue.md) inventories all 317 native crafting entries, 22 smelting entries and the separate output/XP map, with 1,172 mapped crafting samples and 14 mapped furnace result/XP checks replayed against original-class evidence. Dynamic recipe semantics and broader acceptance remain unfinished.

Version 0.22.1 preserves pending fluid/fire update delays and ordering across saves, and retains weather, projectiles, arrows, TNT and pending updates when importing exports. Legacy saves still load through the existing wake migration. The [roadmap](public/research/parity-roadmap.md) tracks the remaining work, with all 171 original base block IDs inventoried separately from verified behavior.

Version 0.21.1 moves the player through the original [`Entity.moveEntity`](public/research/player-step.md): the 0.5 step-up onto snow layers and other low blocks, and full-height farmland collision, checked against 589 original-class cases.

Version 0.21.2 adds the original `EntityPlayerSP.pushOutOfBlocks`: a player inside a full block (a block placed in their space, falling sand) is pushed out sideways at 0.1 a tick, matching 2,304 original-class cases.

Version 0.22.0 adds the original explosion puff/smoke effects and TNT fuse smoke, blast knockback for snowballs, eggs and falling sand/gravel, and burning-arrow TNT ignition (including grazing contact). Evidence includes 432 non-living blast targets, 48 arrow/TNT interactions and 41 particle records from the unchanged 1.7.10 classes. Particle collision now uses the shared collision bounds for cactus, ladders and farmland.

Version 0.21.6 adds arrow explosion knockback and corrects blast push origins for dropped items and primed TNT (216 targets replayed against the original classes). Embedded arrows keep their state until their supporting block changes.

Version 0.21.5 adds explosion damage and knockback for XP orbs, including block shielding, range boundaries and immediate removal on death (72 targets checked against the unchanged original classes).

Version 0.21.4 ports [XP orb physics](public/research/xp-orbs.md): `EntityXPOrb.onUpdate` with the water push, lava fizz, push-out, the id-timed player search, the pull towards the eye of the server player, ground bounce and friction, and pickup one orb every other tick in any game mode. It matches 19 original-class replays tick for tick.

Version 0.21.3 runs cactus, cobweb, fire and lava contact through one port of the `Entity.moveEntity` tail for the player, mobs, items and XP orbs. The player now stands 20 ticks in fire before catching, rain puts burning mobs out with a hiss, and items and XP orbs are destroyed by cactus. It matches 768 original-class cases.

Version 0.21 adds [sprinting and sprint-jumping](public/research/sprinting.md) with the 1.7.10 speeds, FOV and flight/swim physics; [block particles](public/research/particles.md); [creepers, explosions and TNT](public/research/creepers.md); and [sugar cane, cactus and falling sand/gravel](public/research/plants.md), backed by original-class probes.

Version 0.20 adds [ladders](public/research/ladders.md): original placement, support drops, plate rendering and selection, and player and zombie climbing, sliding and sneak-holding, with 95 original-class reference records.

Version 0.19 adds [cobwebs](public/research/webs.md): original movement slowdown, spider/flying-player immunity, sword/shears string harvest, rendering, fluid interactions and persistence, with 252 original-class reference records.

Finite seeded terrain, collision/movement/swimming/Creative flight, health/hunger, resources/tools, shaped 2×2 and 3×3 crafting, furnace smelting, original textures/audio, first-person motion, pigs/cows/zombies, wheat farming and cow breeding, XP, classic menus and persistent browser saves. Version 0.6 corrects container/count coordinates, integer GUI scaling, tool break times/harvest/wear and adds shears plus snowball/flint/book drops and recipes. Version 0.7 replaces aggregate storage with the Java 36-slot inventory, cursor and container click rules, per-stack durability, tool repair and armor; 53 cases match the unchanged original classes (see `public/research/inventory.md`).

The creative picker, camera/terrain generation, AI and several interactions remain adapted. The complete block/mob registries, enchanting, redstone, dimensions, original Java worlds/networking and full renderer parity remain unfinished. Third-person armor rendering is present, with limitations documented in the feature coverage. Original imported artwork/audio remains © Mojang / Microsoft; media manifests preserve its hashes and provenance. No original game classes ship in the web build.

## Validate

```sh
npm test
npm run test:bridge
npm run build
```

The suite includes regression coverage against 3,344 unchanged-original-tool cases. Optional research commands need a JDK and network access:

```sh
node tools/investigate.mjs
node tools/verify-mining.mjs
node tools/verify-food-stats.mjs
```

Raw client JARs, mappings and extracted classes stay in ignored `tools/research/`. [Mining/layout evidence](public/research/mining-and-layout.md) documents what the isolated harness checks and its limits.

## Work with Claude Code and Codex

```sh
npm run setup:bridge
claude
```

Read [the collaboration guide](docs/collaboration.md). Both agents share `AGENTS.md`, `.shared-memory/PROJECT.md`, revision-checked notes and advisory work claims through the local `mc-web-memory` MCP server. Claude's first project-server approval and Codex project trust remain client-controlled; restart sessions after setup. No global configuration is changed.

GitHub is the `github` remote. Commit reviewed changes, then run `npm run push:github` to validate and push the current branch. GitHub Actions validates pushes and pull requests. Sites publication is separate and preserves the existing private audience.
