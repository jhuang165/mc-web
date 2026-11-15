# Batch 74 recheckgaps74: where recheckGaps runs, and what it changes

## Summary
- `tools/probes/LightGapsProbe.java`, `tools/verify-light-gaps.mjs`, `public/research/light-gaps-reference.jsonl`: executed probe over the unchanged `World`/`Chunk` classes (server pass, client pass with isRemote true, no pass, plus the batch 30 server-copy variants).
- `src/recheckgaps-b74.test.js`: replays the record (4 tests) and runs `NativeLight` in server, client and no-pass modes over the two edge scripts.
- `public/research/light-engine.md`: new "Batch 74" section, and the batch 29 claim "the client never runs recheckGaps" marked superseded.
- No port code changed: `NativeLight.recheckGaps(c, remote)` / `tickChunk` already implement both sides.

## Evidence
- Bytecode-read: `Chunk.func_150804_b` is called by `mt` (WorldServer) and by `bjd.d` (ChunkProviderClient.unloadQueuedChunks), which `bjf.b` (WorldClient.tick) calls every tick for every client chunk with `elapsed > 5 ms`. It runs recheckGaps(world.isRemote) only if the gap flag is set, the provider has sky, and the argument is false. `fillChunk` sets isLightPopulated and isTerrainPopulated, so a client chunk never light-populates. recheckGaps needs the 33 x 33 area round the chunk centre loaded; isRemote true handles one flagged column and returns.
- Executed: in 8 scripts (about 400 snapshots) the server pass, the client pass and no pass leave every sky, block and height cell equal. Flags only: a client with 36 flagged columns clears 35, 34, 32, 5, 0 after the load and 1, 3, 30, 300 ticks; the server clears all at once; with no pass they stay.
- Executed: the batch 30 nine-cell floating-block difference is the missing section 4 object on the client (null-section rule), not a missing pass; S, C and N are equal for it.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-light-gaps.mjs` (20 records).
- `node --test src/recheckgaps-b74.test.js src/light-client-server.test.js src/light-engine.test.js src/native-light.test.js src/streaming-light.test.js`: 58 pass, 0 fail.
- Full npm test not run (batch rule). No browser checks.

## Follow-ups
- The gap "client lacks recheckGaps" was wrong twice: native runs it on the client (one column a tick) and it changes no light. Nothing visible to port.
- Not covered: fresh generated terrain chunks on the client, Nether/End (hasNoSky skips the pass), the 5 ms timing argument (true skips the pass that call).
