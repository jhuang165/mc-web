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
import { tickPrimedTnt } from "./entity-simulation.js";
import { applyExplosion } from "./explosion-simulation.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { JavaRandom } from "./java-random.js";
import { EntityWorld, ENTITY_TYPES } from "./entities.js";
import { Survival } from "./survival.js";
import { WitchPotions } from "./witch-potions.js";
import { Arrows, arrowTargets } from "./bow.js";
import { Projectiles, mobTargets, thrownHit } from "./projectiles.js";
import { FireworkRockets } from "./fireworks-live.js";
import { Hanging, hangingArrowTargets } from "./hanging.js";
import { drainMobEvents } from "./living-simulation.js";
import { isWet, canSeeSky } from "./weather.js";
import { skylightSubtracted, celestialAngle } from "./lighting.js";
import { copyStack } from "./inventory.js";

// Cart kinds a headless run can tick (cart-variants.js TYPE): empty (0), chest (1), furnace (2), TNT (3), spawner (4) and hopper (5) carts.
// A spawner cart only moves: MobSpawnerBaseLogic needs a player within 16 blocks, so nothing spawns with nobody there. The hopper cart
// transfers through the run's Hoppers host. The command cart (6) needs the command interpreter and stays frozen as saved.
const CART_TYPES = new Set([0, 1, 2, 3, 4, 5]); // 6 (command cart) joins when the run has a command host (away-commands.js)
// Mobs the run leaves as saved: the dimension bosses, and anything riding, ridden, leashed or carrying the player.
const FROZEN_MOBS = new Set(["ender_dragon", "ender_crystal", "wither"]);
const PLAYER_FAR = 1e9; // the stand-in position of the absent player (never read as a target: `absent` and not alive)
const num = (v) => Number.isFinite(v);

export function awayEntities(plan, { world, ticking, rt, fire, weather, tiles, readStack, maxStack, transfer = null, sound = () => {}, light = null, runCommand = null }) {
  const e = plan.entities;
  if (!e) return null;
  const at = (r) => num(r?.x) && num(r?.z) && ticking(r.x, r.z);
  const split = (list) => { const inside = [], rest = []; for (const r of Array.isArray(list) ? list : []) (at(r) ? inside : rest).push(r); return { inside, rest }; };
  const ridden = new Set(plan.ridden ?? []);
  const seed = Number(BigInt.asUintN(32, BigInt(plan.editSequence | 0) * 40503n + BigInt(plan.ticks | 0)));
  const rng = new JavaRandom(BigInt(seed) * 2654435761n + 11n);
  const random = () => rng.nextDouble();

  const drops = split(e.drops), orbs = split(e.xpOrbs), tnt = split(e.tnt);
  const mobList = Array.isArray(e.mobs) ? e.mobs : [], mounts = new Set(mobList.map((m) => m?.riding).filter((r) => typeof r === "string"));
  // A lead whose other end is a knot in a ticked column runs (horse-gear-live.js recreates the knot from the record and the fence check keeps it);
  // a lead held by the player or another mob, or a lost lead, stays as saved.
  const leashOk = (m) => !m.leash || (!m.leash.holder && !m.leash.lost && [m.leash.knot?.x, m.leash.knot?.y, m.leash.knot?.z].every(Number.isInteger) && ticking(m.leash.knot.x, m.leash.knot.z));
  const simMob = (m) => m && at(m) && ENTITY_TYPES[m.type] && !FROZEN_MOBS.has(m.type) && !m.riding && !mounts.has(m.id) && leashOk(m) && !m.playerRides;
  const mobSplit = { inside: mobList.filter(simMob), rest: mobList.filter((m) => !simMob(m)) };
  const arrowSplit = split(e.arrows);
  const ballSplit = (() => { const inside = [], rest = []; for (const r of Array.isArray(e.projectiles) ? e.projectiles : []) (at(r) ? inside : rest).push(r); return { inside, rest }; })();
  const potionSplit = split(e.potions);
  const rocketList = Array.isArray(e.rockets?.rockets) ? e.rockets.rockets : [], rocketSplit = { inside: rocketList.filter(at), rest: rocketList.filter((r) => !at(r)) };
  const fireList = Array.isArray(e.fireballs) ? e.fireballs : [], fireIn = (r) => (r?.dimension ?? 0) === 0 && at(r);
  const hangList = Array.isArray(e.hanging) ? e.hanging : [], hangAt = (r) => num(r?.tx) && num(r?.tz) && ticking(r.tx, r.tz);
  const hangSplit = { inside: hangList.filter(hangAt), rest: hangList.filter((r) => !hangAt(r)) };
  const cartList = Array.isArray(e.minecarts?.carts) ? e.minecarts.carts : [], boatList = Array.isArray(e.boats) ? e.boats : [];
  const simCart = (c) => at(c) && (CART_TYPES.has(c.type) || (c.type === 6 && runCommand)) && !c.rider && !ridden.has(`cart-${c.id}`);
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
  const arrows = new Arrows(random), projectiles = new Projectiles(random), rockets = new FireworkRockets(new JavaRandom(BigInt(seed) * 40503n + 3n)), hanging = Hanging.fromJSON(hangSplit.inside);
  arrows.load(arrowSplit.inside); projectiles.load(ballSplit.inside);
  rockets.load({ rockets: rocketSplit.inside });
  arrows.wet = (a) => isWet(weather, world, { x: a.x, y: a.y, z: a.z, inWater: a.water }, 0.5);
  // The mobs: EntityWorld on the away world with no player. `absent` keeps despawnEntity out (ai.js); the survival has health 0, so the stand-in
  // player is not alive and is never a target, a push partner or a victim. `isActive` is the run's loaded area (the saved world is Superflat-shaped).
  const mobSv = new Survival({}, "survival");
  mobSv.health = 0;
  const player = { x: PLAYER_FAR, y: PLAYER_FAR, z: PLAYER_FAR };
  const mobs = new EntityWorld(world, mobSplit.inside, random);
  const mobTop = Math.max(0, ...mobList.map((m) => Number(String(m?.id).replace("mob-", "")) + 1).filter(num));
  mobs.nextId = Math.max(mobs.nextId, mobTop);
  mobs.ai.player.absent = true;
  if (Number.isInteger(plan.difficulty)) mobs.difficulty = plan.difficulty;
  let clock = Number.isFinite(plan.time) ? plan.time : 0;
  const subtracted = () => skylightSubtracted(celestialAngle(clock), weather.rainStrength(1), weather.weightedThunder(1));
  mobs.isActive = (m) => ticking(m.x, m.z);
  mobs.worldRandom = weather.random;
  mobs.wet = (m, height) => isWet(weather, world, m, height);
  mobs.isDaytime = () => subtracted() < 4;
  mobs.canSeeSky = (x, y, z) => canSeeSky(world, x, y, z);
  mobs.isRaining = () => weather.isRaining();
  mobs.isThundering = () => weather.isThundering();
  // The sky half is open sky less the skylight subtracted (no lateral sky light); spawning is off.
  // Block light (away-light.js) joins it: World.getBlockLightValue is the larger of the two (LightVolume.level).
  mobs.lightAt = (x, y, z) => Math.max(canSeeSky(world, x, y, z) ? Math.max(0, 15 - subtracted()) : 0, light ? light.blockAt(x, y, z) : 0);
  if (light) mobs.dimensionBlockLight = (x, y, z) => light.blockAt(x, y, z);
  mobs.shoot = (m, target, scale) => arrows.skeletonShoot(m, target, scale, mobs.difficulty);
  mobs.ignite = (x, y, z) => fire.ignite(x, y, z);
  mobs.potions = new WitchPotions(mobs, random);
  mobs.potions.load(potionSplit.inside);
  if (fireList.some(fireIn)) { const mine = fireList.filter(fireIn); mobs.fireballs.load(mine, 0); mobs.skulls.load(mine, 0); }
  if (e.villages) mobs.villages.loadJSON(e.villages);
  // EntityEnderPearl.onImpact (zm.a, bytecode-read): an entity hit takes thrown damage 0 from the thrower, 32 portal particles, and the teleport needs a
  // thrower that is an EntityPlayerMP in the pearl's own world (mw.o == this.o). The thrower is null (an unloaded save looks it up in a world with no
  // player) or the player in the Nether/End, so nothing teleports: the pearl just dies. The hit mob gets the same 0-damage hurt a snowball does.
  const pearlLands = ({ pearl, hit }) => { if (hit && hit !== "player") thrownHit(mobs, hit, pearl); pearl.dead = true; };
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
    // hanging entities, then carts and boats): mobs and their own projectiles, orbs, mob events, rockets, items, TNT, thrown projectiles,
    // arrows, hanging, carts, boats.
    tick() {
      mobSv.time = clock;
      if (mobs.entities.length || mobs.potions.balls.length || mobs._fireballs?.list.length || mobs._skulls?.list.length) { mobs.lootItems = items; mobs.tick(player, mobSv, 0); }
      xp.tick(world, null);
      drainMob();
      rockets.tick(world, {});
      items.tick(world, maxStack);
      tickPrimedTnt(world, primed, { explode: (x, y, z, power, ctx) => self.explode(x, y, z, power, { exploder: ctx.exploder }) });
      if (projectiles.balls.length) {
        projectiles.tick(world, mobTargets(mobs.entities, null), (ref, b) => ref !== "player" && thrownHit(mobs, ref, b), pearlLands);
        for (const h of projectiles.drain()) if (!h.sound) for (let i = 0; i < h.chicks; i++) mobs.hatch(h.x, h.y, h.z, h.yaw);
      }
      drainMob();
      if (arrows.list.length) {
        arrows.tick(world, { targets: [...arrowTargets(mobTargets(mobs.entities, null), true), ...hangingArrowTargets(hanging)], hanging, mobs, survival: mobSv, player: null,
          igniteTnt: (x, y, z, placer) => { primed.push(primeTnt(x + 0.5, y + 0.5, z + 0.5, { placer, random })); world.set(x, y, z, 0); rt.fluidChanges([[x, y, z, 46, 0]]); } });
        arrows.drain();
      }
      if (minecarts.carts.length) {
        minecarts.tick(world, { entities: [], host: cartHost });
        for (const d of minecarts.drain()) if (d.stack) self.spill(d.stack, d.x, d.posY, d.z, d.delay ?? 10);
      }
      if (boats.carts.length) {
        boats.tick(world, { entities: [], hooks: {} });
        for (const d of boats.drain()) if (d.stack) self.spill(d.stack, d.x, d.posY, d.z, d.delay ?? 10);
      }
      if (hanging.entities.length) {
        hanging.tick(world, { active: (h) => ticking(h.x, h.z) });
        for (const d of hanging.drain()) items.spawn(copyStack(d.stack), d.x, d.posY, d.z, { delay: d.delay });
      }
      drainMob();
      clock++;
    },
    close() { open = false; },
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
        counts: { items: items.items.length, orbs: xp.orbs.length, tnt: primed.length, carts: minecarts.carts.length, boats: boats.carts.length,
          mobs: mobs.entities.length, arrows: arrows.list.length, thrown: projectiles.balls.length, rockets: rockets.rockets.length, hanging: hanging.entities.length },
      };
    },
  };
  // EntityMinecartTNT and the furnace cart: the explosion; smoke and sounds are not drawn.
  const cartHost = { runCommand, explode: (cart, x, y, z, power) => { self.explode(x, y, z, power, {}); }, particle() {}, sound() {}, changed() {}, transfer };
  return self;
}
