# Redstone power (1.7.10): headless port

Status: **core redstone power is ported as a standalone module and replayed exactly against the original classes, for the recorded scenarios only.** It is not wired into the live game. Many redstone components are not ported yet (see Open items).

## Files

- `src/redstone.js`: headless port. It has no imports from the live game.
- `src/redstone.test.js`: replays every recorded scenario and adds unit checks.
- `tools/probes/RedstoneProbe.java` and `tools/verify-redstone.mjs`: the native recorder and comparator. These need a JDK, the pinned client JAR (sha1 `e80d9b3b…`) in `tools/research/`, and guava, log4j-api and commons-lang3.
- `public/research/redstone-reference.json`: the recorded evidence. It holds class sha256 digests, the block property table, and 21 scenarios over 578 ticks. Those scenarios logged 104,645 calls, 708 cell changes, 77 sounds and 9 item drops.

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

**Drops (dropBlockAsItem)**
- The world Random draws a chance roll, then a three-float offset.
- The world Random state after every scenario matches the native one.

## Evidence

`node tools/verify-redstone.mjs` runs the unchanged original classes (`ana anc and aoc alv ajs anx aon anb ams`) inside a real `World`/`Chunk`, and runs `replayScenario` on the same input. It asserts that every tick has identical:
- call logs (setBlock, setMeta, neighbour notifications, scheduled ticks, updateTick, sounds, drops)
- changed cells
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

Mutation checks were run against the reference: changing the lamp delay, the burnout count, the window boundary (59 or 61) or the ChunkPosition hash/spread each causes mismatches.

One native quirk is reproduced: a lamp's pending turn-off tick is not cancelled when the lamp is re-powered. So if power is removed again just before that old tick fires, the lamp goes dark at once, not 4 ticks later (`lamp-delay`, ticks 12 to 16).

## Deviations and modelling limits

- **HashSet order is that of Java 8 and later.** The probe ran on a modern JDK. Original 1.7.10 shipped on Java 6/7, whose HashMap spreads hashes differently. The iteration order, and with it the notification order (not the final power levels), can differ on a Java 7 server. The set never holds more than 7 entries, so resize and treeify never occur; tree bins throw if they are reached.
- **Not modelled:**
  - Random block ticks (BlockTorch.tickRandomly). A burnt-out torch relights only through neighbour changes.
  - Lighting updates.
  - Particles (the Random draws are kept).
  - Entities, so wooden buttons are never held down by arrows.
  - Comparator input updates (no ported block has a comparator override).
  - Player placement (`onBlockPlacedBy` and metadata derived from the hit side): events place an explicit id and meta with flags 3.
  - Player removal: creative-style setBlockToAir, with no harvest drops.
- Terrain outside the ported ids is inert: no callbacks and no power.
- The probe's `use` calls onBlockActivated with a null player.
- Evidence covers only the recorded scenarios. Large, very busy circuits (more than 1000 ticks due in one tick) are implemented but not recorded.

## Open items

- Repeaters (including locking), comparators, pistons and sticky pistons (BUD behaviour).
- Pressure plates, tripwire and hooks, daylight sensors, trapped chests, detector and powered rails.
- Powered doors, trapdoors, fence gates, TNT, note blocks, dispensers and droppers, hoppers.
- Live-game integration: world storage, chunk saving, tick loop, player placement and removal, item drops.
- Rendering: dust connection textures and colour by power, lit torch and lamp models, particles, sounds.
- Random ticks and lighting for torches and lamps.
