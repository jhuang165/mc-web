# Lighting, sky and world rendering (0.9)

Sources: `javap -c -p -constants` on the 1.7.10 client JAR, read through the 1.7.10 SRG mapping. The main classes are EntityRenderer (`blt`), RenderGlobal (`bma`), RenderBlocks (`blm`), WorldProvider, World, Block, BiomeGenBase, RenderItem and RenderHelper. Each formula in `src/lighting.js` names the method it comes from. Float steps use `Math.fround`, so the day cycle and the lightmap match Java's float rounding.

## Implemented

- **Light volume** (`LightVolume`): sky and block light from 0 to 15, propagated to `World.computeLightValue`'s fixed point. A cell takes its brightest neighbour minus `max(1, lightOpacity)`.
  - Opacity: water 3, leaves 1, glass, torches and plants 0, solid blocks 255.
  - Emission: torch 14, lit furnace 13.
  - Cells at or above the column's height map get sky light 15.
  - An edit relights columns within 15 blocks of it. The returned change box drives chunk rebuilds.
  - Torches, glass, farmland, chests and plants use `useNeighborBrightness` (the brightest of their six neighbours).
- **Lightmap** (`EntityRenderer.updateLightmap`): a 16×16 texture, sampled with linear filtering like the GL lightmap unit. It applies:
  - sun brightness × 0.95 + 0.05;
  - the warm block-light curve with torch flicker (`TorchFlicker`, the random walk from `EntityRenderer.updateTorchFlicker`);
  - the 0.96 / 0.03 floor;
  - the Brightness option (`gammaSetting`, "Moody" to "Bright").
- **Smooth lighting and ambient occlusion** (`RenderBlocks.renderStandardBlockWithAmbientOcclusion`):
  - Per-vertex AO is the average of the face sample and three edge/corner samples, with 0.2 for normal cubes.
  - Brightness uses `getAoBrightness`, where zero samples take the face centre.
  - A corner sample is read only when one of the two edge cells one layer further out lets light through (`getCanBlockGrass`). Otherwise the corner reuses the first edge sample.
  - Face shades: top 1.0, bottom 0.5, z 0.8, x 0.6.
  - A lit furnace uses the flat (non-AO) path with neighbour brightness, as the original does.
- **Day cycle** (`WorldProvider.calculateCelestialAngle`, `World.calculateSkylightSubtracted`): skylight drops by up to 11 at midnight. `getSunBrightness` feeds the lightmap.
- **Sky** (`RenderGlobal.renderSky`):
  - Sky colour from `BiomeGenBase.getSkyColorByTemp` (plains 0.8 → 121, 167, 255) times the day factor.
  - The +16 sky plane and the dark void plane below the horizon.
  - The sunrise/sunset fan from `WorldProvider.calcSunriseSunsetColors`, flipped by the sign of the sun direction.
  - The sun (±30 at distance 100) and moon (±20, eight phases) on the celestial rotation.
  - 1,500 candidate stars from `java.util.Random(10842)`, of which 780 lie inside the unit shell. They are drawn additively with `getStarBrightness`.
- **Fog** (`EntityRenderer.updateFogColor` and `setupFog`):
  - The fog colour blends the sky colour towards the provider fog colour by render distance, and towards the sunrise colour when looking at the sun.
  - It is scaled by the eye cell's light, eased by 0.1 per frame like `fogColor2`/`fogColor1`.
  - Normal fog is linear from 0.75 × far to far, measured as a radial distance (NV radial mode). Sky fog runs from 0 to far.
  - Underwater fog is exponential, density 0.1, with colour (0.02, 0.02, 0.2) scaled by the eye light.
- **Clouds** (`RenderGlobal.renderCloudsFancy`):
  - Fancy 12×4×12 cells from `clouds.png`; empty texels have alpha 1, so the filled test is alpha > 25.
  - Shades: top 1.0, bottom 0.7, x 0.9, z 0.8. Alpha 0.8.
  - Drift 0.03 per tick and the original origin snapping, using `getCloudColour`.
  - A depth-only pass first, then colour, as fancy graphics does. Cloud fog is the standard world fog.
- **Water** (`RenderBlocks.renderBlockLiquid`):
  - Per-corner heights from `getLiquidHeight`: water neighbours weigh 11/9 × 11, open neighbours 1, and water above gives a full corner.
  - Still water on top (16 × 32 frames, frame time 2). Sides use the flowing texture `water_flow.png` (32 frames, frame time 1, the half-width u range).
  - The top brightness is the larger of the cell's and the cell above's.
  - Fancy graphics' translucent pass: depth first, then colour.
- **Plants**:
  - Tall grass and flowers get `Block.getBlockBoundsOffset`-style jitter from the 3129871 / 116129781 position hash.
  - Crops draw as two crossed pairs at 0.25 and 0.75, 1/16 below the block.
  - Fancy leaves render leaf-to-leaf faces.
- **Entities and items** (`RenderHelper.enableStandardItemLighting`):
  - Two directional lights at (0.2, 1, −0.7) and (−0.2, 1, 0.7), diffuse 0.6 plus 0.4 ambient, multiplied by the lightmap texel at the entity's brightness.
  - First-person items use the same lights, transformed to view space.
  - The hurt flash is the red (brightness, 0, 0, 0.4) overlay.
- **Dropped items** (`RenderItem.doRender`, fancy graphics):
  - Bob `sin(age/10 + hover) × 0.1 + 0.1`, spin `age/20 + hover`.
  - Blocks are 1/4-scale cubes; other items are 1/2-scale extruded sprites.
  - One to five copies (>1, >5, >20, >40), with block copies scattered by `Random(187)`.
- **Selection box**: black lines at 0.4 alpha on the box grown by 0.002.
- **Colour**: the GL pipeline works in display space. Three.js colour management is off, with linear output and textures without a colour space, so texture × light products match the original.

## Known differences

- **Void fog** is implemented for the colour term and, in 256-high worlds only, the `setupFog` distance term; see `void-fog.md`.
- **Cloud height**: sea level + 65, since this world is shorter than vanilla's 128-block cloud layer.
- **Burning** uses an orange overlay as a stand-in; the fire texture overlay on entities is not drawn.
- **Missing effects**: no weather (rain/snow colour darkening, rain fog), fog distance follows the block-based View distance option rather than chunk render distance, no anisotropic or mipmap options, no Fast graphics mode, no entity shadows.
- **Precision**: light updates relight whole 31×31 column areas rather than using the original's queue-based incremental updates. The final light values are the same at the fixed point; the timing within a tick is not. `light-engine.md` replays the unchanged `updateLightByType`/Chunk light code against the port on 18 scenarios and lists the documented differences (eager lateral light at generation, native stale light, native skip beside unloaded chunks).
- **Dev handle**: a `window.__mc` handle (scene, world, survival, position, look, teleport) exists only in Vite dev builds, for browser verification.

## Tests

`src/lighting.test.js` covers:

- the brightness table, celestial angle, skylight subtraction and sun brightness;
- the plains sky colour;
- `JavaRandom` against JDK output (0.12987703, 0.037620723, 0.883435442313338) and the 3,120 star vertices;
- lightmap corners, gamma and torch warmth;
- `getAoBrightness`;
- torch and water light propagation and light removal;
- AO under an overhang.

## Batch 27 additions

- The streamed Nether and End use `NativeLight` (hasNoSky, real heightMap, block light), `?nativeLight=0` falls back. Sky reads 15 above the heightMap of a missing section and 0 elsewhere, as in the unchanged classes; the End lightmap ignores the sky nibble.
- Edits within 17 blocks of the window ring and edits into ring columns are replayed once they are light-resident (a port model, exact for placements, approximate for place-and-remove pairs; see `light-engine.md`).
- `world.set` without `updateBlock` is picked up by the block tap; 64 distinct changed cells in a chunk reset relight checks like a chunk resend.
- Evidence: `light-engine3-reference.json` (`tools/probes/LightEngine3Probe.java`), replayed by `src/native-light-ring.test.js`; `src/streaming-light-ring.test.js` covers the wiring.

