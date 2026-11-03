# Redstone component blocks (Minecraft Java 1.7.10)

Status: live as placeable, renderable, breakable blocks. **Inert: there is no power network.** Nothing here
powers, senses or carries a signal. `src/redstone.js` (the headless native-replayed simulator) is not wired in
and was not edited. This is not full parity.

Source of truth: `public/research/redstone-blocks-reference.json` (1118 records), recorded from the unchanged
1.7.10 classes by `tools/probes/RedstoneBlocksProbe.java` through `tools/verify-redstone-blocks.mjs`. Counts:
facts 9, bounds 144, below 171, sides 3, place 540, activate 64, buttonTick 16, wireConnect 171. Replayed by
`src/redstone-blocks.test.js`. Rules live in `src/redstone-blocks.js`.

## Ids

| Block | Internal id | Original id | Item |
| --- | --- | --- | --- |
| Redstone wire | 107 | 55 | dust, internal item 360 (original 331) |
| Lever | 108 | 69 | 1108 (original 69) |
| Stone pressure plate | 109 | 70 | 1109 (original 70) |
| Wooden pressure plate | 110 | 72 | 1110 (original 72) |
| Stone button | 111 | 77 | 1111 (original 77) |
| Repeater | 112 | 93 and 94 | item 356 (original 356) |
| Tripwire hook | 113 | 131 | 1113 (original 131) |
| Tripwire | 114 | 132 | string, internal item 321 (original 287) |

Tools own internal item ids 100-127, so block items are 1000 + block id; saves and region import/export map
them to the original ids through `POPULATION_ITEMS`. Original 94 (powered repeater) imports into 112 with
`state.powered`, and exports back as 94. Old saves and generation fingerprints are unchanged.

## What works live

- **Placement metadata** per face and yaw, replayed against all 540 place records (every side, 33 yaw values,
  with and without neighbours). Lever: side 1 -> 5/6 and side 0 -> 7/0 by the yaw quadrant; walls 4/3/2/1.
  Button: sides 2-5 -> 4/3/2/1, floor and ceiling refused. Hook: sides 2-5 -> 2/0/1/3. Repeater: `(quadrant + 2) & 3`.
  Plates and dust: metadata 0. String: metadata 0 over a solid top, else 2 (suspended), never refused.
  A refused placement keeps the item.
- **Support and drops**: dust, plates, repeater need a solid top (plates also a fence); tripwire breaks when its
  suspended bit disagrees with the block below; lever, button and hook break when the block their metadata
  names stops being solid. They drop their item (dust -> 360, repeater -> 356, tripwire -> string).
- **Bounds and selection** per metadata (the repeater's 0.125 collision box is its only collision box).
- **Hardness, resistance, sounds**: hardness 0.5 for lever, plates and button, 0 for the rest; blast value 0.5 for
  those four; wood sound for lever, wooden plate and repeater, stone for the rest. The stone plate needs a
  pickaxe to drop.
- **Recipes** (CraftingManager): lever, stone plate, wooden plate, stone button, tripwire hook (2).
- **Local interactions**: lever right-click flips bit 8 (`random.click`, 0.3, pitch 0.6 on / 0.5 off); button
  right-click sets bit 8 (0.3, 0.6) and releases 20 ticks later (0.3, 0.5); repeater right-click is
  `(meta + 4) & 15` with no sound. Sneaking skips them as for other stations.
- **Dust connection** (`providesPowerOrWire`, f/g masks from the records; arms, one-step-down and
  one-step-up links; climbing strips) and the tint at power 0 (0.3, 0, 0).
- Lighting opacity 0, not a normal cube, no shadow, explosion resistance, projectile ray boxes, creative
  listing, held/dropped/inventory icons.

## Limits

- No power: plates, tripwire and hooks never change state from entities; the pairing of hooks and tripwire and
  shears-disarm are not simulated. Dust is always drawn at power 0. A powered repeater (94) imports as a plain
  repeater that keeps its `powered` flag only for export.
- The repeater collides (0.125 high), as in 1.7.10, although the brief asked for no collision boxes.
- Wire geometry follows the RenderBlocks description (tint, overlay, trimming, climbing strips) but is not
  replayed against the native renderer; the lever, repeater (torch positions), hook and tripwire models are drawn
  from the class descriptions, not replayed.
- A solid side for levers, buttons and hooks is approximated by "normal cube". The end portal frame is accepted
  as support for dust, plates and repeaters as the records show.
- A pressed button reloaded from a save has no pending release; its next right-click schedules one (native
  keeps scheduled ticks across saves).
- The repeater recipe needs a redstone torch, which this build lacks, so it stays unmapped. Glowstone is also
  absent, so dust on glowstone is untestable. The repeater torches use the unlit torch texture.
- Block-metadata catalogue and shadow-reference entries for 107-114 were regenerated; other ids were left alone.
