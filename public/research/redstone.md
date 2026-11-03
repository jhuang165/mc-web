# Redstone power (1.7.10): headless port

Status: **core redstone power, repeaters, comparators and pressure plates are ported as a standalone module and replayed exactly against the original classes, for the recorded scenarios only.** It is not wired into the live game. Many redstone components are not ported yet (see Open items); this is not full parity.

## Files

- `src/redstone.js`: headless port. It has no imports from the live game.
- `src/redstone.test.js`: replays every recorded scenario and adds unit checks.
- `tools/probes/RedstoneProbe.java` and `tools/verify-redstone.mjs`: the native recorder and comparator. These need a JDK, the pinned client JAR (sha1 `e80d9b3b…`) in `tools/research/`, and guava, log4j-api, commons-lang3 and netty-all (the last is needed to allocate the scripted player entity).
- `public/research/redstone-reference.json`: the recorded evidence. It holds class sha256 digests, the block property table, and 48 scenarios over 1,484 ticks. Those scenarios logged 252,541 calls, 1,739 cell changes, 88 comparator output changes, 236 sounds and 19 item drops. The reference also records native tile-entity classes and all 90 non-64 Item stack limits. Before REDSTONE-02 the file had 21 scenarios, 578 ticks, 104,645 calls, 708 cell changes, 77 sounds and 9 drops; those 21 scenarios are unchanged and replay exactly.

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
- Native inventory readings: chest half/full/empty transitions, a 54-slot double chest, single/double chest lid blockers, chest input through one stone block, a 27-slot chest filled with 16-stack snowballs, furnace under a solid block, hopper, dispenser, dropper and trapped chest. Inventory writes use original tile-entity setters; comparator refreshes follow the native chest change path or an explicit neighboring-block update where that setter emits none. The recorded signals verify Java float fullness arithmetic, stack limits and slot counts (one full slot gives furnace 5, hopper 3, dispenser/dropper 2); chest changes behind stone reach comparators through `World.func_147453_f`.
- `comparator-clock`: a subtract comparator looped into its own side
- `comparator-mixed`: comparator chain with repeaters and a solid block; `comparator-placement`: placement at 4 yaws, mode clicks, support loss drops
- `pressure-plates`: all four plate types with 1 to 151 scripted entities; `pressure-plate-support`: support loss and a pressed plate

Mutation checks were run against the reference: changing the lamp delay, the burnout count, the window boundary (59 or 61) or the ChunkPosition hash/spread each causes mismatches.

One native quirk is reproduced: a lamp's pending turn-off tick is not cancelled when the lamp is re-powered. So if power is removed again just before that old tick fires, the lamp goes dark at once, not 4 ticks later (`lamp-delay`, ticks 12 to 16).

## Deviations and modelling limits

- **HashSet order is that of Java 8 and later.** The probe ran on a modern JDK. Original 1.7.10 shipped on Java 6/7, whose HashMap spreads hashes differently. The iteration order, and with it the notification order (not the final power levels), can differ on a Java 7 server. The set never holds more than 7 entries, so resize and treeify never occur; tree bins throw if they are reached.
- **Not modelled:**
  - Random block ticks (BlockTorch.tickRandomly). A burnt-out torch relights only through neighbour changes.
  - Lighting updates.
  - Particles (the Random draws are kept).
  - Real entities. Wooden buttons are never held down by arrows. Pressure plates see only the scripted entity list, whose boxes are all 0.25 wide at the cell centre; nothing moves, spawns, dies or gets removed on its own. The `collide` event calls the plate with a null entity, so entity-specific rules (such as arrow or projectile handling) are not exercised.
  - Full interactive container behavior is not ported. Comparator overrides are modelled for chest, trapped chest, furnace, hopper, dispenser and dropper inventories; brewing stands, jukeboxes, item frames and cake remain unsupported. The harness initializes container blocks as existing terrain cells and does not test container users, hopper transfer ticks, all slot restrictions, the ocelot chest-opening restriction or native tile-entity save/load.
  - Player placement beyond yaw: `placeby` runs `onBlockPlacedBy` with a placer yaw after a plain setBlock. Hit-side rules, `canPlaceBlockAt` and item consumption are not run; other events place an explicit id and meta with flags 3.
  - Player removal: creative-style setBlockToAir, with no harvest drops.
- Terrain outside the ported ids is inert: no callbacks and no power.
- The probe's `use` calls onBlockActivated with a null player.
- Evidence covers only the recorded scenarios. Large, very busy circuits (more than 1000 ticks due in one tick) are implemented but not recorded.

## Open items

- Pistons and sticky pistons (BUD behaviour).
- Tripwire and hooks, daylight sensors, trapped chests, detector and powered rails.
- Comparator inputs from brewing stands, jukeboxes, item frames and cake; live container behavior and tile-entity save/load.
- Entity-driven pressure plates in a live world (real entity boxes, arrows, falling items, minecarts).
- Repeater and comparator placement from the real item-use path, and tile entity save/load.
- Powered doors, trapdoors, fence gates, TNT, note blocks, dispensers and droppers, hoppers.
- Live-game integration: world storage, chunk saving, tick loop, player placement and removal, item drops.
- Rendering: dust connection textures and colour by power, lit torch and lamp models, particles, sounds.
- Random ticks and lighting for torches and lamps.
