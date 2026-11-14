// Batch 64 mpstats2: the client copy of the server's fish hooks (server-fishing.js).
//   fishHooks { hooks: [{ o: anglerId, i, x, y, z }] }  the bobbers near this player this tick (an empty list clears them);
//   fishFx { events: [{ n, x, y, z, vx, vy, vz }] }  one-shot particles, spawned through `hooks.particle`.
// RemoteFishing keeps one stable row per hook id with the last place (px, py, pz) so the renderer (fishing-renderer.js) interpolates; `rows` is the list to draw.
export class RemoteFishing {
  // hooks: { particle(name, x, y, z, vx, vy, vz) }
  constructor(hooks = {}) { this.hooks = hooks; this.map = new Map(); this.rows = []; }
  clear() { this.map.clear(); this.rows = []; }
  apply(message) {
    if (message.type === 'fishHooks') this.setHooks(message.hooks ?? []);
    else if (message.type === 'fishFx') for (const e of message.events ?? []) if (typeof e?.n === 'string' && [e.x, e.y, e.z].every(Number.isFinite)) this.hooks.particle?.(e.n, e.x, e.y, e.z, e.vx || 0, e.vy || 0, e.vz || 0);
  }
  setHooks(list) {
    const seen = new Set();
    for (const h of list) {
      if (!h || ![h.x, h.y, h.z].every(Number.isFinite)) continue;
      seen.add(h.i);
      let row = this.map.get(h.i);
      if (!row) this.map.set(h.i, row = { px: h.x, py: h.y, pz: h.z });
      else { row.px = row.x; row.py = row.y; row.pz = row.z; }
      row.x = h.x; row.y = h.y; row.z = h.z; row.id = h.i; row.angler = h.o;
    }
    for (const key of [...this.map.keys()]) if (!seen.has(key)) this.map.delete(key);
    this.rows = [...this.map.values()];
  }
  own(selfId) { return this.rows.find(r => r.angler === selfId) ?? null; }
  others(selfId) { return this.rows.filter(r => r.angler !== selfId); }
}
