// Batch 68 mppaintings, the client half of server-hanging.js: the `hset` / `hdel` fields of the `vehicles` message become client copies of paintings, item frames and leash knots.
// A copy is built from the spawn packet as NetHandlerPlayClient does (object-tracker.js spawnHanging): the painting from S10's tile, title and direction; the frame from S0E 71's
// tile (x / 32) and direction, its item and rotation from watcher slots 2 and 3; the knot from S0E 77 (a 0.5 cube on its floored tile). The geometry is hanging.js's (executed
// there). The copies feed the single-player HangingRenderer (`list()`), the lead renderer (`knots()`) and the crosshair (`pick`).
import { hangingGeometry, ARTS, FRAME_PIXELS, pickHanging } from '../hanging.js';

const int = v => Number.isInteger(v);
const stackOf = s => (s && int(s.id) && int(s.count) && s.count > 0 ? structuredClone(s) : null);

export class ClientHanging {
  constructor() { this.copies = new Map(); } // key -> entity ({ kind: 'painting' | 'frame' | 'knot', ... })
  apply(message) {
    for (const r of Array.isArray(message?.hset) ? message.hset : []) this.spawn(r);
    for (const key of Array.isArray(message?.hdel) ? message.hdel : []) this.copies.delete(key);
  }
  spawn(r) {
    if (typeof r?.k !== 'string' || !/^[hk]\d+$/.test(r.k) || ![r.x, r.y, r.z].every(Number.isFinite)) return;
    let e = this.copies.get(r.k);
    if (r.p === 'S10') {
      if (typeof r.title !== 'string' || !int(r.dir)) return;
      const art = Math.max(0, ARTS.findIndex(a => a[0] === r.title)), [tx, ty, tz] = [r.x | 0, r.y | 0, r.z | 0];
      e = Object.assign(e ?? { kind: 'painting', dead: false }, { dir: r.dir, art, tx, ty, tz, ...hangingGeometry(r.dir, tx, ty, tz, ARTS[art][1], ARTS[art][2]) });
    } else if (r.p === 'S0E' && r.t === 71) {
      if (!int(r.data)) return;
      const [tx, ty, tz] = [Math.trunc(r.x / 32), Math.trunc(r.y / 32), Math.trunc(r.z / 32)];
      const meta = new Map((Array.isArray(r.meta) ? r.meta : []).map(([, idx, value]) => [idx, value]));
      e = Object.assign(e ?? { kind: 'frame', dead: false }, { dir: r.data, tx, ty, tz, ...hangingGeometry(r.data, tx, ty, tz, FRAME_PIXELS, FRAME_PIXELS), item: stackOf(meta.get(2)), rotation: (Number(meta.get(3)) | 0) & 3 });
    } else if (r.p === 'S0E' && r.t === 77) {
      const [tx, ty, tz] = [Math.trunc(r.x / 32), Math.trunc(r.y / 32), Math.trunc(r.z / 32)], x = tx + 0.5, y = ty + 0.5, z = tz + 0.5;
      e = Object.assign(e ?? { kind: 'knot', dead: false }, { x, y, z, tx, ty, tz, bb: [x - 0.25, y, z - 0.25, x + 0.25, y + 0.5, z + 0.25] });
    } else return;
    this.copies.set(r.k, e);
  }
  // The paintings and frames for HangingRenderer.update.
  list() { return [...this.copies.values()].filter(e => e.kind !== 'knot'); }
  // The knots for HorseGearRenderer.update ({ x, y, z } tile).
  knots() { return [...this.copies.values()].filter(e => e.kind === 'knot').map(e => ({ x: e.tx, y: e.ty, z: e.tz })); }
  // EntityRenderer.getMouseOver on the copies' boxes (the 0.1 border included): { key, vehicle: entity, distance } or null.
  pick(origin, dir, reach, wall = reach) {
    const entities = [...this.copies.values()], hit = pickHanging({ pickable: () => entities }, origin, dir, reach, wall);
    if (!hit) return null;
    for (const [key, e] of this.copies) if (e === hit.entity) return { key, vehicle: e, distance: hit.distance };
    return null;
  }
  clear() { this.copies.clear(); }
}
