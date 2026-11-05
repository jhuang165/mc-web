import { NETHER_FENCE } from "./nether-blocks.js";
import { JavaRandom } from "./java-random.js";
export { JavaRandom } from "./java-random.js";
// Minecraft Java 1.7.10 light rules, decoded with javap from WorldProvider
// (aqo), World (ahb), BiomeGenBase (ahu), EntityRenderer (blt), RenderBlocks
// (blm), RenderGlobal (bma) and Block (aji). The rain, thunder and lightning
// terms are optional trailing arguments that default to 0 (clear sky); weather.js
// supplies them. See public/research/lighting.md and weather.md.
import { isStair } from "./stairs.js";
import { SIZE, HEIGHT, FIRE, WEB, LADDER, CACTUS, REEDS, LILY_PAD, TNT, FENCE, RAIL, MOB_SPAWNER, ANVIL, ENCHANTING_TABLE, WOODEN_DOOR, GLASS_PANE, DOUBLE_STONE_SLAB, END_PORTAL_FRAME, FLOWER_POT, isPlant, normalCube, opaqueCube } from "./world.js";
import { lightOpacity3 } from "./blocks-0-40.js";
import { biomeFacts } from "./biomes.js";
import { lightEmission2, lightOpacity2, useNeighborBrightness2 } from "./redstone-blocks-2.js";

const f = Math.fround,
  PI_F = f(Math.PI),
  clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// MathHelper (qh) reads sine and cosine from a 65536-entry float table.
const SIN = new Float32Array(65536);
for (let i = 0; i < 65536; i++) SIN[i] = Math.sin((i * Math.PI * 2) / 65536);
export const mhSin = (v) => SIN[Math.trunc(f(v * f(10430.378))) & 65535];
export const mhCos = (v) => SIN[Math.trunc(f(f(v * f(10430.378)) + 16384)) & 65535];
const cycle = (angle) => mhCos(f(f(angle * PI_F) * 2));

// WorldProvider.generateLightBrightnessTable for the overworld.
export const BRIGHTNESS = Array.from({ length: 16 }, (_, i) => {
  const g = f(1 - f(i / 15));
  return f(f(1 - g) / f(f(g * 3) + 1));
});

// Block.lightOpacity, lightValue, useNeighborBrightness (u), the AO value
// (func_149685_I: 0.2 for normal cubes) and getCanBlockGrass (s: materials
// that let grass through, used by smooth lighting to decide corner samples).
export function lightOpacity(b) {
  if (b >= 140 && b <= 142) return 0; // stained glass, its pane and carpet (colored-blocks-reference.json: lightOpacity 0)
  if (b >= 132 && b <= 138) return lightOpacity3(b); // dropper, hopper, brewing stand, powered/detector/activator rails (blocks-0-40.js)
  if (b >= 119 && b <= 131) return lightOpacity2(b); // redstone torches, lamps, block, button, plates, comparators, sensor, moving piston and glowstone (redstone-blocks-2.js)
  if (b===72||b===73) return 0;
  if (b >= END_PORTAL_FRAME && b <= FLOWER_POT) return 0; // end portal frame, cauldron and flower pot (stone-utility-reference.json); slabs keep 255
  if (b >= 116 && b <= 118) return 0; // piston base, sticky piston and head: isOpaqueCube false
  if (b >= 107 && b <= 114) return 0; // redstone components (redstone-blocks-reference.json): dust, lever, plates, button, repeater, hook, tripwire
  if (b >= WOODEN_DOOR && b <= GLASS_PANE) return 0; // doors, iron bars and glass panes are not opaque cubes
  if (b === 175 || b === 176) return 0; // BlockSign: not opaque, light opacity 0 (sign-reference.json facts)
  if (b === 0 || b === 9 || b === 20 || b === 41 || b === 162 || b === 163 || b === 42 || b === FIRE || b === LADDER || b === CACTUS || b === REEDS || b === LILY_PAD || b === FENCE || b === NETHER_FENCE || b === RAIL || b === MOB_SPAWNER || b === ANVIL || b === ENCHANTING_TABLE || isPlant(b)) return 0;
  if (b === 5 || b===71 || b === WEB) return 1;
  if (b === 10 || b === 47) return 3; // water; ice (setLightOpacity(3))
  if (b >= 167 && b <= 169) return 0; // fence gate, trapdoor, cobblestone wall (shaped-blocks.js); the wood slabs keep 255
  if (b === 46) return 0; // snow layer: not an opaque cube (probe: snow-reference.json "blocks")
  return 255;
}
// Lava: setLightLevel(1.0F), so (int)(15 * 1.0) = 15.
// Fire: setLightLevel(1.0F), 15 as well.
export const lightEmission = (b, lit = false) => (b === 148 ? 15 : b >= 119 && b <= 131 ? lightEmission2(b) : b===134?1:b===163?7:b===65?9:b===75?1:b === 42 || b === FIRE ? 15 : b === 20 ? 14 : b === 14 && lit ? 13 : b === END_PORTAL_FRAME ? 1 : 0);
export const useNeighborBrightness = (b) => (b >= 165 && b <= 169) || isStair(b) || useNeighborBrightness2(b) || b === 82 || (b >= DOUBLE_STONE_SLAB && b <= FLOWER_POT) || b === 20 || b === 9 || b === 41 || b === 162 || b === 163 || b === 29 || b === 30 || b === FENCE || b === NETHER_FENCE || b === RAIL || b === MOB_SPAWNER || isPlant(b);
const AO_SOLID = f(0.2);
// Block.getAmbientOcclusionLightValue uses isBlockNormalCube (blocksMovement and a
// normal render), which TNT passes although it is not isNormalCube.
export const aoValue = (b) => (normalCube(b) || b === TNT ? AO_SOLID : 1);
export const aoClear = (b) => b === 0 || b === 20 || b === RAIL || b === FIRE || b === ANVIL || isPlant(b);

// WorldProvider.calculateCelestialAngle.
export function celestialAngle(ticks, partial = 0) {
  const j = ((Math.trunc(ticks) % 24000) + 24000) % 24000;
  let a = f(f(f(j + partial) / 24000) - 0.25);
  if (a < 0) a = f(a + 1);
  if (a > 1) a = f(a - 1);
  const g = a;
  a = f(1 - f((Math.cos(a * Math.PI) + 1) / 2));
  return f(g + f(f(a - g) / 3));
}
// The rain and thunder dimming shared by getSunBrightness and
// calculateSkylightSubtracted: `rain` is getRainStrength and `thunder`
// getWeightedThunderStrength; each takes up to 5/16 of the light.
const dim = (s, rain, thunder) => {
  s = f(s * (1 - f(rain * 5) / 16));
  return f(s * (1 - f(thunder * 5) / 16));
};
// World.getSunBrightness (func_72971_b), used by the lightmap.
export function sunBrightness(angle, rain = 0, thunder = 0) {
  const s = dim(f(1 - clamp01(f(1 - f(f(cycle(angle) * 2) + f(0.2))))), rain, thunder);
  return f(f(s * f(0.8)) + f(0.2));
}
// World.calculateSkylightSubtracted: 0 at noon, 11 at midnight; 3 in rain at
// noon and 5 in a thunderstorm.
export function skylightSubtracted(angle, rain = 0, thunder = 0) {
  const s = f(1 - dim(f(1 - clamp01(f(1 - f(f(cycle(angle) * 2) + 0.5)))), rain, thunder));
  return Math.trunc(f(s * 11));
}
// World.getStarBrightness (func_72880_h).
export function starBrightness(angle) {
  const s = clamp01(f(1 - f(f(cycle(angle) * 2) + 0.25)));
  return f(f(s * s) * 0.5);
}
// java.awt.Color.HSBtoRGB.
export function hsbToRgb(hue, saturation, brightness) {
  const h = f(f(hue - f(Math.floor(hue))) * 6),
    fr = f(h - f(Math.floor(h))),
    p = f(brightness * f(1 - saturation)),
    q = f(brightness * f(1 - f(saturation * fr))),
    t = f(brightness * f(1 - f(saturation * f(1 - fr)))),
    c = (v) => Math.trunc(f(f(v * 255) + 0.5)),
    rgb = [[brightness, t, p], [q, brightness, p], [p, brightness, t], [p, q, brightness], [t, p, brightness], [brightness, p, q]][Math.trunc(h)];
  return rgb.map(c);
}
// BiomeGenBase.getSkyColorByTemp, as 0-255 channels.
export function skyColorByTemp(temperature) {
  let t = f(temperature / 3);
  t = t < -1 ? -1 : t > 1 ? 1 : t;
  return hsbToRgb(f(f(0.62222224) - f(t * f(0.05))), f(0.5 + f(t * f(0.1))), 1);
}
// BiomeGenPlains is 0.8; BiomeGenHills (this build's alpine preset) is 0.2.
// BiomeGenSnow (Ice Plains, the "snowy" preset) is 0.0. See biomes.js.
export const biomeTemperature = (biome) => biomeFacts(biome).temperature;
// Pulls a colour toward its grey: grey = (0.3 r + 0.59 g + 0.11 b) * shade, with
// k = 1 - strength * keep (World.getSkyColor and getCloudColour).
const toGrey = (c, shade, strength, keep) => {
  const g = f(f(f(f(c[0] * f(0.3)) + f(c[1] * f(0.59))) + f(c[2] * f(0.11))) * shade),
    k = f(1 - f(strength * keep));
  return c.map((v) => f(f(v * k) + f(g * f(1 - k))));
};
// World.getSkyColor. `lightning` is World.lastLightningBolt (a tick count) and
// `partial` the frame fraction it is eased with.
export function skyColor(temperature, angle, rain = 0, thunder = 0, lightning = 0, partial = 0) {
  const b = clamp01(f(f(cycle(angle) * 2) + 0.5));
  let c = skyColorByTemp(temperature).map((v) => f(f(v / 255) * b));
  if (rain > 0) c = toGrey(c, f(0.6), rain, f(0.75));
  if (thunder > 0) c = toGrey(c, f(0.2), thunder, f(0.75));
  if (lightning > 0) {
    const l = f(Math.min(1, f(lightning - partial)) * f(0.45));
    c = [f(f(c[0] * f(1 - l)) + f(f(0.8) * l)), f(f(c[1] * f(1 - l)) + f(f(0.8) * l)), f(f(c[2] * f(1 - l)) + l)];
  }
  return c;
}
// WorldProvider.getFogColor.
export function providerFogColor(angle) {
  const b = clamp01(f(f(cycle(angle) * 2) + 0.5));
  return [f(f(0.7529412) * f(f(b * f(0.94)) + f(0.06))), f(f(0.84705883) * f(f(b * f(0.94)) + f(0.06))), f(f(b * f(0.91)) + f(0.09))];
}
// WorldProvider.calcSunriseSunsetColors: RGBA, or null outside dawn and dusk.
export function sunriseColors(angle) {
  const c = cycle(angle), w = f(0.4);
  if (c < -w || c > w) return null;
  const t = f(f(f(c / w) * 0.5) + 0.5);
  let a = f(1 - f(f(1 - mhSin(f(t * PI_F))) * f(0.99)));
  a = f(a * a);
  return [f(f(t * f(0.3)) + f(0.7)), f(f(f(t * t) * f(0.7)) + f(0.2)), f(0.2), a];
}
// World.getCloudColour: white clouds, greyed by rain (0.95) before and by
// thunder (0.95) after the day factor.
export function cloudColor(angle, rain = 0, thunder = 0) {
  const b = clamp01(f(f(cycle(angle) * 2) + 0.5));
  let c = [1, 1, 1];
  if (rain > 0) c = toGrey(c, f(0.6), rain, f(0.95));
  c = [f(c[0] * f(f(b * f(0.9)) + f(0.1))), f(c[1] * f(f(b * f(0.9)) + f(0.1))), f(c[2] * f(f(b * f(0.85)) + f(0.15)))];
  if (thunder > 0) c = toGrey(c, f(0.2), thunder, f(0.95));
  return c;
}
// EntityRenderer.updateFogColor. `look` is the view vector, `chunks` the render
// distance in chunks and `brightness` the smoothed fogColor2/fogColor1 value.
export function fogColor({ angle, temperature, look, chunks, brightness = 1, underwater = false, lava = false, rain = 0, thunder = 0, lightning = 0, partial = 0 }) {
  const d = f(1 - f(Math.pow(f(0.25 + f(f(0.75 * chunks) / 16)), 0.25))),
    sky = skyColor(temperature, angle, rain, thunder, lightning, partial);
  let fog = providerFogColor(angle);
  if (chunks >= 4) {
    const dir = mhSin(f(f(angle * PI_F) * 2)) > 0 ? -1 : 1;
    let s = f(Math.max(0, look[0] * dir));
    const sunrise = s > 0 && sunriseColors(angle);
    if (sunrise) {
      s = f(s * sunrise[3]);
      fog = fog.map((c, i) => f(f(c * f(1 - s)) + f(sunrise[i] * s)));
    }
  }
  fog = fog.map((c, i) => f(c + f(f(sky[i] - c) * d)));
  // updateFogColor: rain darkens red and green by half of its strength and blue by 0.4;
  // thunder darkens all three by half of its strength. The water and lava colours replace this.
  if (rain > 0) fog = [f(fog[0] * f(1 - f(rain * f(0.5)))), f(fog[1] * f(1 - f(rain * f(0.5)))), f(fog[2] * f(1 - f(rain * f(0.4))))];
  if (thunder > 0) fog = fog.map((c) => f(c * f(1 - f(thunder * f(0.5)))));
  if (underwater) fog = [f(0.02), f(0.02), f(0.2)];
  else if (lava) fog = [f(0.6), f(0.1), 0];
  return fog.map((c) => f(c * brightness));
}
// EntityRenderer.updateTorchFlicker, once per tick.
export class TorchFlicker {
  constructor(random = Math.random) {
    this.random = random;
    this.x = 0;
    this.dx = 0;
  }
  tick() {
    const r = this.random;
    this.dx = f(this.dx + (r() - r()) * r() * r());
    this.dx = f(this.dx * 0.9);
    this.x = f(this.x + f(f(this.dx - this.x) * 1));
    return this.x;
  }
}
// EntityRenderer.updateLightmap: 16x16 RGBA, sky level down the rows and
// block level across. `gamma` is the Brightness option (0 Moody, 1 Bright).
// `flash` is World.lastLightningBolt > 0: the sky level then ignores the sun and
// rain dimming (the sky term is the bare brightness table).
export function lightmap(sun, flicker, gamma = 0, out = new Uint8Array(1024), flash = false, nightVision = 0) {
  const f4 = f(f(sun * f(0.95)) + f(0.05)),
    skyScale = f(f(sun * f(0.65)) + f(0.35)),
    blockScale = f(f(flicker * f(0.1)) + 1.5),
    ease = (v) => {
      v = f(1 - v);
      return f(1 - f(f(f(v * v) * v) * v));
    };
  for (let i = 0; i < 256; i++) {
    const skyB = flash ? BRIGHTNESS[i >> 4] : f(BRIGHTNESS[i >> 4] * f4),
      blockB = f(BRIGHTNESS[i & 15] * blockScale);
    let rgb = [
      f(f(skyB * skyScale) + blockB),
      f(f(skyB * skyScale) + f(blockB * f(f(f(f(blockB * f(0.6)) + f(0.4)) * f(0.6)) + f(0.4)))),
      f(skyB + f(blockB * f(f(f(blockB * blockB) * f(0.6)) + f(0.4)))),
    ].map((c) => f(f(c * f(0.96)) + f(0.03)));
    // EntityRenderer.updateLightmap: Night Vision scales every channel towards 1 / max(r, g, b) by getNightVisionBrightness.
    if (nightVision > 0) {
      const m = f(Math.min(f(1 / rgb[0]), f(1 / rgb[1]), f(1 / rgb[2])));
      rgb = rgb.map((c) => f(f(c * f(1 - nightVision)) + f(f(c * m) * nightVision)));
    }
    rgb = rgb.map((c) => Math.min(1, c));
    rgb = rgb.map((c) => clamp01(f(f(f(f(c * f(1 - gamma)) + f(ease(c) * gamma)) * f(0.96)) + f(0.03))));
    rgb.forEach((c, k) => (out[i * 4 + k] = Math.trunc(f(c * 255))));
    out[i * 4 + 3] = 255;
  }
  return out;
}
// ChunkCache/World.getLightBrightnessForSkyBlocks packing: sky << 20 | block << 4.
export const pack = (sky, block) => (sky << 20) | (block << 4);
export const unpack = (packed) => [(packed >> 16) & 0xffff, packed & 0xffff];
// RenderBlocks.getAoBrightness: zero samples take the face centre's value.
export function aoBrightness(a, b, c, centre) {
  if (a === 0) a = centre;
  if (b === 0) b = centre;
  if (c === 0) c = centre;
  return ((a + b + c + centre) >> 2) & 0xff00ff;
}

// lightOpacity by block id, and whether lightEmission can be non-zero (a lit furnace included).
let OPACITY = null, MAY_EMIT = null;
function lightTables() {
  OPACITY = new Uint8Array(256); MAY_EMIT = new Uint8Array(256);
  for (let b = 0; b < 256; b++) { OPACITY[b] = Math.min(255, lightOpacity(b)); MAY_EMIT[b] = lightEmission(b, true) > 0 ? 1 : 0; }
}

// Sky and block light for the whole world, kept at World.computeLightValue's
// fixed point: a cell takes its brightest neighbour minus max(1, opacity);
// cells at or above the column height map see the sky at 15. `emission` refines
// lightEmission by position (a lit furnace) and is only asked about blocks that
// can emit. A world with columnBlocks(x, z) (World) is read a column at a time.
export class LightVolume {
  constructor(world, emission = (x, y, z, b) => lightEmission(b)) {
    this.world = world;
    this.height = world.height ?? HEIGHT;
    this.emission = emission;
    this.sky = new Uint8Array(SIZE * SIZE * this.height);
    this.block = new Uint8Array(SIZE * SIZE * this.height);
    this.heights = new (this.height > 255 ? Uint16Array : Uint8Array)(SIZE * SIZE);
    for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) this.column(x, z);
    this.relight(0, SIZE - 1, 0, SIZE - 1);
  }
  column(x, z) {
    let y = this.height - 1;
    while (y >= 0 && lightOpacity(this.world.get(x, y, z)) === 0) y--;
    this.heights[x * SIZE + z] = y + 1;
  }
  skyAt(x, y, z) {
    if (y >= this.height || x < 0 || z < 0 || x >= SIZE || z >= SIZE) return 15;
    return this.sky[(x * SIZE + z) * this.height + Math.max(0, y)];
  }
  blockAt(x, y, z) {
    if (y >= this.height || x < 0 || z < 0 || x >= SIZE || z >= SIZE) return 0;
    return this.block[(x * SIZE + z) * this.height + Math.max(0, y)];
  }
  // World.getLightBrightnessForSkyBlocks(x, y, z, lightValue of the block there).
  packed(x, y, z) {
    const b = this.world.get(x, y, z);
    let sky, block;
    if (useNeighborBrightness(b)) {
      sky = Math.max(this.skyAt(x, y + 1, z), this.skyAt(x + 1, y, z), this.skyAt(x - 1, y, z), this.skyAt(x, y, z + 1), this.skyAt(x, y, z - 1), this.skyAt(x, y - 1, z));
      block = Math.max(this.blockAt(x, y + 1, z), this.blockAt(x + 1, y, z), this.blockAt(x - 1, y, z), this.blockAt(x, y, z + 1), this.blockAt(x, y, z - 1), this.blockAt(x, y - 1, z));
    } else {
      sky = this.skyAt(x, y, z);
      block = this.blockAt(x, y, z);
    }
    return pack(sky, Math.max(block, b ? this.emission(x, y, z, b) : 0));
  }
  // World.getBlockLightValue: the larger of daylight-reduced sky and block light.
  level(x, y, z, subtracted = 0) {
    const p = this.packed(x, y, z) & 0xff00ff;
    return Math.max((p >> 20) - subtracted, (p >> 4) & 15);
  }
  // Relights the columns within 15 blocks of a change; light cannot travel
  // further. Returns the box of cells whose light changed, or null.
  update(x, y, z) {
    if (x < 0 || z < 0 || x >= SIZE || z >= SIZE) return null;
    this.column(x, z);
    return this.relight(Math.max(0, x - 15), Math.min(SIZE - 1, x + 15), Math.max(0, z - 15), Math.min(SIZE - 1, z + 15));
  }
  relight(x0, x1, z0, z1) {
    const w = this.world, H = this.height, XS = SIZE * H, n = (x1 - x0 + 1) * (z1 - z0 + 1) * H,
      oldSky = new Uint8Array(n), oldBlock = new Uint8Array(n), cost = new Uint8Array(n), emit = new Uint8Array(n),
      local = (i) => {
        const y = i % H, t = (i - y) / H, z = t % SIZE, x = (t - z) / SIZE;
        return ((x - x0) * (z1 - z0 + 1) + (z - z0)) * H + y;
      };
    if (!OPACITY) lightTables();
    const air = w.columnBlocks && new Uint8Array(H), emitters = [];
    let k = 0;
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++, k += H) {
        const base = (x * SIZE + z) * H, col = air && (w.columnBlocks(x, z) ?? air);
        oldSky.set(this.sky.subarray(base, base + H), k);
        oldBlock.set(this.block.subarray(base, base + H), k);
        for (let y = 0; y < H; y++) {
          const b = col ? col[y] : w.get(x, y, z), op = OPACITY[b] ?? lightOpacity(b),
            e = b && MAY_EMIT[b] !== 0 ? this.emission(x, y, z, b) : 0;
          emit[k + y] = e;
          if (e > 1) emitters.push(k + y);
          cost[k + y] = op >= 15 && e > 0 ? 1 : Math.max(1, Math.min(15, op));
        }
      }
    for (const channel of ["sky", "block"]) {
      const arr = this[channel], buckets = Array.from({ length: 16 }, () => []);
      const raise = (i, v) => {
        if (v > arr[i]) {
          arr[i] = v;
          if (v > 1) buckets[v].push(i);
        }
      };
      const sky = channel === "sky";
      if (sky)
        for (let x = x0; x <= x1; x++)
          for (let z = z0; z <= z1; z++) {
            const height = this.heights[x * SIZE + z], base = (x * SIZE + z) * H;
            // An open-sky cell (15) at or above every in-box horizontal neighbour's height is surrounded
            // by 15s (or, at the column's lowest open cell, the cell below it), so spreading it raises
            // nothing. Only the open cells from the column's lowest up to its tallest neighbour's height
            // seed the flood; the result is unchanged.
            let seedTop = height + 1;
            if (x > x0) seedTop = Math.max(seedTop, this.heights[(x - 1) * SIZE + z]);
            if (x < x1) seedTop = Math.max(seedTop, this.heights[(x + 1) * SIZE + z]);
            if (z > z0) seedTop = Math.max(seedTop, this.heights[x * SIZE + z - 1]);
            if (z < z1) seedTop = Math.max(seedTop, this.heights[x * SIZE + z + 1]);
            arr.fill(0, base, base + height);
            arr.fill(15, base + height, base + H);
            for (let y = height; y < Math.min(seedTop, H); y++) buckets[15].push(base + y);
          }
      else {
        k = 0;
        for (let x = x0; x <= x1; x++)
          for (let z = z0; z <= z1; z++, k += H) arr.set(emit.subarray(k, k + H), (x * SIZE + z) * H);
        for (const kk of emitters) {
          const y = kk % H, t = (kk - y) / H, nz = z1 - z0 + 1, lz = t % nz, lx = (t - lz) / nz;
          buckets[emit[kk]].push(((lx + x0) * SIZE + lz + z0) * H + y);
        }
      }
      // Light flowing in from cells outside the box (or outside the world).
      const outside = channel === "sky" ? 15 : 0;
      const side = (nx, nz, y) =>
        nx >= x0 && nx <= x1 && nz >= z0 && nz <= z1 ? 0 : nx < 0 || nz < 0 || nx >= SIZE || nz >= SIZE ? outside : arr[(nx * SIZE + nz) * H + y];
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++) {
          const edge = x === x0 || x === x1 || z === z0 || z === z1, base = (x * SIZE + z) * H, kb = ((x - x0) * (z1 - z0 + 1) + (z - z0)) * H;
          for (let y = edge ? 0 : H - 1; y < H; y++) {
            const c = cost[kb + y];
            if (c >= 15) continue;
            const best = Math.max(y === H - 1 ? outside : 0, edge ? Math.max(side(x - 1, z, y), side(x + 1, z, y), side(x, z - 1, y), side(x, z + 1, y)) : 0);
            raise(base + y, best - c);
          }
        }
      for (let level = 15; level > 1; level--) {
        const list = buckets[level];
        for (let q = 0; q < list.length; q++) {
          const i = list[q];
          if (arr[i] !== level) continue;
          const y = i % H, t = (i - y) / H, z = t % SIZE, x = (t - z) / SIZE,
            spread = (j) => {
              const kk = local(j);
              if (cost[kk] < 15) raise(j, level - cost[kk]);
            };
          if (y + 1 < H) spread(i + 1);
          if (y > 0) spread(i - 1);
          if (z < z1) spread(i + H);
          if (z > z0) spread(i - H);
          if (x < x1) spread(i + XS);
          if (x > x0) spread(i - XS);
        }
      }
    }
    let box = null;
    k = 0;
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++)
        for (let y = 0; y < H; y++, k++) {
          const i = (x * SIZE + z) * H + y;
          if (this.sky[i] === oldSky[k] && this.block[i] === oldBlock[k]) continue;
          if (!box) box = { x0: x, x1: x, y0: y, y1: y, z0: z, z1: z };
          else {
            box.x1 = x;
            box.z0 = Math.min(box.z0, z);
            box.z1 = Math.max(box.z1, z);
            box.y0 = Math.min(box.y0, y);
            box.y1 = Math.max(box.y1, y);
          }
        }
    return box;
  }
}

// RenderBlocks.renderStandardBlockWithAmbientOcclusion for one face. `face`
// indexes +x,-x,+y,-y,+z,-z; `corners` are the face's vertices in block units.
// When the face lies on the block boundary the samples come from the layer in
// front of it; the corner-occlusion checks look one layer further out, as the
// 1.7.10 code does. Returns per-vertex AO factors and packed brightness.
const AXIS = [0, 0, 1, 1, 2, 2], SIGN = [1, -1, 1, -1, 1, -1], TANGENTS = [[1, 2], [1, 2], [0, 2], [0, 2], [0, 1], [0, 1]];
export function smoothFace(light, x, y, z, face, corners, boundary = true) {
  const w = light.world, axis = AXIS[face], sign = SIGN[face], [u, v] = TANGENTS[face],
    n = [0, 0, 0];
  n[axis] = sign;
  const front = [x + n[0], y + n[1], z + n[2]], base = boundary ? front : [x, y, z],
    nb = w.get(...front),
    centre = boundary || !opaqueCube(nb) ? light.packed(...front) : light.packed(x, y, z),
    centreAo = aoValue(nb),
    at = (du, dv, out = 0) => {
      const p = base.slice();
      p[u] += du;
      p[v] += dv;
      p[axis] += out * sign;
      return p;
    },
    ao = [], packed = [];
  for (const corner of corners) {
    const su = corner[u] > 0.5 ? 1 : -1, sv = corner[v] > 0.5 ? 1 : -1,
      e1 = at(su, 0), e2 = at(0, sv),
      b1 = w.get(...e1), b2 = w.get(...e2),
      p1 = light.packed(...e1), p2 = light.packed(...e2);
    let pc = p1, ac = aoValue(b1);
    if (aoClear(w.get(...at(su, 0, 1))) || aoClear(w.get(...at(0, sv, 1)))) {
      const c = at(su, sv);
      pc = light.packed(...c);
      ac = aoValue(w.get(...c));
    }
    ao.push(f(f(f(f(ac + aoValue(b1)) + aoValue(b2)) + centreAo) / 4));
    packed.push(aoBrightness(p1, p2, pc, centre));
  }
  return { ao, packed };
}

// RenderGlobal.renderStars: quads on a radius-100 sphere, four vertices each.
export function starQuads() {
  const random = new JavaRandom(10842), out = [];
  for (let i = 0; i < 1500; i++) {
    let x = f(f(random.nextFloat() * 2) - 1), y = f(f(random.nextFloat() * 2) - 1), z = f(f(random.nextFloat() * 2) - 1);
    const size = f(f(0.15) + f(random.nextFloat() * f(0.1)));
    let d = x * x + y * y + z * z;
    if (!(d < 1 && d > 0.01)) continue;
    d = 1 / Math.sqrt(d);
    x *= d;
    y *= d;
    z *= d;
    const yaw = Math.atan2(x, z), ys = Math.sin(yaw), yc = Math.cos(yaw),
      pitch = Math.atan2(Math.sqrt(x * x + z * z), y), ps = Math.sin(pitch), pc = Math.cos(pitch),
      roll = random.nextDouble() * Math.PI * 2, rs = Math.sin(roll), rc = Math.cos(roll);
    for (let j = 0; j < 4; j++) {
      const a = ((j & 2) - 1) * size, b = (((j + 1) & 2) - 1) * size,
        c = a * rc - b * rs, e = b * rc + a * rs,
        py = c * ps, q = -c * pc;
      out.push(x * 100 + (q * ys - e * yc), y * 100 + py, z * 100 + (e * ys + q * yc));
    }
  }
  return out;
}
