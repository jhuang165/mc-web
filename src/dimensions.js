// Dimensions of Minecraft Java 1.7.10 (WorldProvider aqo / WorldProviderHell aqp / WorldProviderEnd aqr), portal timing (Entity.setInPortal
// sa.ah, Entity.onEntityUpdate's portal block, EntityPlayer.getMaxInPortalTime yz.D), the coordinate scaling of
// ServerConfigurationManager.transferEntityToWorld (oi.a) and Teleporter (ahp). Pure module: no DOM, no world.js import.
// Evidence: tools/probes/DimensionProbe.java -> public/research/dimensions-reference.json, replayed by src/dimensions.test.js.
// Block ids are a parameter (`ids`): the probe uses the original ones, the game the internal ones below.
import { JavaRandom } from "./java-random.js";

export const OVERWORLD = 0, NETHER = -1, END = 1;
// Internal ids of original blocks 0, 49 (obsidian), 90 (nether portal), 119 (end portal), 7 (bedrock).
export const GAME_IDS = Object.freeze({ air: 0, obsidian: 22, portal: 164, endPortal: 149, bedrock: 11 });
export const ORIGINAL_IDS = Object.freeze({ air: 0, obsidian: 49, portal: 90, endPortal: 119, bedrock: 7 });

const f = Math.fround;

// WorldProvider.generateLightBrightnessTable: `ambient` is the 0.0 of the base class (Overworld, End) or the 0.1 of WorldProviderHell.
export function lightBrightnessTable(ambient = 0) {
  const out = new Array(16);
  for (let i = 0; i <= 15; i++) { const g = f(1 - f(i / 15)); out[i] = f(f(f(f(1 - g) / f(f(g * 3) + 1)) * f(1 - ambient)) + ambient); }
  return out;
}
const hexRgb = (c) => [f(((c >> 16) & 255) / 255), f(((c >> 8) & 255) / 255), f((c & 255) / 255)];
// WorldProviderEnd.getFogColor (aqr.b(FF)): 0xA080A0 scaled by cos(angle * 2pi) * 2 + 0.5 clamped to [0, 1], times 0 plus 0.15 (the
// multiplier term is `f4 * 0.0 + 0.15`, so the colour is always 0.15 of the base).
export function endFogColor(angle = 0) {
  let k = f(f(Math.cos(f(f(angle * Math.PI) * 2)) * 2) + 0.5);
  k = Math.min(1, Math.max(0, k));
  return hexRgb(10518688).map((c) => f(c * f(f(k * 0) + 0.15)));
}

// The provider facts that matter to this port, by dimension id. hasNoSky (aqo.f) is only set by Hell; isHellWorld (aqo.g) by Hell and End;
// canRespawnHere (d) and isSurfaceWorld (e) are false for both; celestial angle: Hell 0.5, End 0.0, Overworld from the world time.
export const PROVIDERS = Object.freeze({
  [OVERWORLD]: Object.freeze({ id: 0, name: "Overworld", hasNoSky: false, isHellWorld: false, canRespawnHere: true, isSurfaceWorld: true, ambient: 0, fixedAngle: null, cloudHeight: 128 }),
  [NETHER]: Object.freeze({ id: -1, name: "Nether", hasNoSky: true, isHellWorld: true, canRespawnHere: false, isSurfaceWorld: false, ambient: 0.1, fixedAngle: 0.5, cloudHeight: 128, fog: [f(0.2), f(0.03), f(0.03)], actualHeight: 128 }),
  [END]: Object.freeze({ id: 1, name: "The End", hasNoSky: false, isHellWorld: true, canRespawnHere: false, isSurfaceWorld: false, ambient: 0, fixedAngle: 0, cloudHeight: 8, entrance: [100, 50, 0], averageGroundLevel: 50, actualHeight: 256, endSky: true }),
});
export const providerOf = (dimension = 0) => PROVIDERS[dimension] ?? PROVIDERS[OVERWORLD];
// World.getActualHeight: the Nether is 128 tall (hasNoSky), the rest 256.
export const actualHeight = (dimension) => (providerOf(dimension).hasNoSky ? 128 : 256);
export const inDimension = (world) => world?.dimension ?? 0;

// ---- Entity portal timing ----
// Entity.getPortalCooldown (sa.ai): 300; EntityPlayer overrides it with 10. EntityPlayer.getMaxInPortalTime (yz.D): 80, or 0 when
// capabilities.disableDamage (Creative). The plain Entity returns 0.
export const portalCooldown = (isPlayer) => (isPlayer ? 10 : 300);
export const maxInPortalTime = (isPlayer, creative) => (isPlayer ? (creative ? 0 : 80) : 0);
// Direction.getMovementDirection (p.a(DD)I).
export const movementDirection = (dx, dz) => (Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 2 : 0));
// Direction.offsetX / offsetZ / rotateOpposite / rotateRight / rotateLeft.
export const DIR = Object.freeze({ offsetX: [0, -1, 0, 1], offsetZ: [1, 0, -1, 0], rotateOpposite: [2, 3, 0, 1], rotateRight: [1, 2, 3, 0], rotateLeft: [3, 0, 1, 2] });

export class PortalState {
  constructor() { this.inPortal = false; this.portalCounter = 0; this.timeUntilPortal = 0; this.teleportDirection = 0; }
  // Entity.setInPortal (sa.ah). prev/x/z: prevPosX/Z and posX/Z.
  setInPortal(prevX, prevZ, x, z, { isPlayer = true } = {}) {
    if (this.timeUntilPortal > 0) { this.timeUntilPortal = portalCooldown(isPlayer); return; }
    if (!this.inPortal) this.teleportDirection = movementDirection(prevX - x, prevZ - z);
    this.inPortal = true;
  }
  // The portal part of Entity.onEntityUpdate (sa.C) for a server world with the Nether allowed. Returns the dimension to travel to
  // (Entity.travelToDimension argument: 0 from the Nether, else -1) or null. `riding`: ridingEntity != null.
  tick(dimension, { isPlayer = true, creative = false, riding = false } = {}) {
    let travel = null;
    const max = maxInPortalTime(isPlayer, creative);
    if (this.inPortal) {
      if (!riding && this.portalCounter++ >= max) {
        this.portalCounter = max;
        this.timeUntilPortal = portalCooldown(isPlayer);
        travel = dimension === NETHER ? 0 : NETHER;
      }
      this.inPortal = false;
    } else {
      if (this.portalCounter > 0) this.portalCounter -= 4;
      if (this.portalCounter < 0) this.portalCounter = 0;
    }
    if (this.timeUntilPortal > 0) --this.timeUntilPortal;
    return travel;
  }
  save() { return { c: this.portalCounter, t: this.timeUntilPortal }; }
  restore(d) { this.portalCounter = d?.c | 0; this.timeUntilPortal = d?.t | 0; this.inPortal = false; return this; }
}

// ---- transferEntityToWorld ----
const clampInt = (v) => Math.min(29999872, Math.max(-29999872, Math.trunc(v)));
// ServerConfigurationManager.transferEntityToWorld (oi.a(sa, int, mt, mt)): the position before the Teleporter runs. `from` is the
// dimension the entity leaves, `to` the one it enters (entity.dimension is already `to` when the original reads it). Returns the
// coordinates the entity is moved to (d0, d1 after the border clamp), whether the Teleporter then runs, and the yaw override.
export function transferTarget(from, to, x, y, z, yaw) {
  let d0 = x, d1 = z, posY = y, newYaw = yaw;
  if (to === NETHER) { d0 /= 8; d1 /= 8; }
  else if (to === OVERWORLD) { d0 *= 8; d1 *= 8; }
  else { // End: `from === 1` reads the world spawn, otherwise getEntrancePortalLocation (100, 50, 0); yaw 90, pitch 0
    const e = PROVIDERS[END].entrance; d0 = e[0]; posY = e[1]; d1 = e[2]; newYaw = 90;
  }
  const teleporter = from !== END;
  if (teleporter) { d0 = clampInt(d0); d1 = clampInt(d1); }
  return { x: d0, y: posY, z: d1, yaw: newYaw, teleporter, origin: { x, y, z, yaw } };
}

// ---- Teleporter (ahp) ----
// `world`: { get(x,y,z) -> id, set(x,y,z,id,meta,flags), notify(x,y,z), time, actualHeight, dimension, seed (BigInt/number) }.
// `entity`: { x, y, z, vx, vy, vz, yaw, pitch, teleportDirection } updated in place (setLocationAndAngles / motion).
export class Teleporter {
  constructor(world, { ids = GAME_IDS, isSolid = (id) => id !== 0, random = new JavaRandom(world.seed ?? 0) } = {}) {
    this.world = world; this.ids = ids; this.isSolid = isSolid; this.random = random;
    this.cache = new Map(); // destinationCoordinateCache: chunkXZ2Int(x, z) -> { x, y, z, time }
    this.keys = [];
  }
  isAir(x, y, z) { return this.world.get(x, y, z) === this.ids.air; }
  setLocation(e, x, y, z, yaw, pitch) { e.x = x; e.y = y; e.z = z; e.yaw = yaw; e.pitch = pitch; }
  // Teleporter.placeInPortal (ahp.a(sa, DDDF)).
  placeInPortal(e, _x, _y, _z, _yaw) {
    const w = this.world, ids = this.ids;
    if (w.dimension !== END) {
      if (!this.placeInExistingPortal(e, _x, _y, _z, _yaw)) { this.makePortal(e); this.placeInExistingPortal(e, _x, _y, _z, _yaw); }
      return;
    }
    // Dimension 1: a 5x5 obsidian platform under three layers of air, entity at (floor x, floor y - 1, floor z).
    const i = Math.floor(e.x), j = Math.floor(e.y) - 1, k = Math.floor(e.z), b0 = 1, b1 = 0;
    for (let l = -2; l <= 2; l++) for (let i1 = -2; i1 <= 2; i1++) for (let j1 = -1; j1 < 3; j1++) {
      const k1 = i + i1 * b0 + l * b1, l1 = j + j1, i2 = k + i1 * b1 - l * b0;
      w.set(k1, l1, i2, j1 < 0 ? ids.obsidian : ids.air, 0, 3);
    }
    this.setLocation(e, i, j, k, e.yaw, 0);
    e.vx = e.vy = e.vz = 0;
  }
  // Teleporter.placeInExistingPortal (ahp.b): a 128-block search of portal blocks (cached per column), then the safe-side logic.
  placeInExistingPortal(e, _x, _y, _z, yaw) {
    const w = this.world, ids = this.ids, R = 128;
    let best = -1, i = 0, j = 0, k = 0;
    const l = Math.floor(e.x), i1 = Math.floor(e.z), key = `${l},${i1}`;
    let fresh = true;
    // ChunkCoordIntPair.chunkXZ2Int(l, i1) is the long key; (x, z) is its injective equivalent here.
    const hit = this.cache.get(key);
    if (hit) { best = 0; i = hit.x; j = hit.y; k = hit.z; hit.time = w.time; fresh = false; }
    else {
      for (let l1 = l - R; l1 <= l + R; l1++) {
        const d4 = l1 + 0.5 - e.x;
        for (let i2 = i1 - R; i2 <= i1 + R; i2++) {
          const d5 = i2 + 0.5 - e.z;
          for (let j2 = w.actualHeight - 1; j2 >= 0; j2--) {
            if (w.get(l1, j2, i2) !== ids.portal) continue;
            while (w.get(l1, j2 - 1, i2) === ids.portal) j2--;
            const d6 = j2 + 0.5 - e.y, d7 = d4 * d4 + d6 * d6 + d5 * d5;
            if (best < 0 || d7 < best) { best = d7; i = l1; j = j2; k = i2; }
          }
        }
      }
    }
    if (best < 0) return false;
    if (fresh) { this.cache.set(key, { x: i, y: j, z: k, time: w.time }); this.keys.push(key); }
    let d11 = i + 0.5; const d8 = j + 0.5; let d9 = k + 0.5;
    let k2 = -1;
    if (w.get(i - 1, j, k) === ids.portal) k2 = 2;
    if (w.get(i + 1, j, k) === ids.portal) k2 = 0;
    if (w.get(i, j, k - 1) === ids.portal) k2 = 3;
    if (w.get(i, j, k + 1) === ids.portal) k2 = 1;
    const l2 = e.teleportDirection ?? 0;
    if (k2 > -1) {
      let i3 = DIR.rotateLeft[k2], j3 = DIR.offsetX[k2], k3 = DIR.offsetZ[k2], l3 = DIR.offsetX[i3], i4 = DIR.offsetZ[i3];
      const flag1 = !this.isAir(i + j3 + l3, j, k + k3 + i4) || !this.isAir(i + j3 + l3, j + 1, k + k3 + i4);
      const flag2 = !this.isAir(i + j3, j, k + k3) || !this.isAir(i + j3, j + 1, k + k3);
      if (flag1 && flag2) {
        k2 = DIR.rotateOpposite[k2]; i3 = DIR.rotateOpposite[i3];
        j3 = DIR.offsetX[k2]; k3 = DIR.offsetZ[k2]; l3 = DIR.offsetX[i3]; i4 = DIR.offsetZ[i3];
        d11 -= l3; d9 -= i4;
      }
      let f1 = 0.5, f2 = 0.5;
      if (!flag1 && flag2) f1 = 1;
      else if (flag1 && !flag2) f1 = 0;
      else if (flag1 && flag2) f2 = 0;
      d11 += f(f(l3 * f1) + f(f2 * j3)); d9 += f(f(i4 * f1) + f(f2 * k3));
      let f3 = 0, f4 = 0, f5 = 0, f6 = 0;
      if (k2 === l2) { f3 = 1; f4 = 1; }
      else if (k2 === DIR.rotateOpposite[l2]) { f3 = -1; f4 = -1; }
      else if (k2 === DIR.rotateRight[l2]) { f5 = 1; f6 = -1; }
      else { f5 = -1; f6 = 1; }
      const d10 = e.vx, d12 = e.vz;
      e.vx = d10 * f3 + d12 * f6;
      e.vz = d10 * f5 + d12 * f4;
      e.yaw = f(f(f(yaw - f(l2 * 90)) + f(k2 * 90)));
    } else e.vx = e.vy = e.vz = 0;
    this.setLocation(e, d11, d8, d9, e.yaw, e.pitch);
    return true;
  }
  // Teleporter.makePortal (ahp.a(sa)Z): looks for a 4x5x3 clear spot with a solid floor within 16 blocks, else a 4x5x1 spot, else
  // forces a platform and portal at the entity's height (clamped to 70..actualHeight - 10). Writes obsidian and portal blocks.
  makePortal(e) {
    const w = this.world, ids = this.ids, R = 16, rnd = this.random;
    let best = -1;
    const i = Math.floor(e.x), j = Math.floor(e.y), k = Math.floor(e.z);
    let l = i, i1 = j, j1 = k, k1 = 0;
    const l1 = rnd.nextInt(4);
    const H = w.actualHeight;
    const solidAt = (x, y, z) => this.isSolid(w.get(x, y, z));
    for (let i2 = i - R; i2 <= i + R; i2++) {
      const d1 = i2 + 0.5 - e.x;
      for (let k2 = k - R; k2 <= k + R; k2++) {
        const d2 = k2 + 0.5 - e.z;
        for (let j2 = H - 1; j2 >= 0; j2--) {
          if (!this.isAir(i2, j2, k2)) continue;
          while (j2 > 0 && this.isAir(i2, j2 - 1, k2)) j2--;
          for (let i3 = l1; i3 < l1 + 4; i3++) {
            let l2 = i3 % 2, k3 = 1 - l2;
            if (i3 % 4 >= 2) { l2 = -l2; k3 = -k3; }
            let ok = true;
            scan: for (let j3 = 0; j3 < 3; j3++) for (let i4 = 0; i4 < 4; i4++) for (let l3 = -1; l3 < 4; l3++) {
              const k4 = i2 + (i4 - 1) * l2 + j3 * k3, j4 = j2 + l3, l4 = k2 + (i4 - 1) * k3 - j3 * l2;
              if ((l3 < 0 && !solidAt(k4, j4, l4)) || (l3 >= 0 && !this.isAir(k4, j4, l4))) { ok = false; break scan; }
            }
            if (!ok) continue;
            const d4 = j2 + 0.5 - e.y, d3 = d1 * d1 + d4 * d4 + d2 * d2;
            if (best < 0 || d3 < best) { best = d3; l = i2; i1 = j2; j1 = k2; k1 = i3 % 4; }
          }
        }
      }
    }
    if (best < 0) {
      for (let i2 = i - R; i2 <= i + R; i2++) {
        const d1 = i2 + 0.5 - e.x;
        for (let k2 = k - R; k2 <= k + R; k2++) {
          const d2 = k2 + 0.5 - e.z;
          for (let j2 = H - 1; j2 >= 0; j2--) {
            if (!this.isAir(i2, j2, k2)) continue;
            while (j2 > 0 && this.isAir(i2, j2 - 1, k2)) j2--;
            for (let i3 = l1; i3 < l1 + 2; i3++) {
              const l2 = i3 % 2, k3 = 1 - l2;
              let ok = true;
              scan: for (let j3 = 0; j3 < 4; j3++) for (let i4 = -1; i4 < 4; i4++) {
                const l3 = i2 + (j3 - 1) * l2, k4 = j2 + i4, j4 = k2 + (j3 - 1) * k3;
                if ((i4 < 0 && !solidAt(l3, k4, j4)) || (i4 >= 0 && !this.isAir(l3, k4, j4))) { ok = false; break scan; }
              }
              if (!ok) continue;
              const d4 = j2 + 0.5 - e.y, d3 = d1 * d1 + d4 * d4 + d2 * d2;
              if (best < 0 || d3 < best) { best = d3; l = i2; i1 = j2; j1 = k2; k1 = i3 % 2; }
            }
          }
        }
      }
    }
    const i6 = l; let j2 = i1; const k2 = j1;
    let l5 = k1 % 2, i3 = 1 - l5;
    if (k1 % 4 >= 2) { l5 = -l5; i3 = -i3; }
    if (best < 0) {
      if (i1 < 70) i1 = 70;
      if (i1 > H - 10) i1 = H - 10;
      j2 = i1;
      for (let l2 = -1; l2 <= 1; l2++) for (let k3 = 1; k3 < 3; k3++) for (let j3 = -1; j3 < 3; j3++) {
        const i4 = i6 + (k3 - 1) * l5 + l2 * i3, l3 = j2 + j3, k4 = k2 + (k3 - 1) * i3 - l2 * l5;
        w.set(i4, l3, k4, j3 < 0 ? ids.obsidian : ids.air, 0, 3);
      }
    }
    for (let l2 = 0; l2 < 4; l2++) {
      for (let k3 = 0; k3 < 4; k3++) for (let j3 = -1; j3 < 4; j3++) {
        const i4 = i6 + (k3 - 1) * l5, l3 = j2 + j3, k4 = k2 + (k3 - 1) * i3;
        w.set(i4, l3, k4, k3 === 0 || k3 === 3 || j3 === -1 || j3 === 3 ? ids.obsidian : ids.portal, 0, 2);
      }
      for (let k3 = 0; k3 < 4; k3++) for (let j3 = -1; j3 < 4; j3++) {
        w.notify(i6 + (k3 - 1) * l5, j2 + j3, k2 + (k3 - 1) * i3);
      }
    }
    return true;
  }
  // Teleporter.removeStalePortalLocations (ahp.a(J)): every 100 ticks drops cached positions not used for 600 ticks.
  removeStale(time) {
    if (time % 100 !== 0) return;
    const limit = time - 600;
    for (const key of [...this.keys]) {
      const p = this.cache.get(key);
      if (!p || p.time < limit) { this.cache.delete(key); this.keys.splice(this.keys.indexOf(key), 1); }
    }
  }
}

// Where the End exit portal leads: a player who touches the exit portal (the credits path, EntityPlayerMP.travelToDimension(1) in the
// End) is respawned in the Overworld (ServerConfigurationManager.respawnPlayer(player, 0, true)) at the bed or world spawn, keeping inventory.
export const END_EXIT_RESPAWN_DIMENSION = OVERWORLD;
