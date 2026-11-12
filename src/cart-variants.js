// Furnace, TNT, hopper and command block minecart rules of Minecraft Java 1.7.10 (EntityMinecartFurnace xq,
// EntityMinecartTNT xv, EntityMinecartHopper xr, EntityMinecartCommandBlock xn) on top of the empty and chest carts
// in minecarts.js. This file is dependency free (original-items.js reads its item table), so the transfer helpers of
// the hopper cart live in cart-hopper.js. Native evidence: public/research/carts-reference.json
// (tools/probes/CartsProbe.java, tools/verify-carts.mjs), replayed by src/carts.test.js. Notes and gaps:
// public/research/minecart-variants.md.
import { makeSpawner, readNBT as readSpawnerNBT, spawnerJSON } from "./mob-spawner.js";
import { spawnerPairs } from "./spawner-data.js";
const f = Math.fround;

// Original items 343, 407, 408, 422 (browser ids 343/407/408/422 are taken, so the carts use 2090-2093).
export const ITEM_FURNACE_CART = 2090, ITEM_TNT_CART = 2091, ITEM_HOPPER_CART = 2092, ITEM_COMMAND_CART = 2093;
export const CART_ORIGINAL_ITEMS = Object.freeze({ 343: ITEM_FURNACE_CART, 407: ITEM_TNT_CART, 408: ITEM_HOPPER_CART, 422: ITEM_COMMAND_CART });
// Creative inventory entries after the chest cart (343, 407, 408; the command block cart 422 has no creative tab).
export const CART_CREATIVE = Object.freeze([ITEM_FURNACE_CART, ITEM_TNT_CART, ITEM_HOPPER_CART]);
// EntityMinecart.getMinecartType numbers (the item's `minecartType`), which `cart.type` keeps.
export const TYPE = Object.freeze({ rideable: 0, chest: 1, furnace: 2, tnt: 3, spawner: 4, hopper: 5, command: 6 });
// The EntityList ids, used by /summon and by the region export.
export const CART_ENTITY_IDS = Object.freeze({ 0: "MinecartRideable", 1: "MinecartChest", 2: "MinecartFurnace", 3: "MinecartTNT", 4: "MinecartSpawner", 5: "MinecartHopper", 6: "MinecartCommandBlock" });
// Types a build keeps as carts (4 is the spawner cart: no item, /summon and world data only).
export const SUPPORTED_TYPES = Object.freeze([0, 1, 2, 3, 4, 5, 6]);
export const isSupportedType = (t) => SUPPORTED_TYPES.includes(t);
// Types with an inventory (EntityMinecartContainer): chest (27 slots) and hopper (5 slots).
export const isContainerType = (t) => t === 1 || t === 5;
export const slotCount = (t) => (t === 5 ? 5 : 27);
// Original blocks dropped by killMinecart: chest, furnace, TNT, hopper.
export const BLOCK_DROP = Object.freeze({ 1: 54, 2: 61, 3: 46, 5: 154 });
// ItemCoal (original 263, any damage: coal and charcoal; browser 301 and 308).
export const isFuelItem = (id) => id === 301 || id === 308;
export const FUEL_TICKS = 3600, FUSE_TICKS = 80, HOPPER_COOLDOWN = 4;
// getDisplayTile / getDisplayTileData / getDisplayTileOffset (RenderMinecart.func_147910_a uses offset / 16).
// The furnace cart always shows lit_furnace (bytecode-derived: 1.7.10 never shows the unlit one).
export const DISPLAY = Object.freeze({
  2: { block: 62, data: 2, offset: 6 }, 3: { block: 46, data: 0, offset: 6 }, 5: { block: 154, data: 0, offset: 1 },
  1: { block: 54, data: 0, offset: 8 }, 4: { block: 52, data: 0, offset: 6 }, 6: { block: 137, data: 0, offset: 6 },
});

// EntityMinecart's custom display (data watcher 20 = tile id & 0xffff | data << 16, 21 = offset (default 6), 22 = has custom display), bytecode-read in xl: getDisplayTile (n) is
// the watched block when 22 is 1, else the type's own; setDisplayTile (k) keeps the current data (p), setDisplayTileData (l) the current tile (n), setDisplayTileOffset (m); each
// of the three sets 22. The fields are the watcher values (dispRaw, dispOffset, dispOn), read by object-tracker.js's S1C and the copies.
export const displayTile = (c) => (c.dispOn ? c.dispRaw & 0xffff : DISPLAY[c.type]?.block ?? 0);
export const displayData = (c) => (c.dispOn ? c.dispRaw >> 16 : DISPLAY[c.type]?.data ?? 0);
export const displayOffset = (c) => (c.dispOn ? c.dispOffset ?? 6 : DISPLAY[c.type]?.offset ?? 6);
export function setDisplayTile(c, id) { c.dispRaw = (id & 0xffff) | (displayData(c) << 16); c.dispOn = 1; }
export function setDisplayTileData(c, data) { c.dispRaw = (displayTile(c) & 0xffff) | (data << 16); c.dispOn = 1; }
export function setDisplayTileOffset(c, offset) { c.dispOffset = offset | 0; c.dispOn = 1; }

export function installCartItems(items) {
  const def = (id, name, texture, type, color) => { items[id] = { id, name, texture, stack: 1, minecartType: type, color, glyph: "▭" }; };
  def(ITEM_FURNACE_CART, "Minecart with Furnace", "minecart_furnace", 2, "#6e6e6e");
  def(ITEM_TNT_CART, "Minecart with TNT", "minecart_tnt", 3, "#b5352a");
  def(ITEM_HOPPER_CART, "Minecart with Hopper", "minecart_hopper", 5, "#5a5a5a");
  def(ITEM_COMMAND_CART, "Minecart with Command Block", "minecart_command_block", 6, "#a0742f");
}

// Per-type state added to a fresh cart (the native field defaults).
export function initVariant(cart, record = {}) {
  const t = cart.type;
  if (record.customDisplay) { setDisplayTile(cart, record.displayTile | 0); setDisplayTileData(cart, record.displayData | 0); setDisplayTileOffset(cart, record.displayOffset | 0); } // EntityMinecart.readEntityFromNBT: k, l, m in this order
  if (t === 2) Object.assign(cart, { fuel: Math.max(0, record.fuel | 0), pushX: Number.isFinite(record.pushX) ? record.pushX : 0, pushZ: Number.isFinite(record.pushZ) ? record.pushZ : 0 }), cart.lit = cart.fuel > 0;
  if (t === 3) cart.fuse = Number.isInteger(record.fuse) ? record.fuse : -1;
  // EntityMinecartMobSpawner (xt): its MobSpawnerBaseLogic (xu) with the defaults of agq; the position follows the cart (cart-spawner in structure-simulation.js).
  if (t === 4) { cart.spawner = makeSpawner(0, 0, 0); readSpawnerNBT(cart.spawner, record.spawner ?? {}); }
  if (t === 5) Object.assign(cart, { enabled: true, cooldown: Number.isInteger(record.cooldown) ? record.cooldown : -1 });
  if (t === 6) { const c = record.command ?? {}; cart.command = { command: typeof c.command === 'string' ? c.command : '', successCount: Number.isInteger(c.successCount) ? c.successCount : 0, customName: typeof c.customName === 'string' ? c.customName : '@', trackOutput: c.trackOutput !== false, lastOutput: typeof c.lastOutput === 'string' ? c.lastOutput : null }; cart.lastRun = 0;
    // Watcher 24 (the last output as JSON): "" from EntityMinecartCommandBlock.entityInit; only readEntityFromNBT (xn.a(dh): a record with `command`, a save or /summon), addChatMessage output and the GUI's setCommand + func_145756_e write it, and then fk.a(null) is "null" (executed, furnace-cart-reference.json).
    cart.command.watch24 = record.command ? (cart.command.lastOutput ?? 'null') : ''; } // xn.<init>: b = 0
}

// EntityMinecartFurnace.interactFirst: coal or charcoal adds 3600 ticks (one item unless Creative), then the push
// direction points from the player to the cart. `held` is the stack, `take()` removes one. Returns the branch.
export function furnaceUse(cart, { held, creative = false, take, position }) {
  if (held && isFuelItem(held.id)) {
    if (!creative) take?.();
    cart.fuel += FUEL_TICKS;
  }
  cart.pushX = cart.x - position.x;
  cart.pushZ = cart.z - position.z;
  cart.lit = cart.fuel > 0;
  return "fuel-furnace-minecart";
}
// EntityMinecartFurnace.func_145821_a after the superclass: the push is kept only while it follows the motion.
export function furnaceRail(cart) {
  const d = cart.pushX * cart.pushX + cart.pushZ * cart.pushZ;
  if (d > 1.0e-4 && cart.vx * cart.vx + cart.vz * cart.vz > 0.001) {
    const s = f(Math.sqrt(d));
    cart.pushX /= s; cart.pushZ /= s;
    if (cart.pushX * cart.vx + cart.pushZ * cart.vz < 0) { cart.pushX = 0; cart.pushZ = 0; }
    else { cart.pushX = cart.vx; cart.pushZ = cart.vz; }
  }
}
// EntityMinecartFurnace.applyDrag, before the superclass drag.
export function furnaceDrag(cart) {
  const d = cart.pushX * cart.pushX + cart.pushZ * cart.pushZ;
  if (d > 1.0e-4) {
    const s = f(Math.sqrt(d));
    cart.pushX /= s; cart.pushZ /= s;
    cart.vx *= f(0.8); cart.vy *= 0; cart.vz *= f(0.8);
    cart.vx += cart.pushX * 0.05; cart.vz += cart.pushZ * 0.05;
  } else { cart.vx *= f(0.98); cart.vy *= 0; cart.vz *= f(0.98); }
}

// TNT cart: explode(d) with d the squared horizontal speed.
export function tntExplode(cart, d, host) {
  const s = Math.min(Math.sqrt(d), 5);
  const power = f(4 + cart.random.nextDouble() * 1.5 * s);
  cart.dead = true;
  host?.explode?.(cart, cart.x, cart.posY, cart.z, power);
  return power;
}
export function tntIgnite(cart, host) {
  cart.fuse = FUSE_TICKS;
  cart.igniteStatus = true; // World.setEntityState(this, 10): the tracker sends the S1A to the copies
  host?.sound?.("game.tnt.primed", cart);
}
export function tntFall(cart, distance, host) {
  if (distance >= 3) { const k = f(f(distance) / 10); tntExplode(cart, f(k * k), host); }
}

// onActivatorRailPass(x, y, z, powered).
export function activatorPass(cart, powered, host) {
  if (cart.type === 3 && powered && cart.fuse < 0) tntIgnite(cart, host);
  if (cart.type === 5) cart.enabled = !powered;
  // xn.a(x, y, z, powered): powered and ticksExisted - b >= 4 -> CommandBlockLogic.func_145755_a(world); b = ticksExisted.
  if (cart.type === 6 && powered && (cart.age | 0) - cart.lastRun >= 4) { host?.runCommand?.(cart); cart.lastRun = cart.age | 0; }
}

// The type specific part of EntityMinecart.onUpdate (after the superclass). `hopperSuck(cart)` is cart-hopper.js.
export function variantTick(cart, host, hopperSuck) {
  if (cart.type === 2) {
    if (cart.fuel > 0) cart.fuel--;
    if (cart.fuel <= 0) { cart.pushX = 0; cart.pushZ = 0; }
    cart.lit = cart.fuel > 0;
    if (cart.lit && cart.random.nextInt(4) === 0) host?.particle?.("largesmoke", cart.x, cart.posY + 0.8, cart.z, 0, 0, 0);
  } else if (cart.type === 3) {
    if (cart.fuse > 0) { cart.fuse--; host?.particle?.("smoke", cart.x, cart.posY + 0.5, cart.z, 0, 0, 0); }
    else if (cart.fuse === 0) tntExplode(cart, cart.vx * cart.vx + cart.vz * cart.vz, host);
    if (cart.collidedH) {
      const d = cart.vx * cart.vx + cart.vz * cart.vz;
      if (d >= 0.009999999776482582) tntExplode(cart, d, host);
    }
  } else if (cart.type === 5 && !cart.dead && cart.enabled) {
    cart.cooldown--;
    if (cart.cooldown <= 0) {
      cart.cooldown = 0;
      if (hopperSuck?.(cart, host)) { cart.cooldown = HOPPER_COOLDOWN; host?.changed?.(cart); }
    }
  }
}

// The block drops and explosion of killMinecart after the superclass (`source` is the damage source name:
// "explosion", "inFire", "onFire", "lava", "cactus", a player...). `drop(id)` is Minecarts.dropOriginal.
export function killExtras(cart, source, drop, host) {
  const t = cart.type, explosion = source === "explosion", fire = source === "inFire" || source === "onFire" || source === "lava";
  if (t === 1 || t === 5) drop(BLOCK_DROP[t]);
  else if (t === 2) { if (!explosion) drop(BLOCK_DROP[2]); }
  else if (t === 3) {
    const d = cart.vx * cart.vx + cart.vz * cart.vz;
    if (!explosion) drop(BLOCK_DROP[3]);
    if (fire || explosion || d >= 0.009999999776482582) tntExplode(cart, d, host);
  }
}

// Save fields.
export function variantJSON(c) {
  const own = variantFields(c);
  return c.dispOn ? { ...own, customDisplay: true, displayTile: displayTile(c), displayData: displayData(c), displayOffset: displayOffset(c) } : own;
}
function variantFields(c) {
  if (c.type === 2) return { fuel: c.fuel, pushX: c.pushX, pushZ: c.pushZ };
  if (c.type === 3) return { fuse: c.fuse };
  if (c.type === 5) return { cooldown: c.cooldown };
  if (c.type === 6) return { command: { ...c.command } };
  if (c.type === 4) return { spawner: spawnerJSON(c.spawner) };
  return {};
}
// Entity.writeToNBT additions: [type, value] pairs (6 double, 2 short, 3 int).
export function variantNBT(c) {
  const own = variantNBTFields(c);
  if (!c.dispOn && !c.customDisplay) return own;
  const saved = !c.dispOn; // a saved record (region-export) carries the fields, a live cart the watcher values
  return { ...own, CustomDisplayTile: [1, 1], DisplayTile: [3, saved ? c.displayTile | 0 : displayTile(c)], DisplayData: [3, saved ? c.displayData | 0 : displayData(c)], DisplayOffset: [3, saved ? c.displayOffset | 0 : displayOffset(c)] }; // EntityMinecart.writeEntityToNBT
}
function variantNBTFields(c) {
  if (c.type === 2) return { PushX: [6, c.pushX], PushZ: [6, c.pushZ], Fuel: [2, c.fuel] };
  if (c.type === 3) return { TNTFuse: [3, c.fuse] };
  if (c.type === 5) return { TransferCooldown: [3, c.cooldown] };
  // EntityMinecartMobSpawner.writeEntityToNBT: MobSpawnerBaseLogic.b(dh).
  // A saved cart carries the spawnerJSON form (EntityId, Delay, ...); a live one the logic state.
  if (c.type === 4) {
    if (c.spawner?.entityId !== undefined) return spawnerPairs(c.spawner);
    const s = makeSpawner(0, 0, 0);
    readSpawnerNBT(s, c.spawner ?? {});
    return spawnerPairs(s);
  }
  // CommandBlockLogic.func_145758_a (agp.a(dh)): Command, SuccessCount, CustomName, TrackOutput, LastOutput.
  if (c.type === 6) return { Command: [8, c.command.command], SuccessCount: [3, c.command.successCount], CustomName: [8, c.command.customName], TrackOutput: [1, c.command.trackOutput ? 1 : 0], ...(c.command.lastOutput != null ? { LastOutput: [8, c.command.lastOutput] } : {}) };
  return {};
}
