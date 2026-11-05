// Minecraft Java 1.7.10 BlockDispenser (original 23, internal 115) and BlockDropper (original 158, internal 132): the redstone
// trigger, TileEntityDispenser.func_146017_i slot choice / func_146019_a addItemStack, and the Bootstrap dispense registry for the
// items this build has (BehaviorDefaultDispenseItem, arrows, eggs, snowballs, splash potions, minecarts, buckets, flint and steel,
// bone meal, TNT). Boats, fire charges and spawn eggs do not exist in this build.
// Native evidence: public/research/dispense-reference.json (tools/verify-dispense.mjs, tools/probes/DispenseProbe.java), replayed by
// src/dispense.test.js. public/research/dispense.md says what is verified and what is approximated.
//
// The engine runs over the redstone world `w` (LiveRedstone or any object with getBlock / getBlockMetadata / setBlockMetadataWithNotify /
// scheduleBlockUpdate / isBlockIndirectlyGettingPowered, original ids) and a `host` of effects:
//   host.tile(x, y, z) -> { items: [9] }          the tile entity (created empty when missing)
//   host.aux(id, x, y, z, data)                   World.playAuxSFX (1000 click, 1001 failed click, 1002 shoot, 2000 smoke)
//   host.spawnItem(stack, x, y, z, mx, my, mz)    an EntityItem with the given motion
//   host.arrow / host.thrown(kind, ...)           projectiles: ({ x, y, z, mx, my, mz, yaw, pitch }) (+ kind, damage for thrown)
//   host.cart(type, x, y, z)                      EntityMinecart (0) / EntityMinecartChest (1) at the native spawn doubles
//   host.spawnTnt(x, y, z)                        EntityTNTPrimed at the cell centre (no ignite sound); host.igniteTnt via w.primeTnt
//   host.setLiquid(x, y, z, originalId) / host.setAir(x, y, z) / host.breakBlock(x, y, z) optional world writers
//   host.boneMeal(x, y, z) -> boolean             ItemDye.func_150919_a for blocks other than wheat, carrots and potatoes
//   host.transfer()                               the inventory-transfer.js host for droppers (omit to always drop)
//   host.maxStack(stack), host.changed(keys[])
import { JavaRandom } from "./java-random.js";
import { copyStack } from "./inventory.js";
import { arrowHeading } from "./bow.js";
import { heading } from "./projectiles.js";
import { containerAt, insertStack, touch } from "./inventory-transfer.js";

const f = Math.fround;
export const DISPENSER_ID = 23, DROPPER_ID = 158; // original ids the engine runs in
export const DISPENSER_BLOCK = 115, DROPPER_BLOCK = 132, DROPPER_ITEM = 1132; // internal ids
export { DROPPER_TITLE } from "./dispenser-container.js";
export const TICK_RATE = 4;
export const SLOTS = 9;
export const FACING = Object.freeze([[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]]);
export const OPPOSITE = Object.freeze([1, 0, 3, 2, 5, 4]);
// Internal item ids of this build.
export const ITEM = Object.freeze({
  ARROW: 320, SNOWBALL: 312, EGG: 316, POTION: 385, MINECART: 366, CHEST_MINECART: 450, BUCKET: 340, WATER_BUCKET: 341,
  LAVA_BUCKET: 342, FLINT_AND_STEEL: 126, DYE: 351, TNT: 55, FIRE_CHARGE: 1952,
});
export const SPLASH_BIT = 16384;
const FLINT_MAX_DAMAGE = 64;
const WHEAT = 59, CARROTS = 141, POTATOES = 142, FIRE = 51, TNT_BLOCK = 46, FLOWING_WATER = 8, STILL_WATER = 9, FLOWING_LAVA = 10, STILL_LAVA = 11;
const RAILS = new Set([66, 27, 28, 157]);
const isLiquidId = (b) => b >= 8 && b <= 11;

const one = (s) => copyStack({ ...s, count: 1 });
const key = (x, y, z) => `${x},${y},${z}`;

// TileEntityDispenser.func_146017_i: every non-empty slot replaces the pick when nextInt(j++) == 0 (its own Random).
export function chooseSlot(items, rand) {
  let pick = -1, j = 1;
  for (let i = 0; i < items.length; i++) if (items[i] && items[i].count > 0 && rand.nextInt(j++) === 0) pick = i;
  return pick;
}
// TileEntityDispenser.func_146019_a: the first empty slot, or -1.
export function addItemStack(items, stack) {
  for (let i = 0; i < items.length; i++) if (!items[i]) { items[i] = stack; return i; }
  return -1;
}
// BlockDispenser.func_149938_b (onBlockAdded): the facing from the opaque neighbours (default south, 3).
export function placedFacing(isOpaque, north, south, west, east) {
  let b = 3;
  if (isOpaque(north) && !isOpaque(south)) b = 3;
  if (isOpaque(south) && !isOpaque(north)) b = 2;
  if (isOpaque(west) && !isOpaque(east)) b = 5;
  if (isOpaque(east) && !isOpaque(west)) b = 4;
  return b;
}

export class Dispensing {
  constructor(host, { slotRandom = new JavaRandom(Math.floor(Math.random() * 2 ** 48)) } = {}) {
    this.host = host;
    // Every TileEntityDispenser has its own unseeded Random; one stream is enough for a browser session.
    this.slotRandom = slotRandom;
    // BehaviorDispenseBoneMeal / BehaviorDispenseFlintAndSteel keep one boolean for the whole session: the first failure clears it
    // and the click sound stays 1001 for that behaviour (bone meal also covers the other dyes).
    this.flags = { bone: true, flint: true };
  }

  aux(w, id, x, y, z, data = 0) {
    if (this.host.aux) this.host.aux(id, x, y, z, data);
    else w.playAuxSFX?.(id, x, y, z, data);
  }

  // BehaviorDefaultDispenseItem.dispense: dispenseStack, then the sound and the smoke.
  dispense(w, x, y, z, facing, stack, behaviour = this.behaviourFor(stack)) {
    const result = behaviour.stack.call(this, w, x, y, z, facing, stack);
    this.aux(w, behaviour.sound.call(this, stack), x, y, z, 0);
    const [fx, , fz] = FACING[facing];
    this.aux(w, 2000, x, y, z, fx + 1 + (fz + 1) * 3);
    return result;
  }
  // BehaviorDefaultDispenseItem.dispenseStack: one item thrown.
  defaultStack(w, x, y, z, facing, stack) {
    const [fx, fy, fz] = FACING[facing];
    this.doDispense(w, one(stack), 6, facing, x + 0.5 + 0.7 * fx, y + 0.5 + 0.7 * fy, z + 0.5 + 0.7 * fz);
    stack.count--;
    return stack;
  }
  // BehaviorDefaultDispenseItem.doDispense: the motion draws nextDouble, then three Gaussians from the world Random.
  doDispense(w, stack, speed, facing, px, py, pz) {
    const [fx, , fz] = FACING[facing], r = w.rand;
    const d3 = r.nextDouble() * 0.1 + 0.2, k = 0.007499999832361937;
    const mx = fx * d3 + r.nextGaussian() * k * speed, my = f(0.2) + r.nextGaussian() * k * speed, mz = fz * d3 + r.nextGaussian() * k * speed;
    this.host.spawnItem?.(stack, px, py - 0.3, pz, mx, my, mz);
  }

  behaviourFor(stack) {
    switch (stack.id) {
      case ITEM.ARROW: return PROJECTILE.arrow;
      case ITEM.EGG: return PROJECTILE.egg;
      case ITEM.SNOWBALL: return PROJECTILE.snowball;
      case ITEM.POTION: return (stack.damage ?? 0) & SPLASH_BIT ? PROJECTILE.potion : DEFAULT;
      case ITEM.MINECART: return CART;
      case ITEM.CHEST_MINECART: return CART;
      case ITEM.BUCKET: return EMPTY_BUCKET;
      case ITEM.WATER_BUCKET: case ITEM.LAVA_BUCKET: return FILLED_BUCKET;
      case ITEM.FLINT_AND_STEEL: return FLINT;
      case ITEM.DYE: return DYE;
      case ITEM.TNT: return TNT;
      case ITEM.FIRE_CHARGE: return FIRE_CHARGE;
      default: return DEFAULT;
    }
  }

  // BlockDispenser.dispense (updateTick). Returns nothing; the tile is changed in place.
  dispenseBlock(w, x, y, z, dropper) {
    const tile = this.host.tile(x, y, z), facing = w.getBlockMetadata(x, y, z) & 7;
    const slot = chooseSlot(tile.items, this.slotRandom);
    if (slot < 0) { this.aux(w, 1001, x, y, z, 0); return; }
    const stack = tile.items[slot];
    if (dropper) { this.dropperDispense(w, x, y, z, facing, tile, slot, stack); return; }
    const result = this.dispense(w, x, y, z, facing, stack);
    tile.items[slot] = result && result.count > 0 ? result : null;
    this.changed(w, [key(x, y, z)]);
  }
  // BlockDropper.dispense: into the facing inventory when there is one (TileEntityHopper.func_145889_a), else the default throw.
  dropperDispense(w, x, y, z, facing, tile, slot, stack) {
    const [fx, fy, fz] = FACING[facing], th = this.host.transfer?.();
    const inv = th ? containerAt(th, x + fx, y + fy, z + fz) : null;
    let result;
    if (inv) {
      const rest = insertStack(inv, one(stack), OPPOSITE[facing], th.maxStack);
      if (rest === null) {
        result = copyStack(stack);
        if (--result.count === 0) result = null;
        touch(th, inv);
        this.changed(w, inv.keys);
      } else result = copyStack(stack);
    } else {
      result = this.dispense(w, x, y, z, facing, stack, DEFAULT);
      if (result && result.count === 0) result = null;
    }
    tile.items[slot] = result;
    this.changed(w, [key(x, y, z)]);
  }
  // World.func_147453_f: comparators next to a changed container re-read it (LiveRedstone.containerChanged), and the save flag.
  changed(w, keys) {
    for (const k of keys) w.containerChanged?.(...k.split(",").map(Number));
    this.host.changed?.(keys);
  }
}

// ---- behaviours: { stack(w, x, y, z, facing, stack) -> stack, sound(stack) -> aux id } ----
const click = () => 1000;
const flagged = (name) => function () { return this.flags[name] ? 1000 : 1001; };
const DEFAULT = { stack: Dispensing.prototype.defaultStack, sound: click };

// BehaviorProjectileDispense: the entity spawns at the dispenser face (centre + 0.7 facing), heads along (dx, dy + 0.1F, dz).
function projectile(spawn, aim, velocity, inaccuracy, soundId) {
  return {
    sound: () => soundId,
    stack(w, x, y, z, facing, stack) {
      const [fx, fy, fz] = FACING[facing];
      const px = x + 0.5 + 0.7 * fx, py = y + 0.5 + 0.7 * fy, pz = z + 0.5 + 0.7 * fz;
      const rand = this.entityRandom?.() ?? this.host.rng?.() ?? new JavaRandom(Math.floor(Math.random() * 2 ** 48));
      const h = aim(rand, fx, f(fy + f(0.1)), fz, velocity, inaccuracy);
      spawn(this.host, { x: px, y: py, z: pz, ...h, rand }, stack);
      stack.count--;
      return stack;
    },
  };
}
export const PROJECTILE_VELOCITY = f(1.1), PROJECTILE_INACCURACY = f(6);
const throwable = (kind, v, i, sound) => projectile((host, e, s) => host.thrown?.(kind, e, s), (r, x, y, z, vel, inacc) => heading(gaussianOnly(r), x, y, z, vel, inacc), v, i, sound);
// heading() reads rand.nextGaussian(); a JavaRandom already has it.
const gaussianOnly = (r) => r;
const PROJECTILE = {
  arrow: projectile((host, e) => host.arrow?.(e), (r, x, y, z, v, i) => arrowHeading(r, x, y, z, v, i), PROJECTILE_VELOCITY, PROJECTILE_INACCURACY, 1002),
  egg: throwable("egg", PROJECTILE_VELOCITY, PROJECTILE_INACCURACY, 1002),
  snowball: throwable("snowball", PROJECTILE_VELOCITY, PROJECTILE_INACCURACY, 1002),
  // The splash potion's anonymous subclass: velocity * 1.25F, inaccuracy * 0.5F.
  potion: projectile((host, e, s) => host.thrown?.("potion", { ...e, damage: s.damage }, s), (r, x, y, z, v, i) => heading(r, x, y, z, v, i), f(PROJECTILE_VELOCITY * f(1.25)), f(PROJECTILE_INACCURACY * f(0.5)), 1002),
};

// BehaviorDispenseFireball (kz): a small fireball 0.3 beyond the dispenser face (centre + 0.7 facing + 0.3 facing), acceleration the facing plus
// 0.05 * nextGaussian per axis (x, y, z), sound 1009, one charge used. Bytecode-derived (blaze-ghast.md).
const FIRE_CHARGE = {
  sound: () => 1009,
  stack(w, x, y, z, facing, stack) {
    const [fx, fy, fz] = FACING[facing], rand = this.entityRandom?.() ?? this.host.rng?.() ?? new JavaRandom(Math.floor(Math.random() * 2 ** 48));
    const ax = rand.nextGaussian() * 0.05 + fx, ay = rand.nextGaussian() * 0.05 + fy, az = rand.nextGaussian() * 0.05 + fz;
    this.host.fireball?.({ x: x + 0.5 + 0.7 * fx + fx * 0.3, y: y + 0.5 + 0.7 * fy + fy * 0.3, z: z + 0.5 + 0.7 * fz + fz * 0.3, ax, ay, az });
    stack.count--;
    return stack;
  },
};

// BehaviorDispenseMinecart: a rail (or a rail one cell below an empty cell) in front takes the cart, anything else the default throw.
const ascending = (id, meta) => (id === 66 ? meta >= 2 && meta <= 5 : (meta & 7) >= 2 && (meta & 7) <= 5);
const CART = {
  sound: click,
  stack(w, x, y, z, facing, stack) {
    const [fx, fy, fz] = FACING[facing];
    const i = x + fx, j = y + fy, k = z + fz, block = w.getBlock(i, j, k);
    let d3;
    if (RAILS.has(block)) d3 = ascending(block, w.getBlockMetadata(i, j, k)) ? 0.5 : 0;
    else if (block === 0 && RAILS.has(w.getBlock(i, j - 1, k))) d3 = ascending(w.getBlock(i, j - 1, k), w.getBlockMetadata(i, j - 1, k)) ? -0.4 : -1;
    else return this.dispense(w, x, y, z, facing, stack, DEFAULT);
    this.host.cart?.(stack.id === ITEM.CHEST_MINECART ? 1 : 0, x + 0.5 + fx * 1.125, y + 0.5 + fy * 1.125 + d3, z + 0.5 + fz * 1.125, stack);
    stack.count--;
    return stack;
  },
};

// ItemBucket.tryPlaceContainedLiquid at the front cell: air or non-solid (liquid included); a non-liquid block there is broken first.
function placeLiquid(w, host, x, y, z, liquid) {
  const id = w.getBlock(x, y, z);
  if (id !== 0 && !isLiquidId(id) && !host.isReplaceable?.(id, w, x, y, z)) return false;
  if (!isLiquidId(id)) host.breakBlock?.(x, y, z);
  if (host.setLiquid) host.setLiquid(x, y, z, liquid);
  else w.setBlock(x, y, z, liquid, 0, 3);
  return true;
}
const setAir = (w, host, x, y, z) => (host.setAir ? host.setAir(x, y, z) : w.setBlockToAir(x, y, z));
const FILLED_BUCKET = {
  sound: click,
  stack(w, x, y, z, facing, stack) {
    const [fx, fy, fz] = FACING[facing];
    if (!placeLiquid(w, this.host, x + fx, y + fy, z + fz, stack.id === ITEM.LAVA_BUCKET ? FLOWING_LAVA : FLOWING_WATER)) return this.dispense(w, x, y, z, facing, stack, DEFAULT);
    return { ...copyStack(stack), id: ITEM.BUCKET, count: 1, damage: 0 };
  },
};
const EMPTY_BUCKET = {
  sound: click,
  stack(w, x, y, z, facing, stack) {
    const [fx, fy, fz] = FACING[facing], i = x + fx, j = y + fy, k = z + fz, block = w.getBlock(i, j, k);
    let item;
    if ((block === FLOWING_WATER || block === STILL_WATER) && w.getBlockMetadata(i, j, k) === 0) item = ITEM.WATER_BUCKET;
    else if ((block === FLOWING_LAVA || block === STILL_LAVA) && w.getBlockMetadata(i, j, k) === 0) item = ITEM.LAVA_BUCKET;
    else return DEFAULT.stack.call(this, w, x, y, z, facing, stack);
    setAir(w, this.host, i, j, k);
    const filled = { id: item, count: 1, damage: 0 };
    if (--stack.count === 0) return filled;
    const tile = this.host.tile(x, y, z);
    if (addItemStack(tile.items, filled) < 0) this.dispense(w, x, y, z, facing, filled, DEFAULT);
    return stack;
  },
};

// BehaviorDispenseFlintAndSteel (the instance boolean is shared by every flint and steel).
const FLINT = {
  sound: flagged("flint"),
  stack(w, x, y, z, facing, stack) {
    const [fx, fy, fz] = FACING[facing], i = x + fx, j = y + fy, k = z + fz, block = w.getBlock(i, j, k);
    if (block === 0) {
      if (this.host.setFire) this.host.setFire(i, j, k);
      else w.setBlock(i, j, k, FIRE, 0, 3);
      stack.damage = (stack.damage ?? 0) + 1;
      if (stack.damage > FLINT_MAX_DAMAGE) stack.count = 0;
    } else if (block === TNT_BLOCK) {
      w.primeTnt(i, j, k);
      setAir(w, this.host, i, j, k);
    } else this.flags.flint = false;
    return stack;
  },
};
// BehaviorDispenseBoneMeal (registered on Items.dye): damage 15 fertilises; every other dye is thrown like any item.
const CROPS = new Set([WHEAT, CARROTS, POTATOES]);
const DYE = {
  sound: flagged("bone"),
  stack(w, x, y, z, facing, stack) {
    if ((stack.damage ?? 0) !== 15) return DEFAULT.stack.call(this, w, x, y, z, facing, stack);
    const [fx, fy, fz] = FACING[facing], i = x + fx, j = y + fy, k = z + fz, block = w.getBlock(i, j, k);
    let ok = false;
    if (CROPS.has(block)) {
      const meta = w.getBlockMetadata(i, j, k);
      if (meta !== 7) {
        // BlockCrops.func_149863_m: + getRandomIntegerInRange(rand, 2, 5), capped at 7.
        w.setBlockMetadataWithNotify(i, j, k, Math.min(7, meta + w.rand.nextInt(4) + 2), 2);
        ok = true;
      }
    } else ok = !!this.host.boneMeal?.(i, j, k, block);
    if (ok) { stack.count--; this.aux(w, 2005, i, j, k, 0); } else this.flags.bone = false;
    return stack;
  },
};
// The TNT behaviour: a primed TNT at the front cell centre.
const TNT = {
  sound: click,
  stack(w, x, y, z, facing, stack) {
    const [fx, fy, fz] = FACING[facing];
    if (this.host.spawnTnt) this.host.spawnTnt(x + fx, y + fy, z + fz);
    else w.primeTnt(x + fx, y + fy, z + fz);
    stack.count--;
    return stack;
  },
};

// ---- redstone engine behaviours (original ids 23 and 158) ----
export function dispenserBehaviour(engine, dropper) {
  const powered = (w, x, y, z) => w.isBlockIndirectlyGettingPowered(x, y, z) || w.isBlockIndirectlyGettingPowered(x, y + 1, z);
  const self = dropper ? DROPPER_ID : DISPENSER_ID;
  const opaque = (w) => (id) => (w.isOpaqueCube ? w.isOpaqueCube(id) : w.isNormalCube(id));
  return {
    onBlockAdded(w, x, y, z) {
      const o = opaque(w), at = (dx, dz) => w.getBlock(x + dx, y, z + dz);
      w.setBlockMetadataWithNotify(x, y, z, placedFacing(o, at(0, -1), at(0, 1), at(-1, 0), at(1, 0)), 2);
    },
    onNeighborBlockChange(w, x, y, z) {
      const p = powered(w, x, y, z), meta = w.getBlockMetadata(x, y, z), was = (meta & 8) !== 0;
      if (p && !was) {
        w.scheduleBlockUpdate(x, y, z, self, TICK_RATE);
        w.setBlockMetadataWithNotify(x, y, z, meta | 8, 4);
      } else if (!p && was) w.setBlockMetadataWithNotify(x, y, z, meta & ~8, 4);
    },
    updateTick(w, x, y, z) { engine.dispenseBlock(w, x, y, z, dropper); },
  };
}
// Registers both blocks on a redstone world (LiveRedstone) and returns the engine.
export function installDispensers(redstone, host, options) {
  const engine = new Dispensing(host, options);
  redstone.registerBehaviour(DISPENSER_ID, dispenserBehaviour(engine, false));
  redstone.registerBehaviour(DROPPER_ID, dispenserBehaviour(engine, true));
  return engine;
}
