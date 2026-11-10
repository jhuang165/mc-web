// The gun server's arrows, thrown things and experience orbs near this tab (server-mobs.js thrownRows), kept as never-ticked
// records the single-player renderers draw: ArrowRenderer and ProjectileRenderer key their meshes by the record, so a row's
// id keeps the same object; each record keeps last tick's position (px/py/pz, prevYaw/prevPitch) for the partial-tick lerp.
import { CART_WIDTH, CART_HEIGHT } from '../minecarts.js';
import { BOAT_WIDTH, BOAT_HEIGHT, BOAT_Y_OFFSET } from '../boats.js';

const num = v => (Number.isFinite(v) ? v : 0);

function follow(map, rows, make, update) {
  const seen = new Set(), out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!Array.isArray(row) || !Number.isInteger(row[0])) continue;
    const id = row[0];
    let r = map.get(id);
    const fresh = !r;
    if (fresh) { r = make(row); map.set(id, r); }
    update(r, row, fresh);
    seen.add(id); out.push(r);
  }
  for (const id of map.keys()) if (!seen.has(id)) map.delete(id);
  return out;
}
const move = (r, x, y, z, fresh) => {
  if (fresh) { r.px = x; r.py = y; r.pz = z; } else { r.px = r.x; r.py = r.y; r.pz = r.z; }
  r.x = x; r.y = y; r.z = z;
};

export class RemoteThrown {
  constructor() {
    this.arrowMap = new Map(); this.ballMap = new Map(); this.orbMap = new Map();
    this.arrows = []; this.balls = []; this.orbs = [];
    this.tntMap = new Map(); this.tnt = [];
    this.cartMap = new Map(); this.carts = [];
    this.boatMap = new Map(); this.boats = [];
  }
  // rows: { arrows: [[id, x, y, z, yaw, pitch, shake, crit]], balls: [[id, kind, x, y, z, potion, look]], orbs: [[id, x, y, z, value]],
  // tnt: [[id, x, y, z, fuse]] } (TntRenderer reads x/y/z, px/py/pz and fuse).
  apply(rows) {
    if (!rows || typeof rows !== 'object') return;
    this.arrows = follow(this.arrowMap, rows.arrows, () => ({}), (r, [, x, y, z, yaw, pitch, shake, crit], fresh) => {
      move(r, num(x), num(y), num(z), fresh);
      yaw = num(yaw); pitch = num(pitch);
      if (fresh) { r.prevYaw = yaw; r.prevPitch = pitch; } else { r.prevYaw = r.yaw; r.prevPitch = r.pitch; }
      // RenderArrow lerps the angles the short way round, as EntityArrow keeps prevRotationYaw within 180 of rotationYaw.
      while (yaw - r.prevYaw < -180) r.prevYaw -= 360;
      while (yaw - r.prevYaw >= 180) r.prevYaw += 360;
      r.yaw = yaw; r.pitch = pitch; r.shake = num(shake); r.crit = !!crit;
    });
    this.balls = follow(this.ballMap, rows.balls, ([, kind]) => ({ kind: String(kind) }), (r, [, , x, y, z, potion, look], fresh) => {
      move(r, num(x), num(y), num(z), fresh);
      r.damage = num(potion);
      if (look && typeof look === 'object') for (const k of ['scale', 'fullbright', 'blue', 'vx', 'vy', 'vz']) if (k in look) r[k] = look[k];
    });
    this.orbs = follow(this.orbMap, rows.orbs, () => ({ color: 0 }), (r, [, x, y, z, value], fresh) => {
      move(r, num(x), num(y), num(z), fresh);
      r.value = num(value); r.posY = r.y + 0.25;
      if (!fresh) r.color++; // EntityXPOrb.xpColor: ticks since it appeared here
    });
    this.tnt = follow(this.tntMap, rows.tnt, () => ({}), (r, [, x, y, z, fuse], fresh) => {
      move(r, num(x), num(y), num(z), fresh);
      r.fuse = num(fuse);
    });
  }
  // The chest minecarts (server-mobs.js cartRows: [id, type, x, posY, z, yaw, pitch, rolling, rollingDir, damage]) as the records
  // Minecarts.renderPose and pickMinecart read: the box from the position, as Minecarts.setPosition builds it.
  applyCarts(rows) {
    this.carts = follow(this.cartMap, rows, ([id, type]) => ({ id, type: Number.isInteger(type) ? type : 1, dead: false, customName: null }),
      (r, [, , x, y, z, yaw, pitch, rolling, dir, damage], fresh) => {
        x = num(x); y = num(y); z = num(z);
        if (fresh) { r.px = x; r.py = y; r.pz = z; } else { r.px = r.x; r.py = r.posY; r.pz = r.z; }
        r.x = x; r.posY = y; r.z = z; r.y = y - CART_HEIGHT / 2;
        r.bb = [x - CART_WIDTH / 2, r.y, z - CART_WIDTH / 2, x + CART_WIDTH / 2, r.y + CART_HEIGHT, z + CART_WIDTH / 2];
        r.prevYaw = fresh ? num(yaw) : r.yaw; r.prevPitch = fresh ? num(pitch) : r.pitch;
        r.yaw = num(yaw); r.pitch = num(pitch); r.rolling = num(rolling); r.rollingDir = dir === -1 ? -1 : 1; r.damage = num(damage);
      });
  }
  // The boats (server-mobs.js boatRows: [id, x, posY, z, yaw, timeSinceHit, damage, forwardDir]) as the records Boats.renderPose
  // and pickMinecart read: the box from the position, as Boats.setPosition builds it.
  applyBoats(rows) {
    this.boats = follow(this.boatMap, rows, ([id]) => ({ id, boat: true, type: 0, dead: false, height: BOAT_HEIGHT }),
      (r, [, x, y, z, yaw, hit, damage, dir], fresh) => {
        x = num(x); y = num(y); z = num(z); yaw = num(yaw);
        if (fresh) { r.px = x; r.py = y; r.pz = z; r.prevYaw = yaw; } else { r.px = r.x; r.py = r.posY; r.pz = r.z; r.prevYaw = r.yaw; }
        // Boats.renderPose lerps prevYaw to yaw directly: keep it the short way round.
        while (yaw - r.prevYaw < -180) r.prevYaw -= 360;
        while (yaw - r.prevYaw >= 180) r.prevYaw += 360;
        r.x = x; r.posY = y; r.z = z; r.y = y - BOAT_Y_OFFSET; r.yaw = yaw;
        const half = BOAT_WIDTH / 2;
        r.bb = [x - half, r.y, z - half, x + half, r.y + BOAT_HEIGHT, z + half];
        r.timeSinceHit = num(hit); r.damage = num(damage); r.forwardDir = dir === -1 ? -1 : 1;
      });
  }
  clear() {
    this.arrowMap.clear(); this.ballMap.clear(); this.orbMap.clear(); this.cartMap.clear(); this.boatMap.clear(); this.tntMap.clear();
    this.arrows = []; this.balls = []; this.orbs = []; this.carts = []; this.boats = []; this.tnt = [];
  }
}
