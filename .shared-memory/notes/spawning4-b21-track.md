# spawning4 (batch 21): headless ring for natural spawning

## Summary

Natural spawning now uses the whole 15 x 15 non-edge chunk set (plus the 2-chunk walk reach) instead of only the 8 x 8 streamed window. Chunks outside the window are held as headless data (`src/headless-columns.js`, radius 10 = 441 columns, prune at 12), with no meshes. Light for them comes from `RingLight` (exact lazy search, `src/headless-env.js` routes the environment). Spawn pass swaps `EntityWorld.world` for a `view` that reads window then ring. Data comes from the page's population cell cache, the generation worker (`type: 'ring'`, lowest priority), or synchronous generation (Nether, End, gen 12 without worker). Ring mobs are frozen (outside the ticking window), counted for the cap, not rendered, saved with `mobs.serialize()`, swept by `sweepFrozen`. Branch batch21-spawning4. Does not claim full parity.

## Native evidence

- Bytecode-read: `ahb.a(sa, boolean)` 32-block loaded-area check for ticking; `ms.d`/`ms.c` load-or-generate any requested chunk; `ms.b()` only unloads queued chunks.
- Probed: existing seeded spawn replays (on doubles supplying every chunk) still pass; batch-20 light audit that `LightVolume` is compared to; new test shows ring-backed world equals all-resident world for 260 ticks (same totals, World.rand seeds, mob lists), and `RingLight` equals `StreamingLight` on 4000 resident + 500 headless-only cells.
- Assumed: walk reach of 2 chunks (from the ported loop bounds); view distance at least 8; freezing ring mobs is the port's policy, not native; native entity ticking in these chunks is bytecode-read only.

## Tests

- New `src/headless-columns.test.js`: 8 tests, all pass.
- Full `npm test`: 4166 tests, 4166 pass, 0 fail. `npm run build`: passes.
- Chrome (headless, port 5184, `--mute-audio`, `?silent`, new default world, gen 18):
  - Ring fills to 441 columns (about 10.5 MB) within 20 s.
  - Spawn pass 0.13 to 0.43 ms per tick average (1.7 ms in first 10 s while filling), max 5 to 19 ms. Control with ring off about 0.15 ms.
  - Frame median 17.2 to 17.6 ms, p95 18.7 to 19.8 ms with ring; control 17.1 / 19.3 (60 Hz vsync).
  - Heap 238 to 272 MB with ring vs about 256 MB without: within noise of about 10 MB.
  - Travel runs (150 blocks per hop, 3 hops ring on, 3 off): ring held 534 to 573 columns, pruned columns, received worker columns (192, 384, 576); frame median 16.3 to 17.6 ms with ring and 17.4 to 17.9 ms without; p95 19.8 to 20.2 ms for both. Max frame spikes (0.9 to 1.2 s with ring, 2.1 to 2.7 s without) come from window and cell generation on the page and occur in both modes. Up to 186 mobs outside the window.
  - Harness note: teleport hops are not movement streaming, so these are not walking measurements.

## Remaining gaps

- Player edits outside the resident window are not applied to ring columns.
- Ring mobs are frozen; they do not move or attack until they enter the ticking window.
- Nether and End rings fill slowly (about 30 s; about 37 and 11 ms per column synchronously).
- Cells within about 15 blocks of the ring rim read as air for light.
- Until the ring fills (10 to 20 s in a fresh world) unready chunks are skipped as before.
- A ring worker request can delay a window cell by up to about 1 s (requests are serial).
- Worlds without a Worker and with populated generation (13 or later) get no ring.
- Spider jockey gear unverified.
- Inhabited-time local difficulty uses the port's world-level value.

## Proposed remaining-gaps lines

- Natural spawning: chunks outside the 8 x 8 window now spawn from a headless ring (batch 21), but ring mobs are frozen until they enter the ticking window, player edits there are not applied, and worlds without a Worker at generation 13+ have no ring.
- Natural spawning: Nether and End rings take about 30 s to fill; Overworld about 10 to 20 s.
