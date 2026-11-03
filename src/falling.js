// Falling sand and gravel, Minecraft Java 1.7.10: BlockFalling (akx), BlockSand (anh, original
// id 12, here 6), BlockGravel (ali, original 13, here 25) and EntityFallingBlock (xj). Checked
// against the unchanged classes by tools/verify-plants.mjs (public/research/plant-reference.json).
import { explosionImpact } from "./explosion.js";
import { WATER, LAVA, FIRE, SAND, GRAVEL, ANVIL } from "./world.js";
import { moveEntity } from "./entities.js";
import { replaceable } from "./plants.js";
import { saveTicks, readTicks } from "./scheduled-ticks.js";
import { entityActive } from './streaming-ticks.js';
import { JavaRandom } from './java-random.js';
import { anvilDropDamage, anvilImpact } from './anvil-block.js';

const f = Math.fround;
export const FLINT = 313;
export const isFallingBlock = (b) => b === SAND || b === GRAVEL || b === ANVIL;
// BlockFalling.func_149831_e (canFallBelow): air, fire, or a water or lava material.
export const canFallBelow = (b) => b === 0 || b === FIRE || b === WATER || b === LAVA;
// BlockGravel.getItemDropped: flint when nextInt(10 - fortune * 3) is 0 (fortune capped at 3).
export function gravelDrop(random, fortune = 0) {
  return random.nextInt(10 - Math.min(fortune, 3) * 3) === 0 ? FLINT : GRAVEL;
}
// Block.tickRate for BlockFalling.
export const FALL_DELAY = 2;
// EntityFallingBlock: setSize(0.98F, 0.98F), yOffset = height / 2.
export const FALLING_SIZE = 0.98, FALLING_Y_OFFSET = f(0.49);

const NEIGHBOURS = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
const key = (x, y, z) => `${x},${y},${z}`;

// The scheduled updates (World.scheduleBlockUpdate: one per position and block, a repeat request
// is ignored) and the falling entities. `drop(stack, x, posY, z)` is Entity.entityDropItem(stack,
// 0): one item entity at the falling block's position. `apply(changes)` gets [x, y, z, old, new]
// entries for the renderer.
export class FallingBlocks {
  constructor(world, { drop = () => {}, apply = () => {}, hurt = () => {}, sound = () => {}, entityRandom = () => new JavaRandom(BigInt(Math.floor(Math.random() * 2 ** 48))) } = {}, saved = []) {
    this.world = world;
    this.drop = drop;
    this.apply = apply;
    this.hurt = hurt;
    this.sound = sound;
    this.entityRandom = entityRandom;
    this.time = 0;
    this.pending = new Map();
    this.entities = [];
    if (Array.isArray(saved)) for (const e of saved.slice(0, 1024)) this.restoreEntity(e);
  }
  // BlockFalling.onBlockAdded and onNeighborBlockChange both schedule an update in tickRate (2).
  schedule(x, y, z, b = this.world.get(x, y, z)) {
    this.enqueue(x, y, z, b, FALL_DELAY);
  }
  enqueue(x, y, z, b, delay) {
    const k = key(x, y, z) + ":" + b;
    if (!this.pending.has(k)) this.pending.set(k, { x, y, z, block: b, time: this.time + delay });
  }
  // Keep scheduled work separate from the existing falling-entity save array.
  save() {
    return saveTicks([...this.pending.values()].map((e, id) => ({ ...e, id })), this.time);
  }
  load(data) {
    const state = readTicks(data, this.world, isFallingBlock);
    if (!state) { this.wake(); return; }
    this.time = state.time;
    this.pending.clear();
    // Preserve the first entry per block/position, even when it is now stale.
    for (const e of state.entries) this.enqueue(e.x, e.y, e.z, e.block, e.delay);
    // Stable sort also handles imported entries that are not already time-ordered.
    this.pending = new Map([...this.pending].sort((a, b) => a[1].time - b[1].time));
  }
  watch() {
    const next = this.world.onChange;
    this.world.onChange = (x, y, z, old, now) => {
      next?.(x, y, z, old, now);
      if (isFallingBlock(now) && old !== now) this.schedule(x, y, z, now);
      for (const [dx, dy, dz] of NEIGHBOURS) {
        const b = this.world.get(x + dx, y + dy, z + dz);
        if (isFallingBlock(b)) this.schedule(x + dx, y + dy, z + dz, b);
      }
    };
    return this;
  }
  // Legacy saves without a queue: edited unsupported sand/gravel falls once loaded.
  wake() {
    for (const k of this.world.edits.keys()) {
      const [x, y, z] = k.split(",").map(Number);
      for (const [dx, dy, dz] of [[0, 0, 0], ...NEIGHBOURS]) {
        const b = this.world.get(x + dx, y + dy, z + dz);
        if (isFallingBlock(b) && canFallBelow(this.world.get(x + dx, y + dy - 1, z + dz))) this.schedule(x + dx, y + dy, z + dz, b);
      }
    }
  }
  // BlockFalling.updateTick -> func_149830_m: with room below (and y >= 0) an EntityFallingBlock
  // is spawned at the block's centre carrying its metadata. The source stays until the entity's
  // first tick. (The instant fall only happens when the chunks around are not loaded.)
  fall(x, y, z) {
    const w = this.world, b = w.get(x, y, z);
    if (!canFallBelow(w.get(x, y - 1, z)) || y < 0) return null;
    const e = spawnFalling(b, w.getMeta(x, y, z), x, y, z, this.entityRandom());
    this.entities.push(e);
    return e;
  }
  // One server tick: WorldServer.tickUpdates (due scheduled updates whose block is still there),
  // then the entities, the new ones included, as World.updateEntities runs after it.
  tick() {
    this.time++;
    for (const [k, u] of this.pending) {
      if (!entityActive(this.world,u)) { u.time++; continue; }
      if (u.time > this.time) continue;
      this.pending.delete(k);
      if (this.world.get(u.x, u.y, u.z) === u.block) this.fall(u.x, u.y, u.z);
    }
    for (const e of this.entities) if (!e.dead && entityActive(this.world,e)) this.tickEntity(e);
    this.entities = this.entities.filter((e) => !e.dead);
  }
  // EntityFallingBlock ignores blast damage but receives knockback. Its posY is the box centre.
  explode(x, y, z, size, exploder = null) {
    const half = f(FALLING_SIZE) / 2;
    for (const e of this.entities) {
      if (e.dead || e === exploder) continue;
      const posY = e.y + FALLING_Y_OFFSET;
      const hit = explosionImpact(this.world, x, y, z, size, e.x, posY, e.z, posY,
        [e.x - half, e.y, e.z - half, e.x + half, e.y + f(FALLING_SIZE), e.z + half]);
      if (hit) { e.vx += hit.push[0]; e.vy += hit.push[1]; e.vz += hit.push[2]; }
    }
  }
  // EntityFallingBlock.onUpdate (xj.h).
  tickEntity(e) {
    const w = this.world;
    if (e.block === 0) {
      e.dead = true;
      return;
    }
    e.px = e.x;
    e.py = e.y;
    e.pz = e.z;
    e.ticks++;
    e.vy -= 0.03999999910593033;
    const landedDistance=moveEntity(w, e, FALLING_SIZE, FALLING_SIZE, e.vx, e.vy, e.vz);
    e.vx *= 0.9800000190734863;
    e.vy *= 0.9800000190734863;
    e.vz *= 0.9800000190734863;
    const posY = e.y + FALLING_Y_OFFSET, i = Math.floor(e.x), j = Math.floor(posY), k = Math.floor(e.z);
    if (e.ticks === 1) {
      if (w.get(i, j, k) !== e.block) {
        e.dead = true;
        return;
      }
      w.set(i, j, k, 0);
      this.apply([[i, j, k, e.block, 0]]);
    }
    if (e.onGround) {
      e.vx *= 0.699999988079071;
      e.vz *= 0.699999988079071;
      e.vy *= -0.5;
      e.dead = true;
      if(e.block===ANVIL){
        const impact=anvilImpact(e.meta,landedDistance,e.rand);
        e.meta=impact.meta;
        e.brokenOnImpact=impact.broken;
        if(impact.damage>0){
          const half=FALLING_SIZE/2,
            box=[e.x-half,e.y,e.z-half,e.x+half,e.y+FALLING_SIZE,e.z+half];
          this.hurt(box,impact.damage,'anvil',e);
        }
      }
      // canPlaceEntityOnSide(block, i, j, k, true, 1): a replaceable cell; nothing to fall into below.
      const old = w.get(i, j, k);
      if (!e.brokenOnImpact && replaceable(old) && !canFallBelow(w.get(i, j - 1, k)) && w.set(i, j, k, e.block, true, e.meta)) {
        this.apply([[i, j, k, old, e.block]]);
        if(e.block===ANVIL)this.sound('random.anvil_land',{x:i+0.5,y:j+0.5,z:k+0.5,volume:1,pitch:1});
      } else if(!e.brokenOnImpact) this.dropItem(e, posY);
    } else if ((e.ticks > 100 && (j < 1 || j > 256)) || e.ticks > 600) {
      this.dropItem(e, posY);
      e.dead = true;
    }
  }
  // damageDropped: sand keeps its metadata (red sand), gravel drops metadata 0.
  dropItem(e, posY) {
    this.drop({ id: e.block, count: 1, damage: e.block === SAND ? e.meta : e.block === ANVIL ? anvilDropDamage(e.meta) : 0 }, e.x, posY, e.z);
  }
  serialize() {
    return this.entities.map(({ block, meta, x, y, z, vx, vy, vz, ticks, onGround, fallDistance }) => ({ block, meta, x, y, z, vx, vy, vz, ticks, onGround, fallDistance }));
  }
  restoreEntity(s) {
    if (!s || !isFallingBlock(s.block) || ![s.x, s.y, s.z, s.vx, s.vy, s.vz, s.ticks].every(Number.isFinite)) return;
    const e = spawnFalling(s.block, Number.isInteger(s.meta) ? s.meta & 15 : 0, 0, 0, 0, this.entityRandom());
    Object.assign(e, { x: s.x, y: s.y, z: s.z, px: s.x, py: s.y, pz: s.z, vx: s.vx, vy: s.vy, vz: s.vz, ticks: Math.max(1, Math.floor(s.ticks)), onGround: !!s.onGround, fallDistance: Number.isFinite(s.fallDistance)&&s.fallDistance>0?s.fallDistance:0 });
    this.entities.push(e);
  }
}
// new EntityFallingBlock(world, x + 0.5, y + 0.5, z + 0.5, block, meta): setPosition puts the
// box's bottom at posY - yOffset. `y` here is the box's minY, as for every entity in this build.
export function spawnFalling(block, meta, x, y, z, rand = new JavaRandom(BigInt(Math.floor(Math.random() * 2 ** 48)))) {
  const cx = x + 0.5, cy = y + 0.5, cz = z + 0.5, minY = cy - FALLING_Y_OFFSET;
  return { block, meta, x: cx, y: minY, z: cz, px: cx, py: minY, pz: cz, vx: 0, vy: 0, vz: 0, ticks: 0, onGround: false, fallDistance: 0, inWeb: false, dead: false, rand };
}
