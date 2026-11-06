// The cave "mood" sound: World.func_147467_a (ahb.a(IILapx;)V), the first step of WorldServer's per-chunk tick, and the
// ambientTickCountdown (ahb.K) it waits on. Replayed against music-reference.json "mood" (public/research/music.md).
// `state` holds World.rand (`random`) and World.updateLCG (`lcg`); the Overworld shares weather.js's Weather, whose
// per-chunk lightning, ice/snow and random-tick draws follow this one, and the Nether and End pass their own state.
import { JavaRandom } from "./java-random.js";
import { HEIGHT } from "./world.js";
export const MOOD_EVENT = "ambient.cave.cave";
export class MoodSound {
  constructor(state = { random: new JavaRandom(Math.floor(Math.random() * 2 ** 48)), lcg: new JavaRandom(Math.floor(Math.random() * 2 ** 48)).nextInt() }) {
    this.state = state;
    this.countdown = state.random.nextInt(12000); // the World constructor
    this.player = () => null; // the one player's feet {x, y, z}
    this.light = null; // { full(x, y, z), sky(x, y, z) }; moodLight(world, scene.light) builds it
  }
  // World.setActivePlayerChunksAndCheckLight (ahb.C), once per tick before the chunk loop.
  tick() {
    if (this.countdown > 0) this.countdown--;
  }
  // One chunk: while the countdown is 0, updateLCG picks a cell (x, z in the chunk, y 0..255); an air cell whose light
  // is at most rand.nextInt(8) and whose saved sky light is 0 plays the sound for the nearest player within 8 blocks
  // unless that player is within 2 blocks, and restarts the countdown at 6000..17999 ticks. Returns { sound, volume,
  // pitch, x, y, z } or null.
  chunk(world, cx, cz, light = this.light ?? moodLight(world)) {
    if (this.countdown !== 0) return null;
    const s = this.state;
    s.lcg = (Math.imul(s.lcg, 3) + 1013904223) | 0;
    const l = s.lcg >> 2,
      x = (l & 15) + cx * 16,
      z = ((l >> 8) & 15) + cz * 16,
      y = (l >> 16) & 255;
    if (!isAir(world, x, y, z) || light.full(x, y, z) > s.random.nextInt(8) || light.sky(x, y, z) > 0) return null;
    const p = this.player(), px = x + 0.5, py = y + 0.5, pz = z + 0.5;
    if (!p) return null;
    const d = (p.x - px) ** 2 + (p.y - py) ** 2 + (p.z - pz) ** 2;
    // getClosestPlayer(x, y, z, 8) (strictly closer than 8), then getDistanceSq > 4.
    if (!(d < 64) || !(d > 4)) return null;
    const f = Math.fround, pitch = f(f(0.8) + f(s.random.nextFloat() * f(0.2)));
    this.countdown = s.random.nextInt(12000) + 6000;
    return { sound: MOOD_EVENT, volume: 0.7, pitch, x: px, y: py, z: pz };
  }
}
// Chunk.getBlock: cells above the port's world height are empty sections (air).
function isAir(world, x, y, z) {
  return y >= (world.height ?? HEIGHT) || world.get(x, y, z) === 0;
}
// World.getFullBlockLightValue (ahb.j: sky and block light, no daylight subtraction) and getSavedLightValue(Sky). Above the
// stored sections a column sees the sky: full 15 with a sky (0 without one, as in the Nether and End) and saved sky 15.
export function moodLight(world, light = null) {
  const top = world.height ?? HEIGHT, noSky = !!world.hasNoSky;
  const skyAt = (x, y, z) => (light ? light.skyAt(x, y, z) : noSky ? 0 : 15);
  const blockAt = (x, y, z) => (light ? light.blockAt(x, y, z) : world.blockLight ? world.blockLight(x, y, z) : 0);
  return {
    full: (x, y, z) => (y >= top ? (noSky ? 0 : 15) : Math.max(noSky ? 0 : skyAt(x, y, z), blockAt(x, y, z))),
    sky: (x, y, z) => (y >= top ? 15 : noSky ? 0 : skyAt(x, y, z)),
  };
}
