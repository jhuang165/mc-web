# Ring ticks 2 (batch 26)

## Summary

- Random ticks and fire's scheduled ticks now run in the headless ring, with the same per-chunk rules as the window: 3 draws per ticking section (read from `mt.g`), shared generator order kept.
- A ring block ticks only if its column is writable and the chunks within its reach are held (4 default, 5 leaves and fluids, 8 saplings and mushrooms). Native has no such test; this is a port adaptation because missing ring columns read as air.
- `HeadlessColumns` keeps per-section refcounts of randomly-ticking blocks, `randomTickChunks` supplies the ring chunk list, `reaches` tests coverage.
- `World.chunkAt` has a miss cache; `isReadable` lets weather logic read ring cells. `wrapRandomTickLight` gives ring cells light.
- Tool `tools/verify-ring-random-ticks.mjs` writes `public/research/ring-random-ticks-reference.json`. Docs: natural-spawning.md Round 8, parity.md.

## Verification

- `npm test`: 4593 pass, 0 fail. `npm run build` passes.
- 500-tick ring versus all-resident replay matches; reverting the fire gate fails it.
- Node CPU, ring fluid over 600 ticks: sum 1150 to 750 ms, p95 13 to 8.4 ms, max about 70 to about 42 ms. Ring weather ticks: median 0.4-0.5 ms, p95 about 1 ms, max 5-6 ms.
- Muted browser sample (45 s): about 90k block ticks, weather tick mean 1.0 ms and max 11 ms, no long tasks, leaves decayed.

## Follow-ups

- Nether and End have no random ticks.
- Reach table is conservative except leaves; big trees may need more than 8.
- Rim chunk edge blocks wait; refcounts warm over 30-50 ticks.
- Redstone and pistons keep the 8-neighbour guard.
- Ring edits get no mesh or light until resident.
- Farming ring path uses the port's own hash randomness.
- Browser timings came from one short sample with other tracks running.
