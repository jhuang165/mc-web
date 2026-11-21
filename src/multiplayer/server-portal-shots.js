// Batch 91 entnbt91: arrows and firework rockets cross portals on the dedicated server (Entity.travelToDimension, sa.b(I), and ServerConfigurationManager.transferEntityToWorld, oi.a(sa, int, mt, mt),
// bytecode-read in entnbt89 / entnbt90). zc.h (EntityArrow) calls sa.h -> sa.C first and ends with I() (doBlockCollisions) unless it started the update in the ground; zf.h (rocket) runs
// moveEntity. BlockPortal / BlockEndPortal.onEntityCollidedWithBlock then start the countdown (or, for the End portal, travel at once), the copy is built from the entity's NBT
// (copyDataFrom: damage, pickup, life, tile, inGround; Life, LifeTime, FireworksItem; no shooter), placed by transferEntityToWorld and spawned in the destination world.
// The port's single-player walk is DimensionLive.tickEntities (dimension-live.js); this is the server's, over the lanes of every dimension (server-dispense.js: an instance per dimension,
// stand-in lanes for a dimension nobody built). The arrow and rocket updates already ran their own sa.C countdown (`counted`), so the walk only reads the collision.
import { EntityPortals, entityDeparture, travelRoute, POS_Y } from '../entity-portal.js';
import { materialSolid } from '../plants.js';
import { OVERWORLD, END } from '../dimensions.js';

const solidId = id => id !== 0 && materialSolid(id);

export class ServerPortalShots {
  constructor(dims) { this.dims = dims; this.portals = new EntityPortals(); }
  // Every projectile system the server runs: the Overworld's instance, the Nether's and the End's own, with the stand-in lanes of each.
  instances() {
    const d = this.dims, sim = d.sim, out = [];
    for (const inst of [sim.dispenseHome, d.nether?.dispense, d.end?.n?.dispense]) if (inst && !out.includes(inst)) out.push(inst);
    return out;
  }
  // One walk after the tick (the entities already moved): the arrows of every lane, the rockets of every instance.
  step() {
    const d = this.dims, departures = [];
    this.allow = d.sim.rules?.allowNether !== false; // allow-nether false: sa.C never counts a Nether portal trip up (the player's checkPortal does the same) and MinecraftServer.v ticks only the Overworld (the End portal still travels at once)
    for (const inst of this.instances()) {
      for (const lane of inst.lanes) {
        const world = lane.world;
        if (!world || !lane.arrows?.list.length || (!this.allow && lane.dim)) continue;
        this.walk('arrow', lane.arrows.list, lane.arrows, lane.dim | 0, world, departures);
      }
      if (inst.rockets?.rockets.length && inst.world && (this.allow || !inst.dim)) this.walk('rocket', inst.rockets.rockets, inst.rockets, inst.dim | 0, inst.world, departures);
    }
    for (const t of departures) this.arrive(t);
  }
  walk(kind, list, owner, dim, world, departures) {
    const getId = (x, y, z) => world.get(x, y, z);
    let gone = null;
    for (const e of list) {
      if (e.dead) continue;
      const r = this.portals.step(e, kind, { dim, getId, counted: true, noCollide: kind === 'arrow' && e.groundAtStart === true });
      if (!r || (!this.allow && !r.endPortal)) continue;
      const dep = entityDeparture(this.portals, kind, e, r, owner);
      (gone ??= new Set()).add(e);
      departures.push({ kind, dim, ...dep });
    }
    if (gone) { const keep = list.filter(e => !gone.has(e)); list.length = 0; list.push(...keep); }
  }
  // transferEntityToWorld + spawnEntityInWorld for one traveller: the route from the saved Dimension (travelRoute), the placement (ServerDimensions.placeEntity or the Overworld spawn
  // for the End's exit), then the copy joins the destination's lane (an arrow) or instance (a rocket).
  arrive({ kind, dim, rec, mc, arg, source }) {
    const d = this.dims, from = source ?? dim, route = travelRoute(from, arg), to = route.to, e = { vx: 0, vy: 0, vz: 0, pitch: 0, teleportDirection: 0, ...mc };
    if (route.spawn) { // the End's exit: world.getSpawnPoint, posY = getHeightValue; no Teleporter
      const w = d.overworld, s = d.sim.worldSpawn ?? w.spawn(), x = Array.isArray(s) ? s[0] : s.x, z = Array.isArray(s) ? s[2] : s.z;
      let y = 0;
      for (let h = 255; h > 0; h--) if (solidId(w.get(Math.floor(x), h, Math.floor(z)))) { y = h + 1; break; }
      Object.assign(e, { x, y, z });
    } else {
      if (arg === END) e.pitch = 0;
      d.placeEntity(e, from, to, route.teleporter); // the Teleporter runs only when the source (the saved Dimension) is not the End
    }
    e.yaw %= 360; // the copy is built from NBT: Entity.readFromNBT keeps rotationYaw % 360
    const y = e.y - POS_Y[kind], lane = d.sim.dispenseHome ? this.laneOf(to) : null;
    if (!lane) return;
    if (kind === 'arrow') {
      Object.assign(rec, { x: e.x, y, z: e.z, mx: e.vx, my: e.vy, mz: e.vz, yaw: e.yaw, pitch: e.pitch });
      const a = lane.arrows.fromRecord(rec);
      if (a) lane.arrows.list.push(a);
    } else {
      const inst = this.instanceOf(to);
      if (!inst) return;
      Object.assign(rec, { x: e.x, y, z: e.z, px: e.x, py: y, pz: e.z, mx: e.vx, my: e.vy, mz: e.vz, yaw: e.yaw, pitch: e.pitch, prevYaw: e.yaw, prevPitch: e.pitch });
      const r = inst.rockets.fromRecord(rec);
      if (r) inst.rockets.rockets.push(r);
    }
  }
  laneOf(dim) { return this.dims.sim.dispenseHome.laneFor(dim); }
  instanceOf(dim) { const h = this.dims.sim.dispenseHome; return dim === OVERWORLD ? h : this.dims.state(dim)?.dispense ?? null; }
}
