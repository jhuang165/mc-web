// The entities of the Overworld's spawn area during an away run (batch 31, public/research/dimensions.md "Batch 31").
//
// Natively (WorldServer.updateEntities, mt.h: `P++ >= 1200` with an empty player list, `P` reset by mt.i while a player is present) entities
// and tile entities update for exactly 1200 ticks after the last player leaves. This runs the live item, experience orb, primed TNT,
// minecart and boat systems on the headless away world for those ticks. The saved records of entities that sit in a column the run did not
// load stay as they were (they are not in a loaded chunk). Nothing here is a new rule: ItemEntities, ExperienceOrbs, tickTnt, Minecarts,
// Boats and applyExplosion are the same modules the live game ticks.
//
// Batch 32 adds the mobs (EntityWorld with no player), arrows, thrown projectiles, rockets, potions, fireballs and hanging entities. With no
// player World.getClosestPlayerToEntity is null, so EntityLiving.despawnEntity does nothing (bytecode-read, sw.w: the whole distance block sits
// behind `player != null`): mobs run their AI and physics, take fall, fire, lava, drowning and explosion damage, and stay for as long as they
// live; their entityAge keeps counting, so EntityAIWander (which needs age < 100) stops after the first 100 ticks. Natural spawning, spawners
// and sieges need players and do not run.
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { primeTnt, TNT_Y_OFFSET } from "./explosion.js";
import { entityWalkers, watchJoin } from "./entity-simulation.js";
import { applyExplosion } from "./explosion-simulation.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { EntityPortals, entityDeparture } from "./entity-portal.js";
import { JavaRandom } from "./java-random.js";
import { EntityWorld, ENTITY_TYPES } from "./entities.js";
import { Survival } from "./survival.js";
import { WitchPotions } from "./witch-potions.js";
import { Arrows, arrowTargets } from "./bow.js";
import { Projectiles, mobTargets, thrownHit } from "./projectiles.js";
import { FireworkRockets } from "./fireworks-live.js";
import { Hanging, hangingArrowTargets } from "./hanging.js";
import { drainMobEvents, explodeEvent } from "./living-simulation.js";
import { isWet, canSeeSky } from "./weather.js";
import { skylightSubtracted, celestialAngle } from "./lighting.js";
import { copyStack } from "./inventory.js";
import { EntityIds } from "./entity-ids.js";
import { finishMinecartSimulation, finishBoatSimulation } from "./structure-simulation.js";
import { linkVehicleRiders } from "./vehicle-riders.js";

// Cart kinds a headless run can tick (cart-variants.js TYPE): empty (0), chest (1), furnace (2), TNT (3), spawner (4) and hopper (5) carts.
// A spawner cart only moves: MobSpawnerBaseLogic needs a player within 16 blocks, so nothing spawns with nobody there. The hopper cart
// transfers through the run's Hoppers host. The command cart (6) needs the command interpreter and stays frozen as saved.
const CART_TYPES = new Set([0, 1, 2, 3, 4, 5]); // 6 (command cart) joins when the run has a command host (away-commands.js)
// Mobs the run leaves as saved: the dimension bosses (and any unit with a member that is outside the loaded rule or whose lead holder is missing; see simMob).
const FROZEN_MOBS = new Set(["ender_dragon", "ender_crystal", "wither"]);
const PLAYER_FAR = 1e9; // the stand-in position of the absent player (never read as a target: `absent` and not alive)
const num = (v) => Number.isFinite(v);

export function awayEntities(plan, { world, ticking, entityTicks = ticking, rt, fire, weather, tiles, readStack, maxStack, transfer = null, sound = () => {}, light = null, runCommand = null }) {
  const e = plan.entities;
  if (!e) return null;
  // Entities update only where every chunk within 32 blocks is loaded (entityTicks, away-world.js); tile entities and block writes use `ticking`.
  const at = (r) => num(r?.x) && num(r?.z) && entityTicks(r.x, r.z);
  const split = (list) => { const inside = [], rest = []; for (const r of Array.isArray(list) ? list : []) (at(r) ? inside : rest).push(r); return { inside, rest }; };
  const seed = Number(BigInt.asUintN(32, BigInt(plan.editSequence | 0) * 40503n + BigInt(plan.ticks | 0)));
  const rng = new JavaRandom(BigInt(seed) * 2654435761n + 11n);
  const random = () => rng.nextDouble();

  const drops = split(e.drops), orbs = split(e.xpOrbs), tnt = split(e.tnt);
  const mobList = Array.isArray(e.mobs) ? e.mobs : [];
  const cartList = Array.isArray(e.minecarts?.carts) ? e.minecarts.carts : [], boatList = Array.isArray(e.boats) ? e.boats : [];
  // Batch 43: riders, mounts and leashed mobs tick as natively. World.updateEntities ticks a mount through updateEntityWithOptionalForce and the mount then updates its rider
  // (the rider's own list entry is skipped while it is mounted, bytecode-read), so a mounted pair is one unit: it runs when every member is in the 32-block rule and is
  // left as saved otherwise. Units are the connected sets of the saved `riding` links (mob -> mob, mob -> "cart-N" or "boat-N"). The player who rode a mob or cart when he left
  // is gone (his seat is empty natively), so `playerRides` and a cart's `rider: true` do not hold a unit back.
  const unit = new Map(), root = (k) => { while (unit.get(k) !== k) { unit.set(k, unit.get(unit.get(k))); k = unit.get(k); } return k; };
  const touch = (k) => { if (!unit.has(k)) unit.set(k, k); return k; };
  const join = (a, b) => unit.set(root(touch(a)), root(touch(b)));
  for (const m of mobList) if (m && typeof m.id === "string") { touch(m.id); if (typeof m.riding === "string") join(m.id, m.riding); }
  const leashHolderOf = (m) => (m.leash?.holder === "mob" && typeof m.leash.holderUuid === "string" ? mobList.find((o) => o?.uuid === m.leash.holderUuid) : null);
  for (const m of mobList) { const h = m && leashHolderOf(m); if (h && typeof m.id === "string" && typeof h.id === "string") join(m.id, h.id); }
  const cartOk = (c) => at(c) && (CART_TYPES.has(c.type) || (c.type === 6 && runCommand)), boatOk = (b) => at(b);
  // A lead to a knot runs when the knot's column ticks (horse-gear-live.js recreates the knot from the record and the fence check keeps it); a lead to the absent player
  // stays on (td.bL steps only when the holder is in the mob's own world, bytecode-read; away-entities sets `mobs.ai.player.absent`); a lost lead stays as saved.
  const leashOk = (m) => !m.leash || (!m.leash.lost && (m.leash.holder === "player" || (m.leash.holder === "mob" ? !!leashHolderOf(m) : [m.leash.knot?.x, m.leash.knot?.y, m.leash.knot?.z].every(Number.isInteger) && entityTicks(m.leash.knot.x, m.leash.knot.z))));
  const mobOk = (m) => m && at(m) && ENTITY_TYPES[m.type] && !FROZEN_MOBS.has(m.type) && leashOk(m);
  const bad = new Set(); // roots of units with a member that cannot run
  for (const m of mobList) if (m && typeof m.id === "string" && !mobOk(m)) bad.add(root(m.id));
  for (const m of mobList) if (m && typeof m.riding === "string" && /^(cart|boat)-/.test(m.riding)) {
    const v = (m.riding.startsWith("cart") ? cartList.find((c) => `cart-${c.id}` === m.riding) : boatList.find((b) => `boat-${b.id}` === m.riding));
    if (!v || !(m.riding.startsWith("cart") ? cartOk(v) : boatOk(v))) bad.add(root(m.id));
  }
  for (const m of mobList) if (m && typeof m.riding === "string" && !/^(cart|boat)-/.test(m.riding) && !mobList.some((o) => o?.id === m.riding)) bad.add(root(m.id)); // a mount the list does not hold
  const simMob = (m) => !!m && (typeof m.id !== "string" || !bad.has(root(m.id))) && mobOk(m);
  const mobSplit = { inside: mobList.filter(simMob), rest: mobList.filter((m) => !simMob(m)) };
  const simVehicle = (key, ok) => ok && !(unit.has(key) && bad.has(root(key)));
  const arrowSplit = split(e.arrows);
  const ballSplit = (() => { const inside = [], rest = []; for (const r of Array.isArray(e.projectiles) ? e.projectiles : []) (at(r) ? inside : rest).push(r); return { inside, rest }; })();
  const potionSplit = split(e.potions);
  const rocketList = Array.isArray(e.rockets?.rockets) ? e.rockets.rockets : [], rocketSplit = { inside: rocketList.filter(at), rest: rocketList.filter((r) => !at(r)) };
  const fireList = Array.isArray(e.fireballs) ? e.fireballs : [], fireIn = (r) => (r?.dimension ?? 0) === 0 && at(r);
  const hangList = Array.isArray(e.hanging) ? e.hanging : [], hangAt = (r) => (num(r?.x) && num(r?.z) ? entityTicks(r.x, r.z) : num(r?.tx) && num(r?.tz) && entityTicks(r.tx, r.tz)); // the rule reads posX/posZ, which sit up to 0.5625 off the tile (EntityHanging.func_82330_g)
  const hangSplit = { inside: hangList.filter(hangAt), rest: hangList.filter((r) => !hangAt(r)) };
  const simCart = (c) => simVehicle(`cart-${c.id}`, cartOk(c));
  const simBoat = (b) => simVehicle(`boat-${b.id}`, boatOk(b));
  const carts = { inside: cartList.filter(simCart), rest: cartList.filter((c) => !simCart(c)) };
  const boatsSplit = { inside: boatList.filter(simBoat), rest: boatList.filter((b) => !simBoat(b)) };

  // One Entity.nextEntityID for every list of the run, starting above the live counter (plan.idBase: the next free id of the page, set by finishAway) and above every id in the saved lists.
  const ids = new EntityIds(Math.max(plan.idBase ?? 1, 1 + Math.max(0, ...[mobList, cartList, boatList, hangList].flatMap((l) => (Array.isArray(l) ? l : []).map((r) => (typeof r?.id === "string" ? Number(r.id.replace("mob-", "")) : r?.id | 0)).filter(num)))));
  const items = new ItemEntities(random);
  items.load(drops.inside, readStack, 0);
  const xp = new ExperienceOrbs(orbs.inside, random, ids);
  const primed = tnt.inside.filter((t) => [t.x, t.y, t.z, t.vx, t.vy, t.vz, t.fuse].every(num))
    .map((t) => Object.assign(primeTnt(t.x, t.y + TNT_Y_OFFSET, t.z, { fuse: t.fuse, random }), { vx: t.vx, vy: t.vy, vz: t.vz }));
  const minecarts = Minecarts.fromJSON({ version: 1, carts: carts.inside }, { ids });
  const boats = Boats.fromJSON(boatsSplit.inside, { ids });
  minecarts.blockHook = (x, y, z) => { rt.redstone.collide(x, y, z); rt.flush(); };
  const arrows = new Arrows(random), projectiles = new Projectiles(random), rockets = new FireworkRockets(new JavaRandom(BigInt(seed) * 40503n + 3n)), hanging = Hanging.fromJSON(hangSplit.inside, { ids });
  arrows.load(arrowSplit.inside); projectiles.load(ballSplit.inside);
  rockets.load({ rockets: rocketSplit.inside });
  arrows.wet = (a) => isWet(weather, world, { x: a.x, y: a.y, z: a.z, inWater: a.water }, 0.5);
  // The mobs: EntityWorld on the away world with no player. `absent` keeps despawnEntity out (ai.js); the survival has health 0, so the stand-in
  // player is not alive and is never a target, a push partner or a victim. `isActive` is the run's loaded area (the saved world is Superflat-shaped).
  const player = { x: PLAYER_FAR, y: PLAYER_FAR, z: PLAYER_FAR };
  const mobSv = new Survival({}, "survival");
  mobSv.health = 0;
  const mobs = new EntityWorld(world, mobSplit.inside, random, ids);
  mobs.ai.player.absent = true;
  mobs.explodeInline = (ev) => explodeEvent(ev, (x, y, z, size, opts) => self.explode(x, y, z, size, opts)); // a creeper explodes inside its own update (entities.js)
  linkVehicleRiders(mobs.entities, boats.carts, minecarts.carts, (m) => mobs.size(m)[1]); // mobs saved riding a boat or cart (main.js does the same on load)
  if (Number.isInteger(plan.difficulty)) mobs.difficulty = plan.difficulty;
  let clock = Number.isFinite(plan.time) ? plan.time : 0;
  const subtracted = () => skylightSubtracted(celestialAngle(clock), weather.rainStrength(1), weather.weightedThunder(1));
  mobs.isActive = (m) => entityTicks(m.x, m.z); // World.updateEntityWithOptionalForce, re-read every tick: a mob that walks to the edge stops
  mobs.worldRandom = weather.random;
  mobs.wet = (m, height) => isWet(weather, world, m, height);
  mobs.isDaytime = () => subtracted() < 4;
  mobs.canSeeSky = (x, y, z) => canSeeSky(world, x, y, z);
  mobs.isRaining = () => weather.isRaining();
  mobs.isThundering = () => weather.isThundering();
  // Spawning is off.
  // Block light (away-light.js) joins it: World.getBlockLightValue is the larger of the two (LightVolume.level).
  // Batch 35: the sky half is the run's sky volume (light under cover, away-light.js skyAt) less the darkening; a column the run did not hold falls back to open sky.
  const skyHalf = (x, y, z) => { const raw = light?.skyAt(x, y, z); return Math.max(0, (raw ?? (canSeeSky(world, x, y, z) ? 15 : 0)) - subtracted()); };
  mobs.lightAt = (x, y, z) => Math.max(skyHalf(x, y, z), light ? light.blockAt(x, y, z) : 0);
  if (light) mobs.dimensionBlockLight = (x, y, z) => light.blockAt(x, y, z);
  mobs.shoot = (m, target, scale) => arrows.skeletonShoot(m, target, scale, mobs.difficulty);
  mobs.ignite = (x, y, z) => fire.ignite(x, y, z);
  mobs.potions = new WitchPotions(mobs, random);
  mobs.potions.load(potionSplit.inside);
  // Batch 45: World.updateEntities walks ONE loadedEntityList. The run now ticks items, orbs, TNT, thrown entities, arrows, falling blocks, witch potions, snow golem balls,
  // wither skulls and leash knots in the mobs' own walk (EntityWorld.tickMobs, the entityWalkers of entity-simulation.js the live game uses), in join order, instead of one
  // system after another. Batch 46 adds carts, boats, hanging entities and rockets (a mob rider follows its mount in the list). Each walked
  // entity keeps the 32-block rule (`entityTicks`), read at its place in the list. Spawns during the pass join the end of the list through `joined` stamps, as in main.js.
  // Batch 46: carts, boats, hanging entities and rockets join it. The player is absent: `alive: false` keeps him out of the vehicles' blockers and pushes, and `position` is the far
  // stand-in (an orb or potion sees nobody near).
  const walkState = { world, items, primed, projectiles, arrows, mobs, xpOrbs: xp, survival: mobSv, position: player, minecarts, boats, hanging, velocity: { x: 0, y: 0, z: 0 }, rider: null, alive: false, width: 0.6, height: 1.8,
    get falling() { return self.falling; } };
  const cartHost = { runCommand, explode: (cart, x, y, z, power) => { self.explode(x, y, z, power, {}); }, particle() {}, sound() {}, changed() {}, transfer };
  const dropVehicle = (d) => { if (d.stack) self.spill(d.stack, d.x, d.posY, d.z, d.delay ?? 10); };
  const walkHooks = {
    maxStack, explodeTnt: (x, y, z, power, ctx) => self.explode(x, y, z, power, { exploder: ctx.exploder }),
    arrowOptions: () => ({ targets: [...arrowTargets(mobTargets(mobs.entities, null), true), ...hangingArrowTargets(hanging)], hanging, mobs, survival: mobSv, player: null,
      igniteTnt: (x, y, z, placer) => { primed.push(primeTnt(x + 0.5, y + 0.5, z + 0.5, { placer, random })); world.set(x, y, z, 0); rt.fluidChanges([[x, y, z, 46, 0]]); } }),
    projectileTargets: () => mobTargets(mobs.entities, null), projectileHit: (ref, b) => ref !== "player" && thrownHit(mobs, ref, b), projectilePearlImpact: (hit) => pearlLands(hit),
    mobExplosion: (ev) => explodeEvent(ev, (...a) => self.explode(...a)),
    carts: { drop: dropVehicle, cartHost }, boats: { drop: dropVehicle }, hangingActive: (h) => entityTicks(h.x, h.z),
    hangingDrop: (d) => items.spawn(copyStack(d.stack), d.x, d.posY, d.z, { delay: d.delay }),
  };
  const walks = entityWalkers(() => ({ state: walkState, hooks: walkHooks }));
  // A firework rocket (EntityFireworkRocket) is a loaded entity too; the live game ticks it after the walk, the away run puts it at its join place.
  walks.set("rocket", { list: () => rockets.rockets, tick: (r) => rockets.tickOne(world, r, {}), reap: () => rockets.reap() });
  for (const [kind, w] of walks) {
    if (kind === "knot") continue; // a knot's own column check is in knotTickOne (horse-gear-live.js)
    const tick = w.tick;
    w.tick = (en) => { if (num(en?.x) && num(en?.z) && !entityTicks(en.x, en.z)) { stats.held++; return; } tick(en); };
  }
  mobs.walks = walks;
  minecarts.joined = (en) => mobs.joined(en, "cart"); boats.joined = (en) => mobs.joined(en, "boat"); hanging.joined = (en) => mobs.joined(en, "hanging"); rockets.joined = (en) => mobs.joined(en, "rocket");
  items.joined = (en) => mobs.joined(en, "item"); xp.joined = (en) => mobs.joined(en, "orb"); projectiles.joined = (en) => mobs.joined(en, "thrown"); arrows.joined = (en) => mobs.joined(en, "arrow");
  watchJoin(primed, (en) => mobs.joined(en, "tnt"));
  if (fireList.some(fireIn)) { const mine = fireList.filter(fireIn); mobs.fireballs.load(mine, 0); mobs.skulls.load(mine, 0); }
  if (e.villages) mobs.villages.loadJSON(e.villages);
  // EntityEnderPearl.onImpact (zm.a, bytecode-read): an entity hit takes thrown damage 0 from the thrower, 32 portal particles, and the teleport needs a
  // thrower that is an EntityPlayerMP in the pearl's own world (mw.o == this.o). The thrower is null (an unloaded save looks it up in a world with no
  // player) or the player in the Nether/End, so nothing teleports: the pearl just dies. The hit mob gets the same 0-damage hurt a snowball does.
  const pearlLands = ({ pearl, hit }) => { if (hit && hit !== "player") thrownHit(mobs, hit, pearl); pearl.dead = true; };
  // Batch 37: the 32-block rule is read every tick, as World.updateEntities does for every loaded entity (it calls updateEntityWithOptionalForce(e, true) each tick, bytecode-read),
  // not only for the position an entity had at departure. An entity that has moved to where a chunk within 32 blocks is not loaded keeps its place in its list and does not tick
  // (park takes it out of the list for the length of the system's tick and puts it back after the others). `obj[key]` is the list; it may be replaced by the system's tick.
  const park = (obj, key, fn) => {
    const list = obj[key];
    if (!list?.length) return fn();
    const frozen = list.filter((en) => !entityTicks(en.x, en.z));
    if (!frozen.length) return fn();
    const gone = new Set(frozen);
    obj[key] = list.filter((en) => !gone.has(en));
    stats.held += frozen.length;
    try { return fn(); } finally { obj[key] = [...obj[key], ...frozen]; }
  };
  const stats = { held: 0 };
  const primedList = { get list() { return primed; }, set list(v) { primed.splice(0, primed.length, ...v); } };
  const late = []; // spills after the gate: an item entity that would never tick, kept as a saved record
  let open = true;

  // Explosion.doExplosionA/B over the run's own entity systems (mobs, arrows, projectiles and hanging entities included).
  const survival = { health: 0, furnaces: tiles.furnaces, chests: tiles.chests, dispensers: tiles.dispensers, brewing: tiles.brewing, hoppers: tiles.hoppers };
  // drainMobEvents with the run's hooks: sounds, particles and block redraws are not drawn; deaths drop and give experience, mob explosions explode.
  const drainMob = () => {
    drainMobEvents({ mobs, xpOrbs: xp, items }, { explode: (x, y, z, size, opts) => self.explode(x, y, z, size, opts) });
    mobs.drainClientSounds();
    xp.sounds.splice(0); items.sounds?.splice(0);
  };
  const self = {
    items, xp, primed, minecarts, boats, mobs, arrows, projectiles, rockets, hanging, falling: null,
    explode(x, y, z, size, { exploder = null, attacker = null, smoking = true, flaming = false, blue = false } = {}) {
      const out = applyExplosion({ world, weather, mobs, items, xpOrbs: xp, arrows, projectiles, hanging, falling: self.falling, primed, survival,
        position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, farming: { observe() {} } },
      { x, y, z, size, exploder, attacker, smoking, flaming, blue }, { ignite: (fx, fy, fz) => fire.ignite(fx, fy, fz), sound });
      rt.fluidChanges(out.changes.filter((c) => c[4] === 0 && c[3] !== 0));
      return out;
    },
    // A drop or spill: a live item entity while the gate is open, a saved record once it is closed.
    spill(stack, x, y, z, delay = 10) {
      if (open) items.spawn(stack, x, y, z, { delay });
      else late.push({ stack: { ...stack }, x, y, z, age: 0, delay });
    },
    prime(x, y, z) { primed.push(primeTnt(x, y, z, { placer: null, random })); },
    // One game tick of the entity gate, in the order of the live player tick (living simulation, then the entity simulation, rockets and
    // hanging entities, then carts and boats) is now the one walk (batch 45, 46): every kind at its join place, then the post-walk drains and portal travel.
    tick() {
      mobSv.time = clock;
      // The one list walk: mobs, orbs, items, TNT, thrown entities, arrows, potions, balls and skulls in the order they joined (EntityWorld.tickMobs with `walks`).
      if (mobs.entities.length || mobs.potions.balls.length || mobs._fireballs?.list.length || mobs._skulls?.list.length || items.items.length || xp.orbs.length || primed.length || projectiles.balls.length || arrows.list.length || self.falling?.entities.length || minecarts.carts.length || boats.carts.length || hanging.entities.length || rockets.rockets.length) {
        mobs.lootItems = items;
        mobs.tick(player, mobSv, 0);
      }
      // After the walk (finishEntitySimulation without the player's part): mob events, thrown entities' events and their hatchlings, arrows' drains.
      drainMob();
      projectiles.tickEffects?.(world);
      for (const h of projectiles.drain()) if (!h.sound) for (let i = 0; i < h.chicks; i++) mobs.hatch(h.x, h.y, h.z, h.yaw);
      arrows.drain();
      drainMob();
      // Carts, boats, hanging entities and rockets ticked in the walk at their join place; what follows is the part of finishEntitySimulation they have (the passenger links, leftover drops).
      if (minecarts.carts.length) { finishMinecartSimulation(walkState, walkHooks.carts); portalTravel("cart", minecarts, minecarts.carts); }
      if (boats.carts.length) { finishBoatSimulation(walkState, walkHooks.boats); portalTravel("boat", boats, boats.carts); }
      for (const d of hanging.drain()) walkHooks.hangingDrop(d);
      drainMob();
      portalTravel("mob", mobs, mobs.entities);
      portalTravel("item", items, items.items);
      portalTravel("orb", xp, xp.orbs);
      tickNo++;
      clock++;
    },
    close() { open = false; },
    park, stats,
    shiftTime(d) { clock += d; }, // /time set or add by a command block
    // Every list in its saved form: the records outside the run unchanged, the run's entities serialized.
    finish() {
      return {
        drops: [...drops.rest, ...items.serialize(), ...late], xpOrbs: [...orbs.rest, ...xp.serialize()],
        tnt: [...tnt.rest, ...primed.map((t) => ({ x: t.x, y: t.y, z: t.z, vx: t.vx, vy: t.vy, vz: t.vz, fuse: t.fuse }))],
        minecarts: { version: 1, carts: [...carts.rest, ...(minecarts.carts.length ? minecarts.toJSON().carts : [])] },
        boats: [...boatsSplit.rest, ...(boats.carts.length ? boats.toJSON() : [])],
        mobs: [...mobSplit.rest, ...mobs.serialize()],
        arrows: [...arrowSplit.rest, ...arrows.serialize()], projectiles: [...ballSplit.rest, ...projectiles.serialize()],
        potions: [...potionSplit.rest, ...mobs.potions.serialize()],
        rockets: e.rockets || rockets.rockets.length ? { ...(e.rockets ?? {}), ...rockets.serialize(), rockets: [...rocketSplit.rest, ...rockets.serialize().rockets] } : null,
        fireballs: [...fireList.filter((r) => !fireIn(r)), ...(mobs._fireballs?.serialize(0) ?? []), ...(mobs._skulls?.serialize(0) ?? [])],
        hanging: [...hangSplit.rest, ...hanging.toJSON()],
        portalTravel: travellers,
        counts: { items: items.items.length, orbs: xp.orbs.length, tnt: primed.length, carts: minecarts.carts.length, boats: boats.carts.length,
          mobs: mobs.entities.length, arrows: arrows.list.length, thrown: projectiles.balls.length, rockets: rockets.rockets.length, hanging: hanging.entities.length, held: stats.held,
          // Batch 44: records outside the run (their column was not copied or the 32-block rule holds them): kept as saved, not ticked, so an entity absent from a delivery can be traced to it.
          outside: [drops, orbs, tnt, carts, boatsSplit, mobSplit, arrowSplit, ballSplit, potionSplit, rocketSplit, hangSplit].reduce((n, s) => n + s.rest.length, 0) },
      };
    },
  };
  // EntityMinecartTNT and the furnace cart: the explosion; smoke and sounds are not drawn.
  // Batch 38 (carts, boats) and 39 (mobs, items, orbs): the run's entities travel through the Overworld's portals as the live tick's do (entity-portal.js: Entity.onEntityUpdate and
  // the two cart/boat copies run the same portal block). A traveller leaves its list at once and is returned in finish().portalTravel with the run tick it left at; the main thread
  // (dimension-live.js finishAway) delivers it into the destination's inbox with the shared Teleporter when the player is back, at the total time of that tick.
  function portalTravel(kind, owner, list) {
    if (!list.length) return;
    const getId = (x, y, z) => world.get(x, y, z), vehicle = kind === "cart" || kind === "boat";
    let gone = null;
    for (const c of list) {
      if (c.dead) continue;
      // Entities outside the 32-block rule do not update (and so do not run Entity.onEntityUpdate's portal step); a mob with a rider or a vehicle is not a portal collider.
      if (!entityTicks(c.x, c.z)) continue;
      const riding = kind === "mob" && !!(c.rider || c.vehicle || c.ridingEntity || c.riddenBy);
      const r = portals.step(c, kind, { dim: 0, getId, riding, ridden: vehicle && !!(c.rider || c.passenger) });
      if (!r) continue;
      const d = entityDeparture(portals, kind, c, r, owner);
      // Live depart(): a mob that mounted the vehicle after the collision stays behind, unmounted (the copy is made from the vehicle's own NBT).
      if (vehicle && c.passenger) { if (c.passenger.ridingEntity === c) c.passenger.ridingEntity = null; c.passenger = null; }
      travellers.push({ kind, tick: tickNo, ...d, leashed: kind === "mob" && c.leash?.holder === "player" });
      (gone ??= new Set()).add(c);
    }
    if (gone) { const keep = list.filter((c) => !gone.has(c)); list.length = 0; list.push(...keep); }
  }
  let tickNo = 0;
  const portals = new EntityPortals(), travellers = [];
  return self;
}
