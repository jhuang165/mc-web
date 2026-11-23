// Batch 92 portals92: mobs, dropped items, experience orbs, minecarts and boats cross portals on the dedicated server, as Entity.travelToDimension (sa.b(I)) does for them.
// Bytecode-read in batch 92: sa.b(I) returns for a client world or a dead entity, makes the copy with EntityList.createEntityByName(sg.b(this)) + copyDataFrom (NBT: contents, UUID, age,
// health, cooldown; riders and leads are not carried), removes the old entity (ahb.e) and spawns the copy in the destination world (mt.d). Only EntityItem (xk.b(I): then searches for
// neighbouring stacks, on the dead original), EntityMinecartContainer (xp.b(I): dropContentsWhenDead off) and the player override it. BlockPortal / BlockEndPortal ignore an entity with a
// rider or a vehicle, and sa.C's 300-tick timeUntilPortal gates the Nether portal (EntityPortals in entity-portal.js: the same step the single-player live and away runs use).
// The walk, the departure record (entityDeparture) and the placement (ServerPortalShots.placed -> ServerDimensions.placeEntity) are shared; this file only knows where each kind lives
// on the server and how a saved record joins the destination's list. The trackers see the list change: a mob's S13 / S0F come from the SharedMobTracker's entry diff, an item's and an
// orb's from the object tracker's row diff, a cart's or a boat's from the vehicles message's del / set.
import { EntityPortals, entityDeparture, POS_Y, mcToMobYaw, endArrival, mobLinks } from '../entity-portal.js';
import { mountEntity as mobUnmount } from '../mob-riding.js'; // b98 portals98
import { ExperienceOrbs } from '../experience.js';
import { Minecarts } from '../minecarts.js';
import { Boats } from '../boats.js';
import { PlayerInventory } from '../inventory.js';
import { ITEMS } from '../survival.js';
import { LEAD_ITEM } from '../horse-gear.js';

const OVERWORLD = 0, END = 1;
import { TRANSIENT_MOB } from '../mob-transient.js';
const reader = new PlayerInventory(ITEMS);

export class ServerPortalTravel {
  constructor(dims) { this.dims = dims; this.portals = new EntityPortals(); }
  // The entity systems of one dimension, or null when nobody built it (no entity of it can stand in a portal).
  parts(dim) {
    const d = this.dims;
    if (dim === OVERWORLD) return { dim, world: d.overworld, mobs: d.mobsOf(OVERWORLD), items: d.sim.items, xp: d.sim.serverItems.xp, vehicles: d.sim.vehicles };
    const n = dim === END ? d.end.n : d.nether;
    return n ? { dim, world: n.world, mobs: n.mobs, items: n.items, xp: n.xp, vehicles: n.vehicles } : null;
  }
  // One walk over the entities of dimension `dim` (called after that dimension's tick).
  step(dim) {
    const d = this.dims, p = this.parts(dim);
    if (!p?.world) return;
    const allow = d.sim.rules?.allowNether !== false; // allow-nether false: the Nether and the End do not tick, and sa.C never counts a Nether portal trip up (an End portal still travels at once)
    if (!allow && dim) return;
    const at = { dim, getId: (x, y, z) => p.world.get(x, y, z) };
    const lists = [['mob', p.mobs?.mobs.entities, p.mobs?.mobs], ['item', p.items?.items, p.items], ['orb', p.xp?.orbs, p.xp], ['cart', p.vehicles?.carts.carts, p.vehicles?.carts], ['boat', p.vehicles?.boats.carts, p.vehicles?.boats]];
    const departures = [];
    for (let li = 0; li < lists.length; li++) { // b96 mpperf96: index loops (no array iterators; list / owner read from the row)
      const row = lists[li], kind = row[0], list = row[1], owner = row[2];
      if (!list?.length) continue;
      let gone = null;
      for (let ei = 0; ei < list.length; ei++) {
        const e = list[ei];
        if (e.dead) continue;
        // BlockPortal and BlockEndPortal collide only with an entity that has no rider and no vehicle (mob jockeys and a mob a player rides too): the countdown still runs.
        const links = kind === 'mob' ? mobLinks(e) : null; // b98 portals98: only a mob that rides something is held back; a ridden one that already counted down travels and drops its rider
        if (links?.riding) { this.portals.step(e, kind, { ...at, riding: true }); continue; }
        const vehicle = kind === 'cart' || kind === 'boat';
        const r = this.portals.step(e, kind, vehicle ? { ...at, ridden: !!(e.rider || e.passenger) } : links?.ridden ? { ...at, ridden: true } : at);
        if (!r || (!allow && !r.endPortal)) continue;
        if (links?.ridden) this.unmount(p, e, owner); // World.removeEntity (ahb.e): riddenBy.mountEntity(null) before the copy is written
        if (vehicle && e.rider) this.unseat(p, e); // a rider is put down where the vehicle stood and stays behind (World.removeEntity -> mountEntity(null))
        const dep = entityDeparture(this.portals, kind, e, r, owner);
        if (vehicle && e.passenger) { if (e.passenger.ridingEntity === e) e.passenger.ridingEntity = null; e.passenger = null; } // a mob that mounted after the collision stays behind
        departures.push({ kind, dim, ...dep, leashed: kind === 'mob' && e.leash?.holder === 'player' });
        (gone ??= new Set()).add(e);
      }
      if (gone) { const keep = list.filter(e => !gone.has(e)); list.length = 0; list.push(...keep); }
    }
    for (const t of departures) this.arrive(t);
  }
  // A mob that travelled with a rider: the player is put down beside it (ServerVehicles.dismount), a mob rider is let go at the mount's top (mountEntity(null)).
  unmount(p, e, owner) {
    if (e.rider) for (const pl of this.dims.sim.players.values()) if (pl.mount?.mob === e) { p.vehicles.dismount(pl); break; }
    if (e.riddenBy) mobUnmount(e.riddenBy, null, (m) => owner.size(m)[1]);
  }
  unseat(p, v) {
    for (const pl of this.dims.sim.players.values()) if (pl.mount && !pl.mount.mob && pl.mount.rider === v.rider) { p.vehicles.dismount(pl); return; }
    v.rider = null;
  }
  // transferEntityToWorld + spawnEntityInWorld for one traveller: the copy joins the destination's list (createEntityByName + copyDataFrom, from the saved record).
  arrive(t) {
    const { kind, rec } = t, { e, to } = this.dims.shots.placed(t);
    this.dims.state(to); // the destination is built on first use (placeEntity already did)
    const p = this.parts(to);
    if (!p) return;
    const y = e.y - POS_Y[kind];
    if (kind === 'mob') {
      const mobs = p.mobs.mobs, holderId = t.leashed ? rec.leash?.holderId : undefined;
      delete rec.id;
      for (const k of TRANSIENT_MOB) delete rec[k];
      Object.assign(rec, { x: e.x, y, z: e.z, yaw: mcToMobYaw(e.yaw), portalMotion: { vx: e.vx, vy: e.vy, vz: e.vz } });
      if (endArrival(t.source ?? t.dim, t.arg)) delete rec.rotationPitch; // b97 portals97: a trip into the End sets pitch 0 before the copy is made
      // A player holder: sw.bP (the first leashed tick of the copy) looks the UUID up among the living entities in the 10-block box around the copy, so a holder who stands in the destination
      // within reach keeps the lead; otherwise the first updateLeashedState drops it (b93). A knot or mob holder stays on the record: the knot is found or made at the saved X/Y/Z of the NEW world.
      if (t.leashed && !this.holderThere(to, rec.leash?.holderId, e.x, y, e.z, mobs.size(rec))) { delete rec.leash; this.lead(p, e.x, y, e.z); }
      const m = mobs.restore({ ...rec, id: 'mob-' + mobs.nextId });
      if (!m) return;
      if (m.leash?.holder === 'player' && holderId !== undefined) m.leash = { ...m.leash, holderId }; // gearFieldsFrom keeps only { holder: 'player' }: the server's own holder id goes back on
      mobs.entities.push(m); mobs.nextId++;
    } else if (kind === 'cart' || kind === 'boat') {
      delete rec.rider; delete rec.id;
      Object.assign(rec, { x: e.x, y, z: e.z, motion: [e.vx, e.vy, e.vz], rotation: [e.yaw, e.pitch] }); // b94 portals94: OnGround is NBT, the copy keeps it
      const owner = kind === 'cart' ? p.vehicles.carts : p.vehicles.boats, ids = p.vehicles.ids;
      const made = (kind === 'boat' ? Boats.fromJSON([rec], { ids }) : Minecarts.fromJSON({ version: 1, carts: [rec] }, { ids })).carts[0];
      if (!made) return;
      made.id = owner.nextId++; // a new id in this dimension's list
      owner.carts.push(made); owner.joined?.(made);
    } else if (kind === 'item') {
      Object.assign(rec, { x: e.x, y, z: e.z, mx: e.vx, my: e.vy, mz: e.vz });
      const keep = p.items.items;
      p.items.load([rec], s => reader.read(s), 0); // load() joins the new item (joined: its eid) and replaces the list: the old ones go back in front
      p.items.items = [...keep, ...p.items.items];
    } else {
      Object.assign(rec, { x: e.x, y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz });
      const o = new ExperienceOrbs([rec]).orbs[0];
      if (!o) return;
      p.xp.orbs.push(o); p.xp.joined?.(o);
    }
  }
  // sw.bP's box: the copy's bounding box grown by 10 each way meets the holder's box (player 0.6 x 1.8).
  holderThere(dim, id, x, y, z, [w, h]) {
    const pl = id === undefined ? null : this.dims.sim.players.get(id);
    if (!pl || (pl.dimension | 0) !== dim) return false;
    const q = pl.position;
    return Math.abs(q.x - x) <= 10 + (w + 0.6) / 2 && Math.abs(q.z - z) <= 10 + (w + 0.6) / 2 && q.y + 1.8 >= y - 10 && q.y <= y + h + 10;
  }
  lead(p, x, y, z) {
    p.items.spawn({ id: LEAD_ITEM, count: 1, damage: 0 }, x, y, z, { delay: 10, motion: [Math.random() * 0.2 - 0.1, 0.2, Math.random() * 0.2 - 0.1] });
  }
}
