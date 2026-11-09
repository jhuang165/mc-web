// The entities of the Overworld's spawn area during an away run (batch 31, public/research/dimensions.md "Batch 31").
//
// Natively (WorldServer.updateEntities, mt.h: `P++ >= 1200` with an empty player list, `P` reset by mt.i while a player is present) entities
// and tile entities update for exactly 1200 ticks after the last player leaves. This runs the live item, experience orb, primed TNT,
// minecart and boat systems on the headless away world for those ticks. The saved records of entities that sit in a column the run did not
// load stay as they were (they are not in a loaded chunk). Nothing here is a new rule: ItemEntities, ExperienceOrbs, tickTnt, Minecarts,
// Boats and applyExplosion are the same modules the live game ticks.
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { primeTnt, TNT_Y_OFFSET } from "./explosion.js";
import { tickPrimedTnt } from "./entity-simulation.js";
import { applyExplosion } from "./explosion-simulation.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { JavaRandom } from "./java-random.js";

// Cart kinds a headless run can tick: empty (0), chest (1), furnace (2) and TNT (3) carts. Hopper, spawner and command carts need hosts
// (inventory transfer, mob spawning, the command interpreter) the run does not have, so they stay frozen as saved.
const CART_TYPES = new Set([0, 1, 2, 3]);
const num = (v) => Number.isFinite(v);

export function awayEntities(plan, { world, ticking, rt, fire, weather, tiles, readStack, maxStack, sound = () => {} }) {
  const e = plan.entities;
  if (!e) return null;
  const at = (r) => num(r?.x) && num(r?.z) && ticking(r.x, r.z);
  const split = (list) => { const inside = [], rest = []; for (const r of Array.isArray(list) ? list : []) (at(r) ? inside : rest).push(r); return { inside, rest }; };
  const ridden = new Set(plan.ridden ?? []);
  const seed = Number(BigInt.asUintN(32, BigInt(plan.editSequence | 0) * 40503n + BigInt(plan.ticks | 0)));
  const rng = new JavaRandom(BigInt(seed) * 2654435761n + 11n);
  const random = () => rng.nextDouble();

  const drops = split(e.drops), orbs = split(e.xpOrbs), tnt = split(e.tnt);
  const cartList = Array.isArray(e.minecarts?.carts) ? e.minecarts.carts : [], boatList = Array.isArray(e.boats) ? e.boats : [];
  const simCart = (c) => at(c) && CART_TYPES.has(c.type) && !c.rider && !ridden.has(`cart-${c.id}`);
  const simBoat = (b) => at(b) && !b.rider && !ridden.has(`boat-${b.id}`);
  const carts = { inside: cartList.filter(simCart), rest: cartList.filter((c) => !simCart(c)) };
  const boatsSplit = { inside: boatList.filter(simBoat), rest: boatList.filter((b) => !simBoat(b)) };

  const items = new ItemEntities(random);
  items.load(drops.inside, readStack, 0);
  const xp = new ExperienceOrbs(orbs.inside, random);
  const primed = tnt.inside.filter((t) => [t.x, t.y, t.z, t.vx, t.vy, t.vz, t.fuse].every(num))
    .map((t) => Object.assign(primeTnt(t.x, t.y + TNT_Y_OFFSET, t.z, { fuse: t.fuse, random }), { vx: t.vx, vy: t.vy, vz: t.vz }));
  const minecarts = Minecarts.fromJSON({ version: 1, carts: carts.inside });
  const boats = Boats.fromJSON(boatsSplit.inside);
  const top = Math.max(0, ...cartList.map((c) => c.id | 0), ...boatList.map((b) => b.id | 0));
  minecarts.nextId = Math.max(minecarts.nextId, top + 1);
  boats.nextId = Math.max(boats.nextId, minecarts.nextId);
  minecarts.blockHook = (x, y, z) => { rt.redstone.collide(x, y, z); rt.flush(); };
  const late = []; // spills after the gate: an item entity that would never tick, kept as a saved record
  let open = true;

  // Explosion.doExplosionA/B over the run's own entity systems. Mobs, arrows and projectiles are not part of the run.
  const noHit = { explode() {} };
  const survival = { health: 0, furnaces: tiles.furnaces, chests: tiles.chests, dispensers: tiles.dispensers, brewing: tiles.brewing, hoppers: tiles.hoppers };
  const self = {
    items, xp, primed, minecarts, boats, falling: null,
    explode(x, y, z, size, { exploder = null, attacker = null } = {}) {
      const out = applyExplosion({ world, weather, mobs: null, items, xpOrbs: xp, arrows: noHit, projectiles: noHit, falling: self.falling, primed, survival,
        position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, farming: { observe() {} } },
      { x, y, z, size, exploder, attacker, smoking: true }, { ignite: (fx, fy, fz) => fire.ignite(fx, fy, fz), sound });
      rt.fluidChanges(out.changes.filter((c) => c[4] === 0 && c[3] !== 0));
      return out;
    },
    // A drop or spill: a live item entity while the gate is open, a saved record once it is closed.
    spill(stack, x, y, z, delay = 10) {
      if (open) items.spawn(stack, x, y, z, { delay });
      else late.push({ stack: { ...stack }, x, y, z, age: 0, delay });
    },
    prime(x, y, z) { primed.push(primeTnt(x, y, z, { placer: null, random })); },
    // One game tick of the entity gate, in the order of the live player tick: items, TNT, orbs, then carts and boats.
    tick() {
      items.tick(world, maxStack);
      tickPrimedTnt(world, primed, { explode: (x, y, z, power, ctx) => self.explode(x, y, z, power, { exploder: ctx.exploder }) });
      xp.tick(world, null);
      if (minecarts.carts.length) {
        minecarts.tick(world, { entities: [], host: cartHost });
        for (const d of minecarts.drain()) if (d.stack) self.spill(d.stack, d.x, d.posY, d.z, d.delay ?? 10);
      }
      if (boats.carts.length) {
        boats.tick(world, { entities: [], hooks: {} });
        for (const d of boats.drain()) if (d.stack) self.spill(d.stack, d.x, d.posY, d.z, d.delay ?? 10);
      }
    },
    close() { open = false; },
    // Every list in its saved form: the records outside the run unchanged, the run's entities serialized.
    finish() {
      return {
        drops: [...drops.rest, ...items.serialize(), ...late], xpOrbs: [...orbs.rest, ...xp.serialize()],
        tnt: [...tnt.rest, ...primed.map((t) => ({ x: t.x, y: t.y, z: t.z, vx: t.vx, vy: t.vy, vz: t.vz, fuse: t.fuse }))],
        minecarts: { version: 1, carts: [...carts.rest, ...(minecarts.carts.length ? minecarts.toJSON().carts : [])] },
        boats: [...boatsSplit.rest, ...(boats.carts.length ? boats.toJSON() : [])],
        counts: { items: items.items.length, orbs: xp.orbs.length, tnt: primed.length, carts: minecarts.carts.length, boats: boats.carts.length },
      };
    },
  };
  // EntityMinecartTNT and the furnace cart: the explosion; smoke and sounds are not drawn.
  const cartHost = { explode: (cart, x, y, z, power) => { self.explode(x, y, z, power, {}); }, particle() {}, sound() {}, changed() {}, transfer: null };
  return self;
}
