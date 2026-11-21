// Batch 92 portals92: mobs, dropped items, experience orbs, minecarts and boats cross portals on the dedicated server, as Entity.travelToDimension (sa.b(I)) does for them.
// Bytecode-read in batch 92: sa.b(I) returns for a client world or a dead entity, makes the copy with EntityList.createEntityByName(sg.b(this)) + copyDataFrom (NBT: contents, UUID, age,
// health, cooldown; riders and leads are not carried), removes the old entity (ahb.e) and spawns the copy in the destination world (mt.d). Only EntityItem (xk.b(I): then searches for
// neighbouring stacks, on the dead original), EntityMinecartContainer (xp.b(I): dropContentsWhenDead off) and the player override it. BlockPortal / BlockEndPortal ignore an entity with a
// rider or a vehicle, and sa.C's 300-tick timeUntilPortal gates the Nether portal (EntityPortals in entity-portal.js: the same step the single-player live and away runs use).
// The walk, the departure record (entityDeparture) and the placement (ServerPortalShots.placed -> ServerDimensions.placeEntity) are shared; this file only knows where each kind lives
// on the server and how a saved record joins the destination's list. The trackers see the list change: a mob's S13 / S0F come from the SharedMobTracker's entry diff, an item's and an
// orb's from the object tracker's row diff, a cart's or a boat's from the vehicles message's del / set.
import { EntityPortals, entityDeparture, POS_Y, mcToMobYaw } from '../entity-portal.js';
import { ExperienceOrbs } from '../experience.js';
import { Minecarts } from '../minecarts.js';
import { Boats } from '../boats.js';
import { PlayerInventory } from '../inventory.js';
import { ITEMS } from '../survival.js';
import { LEAD_ITEM } from '../horse-gear.js';

const OVERWORLD = 0, END = 1;
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
    for (const [kind, list, owner] of lists) {
      if (!list?.length) continue;
      let gone = null;
      for (const e of list) {
        if (e.dead) continue;
        // BlockPortal and BlockEndPortal collide only with an entity that has no rider and no vehicle (mob jockeys and a mob a player rides too): the countdown still runs.
        if (kind === 'mob' && (e.rider || e.vehicle || e.ridingEntity || e.riddenBy)) { this.portals.step(e, kind, { ...at, riding: true }); continue; }
        const vehicle = kind === 'cart' || kind === 'boat';
        const r = this.portals.step(e, kind, vehicle ? { ...at, ridden: !!(e.rider || e.passenger) } : at);
        if (!r || (!allow && !r.endPortal)) continue;
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
      const mobs = p.mobs.mobs;
      delete rec.id;
      Object.assign(rec, { x: e.x, y, z: e.z, yaw: mcToMobYaw(e.yaw), portalMotion: { vx: e.vx, vy: e.vy, vz: e.vz } });
      if (t.leashed) { delete rec.leash; this.lead(p, e.x, y, e.z); } // the holder is not in the new world: the lead drops (EntityLiving.updateLeashedState)
      const m = mobs.restore({ ...rec, id: 'mob-' + mobs.nextId });
      if (!m) return;
      mobs.entities.push(m); mobs.nextId++;
    } else if (kind === 'cart' || kind === 'boat') {
      delete rec.rider; delete rec.id;
      Object.assign(rec, { x: e.x, y, z: e.z, motion: [e.vx, e.vy, e.vz], rotation: [e.yaw, e.pitch], onGround: false });
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
      Object.assign(rec, { x: e.x, y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, onGround: false });
      const o = new ExperienceOrbs([rec]).orbs[0];
      if (!o) return;
      p.xp.orbs.push(o); p.xp.joined?.(o);
    }
  }
  lead(p, x, y, z) {
    p.items.spawn({ id: LEAD_ITEM, count: 1, damage: 0 }, x, y, z, { delay: 10, motion: [Math.random() * 0.2 - 0.1, 0.2, Math.random() * 0.2 - 0.1] });
  }
}
