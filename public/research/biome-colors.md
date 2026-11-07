# Biome colours and per-biome weather (Minecraft Java 1.7.10)

Batch 15 track. Parity target is 1.7.10; this does not claim full parity (see [remaining gaps](remaining-gaps.md)).

## Evidence

`tools/probes/BiomeColorProbe.java` loads the real 1.7.10 classes from the jar (reflection, with a `java.lang.reflect.Proxy` for `IBlockAccess`) and the shipped `grass.png`/`foliage.png`. `tools/verify-biome-colors.mjs` writes `biome-colors-reference.json` (375 records: 1 colormap digest, 61 biomes at 9 sample positions/heights, the swamp noise grid, 288 block colour-multiplier records and 24 item colours). `src/biome-colors.test.js` replays every record against `src/biome-colors.js`.

Classes (obfuscated): `ahu` BiomeGenBase, `aiv` Swamp, `aif` Forest, `ail` Mesa, `ain` mutated, `aha`/`agx` ColorizerGrass/Foliage, `alh` BlockGrass, `alt`/`aml`/`amh` leaves, `alw` BlockLiquid, `aoh` Vine, `ane` Reed, `anz` TallGrass, `ako` DoublePlant, `aoj` LilyPad, `blt` EntityRenderer, `blm` RenderBlocks.

## Implemented

| Rule | Where | Status |
| --- | --- | --- |
| Colormap index `((int)((1-rain*t)*255))<<8 \| (int)((1-t)*255)`, t = clamped temperature at (x, y, z) with the above-y64 noise term | `biome-colors.js` | probe |
| Swamp grass (noise at 0.0225: below -0.1 is 0x4C763C, else 0x6A7039), foliage 0x6A7039, water 0xE0FFAE | `biome-colors.js` | probe |
| Roofed Forest grass `((c & 0xFEFEFE) + 0x28340A) >> 1`; Mesa grass 0x90814D, foliage 0x9E814D | `biome-colors.js` | probe |
| Mutated biomes delegate to the parent, including the vanilla `(x, y, y)` argument slip | `biome-colors.js` | probe |
| Grass block and leaves: 3x3 per-channel average (integer, /9, &255); spruce 0x619961 and birch 0x80A755 fixed | `scene.js` mesher | probe (288 block records) |
| Vine: foliage at the block; reed and tall grass: grass at the block, dead shrub white; double plant: grass for meta 2 and 3 | `scene.js` | probe |
| Water: 3x3 average of the biome water colour; lava white; lily pad 0x208030 | `scene.js` | probe |
| Item colours (grass 0x7CBD6B, leaves 0x48B518 ...) | `block-textures.js` item atlas | probe |
| Grass side: base texture plus a tinted `grass_side_overlay` quad, only with Fancy graphics and an unsnowed top | `scene.js` | bytecode-read, not probed |
| Rain or snow per column (nothing without `canSpawnLightningBolt`/`getEnableSnow`, snow below 0.15 at the column) | `weather.js` `precipitationKind`, `weather-renderer.js` | bytecode-read |
| Rain particles and the rain sound only on columns that rain | `weather.js` `rainParticles` | bytecode-read |
| Sky colour from the temperature at the viewer's block each frame | `scene.js` | follows `World.getSkyColor` |

Rendering design: chunk meshes use a grayscale terrain atlas and per-vertex tint (the `shade` attribute multiplies the texture); everything else (drops, hand, particles, falling blocks, icons) uses the item atlas with native item colours. `BiomeColorField` caches the biome per column.

## Gaps

- Lily pad is tinted on every cube face of its quad set, not only the top (not verified).
- Double-plant item colour is unverified.
- Fast-graphics overlay gating and rain splash/sound per column are read from bytecode, not probed.
- Fog colour still uses the existing `fogColor` path with the viewer's temperature; the End draws its own sky.
- Biome decoration parity is not touched by this track.
