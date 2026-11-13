// Batch 61 (mpdispense): what a dispenser on the dedicated server fires. The single-player dispense engine (src/dispense.js, the BlockDispenser behaviours of Bootstrap) already runs on
// the server's LiveRedstone (server-container-ticks.js); this module is its `host` for everything that needs an entity. It owns the entity systems single player uses, ticked in
// tickEntitySimulation's order (TNT, thrown balls, arrows, rockets; items already tick in the simulation, mobs and fireballs in ServerMobs): Arrows (bow.js), Projectiles (projectiles.js,
// snowballs and eggs), a second Projectiles inside WitchPotions (splash potions and Bottles o' Enchanting, witch-potions.js), primed TNT (explosion.js), FireworkRockets
// (fireworks-live.js). Small fireballs go into the mobs' own Fireballs (`ServerMobs.mobs.fireballs`), spawn eggs through `ServerMobs.mobs.create`/`spawnEggMob`.
// Clients see them as `dispEnts` (a snapshot of the entities near the player, each tick) and `dispFx` (explosions, potion breaks, rocket bursts, sounds); see client-dispense.js.
// Not connected: arrows and thrown balls do not hit players, minecarts and boats need the vehicle track (`sim.vehicles.dispenseBoat / dispenseCart`, absent: the stack is kept),
// nothing here is saved across a restart.
import { Arrows, arrowTargets } from '../bow.js';
import { Projectiles, mobTargets, thrownHit } from '../projectiles.js';
import { WitchPotions } from '../witch-potions.js';
import { splashImpact } from '../witch.js';
import { primeTnt, TNT_POWER } from '../explosion.js';
import { tickPrimedTnt } from '../entity-simulation.js';
import { FireworkRockets, dispenseFirework } from '../fireworks-live.js';
import { spawnEggMob, eggMobType } from '../spawn-egg-use.js';
import { SUPPORTED, MOB_LIMIT } from './server-mobs.js';
import { ITEMS } from '../survival.js';
import { PHYSICS } from '../world.js';

const NEAR = 64 * 64, NEAR_TNT = 160 * 160; // EntityTracker ranges: arrows, thrown entities, rockets 64 blocks; primed TNT 160
const f = Math.fround;

export class ServerDispense {
  constructor(sim) {
    this.sim = sim; this.dim = 0; // b62: the dimension whose players see and are hit by these entities (the Nether has its own instance)
    this.arrows = new Arrows(Math.random);
    this.balls = new Projectiles(Math.random); // snowballs and eggs; the poof particles belong to the clients (disp replicas die -> clientImpact)
    this.balls.clientParticles = true;
    this.potions = null; // WitchPotions over the server's EntityWorld, made on first use (ServerMobs is built after the container ticks)
    this.primed = [];
    this.rockets = new FireworkRockets();
    this.ids = new WeakMap(); this.nextId = 0;
    this.fx = [];  // dispFx of this tick, in order
    this.vehicles = null; // set by the vehicle track: { dispenseBoat(x, y, z), dispenseCart(type, x, y, z, stack) } -> boolean
    sim.redstone.hooks.primeTnt = (x, y, z) => this.prime(x + 0.5, y + 0.5, z + 0.5, true); // flint and steel on a TNT block (BlockTNT.func_150114_a)
  }
  get mobs() { return this.sim.mobs.mobs; } // the EntityWorld
  id(e) { let i = this.ids.get(e); if (!i) this.ids.set(e, i = ++this.nextId); return i; }
  get any() { return this.arrows.list.length + this.balls.balls.length + (this.potions?.projectiles.balls.length ?? 0) + this.primed.length + this.rockets.rockets.length + (this.mobs._fireballs?.list.length ?? 0) > 0; }

  // The host of dispense.js's engine (installDispensers). `stop(...)` is the old "put the stack back" for what has no entity path here.
  host(stop) {
    const v = () => this.vehicles;
    return {
      arrow: e => { const a = this.arrows.make(e, e.rand, { shooter: null, pickup: 1 }); this.arrows.list.push(a); },
      thrown: (kind, e) => this.thrown(kind, e),
      fireball: ({ x, y, z, ax, ay, az }) => { this.mobs.fireballs.launch({ large: false, owner: null, x, y, z, exact: [ax, ay, az] }); },
      firework: (stack, x, y, z, fx, fz) => { dispenseFirework(this.rockets, x, y, z, fx, fz, stack); },
      spawnTnt: (x, y, z) => { this.prime(x + 0.5, y + 0.5, z + 0.5, false); },
      // BehaviorDispenseSpawnEgg through ServerMobs' own limits: a mob type the clients have no copy of, or a full world, keeps the egg in the dispenser (native would spend it)
      spawnEgg: (stack, at, roll) => { const type = eggMobType(stack.damage); if (type && !(SUPPORTED.has(type) && this.mobs.entities.length < MOB_LIMIT)) stop(); else spawnEggMob({ mobs: this.mobs }, stack.damage, at, stack.displayName, roll); },
      cart: (type, x, y, z, stack) => { if (!v()?.dispenseCart(type, x, y, z, stack)) stop(); },
      boat: (x, y, z) => { if (!v()?.dispenseBoat(x, y, z)) stop(); },
      armorType: stack => ITEMS[stack.id]?.armor,
      equip: (cell, stack, position) => this.equip(cell, stack, position),
    };
  }
  prime(x, y, z, sound) {
    const e = primeTnt(x, y, z, { placer: null });
    this.primed.push(e);
    if (sound) this.fx.push({ k: 'sound', name: 'game.tnt.primed', x: e.x, y: e.y + 0.49, z: e.z, volume: 1, pitch: 1 });
    return e;
  }
  thrown(kind, e) {
    const ball = { x: e.x, y: e.y, z: e.z, mx: e.mx, my: e.my, mz: e.mz, yaw: e.yaw, pitch: e.pitch, kind, px: e.x, py: e.y, pz: e.z, prevYaw: e.yaw, prevPitch: e.pitch, ticks: 0, rand: e.rand, random: e.rand, dead: false };
    if (kind === 'potion' || kind === 'expBottle') {
      this.potions ??= new WitchPotions(this.mobs);
      this.potions.projectiles.balls.push({ ...ball, damage: e.damage ?? 0, ...(Array.isArray(e.custom) ? { custom: e.custom.map(x => ({ ...x })) } : {}), owner: null });
    } else this.balls.balls.push(ball);
  }
  // BehaviorDefault armour (ItemArmor, abc): the first living entity in the front cell with that armour slot empty. Players only; `position` is getArmorPosition (1 boots .. 4 helmet),
  // the player's armorInventory index `position - 1`. A mob needs canPickUpLoot, which no mob of the server has.
  equip([i, j, k], stack, position) {
    for (const p of this.sim.players.values()) {
      if (p.dead || !p.survival || (p.dimension | 0) !== this.dim) continue;
      const q = p.position, hw = f(PHYSICS.width / 2);
      if (!(q.x + hw > i && q.x - hw < i + 1 && q.y + PHYSICS.height > j && q.y < j + 1 && q.z + hw > k && q.z - hw < k + 1)) continue;
      const armor = p.survival.inventory.armor;
      if (armor[position - 1]) continue; // the selector skips an entity that wears one already
      armor[position - 1] = { ...stack, count: 1 }; // sv.c(position - 1, copy of count 1); the invSet diff of ServerItems.settle tells the client
      return true;
    }
    return false;
  }

  // One tick, after the players moved and before ServerMobs.tick (items, TNT, balls, arrows, rockets, then the mobs and their fireballs).
  tick() {
    const mobs = this.mobs;
    if (!this.any) return;
    const world = this.sim.world, live = mobs.entities;
    if (this.primed.length) tickPrimedTnt(world, this.primed, { explode: (x, y, z, size, ctx) => this.explode(x, y, z, size, ctx) });
    if (this.balls.balls.length) {
      this.balls.tick(world, mobTargets(live, null), (e, ball) => thrownHit(mobs, e, ball, ball));
      for (const h of this.balls.drain()) { // EntityEgg.onImpact: the chicks join the mob list before the mob events drain; a splash sound goes to the clients
        if (h.sound) this.fx.push({ k: 'sound', name: h.sound, x: h.position.x, y: h.position.y, z: h.position.z, volume: h.volume, pitch: h.pitch });
        else for (let i = 0; i < h.chicks; i++) mobs.hatch(h.x, h.y, h.z, h.yaw);
      }
    }
    if (this.potions?.projectiles.balls.length) this.tickPotions();
    if (this.arrows.list.length) {
      this.arrows.tick(world, { targets: arrowTargets(mobTargets(live, null), false), mobs, survival: null, player: null, igniteTnt: (x, y, z) => this.igniteBlockTnt(x, y, z) });
      for (const ev of this.arrows.drain()) if (ev.sound && ev.position) this.fx.push({ k: 'sound', name: ev.sound, x: ev.position.x, y: ev.position.y, z: ev.position.z, volume: ev.volume ?? 1, pitch: ev.pitch ?? 1 });
    }
    if (this.rockets.rockets.length) this.rockets.tick(world, {
      sound: (name, x, y, z, volume, pitch) => this.fx.push({ k: 'sound', name, x, y, z, volume, pitch }),
      spark: (x, y, z, vx, vy, vz) => this.fx.push({ k: 'spark', x, y, z, vx, vy, vz }),
      explode: (x, y, z, vx, vy, vz, fireworks) => this.fx.push({ k: 'firework', x, y, z, vx, vy, vz, fireworks }), // World.makeFireworks (status 17) to the clients tracking it
    });
  }
  // A burning arrow lights a TNT block (EntityArrow.onUpdate -> BlockTNT.onBlockDestroyedByPlayer): the block goes, a primed TNT appears.
  igniteBlockTnt(x, y, z) { if (this.sim.world.set(x, y, z, 0)) this.prime(x + 0.5, y + 0.5, z + 0.5, true); }
  // Explosion.doExplosionA / B (ServerMobs.explode: mobs, players, blocks, drops), then the clients' burst and the random.explode sound (World.newExplosion plays it).
  explode(x, y, z, size, ctx = {}) {
    this.sim.mobs.explode({ x, y, z, size, source: ctx.exploder ?? null });
    this.fx.push({ k: 'explode', x, y, z, size });
  }
  // EntityPotion.onImpact / EntityExpBottle.onImpact. The splash on mobs is WitchPotions.impact (it also queues the loot events the mobs' drain turns into orbs);
  // the players in range take the same splashImpact steps (instant health or harm, then the timed effects). The glass break goes to the clients as `splash`.
  tickPotions() {
    const mobs = this.mobs, potions = this.potions, p = potions.projectiles, targets = mobTargets(mobs.entities.filter(e => e.health > 0), null);
    for (const ball of [...p.balls]) {
      p.tickOne(mobs.world, ball, targets);
      for (const ev of p.drain()) {
        const from = mobs.events.length;
        if (ev.potion) { potions.impact(ev.potion, null, null); this.splashPlayers(ev.potion); } else if (ev.expBottle) potions.expImpact(ev.expBottle);
        for (let i = from; i < mobs.events.length; i++) {
          const e = mobs.events[i];
          if (!e.splashBreak) continue;
          this.fx.push({ k: 'splash', x: e.splashBreak.x, y: e.splashBreak.y, z: e.splashBreak.z, damage: e.splashBreak.damage, volume: e.volume, pitch: e.pitch });
          mobs.events.splice(i--, 1); // the clients play the smash with the break (the S29 filter would drop `game.potion.smash`)
        }
      }
    }
    p.reap();
  }
  splashPlayers({ x, y, z, damage, custom }) {
    const victims = [];
    for (const pl of this.sim.players.values()) if (!pl.dead && pl.survival?.health > 0 && (pl.dimension | 0) === this.dim) victims.push({ x: pl.position.x, y: pl.position.y, z: pl.position.z, width: 0.6, height: 1.8, undead: false, ref: pl, direct: false });
    for (const r of splashImpact(damage, { x, y, z }, victims, null, custom)) {
      const s = r.ref.survival;
      for (const step of r.steps) { // in effect order: a custom list can heal and harm
        if (step.hurt > 0) this.sim.damagePlayer(r.ref, step.hurt, { name: 'magic', from: undefined, call: () => s.damage(step.hurt, 'magic', false) });
        if (step.heal > 0) s.heal?.(step.heal);
      }
      for (const e of r.effects) s.effects?.add({ id: e.id, duration: e.duration, amplifier: e.amplifier });
    }
  }

  // The snapshot of what `player` sees this tick: [] when nothing flies.
  snapshot(player) {
    const out = [], q = player.position, near = (e, range = NEAR) => (e.x - q.x) ** 2 + (e.z - q.z) ** 2 < range;
    for (const a of this.arrows.list) if (near(a)) out.push({ k: 'a', i: this.id(a), x: a.x, y: a.y, z: a.z, yaw: a.yaw, pitch: a.pitch, g: a.inGround ? 1 : 0, s: a.shake ?? 0, c: a.crit ? 1 : 0 });
    for (const b of this.balls.balls) if (near(b)) out.push({ k: 'b', i: this.id(b), kind: b.kind, x: b.x, y: b.y, z: b.z });
    for (const b of this.potions?.projectiles.balls ?? []) if (near(b)) out.push({ k: 'b', i: this.id(b), kind: b.kind, x: b.x, y: b.y, z: b.z, damage: b.damage ?? 0 });
    for (const t of this.primed) if (near(t, NEAR_TNT)) out.push({ k: 't', i: this.id(t), x: t.x, y: t.y, z: t.z, fuse: t.fuse });
    for (const r of this.rockets.rockets) if (near(r)) out.push({ k: 'r', i: this.id(r), x: r.x, y: r.y, z: r.z });
    for (const b of this.mobs._fireballs?.list ?? []) if (!b.dead && near(b)) out.push({ k: 'b', i: this.id(b), kind: b.kind, x: b.x, y: b.y, z: b.z, scale: b.scale });
    return out;
  }
  // Called by the simulation's tick tail: queues dispEnts / dispFx on each player (`dispOut`, sent by server.js). A player who just saw entities gets one empty snapshot to clear them.
  flush() {
    const fx = this.fx.splice(0);
    for (const p of this.sim.players.values()) {
      if ((p.dimension | 0) !== this.dim) continue; // b62: each dimension's instance serves its own players
      const ents = this.snapshot(p), events = fx.filter(e => (e.x - p.position.x) ** 2 + (e.z - p.position.z) ** 2 < (e.k === 'explode' ? NEAR_TNT : NEAR));
      const msgs = p.dispOut ??= [];
      if (ents.length || p.dispSeen) msgs.push({ type: 'dispEnts', ents });
      p.dispSeen = ents.length > 0;
      if (events.length) msgs.push({ type: 'dispFx', events });
    }
  }
}
