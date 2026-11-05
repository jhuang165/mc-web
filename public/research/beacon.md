# Beacon and nether star (Minecraft Java 1.7.10)

Port of BlockBeacon (`ajg`), TileEntityBeacon (`aoq`), ContainerBeacon (`zx`, payment slot `zy`), GuiBeacon (`bez`), TileEntityBeaconRenderer (`bmj`) and the nether star (item 399). Original block 138 is internal BLOCKS slot 173 (it overwrites the reserved slot); the nether star is internal item 2060. Not full parity.

## Evidence

- `tools/probes/BeaconProbe.java` drives the unchanged obfuscated classes on a minimal World double (`BeaconProbe.W`) and a recording player; `tools/verify-beacon.mjs` compiles and runs it and writes `public/research/beacon-reference.json` (716 records: facts 1, levels 42, tick 12, effects 245, range 52, gate 4, setter 165, setterReset 1, nbt 2, slot 18, layout 1, shift 72, server 100, close 1).
- `src/pyramid.test.js` replays every record against the port.
- Bytecode-derived (not probed): the beam renderer, the beam fade `aoq.i`, the GUI geometry (`bez`), the render boxes of `blm.renderBlockBeacon`, and the `MC|Beacon` handler in `nh` (the probe replays its exact calls, not the network path).

## Behaviour

- **Pyramid** (`aoq.y`): needs sky above (`canBlockSeeTheSky(x, y+1, z)`); layer 1..4 below must be a full square of radius `layer` of iron, gold, emerald or diamond blocks (mixed allowed); the level is the last complete layer; a failed layer stops the scan; the floor limits layers. Level 0 means inactive.
- **Tick** (`aoq.h`): the check and the effects only run when the world time is a multiple of 80. A fresh tile has level -1 until its first check.
- **Effects** (`aoq.x`): active, level > 0, not a remote world and primary > 0. Range is `10 + 10 * level` on every axis around the block (box `x..x+1`), up to the world top; each player whose box strictly intersects gets the primary for 180 ticks, amplifier 1 only at level 4 when primary equals secondary, otherwise amplifier 0; at level 4 a different secondary is applied too. Original effects are ambient.
- **Powers** (`aoq.a`): Speed/Haste, Resistance/Jump Boost, Strength, Regeneration. Primary accepts tiers 0-2 below the level (level 4 adds no tier); the secondary only at level 4 (any of the four tiers, or repeating the primary for level II).
- **Screen**: the payment slot takes iron ingot, gold ingot, diamond or emerald (limit 1); shift-click rules replayed. Confirm sends two ints, consumes one payment even if picks are invalid and sets the validated picks; ignored without a payment. ContainerBeacon does not override onContainerClosed, so the payment stays in the tile in memory only and is lost when it unloads (faithful, kept).
- **Save**: Primary, Secondary, Levels ints (`active` and the payment are not saved) round-trip through the world save (`beacons`), region export/import (`Beacon` tile) and `/setblock` (reads Primary, Secondary, Levels; `/testforblock`-style `tileAt` writes them).
- **Block**: hardness 3, light 15, opacity 0, not opaque, resistance 15 (explosion table 3), drops itself. Render: glass shell, obsidian base (0.125..0.875, 0.00625..0.1875), core (0.1875..0.8125, 0.1875..0.875) with `beacon.png`. Native step sound is soundTypeStone (the repository's sound audit pins it).
- **Beam**: two passes of `entity/beacon_beam.png` (additive rotating square of radius 0.2 with depth writes; fixed 0.2..0.8 box with alpha blend), vertex alpha 32/255, alpha test 0.1, height 256 times the fade-in (+0.025 per frame, decays by `skipped ticks / 40`).
- **Recipe**: glass, star, glass / obsidian row (5 glass, 3 obsidian, 1 star). Nether star: stack 64, always glints, listed in Creative. Beacon block: Creative stack.

## Gaps

- The `ambient` flag is carried but the existing `Effects` class ignores it (no particle or HUD difference).
- The "full pyramid" achievement is not modelled.
- No beacon sounds exist in 1.7.10; none added. No audio importer change.
- The beam and the inventory icon are approximations: no screenshot or browser comparison was made; texture scroll direction and the GUI hit areas follow bytecode only.
- Tiles are created when the block is placed or found in the loaded edits at world load; streamed chunks loaded later do not create tiles for beacons that were never edited in this session (a beacon only exists via an edit, but chunk streaming restore is untested).
- The Wither does not exist in this branch; nothing drops the nether star yet.
- Single player only; the server packet is simulated locally.
