// Beacon (BlockBeacon ajg, TileEntityBeacon aoq, ContainerBeacon zx) and the nether star (item 399), Minecraft Java 1.7.10.
// Pure rules and the tile store; the live tick is beacon-live.js, the beam beacon-renderer.js, the screen beacon-container.js.
// Evidence: public/research/beacon-reference.json (tools/probes/BeaconProbe.java, replayed by beacon.test.js) and
// public/research/beacon.md. This module imports nothing so world.js can use its constants.
const f = Math.fround;

export const BEACON = 173; // original block 138 (BlockBeacon); overwrites the reserved BLOCKS slot
export const ITEM_NETHER_STAR = 2060; // original item 399
export const BEACON_ITEMS = Object.freeze({ 399: ITEM_NETHER_STAR, 138: BEACON }); // nether star 399 -> 2060, beacon block item 138 -> 173
export const BEACON_MATERIALS = Object.freeze({ [BEACON]: { hardness: 3 } }); // Block.setHardness(3.0F); drops itself
export const BEACON_LIGHT = 15; // setLightLevel(1.0F)
export const BEACON_RESISTANCE = 3; // setResistance 15 / 5 (the explosion table stores the divided value)

// Internal ids of the original pyramid blocks: iron 42 -> 26, gold 41 -> 27, emerald 133 -> 146, diamond 57 -> 28 (aoq.y).
export const PYRAMID_BLOCKS = Object.freeze([26, 27, 146, 28]);
// Payment items (zy.a): original iron ingot 265, gold ingot 266, diamond 264 and emerald 388 -> internal 302, 304, 303, 367.
export const PAYMENT_ITEMS = Object.freeze([302, 304, 303, 367]);
// Potion ids of the power tiers (aoq.a): Speed/Haste, Resistance/Jump Boost, Strength, Regeneration.
export const BEACON_TIERS = Object.freeze([[1, 3], [11, 8], [5], [10]].map((t) => Object.freeze(t)));
export const EFFECT_TICKS = 180; // rw(id, 180, amp, true): nine seconds
export const CHECK_INTERVAL = 80; // aoq.h: y() and x() only when the world time is a multiple of 80
export const BEAM_HEIGHT = 256;

export const isPaymentItem = (id) => PAYMENT_ITEMS.includes(id);

// aoq.y: the pyramid. `get(x, y, z)` is the block id, `canSeeSky(x, y, z)` Chunk.canBlockSeeTheSky.
// Returns the level (0 inactive .. 4) the tile takes; the original also leaves `active` set for level >= 1 only.
export function pyramidLevel(get, canSeeSky, x, y, z) {
  if (!canSeeSky(x, y + 1, z)) return 0;
  let levels = 0;
  for (let layer = 1; layer <= 4; levels = layer++) {
    const yy = y - layer;
    if (yy < 0) break;
    let ok = true;
    for (let dx = x - layer; dx <= x + layer && ok; dx++)
      for (let dz = z - layer; dz <= z + layer; dz++)
        if (!PYRAMID_BLOCKS.includes(get(dx, yy, dz))) { ok = false; break; }
    if (!ok) break;
  }
  return levels;
}

// aoq.d / aoq.e: the primary accepts tiers 0..min(levels, 3) - 1, the secondary (level 4 only) tiers 0..3.
export function validPrimary(levels, id) {
  for (let i = 0; i < 3 && i < levels; i++) if (BEACON_TIERS[i].includes(id)) return id;
  return 0;
}
export function validSecondary(levels, id) {
  if (levels < 4) return 0;
  for (let i = 0; i < 4; i++) if (BEACON_TIERS[i].includes(id)) return id;
  return 0;
}

// aoq.x: the search box (range 10 + 10 * levels in every axis, to the top of the world) and the effects each player receives.
export const beaconRange = (levels) => levels * 10 + 10;
export function beaconBox(x, y, z, levels, height = BEAM_HEIGHT) {
  const r = beaconRange(levels);
  return [x - r, y - r, z - r, x + 1 + r, height, z + 1 + r];
}
// AxisAlignedBB.intersectsWith (strict) with a player's box (feet position, width, height).
export function inBox(box, p) {
  const hw = p.width / 2;
  return p.x + hw > box[0] && p.x - hw < box[3] && p.y + p.height > box[1] && p.y < box[4] && p.z + hw > box[2] && p.z - hw < box[5];
}
export function beaconEffects(levels, primary, secondary) {
  if (levels <= 0 || primary <= 0) return [];
  const amp = levels >= 4 && primary === secondary ? 1 : 0, out = [{ id: primary, duration: EFFECT_TICKS, amplifier: amp, ambient: true }];
  if (levels >= 4 && primary !== secondary && secondary > 0) out.push({ id: secondary, duration: EFFECT_TICKS, amplifier: 0, ambient: true });
  return out;
}

// One tile (TileEntityBeacon): levels start at -1 until the first check, `active` is not saved.
export function createBeacon(x, y, z) {
  return { x, y, z, levels: -1, primary: 0, secondary: 0, active: false, payment: null, fade: 0, fadeTime: 0 };
}
// aoq.h: every 80 ticks run the pyramid check, then apply the effects; returns the effects handed out this tick.
export function tickBeacon(tile, { time, remote = false, get, canSeeSky, players = [] }) {
  if (time % CHECK_INTERVAL !== 0) return [];
  const levels = pyramidLevel(get, canSeeSky, tile.x, tile.y, tile.z);
  tile.levels = levels;
  tile.active = levels > 0;
  if (!tile.active || remote || tile.primary <= 0) return [];
  const box = beaconBox(tile.x, tile.y, tile.z, levels), effects = beaconEffects(levels, tile.primary, tile.secondary), given = [];
  for (const p of players) if (inBox(box, p)) given.push({ player: p, effects });
  return given;
}
// aoq.i: the beam's fade-in, called once per rendered frame (single precision like the original).
export function beamFade(tile, time) {
  if (!tile.active) return 0;
  const d = (time - tile.fadeTime) | 0;
  tile.fadeTime = time;
  if (d > 1) { tile.fade = f(tile.fade - f(d / 40)); if (tile.fade < 0) tile.fade = 0; }
  tile.fade = f(tile.fade + f(0.025));
  if (tile.fade > 1) tile.fade = 1;
  return tile.fade;
}
// The MC|Beacon packet (NetHandlerPlayServer): with a payment in slot 0 one item is consumed and the picks are
// validated; with an empty slot the packet is ignored. Returns whether the payment was consumed.
export function applyBeaconPick(tile, primary, secondary) {
  const pay = tile.payment;
  if (!pay) return false;
  pay.count--;
  if (pay.count <= 0) tile.payment = null;
  tile.primary = validPrimary(Math.max(tile.levels, 0), primary);
  tile.secondary = validSecondary(Math.max(tile.levels, 0), secondary);
  return true;
}
// TileEntityBeacon.writeToNBT / readFromNBT: Primary, Secondary, Levels (ints); the payment and `active` are not saved.
export const beaconToNbt = (t) => ({ id: 'Beacon', x: t.x, y: t.y, z: t.z, Primary: t.primary, Secondary: t.secondary, Levels: t.levels });
export function beaconFromNbt(nbt) {
  const t = createBeacon(nbt.x | 0, nbt.y | 0, nbt.z | 0);
  t.primary = nbt.Primary | 0; t.secondary = nbt.Secondary | 0; t.levels = nbt.Levels | 0;
  return t;
}

// The tile store, keyed like Signs ("x,y,z"); saved as `beacons` in the world record.
export class Beacons {
  constructor() { this.tiles = new Map(); }
  static key(x, y, z) { return `${x},${y},${z}`; }
  get(x, y, z) { return this.tiles.get(Beacons.key(x, y, z)) ?? null; }
  ensure(x, y, z) {
    const k = Beacons.key(x, y, z);
    let t = this.tiles.get(k);
    if (!t) this.tiles.set(k, t = createBeacon(x, y, z));
    return t;
  }
  remove(x, y, z) { return this.tiles.delete(Beacons.key(x, y, z)); }
  clear() { this.tiles.clear(); }
  // A tile exists exactly where the world holds a beacon block (BlockContainer.onBlockAdded / breakBlock).
  sync(x, y, z, block) { if (block === BEACON) this.ensure(x, y, z); else this.remove(x, y, z); }
  toJSON() {
    return [...this.tiles.values()].map((t) => ({ x: t.x, y: t.y, z: t.z, primary: t.primary, secondary: t.secondary, levels: t.levels }));
  }
  fromJSON(list) {
    this.tiles.clear();
    for (const e of Array.isArray(list) ? list : []) {
      if (![e?.x, e?.y, e?.z].every(Number.isInteger)) continue;
      const t = this.ensure(e.x, e.y, e.z);
      t.primary = e.primary | 0; t.secondary = e.secondary | 0; t.levels = Number.isInteger(e.levels) ? e.levels : -1;
    }
    return this;
  }
}

export function installBeaconItems(items) {
  // ItemStack.hasEffect: the nether star (ItemSimpleFoiled) always glints; `alwaysGlint` is the port's flag for it.
  items[ITEM_NETHER_STAR] = { id: ITEM_NETHER_STAR, name: 'Nether Star', texture: 'nether_star', stack: 64, color: '#e8e8f0', alwaysGlint: true };
}
// ContainerBeacon slot layout (layout record): payment slot at (136, 110), player slots from (36, 137).
export const BEACON_PAYMENT_POS = Object.freeze([136, 110]);
export const BEACON_PLAYER_POS = Object.freeze([36, 137]);
