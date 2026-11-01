# Minecraft Java 1.7.10 — Web recreation

A partial browser recreation of Minecraft Java 1.7.10, investigated with [REA](https://github.com/morluto/rea), MCP SRG mappings and original-client bytecode. Full 1.7.10 parity is unfinished.

[Play the owner-private Site](https://blockworld-mc-web-1030.jhuang165.chatgpt.site) · [Feature coverage](public/research/parity.md) · [Parity roadmap](public/research/parity-roadmap.md) · [Codex/Claude setup](docs/collaboration.md)

## Run

```sh
npm ci
npm run dev
```

Node 20.19+ and a browser with WebGL 2 are required. Build with `npm run build`; output is `dist/`.

## Current implementation

Version 0.22.8 puts every particle into one shared 1.7.10 EffectRenderer pool and adds the particle types of existing content: torch, furnace and fire flames and smoke, water and lava drips, lava pops and liquid sounds, water-entry splashes and bubbles, crits, feeding hearts, death poofs, potion swirls, eating and broken-tool crumbs, bone-meal sparkles and lava rain smoke. 79 cases from the unchanged original classes are replayed. The player death poof and mob drowning/potion particles remain unfinished.

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
