// Minecraft Java 1.7.10 EntityVillager (yv) without trading: size, attributes, professions and
// textures, sounds, the AI task list and the villager's own AI tick. Checked against the
// unchanged classes by tools/probes/VillagerProbe.java (tools/verify-villager.mjs,
// public/research/villager-reference.json); see public/research/villager.md for what runs.
//
// The task classes need ai.js's Task, Swim, Wander and WatchClosest, and ai.js imports this file,
// so `buildVillagerTasks` receives them instead of importing them (no import cycle).
import { WOODEN_DOOR } from "./world.js";
import { homeFilter, setHomeArea, detachHome } from "./home-area.js";
import { villageTasks, nearestVillage, villagerParticles } from "./village-ai.js";
import { setDoorOpen, doorSound } from "./doors-panes.js";
import { generateVillagerOffers } from "./villager-offers.js";
import { sameTrade, isOfferDisabled, increaseMaxUses, persistOffer, restoreOffer } from "./villager-trading.js";
const f = Math.fround;
const REGENERATION = 10;

// EntityVillager constructor (yv): setSize(0.6F, 1.8F); applyEntityAttributes keeps EntityLiving's 20
// health and the movementSpeed 0.5 base (yv.aD); followRange 16 is EntityLiving's default.
export const VILLAGER = Object.freeze({ health: 20, width: f(0.6), height: f(1.8), movement: 0.5, followRange: 16, talkInterval: 80 });
// ENTITY_TYPES entry: EntityAIWander speed 0.6 (the other speeds live in the task list below).
export const VILLAGER_TYPE = { health: VILLAGER.health, width: VILLAGER.width, height: VILLAGER.height, movement: VILLAGER.movement, ai: { wander: 0.6 }, drop: 0 };
export const VILLAGER_SOUNDS = Object.freeze({ idle: "mob.villager.idle", hit: "mob.villager.hit", death: "mob.villager.death", haggle: "mob.villager.haggle", yes: "mob.villager.yes", no: "mob.villager.no" });

// EntityVillager.getTexture (RenderVillager.func_110775_a): profession 0 farmer, 1 librarian, 2 priest,
// 3 smith, 4 butcher; any other id (a registry profession no mod here adds) draws villager.png.
export const PROFESSIONS = ["farmer", "librarian", "priest", "smith", "butcher"];
const DIRECTORY = "/media/1.7.10/entity/villager/";
export const DEFAULT_TEXTURE = DIRECTORY + "villager.png";
export const villagerTexture = (profession) => (Number.isInteger(profession) && PROFESSIONS[profession] ? DIRECTORY + PROFESSIONS[profession] + ".png" : DEFAULT_TEXTURE);
// readEntityFromNBT keeps any int; this build keeps the five textured professions and, for a larger
// id, the number (drawn with villager.png). Not-a-number reads as 0 (the default of getInteger).
export const readProfession = (v) => (Number.isInteger(v) && v >= 0 && v <= 0x7fffffff ? v : 0);
export const readRiches = (v) => (Number.isInteger(v) && v >= 0 && v <= 0x7fffffff ? v : 0);
// The fields a villager adds to an entity record (yv.b/a(NBT) save Profession, Riches and the Offers
// list). `offers` is null until getRecipes first runs (native bu == null); recipes keep original 1.7.10
// item ids (villager-trading.js shape). timeUntilReset (bv), needsInitilization (bw) and lastBuyingPlayer
// (by) are not saved by 1.7.10; `customer` (bt) is a transient flag for the one local player.
export const villagerFields = (profession = 0, riches = 0, offers = null) => ({ profession: readProfession(profession), riches: readRiches(riches), offers: readOffers(offers), timeUntilReset: 0, needsInit: false, lastBuyer: null, customer: false, home: null, homeRadius: -1, mating: false, playing: false });
// MerchantRecipeList(NBTTagCompound) keeps every readable recipe; a bad one is skipped here instead of
// failing the world. Anything that is not a list is "no Offers tag".
export function readOffers(saved) {
  if (!Array.isArray(saved)) return null;
  const out = [];
  for (const r of saved.slice(0, 256)) {
    try {
      out.push(restoreOffer(r));
    } catch {
      /* unreadable recipe: skipped */
    }
  }
  return out;
}
export const writeOffers = (offers) => (Array.isArray(offers) ? offers.map(persistOffer) : null);
// EntityVillager.isTrading (cc): a customer is set.
export const isTrading = (e) => !!e.customer;

// The native task list in order (priority, class, mutex bits), `live` meaning this build runs it. The
// inert tasks all depend on a VillageCollection (doors, golems, mating, play) or a trading player.
export const VILLAGER_TASKS = [
  { priority: 0, name: "EntityAISwimming", mutex: 4, live: true },
  { priority: 1, name: "EntityAIAvoidEntity", mutex: 1, live: true },
  { priority: 1, name: "EntityAITradePlayer", mutex: 5, live: true },
  { priority: 1, name: "EntityAILookAtTradePlayer", mutex: 2, live: true },
  { priority: 2, name: "EntityAIMoveIndoors", mutex: 1, live: true },
  { priority: 3, name: "EntityAIRestrictOpenDoor", mutex: 0, live: true },
  { priority: 4, name: "EntityAIOpenDoor", mutex: 0, live: true },
  { priority: 5, name: "EntityAIMoveTowardsRestriction", mutex: 1, live: true },
  { priority: 6, name: "EntityAIVillagerMate", mutex: 3, live: true },
  { priority: 7, name: "EntityAIFollowGolem", mutex: 3, live: true },
  { priority: 8, name: "EntityAIPlay", mutex: 1, live: true },
  { priority: 9, name: "EntityAIWatchClosest2", mutex: 3, live: true },
  { priority: 9, name: "EntityAIWatchClosest2", mutex: 3, live: true },
  { priority: 9, name: "EntityAIWander", mutex: 1, live: true },
  { priority: 10, name: "EntityAIWatchClosest", mutex: 2, live: true },
];

// A Vec3 in the direction away from `from`, or null (RandomPositionGenerator.findRandomTargetBlockAwayFrom,
// vx.b -> vx.c with a direction): ten random offsets in the box, those pointing against the away
// direction skipped after their three draws, the one with the best path weight kept. No home area.
export function findRandomTargetAwayFrom(m, xz, yz, from) {
  const r = m.rand, ax = m.x - from.x, az = m.z - from.z, keep = homeFilter(m.e, xz);
  let found = false, best = f(-99999), bx = 0, by = 0, bz = 0;
  for (let i = 0; i < 10; i++) {
    const dx = r.nextInt(2 * xz) - xz, dy = r.nextInt(2 * yz) - yz, dz = r.nextInt(2 * xz) - xz;
    if (dx * ax + dz * az < 0) continue;
    const x = dx + Math.floor(m.x), y = dy + Math.floor(m.y), z = dz + Math.floor(m.z);
    if (keep && !keep(x, y, z)) continue;
    const w = m.getBlockPathWeight(x, y, z);
    if (w > best) {
      best = w;
      bx = x;
      by = y;
      bz = z;
      found = true;
    }
  }
  return found ? { x: bx, y: by, z: bz } : null;
}

// EntityAIAvoidEntity (tw) for zombies: the first living zombie the villager can see within the box grown by
// (8, 3, 8) makes it run for a spot away from it (findRandomTarget 16 x 7); it keeps running while its path
// lasts, at 0.6 whether near (under 7 blocks) or far.
function avoidEntityClass(Task) {
  return class AvoidEntity extends Task {
    constructor(m, distance, farSpeed, nearSpeed) {
      super();
      this.m = m;
      this.distance = f(distance);
      this.farSpeed = farSpeed;
      this.nearSpeed = nearSpeed;
      this.mutex = 1;
      this.threat = null;
      this.path = null;
    }
    shouldExecute() {
      const m = this.m, d = this.distance;
      const [threat] = m.nearby(d, 3, d, (b) => b.e.type === "zombie" && b.alive && m.canSee(b));
      if (!threat) return false;
      this.threat = threat;
      const spot = findRandomTargetAwayFrom(m, 16, 7, threat);
      if (!spot) return false;
      // The spot must not be nearer the zombie than the villager is.
      const dx = threat.x - spot.x, dy = threat.y - spot.y, dz = threat.z - spot.z;
      if (dx * dx + dy * dy + dz * dz < m.distSq(threat)) return false;
      this.path = m.navigator.getPathToXYZ(spot.x, spot.y, spot.z);
      return !!this.path && this.path.isDestinationSame(spot);
    }
    continueExecuting() {
      return !this.m.navigator.noPath();
    }
    startExecuting() {
      this.m.navigator.setPath(this.path, this.farSpeed);
    }
    resetTask() {
      this.threat = null;
    }
    updateTask() {
      this.m.navigator.speed = this.m.distSq(this.threat) < 49 ? this.nearSpeed : this.farSpeed;
    }
  };
}

// EntityAIDoorInteract (uc) as EntityAIOpenDoor (uy, closes behind it) for the villager: after a horizontal
// collision, a wooden door within 1.5 blocks of the next two path points (or at the villager's own
// cell) opens at once and stays open for 20 ticks, then closes. uy.c() never calls uc.c(), so the
// "walked past" test of uc.e() never trips (its direction fields stay 0): only the 20 ticks end it.
function openDoorClass(Task) {
  return class OpenDoor extends Task {
    constructor(m, close) {
      super();
      this.m = m;
      this.close = close;
      this.mutex = 0;
      this.timer = 0;
      this.door = null;
    }
    doorAt(x, y, z) {
      return this.m.ai.world.get(x, y, z) === WOODEN_DOOR ? { x, y, z } : null;
    }
    shouldExecute() {
      const m = this.m, e = m.e, nav = m.navigator, path = nav.getPath();
      if (!e.collidedH || !path || path.isFinished() || !nav.canPassClosedDoors) return false;
      for (let i = 0; i < Math.min(path.index + 2, path.length); i++) {
        const p = path.getPathPointFromIndex(i), y = p.y + 1, dx = p.x - m.x, dy = m.y - m.y, dz = p.z - m.z;
        if (dx * dx + dy * dy + dz * dz <= 2.25 && (this.door = this.doorAt(p.x, y, p.z))) return true;
      }
      this.door = this.doorAt(Math.floor(m.x), Math.floor(m.y + 1), Math.floor(m.z));
      return !!this.door;
    }
    continueExecuting() {
      return this.close && this.timer > 0;
    }
    startExecuting() {
      this.timer = 20;
      this.swing(true);
    }
    resetTask() {
      if (this.close) this.swing(false);
    }
    updateTask() {
      this.timer--;
    }
    // BlockDoor.func_150014_a: the lower half's open bit, then aux effect 1003 where the door changed.
    swing(open) {
      const { x, y, z } = this.door, ew = this.m.ai.ew, world = this.m.ai.world;
      if (!setDoorOpen(world, x, y, z, open)) return;
      const low = (world.getMeta(x, y, z) & 8) !== 0 ? y - 1 : y, s = doorSound(ew.random);
      ew.events.push({ sound: s.event, volume: s.volume, pitch: s.pitch, position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, doorUpdate: [[x, low, z], [x, low + 1, z]] });
    }
  };
}

// EntityAITradePlayer (vl), mutex 5: while the villager has a customer with a screen open (a customer flag
// here), is alive, out of water, on the ground and within 4 blocks of the player, it stands still (the
// path is cleared); once any of that fails the customer is released (the screen itself stays open).
function tradePlayerClass(Task) {
  return class TradePlayer extends Task {
    constructor(m) {
      super();
      this.m = m;
      this.mutex = 5;
    }
    shouldExecute() {
      const m = this.m, e = m.e, p = m.ai.player;
      if (!(e.health > 0) || e.inWater || !e.onGround || e.velocityChanged || !e.customer || !p) return false;
      return m.distSq(p) <= 16;
    }
    startExecuting() {
      this.m.navigator.clearPathEntity();
    }
    resetTask() {
      villagerClearCustomer(this.m.e);
    }
  };
}
// EntityAILookAtTradePlayer (uo, an EntityAIWatchClosest2 of the customer, range 8): while trading it looks at
// the player; nothing is drawn from Random.
function lookAtTradePlayerClass(Task) {
  return class LookAtTradePlayer extends Task {
    constructor(m) {
      super();
      this.m = m;
      this.mutex = 2;
      this.target = null;
      this.timer = 0;
    }
    shouldExecute() {
      if (!isTrading(this.m.e)) return false;
      this.target = this.m.ai.player ?? null;
      return !!this.target;
    }
    continueExecuting() {
      const m = this.m;
      return isTrading(m.e) && !!this.target && m.distSq(this.target) <= f(8 * 8);
    }
    startExecuting() {
      this.timer = 0;
    }
    resetTask() {
      this.target = null;
    }
    updateTask() {
      const m = this.m, t = this.target;
      m.lookHelper.setLookPosition(t.x, t.y + t.eyeHeight, t.z, 10, m.verticalFaceSpeed);
    }
  };
}

// EntityVillager (yv) task list, in registration order. `K` is { Task, Swim, Wander, WatchClosest } from ai.js.
// Tasks that cannot run without a village, a golem or a trader are left out (VILLAGER_TASKS marks them).
export function buildVillagerTasks(m, K) {
  const AvoidEntity = avoidEntityClass(K.Task), OpenDoor = openDoorClass(K.Task), TradePlayer = tradePlayerClass(K.Task), LookAtTrade = lookAtTradePlayerClass(K.Task);
  const { MoveIndoors, RestrictOpenDoor, MoveTowardsRestriction, VillagerMate, FollowGolem, Play } = villageTasks(K);
  const watch = (range, chance) => Object.assign(new K.WatchClosest(m, range), { chance: f(chance), mutex: 3 });
  m.navigator.setBreakDoors(true);
  m.navigator.setAvoidsWater(true);
  m.tasks.add(0, new K.Swim(m));
  m.tasks.add(1, new AvoidEntity(m, 8, 0.6, 0.6));
  m.tasks.add(1, new TradePlayer(m));
  m.tasks.add(1, new LookAtTrade(m));
  m.tasks.add(2, new MoveIndoors(m));
  m.tasks.add(3, new RestrictOpenDoor(m));
  m.tasks.add(4, new OpenDoor(m, true));
  m.tasks.add(5, new MoveTowardsRestriction(m, 0.6));
  m.tasks.add(6, new VillagerMate(m));
  m.tasks.add(7, new FollowGolem(m));
  m.tasks.add(8, new Play(m, 0.32));
  m.tasks.add(9, watch(3, 1));
  m.tasks.add(9, watch(5, 0.02));
  m.tasks.add(9, new K.Wander(m, m.ai.types.villager.ai.wander));
  m.tasks.add(10, new K.WatchClosest(m, 8));
}

// EntityVillager.updateAITick (yv.bp), run after the navigator: every 70 + nextInt(50) ticks (the counter
// starts at 0, so on the first tick) it registers its position with the VillageCollection and looks for a
// village within 32 blocks; none exists here, so it detaches its home (a no-op). Only the draw is kept.
export function updateVillagerAI(m) {
  if (--m.randomTickDivider <= 0) {
    const ew = m.ai.ew, x = Math.floor(m.x), y = Math.floor(m.y), z = Math.floor(m.z);
    ew.villages?.addVillagerPosition(x, y, z);
    m.randomTickDivider = 70 + m.rand.nextInt(50);
    m.village = nearestVillage(m, 32);
    if (!m.village) detachHome(m.e);
    else {
      const [cx, cy, cz] = m.village.center;
      setHomeArea(m.e, cx, cy, cz, Math.trunc(Math.fround(m.village.radius * Math.fround(0.6))));
    }
  }
  tickVillagerRestock(m);
}

// --- Trading (EntityVillager yv: interact a(yz), getRecipes b(yz), useRecipe a(agn), a_(add), updateAITick bp) ---
// `m` is the villager's Brain (ai.js): its entity record `m.e`, its Entity.rand `m.rand` and `m.ai.ew.events`.
// Verified against the unchanged classes by tools/probes/VillagerTradeLiveProbe.java (villager-trading-live.md).

// EntityLiving.playSound(name, getSoundVolume(), getSoundPitch()): volume 1, pitch (rand - rand) * 0.2 + 1
// (1.5 for a child). The two nextFloat draws come from Entity.rand like every other villager sound.
export function villagerSound(m, sound) {
  const e = m.e, pitch = f(f(f(m.rand.nextFloat() - m.rand.nextFloat()) * f(0.2)) + ((e.growingAge ?? 0) < 0 ? f(1.5) : 1));
  m.ai.ew.events.push({ sound, volume: 1, pitch, position: { x: e.x, y: e.y, z: e.z } });
}
// EntityVillager.t(count) (addDefaultEquipmentAndRecipies): the entity's own Random drives the recipe
// rolls; offers are added to the existing list.
export function addDefaultOffers(m, count = 1) {
  m.e.offers = generateVillagerOffers(m.e.profession ?? 0, m.rand, { maxNewOffers: count, existing: m.e.offers ?? [], anyProfession: true, shuffleRandom: m.shuffleRandom });
  return m.e.offers;
}
// EntityVillager.b(EntityPlayer) (getRecipes): offers are generated on first access.
export function villagerOffers(m) {
  if (!m.e.offers) addDefaultOffers(m, 1);
  return m.e.offers;
}
// EntityVillager.a(EntityPlayer) (interact): an adult living villager that is not already trading, with
// no spawn egg in hand, takes the player as its customer and the caller opens the merchant screen.
// (Anything else falls to EntityCreature/EntityLiving.interact, which does nothing here.)
export function villagerInteract(m, holdingSpawnEgg = false, playerName = "Player") {
  const e = m.e;
  if (holdingSpawnEgg || !(e.health > 0) || isTrading(e) || (e.growingAge ?? 0) < 0) return false;
  e.customer = true;
  e.customerName = playerName;
  return true;
}
// EntityVillager.a_(EntityPlayer) with null: the screen closed or the trade AI gave up.
export function villagerClearCustomer(e) {
  e.customer = false;
}
// EntityVillager.a(MerchantRecipe) (useRecipe).
export function villagerUseRecipe(m, recipe) {
  const e = m.e, offers = e.offers;
  recipe.uses++;
  e.livingSoundTime = -VILLAGER.talkInterval;
  villagerSound(m, VILLAGER_SOUNDS.yes);
  if (sameTrade(recipe, offers[offers.length - 1])) {
    e.timeUntilReset = 40;
    e.needsInit = true;
    e.lastBuyer = e.customer ? e.customerName ?? null : null;
  }
  if (recipe.buy.id === 388) e.riches = readRiches((e.riches ?? 0) + recipe.buy.count);
}
// EntityVillager.a_(ItemStack) (func_110297_a_), called whenever the merchant inventory recalculates:
// at most once every 20 ticks of the living-sound counter, "yes" when a result shows and "no" otherwise.
export function villagerHover(m, hasResult) {
  const e = m.e, t = e.livingSoundTime ?? 0;
  if (t > -VILLAGER.talkInterval + 20) {
    e.livingSoundTime = -VILLAGER.talkInterval;
    villagerSound(m, hasResult ? VILLAGER_SOUNDS.yes : VILLAGER_SOUNDS.no);
  }
}
// The restock half of EntityVillager.updateAITick: while nobody is trading, timeUntilReset counts down;
// at 0 a flagged villager raises the maximum uses of every spent recipe (when it has more than one
// recipe) by rand(6) + rand(6) + 2, adds one more default offer, and either way gains Regeneration for
// 200 ticks. Village reputation (villageObj.setReputationForPlayer) is not ported: no VillageCollection.
export function tickVillagerRestock(m) {
  const e = m.e;
  if (isTrading(e) || !(e.timeUntilReset > 0)) return;
  if (--e.timeUntilReset > 0) return;
  if (e.needsInit) {
    if (e.offers.length > 1)
      for (const r of e.offers) if (isOfferDisabled(r)) increaseMaxUses(r, m.rand.nextInt(6) + m.rand.nextInt(6) + 2);
    addDefaultOffers(m, 1);
    e.needsInit = false;
    // The buyer who triggered the restock earns +1 reputation and a happy-villager burst (state 14).
    if (m.village && e.lastBuyer) {
      villagerParticles(m, "happyVillager");
      m.village.changeReputation(e.lastBuyer, 1);
    }
  }
  // EntityLivingBase.addPotionEffect(regeneration, 200, 0): mob-effects.js addMobEffect's combine rule
  // (mob-effects.js leads to entities.js, which imports this file, so the rule is repeated here).
  const list = (e.effects ??= []), old = list.find((x) => x.id === REGENERATION);
  if (!old) list.push({ id: REGENERATION, duration: 200, amplifier: 0 }), list.sort((a, b) => a.id - b.id);
  else if (old.amplifier === 0 && 200 > old.duration) old.duration = 200;
}
