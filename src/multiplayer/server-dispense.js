// Batch 61 (mpdispense): what a dispenser on the dedicated server fires. The single-player dispense engine (src/dispense.js, the BlockDispenser behaviours of Bootstrap) already runs on
// the server's LiveRedstone (server-container-ticks.js); this module is its `host` for everything that needs an entity. It owns the entity systems single player uses, ticked in
// tickEntitySimulation's order (TNT, thrown balls, arrows, rockets; items already tick in the simulation, mobs and fireballs in ServerMobs): Arrows (bow.js), Projectiles (projectiles.js,
// snowballs and eggs), a second Projectiles inside WitchPotions (splash potions and Bottles o' Enchanting, witch-potions.js), primed TNT (explosion.js), FireworkRockets
// (fireworks-live.js). Small fireballs go into the mobs' own Fireballs (`ServerMobs.mobs.fireballs`), spawn eggs through `ServerMobs.mobs.create`/`spawnEggMob`.
// Clients see them as `dispEnts` (a snapshot of the entities near the player, each tick) and `dispFx` (explosions, potion breaks, rocket bursts, sounds); see client-dispense.js.
// Not connected: arrows and thrown balls do not hit players, minecarts and boats need the vehicle track (`sim.vehicles.dispenseBoat / dispenseCart`, absent: the stack is kept),
// nothing here is saved across a restart.
import { Arrows, arrowTargets } from '../bow.js';
import { impactEnderPearl } from '../ender-pearl.js';
import { arrowPunch } from '../player-knockback.js';
import { addStuckArrow } from '../stuck-arrows.js';
import { Projectiles, mobTargets, thrownHit } from '../projectiles.js';
import { WitchPotions } from '../witch-potions.js';
import { splashImpact } from '../witch.js';
import { primeTnt, TNT_POWER, TNT_Y_OFFSET } from '../explosion.js';
import { tickPrimedTnt } from '../entity-simulation.js';
import { FireworkRockets, dispenseFirework } from '../fireworks-live.js';
import { spawnEggMob, eggMobType } from '../spawn-egg-use.js';
import { SUPPORTED, MOB_LIMIT } from './server-mobs.js';
import { ITEMS } from '../survival.js';
import { PHYSICS } from '../world.js';
import { ServerEyes } from './server-eyes.js'; // b64 mpend2: the flying eye of ender

const NEAR = 64 * 64, NEAR_TNT = 160 * 160; // EntityTracker ranges: arrows, thrown entities, rockets 64 blocks; primed TNT 160
const f = Math.fround;

export class ServerDispense {
  constructor(sim, saved = null) {
    this.sim = sim;
    // b62: `dim` is the dimension whose players see and are hit by these entities; the Nether has its own instance (server-nether.js) whose own fields are the Nether's lane.
    // `extra` holds a stand-in lane for a dimension with no instance yet (a saved Nether arrow before anyone went there): the Nether instance adopts it when it is built.
    this.dim = 0; this.extra = new Map();
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
    this.load(saved);
  }
  // b64 mpend2: the state object of a dimension (-1 the Nether, 1 the End), once built; null for the Overworld
  dimState(dim) { const d = this.sim.dimensions; return (dim | 0) === 1 ? d?.end?.n ?? null : dim ? d?.nether ?? null : null; }
  get mobs() { return this.dim ? (this.dimState(this.dim)?.mobs?.mobs ?? this.sim.mobs.mobs) : this.sim.mobs.mobs; } // the EntityWorld of this instance's dimension
  get world() { return this.dim ? (this.dimState(this.dim)?.world ?? this.sim.world) : this.sim.world; } // b62 lead: an instance is a lane too (lane.world / lane.mobs)
  id(e) { let i = this.ids.get(e); if (!i) this.ids.set(e, i = ++this.nextId); return i; }
  get eyeSystem() { return this._eyes ??= new ServerEyes(this); } // b64 mpend2: made on first use (the constructor's load may reach it first)
  get any() { return this._eyes?.active || this.primed.length + this.rockets.rockets.length + (this.mobs._fireballs?.list.length ?? 0) + (this.mobs._skulls?.list.length ?? 0) > 0 || this.lanes.some(laneBusy); }
  get lanes() { return [this, ...this.extra.values()]; }

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


  // ---- b62: lanes. The Overworld's arrows, balls and potions are this object's own fields; another dimension has a lane object of the same shape (`world` is read when it ticks,
  // `mobs` is a stand-in with no mobs, which the potions' impact code needs). Every projectile sits in the lane of the dimension it was shot in.
  laneFor(dim) {
    dim |= 0;
    if (dim === this.dim) return this;
    const own = this.dimState(dim)?.dispense; // b62 lead: the dimension's own instance, once it is built
    if (own && own !== this && (own.dim | 0) === dim) return own;
    let lane = this.extra.get(dim);
    if (!lane) {
      const sim = this.sim, self = this, balls = new Projectiles(Math.random);
      balls.clientParticles = true;
      lane = { dim, arrows: new Arrows(Math.random), balls, potions: null, get world() { return self.dimState(dim)?.world ?? null; },
        mobs: { entities: [], events: [], worldRandom: sim.weather.random, joined() {}, attackEntityFrom() {}, get world() { return lane.world; } } };
      this.extra.set(dim, lane);
    }
    return lane;
  }
  potionsOf(lane) { return lane.potions ??= new WitchPotions(lane.mobs); }
  playerByName(name) { for (const p of this.sim.players.values()) if (p.name === name) return p; return null; }
  // The server player who shot or threw `e` (an arrow's `owner`, a ball's `thrower`; a saved one is found again by name).
  ownerOf(e) {
    const o = e.owner?.survival ? e.owner : e.thrower?.survival ? e.thrower : null;
    if (o) return o.id !== undefined && this.sim.players.get(o.id) === o ? o : null;
    return e.ownerName ? this.playerByName(e.ownerName) : null;
  }
  // The entity sweep targets of one lane: its mobs and the players of its dimension (a Creative player is `immune`: the arrow flies through). `ball` marks its thrower, who is
  // skipped for the first five ticks (EntityThrowable.onUpdate); a witch's potion skips the witch.
  targets(lane, ball = null, alive = false) {
    const live = alive ? lane.mobs.entities.filter(e => e.health > 0) : lane.mobs.entities, // a stand-in lane's mobs are none; // a dying mob is still collidable for arrows and balls
    out = mobTargets(live, null), f = Math.fround, hw = f(0.3);
    for (const p of this.sim.players.values()) {
      if (p.dead || !p.survival || p.survival.health <= 0 || (p.dimension | 0) !== lane.dim) continue;
      const q = p.position;
      out.push({ ref: p, immune: !!p.survival.creative, box: [q.x - hw, q.y, q.z - hw, q.x + hw, q.y + f(1.8), q.z + hw] });
    }
    if (ball) { const who = ball.thrower ?? ball.owner ?? this.ownerOf(ball); for (const t of out) if (t.ref === who) t.thrower = true; }
    return out;
  }
  // `attacker` of ServerAchievements: kills that happen inside `fn` are credited to `owner` (killEnemy, snipeSkeleton).
  credit(owner, fn) { const a = this.sim.achievements, was = a?.attacker; if (a) a.attacker = owner ?? null; try { return fn(); } finally { if (a) a.attacker = was ?? null; } }

  // EntityArrow's hit on a player (EntityArrow.onUpdate -> attackEntityFrom(causeArrowDamage)), through the same damagePlayer the mobs use. `ref` is the target's player record;
  // undefined for anything else. The source entity is the shooter (a mob, or the player as a named player entity so the death message and the knockback have one);
  // false lets the arrow ricochet. A burning arrow sets the victim on fire for five seconds, Punch pushes, a landed hit adds a stuck arrow (setArrowCountInEntity).
  hitPlayer(a, p, dmg, mobs) {
    if (!p?.survival || this.sim.players.get(p.id) !== p) return undefined;
    const s = p.survival, who = this.ownerOf(a), shooter = a.shooter;
    if (p.dead || s.health <= 0) return false;
    const from = who ? { x: who.position.x, y: who.position.y, z: who.position.z, type: 'player', isPlayer: true, name: who.name } : shooter && typeof shooter === 'object' ? shooter : a;
    if (a.fire > 0) s.setFire?.(5);
    const hit = this.sim.damagePlayer(p, dmg, { name: 'an arrow', from, call: () => s.damage(dmg, 'an arrow', true, undefined, from) }) !== false;
    if (!hit) return false;
    if (s.health > 0) s.arrowCount = addStuckArrow(s.arrowCount);
    arrowPunch(s, a, v => Math.fround(Math.sqrt(v)));
    if (shooter && typeof shooter === 'object' && mobs?.entities?.includes(shooter)) // a hit by a mob's arrow runs the wearer's Thorns on the shooter
      s.thorns?.({ hurt: d => mobs.attackEntityFrom(shooter, d, { from: { x: p.position.x, z: p.position.z }, player: true, name: 'thorns' }),
        sound: () => this.fx.push({ k: 'sound', name: 'damage.thorns', x: shooter.x, y: shooter.y, z: shooter.z, volume: 0.5, pitch: 1, dim: 0 }) });
    return true;
  }
  // A snowball or egg that struck: a mob takes the 0-damage thrown hit (3 on a blaze); a player takes none (EntityPlayer.attackEntityFrom returns false for 0).
  ballHit(mobs, e, ball) { return e?.survival ? false : thrownHit(mobs, e, this.ownerOf(ball)?.position ?? ball, ball); }
  // EntityEnderPearl.onImpact for a thrown pearl: the thrower (if online, alive and in this dimension) moves to the pearl, loses nothing but 5 fall damage and the fall distance.
  pearlImpact(lane, { pearl, hit }) {
    const p = this.ownerOf(pearl), mobs = lane.mobs, world = lane.world;
    const ok = p && !p.dead && (p.dimension | 0) === lane.dim;
    const owner = ok ? { kind: 'playerMP', connected: true, world, riding: !!p.mount, get fallDistance() { return p.fallDistance ?? 0; }, set fallDistance(v) { p.fallDistance = v; p.landedFall = 0; } } : null;
    impactEnderPearl(pearl, { world, owner, hit: hit?.survival ? null : hit }, {
      hit: (e) => { if (e?.type) thrownHit(mobs, e, p?.position ?? pearl, pearl); },
      dismount: () => this.sim.vehicles?.dismount?.(p),
      teleport: (_o, x, y, z) => { p.position.copy({ x, y, z }); p.previous.copy(p.position); Object.assign(p.velocity, { x: 0, y: 0, z: 0 }); },
      damage: (_o, { amount }) => this.sim.damagePlayer(p, amount, { name: 'a fall', from: undefined, call: () => p.survival.damage(amount, 'a fall', false) }),
    });
  }

  // One tick, after the players moved and before ServerMobs.tick (items, TNT, balls, arrows, rockets, then the mobs and their fireballs).
  tick() {
    this.restorePotions(); this.restoreFireballs();
    const mobs = this.mobs;
    if (!this.any) return;
    if (this.primed.length) tickPrimedTnt(this.sim.world, this.primed, { explode: (x, y, z, size, ctx) => this.explode(x, y, z, size, ctx) });
    this.tickLane(this);
    this._eyes?.tick(); // b64 mpend2: eyes of ender in flight
    for (const lane of this.extra.values()) { // another dimension's lane runs with that dimension's items and orbs in place (server-dimensions.js swap)
      const n = this.dimState(lane.dim);
      if (n && laneBusy(lane)) this.sim.dimensions.swap(n, () => this.tickLane(lane));
    }
    if (this.rockets.rockets.length) this.rockets.tick(this.sim.world, {
      sound: (name, x, y, z, volume, pitch) => this.fx.push({ k: 'sound', name, x, y, z, volume, pitch }),
      spark: (x, y, z, vx, vy, vz) => this.fx.push({ k: 'spark', x, y, z, vx, vy, vz }),
      explode: (x, y, z, vx, vy, vz, fireworks) => this.fx.push({ k: 'firework', x, y, z, vx, vy, vz, fireworks }), // World.makeFireworks (status 17) to the clients tracking it
    });
  }
  tickLane(lane) {
    const dim = lane.dim, world = lane.world, mobs = lane.mobs;
    if (lane.balls.balls.length) {
      for (const b of [...lane.balls.balls]) this.credit(this.ownerOf(b), () => lane.balls.tickOne(world, b, this.targets(lane, b), (e, ball) => this.ballHit(mobs, e, ball), imp => this.pearlImpact(lane, imp)));
      lane.balls.reap();
      for (const h of lane.balls.drain()) { // EntityEgg.onImpact: the chicks join the mob list before the mob events drain; a splash sound goes to the clients
        if (h.sound) this.fx.push({ k: 'sound', name: h.sound, x: h.position.x, y: h.position.y, z: h.position.z, volume: h.volume, pitch: h.pitch, dim });
        else if (!dim) for (let i = 0; i < h.chicks; i++) mobs.hatch(h.x, h.y, h.z, h.yaw);
      }
    }
    if (lane.potions?.projectiles.balls.length) this.tickPotions(lane);
    if (lane.arrows.list.length) {
      const arrows = lane.arrows, targets = arrowTargets(this.targets(lane), false);
      const ctx = { targets, mobs: lane === this ? mobs : undefined, survival: null, player: null, igniteTnt: lane === this ? (x, y, z) => this.igniteBlockTnt(x, y, z) : undefined, hitPlayer: (a, ref, dmg) => this.hitPlayer(a, ref, dmg, mobs) };
      for (const a of [...arrows.list]) {
        if (a.ownerName && !a.owner) { a.owner = this.playerByName(a.ownerName) ?? undefined; if (a.owner) a.shooter = 'player'; } // a saved arrow finds its shooter again
        this.credit(this.ownerOf(a), () => arrows.tickOne(world, a, ctx));
      }
      arrows.reap();
      this.collectArrows(lane);
    }
    this.drainArrows(lane);
  }
  drainArrows(lane) { for (const ev of lane.arrows.drain()) if (ev.sound && ev.position) this.fx.push({ k: 'sound', name: ev.sound, x: ev.position.x, y: ev.position.y, z: ev.position.z, volume: ev.volume ?? 1, pitch: ev.pitch ?? 1, dim: lane.dim }); }
  // EntityArrow.onCollideWithPlayer: a stuck, still arrow (pickup 1, or 2 for a Creative player) goes into the inventory of a player touching it, with the pop sound (queued by
  // Arrows.collect) and the S0D collect (`projCollect`: the arrow row and who took it).
  collectArrows(lane) {
    const q = Math.fround;
    for (const p of this.sim.players.values()) {
      if (p.dead || !p.survival || p.survival.health <= 0 || (p.dimension | 0) !== lane.dim || !lane.arrows.list.some(a => a.inGround)) continue;
      const hw = q(0.3), at = p.position, was = lane.arrows.list.filter(a => !a.dead);
      if (!lane.arrows.collect([at.x - hw, at.y, at.z - hw, at.x + hw, at.y + q(1.8), at.z + hw], p.survival)) continue;
      for (const a of was) if (a.dead) (this.collected ??= []).push({ i: this.id(a), by: p.id, dim: lane.dim, x: a.x, y: a.y, z: a.z });
    }
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
  tickPotions(lane = this) {
    const dim = lane.dim, mobs = lane.mobs, potions = this.potionsOf(lane), p = potions.projectiles, world = lane.world;
    for (const ball of [...p.balls]) {
      p.tickOne(world, ball, this.targets(lane, ball, true));
      for (const ev of p.drain()) {
        const from = mobs.events.length;
        this.credit(this.ownerOf(ball), () => {
          if (ev.potion) { const who = this.ownerOf(ball); potions.impact(ev.potion, null, null, who ? { x: who.position.x, z: who.position.z, name: who.name } : null); this.splashPlayers(ev.potion, lane, ball); } else if (ev.expBottle) potions.expImpact(ev.expBottle);
        });
        for (let i = from; i < mobs.events.length; i++) {
          const e = mobs.events[i];
          if (e.splashBreak) {
            this.fx.push({ k: 'splash', x: e.splashBreak.x, y: e.splashBreak.y, z: e.splashBreak.z, damage: e.splashBreak.damage, volume: e.volume, pitch: e.pitch, dim });
            mobs.events.splice(i--, 1); // the clients play the smash with the break (the S29 filter would drop `game.potion.smash`)
          } else if (dim && e.xp) { this.sim.serverItems.xp.spawn(e.xp, e.position); mobs.events.splice(i--, 1); } // the lane has no mob drain: the orbs go to this dimension's
        }
      }
    }
    p.reap();
  }
  splashPlayers({ x, y, z, damage, custom, owner, hit }, lane = this, ball = null) {
    const victims = [], who = ball && this.ownerOf(ball);
    for (const pl of this.sim.players.values()) if (!pl.dead && pl.survival?.health > 0 && (pl.dimension | 0) === lane.dim) victims.push({ x: pl.position.x, y: pl.position.y, z: pl.position.z, width: 0.6, height: 1.8, undead: false, ref: pl, direct: hit === pl });
    // the thrower is the DamageSource's entity: a player (named, so the death message and the knockback have one) or the witch
    const from = who ? { x: who.position.x, y: who.position.y, z: who.position.z, type: 'player', isPlayer: true, name: who.name } : owner?.x !== undefined ? owner : undefined;
    for (const r of splashImpact(damage, { x, y, z }, victims, owner, custom)) {
      const s = r.ref.survival;
      for (const step of r.steps) { // in effect order: a custom list can heal and harm
        if (step.hurt > 0) this.sim.damagePlayer(r.ref, step.hurt, { name: 'magic', from, call: () => s.damage(step.hurt, 'magic', false, undefined, from) });
        if (step.heal > 0) s.heal?.(step.heal);
      }
      for (const e of r.effects) s.effects?.add({ id: e.id, duration: e.duration, amplifier: e.amplifier });
    }
  }

  // The snapshot of what `player` sees this tick: [] when nothing flies. Only the lane of the player's own dimension is sent.
  snapshot(player) {
    const out = [], q = player.position, near = (e, range = NEAR) => (e.x - q.x) ** 2 + (e.z - q.z) ** 2 < range, dim = player.dimension | 0, lane = dim === this.dim ? this : this.extra.get(dim);
    if (lane) {
      for (const a of lane.arrows.list) if (near(a)) out.push({ k: 'a', i: this.id(a), x: a.x, y: a.y, z: a.z, yaw: a.yaw, pitch: a.pitch, g: a.inGround ? 1 : 0, s: a.shake ?? 0, c: a.crit ? 1 : 0 });
      for (const b of lane.balls.balls) if (near(b)) out.push({ k: 'b', i: this.id(b), kind: b.kind, x: b.x, y: b.y, z: b.z });
      for (const b of lane.potions?.projectiles.balls ?? []) if (near(b)) out.push({ k: 'b', i: this.id(b), kind: b.kind, x: b.x, y: b.y, z: b.z, damage: b.damage ?? 0 });
    }
    if (dim !== this.dim) return out; // TNT, rockets and fireballs belong to this instance's dimension
    if (this._eyes?.active) out.push(...this._eyes.rows(q)); // b64 mpend2
    for (const t of this.primed) if (near(t, NEAR_TNT)) out.push({ k: 't', i: this.id(t), x: t.x, y: t.y, z: t.z, fuse: t.fuse });
    for (const r of this.rockets.rockets) if (near(r)) out.push({ k: 'r', i: this.id(r), x: r.x, y: r.y, z: r.z });
    for (const b of this.mobs._fireballs?.list ?? []) if (!b.dead && near(b)) out.push({ k: 'b', i: this.id(b), kind: b.kind, x: b.x, y: b.y, z: b.z, scale: b.scale });
    for (const b of this.mobs._skulls?.list ?? []) if (!b.dead && near(b)) out.push({ k: 'b', i: this.id(b), kind: 'witherSkull', x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, blue: b.blue ? 1 : 0 }); // b63: wither skulls (the model turns to its flight)
    return out;
  }
  // Called by the simulation's tick tail: queues dispEnts / dispFx / projCollect on each player (`dispOut`, sent by server.js). A player who just saw entities gets one empty
  // snapshot to clear them. Every effect carries its dimension (`dim`, 0 when absent) and goes only to the players of that dimension.
  flush() {
    for (const lane of this.lanes) this.drainArrows(lane); // a skeleton's shot (made during the mobs' tick) is heard in the tick it was made
    const fx = this.fx.splice(0), taken = (this.collected ?? []).splice(0);
    for (const p of this.sim.players.values()) {
      const dim = p.dimension | 0;
      if (dim !== this.dim && !this.extra.has(dim)) continue; // b62: each dimension's instance serves its own players (a stand-in lane, until that dimension's instance adopts it)
      const ents = this.snapshot(p), events = fx.filter(e => ((e.dim ?? this.dim) | 0) === dim && (e.x - p.position.x) ** 2 + (e.z - p.position.z) ** 2 < (e.k === 'explode' ? NEAR_TNT : NEAR));
      const msgs = p.dispOut ??= [];
      if (ents.length || p.dispSeen) msgs.push({ type: 'dispEnts', ents });
      p.dispSeen = ents.length > 0;
      if (events.length) msgs.push({ type: 'dispFx', events });
      const got = taken.filter(c => c.dim === dim && (c.x - p.position.x) ** 2 + (c.z - p.position.z) ** 2 < NEAR);
      if (got.length) msgs.push({ type: 'projCollect', taken: got.map(c => ({ i: c.i, by: c.by, x: c.x, y: c.y, z: c.z })) });
    }
  }

  // ---- b62: saved with the world. Arrows (stuck ones too: Arrows.serialize), thrown balls and potions of every lane, each with its shooter's name (so a pearl or an arrow keeps
  // its owner across a restart while that player is online). Primed TNT, rockets and fireballs are not saved here.
  save() {
    this.restorePotions();
    const lanes = {}, all = [...this.lanes, ...[-1, 1].map(d => this.dimState(d)?.dispense).filter(o => o && o !== this)]; // b62 lead: the Nether instance's lane is saved here
    for (const lane of all) {
      const arrows = lane.arrows.list.filter(a => !a.dead), balls = lane.balls.balls, potions = lane.potions?.projectiles.balls.filter(b => !b.dead) ?? [], more = lane.extrasOut ? lane.extrasOut() : lane.pending ? ((({ tnt, rockets, fireballs }) => Object.fromEntries(Object.entries({ tnt, rockets, fireballs }).filter(([, v]) => v)))(lane.pending)) : null; // a stand-in lane re-saves what it holds
      if (!arrows.length && !balls.length && !potions.length && !(more && Object.keys(more).length)) continue;
      const names = list => list.map(e => this.ownerOf(e)?.name ?? e.ownerName ?? null), tag = (rows, list) => rows.map((r, i) => { const n = names(list)[i]; return n ? { ...r, by: n } : r; });
      lanes[lane.dim] = { arrows: tag(lane.arrows.serialize(), arrows), balls: tag(lane.balls.serialize(), balls), potions: tag(lane.potions?.serialize() ?? [], potions), ...more };
    }
    return Object.keys(lanes).length ? { version: 1, lanes } : null;
  }
  // b63 (mpprojectiles2): what an instance (not a stand-in lane) also writes. EntityTNTPrimed saves only `Fuse` (a byte; bytecode-read xw) next to Pos and Motion, so a reloaded
  // TNT has no placer; EntityFireworkRocket its Life, LifeTime and FireworksItem; EntityFireball xTile/yTile/zTile/inTile/inGround and `direction` (the motion; ze, bytecode-read), a
  // large one ExplosionPower, and no shooter. The records are the browser save's (main.js `active.tnt`, FireworkRockets.serialize, Fireballs.serialize), so single player and
  // the server read one format. Null when there is nothing to write.
  extrasOut() {
    const tnt = this.primed.filter(e => e.fuse > 0).map(e => ({ x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, fuse: e.fuse })), rockets = this.rockets.rockets.filter(r => !r.dead).length ? this.rockets.serialize() : null,
      fireballs = (this.dim ? this.dimState(this.dim)?.mobs?.mobs : this.sim.mobs?.mobs)?._fireballs?.serialize(this.dim) ?? [], out = {};
    if (tnt.length) out.tnt = tnt;
    if (rockets) out.rockets = rockets;
    if (fireballs.length) out.fireballs = fireballs;
    const eyes = this._eyes?.serialize(); if (eyes) out.eyes = eyes; // b64 mpend2
    return Object.keys(out).length ? out : null;
  }
  restoreExtras(d) {
    if (!d || typeof d !== 'object') return;
    for (const t of (Array.isArray(d.tnt) ? d.tnt : []).slice(0, 4096)) {
      if (!t || ![t.x, t.y, t.z, t.vx, t.vy, t.vz, t.fuse].every(Number.isFinite)) continue;
      this.primed.push(Object.assign(primeTnt(t.x, t.y + TNT_Y_OFFSET, t.z, { fuse: t.fuse }), { vx: t.vx, vy: t.vy, vz: t.vz }));
    }
    if (d.eyes) this.eyeSystem.load(d.eyes); // b64 mpend2
    if (d.rockets) { const tmp = new FireworkRockets(); tmp.load(d.rockets); this.rockets.rockets.push(...tmp.rockets); if (d.rockets.random) this.rockets.random.restore(d.rockets.random); }
    if (Array.isArray(d.fireballs) && d.fireballs.length) this.pendingFireballs = d.fireballs; // the mobs (its owners' world) are built after this object: restored on the first tick
  }
  restorePotions() {
    if (!this.pendingPotions || !this.sim.mobs) return;
    const rows = this.pendingPotions; this.pendingPotions = null;
    const lane = this.potionsOf(this); lane.load(rows);
    lane.projectiles.balls.forEach((b, i) => { const n = rows[i]?.by; b.ownerName = typeof n === 'string' && n.length <= 16 ? n : undefined; });
  }
  restoreFireballs() {
    if (!this.pendingFireballs) return;
    const list = this.pendingFireballs, mobs = this.dim ? this.dimState(this.dim)?.mobs?.mobs : this.sim.mobs?.mobs; // this dimension's own mobs only
    if (!mobs) return;
    this.pendingFireballs = null;
    mobs.fireballs.load(list, this.dim);
  }
  load(saved) {
    if (!saved || typeof saved !== 'object' || !saved.lanes) return;
    for (const [key, d] of Object.entries(saved.lanes)) {
      const dim = Number(key);
      if (!(dim === 0 || dim === -1 || dim === 1) || !d) continue; // the Overworld, the Nether (b62 lead: -1) and the End (b64 mpend2: 1)
      const lane = this.laneFor(dim), rows = Array.isArray(d.arrows) ? d.arrows : [], balls = Array.isArray(d.balls) ? d.balls : [], potions = Array.isArray(d.potions) ? d.potions : [];
      lane.arrows.load(rows); lane.balls.load(balls);
      if (lane === this && !this.sim.mobs) this.pendingPotions = potions; // b63: the server's mobs (the potions' world) do not exist yet while the simulation builds this object; restorePotions runs on the first tick
      else this.potionsOf(lane).load(potions);
      if (lane.restoreExtras) lane.restoreExtras(d); else lane.pending = d; // b63: a stand-in lane keeps them for the dimension's instance (adopt)
      const name = (row) => (typeof row?.by === 'string' && row.by.length <= 16 ? row.by : undefined);
      lane.arrows.list.forEach((a, i) => { a.ownerName = name(rows[i]); if (a.ownerName) a.shooter = 'player'; });
      lane.balls.balls.forEach((b, i) => { b.ownerName = name(balls[i]); });
      if (lane.potions) lane.potions.projectiles.balls.forEach((b, i) => { b.ownerName = name(potions[i]); });
    }
  }
}
// b62 lead: the dimension's instance (built with the Nether) takes over the stand-in lane a save left (`extra`).
ServerDispense.prototype.adopt = function (inst) {
  const dim = inst.dim | 0, lane = this.extra.get(dim);
  if (!lane || inst === this) return;
  this.extra.delete(dim);
  inst.arrows.list.push(...lane.arrows.list); inst.balls.balls.push(...lane.balls.balls);
  if (lane.potions) inst.potionsOf(inst).projectiles.balls.push(...lane.potions.projectiles.balls);
  if (lane.pending) inst.restoreExtras(lane.pending); // b63: its saved TNT, rockets and fireballs
};
const laneBusy = lane => lane.arrows.list.length + lane.balls.balls.length + (lane.potions?.projectiles.balls.length ?? 0) > 0;
