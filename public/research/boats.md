# Boats (EntityBoat, entity id 41, item 333)

Target: Minecraft Java 1.7.10. Not full parity; see "Remaining differences".

## Evidence

`tools/probes/BoatProbe.java` (run by `tools/verify-boats.mjs`) drives the unchanged client classes `xi` (EntityBoat), `abj` (ItemBoat) and `sa` (Entity) on a map-backed world, with `setBlock`, `setBlockToAir`, `func_147480_a` recorded and `spawnParticle` logged. Output: `public/research/boat-reference.json`, 62 records: 19 travel scenarios (buoyancy, rider input, speed cap, snow and lily pad clearing, crash and fall breaks, shore, ice, lava, splash particles), 6 hit/break sequences, 1 mount geometry record, 36 ItemBoat placement records, plus sha256 digests of the three classes. `src/boats.test.js` replays them (tolerance 1e-7 on double state; float state exact).

## Implemented

- Item id 495 (original 333): 5 planks in a U, Creative Transportation tab and search order after the saddle, original `items/boat.png` icon.
- ItemBoat: 5-block trace that stops on source water, works on land, snow layer cell one lower, yaw snapped to the player's axis, refused when the box shrunk by 0.1 meets blocks. Taken from the stack except in Creative.
- EntityBoat.onUpdate: five-slice buoyancy, rider forward/strafe input along the rider yaw, speed multiplier limits 0.07 to 0.35, drag, collision break above speed 0.2 (3 planks and 2 sticks), fall above 3 breaks (3 planks and 2 sticks), snow layers and lily pads cleared, hit damage and wobble (renders as RenderBoat's roll), player hit break (drops the boat; Creative breaks without a drop), splash and bubble particles with the splash sound, 0.05 pushes between a boat and players or mobs.
- ModelBoat (5 boxes) with `entity/boat.png`, RenderBoat transform (`src/boat-renderer.js`).
- Riding: right click mounts (one rider), Shift dismounts to the native position, F5 seated pose, rider camera through the existing riding path. Strafe sign: the browser's D is +1, native moveStrafing is positive to the left.
- Persistence: `boats` array in saves, chunk runtime storage and exports (written only when a boat exists; old saves load with none). The mounted state is restored through `restorePlayerVehicle`.

## Remaining differences

- The player cannot stand on or collide with a boat (only the push is applied); mobs are not mounted on boats.
- ItemBoat is tried before block activation, so a right click on a chest or door while holding a boat places a boat instead when the trace hits.
- The entity-in-line-of-sight check of ItemBoat is not applied; the box check uses only blocks and the player and mob boxes passed in.
- Boat-pair pushes, lava burning, the void kill and the rider position right after a break are implemented but not covered by native records.
- The 0.5 shadow is not drawn.
