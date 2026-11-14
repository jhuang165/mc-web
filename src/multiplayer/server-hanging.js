// Batch 68 mppaintings: paintings, item frames and leash knots on the dedicated server.
//
// The single-player rules are reused, not copied: `Hanging` (src/hanging.js: EntityHanging.setDirection, onValidSurface, the painting's art pick from Entity.rand, onBroken drops,
// attackEntityFrom, EntityItemFrame.interactFirst, the 101st-update surface check, NBT) and the knots of EntityWorld (horse-gear-live.js: knotInteract, knotAttack, knotTickOne).
// One ServerHanging belongs to each ServerVehicles (server-vehicles.js), so the Overworld, the Nether and the End each keep their own list, save it under `vehicles.hanging`, and
// swap with the rest of the dimension's systems (`sim.vehicles.hanging`). It shares the vehicles' entity id counter.
//
// Wire (server -> client, riding on the existing `vehicles` message; no new message type): `hset` [record], `hdel` [key]. A record is the spawn packet of the tracker plus the data watcher:
//   painting  { k: 'h<id>', p: 'S10', id, x, y, z (the wall tile), dir, title }                              S10SpawnPainting (title = EnumArt name, direction byte)
//   item frame { k: 'h<id>', p: 'S0E', t: 71, id, x, y, z (tile * 32), data: dir, meta: [[5, 2, item], [0, 3, rotation]] }   S0EPacketSpawnObject type 71, watcher slots 2 (item) and 3 (rotation)
//   leash knot { k: 'k<id>', p: 'S0E', t: 77, id, x, y, z (floor(position * 32)), data: 0 }                    S0EPacketSpawnObject type 77
// A changed frame (item or rotation) is sent again whole, as an S1C would carry its watcher. Client -> server: the existing `vehUse` / `vehHit` with a 'h<id>' or 'k<id>' key
// (C02 interact / attack); a painting or frame item on a wall is the ordinary `edit` (ItemHangingEntity.onItemUse runs on the server's own block ray).
// Range: EntityTracker range 160 clamped to 144 (TRACKER_LIMIT), a square on x and z. Native rules used (see .shared-memory/notes/mppaintings-b68-track.md for how each was read).
import { Hanging, PAINTING_ITEM, FRAME_ITEM, ARTS, hangingArrowTargets } from '../hanging.js';
import { hitSide } from '../hanging-interaction.js';
import { TRACKER_LIMIT } from '../entity-tracker.js';
import { PHYSICS } from '../world.js';
import { VIEW_DISTANCE } from './server-chunks.js';

export const HANG_RANGE = TRACKER_LIMIT; // min(160, 144)
const REACH_SQ = 36; // 6 blocks, as the other entity clicks of the server
const KEY = /^[hk]\d+$/;
const copyStack = s => (s ? structuredClone(s) : null);

// The record a player is sent for a hanging entity (see the header).
export function hangingRecord(e) {
  const base = { k: 'h' + e.id, id: e.id, dir: e.dir };
  if (e.kind === 'painting') return { ...base, p: 'S10', x: e.tx, y: e.ty, z: e.tz, title: ARTS[e.art]?.[0] ?? ARTS[0][0] };
  return { ...base, p: 'S0E', t: 71, x: e.tx * 32, y: e.ty * 32, z: e.tz * 32, data: e.dir, meta: [[5, 2, copyStack(e.item)], [0, 3, e.rotation | 0]] };
}
// EntityLeashKnot's S0E 77 at the knot's position (a placed knot stands at the fence centre, a summoned one at the command position).
export function knotRecord(k, id) {
  const c = knotCentre(k);
  return { k: 'k' + id, id, p: 'S0E', t: 77, x: Math.floor(c.x * 32), y: Math.floor(c.y * 32), z: Math.floor(c.z * 32), data: 0 };
}
export const knotCentre = k => (k.summoned ? { x: k.px, y: k.py, z: k.pz } : { x: k.x + 0.5, y: k.y + 0.5, z: k.z + 0.5 });
const knotBox = k => { const c = knotCentre(k); return [c.x - 0.25, c.y, c.z - 0.25, c.x + 0.25, c.y + 0.5, c.z + 0.25]; };
// The box a hanging entity is clicked through (setDirection's box has min > max on the thickness axis; the click ray grows it by the 0.1 border, so order it).
const orderBox = b => [Math.min(b[0], b[3]), Math.min(b[1], b[4]), Math.min(b[2], b[5]), Math.max(b[0], b[3]), Math.max(b[1], b[4]), Math.max(b[2], b[5])];
const near = (p, b) => {
  const lo = orderBox(b), eye = [p.position.x, p.position.y + PHYSICS.eye, p.position.z];
  let d = 0;
  for (let i = 0; i < 3; i++) { const v = Math.max(lo[i] - eye[i], 0, eye[i] - lo[i + 3]); d += v * v; }
  return d;
};

export class ServerHanging {
  // `host` is the ServerVehicles' host (world, players, items, mobs, leads); `ids` its EntityIds; `saved` what save() wrote.
  constructor(host, ids, saved = null) {
    this.host = host;
    this.h = new Hanging({ ids });
    this.ids = ids;
    if (Array.isArray(saved)) this.h.load(saved);
    this.knotIds = new WeakMap();
    this.views = new Map(); // player id -> { known: Map(key -> JSON) }
  }
  get entities() { return this.h.entities; }
  addPlayer(p) { this.views.set(p.id, { known: new Map() }); }
  removePlayer(p) { this.views.delete(p.id); }
  save() { return this.h.toJSON(); }
  owns(e) { return this.h.entities.includes(e); }

  // ---- placing, clicking, breaking ----
  // ItemHangingEntity.onItemUse for the player's server ray (target: { block, adjacent }). True when the click was used (a top or bottom face is not).
  useHeld(p, target) {
    const held = p.survival.held, id = held?.id;
    if (id !== PAINTING_ITEM && id !== FRAME_ITEM) return false;
    const side = hitSide(target);
    if (side < 0) return false;
    const out = this.h.use(id === PAINTING_ITEM ? 'painting' : 'frame', this.host.world, ...target.block, side);
    if (!out.used) return false;
    p.swing = 6;
    if (out.entity && !p.survival.creative) p.survival.take(id, 1); // Creative's stack comes back (ItemInWorldManager restores it)
    return true;
  }
  drops() { for (const d of this.h.drain()) this.host.items.spawn(copyStack(d.stack), d.x, d.posY, d.z, { delay: d.delay }); }
  knotWithId(key) {
    const list = this.host.mobs?.mobs?.knotList ?? [], id = Number(key.slice(1));
    return list.find(k => !k.dead && this.knotIds.get(k) === id) ?? null;
  }
  entityWithId(key) { const id = Number(key.slice(1)); return this.h.entities.find(e => !e.dead && e.id === id) ?? null; }
  // C02 UseEntity on a 'h<id>' / 'k<id>' key. Returns true when the click was handled.
  act(p, key, hit) {
    if (typeof key !== 'string' || !KEY.test(key) || p.survival.health <= 0) return false;
    const mobs = this.host.mobs?.mobs;
    if (key[0] === 'k') {
      const k = this.knotWithId(key);
      if (!k || near(p, knotBox(k)) > REACH_SQ) return false;
      p.swing = 6;
      if (hit) { mobs.knotAttack(k); p.survival.exhaust?.(0.3); return true; }
      const leads = this.host.leads;
      return leads ? !!leads.as(p, () => mobs.knotInteract(k, p.survival)) : !!mobs.knotInteract(k, p.survival); // EntityLeashKnot.interactFirst: the clicker's own mobs join
    }
    const e = this.entityWithId(key);
    if (!e || near(p, e.bb) > REACH_SQ) return false;
    const s = p.survival;
    if (hit) { // EntityHanging.attackEntityFrom with the player's source: a frame with an item gives only the item
      p.swing = 6;
      this.h.attack(e, { player: true, creative: !!s.creative });
      s.exhaust?.(0.3);
      this.drops();
      return true;
    }
    if (e.kind !== 'frame') return false; // a painting has no interactFirst
    const held = s.held, r = this.h.interact(e, held);
    if (!r.action) return false;
    p.swing = 6;
    if (r.action === 'insert' && !s.creative) s.take(held.id, 1);
    return true;
  }
  // The thrown-hit rule of the single-player entity list (entity-simulation.js thrownAtVehicleOrHanging): attackEntityFrom with the thrower's source (null: a dispenser).
  thrown(e, owner) {
    if (!this.owns(e)) return false;
    this.h.attack(e, owner?.survival ? { player: true, creative: !!owner.survival.creative } : null);
    this.drops();
    return true;
  }
  // The sweep targets of arrows and thrown balls in this dimension (boxes as the single-player hanging targets).
  targets() { return hangingArrowTargets(this.h); }
  // What bow.js (Arrows.hitEntity) calls on `ctx.hanging`, with the shooter's creative flag; `by` is { player: true } for an arrow a player shot.
  arrowHost(creative) {
    const self = this;
    return { get entities() { return self.h.entities; }, attack(e, by) { const r = self.h.attack(e, by ? { player: true, creative: !!creative } : null); self.drops(); return r; } };
  }
  explode(x, y, z, size) { if (this.h.entities.length) { this.h.explode(x, y, z, size); this.drops(); } }

  // ---- the world tick ----
  // EntityHanging.onUpdate only runs in a chunk that is ticking: here, one that a player of the dimension has within the view distance.
  active(e) {
    const vd = this.host.rules?.viewDistance ?? VIEW_DISTANCE; // b69 serverprops: view-distance
    for (const p of this.host.players.values()) {
      if (Math.abs(Math.floor(e.x / 16) - Math.floor(p.position.x / 16)) <= vd && Math.abs(Math.floor(e.z / 16) - Math.floor(p.position.z / 16)) <= vd) return true;
    }
    return false;
  }
  tick() {
    if (!this.h.entities.length) return;
    this.h.tick(this.host.world, { active: e => this.active(e) });
    this.drops();
  }

  // ---- the tracker ----
  // One `hset` / `hdel` delta for each player (their own packet fields to merge into `p.vehPackets`). Called after the tick; a dead entity has left `entities`.
  track(playerOf) {
    const live = this.h.entities.filter(e => !e.dead).map(e => ({ key: 'h' + e.id, x: e.x, z: e.z, record: () => hangingRecord(e) }));
    for (const k of this.host.mobs?.mobs?.knotList ?? []) {
      if (k.dead) continue;
      let id = this.knotIds.get(k);
      if (!id) this.knotIds.set(k, (id = this.ids.take()));
      const c = knotCentre(k);
      live.push({ key: 'k' + id, x: c.x, z: c.z, record: () => knotRecord(k, id) });
    }
    const out = new Map(), range = this.host.rules ? Math.min(160, this.host.rules.trackerLimit) : HANG_RANGE; // b69 serverprops: EntityTracker limit of the view distance
    for (const [id, view] of this.views) {
      const p = playerOf(id);
      if (!p) { view.known.clear(); continue; } // a player of another dimension: the client rebuilt its world
      const hset = [], hdel = [], seen = new Set();
      for (const t of live) {
        if (Math.abs(t.x - p.position.x) > range || Math.abs(t.z - p.position.z) > range) continue;
        const record = t.record(), json = JSON.stringify(record);
        seen.add(t.key);
        if (view.known.get(t.key) !== json) { view.known.set(t.key, json); hset.push(record); }
      }
      for (const key of [...view.known.keys()]) if (!seen.has(key)) { view.known.delete(key); hdel.push(key); }
      if (hset.length || hdel.length) out.set(id, { ...(hset.length ? { hset } : {}), ...(hdel.length ? { hdel } : {}) });
    }
    return out;
  }
}
