// BiomeGenBase facts for this build's world presets (public/research/snow-reference.json,
// "biomes", from the original classes): temperature and rainfall (floats), canSpawnLightningBolt
// (BiomeGenBase.e) and getEnableSnow (d). meadow is Plains, alpine is Extreme Hills and island
// is Plains; snowy is Ice Plains. A leaf module: lighting.js, weather.js, snow.js and
// block-textures.js read it, and world.js reaches it through them while still loading.
const f = Math.fround;
export const BIOME_FACTS = Object.freeze({
  meadow: Object.freeze({ id: 1, name: "Plains", temperature: f(0.8), rainfall: f(0.4), canSpawnLightning: true, enableSnow: false }),
  alpine: Object.freeze({ id: 3, name: "Extreme Hills", temperature: f(0.2), rainfall: f(0.3), canSpawnLightning: true, enableSnow: false }),
  island: Object.freeze({ id: 1, name: "Plains", temperature: f(0.8), rainfall: f(0.4), canSpawnLightning: true, enableSnow: false }),
  snowy: Object.freeze({ id: 12, name: "Ice Plains", temperature: f(0), rainfall: f(0.5), canSpawnLightning: false, enableSnow: true }),
});
export const biomeFacts = (biome) => BIOME_FACTS[biome] || BIOME_FACTS.meadow;
// BiomeGenBase.getFloatTemperature(x, y, z): the height term only applies above y 64, and
// this world is 64 blocks high, so it is the biome's own temperature.
export const biomeTemperatureAt = (biome) => biomeFacts(biome).temperature;
