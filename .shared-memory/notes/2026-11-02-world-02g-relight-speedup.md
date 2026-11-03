# WORLD-02g exact relight speed-up (0.30.0)

Commit e5a65e9 on github main.

- `LightVolume.relight` (src/lighting.js) now:
  - seeds sky light only from open cells below the tallest in-box neighbour height;
  - reads blocks a column at a time through the new `World.columnBlocks(x, z)`. StreamingLight forwards it, and test doubles fall back to `get`;
  - uses 256-entry opacity and may-emit tables. The `emission` callback is now only asked about ids with `lightEmission(b, true) > 0`;
  - seeds block light from the emitter list;
  - computes inflow without closures.
- Output is byte-identical to the previous solver (7 worlds, 420 edit relights).
- New `lighting.test.js` reference-solver test. It fails if the neighbour-height check is removed.
- Timings:

  | Measurement | Before | After |
  |---|---|---|
  | Streamed shift, node | ~92 ms | ~15 ms |
  | Streamed shift, Chrome | ~100 ms | 19–23 ms |
  | Full build | 265 ms | ~80–95 ms |

- Tests 1091/1091; the build passes.
- Not re-measured: the in-game `syncChunks` timing. The remeshing cost is unchanged.
- Open:
  - per-chunk light arrays and storage;
  - villages, strongholds and temples in streamed worlds (needs native research with a JDK);
  - native chunk order.

The original claim had expired before finish_work, so this note is the handoff.
