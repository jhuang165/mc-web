// Minecraft Java 1.7.10 overworld weather: World.updateWeather (ahb.o) timers and
// strengths, WorldInfo's saved rain/thunder state, World.getPrecipitationHeight
// and canLightningStrikeAt, WorldServer's per-chunk lightning roll,
// EntityLightningBolt (xh), Entity.isWet (sa.L) and the client-side rain splash
// particles and rain sound of EntityRenderer.addRainParticles (blt.l) with
// EntityRainFX (blf). Evidence and gaps: public/research/weather.md; the timers,
// strengths, sky terms, strike rule and bolt state machine are replayed against
// public/research/weather-reference.json by weather.test.js.
import { JavaRandom, biomeTemperature, lightOpacity } from "./lighting.js";
import { rainParticleAttempts } from "./particle-settings.js";
import { rainParticleStrength } from "./render-settings.js";
import { SIZE, HEIGHT, FIRE, LAVA, SNOW_LAYER, ICE, isPlant, ticksRandomly } from "./world.js";
import { biomeFacts } from "./biomes.js";
import { canBlockFreeze, canSnowAt, lightOf, meltResult } from "./snow.js";
import { CAULDRON, cauldronRain } from "./stone-utility.js";

const f = Math.fround;

// Random.nextLong: (next(32) << 32) + next(32), as a signed 64-bit BigInt.
export function nextLong(random) {
  const hi = BigInt(random.next(32)), lo = BigInt(random.next(32));
  return BigInt.asIntN(64, (hi << 32n) + lo);
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Material.blocksMovement || Material.isLiquid: the blocks Chunk.getPrecipitationHeight
// stops at. Air, torches, crops, tall grass and flowers let rain through; leaves,
// glass, water, lava and ice do not; a snow layer (Material.snow) does not stop it either.
// (The probe's block table is in weather-reference.json.)
export const stopsPrecipitation = (b) => b !== 72 && b !== 73 && b !== 0 && b !== 20 && b !== SNOW_LAYER && b !== FIRE && b !== 59 && !isPlant(b);
// Chunk.getPrecipitationHeight (apx.d): one above the topmost such block, or -1.
export function precipitationHeight(world, x, z) {
  if (world.streaming ? !world.isLoaded(x,z) : x < 0 || z < 0 || x >= SIZE || z >= SIZE) return -1;
  for (let y = (world.height ?? HEIGHT) - 1; y >= 0; y--) if (stopsPrecipitation(world.get(x, y, z))) return y + 1;
  return -1;
}
// Chunk.canBlockSeeTheSky (apx.c): at or above the height map, which rests on
// the topmost block with any light opacity (glass, torches and plants do not count).
export function canSeeSky(world, x, y, z) {
  if (world.streaming ? !world.isLoaded(x,z) : x < 0 || z < 0 || x >= SIZE || z >= SIZE) return false;
  let top = (world.height ?? HEIGHT) - 1;
  while (top >= 0 && lightOpacity(world.get(x, top, z)) === 0) top--;
  return y >= top + 1;
}
// Biome flags (biomes.js): meadow, island and alpine are at least 0.15, so they rain, can be
// struck and never snow; the snowy preset (Ice Plains, 0.0, enableSnow) snows instead
// (EntityRenderer.renderRainSnow picks by temperature >= 0.15) and takes no lightning.
export const rainsHere = (world, x=64, y=64, z=64) => (world.temperatureAt?.(x,y,z) ?? biomeTemperature(world.biome)) >= f(0.15);
// Per-column precipitation (EntityRenderer.renderRainSnow / addRainParticles): nothing unless the biome can
// spawn lightning (rainfall > 0 and not snowy) or enables snow; otherwise snow below 0.15 at (x, y, z), else rain.
export function precipitationKind(world, x, y, z) {
  const b = world.biomeAt?.(x, z), facts = b ? null : biomeFacts(world.biome),
    canSpawn = b ? b.rainfall > 0 && !b.snowy : facts.canSpawnLightning, snow = b ? b.snowy : facts.enableSnow;
  if (!canSpawn && !snow) return null;
  return (world.temperatureAt?.(x, y, z) ?? biomeTemperature(world.biome)) < f(0.15) ? "snow" : "rain";
}
// World.canLightningStrikeAt (ahb.y), with the biome facts as arguments so the
// probe table can replay it for every biome.
export function strikeRule({ raining, sees, precipitation, y, temperature, canSpawn = true, enableSnow = false }) {
  if (!raining || !sees || precipitation > y) return false;
  if (enableSnow || temperature < f(0.15)) return false; // getEnableSnow, canSnowAt (cold air)
  return canSpawn;
}
export function canLightningStrikeAt(weather, world, x, y, z) {
  return strikeRule({
    raining: weather.isRaining(),
    sees: canSeeSky(world, x, y, z),
    precipitation: precipitationHeight(world, x, z),
    y,
    temperature: world.temperatureAt?.(x,y,z) ?? biomeTemperature(world.biome),
    canSpawn: world.biomeAt ? world.biomeAt(x,z).rainfall > 0 && !world.biomeAt(x,z).snowy : biomeFacts(world.biome).canSpawnLightning,
    enableSnow: world.biomeAt ? world.biomeAt(x,z).snowy : biomeFacts(world.biome).enableSnow,
  });
}
// Entity.isWet (sa.L): in water, or rained on at the feet or at the head.
export const isWet = (weather, world, e, height = 0) =>
  !!e.inWater || canLightningStrikeAt(weather, world, Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)) || canLightningStrikeAt(weather, world, Math.floor(e.x), Math.floor(e.y + height), Math.floor(e.z));
// Entity.onStruckByLightning (sa.a(xh)): 5 fire damage, then ++fire and setFire(8)
// (160 ticks) when that reaches 0. A fresh entity has fire 0, so it lands on 1 and
// burns for a tick; only one that rain had put out (fire -1 in vanilla) ignites.
// Wet burning counters rest at -fireResistance in block-collisions.js.
export function struckByLightning(fire) {
  const next = fire + 1;
  return { damage: 5, fire: next === 0 ? 160 : next };
}
// EntityLightningBolt.onUpdate's damage box: x/z +-3, y -3 to +9.
export const strikeBox = (b) => [b.x - 3, b.y - 3, b.z - 3, b.x + 3, b.y + 9, b.z + 3];
// AxisAlignedBB.intersectsWith for [x0, y0, z0, x1, y1, z1] boxes, and an entity's
// box from its feet position.
export const overlaps = (a, b) => a[0] < b[3] && a[3] > b[0] && a[1] < b[4] && a[4] > b[1] && a[2] < b[5] && a[5] > b[2];
export const entityBox = (e, width, height) => [e.x - width / 2, e.y, e.z - width / 2, e.x + width / 2, e.y + height, e.z + width / 2];

// EntityLightningBolt (xh), as ticked on the client with the server's damage hook.
export class LightningBolt {
  // `fire` is the optional {start(bolt), restrike(bolt)} hook that places fire (fire.js);
  // without it the bolt only flashes, sounds and damages.
  constructor(x, y, z, random = new JavaRandom(Math.floor(Math.random() * 2 ** 48)), fire = null) {
    this.fire = fire;
    this.x = x;
    this.y = y;
    this.z = z;
    this.random = random;
    this.state = 2; // lightningState
    this.vertex = nextLong(random); // boltVertex: seeds the drawn path
    this.living = random.nextInt(3) + 1; // boltLivingTime
    this.dead = false;
    fire?.start(this); // the constructor's fire placement, after its own two draws
  }
  // One tick; `events` receives the sounds. Returns true while the bolt flashes
  // the sky (lightningState >= 0), which also damages what stands in strikeBox.
  tick(events) {
    const r = this.random;
    if (this.state === 2) {
      // volume 10000 is clamped to 1 by the sound engine; thunder has no distance falloff.
      events.push({ sound: "ambient.weather.thunder", volume: 10000, pitch: f(f(0.8) + f(r.nextFloat() * f(0.2))), x: this.x, y: this.y, z: this.z });
      events.push({ sound: "random.explode", volume: 2, pitch: f(f(0.5) + f(r.nextFloat() * f(0.2))), x: this.x, y: this.y, z: this.z });
    }
    this.state--;
    if (this.state < 0) {
      if (this.living === 0) this.dead = true;
      else if (this.state < -r.nextInt(10)) {
        this.living--;
        this.state = 1;
        this.vertex = nextLong(r);
        this.fire?.restrike(this);
      }
    }
    return this.state >= 0;
  }
}

export class Weather {
  // `random` is World.rand (timers and the lightning roll); `lcg` is World.updateLCG.
  constructor({ random = new JavaRandom(Math.floor(Math.random() * 2 ** 48)), lcg = new JavaRandom(Math.floor(Math.random() * 2 ** 48)).nextInt() } = {}) {
    this.random = random;
    this.lcg = lcg | 0;
    // WorldInfo: a new world has both timers at 0, so the first tick rolls them.
    this.rainTime = 0;
    this.thunderTime = 0;
    this.raining = false;
    this.thundering = false;
    this.prevRain = this.rain = 0;
    this.prevThunder = this.thunder = 0;
    this.lastLightning = 0; // World.lastLightningBolt: ticks of sky flash left
    this.bolts = [];
    this.fire = null; // fire.js's bolt hook, handed to each new bolt
    this.events = []; // { sound, volume, pitch, x, y, z }, drained by drain()
    this.struck = []; // bolts that flashed this tick, drained by the damage hook
    this.clientTicks = 0; // EntityRenderer.rendererUpdateCount
    this.rainSoundCounter = 0;
    this.particleSetting = 0;
    this.mood = null; // cave-ambience.js MoodSound sharing this.random and this.lcg
  }
  // WorldInfo's NBT fields (RainTime, raining, ThunderTime, thundering).
  save() {
    return { rainTime: this.rainTime, thunderTime: this.thunderTime, raining: this.raining, thundering: this.thundering };
  }
  // Browser continuity snapshot, separate from WorldInfo's four native fields.
  // Java world NBT does not promise to resume these random streams on reload.
  saveSimulation() {
    return { version: 1, random: this.random.save(), lcg: this.lcg };
  }
  restoreSimulation(data) {
    if (data?.version === 1 && Number.isInteger(data.lcg) && data.lcg >= -2147483648 && data.lcg <= 2147483647
      && this.random.restore(data.random)) this.lcg = data.lcg;
    return this;
  }
  // World.calculateInitialWeather (ahb.a): a raining world starts at full rain,
  // and at full thunder when it is thundering too.
  restore(data) {
    if (!data || typeof data !== "object") return this;
    const int = (v) => (Number.isInteger(v) ? v | 0 : 0);
    this.rainTime = int(data.rainTime);
    this.thunderTime = int(data.thunderTime);
    this.raining = data.raining === true;
    this.thundering = data.thundering === true;
    this.prevRain = this.prevThunder = 0;
    this.rain = this.raining ? 1 : 0;
    this.thunder = this.raining && this.thundering ? 1 : 0;
    return this;
  }
  // World.getRainStrength / getWeightedThunderStrength (ahb.j, ahb.h).
  rainStrength(partial = 1) {
    return f(this.prevRain + f(f(this.rain - this.prevRain) * partial));
  }
  weightedThunder(partial = 1) {
    return f(f(this.prevThunder + f(f(this.thunder - this.prevThunder) * partial)) * this.rainStrength(partial));
  }
  isRaining() {
    return this.rainStrength(1) > f(0.2);
  }
  isThundering() {
    return this.weightedThunder(1) > 0.9;
  }
  // World.updateWeather (ahb.o): thunder first, then rain, each with its own
  // timer. Thunder is independent of rain here; it is only weighted by rain.
  updateWeather() {
    const r = this.random;
    if (this.thunderTime <= 0) this.thunderTime = this.thundering ? r.nextInt(12000) + 3600 : r.nextInt(168000) + 12000;
    else if (--this.thunderTime <= 0) this.thundering = !this.thundering;
    this.prevThunder = this.thunder;
    this.thunder = clamp01(f(this.thundering ? this.thunder + 0.01 : this.thunder - 0.01));
    if (this.rainTime <= 0) this.rainTime = this.raining ? r.nextInt(12000) + 12000 : r.nextInt(168000) + 12000;
    else if (--this.rainTime <= 0) this.raining = !this.raining;
    this.prevRain = this.rain;
    this.rain = clamp01(f(this.raining ? this.rain + 0.01 : this.rain - 0.01));
  }
  // WorldServer's per-chunk roll: one in 100000 per tickable chunk per tick, in
  // a thunderstorm only; the strike lands in a random column of that chunk where
  // canLightningStrikeAt holds.
  rollLightningChunk(world, cx, cz) {
    if (this.random.nextInt(100000) !== 0 || !this.isRaining() || !this.isThundering()) return;
    this.lcg = (Math.imul(this.lcg, 3) + 1013904223) | 0;
    const j = this.lcg >> 2,
      x = cx * 16 + (j & 15),
      z = cz * 16 + ((j >> 8) & 15),
      y = precipitationHeight(world, x, z);
    if (canLightningStrikeAt(this, world, x, y, z)) this.bolts.push(new LightningBolt(x, y, z, new JavaRandom(Math.floor(Math.random() * 2 ** 48)), this.fire));
  }
  rollLightning(world, chunks) {
    for (const [cx, cz] of chunks) this.rollLightningChunk(world, cx, cz);
  }
  // A block change made by the tick: set and tracked, so it is saved and neighbours hear of it.
  // main.js replaces this to also redraw the chunk.
  apply(world, x, y, z, block, meta) {
    world.set(x, y, z, block, true, meta);
  }
  // WorldServer.func_147456_g (mt.g) for one chunk, in its order (replayed against
  // snow-reference.json "tick"): the lightning roll, then "iceandsnow" (one in 16 per tick:
  // one random column, freeze naturally-freezable water under the precipitation height, and
  // lay a snow layer there while it is raining), then three random block ticks (updateLCG
  // picks x, z, y) in every 16-high section that has a randomly ticking block.
  tickChunk(world, cx, cz) {
    // The cave mood sound (cave-ambience.js) comes first in WorldServer's chunk loop; main.js installs it.
    const mood = this.mood?.chunk(world, cx, cz);
    if (mood) this.events.push(mood);
    this.rollLightningChunk(world, cx, cz);
    const bx = cx * 16, bz = cz * 16, light = lightOf(world);
    if (this.random.nextInt(16) === 0) {
      this.lcg = (Math.imul(this.lcg, 3) + 1013904223) | 0;
      const j = this.lcg >> 2,
        x = bx + (j & 15),
        z = bz + ((j >> 8) & 15),
        y = precipitationHeight(world, x, z);
      if (canBlockFreeze(world, x, y - 1, z, true, light)) this.apply(world, x, y - 1, z, ICE, 0);
      if (this.isRaining() && canSnowAt(world, x, y, z, true, light)) this.apply(world, x, y, z, SNOW_LAYER, 0);
      // BlockCauldron.fillWithRain: rain on a cauldron's open top raises its level on a one-in-twenty roll (drawn only when a cauldron is there).
      if (this.isRaining() && world.get(x, y - 1, z) === CAULDRON && canLightningStrikeAt(this, world, x, y, z)) {
        const level = world.getMeta(x, y - 1, z) & 3, next = cauldronRain(level, this.random.nextInt(20));
        if (next !== level) this.apply(world, x, y - 1, z, CAULDRON, next);
      }
    }
    for (let s = 0; s < (world.height ?? HEIGHT) / 16; s++) {
      if (world.sectionTickCount && world.sectionTickCount(cx, cz, s) <= 0) continue;
      for (let n = 0; n < 3; n++) {
        this.lcg = (Math.imul(this.lcg, 3) + 1013904223) | 0;
        const j = this.lcg >> 2,
          x = bx + (j & 15),
          z = bz + ((j >> 8) & 15),
          y = s * 16 + ((j >> 16) & 15),
          b = world.get(x, y, z);
        if (!ticksRandomly(b)) continue;
        // Blocks ticked elsewhere (fire and still lava, in fire.js) take their updateTick here.
        if (this.blockTick?.(x, y, z, b)) continue;
        const melt = meltResult(b, light(x, y, z));
        if (melt) { this.apply(world, x, y, z, melt.block, melt.meta); if (melt.drops) this.drop?.(world, x, y, z, melt.drops); }
      }
    }
  }
  tickChunks(world, chunks) {
    for (const [cx, cz] of chunks) this.tickChunk(world, cx, cz);
  }
  // The chunks WorldServer ticks around a player: its view distance (10 by
  // default) clipped to the world.
  static activeChunks(px, pz, radius = 10, world = null) {
    if (world?.streaming) return [...world.chunks.values()].filter(c=>Math.abs(c.x-Math.floor(px/16))<=radius && Math.abs(c.z-Math.floor(pz/16))<=radius && world.isTicking(c.x*16,c.z*16)).map(c=>[c.x,c.z]);
    const out = [], n = SIZE / 16, cx = Math.floor(px / 16), cz = Math.floor(pz / 16);
    for (let x = Math.max(0, cx - radius); x <= Math.min(n - 1, cx + radius); x++)
      for (let z = Math.max(0, cz - radius); z <= Math.min(n - 1, cz + radius); z++) out.push([x, z]);
    return out;
  }
  // One game tick. `world` may be null (timers only).
  tick(world = null, player = null) {
    if (this.lastLightning > 0) this.lastLightning--; // Minecraft.runTick
    this.struck.length = 0;
    this.updateWeather();
    if (world) {
      this.mood?.tick(); // World.setActivePlayerChunksAndCheckLight: the mood countdown, before the chunk loop
      this.tickChunks(world, Weather.activeChunks(player?.x ?? SIZE / 2, player?.z ?? SIZE / 2, 10, world));
    }
    for (const bolt of this.bolts) {
      if (bolt.tick(this.events)) {
        this.lastLightning = 2;
        this.struck.push(bolt);
      }
    }
    this.bolts = this.bolts.filter((b) => !b.dead);
    this.clientTicks++;
  }
  drain() {
    return this.events.splice(0);
  }
  // EntityRenderer.addRainParticles (blt.l) for one client tick: up to
  // 100 * rain^2 candidate columns within 9 blocks of the viewer, an EntityRainFX
  // on each that rains (EntitySmokeFX over lava), added straight to the
  // EffectRenderer with `add(kind, x, y, z)`, and the rain loop sound. The viewer
  // is {x, y, z}.
  rainParticles(world, viewer, add = () => {}) {
    const strength = rainParticleStrength(this.rainStrength(1)); // halved without fancy graphics (blt.l)
    if (strength === 0) return;
    const random = new JavaRandom(BigInt(this.clientTicks) * 312987231n),
      i = Math.floor(viewer.x), j = Math.floor(viewer.y), k = Math.floor(viewer.z),
      count = rainParticleAttempts(strength, this.particleSetting);
    let l = 0, sx = 0, sy = 0, sz = 0;
    for (let n = 0; n < count; n++) {
      const x = i + random.nextInt(10) - random.nextInt(10),
        z = k + random.nextInt(10) - random.nextInt(10),
        top = precipitationHeight(world, x, z),
        block = top > 0 ? world.get(x, top - 1, z) : 0;
      if (top > j + 10 || top < j - 10) continue;
      if (precipitationKind(world, x, top, z) !== "rain") continue; // blt.l: biome.canSpawnLightningBolt and temperature(x, top, z) >= 0.15
      const fx = random.nextFloat(), fz = random.nextFloat();
      // (float)x + f2, (float)top + 0.1F - getBlockBoundsMinY (0 for the blocks here).
      const px = f(x + fx), py = f(top + f(0.1)), pz = f(z + fz);
      if (block === LAVA) {
        add("smoke", px, py, pz);
        continue;
      }
      if (block === 0) continue; // Material.air
      l++;
      if (random.nextInt(l) === 0) {
        sx = px;
        sy = py;
        sz = pz;
      }
      add("rain", px, py, pz);
    }
    if (l > 0 && random.nextInt(3) < this.rainSoundCounter++) {
      this.rainSoundCounter = 0;
      const roofed = sy > viewer.y + 1 && precipitationHeight(world, Math.floor(viewer.x), Math.floor(viewer.z)) > j;
      this.events.push(roofed ? { sound: "ambient.weather.rain", volume: f(0.1), pitch: f(0.5), x: sx, y: sy, z: sz } : { sound: "ambient.weather.rain", volume: f(0.2), pitch: 1, x: sx, y: sy, z: sz });
    }
  }
  // Dev aid (window.__mc.weather.set): not a port of /weather. Sets the flags and
  // timers; the strengths then ramp by 0.01 per tick as in vanilla.
  set(kind, seconds = 600) {
    const t = Math.max(1, Math.floor(seconds * 20));
    this.rainTime = t;
    this.thunderTime = t;
    this.raining = kind === "rain" || kind === "thunder";
    this.thundering = kind === "thunder";
    return this.save();
  }
}
