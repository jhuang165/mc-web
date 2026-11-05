# Eye of Ender, end portal block and portal frame use (1.7.10)

Evidence: `tools/probes/EyeOfEnderProbe.java` runs the unchanged original classes (acn ItemEnderEye, zd EntityEnderEye, akt BlockEndPortal, aku BlockEndPortalFrame, apo TileEntityEndPortal, ave/aug stronghold generator) against a world double. `tools/verify-eye-of-ender.mjs` checks the client JAR SHA-1, class digests and record counts, and writes `public/research/eye-of-ender-reference.json` (297 records). Items marked "bytecode-derived" were read from javap, not executed.

## Behaviour

- Item 381 is internal 1960 "Eye of Ender". Recipes: ender pearl + blaze powder (shapeless); eight obsidian around an eye make an ender chest (1941).
- Right-click in the air: finds the closest stronghold (coordList entries `((cx<<4)+8, 64, (cz<<4)+8)`, smallest squared integer distance including y, strict `<`). No stronghold: nothing happens, nothing consumed. Otherwise the eye spawns at the feet position, `random.bow` plays (volume 0.5, pitch 0.4/(rand*0.4+0.8)), aux 1002 fires, and the stack is consumed unless creative.
- Flight (probe, 11 flights x 81 ticks): target is the exact point when horizontal distance <= 12, else 12 blocks along the line at posY+8. Speed `f + (f1-f)*0.0025`, x0.8 when closer than 1. Vertical drift 0.015 toward the target height. One portal particle per tick (four bubbles in water). At age > 80 the eye dies: 80% (`nextInt(5) > 0`) drops as an item entity, otherwise aux 2003 shatter effect at the rounded position (bytecode-derived effect).
- Right-click on a portal frame: if empty, sets the eye bit (meta 4), consumes the item, spawns smoke and runs the ring check. Only the full 12-frame ring with all eyes fills the 3x3 with portal blocks (probe: 256 x 12 ring outcomes, 400 mask samples). A frame that already has an eye leaves the stack unchanged.
- End portal block (BLOCKS slot 149, original 119): hardness -1, light 15, not solid, no drops, bounds (0,0,0)-(1,1/16,1), unbreakable by survival. Rendered by `src/end-portal-renderer.js`.
- Region import/export: block 119 and the `Airportal` tile entity round-trip.
- Stronghold portal room 10% eye chance per frame is present in the existing port (`StrongholdPortalRoom`).

## Gaps

- No End dimension. The original collision calls `travelToDimension(1)` (probe: free entities only; riding, ridden and remote do nothing). The port does nothing on contact; this is not implemented.
- Generated stronghold starts are not consulted, only the coordList (as in a fresh world).
- The base `Entity.onEntityUpdate` is not modelled in the pure tick; the in-water flag arrives through a hook.
- Creative restoration of the used eye is bytecode-derived (ItemInWorldManager), not probed.
- The portal TESR (bmt) is approximated with layered starfield planes; the eye-linear texgen is not reproduced.
- Aux 2003 shatter particles are bytecode-derived.
- Sounds, particles and rendering are not verified in a browser (no dev server was run).
- Java sin/cos intrinsics differ from V8 by one ulp, so tests use tolerances on flight rotation.
- No /give or /summon hooks were added in `commands.js`.
