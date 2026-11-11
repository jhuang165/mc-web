import { ringEntityActive } from './streaming-ticks.js';
// EntityItem (xk) from the 1.7.10 JAR: 0.25 x 0.25 boxes with gravity 0.04,
// 0.98 drag (block slipperiness x 0.98 on the ground), Entity.moveEntity
// collision, func_145771_j push-out, merging with neighbours within 0.5
// blocks, a 6,000-tick lifetime and EntityPlayer's pickup box. `y` is the
// bottom of the box; EntityItem's posY sits half the height (0.125) above it.
import { explosionImpact } from "./explosion.js";
import { collisionBoxList, slipperiness } from "./world.js";
import { movingBoxes } from "./moving-boxes.js";
import { copyStack, sameStackItem } from "./inventory.js";
import { waterAcceleration, inLava } from "./fluids.js";
import { LAVA } from "./world.js";

import { webMove } from './webs.js';
import { blockCollisions } from "./block-collisions.js";
import { entityPushOut } from "./entities.js";

const W = 0.125, H = 0.25, LIFETIME = 6000;
const f = Math.fround;

export class ItemEntities {
  constructor(random = Math.random) {
    this.random = random;
    this.items = [];
    // A client world's items (object-tracker.js): EntityItem.onUpdate without the !isRemote parts, the merge search and the lifetime.
    this.remote = false;
    // Sounds items made this tick ({ name, volume, pitch, x, y, z }); the caller drains them.
    this.sounds = [];
  }
  // EntityItem(world, x, posY, z, stack): random hover phase, motion
  // (rand * 0.2 - 0.1, 0.2, rand * 0.2 - 0.1); the pickup delay field starts at 0.
  // `empty` keeps a Count 0 stack, as EntityItem.readEntityFromNBT does (a read one lives and ticks; attributes2-reference.json itemRead).
  spawn(stack, x, posY, z, { delay = 0, motion = null, death = false, empty = false } = {}) {
    if (!(stack?.count > 0 || (empty && stack?.count <= 0))) return null; // Count -1 is kept too; its pickup puts a -1 stack in the inventory (neg-stacks2-reference.json pickup)
    const r = this.random,
      item = {
        stack: copyStack(stack),
        x, y: posY - W, z,
        mx: motion ? motion[0] : f(r() * 0.2 - 0.1),
        my: motion ? motion[1] : 0.2,
        mz: motion ? motion[2] : f(r() * 0.2 - 0.1),
        hover: f(r() * Math.PI * 2),
        age: 0, ticks: 0, delay, onGround: false, death, health: 5, fire: 0,
        px: x, py: posY - W, pz: z,
      };
    this.items.push(item);
    this.joined?.(item); // entity-simulation.js (entityWalkers): the entity's place in World.loadedEntityList
    return item;
  }
  // Block.dropBlockAsItem (func_149642_a): 0.7-wide random spread inside the
  // block; Block.dropBlockAsItemWithChance makes each dropped item its own
  // entity of one.
  dropBlock(stacks, bx, by, bz) {
    const r = this.random, spread = () => f(f(r() * 0.7) + f(0.15));
    for (const s of stacks)
      for (let n = 0; n < s.count; n++) this.spawn({ ...s, count: 1 }, bx + spread(), by + spread(), bz + spread(), { delay: 10 });
  }
  // EntityLiving.dropFewItems -> Entity.entityDropItem(stack, offsetY): one entity
  // per item at the mob's position, `offsetY` above it. `shear` ({offsetY, kick})
  // is EntitySheep's: wool leaves 1.0 up with the kick [mx, my, mz] added to the
  // usual random motion.
  dropMob(id, count, at, damage = 0, shear = null) {
    for (let n = 0; n < count; n++) {
      const r = this.random, kick = shear?.kick,
        motion = kick ? [f(f(r() * 0.2 - 0.1) + kick[0]), f(0.2 + kick[1]), f(f(r() * 0.2 - 0.1) + kick[2])] : null;
      this.spawn({ id, count: 1, damage: damage || 0, ...(shear?.enchantments ? { enchantments: shear.enchantments.map((e) => ({ id: e.id, lvl: e.lvl })) } : {}) }, at.x, at.y + (shear?.offsetY || 0), at.z, { delay: 10, motion });
    }
  }
  // BlockFurnace/BlockChest.breakBlock: each stack leaves from a random point
  // 0.1-0.9 inside the block in pieces of 10-30, with gaussian motion x 0.05
  // (+0.2 up) and no pickup delay.
  spill(stacks, bx, by, bz) {
    const r = this.random,
      gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    for (const s of stacks) {
      if (!s?.count) continue;
      const ox = f(f(r() * 0.8) + 0.1), oy = f(f(r() * 0.8) + 0.1), oz = f(f(r() * 0.8) + 0.1);
      let left = s.count;
      while (left > 0) {
        const n = Math.min(left, Math.floor(r() * 21) + 10);
        left -= n;
        this.spawn({ ...s, count: n }, bx + ox, by + oy, bz + oz, { motion: [f(gauss() * 0.05), f(gauss() * 0.05 + 0.2), f(gauss() * 0.05)] });
      }
    }
  }
  // EntityPlayer.func_146097_a: from 1.32 above the feet (posY - 0.3 + eye
  // height on the server) with a 40-tick delay. Thrown items leave along the
  // view at 0.3 plus a small random kick; death drops scatter up to 0.5.
  dropPlayer(stack, feet, yaw, pitch, scatter = false, death = false) {
    const r = this.random;
    let motion;
    if (scatter) {
      const speed = f(r() * 0.5), angle = f(r() * Math.PI * 2);
      motion = [-Math.sin(angle) * speed, 0.2, Math.cos(angle) * speed];
    } else {
      // This build's yaw/pitch are radians, looking along (-sin yaw, sin pitch, -cos yaw).
      const s = 0.3, cp = Math.cos(pitch), angle = f(r() * Math.PI * 2), kick = f(0.02 * r());
      motion = [
        -Math.sin(yaw) * cp * s + Math.cos(angle) * kick,
        Math.sin(pitch) * s + 0.1 + f((r() - r()) * 0.1),
        -Math.cos(yaw) * cp * s + Math.sin(angle) * kick,
      ];
    }
    // EntityPlayer.func_146097_a drops any stack but an exact size 0, a negative one included (neg-stacks2-reference.json drop).
    if (!stack || stack.count === 0) return null;
    return this.spawn(stack, feet.x, feet.y + 1.32, feet.z, { delay: 40, motion, death, empty: true });
  }
  box(e) {
    return [e.x - W, e.y, e.z - W, e.x + W, e.y + H, e.z + W];
  }
  // Solid block boxes overlapping [x0..x1] (World.getCollidingBoundingBoxes), with the moving piston blocks' boxes.
  boxes(world, x0, y0, z0, x1, y1, z1) {
    const out = movingBoxes([x0, y0, z0, x1, y1, z1]);
    for (let bx = Math.floor(x0); bx < Math.floor(x1 + 1); bx++)
      for (let by = Math.floor(y0) - 1; by < Math.floor(y1 + 1); by++)
        for (let bz = Math.floor(z0); bz < Math.floor(z1 + 1); bz++)
          if (world.solid(bx, by, bz))
            for (const [a, b, c, d, e, g] of collisionBoxList(world, bx, by, bz))
              if (bx + d > x0 && bx + a < x1 && by + e > y0 && by + b < y1 && bz + g > z0 && bz + c < z1) out.push([bx + a, by + b, bz + c, bx + d, by + e, bz + g]);
    return out;
  }
  // Entity.func_145771_j at the item's centre (entities.js entityPushOut).
  pushOut(world, e) {
    const p = entityPushOut(world, e.x, e.y + W, e.z, this.box(e), this.random);
    if (!p) return false;
    e[["mx", "my", "mz"][p[0]]] = p[1];
    return true;
  }
  // Entity.moveEntity without stepping: y, then x, then z against block boxes. The tail
  // (block-collisions.js): cactus and fire take 1 of the item's 5 health, webs, the fire
  // counter (fireResistance 1) and the wet fizz. A noClip move returns before it. `delta` is an outside move's [dx, dy, dz] (a
  // piston push, push() below) instead of the item's motion; blocked axes still zero the motion.
  move(world, e, noClip, wet = false, delta = null) {
    let dx = e.mx, dy = e.my, dz = e.mz;
    if (delta) [dx, dy, dz] = delta;
    if (noClip) {
      e.x += dx;
      e.y += dy;
      e.z += dz;
      return; // Entity.moveEntity's noClip branch only offsets the box (onGround stays, javap sa.d)
    }
    if (!delta) [dx, dy, dz] = webMove(e, e, ['mx', 'my', 'mz']);
    else if (e.inWeb) {
      // Entity.moveEntity's web slowdown on the given delta, which also zeroes the motion.
      e.inWeb = false;
      dx *= 0.25; dy *= 0.05000000074505806; dz *= 0.25;
      e.mx = e.my = e.mz = 0;
    }
    const [a, b, c, d, g, h] = this.box(e),
      list = this.boxes(world, Math.min(a, a + dx), Math.min(b, b + dy), Math.min(c, c + dz), Math.max(d, d + dx), Math.max(g, g + dy), Math.max(h, h + dz)),
      box = [a, b, c, d, g, h];
    const ody = dy, odx = dx, odz = dz;
    for (const o of list)
      if (o[3] > box[0] && o[0] < box[3] && o[5] > box[2] && o[2] < box[5]) {
        if (dy > 0 && o[1] >= box[4]) dy = Math.min(dy, o[1] - box[4]);
        else if (dy < 0 && o[4] <= box[1]) dy = Math.max(dy, o[4] - box[1]);
      }
    box[1] += dy;
    box[4] += dy;
    for (const o of list)
      if (o[4] > box[1] && o[1] < box[4] && o[5] > box[2] && o[2] < box[5]) {
        if (dx > 0 && o[0] >= box[3]) dx = Math.min(dx, o[0] - box[3]);
        else if (dx < 0 && o[3] <= box[0]) dx = Math.max(dx, o[3] - box[0]);
      }
    box[0] += dx;
    box[3] += dx;
    for (const o of list)
      if (o[4] > box[1] && o[1] < box[4] && o[3] > box[0] && o[0] < box[3]) {
        if (dz > 0 && o[2] >= box[5]) dz = Math.min(dz, o[2] - box[5]);
        else if (dz < 0 && o[5] <= box[2]) dz = Math.max(dz, o[5] - box[2]);
      }
    e.x += dx;
    e.y += dy;
    e.z += dz;
    e.onGround = ody !== dy && ody < 0;
    e.collidedH = odx !== dx || odz !== dz; // isCollidedHorizontally
    if (odx !== dx) e.mx = 0;
    if (odz !== dz) e.mz = 0;
    if (ody !== dy) e.my = 0;
    blockCollisions(world, this.box(e), e, {
      hurt: (source, amount) => this.hurt(e, amount),
      wet,
      fizz: () => {
        const r = this.random;
        this.sounds.push({ name: "random.fizz", volume: 0.7, pitch: f(1.6 + f(f(r() - r()) * 0.4)), x: e.x, y: e.y + W, z: e.z });
      },
    });
  }
  // TileEntityPiston pushing the item: Entity.moveEntity by the push delta with the item's own fields, the noClip its last tick's
  // pushOutOfBlocks set (EntityItem.onUpdate: noClip = func_145771_j) and inWater from its last handleWaterMovement.
  push(world, e, dx, dy, dz) {
    if (!e.dead) this.move(world, e, !!e.noClip, !!e.inWater, [dx, dy, dz]);
  }
  // EntityItem.combineItems: the smaller stack joins the larger one.
  combine(e, other, maxStack) {
    if (e === other || e.dead || other.dead) return false;
    const a = e.stack, b = other.stack;
    if (!sameStackItem(a, b)) return false;
    if (b.count < a.count) return this.combine(other, e, maxStack);
    if (a.count + b.count > maxStack(b)) return false;
    b.count += a.count;
    other.delay = Math.max(other.delay, e.delay);
    other.age = Math.min(other.age, e.age);
    e.dead = true;
    return true;
  }
  // EntityItem.attackEntityFrom (xk.a): health 5, the item dies at 0.
  hurt(e, amount) {
    e.velocityChanged = true; // Entity.setBeenAttacked: EntityItem.attackEntityFrom sets it before the health, so the tracker sends S12
    e.health = Math.trunc(e.health - amount);
    if (e.health <= 0) e.dead = true;
  }
  // Explosion.doExplosionA: posY is the box centre, with inherited eye height 0.
  explode(world, x, y, z, size, exploder = null) {
    for (const e of this.items) {
      if (e.dead || e === exploder) continue;
      const posY = e.y + W, hit = explosionImpact(world, x, y, z, size, e.x, posY, e.z, posY, this.box(e));
      if (!hit) continue;
      this.hurt(e, hit.damage);
      e.mx += hit.push[0]; e.my += hit.push[1]; e.mz += hit.push[2];
    }
  }
  // The fire and lava part of Entity.onEntityUpdate (sa.C), after the water
  // check: burning deals 1 (onFire) every 20 ticks of the counter; touching lava
  // deals 4 (lava) and sets fire for 15 s (setFire keeps the larger counter).
  // Fire blocks and cactus act in move's tail.
  burn(world, e) {
    if (e.fire > 0) {
      if (e.fire % 20 === 0) this.hurt(e, 1);
      e.fire--;
    }
    if (inLava(world, this.box(e))) {
      this.hurt(e, 4);
      e.fire = Math.max(e.fire, 300);
    }
  }
  // EntityItem.onUpdate for every item.
  tick(world, maxStack = () => 64) {
    for (const e of this.items) this.tickOne(world, e, maxStack);
    this.reap();
  }
  reap() { this.items = this.items.filter((e) => !e.dead); }
  // One item's update: a walk that holds every kind in one list (entity-simulation.js (entityWalkers)) calls this where the item stands in it.
  tickOne(world, e, maxStack = () => 64) {
    if (e.dead || !ringEntityActive(world,e)) return;
    let wasWet = false;
    // Entity.onUpdate runs handleWaterMovement first; EntityItem (xk.N) passes
    // its own box to World.handleMaterialAcceleration, unshrunk.
    if (world.getMeta) {
      const { wet, push } = waterAcceleration(world, this.box(e));
      e.mx += push[0];
      e.my += push[1];
      e.mz += push[2];
      if (wet) e.fire = 0;
      wasWet = wet;
    }
    this.burn(world, e);
    e.ticks++;
    if (e.delay > 0) e.delay--;
    e.px = e.x;
    e.py = e.y;
    e.pz = e.z;
    e.my -= 0.03999999910593033;
    const noClip = this.pushOut(world, e);
    e.noClip = noClip; // kept for a piston push between ticks (push()); not saved
    e.inWater = wasWet;
    this.move(world, e, noClip, wasWet);
    const moved = Math.trunc(e.px) !== Math.trunc(e.x) || Math.trunc(e.py + W) !== Math.trunc(e.y + W) || Math.trunc(e.pz) !== Math.trunc(e.z);
    if (moved || e.ticks % 25 === 0) {
      // EntityItem.onUpdate: an item whose cell is lava is thrown up and
      // sideways with a fizz (volume 0.4, pitch 2 + 0.4 * random).
      if (world.get(Math.floor(e.x), Math.floor(e.y + W), Math.floor(e.z)) === LAVA) {
        const r = this.random;
        e.my = 0.20000000298023224;
        e.mx = f(f(r() - r()) * 0.2);
        e.mz = f(f(r() - r()) * 0.2);
        this.sounds.push({ name: "random.fizz", volume: 0.4, pitch: f(2 + f(f(r()) * 0.4)), x: e.x, y: e.y + W, z: e.z });
      }
      const [a, b, c, d, g, h] = this.box(e);
      for (const o of this.remote ? [] : this.items) {
        if (o === e || o.dead) continue;
        // Cheap reject, result-neutral: the grown boxes meet only within 0.75 sideways and 0.25 up (ring items made the scan longer).
        if (Math.abs(o.x - e.x) >= 1 || Math.abs(o.z - e.z) >= 1 || Math.abs(o.y - e.y) >= 1) continue;
        const [oa, ob, oc, od, og, oh] = this.box(o);
        if (od > a - 0.5 && oa < d + 0.5 && og > b && ob < g && oh > c - 0.5 && oc < h + 0.5) this.combine(e, o, maxStack);
        if (e.dead) break;
      }
    }
    // EntityItem.onUpdate: the block below the item's minY sets the ground drag (0.98 on ice).
    const drag = e.onGround ? f(slipperiness(world.get(Math.floor(e.x), Math.floor(e.y) - 1, Math.floor(e.z))) * f(0.98)) : f(0.98);
    e.mx *= drag;
    e.my *= 0.9800000190734863;
    e.mz *= drag;
    if (e.onGround) e.my *= -0.5;
    e.age++;
    if ((!this.remote && e.age >= LIFETIME) || e.y + W < -64) e.dead = true;
  }
  // EntityPlayer.onLivingUpdate collides the player's box grown by (1, 0.5, 1)
  // with items; EntityItem.onCollideWithPlayer stores what fits once the
  // pickup delay is over. Returns the items that gave anything.
  collect(feet, width, height, add) {
    const r = width / 2 + 1, picked = [];
    for (const e of this.items) {
      if (e.dead || e.delay > 0) continue;
      const [a, b, c, d, g, h] = this.box(e);
      if (!(d > feet.x - r && a < feet.x + r && g > feet.y - 0.5 && b < feet.y + height + 0.5 && h > feet.z - r && c < feet.z + r)) continue;
      const before = e.stack.count;
      // InventoryPlayer.addItemStackToInventory refuses exactly stackSize 0, so a Count 0 item stays (probed, itemRead EntityItem count 0). A negative
      // stack is added anyway (a new -n slot, or it lowers a matching stack) and the stack size goes to 0, but the call reports false: no pickup event,
      // and the entity lives on with Count 0 (neg-stacks2-reference.json pickup).
      if (before === 0) continue;
      if (!add(e.stack) || before < 0) continue;
      picked.push({ item: e, count: before - e.stack.count });
      if (e.stack.count <= 0) e.dead = true;
    }
    this.items = this.items.filter((e) => !e.dead);
    return picked;
  }
  clear() {
    this.items = [];
  }
  serialize() {
    return this.items.map((e) => this.serializeOne(e));
  }
  serializeOne(e) {
    return { stack: copyStack(e.stack), x: e.x, y: e.y, z: e.z, mx: e.mx, my: e.my, mz: e.mz, age: e.age, delay: e.delay, hover: e.hover, death: e.death || undefined, owner: e.owner || undefined, portalCooldown: e.portalCooldown || undefined };
  }
  // Reads saved items, and the stack piles written before 0.10 (one item per
  // stack at the pile's position, aged by the time the pile had left).
  load(records, read, time = 0) {
    this.items = [];
    const ok = (...v) => v.every(Number.isFinite);
    for (const d of Array.isArray(records) ? records.slice(0, 512) : []) {
      if (d?.stack && ok(d.x, d.y, d.z)) {
        const stack = read(d.stack);
        if (!stack) continue;
        const e = this.spawn(stack, d.x, d.y + W, d.z, { delay: ok(d.delay) ? Math.max(0, Math.min(40, d.delay)) : 0, motion: [ok(d.mx) ? d.mx : 0, ok(d.my) ? d.my : 0, ok(d.mz) ? d.mz : 0], death: !!d.death, empty: true });
        if (!e) continue;
        e.age = ok(d.age) ? Math.max(0, Math.min(LIFETIME - 1, d.age)) : 0;
        if (ok(d.hover)) e.hover = d.hover;
        if (typeof d.owner === "string" && d.owner) e.owner = d.owner.slice(0, 64); // EntityItem Owner (func_145797_a)
        if (Number.isInteger(d.portalCooldown) && d.portalCooldown > 0) e.portalCooldown = Math.min(300, d.portalCooldown); // PortalCooldown (entity-portal.js)
      } else if (Array.isArray(d?.stacks) && d.position && ok(d.position.x, d.position.y, d.position.z)) {
        const age = ok(d.expires) ? Math.max(0, Math.min(LIFETIME - 1, LIFETIME - (d.expires - time))) : 0;
        for (const s of d.stacks) {
          const stack = read(s);
          if (!stack) continue;
          const e = this.spawn(stack, d.position.x, d.position.y + W, d.position.z, { delay: 0, motion: [0, 0, 0], death: !!d.death });
          e.age = age;
        }
      }
    }
  }
}
