# Dispenser, sticky piston, piston and piston head (Java 1.7.10)

Static, live blocks only: placing, rendering, colliding, breaking, saving, importing and exporting work. Dispensing and piston motion do not. This is not full parity.

## Evidence

`tools/probes/DispenserPistonProbe.java` runs the original client (`akm` BlockDispenser, `app` BlockPistonBase, `apq` BlockPistonExtension, `apb` TileEntityDispenser, `aaz` ContainerDispenser, `blm` RenderBlocks) and `tools/verify-dispenser-piston.mjs` writes `public/research/dispenser-piston-reference.json`. Record counts: 4 blocks (ids 23, 29, 33, 34; 16 metadata states each), 3600 determineOrientation rows, 240 placement rows, 48 render cases (16 metas each for 33, 29 and 34; vertex position, icon, UV and colour), 150 container replays, 135 shift-click routes, plus activation, spill, head/base, NBT read/write and reach tables.

## Browser ids

| Original | Block | Item (saved/exported as original) |
| --- | --- | --- |
| 23 dispenser | 115 | 1115 (23) |
| 29 sticky piston | 116 | 1116 (29) |
| 33 piston | 117 | 1117 (33) |
| 34 piston head | 118 | none (drops nothing) |
| slimeball 341 | - | 460 (341) |

Block ids 100-127 collide with tool item ids, so these blocks use items 1000 + id. Code: `src/dispenser-piston.js` (ids, orientation, bounds, rotated render quads, icons), `src/dispenser-container.js` (ContainerDispenser).

## What works

- Hardness 3.5 (pickaxe, drops itself) for the dispenser and 0.5 for pistons and head; explosion resistance 3.5 / 0.5. Recipes: dispenser, piston, sticky piston (slimeball). Creative listing and search order.
- Placement with `determineOrientation` (six facings, from the player position and yaw). Bit 3 is the extended flag on bases and the sticky flag on heads. Pick block returns the base item (sticky bit chooses sticky).
- Collision, selection, raycast and light opacity (pistons 0, dispenser 255) from the probe, including extended bases and the head's plate plus arm boxes.
- Rendering with the native rotation table: dispenser as a cube with front faces, bases and heads as quads (`Scene.piston`). Held, dropped and inventory items draw as meta 3 (dispenser) or meta 1 (pistons).
- Dispenser GUI (`gui/container/dispenser.png`, 9 slots), opened by right-click. Contents persist like chests: `survival.dispensers`, chunk runtime, lazy container residency, IndexedDB `containers`, Java region import/export as tile entity `Trap` with `Items`/`Slot`.
- Contents spill on break and explosion. Breaking a head removes its base (the base drops itself in Survival, nothing in Creative); breaking an extended base removes its head.

## Limits

- Batch 69 (docs sweep): dispensing is live: `dispense.js` (behaviours, `dispense.test.js`), `dispenser-container.js` (the container), redstone triggering in `redstone-runtime.js`.
- Batch 69 (docs sweep): piston extension and retraction run (`piston-live.js`, `piston-push.js`, `piston-live.md`) and the moving piston block (original 36, `ORIGINAL_MOVING`) is handled there. Not re-checked: whether generated structures contain pistons.
- Pistons use flat cell brightness, not per-vertex smooth lighting. Sticky-head pick-block and the metadata of dispensers with the triggered bit are stored but unused.
- `shadow-reference.json` only carries entries for ids 115-118 from this family.
