import { entityActive } from './streaming-ticks.js';
// EntityMinecartChest (xm) with EntityMinecartContainer (xp) and EntityMinecart (xl) from the
// Minecraft Java 1.7.10 JAR: a 0.98 x 0.7 box with yOffset 0.35, gravity 0.04, the derailed
// func_94088_b (0.4 clamp, x0.5 on the ground, x0.95 in the air), rail travel through
// func_145821_a for plain and golden rails (shape table, slopes, snapping, the container drag,
// the height correction and the golden boost/brake), yaw from the motion with the reverse flag,
// cart-cart and entity pushes (applyEntityCollision), moveEntity against blocks and pushable
// entity boxes, attackEntityFrom (rolling and damage, break above 40 or by a creative player) and
// killMinecart with the native content spill. Replayed against the unchanged classes in
// src/minecarts.test.js (tools/probes/MinecartProbe.java, public/research/minecart-reference.json).
//
// A cart keeps posY (`posY`, the native field) and its box (`bb`); `y` is the box bottom as for the
// other entity systems. Contents are browser stacks mapped from original ids with
// region-import.js itemFromOriginal; an original item this build cannot map stays in `unmapped`
// (same slot) so it is saved and re-mapped later, and it still takes its native spill randoms.
import * as W from "./world.js";
import { collisionBoxList, normalCube, CACTUS, WEB } from "./world.js";
import { blockCollisions, setInWeb } from "./block-collisions.js";
import { JavaRandom } from "./java-random.js";
import { mhSin, mhCos } from "./lighting.js";
import { solidTop } from "./rails.js";
import { StackArray, ChestContainer, copyStack } from "./inventory.js";
import { ITEMS } from "./survival.js";
import { itemFromOriginal, ORIGINAL_ITEMS } from "./region-import.js";
import * as V from "./cart-variants.js";
import { hopperSuck, hopperCartContainer } from "./cart-hopper.js";

const f = Math.fround;
export const CART_WIDTH = f(0.98), CART_HEIGHT = f(0.7), CART_SLOTS = 27;
// Entity.yOffset = height / 2 (float); setPosition's half width (float).
export const Y_OFFSET = f(CART_HEIGHT / 2);
const HALF = f(CART_WIDTH / 2);
// Original ids of the drops (Items.minecart, Blocks.chest).
export const MINECART_ITEM = 328, CHEST_ITEM = 54;
// RenderMinecart's double d7 = 0.3f.
const RENDER_AHEAD = f(0.3);
const MAX_SPEED = 0.4, SLOPE = 0.0078125, GRAVITY = f(0.04), AIR_DRAG = f(0.95), BREAK = 40;
// EntityMinecart.matrix [xl.c]: the two ends of each rail shape.
export const RAIL_SHAPES = [
  [[0, 0, -1], [0, 0, 1]], [[-1, 0, 0], [1, 0, 0]], [[-1, -1, 0], [1, 0, 0]], [[-1, 0, 0], [1, -1, 0]], [[0, 0, -1], [0, -1, 1]],
  [[0, -1, -1], [0, 0, 1]], [[0, 0, 1], [1, 0, 0]], [[0, 0, 1], [-1, 0, 0]], [[0, 0, -1], [-1, 0, 0]], [[0, 0, -1], [1, 0, 0]],
];
// Max stack sizes of original loot items without a browser item yet (saddle, horse armour, book).
const ORIGINAL_STACK = { 329: 1, 417: 1, 418: 1, 419: 1, 403: 1, 328: 1 };
// Browser id -> original id/damage, inverted from ORIGINAL_ITEMS for the NBT view.
let REVERSE = null;
function originalOf(stack) {
  if (!REVERSE) {
    REVERSE = new Map();
    for (const [key, id] of Object.entries(ORIGINAL_ITEMS)) {
      const [o, d] = key.split(":").map(Number);
      if (!REVERSE.has(id) || d === undefined) REVERSE.set(id, d === undefined ? { id: o } : { id: o, damage: d });
    }
  }
  const o = REVERSE.get(stack.id);
  return o ? { id: o.id, damage: o.damage ?? stack.damage ?? 0 } : null;
}
function itemTagsNbt(stack) {
  const tag = {}, list = (entries) => [9, 10, entries.map((e) => ({ id: [2, e.id], lvl: [2, e.lvl] }))];
  if (Array.isArray(stack.enchantments)) tag.ench = list(stack.enchantments);
  const stored = stack.storedEnchantments ?? (stack.stored?.length ? stack.stored : undefined);
  if (Array.isArray(stored)) tag.StoredEnchantments = list(stored);
  if (Number.isInteger(stack.repairCost)) tag.RepairCost = [3, stack.repairCost];
  if (typeof stack.displayName === 'string') tag.display = [10, { Name: [8, stack.displayName] }];
  if (typeof stack.unbreakable === 'boolean') tag.Unbreakable = [1, stack.unbreakable ? 1 : 0];
  return tag;
}

// Live rail kinds by internal block id. Other native rail kinds are supplied by probe adapters.
// Kinds: "rail", "golden" (powered; meta bit 8), "detector" and "activator" (meta & 7 shapes).
function defaultRails() {
  return { [W.RAIL]: "rail", 135: "golden", 136: "detector", 137: "activator" };
}
const intersects = (a, b) => b[3] > a[0] && b[0] < a[3] && b[4] > a[1] && b[1] < a[4] && b[5] > a[2] && b[2] < a[5];
const grow = (b, x, y, z) => [x < 0 ? b[0] + x : b[0], y < 0 ? b[1] + y : b[1], z < 0 ? b[2] + z : b[2], x > 0 ? b[3] + x : b[3], y > 0 ? b[4] + y : b[4], z > 0 ? b[5] + z : b[5]];
const offsetX = (o, bb, d) => {
  if (bb[4] > o[1] && bb[1] < o[4] && bb[5] > o[2] && bb[2] < o[5]) {
    if (d > 0 && bb[3] <= o[0]) d = Math.min(d, o[0] - bb[3]);
    else if (d < 0 && bb[0] >= o[3]) d = Math.max(d, o[3] - bb[0]);
  }
  return d;
};
const offsetY = (o, bb, d) => {
  if (bb[3] > o[0] && bb[0] < o[3] && bb[5] > o[2] && bb[2] < o[5]) {
    if (d > 0 && bb[4] <= o[1]) d = Math.min(d, o[1] - bb[4]);
    else if (d < 0 && bb[1] >= o[4]) d = Math.max(d, o[4] - bb[1]);
  }
  return d;
};
const offsetZ = (o, bb, d) => {
  if (bb[3] > o[0] && bb[0] < o[3] && bb[4] > o[1] && bb[1] < o[4]) {
    if (d > 0 && bb[5] <= o[2]) d = Math.min(d, o[2] - bb[5]);
    else if (d < 0 && bb[2] >= o[5]) d = Math.max(d, o[5] - bb[2]);
  }
  return d;
};
// MathHelper.wrapAngleTo180_float.
const wrap = (a) => {
  a = f(a % 360);
  if (a >= 180) a = f(a - 360);
  if (a < -180) a = f(a + 360);
  return a;
};
// Vec3.normalize: a float length; below 1e-4 the zero vector.
const normalize = (x, y, z) => {
  const d = f(Math.sqrt(x * x + y * y + z * z));
  return d < 1.0e-4 ? [0, 0, 0] : [x / d, y / d, z / d];
};

export class Minecarts {
  // `rails` maps internal block ids to rail kinds; `random(cart)` returns the cart's Entity.rand
  // (a JavaRandom); `maxStack(stack)` is Item.getItemStackLimit for browser stacks.
  constructor({ rails = defaultRails(), random = () => new JavaRandom(Math.floor(Math.random() * 2 ** 48)), maxStack = (s) => ITEMS[s.id]?.stack ?? 64 } = {}) {
    Object.assign(this, { rails, makeRandom: random, maxStack, carts: [], nextId: 1 });
    // Item drops ({ stack, original, x, posY, z, motion, delay }): stack is null when the original
    // item has no browser mapping. Feed them to ItemEntities.spawn(stack, x, posY, z, {delay, motion}).
    this.drops = [];
  }
  get list() { return this.carts; }
  drain() { const d = this.drops; this.drops = []; return d; }

  // EntityMinecartChest(world, x, y, z) at the native spawn doubles, then the contents. `record` is
  // { x, y, z, items: [{ slot, id, damage, count, stored? }] } with original item ids.
  spawnChest(record, { seed } = {}) {
    const cart = {
      id: this.nextId++, type: V.isSupportedType(record.type) ? record.type : 1, rider: null, x: 0, posY: 0, z: 0, y: 0, bb: null, vx: 0, vy: 0, vz: 0,
      yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0, onGround: false, fallDistance: 0, inWeb: false, fire: 0,
      damage: 0, rolling: 0, rollingDir: 1, reverse: false, dead: false, customName: record.customName ?? null,
      slots: Array(V.slotCount(record.type)).fill(null), unmapped: Array(V.slotCount(record.type)).fill(null), collidedH: false,
    };
    V.initVariant(cart, record);
    cart.random = seed === undefined ? this.makeRandom(cart) : new JavaRandom(seed);
    this.setPosition(cart, record.x, record.y, record.z);
    cart.px = cart.x; cart.py = cart.posY; cart.pz = cart.z;
    for (const it of record.items ?? []) this.put(cart, it.slot, it);
    this.carts.push(cart);
    return cart;
  }
  // Furnace, TNT, hopper and command block carts (cart-variants.js): the same constructor path with the native type number.
  spawnCart(type, record, options) { return this.spawnChest({ ...record, type: V.isSupportedType(type) ? type : 1 }, options); }
  spawnEmpty(record, options) { return this.spawnChest({ ...record, type: 0, items: [] }, options); }
  // EntityMinecart.getMountedYOffset, Entity.updateRiderPosition. Browser riders use feet,
  // so the rider's getYOffset cancels its own setPosition yOffset (1.62F on the client).
  getMountedYOffset() { return -f(0.3); }
  updateRiderPosition(cart) {
    if (!cart.rider) return;
    // EntityPlayer.getYOffset is yOffset - 0.5F (not just yOffset).
    Object.assign(cart.rider, { x: cart.x, y: cart.posY + this.getMountedYOffset() - 0.5, z: cart.z });
  }
  mount(cart, rider, { sneaking = false } = {}) {
    if (cart.dead || cart.type !== 0 || sneaking || cart.rider || rider.vehicle) return false;
    cart.rider = rider; rider.vehicle = cart;
    this.updateRiderPosition(cart);
    return true;
  }
  // EntityLivingBase.dismountEntity (server player mountEntity(null)). Its asymmetric
  // dx=-1..1, dz=-1..0 search and Java double-to-int casts are intentional.
  dismount(world, rider) {
    const cart = rider.vehicle;
    if (!cart) return false;
    let x = cart.x, y = cart.bb[1] + (cart.height ?? CART_HEIGHT), z = cart.z;
    const width = rider.width ?? f(0.6), height = rider.height ?? f(1.8), half = width / 2;
    const clear = (dx, dz) => {
      const box = [rider.x - half + dx, rider.y + 1, rider.z - half + dz, rider.x + half + dx, rider.y + 1 + height, rider.z + half + dz];
      return this.boxes(world, cart, box, []).length === 0;
    };
    search: for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz < 1; dz++) {
      if ((!dx && !dz) || !clear(dx, dz)) continue;
      const bx = Math.trunc(rider.x + dx), by = Math.trunc(rider.y), bz = Math.trunc(rider.z + dz);
      if (solidTop(world, bx, by, bz)) { x = rider.x + dx; y = rider.y + 1; z = rider.z + dz; break search; }
      if (solidTop(world, bx, by - 1, bz) || world.get(bx, by - 1, bz) === W.WATER) { x = rider.x + dx; y = rider.y + 1; z = rider.z + dz; }
    }
    Object.assign(rider, { x, y, z, vehicle: null, fallDistance: 0 });
    cart.rider = null;
    return true;
  }
  // setInventorySlotContents with an original stack: counts above 64 are clipped.
  put(cart, slot, it) {
    if (!(slot >= 0 && slot < cart.slots.length) || !(it?.count > 0)) return;
    const count = Math.min(64, it.count), mapped = itemFromOriginal(it.id, it.damage ?? 0);
    if (mapped) {
      cart.slots[slot] = copyStack({ id: mapped.id, count, damage: mapped.damage,
        ...(it.stored ? { stored: it.stored } : {}), ...(it.enchantments ? { enchantments: it.enchantments } : {}),
        ...(it.storedEnchantments ? { storedEnchantments: it.storedEnchantments } : {}),
        ...(it.repairCost !== undefined ? { repairCost: it.repairCost } : {}),
        ...(it.displayName !== undefined ? { displayName: it.displayName } : {}),
        ...(it.unbreakable !== undefined ? { unbreakable: it.unbreakable } : {}) });
      cart.unmapped[slot] = null;
    } else {
      cart.slots[slot] = null;
      cart.unmapped[slot] = copyStack({ id: it.id, damage: it.damage ?? 0, count,
        ...(it.stored ? { stored: it.stored } : {}), ...(it.enchantments ? { enchantments: it.enchantments } : {}),
        ...(it.storedEnchantments ? { storedEnchantments: it.storedEnchantments } : {}),
        ...(it.repairCost !== undefined ? { repairCost: it.repairCost } : {}),
        ...(it.displayName !== undefined ? { displayName: it.displayName } : {}),
        ...(it.unbreakable !== undefined ? { unbreakable: it.unbreakable } : {}) });
    }
  }
  // Entity.setPosition: the box from posY - yOffset.
  setPosition(cart, x, y, z) {
    cart.x = x; cart.posY = y; cart.z = z;
    const minY = y - Y_OFFSET + 0;
    cart.bb = [x - HALF, minY, z - HALF, x + HALF, minY + CART_HEIGHT, z + HALF];
    cart.y = minY;
  }
  railKind(world, x, y, z) { return this.rails[world.get(x, y, z)] ?? null; }

  // EntityMinecart.func_70489_a: the point on the rail under (x, y, z), or null.
  railPos(world, x, y, z) {
    const bx = Math.floor(x), bz = Math.floor(z);
    let by = Math.floor(y);
    if (this.railKind(world, bx, by - 1, bz)) by--;
    const kind = this.railKind(world, bx, by, bz);
    if (!kind) return null;
    let meta = world.getMeta?.(bx, by, bz) ?? 0;
    if (kind !== "rail") meta &= 7;
    const m = RAIL_SHAPES[meta] ?? RAIL_SHAPES[0];
    const ax = bx + 0.5 + m[0][0] * 0.5, ay = by + 0.5 + m[0][1] * 0.5, az = bz + 0.5 + m[0][2] * 0.5,
      cx = bx + 0.5 + m[1][0] * 0.5, cy = by + 0.5 + m[1][1] * 0.5, cz = bz + 0.5 + m[1][2] * 0.5,
      dx = cx - ax, dy = (cy - ay) * 2, dz = cz - az;
    let t;
    if (dx === 0) { x = bx + 0.5; t = z - bz; }
    else if (dz === 0) { z = bz + 0.5; t = x - bx; }
    else t = ((x - ax) * dx + (z - az) * dz) * 2;
    x = ax + dx * t; y = ay + dy * t; z = az + dz * t;
    if (dy < 0) y += 1;
    if (dy > 0) y += 0.5;
    return { x, y, z };
  }
  // EntityMinecart.func_70495_a: the rail point `d` along the shape from (x, y, z).
  railPosAhead(world, x, y, z, d) {
    const bx = Math.floor(x), bz = Math.floor(z);
    let by = Math.floor(y);
    if (this.railKind(world, bx, by - 1, bz)) by--;
    const kind = this.railKind(world, bx, by, bz);
    if (!kind) return null;
    let meta = world.getMeta?.(bx, by, bz) ?? 0;
    if (kind !== "rail") meta &= 7;
    y = by;
    if (meta >= 2 && meta <= 5) y = by + 1;
    const m = RAIL_SHAPES[meta] ?? RAIL_SHAPES[0];
    const dx = m[1][0] - m[0][0], dz = m[1][2] - m[0][2], len = Math.sqrt(dx * dx + dz * dz);
    x += (dx / len) * d;
    z += (dz / len) * d;
    if (m[0][1] !== 0 && Math.floor(x) - bx === m[0][0] && Math.floor(z) - bz === m[0][2]) y += m[0][1];
    else if (m[1][1] !== 0 && Math.floor(x) - bx === m[1][0] && Math.floor(z) - bz === m[1][2]) y += m[1][1];
    return this.railPos(world, x, y, z);
  }

  // World.getCollidingBoundingBoxes for a cart: block boxes (rails have none) and the boxes of
  // pushable entities (EntityMinecart.getCollisionBox returns any canBePushed entity's box).
  boxes(world, cart, b, others) {
    const out = [];
    for (let bx = Math.floor(b[0]); bx < Math.floor(b[3] + 1); bx++)
      for (let by = Math.floor(b[1]) - 1; by < Math.floor(b[4] + 1); by++)
        for (let bz = Math.floor(b[2]); bz < Math.floor(b[5] + 1); bz++)
          if (world.solid(bx, by, bz) && !this.railKind(world, bx, by, bz))
            for (const [a, c, d, g, h, i] of collisionBoxList(world, bx, by, bz))
              if (bx + g > b[0] && bx + a < b[3] && by + h > b[1] && by + c < b[4] && bz + i > b[2] && bz + d < b[5]) out.push([bx + a, by + c, bz + d, bx + g, by + h, bz + i]);
    for (const o of others) if (o !== cart && o !== cart.rider && !o.dead && o.bb && intersects(o.bb, b)) out.push(o.bb);
    return out;
  }
  // Entity.moveEntity (sa.d) with stepHeight 0: web slowdown, y/x/z offsets, flags, fall state,
  // zeroed motion, then doBlockCollisions and the burning-box test (block-collisions.js).
  move(world, cart, dx, dy, dz, others) {
    if (cart.inWeb) {
      cart.inWeb = false;
      dx *= 0.25; dy *= 0.05000000074505806; dz *= 0.25;
      cart.vx = cart.vy = cart.vz = 0;
    }
    const odx = dx, ody = dy, odz = dz, bb = cart.bb.slice(), list = this.boxes(world, cart, grow(bb, dx, dy, dz), others);
    for (const o of list) dy = offsetY(o, bb, dy);
    bb[1] += dy; bb[4] += dy;
    for (const o of list) dx = offsetX(o, bb, dx);
    bb[0] += dx; bb[3] += dx;
    for (const o of list) dz = offsetZ(o, bb, dz);
    bb[2] += dz; bb[5] += dz;
    cart.bb = bb;
    cart.x = (bb[0] + bb[3]) / 2;
    cart.posY = bb[1] + Y_OFFSET - 0;
    cart.z = (bb[2] + bb[5]) / 2;
    cart.y = bb[1];
    cart.onGround = ody !== dy && ody < 0;
    cart.collidedH = odx !== dx || odz !== dz;
    // updateFallState: the cart's fall() only passes it to a rider.
    if (cart.onGround) { if (cart.fallDistance > 0) { if (cart.type === 3) V.tntFall(cart, cart.fallDistance, this.host); cart.rider?.fall?.(cart.fallDistance); } cart.fallDistance = 0; }
    else if (dy < 0) cart.fallDistance = f(cart.fallDistance - dy);
    if (odx !== dx) cart.vx = 0;
    if (ody !== dy) cart.vy = 0;
    if (odz !== dz) cart.vz = 0;
    blockCollisions(world, bb, cart, { hurt: (source, n) => this.attack(cart, n, { source }), wet: false });
    this.touchDetectors(world, cart);
  }
  // Block.onEntityCollidedWithBlock for detector rails under the cart (BlockRailDetector): the redstone
  // runtime installs `blockHook(x, y, z, cart)`; Entity.func_145775_I runs it after the move and after the rail step.
  touchDetectors(world, cart) {
    if (!this.blockHook) return;
    const b = cart.bb;
    for (let x = Math.floor(b[0] + 0.001); x <= Math.floor(b[3] - 0.001); x++)
      for (let y = Math.floor(b[1] + 0.001); y <= Math.floor(b[4] - 0.001); y++)
        for (let z = Math.floor(b[2] + 0.001); z <= Math.floor(b[5] - 0.001); z++)
          if (this.rails[world.get(x, y, z)] === "detector") this.blockHook(x, y, z, cart);
  }
  // Entity.func_145775_I alone (EntityMinecart.onUpdate calls it again after the move):
  // cactus cells hurt, web cells set isInWeb.
  touchBlocks(world, cart) {
    const b = cart.bb;
    for (let x = Math.floor(b[0] + 0.001); x <= Math.floor(b[3] - 0.001); x++)
      for (let y = Math.floor(b[1] + 0.001); y <= Math.floor(b[4] - 0.001); y++)
        for (let z = Math.floor(b[2] + 0.001); z <= Math.floor(b[5] - 0.001); z++) {
          const id = world.get(x, y, z);
          if (id === CACTUS) this.attack(cart, 1, { source: "cactus" });
          else if (id === WEB) setInWeb(cart);
        }
    this.touchDetectors(world, cart);
  }
  // func_94088_b: derailed motion.
  offRail(world, cart, others) {
    const d = MAX_SPEED;
    cart.vx = Math.max(-d, Math.min(d, cart.vx));
    cart.vz = Math.max(-d, Math.min(d, cart.vz));
    if (cart.onGround) { cart.vx *= 0.5; cart.vy *= 0.5; cart.vz *= 0.5; }
    this.move(world, cart, cart.vx, cart.vy, cart.vz, others);
    if (!cart.onGround) { cart.vx *= AIR_DRAG; cart.vy *= AIR_DRAG; cart.vz *= AIR_DRAG; }
  }
  // Container.calcRedstoneFromInventory over the 27 slots (unmapped items count too).
  comparator(cart) {
    let n = 0, sum = 0;
    for (let i = 0; i < cart.slots.length; i++) {
      const s = cart.slots[i], u = cart.unmapped[i];
      if (s) sum = f(sum + f(s.count / Math.min(64, this.maxStack(s))));
      else if (u) sum = f(sum + f(u.count / Math.min(64, ORIGINAL_STACK[u.id] ?? 64)));
      else continue;
      n++;
    }
    sum = f(sum / cart.slots.length);
    return Math.floor(f(sum * 14)) + (n > 0 ? 1 : 0);
  }
  // EntityMinecartContainer.applyDrag: 0.98 + 0.001 per missing comparator level.
  drag(cart) {
    if (cart.type === 2) V.furnaceDrag(cart);
    const k = !V.isContainerType(cart.type) ? (cart.rider ? f(0.997) : f(0.96)) : f(f(0.98) + f(f(15 - this.comparator(cart)) * f(0.001)));
    cart.vx *= k; cart.vy *= 0; cart.vz *= k;
  }
  // func_145821_a: one tick on the rail block (bx, by, bz).
  onRail(world, cart, bx, by, bz, kind, meta, others) {
    const d = MAX_SPEED, d2 = SLOPE;
    cart.fallDistance = 0;
    const before = this.railPos(world, cart.x, cart.posY, cart.z);
    cart.posY = by;
    let boost = false, brake = false;
    // onActivatorRailPass(x, y, z, powered): empty on EntityMinecart / EntityMinecartChest in 1.7.10 (only the TNT,
    // hopper and command-block carts override it), so the hook has no default effect.
    if (kind === "activator") { V.activatorPass(cart, (meta & 8) !== 0, this.host); this.activatorHook?.(bx, by, bz, (meta & 8) !== 0, cart); }
    if (kind === "golden") { boost = (meta & 8) !== 0; brake = !boost; }
    if (kind !== "rail") meta &= 7;
    if (meta >= 2 && meta <= 5) cart.posY = by + 1;
    if (meta === 2) cart.vx -= d2;
    if (meta === 3) cart.vx += d2;
    if (meta === 4) cart.vz += d2;
    if (meta === 5) cart.vz -= d2;
    const m = RAIL_SHAPES[meta] ?? RAIL_SHAPES[0];
    let ex = m[1][0] - m[0][0], ez = m[1][2] - m[0][2];
    const len = Math.sqrt(ex * ex + ez * ez);
    if (cart.vx * ex + cart.vz * ez < 0) { ex = -ex; ez = -ez; }
    let speed = Math.sqrt(cart.vx * cart.vx + cart.vz * cart.vz);
    if (speed > 2) speed = 2;
    cart.vx = (speed * ex) / len;
    cart.vz = (speed * ez) / len;
    if (cart.rider?.moveForward > 0 && cart.vx * cart.vx + cart.vz * cart.vz < 0.01) {
      const rad = f(f(f(cart.rider.yaw) * f(Math.PI)) / 180);
      cart.vx += -Math.sin(rad) * 0.1;
      cart.vz += Math.cos(rad) * 0.1;
      brake = false;
    }
    if (brake) {
      if (Math.sqrt(cart.vx * cart.vx + cart.vz * cart.vz) < 0.03) { cart.vx *= 0; cart.vy *= 0; cart.vz *= 0; }
      else { cart.vx *= 0.5; cart.vy *= 0; cart.vz *= 0.5; }
    }
    const ax = bx + 0.5 + m[0][0] * 0.5, az = bz + 0.5 + m[0][2] * 0.5,
      dx = bx + 0.5 + m[1][0] * 0.5 - ax, dz = bz + 0.5 + m[1][2] * 0.5 - az;
    let t;
    if (dx === 0) { cart.x = bx + 0.5; t = cart.z - bz; }
    else if (dz === 0) { cart.z = bz + 0.5; t = cart.x - bx; }
    else t = ((cart.x - ax) * dx + (cart.z - az) * dz) * 2;
    cart.x = ax + dx * t;
    cart.z = az + dz * t;
    this.setPosition(cart, cart.x, cart.posY + Y_OFFSET, cart.z);
    const ridden = cart.rider ? 0.75 : 1;
    const mx = Math.max(-d, Math.min(d, cart.vx * ridden)), mz = Math.max(-d, Math.min(d, cart.vz * ridden));
    this.move(world, cart, mx, 0, mz, others);
    if (m[0][1] !== 0 && Math.floor(cart.x) - bx === m[0][0] && Math.floor(cart.z) - bz === m[0][2]) this.setPosition(cart, cart.x, cart.posY + m[0][1], cart.z);
    else if (m[1][1] !== 0 && Math.floor(cart.x) - bx === m[1][0] && Math.floor(cart.z) - bz === m[1][2]) this.setPosition(cart, cart.x, cart.posY + m[1][1], cart.z);
    this.drag(cart);
    const after = this.railPos(world, cart.x, cart.posY, cart.z);
    if (after && before) {
      const dh = (before.y - after.y) * 0.05, s = Math.sqrt(cart.vx * cart.vx + cart.vz * cart.vz);
      if (s > 0) { cart.vx = (cart.vx / s) * (s + dh); cart.vz = (cart.vz / s) * (s + dh); }
      this.setPosition(cart, cart.x, after.y, cart.z);
    }
    const nx = Math.floor(cart.x), nz = Math.floor(cart.z);
    if (nx !== bx || nz !== bz) {
      const s = Math.sqrt(cart.vx * cart.vx + cart.vz * cart.vz);
      cart.vx = s * (nx - bx);
      cart.vz = s * (nz - bz);
    }
    if (boost) {
      const s = Math.sqrt(cart.vx * cart.vx + cart.vz * cart.vz);
      if (s > 0.01) { cart.vx += (cart.vx / s) * 0.06; cart.vz += (cart.vz / s) * 0.06; }
      else if (meta === 1) {
        if (normalCube(world.get(bx - 1, by, bz))) cart.vx = 0.02;
        else if (normalCube(world.get(bx + 1, by, bz))) cart.vx = -0.02;
      } else if (meta === 0) {
        if (normalCube(world.get(bx, by, bz - 1))) cart.vz = 0.02;
        else if (normalCube(world.get(bx, by, bz + 1))) cart.vz = -0.02;
      }
    }
  }
  // EntityMinecart.onUpdate (xl.h) for one cart, after World.updateEntity's lastTickPos/prevRotation.
  // `entities` are other pushable entities ({ bb, dead? }) whose boxes block the move.
  tickCart(world, cart, entities = []) {
    cart.px = cart.x; cart.py = cart.posY; cart.pz = cart.z;
    cart.prevYaw = cart.yaw; cart.prevPitch = cart.pitch;
    if (cart.rolling > 0) cart.rolling--;
    if (cart.damage > 0) cart.damage = f(cart.damage - 1);
    cart.age = (cart.age | 0) + 1; // Entity.onEntityUpdate: ticksExisted++
    if (cart.posY < -64) this.setDead(cart);
    const others = [...this.carts, ...entities];
    cart.vy -= GRAVITY;
    const bx = Math.floor(cart.x), bz = Math.floor(cart.z);
    let by = Math.floor(cart.posY);
    if (this.railKind(world, bx, by - 1, bz)) by--;
    const kind = this.railKind(world, bx, by, bz);
    if (kind) { this.onRail(world, cart, bx, by, bz, kind, world.getMeta?.(bx, by, bz) ?? 0, others); if (cart.type === 2) V.furnaceRail(cart); }
    else this.offRail(world, cart, others);
    // Stop at resident bounds. Streaming advances the window before rider movement;
    // finite worlds retain their existing viewport guard.
    if (world.inside) {
      const x = Math.max((world.minX ?? 0)+HALF, Math.min((world.maxX ?? W.SIZE) - HALF, cart.x)), z = Math.max((world.minZ ?? 0)+HALF, Math.min((world.maxZ ?? W.SIZE) - HALF, cart.z));
      if (x !== cart.x || z !== cart.z) {
        if (x !== cart.x) cart.vx = 0;
        if (z !== cart.z) cart.vz = 0;
        this.setPosition(cart, x, cart.posY, z);
      }
    }
    this.touchBlocks(world, cart);
    cart.pitch = 0;
    const mx = cart.px - cart.x, mz = cart.pz - cart.z;
    if (mx * mx + mz * mz > 0.001) {
      cart.yaw = f((Math.atan2(mz, mx) * 180) / Math.PI);
      if (cart.reverse) cart.yaw = f(cart.yaw + 180);
    }
    const turn = wrap(f(cart.yaw - cart.prevYaw));
    if (turn < -170 || turn >= 170) { cart.yaw = f(cart.yaw + 180); cart.reverse = !cart.reverse; }
    cart.yaw = f(cart.yaw % 360);
    cart.pitch = f(cart.pitch % 360);
    const near = [cart.bb[0] - f(0.2), cart.bb[1], cart.bb[2] - f(0.2), cart.bb[3] + f(0.2), cart.bb[4], cart.bb[5] + f(0.2)];
    for (const o of this.carts) if (o !== cart && !o.dead && intersects(o.bb, near)) this.collide(o, cart);
    if (cart.rider?.dead) { cart.rider.vehicle = null; cart.rider = null; }
    V.variantTick(cart, this.host, hopperSuck);
  }
  // `host` (optional): { explode(cart, x, y, z, power), particle(name, x, y, z, mx, my, mz), sound(name, cart), transfer, changed }.
  tick(world, { entities = [], host = null } = {}) {
    this.host = host;
    for (const cart of [...this.carts]) if (!cart.dead && entityActive(world,cart)) this.tickCart(world, cart, entities);
    this.carts = this.carts.filter((c) => !c.dead);
  }
  // EntityMinecart.applyEntityCollision(other) on `cart`. Another cart trades motion along the
  // track; any other entity (the player, a mob: EntityLivingBase.collideWithNearbyEntities calls
  // this for each pushable entity within 0.2) is pushed: returns the velocity [x, z] to add to it.
  // A chest cart never picks up a mob (only the empty cart, type 0, does).
  collide(cart, other) {
    if (cart.dead || other === cart.rider) return [0, 0];
    let dx = other.x - cart.x, dz = other.z - cart.z, d = dx * dx + dz * dz;
    if (!(d >= 9.999999747378752e-5)) return [0, 0];
    d = f(Math.sqrt(d));
    dx /= d; dz /= d;
    let k = 1 / d;
    if (k > 1) k = 1;
    dx *= k; dz *= k;
    dx *= 0.10000000149011612; dz *= 0.10000000149011612;
    dx *= 1; dz *= 1;
    dx *= 0.5; dz *= 0.5;
    if (other.slots) {
      const a = normalize(other.x - cart.x, 0, other.z - cart.z), r = f(f(cart.yaw * f(Math.PI)) / 180),
        b = normalize(mhCos(r), 0, mhSin(r));
      if (Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) < 0.800000011920929) return [0, 0];
      const sx = other.vx + cart.vx, sz = other.vz + cart.vz;
      cart.vx *= 0.20000000298023224; cart.vz *= 0.20000000298023224;
      // Entity.addVelocity adds 0 to motionY too (so -0 becomes 0).
      cart.vx += sx / 2 - dx; cart.vy += 0; cart.vz += sz / 2 - dz;
      other.vx *= 0.20000000298023224; other.vz *= 0.20000000298023224;
      other.vx += sx / 2 + dx; other.vy += 0; other.vz += sz / 2 + dz;
      return [0, 0];
    }
    cart.vx += -dx; cart.vy += 0; cart.vz += -dz;
    return [dx / 4, dz / 4];
  }
  // The carts a living entity's box (grown by 0.2, 0, 0.2) touches, pushed as collide() does;
  // returns the summed velocity [x, z] for the entity.
  pushEntity(entity, box) {
    const near = [box[0] - f(0.2), box[1], box[2] - f(0.2), box[3] + f(0.2), box[4], box[5] + f(0.2)];
    let x = 0, z = 0;
    for (const cart of this.carts)
      if (!cart.dead && intersects(cart.bb, near)) {
        const [ax, az] = this.collide(cart, entity);
        x += ax; z += az;
      }
    return [x, z];
  }

  // EntityMinecart.attackEntityFrom: flips the rolling direction, rolling 10, damage + 10 x amount;
  // above 40 (or any creative player hit) the cart breaks. `creative` is the attacker's
  // PlayerCapabilities.isCreativeMode. Returns true (the hit always registers).
  attack(cart, amount, { creative = false, source = null } = {}) {
    if (cart.dead) return true;
    cart.rollingDir = -cart.rollingDir;
    cart.rolling = 10;
    cart.damage = f(cart.damage + f(amount * 10));
    if (creative || cart.damage > BREAK) {
      if (!creative || cart.customName) this.kill(cart, source);
      else this.setDead(cart);
    }
    return true;
  }
  hit(cart, amount, options) { return this.attack(cart, amount, options); }
  // EntityMinecartContainer.setDead: each stack spills from a random point 0.1-0.9 inside the
  // cart's corner block, in pieces of 10-30 with gaussian motion x 0.05 (+0.2 up), no pickup delay.
  spill(cart) {
    const r = cart.random, spilled = [];
    for (let i = 0; i < cart.slots.length; i++) {
      const s = cart.slots[i], u = cart.unmapped[i], src = s ?? u;
      if (!src) continue;
      spilled.push(i);
      const ox = f(f(r.nextFloat() * f(0.8)) + f(0.1)), oy = f(f(r.nextFloat() * f(0.8)) + f(0.1)), oz = f(f(r.nextFloat() * f(0.8)) + f(0.1));
      let left = src.count;
      while (left > 0) {
        let n = r.nextInt(21) + 10;
        if (n > left) n = left;
        left -= n;
        const piece = { ...src, count: n, ...(src.stored ? { stored: src.stored.map((e) => ({ ...e })) } : {}) },
          motion = [f(f(r.nextGaussian()) * f(0.05)), f(f(f(r.nextGaussian()) * f(0.05)) + f(0.2)), f(f(r.nextGaussian()) * f(0.05))];
        this.drops.push({ stack: s ? piece : null, original: u ? piece : null, x: cart.x + ox, posY: cart.posY + oy, z: cart.z + oz, motion, delay: 0 });
      }
    }
    cart.slots.fill(null);
    cart.unmapped.fill(null);
    return spilled;
  }
  setDead(cart) {
    if (!cart.dead) this.spill(cart);
    cart.dead = true;
  }
  // Entity.entityDropItem(stack, 0): at posX/posY/posZ with pickup delay 10; EntityItem's own
  // constructor motion (Math.random in 1.7.10), so `motion` is null.
  dropOriginal(cart, id, name = null) {
    const mapped = itemFromOriginal(id, 0), stack = mapped ? { id: mapped.id, count: 1, damage: 0, ...(name ? { name } : {}) } : null;
    this.drops.push({ stack, original: mapped ? null : { id, damage: 0, count: 1, ...(name ? { name } : {}) }, x: cart.x, posY: cart.posY, z: cart.z, motion: null, delay: 10 });
  }
  // EntityMinecartChest.killMinecart: setDead (spill), the minecart item (with the custom name),
  // EntityMinecartContainer's second pass over the emptied slots (three floats each), the chest.
  kill(cart, source = null) {
    if (cart.dead) return;
    const spilled = this.spill(cart);
    cart.dead = true;
    this.dropOriginal(cart, MINECART_ITEM, cart.customName);
    for (let n = 0; n < spilled.length * 3; n++) cart.random.nextFloat();
    V.killExtras(cart, source, (id) => this.dropOriginal(cart, id), this.host);
  }

  // EntityMinecartContainer.interactFirst -> displayGUIChest: the cart's 27 slots as an IInventory
  // titled "Minecart" (container.minecart) or its custom name. Null once the cart is dead.
  interact(cart) {
    if (cart.dead || !V.isContainerType(cart.type)) return null;
    // A stack placed over a slot still holding an unmapped original item moves that item to the
    // first free slot (it stays hidden; it is not a native case, since the native slot holds it).
    const inv = new StackArray(cart.slots, () => {
      for (let i = 0; i < cart.slots.length; i++)
        if (cart.slots[i] && cart.unmapped[i]) {
          const free = cart.slots.findIndex((s, j) => !s && !cart.unmapped[j]);
          if (free < 0) break;
          cart.unmapped[free] = cart.unmapped[i];
          cart.unmapped[i] = null;
        }
    });
    inv.title = cart.customName || "Minecart";
    inv.cart = cart;
    return inv;
  }
  // ChestContainer over interact(cart), as BlockChest's container is built in survival.openChest.
  container(cart, playerInventory) {
    const inv = this.interact(cart);
    if (inv && cart.type === 5) return hopperCartContainer(cart, playerInventory, inv.onChange);
    return inv && Object.assign(new ChestContainer(playerInventory, inv), { title: inv.title, cart });
  }
  // EntityMinecartContainer.isUseableByPlayer: alive and within 8 blocks (squared distance to posY).
  usable(cart, player) {
    return !cart.dead && (player.x - cart.x) ** 2 + (player.y - cart.posY) ** 2 + (player.z - cart.z) ** 2 <= 64;
  }
  // The pick ray target: EntityMinecart.canBeCollidedWith (alive) with its box.
  pickable() { return this.carts.filter((c) => !c.dead); }

  // Entity.writeToNBT for a chest cart (without UUIDs), as { key: [type, value] } with lists as
  // [type, elementType, items]. Items carry original ids (mapped stacks through the inverse table).
  toNBT(cart) {
    const items = [];
    for (let i = 0; i < cart.slots.length; i++) {
      const s = cart.slots[i], u = cart.unmapped[i];
      const o = s ? { ...originalOf(s), count: s.count, stored: s.stored } : u;
      if (!o?.id) continue;
      const item = { Slot: [1, i], id: [2, o.id], Count: [1, o.count], Damage: [2, o.damage ?? 0] };
      const nbt = itemTagsNbt(s ? { ...o, ...s } : o);
      if (Object.keys(nbt).length) item.tag = [10, nbt];
      items.push(item);
    }
    const out = {
      Pos: [9, 6, [cart.x, cart.posY, cart.z]], Motion: [9, 6, [cart.vx, cart.vy, cart.vz]], Rotation: [9, 5, [cart.yaw, cart.pitch]],
      FallDistance: [5, cart.fallDistance], Fire: [2, cart.fire], Air: [2, 300], OnGround: [1, cart.onGround ? 1 : 0], Dimension: [3, 0],
      Invulnerable: [1, 0], PortalCooldown: [3, 0], Items: [9, items.length ? 10 : 0, items],
    };
    if (cart.customName) out.CustomName = [8, cart.customName];
    if (!V.isContainerType(cart.type)) delete out.Items;
    return Object.assign(out, V.variantNBT(cart));
  }
  // Browser save: the fields EntityMinecartChest writes (damage, rolling and the reverse flag are
  // DataWatcher/transient state that a native reload also resets), with original ids for
  // unmapped items so they map once the build has them.
  toJSON() {
    return {
      version: 1,
      carts: this.carts.filter((c) => !c.dead).map((c) => ({
        type: c.type, rider: c.rider?.player === true || undefined,
        x: c.x, y: c.posY, z: c.z, motion: [c.vx, c.vy, c.vz], rotation: [c.yaw, c.pitch], fallDistance: c.fallDistance, fire: c.fire, onGround: c.onGround,
        customName: c.customName || undefined, ...V.variantJSON(c),
        items: c.slots.flatMap((s, slot) => {
          const o = s ? originalOf(s) : null, u = c.unmapped[slot];
          if (s && o) return [{ slot, ...copyStack(s), id: o.id, damage: o.damage, count: s.count }];
          if (u) return [{ slot, ...copyStack(u) }];
          return [];
        }),
      })),
    };
  }
  static fromJSON(json, options) {
    const m = new Minecarts(options), ok = (...v) => v.every(Number.isFinite);
    for (const c of Array.isArray(json?.carts) ? json.carts.slice(0, 1024) : []) {
      if (!ok(c?.x, c?.y, c?.z)) continue;
      const items = (Array.isArray(c.items) ? c.items : []).filter((it) => Number.isInteger(it?.slot) && Number.isInteger(it?.id) && Number.isInteger(it?.count) &&
        (it.damage === undefined || Number.isInteger(it.damage)) && [it.stored, it.enchantments, it.storedEnchantments].every((list) => list === undefined || (Array.isArray(list) && list.every((e) => Number.isInteger(e?.id) && Number.isInteger(e?.lvl)))) &&
        (it.repairCost === undefined || Number.isInteger(it.repairCost)) && (it.displayName === undefined || typeof it.displayName === 'string') &&
        (it.unbreakable === undefined || typeof it.unbreakable === 'boolean'));
      const cart = m.spawnCart(c.type, { x: c.x, y: c.y, z: c.z, items: V.isContainerType(c.type) ? items : [], fuel: c.fuel, pushX: c.pushX, pushZ: c.pushZ, fuse: c.fuse, cooldown: c.cooldown, command: c.command, customName: typeof c.customName === "string" && c.customName ? c.customName : null });
      cart.restorePlayer = c.type === 0 && c.rider === true;
      const v = Array.isArray(c.motion) && c.motion.length === 3 && ok(...c.motion) ? c.motion : [0, 0, 0];
      // Entity.readFromNBT: motion components above 10 in magnitude are dropped to 0.
      [cart.vx, cart.vy, cart.vz] = v.map((x) => (Math.abs(x) > 10 ? 0 : x));
      if (Array.isArray(c.rotation) && c.rotation.length === 2 && ok(...c.rotation)) [cart.yaw, cart.pitch] = c.rotation.map(f);
      cart.prevYaw = cart.yaw; cart.prevPitch = cart.pitch;
      if (ok(c.fallDistance)) cart.fallDistance = f(c.fallDistance);
      if (Number.isInteger(c.fire)) cart.fire = c.fire;
      cart.onGround = !!c.onGround;
    }
    return m;
  }

  // RenderMinecart.doRender's transform for `cart` at `partial`: the entity-id jitter, the
  // interpolated position moved onto the rail (between the points 0.3 ahead and behind), yaw and
  // pitch from that slope (atan * 73), and the hurt wobble angle. Angles in degrees as GL uses them:
  // rotate (180 - yaw) about Y, then -pitch about Z, then `roll` about X.
  renderPose(world, cart, partial = 1) {
    let l = BigInt.asIntN(64, BigInt(cart.id) * 493286711n);
    l = BigInt.asIntN(64, l * l * 4392167121n + l * 98761n);
    const jitter = (shift) => f(f(f(f(Number((l >> shift) & 7n)) + f(0.5)) / 8 - f(0.5)) * f(0.004));
    const lerp = (a, b) => a + (b - a) * partial;
    const x = lerp(cart.px, cart.x), y = lerp(cart.py, cart.posY), z = lerp(cart.pz, cart.z);
    let rx = x, ry = y, rz = z, yaw = f(cart.prevYaw + f(f(cart.yaw - cart.prevYaw) * partial)), pitch = f(cart.prevPitch + f(f(cart.pitch - cart.prevPitch) * partial));
    const at = world && this.railPos(world, x, y, z);
    if (at) {
      const ahead = this.railPosAhead(world, x, y, z, RENDER_AHEAD) ?? at, behind = this.railPosAhead(world, x, y, z, -RENDER_AHEAD) ?? at;
      rx = at.x; ry = (ahead.y + behind.y) / 2; rz = at.z;
      let d = [behind.x - ahead.x, behind.y - ahead.y, behind.z - ahead.z];
      if (Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]) !== 0) {
        d = normalize(...d);
        yaw = f((Math.atan2(d[2], d[0]) * 180) / Math.PI);
        pitch = f(Math.atan(d[1]) * 73);
      }
    }
    const amp = f(cart.rolling - partial), dmg = Math.max(0, f(cart.damage - partial));
    const roll = amp > 0 ? f(f(f(f(mhSin(amp) * amp) * dmg) / 10) * cart.rollingDir) : 0;
    return { x: rx + jitter(16n), y: ry + jitter(20n), z: rz + jitter(24n), yaw, pitch, roll };
  }
}
