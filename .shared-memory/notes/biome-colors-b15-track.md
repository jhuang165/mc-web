# Biome colours track (batch 15, branch b15-biome-colors)

Owner: claude-b15-biome-colors. Base main 01887b4, app 0.44.0 (version not bumped).

Changed: `src/biome-colors.js` (+test), `tools/probes/BiomeColorProbe.java`, `tools/verify-biome-colors.mjs`, `public/research/biome-colors-reference.json`, `src/block-textures.js` (terrain grey atlas plus item-colour atlas, grass_side_overlay), `src/scene.js` (mesher tint, per-frame sky temperature), `src/weather.js` (`precipitationKind`), `src/weather-renderer.js` (per-column rain/snow), docs.

Facts: mutated biomes use the vanilla (x, y, y) slip; 3x3 averages are integer per channel; fixed spruce/birch leaf colours; End getSkyColorByTemp returns 0.

Remaining: lily pad tinted on all faces, double plant item colour unverified, Fast overlay gating and rain splash/sound per column bytecode-read only, decoration parity untouched.
