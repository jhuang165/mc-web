// Non-player entities in portals (1.7.10 Entity.onEntityUpdate / setInPortal / travelToDimension, tools/probes/EntityPortalProbe.java,
// public/research/entity-portal-reference.json). Mobs, dropped items and experience orbs travel; the player's tamed wolves and
// leashed animals do not follow (they stay in the dimension the browser unloads).
import { ENTITY_TYPES } from "./entities.js";
import { mobScale } from "./slime.js";
import { OVERWORLD, NETHER, END, PortalState, transferTarget, GAME_IDS } from "./dimensions.js";

// Entities that never reach moveEntity -> doBlockCollisions, or that the port does not move between dimensions.
const SKIPPED = new Set(["ender_dragon", "ender_crystal"]);
export const SIZES = { item: [0.25, 0.25], orb: [0.5, 0.5] };
// Collision box of a record: half width and height; `e.y` is the bottom for all three kinds (a mob's feet).
export function boxOf(kind, e) {
  if (kind === "mob") { const t = ENTITY_TYPES[e.type], s = mobScale(e); return t ? [(t.width * s) / 2, t.height * s] : null; }
  return [SIZES[kind][0] / 2, SIZES[kind][1]];
}
// Entity.posY, the value transferEntityToWorld hands to the Teleporter: a mob's feet, an item's bottom + yOffset, an orb's centre.
export const POS_Y = { mob: 0, item: 0.125, orb: 0.25 };
export const mobYawToMc = (yaw) => (-yaw * 180) / Math.PI + 0;
export const mcToMobYaw = (deg) => (-deg * Math.PI) / 180 + 0;

// transferEntityToWorld + the End exit of travelToDimension, for a non-player entity in Minecraft units/degrees.
// `from` is the dimension it leaves, `arg` the travelToDimension argument (1 from the End is the exit to the spawn point).
// `teleporter`: a Teleporter over the target dimension; `spawn`/`heightAt`: the Overworld spawn and its column's height value.
export function placeAfterTravel({ from, arg, entity, teleporter, spawn, heightAt }) {
  const e = { vx: 0, vy: 0, vz: 0, pitch: 0, teleportDirection: 0, ...entity };
  if (from === END && arg === END) {
    // travelToDimension: world.getSpawnPoint, posY = getHeightValue; the copy keeps yaw, pitch and motion, no Teleporter.
    return { to: OVERWORLD, e: { ...e, x: spawn.x, y: heightAt(spawn.x, spawn.z), z: spawn.z }, teleporter: false };
  }
  const tt = transferTarget(from, arg, e.x, e.y, e.z, e.yaw);
  Object.assign(e, { x: tt.x, y: tt.y, z: tt.z, yaw: tt.yaw });
  if (arg === END) e.pitch = 0;
  if (tt.teleporter) teleporter.placeInPortal(e, tt.origin.x, tt.origin.y, tt.origin.z, tt.origin.yaw);
  e.yaw %= 360; // the copy is built from NBT: Entity.readFromNBT keeps rotationYaw % 360
  return { to: arg, e, teleporter: tt.teleporter };
}

// Per-entity Entity.timeUntilPortal / portalCounter / inPortal. The cooldown is the saved PortalCooldown tag (record.portalCooldown).
export class EntityPortals {
  constructor() { this.states = new WeakMap(); this.last = new WeakMap(); }
  state(e) {
    let s = this.states.get(e);
    if (!s) { s = new PortalState(); s.timeUntilPortal = Math.max(0, Math.min(300, e.portalCooldown | 0)); this.states.set(e, s); }
    return s;
  }
  // One tick after the entity moved. Returns null or { arg, endPortal, direction }: the travelToDimension argument.
  // `getId(x,y,z)`: block id of the current dimension; `dim`: the dimension; `riding`: it has a rider or a vehicle.
  step(e, kind, { dim, getId, riding = false }) {
    const box = boxOf(kind, e);
    if (!box || (kind === "mob" && (e.health <= 0 || SKIPPED.has(e.type)))) return null;
    const s = this.state(e), prev = this.last.get(e) ?? { x: e.x, z: e.z };
    this.last.set(e, { x: e.x, z: e.z });
    let result = null;
    // Entity.onEntityUpdate runs first in the next tick: it consumes the inPortal the previous tick's collision set.
    const go = s.tick(dim, { isPlayer: false, riding });
    if (go !== null) result = { arg: go, endPortal: false, direction: s.teleportDirection };
    else if (!riding) {
      const [hw, h] = box, x0 = Math.floor(e.x - hw + 0.001), x1 = Math.floor(e.x + hw - 0.001), z0 = Math.floor(e.z - hw + 0.001), z1 = Math.floor(e.z + hw - 0.001);
      let nether = false, end = false;
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = Math.floor(e.y + 0.001); y <= Math.floor(e.y + h - 0.001); y++) {
        const b = getId(x, y, z);
        if (b === GAME_IDS.portal) nether = true; else if (b === GAME_IDS.endPortal) end = true;
      }
      // BlockEndPortal.onEntityCollidedWithBlock: travelToDimension(1) at once, no cooldown test and none written.
      if (end) result = { arg: END, endPortal: true, direction: s.teleportDirection };
      else if (nether) s.setInPortal(prev.x, prev.z, e.x, e.z, { isPlayer: false });
    }
    if (s.timeUntilPortal > 0) e.portalCooldown = s.timeUntilPortal; else if (e.portalCooldown !== undefined) delete e.portalCooldown;
    return result;
  }
  // The cooldown written before travelToDimension(Nether portal: 300); End portal travel keeps the one it had.
  cooldownAfter(e, result) { return result.endPortal ? e.portalCooldown | 0 : 300; }
}

export { OVERWORLD, NETHER, END };
