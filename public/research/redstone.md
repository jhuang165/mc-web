# Redstone power (1.7.10): headless port

Status: **core redstone power, repeaters, comparators, pressure plates and explicit daylight-detector refreshes are ported as a standalone module and replayed exactly against the original classes, for the recorded scenarios only.** Inventory comparator readings are ported for the tested containers. Jukebox/cake comparator behavior is not claimed. Nothing here is wired into the live game; many redstone components remain unported.

## Files

- `src/redstone.js`: headless port. It has no imports from the live game.
- `src/redstone.test.js`: replays every recorded scenario and adds unit checks.
- `tools/probes/RedstoneProbe.java` and `tools/verify-redstone.mjs`: the native recorder and comparator. These need a JDK, the pinned client JAR (sha1 `e80d9b3b…`) in `tools/research/`, and guava, log4j-api, commons-lang3 and netty-all (the last is needed to allocate the scripted player entity).
- `public/research/redstone-reference.json`: the recorded evidence. It holds class sha256 digests, the block property table, and 59 scenarios over 1,564 ticks. Those scenarios logged 254,886 calls, 1,767 cell changes, 88 comparator output changes, 236 sounds and 19 item drops. The reference also records native tile-entity classes and all 90 non-64 Item stack limits. Before REDSTONE-02 the file had 21 scenarios, 578 ticks, 104,645 calls, 708 cell changes, 77 sounds and 9 drops; those 21 scenarios are unchanged and replay exactly.

## What is ported

**World layer (`RedstoneWorld`)**
- Storage: 16³ sections that are created on the first non-air write.
- `setBlock`, following Chunk.func_150807_a:
  - an unchanged block and meta is a no-op
  - an air write into a missing section is a no-op
  - the id is written before the old block's breakBlock runs, which still sees the old meta
  - if the id changed during breakBlock, the write aborts
  - then meta is set and onBlockAdded runs
  - flags&1 notifies neighbours with the old block as the source
- `setBlockMetadataWithNotify`.
- `notifyBlocksOfNeighborChange` in the order x-1, x+1, y-1, y+1, z-1, z+1.
- Power queries: weak and strong power, getBlockPowerInput (D, U, N, S, W, E with an early return at 15), getIndirectPowerLevelTo, isBlockIndirectlyGettingPowered, getStrongestIndirectPower, doesBlockHaveSolidTopSurface, isBlockNormalCubeDefault.
- The block property table (opaque, renderAsNormalBlock, canProvidePower, top-surface rules) comes from the registry and is checked row by row.

**WorldServer pending ticks**
- A HashSet de-duplicates entries using Block.isEqualTo, so lit and unlit torches count as the same block.
- A TreeSet orders entries by time, then priority, then creation serial.
- At most 1000 entries run per tick, through the this-tick list (`isBlockTickScheduledThisTick`).
- An entry runs only if the block is still isEqualTo the scheduled block.

**BlockRedstoneWire**
- calculateCurrentChanges and the static blocksNeedingUpdate `HashSet<ChunkPosition>`, with its exact iteration order. This is emulated as a Java 8+ HashMap: hash `x*8976890+y*981131+z`, spread `h^(h>>>16)`, and clear() keeps the table.
- Neighbour notification fan-out.
- Connection rules: wire, power providers and repeater facing ids; climbing up or down past solid blocks; a cut by a normal cube above.
- Weak and strong power, and the canProvidePower toggle.
- Support check and drop: a top surface or glowstone; drops redstone 331.

**BlockRedstoneTorch**
- tickRate 2 and lit/unlit swaps.
- Strong power upward, and weak power to all sides except the attached block.
- Burnout: a per-world toggle list with a 60-tick window and 8 toggles. It plays the fizz sound with the native float pitch and makes 15 nextDouble particle draws.
- BlockTorch placement and support checks, and drops.

**BlockLever**
- All 8 orientations.
- Toggle with a click sound.
- Strong power into the attached block.
- Breaking a powered lever notifies the attached block.

**BlockButton (stone 20 ticks, wood 30 ticks)**
- Press, scheduled release, attached-block notification and drops.

**BlockRedstoneLight**
- Turns on immediately.
- Turns off through a 4-tick scheduled tick.

**Redstone block**
- Constant weak power of 15.

**Repeaters (93/94, BlockRedstoneRepeater over BlockRedstoneDiode)**
- Facing is metadata bits 0-1, delay is bits 2-3 (2, 4, 6 or 8 ticks). Using the block cycles the delay (no sound).
- Input is read behind the repeater through `getIndirectPowerLevelTo`, so it sees wire, levers, torches and strongly powered solid blocks.
- Locking: a diode beside it whose front is the repeater holds its state (`func_149910_g`). A redstone block or dust beside it does not lock a repeater.
- updateTick turns it on, or off, and keeps the pending tick when it turns on without input. Scheduled-tick priority is -3 when a diode feeds it from behind and is not facing the same way, -2 when lit, otherwise -1. A tick already due this tick is not rescheduled.
- Strong power to the front only; the front block is notified on add and removal (`func_149911_e`).
- Placement uses the placer's yaw (`onBlockPlacedBy`), and the block drops item 356 when its floor loses a solid top surface.
- Wire connects to a repeater facing it or facing away from it (the existing connection rule).

**Comparators (149/150, BlockRedstoneComparator + TileEntityComparator)**
- Metadata: bits 0-1 facing, bit 4 subtract mode, bit 8 powered. The block id stays 149 in the recorded runs; the powered state shows up as metadata.
- The tile entity's output signal is created on add (or lazily on first read), removed in `breakBlock`, and recorded per tick as the new `tiles` evidence. Replacing the block resets it to 0.
- Rear input is the indirect power level behind it. If the rear block is a container with a comparator override, or a normal cube with one directly behind it, that override replaces the power level. Side inputs read dust (its level) and `canProvidePower` blocks (strong power). A lever beside the comparator therefore reads 0 unless it powers that block strongly.
- Compare mode outputs the rear value if it is at least the strongest side; subtract mode outputs rear minus side, floored at 0. The output tick is scheduled with the diode priority rules. The update is skipped in subtract mode when the output is unchanged.
- Mode toggle plays `random.click` at 0.3 volume and pitch 0.55 (to subtract) or 0.5 (to compare).
- `World.func_147453_f`: a change of a block with a comparator override (and the cauldron water-level setter) updates comparators beside it and through one normal cube.
- Native overrides include the cauldron (metadata level), end portal frame (15 with an eye), chest/trapped chest, furnace, hopper, dispenser and dropper inventories. Container fullness uses the average of each occupied stack divided by min(inventory limit, item stack limit), then floor(fullness × 14) + 1, or 0 for empty inventories. The inventory setter paths are native-probed for chest changes; furnace/hopper/dispenser/dropper readings are refreshed through native comparator neighbor updates. Drops item 404 when the floor goes.

**Daylight detector (151)**
- Exported `refreshDaylightSensor(world,x,y,z)` uses native 1.7.10 arithmetic: sky brightness minus `skylightSubtracted`, celestial angle eased 20% toward 0 or 2π, the original 65,536-entry float sine/cosine table, `Math.round`, then clamp to 0–15. The replay harness invokes the same helper through its `daylight` event.
- `daylight` is a scripted refresh event with native sky/time fixtures. The no-sky provider returns without changing metadata. A changed level uses `setBlockMetadataWithNotify(..., 3)`, so the probe records native neighbor notifications; the adjacent-comparator fixture confirms callbacks, while its output remains zero for this weak-power source.
- The probe does not claim real world-time refresh cadence or random/server scheduling: it explicitly invokes the detector's refresh method at chosen ticks, including unchanged repeats. A changed sensor updates neighboring blocks using the native metadata path. In the recorded adjacent-comparator fixture, neighbor callbacks occur but the comparator tile output stays at 0; no successful daylight-to-comparator signal is claimed.
- `daylight-wire-lamp` places the detector at `(0,1,1)`, dust from x=1 through x=3 and a lamp at `(4,1,1)`. A daytime refresh outputs 15, propagates dust levels 15/14/13 and lights the lamp. A sunset refresh outputs 0, clears the dust and turns the lamp off following the native pending-tick behavior. Native block changes, direct weak-power getter (15) and indirect power query from the first dust (true) are recorded. The fixture still uses explicit refresh calls; it does not simulate automatic day/night scheduling.

**Pressure plates (stone 70, wood 72, weighted light 147 and heavy 148)**
- Entity counting follows the original sensing box (x+0.125, z+0.125 inset, 0.25 high, strict intersection). Stone plates count living entities, wooden plates every entity, weighted plates every entity with strength `ceil(min(n, max) / max * 15)` (max 15 or 150).
- Tick rates are 20 (stone, wood) and 10 (weighted). Weak power to every side, strong power downward; drops itself when the floor loses its top surface.
- The harness supplies the entity list; see the limits below.

**Drops (dropBlockAsItem)**
- The world Random draws a chance roll, then a three-float offset.
- The world Random state after every scenario matches the native one.

## Evidence

`node tools/verify-redstone.mjs` runs the unchanged original classes (`ana anc and aoc alv ajs anx aon anb ams anf akj akc aoz amu aol ajd ajw aku`, plus native chest/furnace/dispenser/hopper inventory tiles) inside a real `World`/`Chunk`, and runs `replayScenario` on the same input. It asserts that every tick has identical:
- call logs (setBlock, setMeta, neighbour notifications, scheduled ticks, updateTick, sounds, drops)
- changed cells
- comparator tile entity output signals (`tiles`, stored only for scenarios where it changes)
- final region and pending ticks
- sounds (compared after fround)
- drops and the next world Random int

Scenarios:
- line falloff from a lever, and wires placed one per tick
- a mid-line cut and re-place, then removing the source
- cross, T and corner branches
- a closed loop
- a hill with steps up and down, cut by a block above
- dust on top of a block (strongly powering it and a lamp beside it) vs dust under a block
- lamp delay with fast toggles
- a torch inverter
- a torch clock that burns out at tick 30 and is relit by a neighbour change at tick 100
- the burnout window edge: the 8th turn-off arrives 60 ticks after the first and burns out; at 61 ticks it does not
- stone and wooden buttons, including a re-press while pressed
- negative coordinates across chunk borders
- a new section created at y 16
- support removal under dust, a torch, a lever and a button
- top and bottom slabs, glowstone and glass
- a torch tower
- a redstone block
- a 5×5 wire carpet
- lever orientations
- a torch lighting a lamp
- `repeater-delays`, `repeater-chain`: delay 2/4/6/8 ticks, mixed-delay chains with wire between, short toggles around the delay edge
- `repeater-clock`: a ring of four repeaters kicked by a one-tick pulse, and kicked again at tick 40
- `repeater-lock`: locking while on, while off, from the far side, and a non-locking redstone block
- `repeater-pulses`: lever pulses of 1, 2, 3 and 5 ticks into delay 2, 4 and 8 repeaters (shortening and extension)
- `repeater-solid`: a repeater into a solid block that powers lamps, a second repeater and a torch
- `repeater-mixed`: wire, repeater, torch inverter and repeater in one line; `repeater-placement`: placement at 8 yaws, delay cycling, support loss drops
- `comparator-modes`: compare and subtract with wire and lever side inputs, mode toggled at runtime
- `comparator-container`: cauldron levels and end portal frame eyes read directly and through a stone block, plus subtract with a side lever
- Daylight fixtures: noon, morning, sunset, late night, cycle wrap, sky-subtraction, no-sky, adjacent-comparator notification and a native sensor→dust→lamp day/night circuit; refreshes are explicit, not an engine cadence simulation.
- Native inventory readings: chest half/full/empty transitions, a 54-slot double chest, single/double chest lid blockers, chest input through one stone block, a 27-slot chest filled with 16-stack snowballs, furnace under a solid block, hopper, dispenser, dropper and trapped chest. Inventory writes use original tile-entity setters; comparator refreshes follow the native chest change path or an explicit neighboring-block update where that setter emits none. The recorded signals verify Java float fullness arithmetic, stack limits and slot counts (one full slot gives furnace 5, hopper 3, dispenser/dropper 2); chest changes behind stone reach comparators through `World.func_147453_f`.
- `comparator-clock`: a subtract comparator looped into its own side
- `comparator-mixed`: comparator chain with repeaters and a solid block; `comparator-placement`: placement at 4 yaws, mode clicks, support loss drops
- `pressure-plates`: all four plate types with 1 to 151 scripted entities; `pressure-plate-support`: support loss and a pressed plate

Mutation checks were run against the reference: changing the lamp delay, the burnout count, the window boundary (59 or 61) or the ChunkPosition hash/spread each causes mismatches.

One native quirk is reproduced: a lamp's pending turn-off tick is not cancelled when the lamp is re-powered. So if power is removed again just before that old tick fires, the lamp goes dark at once, not 4 ticks later (`lamp-delay`, ticks 12 to 16).

## Pistons (REDSTONE-04, standalone)

Pistons live in `src/redstone.js` next to the other blocks and stay unwired from live play. Evidence: `tools/probes/PistonProbe.java` and `tools/verify-pistons.mjs` replay the unchanged 1.7.10 classes and write `public/research/piston-reference.json` (class sha256 digests, decompiled method text, block tables, 30 scenarios, 710 ticks, 48,886 logged calls, 200 delivered block events, 1,165 cell changes, 584 piston tile-entity states, 279 sounds, 15 drops). `src/pistons.test.js` replays every scenario: call log, block changes and tile-entity state per tick, final grid, pending ticks, queued events, sounds, drops and the RNG state. `redstone-reference.json` is unchanged and its tests pass as before.

Ported:

- BlockPistonBase (33 normal, 29 sticky): facing from metadata and the extended bit 8, `isIndirectlyPowered` including the quasi-connectivity check one block up, `onBlockPlacedBy` and `determineOrientation`, `canPushBlock` (obsidian, hardness -1, mobility 1 break-and-drop, mobility 2 immovable, tile-entity blocks, extended pistons), the 12-block limit and the y bounds, event 0 extend and event 1 retract including the sticky pull and its 1.7.10 moving-block branch.
- BlockPistonExtension (34): removes itself without a base, breaking it drops and removes the extended base.
- BlockPistonMoving (36) with TileEntityPiston: progress 0, 0.5, 1 and finalisation, `clearPistonTileEntity`.
- World block events: `addBlockEvent` de-duplication, the double-buffered list, `sendQueuedBlockEvents` re-checking the block id at delivery. Tick order in the replay: scripted events, tick updates, block events, tile entities.
- Sounds `tile.piston.out` (pitch rand*0.25+0.6) and `tile.piston.in` (rand*0.15+0.6), and item drops for pushed mobility-1 blocks.
- Tile-entity bookkeeping (setTileEntity, getTileEntity, removeTileEntity, the added-while-scanning list and chunk map) is modelled for block 36 only.

Scenarios: single push and sticky pull, 12 blocks, 13 refused, a 13th placed after the event is queued, a torch at the 13th cell, immovable lanes, drops, 1 to 6 tick pulses, sticky pull exceptions, quasi-connectivity, redstone blocks and lamps pushed, double extenders, flicker inside one tick, placement orientation, placement beside power, head and base removal, top and bottom height limits, all six facings, event order, every power source kind, a repeater ring clock driving a normal and a sticky piston, and retraction from a pre-extended state.

Limits:

- Entity pushing (TileEntityPiston moving entities) is not ported or recorded. The probe's entity list is empty.
- Creative-mode head removal (the harvest skip) is not ported.
- Only block 36 is a tile-entity provider for the k/K bookkeeping. Chests and comparators keep the older sidecar maps.
- No client rendering, no piston textures, no live world, chunk loading or saving. Not wired into `main.js`.
- Evidence covers the recorded scenarios only. Same Java 8 HashSet caveat as above. No later-version behaviour (no slime blocks).

## Deviations and modelling limits

- **HashSet order is that of Java 8 and later.** The probe ran on a modern JDK. Original 1.7.10 shipped on Java 6/7, whose HashMap spreads hashes differently. The iteration order, and with it the notification order (not the final power levels), can differ on a Java 7 server. The set never holds more than 7 entries, so resize and treeify never occur; tree bins throw if they are reached.
- **Not modelled:**
  - Random block ticks (BlockTorch.tickRandomly). A burnt-out torch relights only through neighbour changes.
  - Lighting updates.
  - Particles (the Random draws are kept).
  - Real entities. Wooden buttons are never held down by arrows. Pressure plates see only the scripted entity list, whose boxes are all 0.25 wide at the cell centre; nothing moves, spawns, dies or gets removed on its own. The `collide` event calls the plate with a null entity, so entity-specific rules (such as arrow or projectile handling) are not exercised.
  - Full interactive container behavior is not ported. Comparator overrides are modelled for chest, trapped chest, furnace, hopper, dispenser and dropper inventories. Cake bites do not produce a comparator output in the recorded negative fixture. The jukebox probe confirms the native record getter returns 1 for disc 2256, but inserting it then placing an adjacent comparator produced no output change; jukebox comparator behavior is therefore not modeled or claimed. Brewing stands, item frames, ocelot chest-opening restrictions and native tile-entity save/load remain untested.
  - Player placement beyond yaw: `placeby` runs `onBlockPlacedBy` with a placer yaw after a plain setBlock. Hit-side rules, `canPlaceBlockAt` and item consumption are not run; other events place an explicit id and meta with flags 3.
  - Player removal: creative-style setBlockToAir, with no harvest drops.
- Terrain outside the ported ids is inert: no callbacks and no power.
- The probe's `use` calls onBlockActivated with a null player.
- Evidence covers only the recorded scenarios. Large, very busy circuits (more than 1000 ticks due in one tick) are implemented but not recorded.

## Open items

- Pistons: live-game integration and entity pushing (the headless core is in the Pistons section).
- Tripwire and hooks, detector and powered rails; automatic daylight refresh scheduling with world time.
- Comparator inputs from brewing stands, jukeboxes, item frames and cake; live container behavior and tile-entity save/load.
- Entity-driven pressure plates in a live world (real entity boxes, arrows, falling items, minecarts).
- Repeater and comparator placement from the real item-use path, and tile entity save/load.
- Powered doors, trapdoors, fence gates, TNT, note blocks, dispensers and droppers, hoppers.
- Live-game integration: world storage, chunk saving, tick loop, player placement and removal, item drops.
- Rendering: dust connection textures and colour by power, lit torch and lamp models, particles, sounds.
- Random ticks and lighting for torches and lamps.
