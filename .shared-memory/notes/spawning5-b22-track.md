# Spawning 5 track (batch 22)

Agent: claude-b22-spawning5. Branch batch22-spawning5 from main 674d91b.

## Summary

- Mobs in headless ring columns (batch 21) now tick: AI, movement against ring blocks, despawn, fall/fire/water hazards, in the same list order and Random draws as resident mobs (`EntityWorld.isActive`, `ring.view`, `ai.world`).
- Edits that land in ring columns (explosions, fluids, fire, pistons, player blocks) are applied (`World.ringSink`, `HeadlessColumns.putOutside`), journalled, carried to the window when the column streams in, and kept when a column leaves it (`adopt`).
- `World.ringReads` scopes ring reads to `movementTick`, so meshing and the light volume are unchanged. StreamStorage margin 1 to 7 so ring columns have hydrated journals.
- Collision scans in entities.js got a 12-block cull (result-neutral) to pay for the extra mobs.
- New module logic lives in headless-columns.js and headless-env.js; entities.js, main.js, world.js, scene.js, ai.js, streaming-storage.js have small hunks.

## Native evidence

- Bytecode-read (batch 21): `ahb.a(sa, boolean)` 32-block `checkChunksExist` gate; `EntityLiving.despawnEntity` rules.
- Probed: 320-tick ring vs all-resident equality test; edit, adopt, hydrate and light-hook tests; headless Chrome runs (port 5195, CDP 9335, muted): ring mobs move, explosion in a ring column, 40-block hops with 0 console errors.
- Assumed: dropping non-explosion events from out-of-window mobs; paused fluid ticks in ring; the 12-block cull bound (largest boxes: dragon 16 wide, giant 10.8 tall).

## Tests

- Four new tests in src/headless-columns.test.js (12 in file): ring tick equality (ringTicked > 100, moved > 0, gone > 0), ring edits, hydrate replay, ring light and sky hooks. The batch 21 ring-vs-resident test still passes.
- npm test and npm run build: see the final report for counts.
- Perf (160 ring mobs): frame median 16.7 ms and p95 16.7 to 16.8 ms in both modes (vsync-quantised); mob tick mean 3.2 ms on vs 1.4 ms off; before the collision cull it was 7.7 to 10.3 ms vs 2.4 to 3.7 ms. "Off" is simulated (`ring.active = () => false`, view swap kept).

## Remaining gaps

- Projectiles, items, xp orbs, falling blocks and redstone tick in the window only.
- Ring edits have no mesh or light until the column is resident; fluid neighbour propagation in ring is paused.
- A pruned ring column loses in-memory edits until it is resident and hydrated again.
- `ringReads` covers the whole `movementTick`, including the window shift (light and mesh effects not audited).
- Events (sounds, drops, xp) from out-of-window mobs are dropped except explosions.
- Frame medians are vsync-quantised; the "off" baseline is simulated.

## Proposed remaining-gaps lines

- Natural spawning: ring mobs now tick and ring edits apply (batch 22), but projectiles, items, xp orbs, falling blocks and redstone still tick only in the resident window, and fluid propagation, light and meshes for ring edits wait until the column is resident.
- Natural spawning: events from out-of-window mobs other than explosions are dropped; a pruned ring column loses its in-memory edits until hydrated again.
