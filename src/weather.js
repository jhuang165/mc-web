// Minecraft Java 1.7.10 overworld weather: World.updateWeather (ahb.o) timers and
// strengths, WorldInfo's saved rain/thunder state, World.getPrecipitationHeight
// and canLightningStrikeAt, WorldServer's per-chunk lightning roll,
// EntityLightningBolt (xh), Entity.isWet (sa.L) and the client-side rain splash
// particles and rain sound of EntityRenderer.addRainParticles (blt.l) with
// EntityRainFX (blf). Evidence and gaps: public/research/weather.md; the timers,
// strengths, sky terms, strike rule and bolt state machine are replayed against
// public/research/weather-reference.json by weather.test.js.
import { JavaRandom, biomeTemperature, lightOpacity } from "./lighting.js";
import { SIZE, HEIGHT, FIRE, isPlant } from "./world.js";

const f = Math.fround;

// Random.nextLong: (next(32) << 32) + next(32), as a signed 64-bit BigInt.
export function nextLong(random) {
  const hi = BigInt(random.next(32)), lo = BigInt(random.next(32));
  return BigInt.asIntN(64, (hi << 32n) + lo);
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Material.blocksMovement || Material.isLiquid: the blocks Chunk.getPrecipitationHeight
// stops at. Air, torches, crops, tall grass and flowers let rain through; leaves,
// glass, water and lava do not. (The probe's block table is in weather-reference.json.)
export const stopsPrecipitation = (b) => b !== 0 && b !== 20 && b !== FIRE && !isPlant(b);
// Chunk.getPrecipitationHeight (apx.d): one above the topmost such block, or -1.
export function precipitationHeight(world, x, z) {
  if (x < 0 || z < 0 || x >= SIZE || z >= SIZE) return -1;
  for (let y = HEIGHT - 1; y >= 0; y--) if (stopsPrecipitation(world.get(x, y, z))) return y + 1;
  return -1;
}
// Chunk.canBlockSeeTheSky (apx.c): at or above the height map, which rests on
// the topmost block with any light opacity (glass, torches and plants do not count).
export function canSeeSky(world, x, y, z) {
  if (x < 0 || z < 0 || x >= SIZE || z >= SIZE) return false;
  let top = HEIGHT - 1;
  while (top >= 0 && lightOpacity(world.get(x, top, z)) === 0) top--;
  return y >= top + 1;
}
// Biome flags the overworld presets have: every biome here is at least 0.15, so
// BiomeGenBase.getEnableSnow is false, canSpawnLightningBolt is true and
// canSnowAt never holds. It always rains and never snows.
export const rainsHere = (world) => biomeTemperature(world.biome) >= f(0.15);
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
    temperature: biomeTemperature(world.biome),
  });
}
// Entity.isWet (sa.L): in water, or rained on at the feet or at the head.
export const isWet = (weather, world, e, height = 0) =>
  !!e.inWater || canLightningStrikeAt(weather, world, Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)) || canLightningStrikeAt(weather, world, Math.floor(e.x), Math.floor(e.y + height), Math.floor(e.z));
// Entity.onStruckByLightning (sa.a(xh)): 5 fire damage, then ++fire and setFire(8)
// (160 ticks) when that reaches 0. A fresh entity has fire 0, so it lands on 1 and
// burns for a tick; only one that rain had put out (fire -1 in vanilla) ignites.
// This build's extinguish sets 0 rather than -fireResistance, so that case is not modelled.
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

// RainFX (blf): a splash particle that hops off the surface. Collision is
// simplified to the precipitation surface of the column it is in.
export class RainDrop {
  // EntityFX's constructor draws from Math.random (not the renderer's seeded
  // Random): a random direction scaled to 0.4 * (0.15 to 0.45), then EntityRainFX
  // keeps 0.3 of the horizontal part and replaces the vertical with 0.1 to 0.3.
  constructor(x, y, z) {
    this.x = this.px = x;
    this.y = this.py = y;
    this.z = this.pz = z;
    const c = () => f(f(Math.random() * 2 - 1) * f(0.4)),
      a = c(), b = c(), d = c(),
      scale = f(f(Math.random() + Math.random() + 1) * f(0.15)),
      length = f(Math.sqrt(a * a + b * b + d * d));
    this.vx = ((a / length) * scale * f(0.4)) * f(0.3);
    this.vz = ((d / length) * scale * f(0.4)) * f(0.3);
    this.vy = f(f(f(Math.random()) * f(0.2)) + f(0.1));
    this.texture = 19 + Math.floor(Math.random() * 4);
    this.scale = f(f(f(Math.random() * 0.5) + 0.5) * 2); // EntityFX.particleScale
    this.age = Math.trunc(8 / (Math.random() * 0.8 + 0.2));
    this.dead = false;
    this.onGround = false;
  }
  tick(surface) {
    this.px = this.x;
    this.py = this.y;
    this.pz = this.z;
    this.vy -= 0.06;
    this.x += this.vx;
    this.z += this.vz;
    this.y += this.vy;
    this.onGround = false;
    if (surface !== undefined && this.y <= surface && this.vy < 0) {
      this.y = surface;
      this.vy = 0;
      this.onGround = true;
    }
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.vz *= 0.98;
    if (this.age-- <= 0) this.dead = true;
    if (this.onGround) {
      if (Math.random() < 0.5) this.dead = true;
      this.vx *= 0.7;
      this.vz *= 0.7;
    }
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
    this.drops = [];
  }
  // WorldInfo's NBT fields (RainTime, raining, ThunderTime, thundering).
  save() {
    return { rainTime: this.rainTime, thunderTime: this.thunderTime, raining: this.raining, thundering: this.thundering };
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
  rollLightning(world, chunks) {
    for (const [cx, cz] of chunks) {
      if (this.random.nextInt(100000) !== 0 || !this.isRaining() || !this.isThundering()) continue;
      this.lcg = (Math.imul(this.lcg, 3) + 1013904223) | 0;
      const j = this.lcg >> 2,
        x = cx * 16 + (j & 15),
        z = cz * 16 + ((j >> 8) & 15),
        y = precipitationHeight(world, x, z);
      if (canLightningStrikeAt(this, world, x, y, z)) this.bolts.push(new LightningBolt(x, y, z, new JavaRandom(Math.floor(Math.random() * 2 ** 48)), this.fire));
    }
  }
  // The chunks WorldServer ticks around a player: its view distance (10 by
  // default) clipped to the world.
  static activeChunks(px, pz, radius = 10) {
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
    if (world) this.rollLightning(world, Weather.activeChunks(player?.x ?? SIZE / 2, player?.z ?? SIZE / 2));
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
  // 100 * rain^2 candidate columns within 9 blocks of the viewer, a splash in each
  // that rains, and the rain loop sound. The viewer is {x, y, z}.
  rainParticles(world, viewer) {
    const strength = this.rainStrength(1);
    this.drops = this.drops.filter((d) => !d.dead);
    for (const d of this.drops) d.tick(precipitationHeight(world, Math.floor(d.x), Math.floor(d.z)));
    this.drops = this.drops.filter((d) => !d.dead);
    if (strength === 0 || !rainsHere(world)) return;
    const random = new JavaRandom(BigInt(this.clientTicks) * 312987231n),
      i = Math.floor(viewer.x), j = Math.floor(viewer.y), k = Math.floor(viewer.z),
      count = Math.trunc(f(f(f(100 * strength) * strength)));
    let l = 0, sx = 0, sy = 0, sz = 0;
    for (let n = 0; n < count; n++) {
      const x = i + random.nextInt(10) - random.nextInt(10),
        z = k + random.nextInt(10) - random.nextInt(10),
        top = precipitationHeight(world, x, z),
        block = top > 0 ? world.get(x, top - 1, z) : 0;
      if (top > j + 10 || top < j - 10) continue;
      const fx = random.nextFloat(), fz = random.nextFloat();
      if (block === 42) continue; // lava: smoke instead (not ported)
      if (block === 0) continue; // Material.air
      l++;
      if (random.nextInt(l) === 0) {
        sx = x + fx;
        sy = top + f(0.1); // - getBlockBoundsMinY, 0 for the blocks here
        sz = z + fz;
      }
      if (this.drops.length < 1500) this.drops.push(new RainDrop(x + fx, top + f(0.1), z + fz));
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
