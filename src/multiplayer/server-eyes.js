// Batch 64 mpend2: the flying eye of ender on the dedicated server (ItemEnderEye.onItemRightClick, EntityEnderEye).
//   * Use in the air (or aimed at a block that is not an end portal frame): World.findClosestStructure("Stronghold", (int) x, (int) y, (int) z) of the player's world. Only the
//     Overworld's chunk provider answers (ChunkProviderHell and ChunkProviderEnd return null for it, recalled), so in the Nether and the End nothing happens and nothing is used. No
//     stronghold: nothing happens, the eye is kept. Otherwise the eye is spawned at the player's eye height heading for the stronghold (EyesOfEnder.launch -> moveTowards: beyond 12
//     blocks it aims 12 along and 8 up, 1 in 5 shatters via Entity.rand.nextInt(5) == 0), "random.bow" is heard and the eye is used up outside Creative. Executed against the original
//     in eye-of-ender-reference.json / tracker-extras-reference.json (eye-of-ender.js).
//   * The flight (EntityEnderEye.onUpdate, 80 ticks, then it drops as an item or shatters) is eye-of-ender.js tickEye, the same code as single player. Everybody in the dimension within
//     64 blocks sees it: it goes out in the dispenser's `dispEnts` as a ball of kind `eyeOfEnder` (the client renderer already draws that kind); a shatter is a `dispFx` event
//     `eyeShatter` (client-dispense.js -> eye-of-ender-live.js spawnEyeShatter).
//   * The strongholds of the world seed are computed here (the server's finite world has no structure manager): StructureCache over a WorldChunkManager, once per seed.
//   * Saved with the Overworld's projectiles (`eyes` in the lane's extras: ServerDispense.extrasOut / restoreExtras).
import { EyesOfEnder } from '../eye-of-ender-live.js';
import { ITEM_EYE_OF_ENDER, nearestStronghold } from '../eye-of-ender.js';
import { JavaRandom } from '../java-random.js';
import { StructureCache } from '../population-world.js';
import { WorldChunkManager } from '../biome-layers.js';
import { javaSeed } from '../java-world.js';
import { WATER } from '../world.js';

const f = Math.fround, caches = new Map();
const NEAR = 64 * 64;

// The stronghold chunk positions of a world seed (MapGenStronghold.getCoordList), computed once per seed.
export function strongholdsOf(seed) {
  const js = javaSeed(seed);
  let cache = caches.get(String(js));
  if (!cache) caches.set(String(js), cache = new StructureCache(js, new WorldChunkManager(js)));
  return cache.strongholdPositions();
}

export class ServerEyes {
  constructor(dispense) {
    this.dispense = dispense;
    this.system = new EyesOfEnder(new JavaRandom(Math.floor(Math.random() * 2 ** 48)));
    this.ids = new WeakMap();
  }
  get active() { return this.system.eyes.length > 0; }
  // ItemEnderEye.onItemRightClick for player `p`. True when the click was an eye (used up either way).
  use(p) {
    const sim = this.dispense.sim, s = p.survival;
    if ((p.dimension | 0) !== 0) return true; // the Nether's and the End's providers find no stronghold
    const world = sim.world, ox = world.originX ?? 0, oz = world.originZ ?? 0, at = p.position, y = f(at.y + 1.62);
    const goal = nearestStronghold(strongholdsOf(world.seed), Math.trunc(at.x) + ox, Math.trunc(y), Math.trunc(at.z) + oz);
    if (!goal) return true;
    this.system.launch(at.x, y, at.z, [goal[0] - ox, goal[1], goal[2] - oz]);
    const rand = p.rand?.nextFloat ? p.rand : null, r = rand ? rand.nextFloat() : Math.random();
    this.dispense.fx.push({ k: 'sound', name: 'random.bow', x: at.x, y: at.y, z: at.z, volume: 0.5, pitch: f(f(0.4) / f(f(f(r) * f(0.4)) + f(0.8))), dim: 0 });
    if (!s.creative) s.take(ITEM_EYE_OF_ENDER);
    p.swing = 6;
    return true;
  }
  tick() {
    if (!this.system.eyes.length) return;
    const sim = this.dispense.sim, fx = this.dispense.fx, before = new Set(this.system.eyes);
    const world = sim.world;
    this.system.tick({
      inWater: (x, y, z) => { return world.get(Math.floor(x), Math.floor(y), Math.floor(z)) === WATER; },
      drop: (stack, x, y, z) => { sim.items.spawn(stack, x, y, z); },
    });
    for (const e of before) if (e.dead && !e.drops) fx.push({ k: 'eyeShatter', x: Math.floor(e.x + 0.5), y: Math.floor(e.y + 0.5), z: Math.floor(e.z + 0.5), dim: 0 });
  }
  id(e) { let i = this.ids.get(e); if (!i) this.ids.set(e, i = this.dispense.id(e)); return i; }
  // dispEnts rows within 64 blocks of `q`.
  rows(q) { return this.system.eyes.filter(e => (e.x - q.x) ** 2 + (e.z - q.z) ** 2 < NEAR).map(e => ({ k: 'b', i: this.id(e), kind: 'eyeOfEnder', x: e.x, y: e.y, z: e.z })); }
  serialize() { return this.system.eyes.length ? this.system.serialize() : null; }
  load(record) { this.system.load(record); }
}
