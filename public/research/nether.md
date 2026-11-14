# Nether groundwork (portal, nether wart, terrain generator)

Target: Minecraft Java 1.7.10 (client SHA-1 e80d9b3bf5085002218d4be59e668bac718abbc6). Pure, probe-verified modules; there was no dimension switch when this was written; Batch 68 (docs sweep): it exists now (`src/dimension-live.js`, see `dimensions.md`). This does not claim Nether parity.

## Portal block (original 90, port slot 164)

- `src/nether-portal.js`: `PortalSize` (BlockPortal.Size, amq: 2x3 to 21x21, either axis, axis in meta 1 or 2), `tryLightPortal` (func_150000_e), `portalIntact` and `portalNeighborsChanged` (onNeighborBlockChange cascade, depth first), `portalBounds` (0.125 half width), `portalSideRendered` (shouldSideBeRendered), `portalSpawnPosition` (updateTick pigman chance, pure `(world,x,y,z,random,opts) -> position|null`), `portalDisplayTick`.
- `src/nether-portal-live.js` (`NetherLive`): wraps `world.onChange`; fire placed anywhere lights a complete obsidian frame, a portal whose frame or neighbour changed is removed, a wart without soul sand drops seeds; random tick grows the wart.
- Light 11, light opacity 0, no collision, animated translucent portal.png (one tick per frame), portal particles via `display-ticks.js`, `/setblock` and region import/export through the block registry (original 90 and 115).

## Nether wart (original 115, port slot 170, seed item 372 = internal 386)

- `src/nether-wart.js`: plants on soul sand only, 4 ages (meta 0..3) by random tick (nextInt(10) == 0 below age 3), drops 1 seed, or 2 + nextInt(3) when mature (plus nextInt(fortune + 1)), crossed-quad render with the three original stage textures, bounds [0,0,0,1,0.25,1].

## Probes and results

- `tools/probes/PortalWartProbe.java` + `tools/verify-portal-wart.mjs` -> `public/research/portal-wart-reference.json` (573 records: 260 frame, 53 cascade, 16 bounds, 72 side, 14 pigman x 30000 ticks, 40 wart growth x 200 ticks, 13 support, 8 placement, 96 drops, 1 wart bounds). Drives the real obfuscated classes (amp, amq, amf) over doubles of World.
- `src/nether-portal-wart.test.js` replays all of it (575+ tests): frame cells and write counts, cascades, bounds, sides, pigman spawn ticks and Random state, growth, support, placement, drops and Random state, plus the live hooks, registry round trip and no holes in BLOCKS.
- The probe's side records for a fire neighbour are an artifact: fire without support removes itself and notifies the lone portal away. The test replays that by not placing the portal.

## Terrain generator

## Nether generator (src/nether-generator.js)

Port of 1.7.10 ChunkProviderHell (aqv), MapGenCavesHell (aqy), WorldGenHellLava (ars), WorldGenFire (arq), WorldGenGlowStone (ary/arr), reusing WorldGenMinable and WorldGenFlowers.

API
- `new ChunkProviderHell(seed)`; `generateChunk(cx,cz)` returns `{blocks: Uint16Array(32768), index (x*16+z)*128+y}`. It reseeds hellRNG (`cx*341873128712 + cz*132897987541`) on each call, then runs terrain, surface and caves.
- `populate(world,cx,cz)` does not reseed, so hellRNG carries on from generateChunk. Order: HellLava x8, fire, glowstone1, glowstone2 x10, mushrooms, quartz x16, hidden lava x16.
- `NetherGenWorld` is a GenWorld subclass. Chunks are 128 high, converted to the 256 stride. It has a lazy halo and BlockFire.onBlockAdded semantics: portal Size scans, the doesBlockHaveSolidTopSurface reads, and scheduleBlockUpdate(30+rand.nextInt(10)). An optional `createPortal` hook receives portal frames.
- `NetherArea` generates N x N chunks, then populates x outer / z inner. Neighbours outside the area are filled lazily from the halo.

Exact replay: nether-reference.json holds 64 chunk records (8 seeds x 8 chunks) and 8 population records. Staged terrain/surface/caves hashes, counts, hellRNG nextLong, world call and write hashes, area hash and pending ticks all match the unchanged original classes (74/74 tests in src/nether.test.js). Regenerate with `MC_RESEARCH=... node tools/verify-nether.mjs`.

Not exact
- The Nether fortress was a gap of the batch-6 generator; it is ported by the fortress track (see fortress.md). The nether-reference.json probe still uses a no-fortress stub of atd, and its origins are fortress-free.
- canNeighborBurn and non-opaque solid-top checks are not ported.
- The Size full scan beyond the frame check is handed to the `createPortal` hook.

## Gaps

- Standing in a portal does nothing: no dimension switch, no Teleporter, no portal-cooldown or nausea overlay.
- Live pigman spawning from portals (batch 14): `NetherLive.randomTick` runs `portalSpawnPosition` on a portal block's random tick (Overworld only, `doMobSpawning`, `nextInt(2000) < difficulty id`, no draw when gated) and `EntityWorld.spawnPortalPigman` creates the pig zombie (random yaw, `onSpawnWithEgg`, portal cooldown 300). The roll and position are probe-replayed; the probe also records a second entity ("wg", a chicken jockey) on one spawn, which the port's `onSpawnWithEgg` draws and drops.
- The `portal.portal` sound file is not in public/audio (the importer regex now includes `portal\/`, the importer was NOT run). The ambient call is silent until it is imported.
- `portalDisplayTick` (particles and ambience) was written from the decompile and is not probe-verified.
- Wart planting by item use and the Creative listing rely on existing paths (item 386 was already listed); wart placement was not exercised in a browser.
- canNeighborBurn and non-opaque solid-top checks are not ported in the generator.
- Nothing here was checked in a browser (no dev server, no audio, per the rules).
