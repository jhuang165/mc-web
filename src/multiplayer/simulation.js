import { World, PHYSICS, WATER, LAVA, MOB_SPAWNER, raycast, collides } from '../world.js';
import { isFence } from '../fences.js'; // b62: the fence lead click
import { Survival, ITEMS } from '../survival.js';
import { PlayerMotion } from '../player-movement.js';
import { movePlayer } from '../player-physics.js';
import { Farming } from '../farming.js';
import { Fluids } from '../fluids.js';
import { Fire } from '../fire.js';
import { Weather, canLightningStrikeAt } from '../weather.js';
import { Trees } from '../trees.js';
import { Plants } from '../plants.js';
import { FallingBlocks } from '../falling.js';
import { Rails } from '../rails.js';
import { Torches } from '../torches.js';
import { Doors } from '../doors-panes.js';
import { Beds } from '../bed.js';
import { LiveRedstone } from '../redstone-live.js';
import { LightVolume, lightEmission, celestialAngle, skylightSubtracted } from '../lighting.js';
import { tickWorldSystems } from '../world-tick.js';
import { placeHeldBlock } from '../block-placement-simulation.js';
import { breakPlayerBlock } from '../block-break-simulation.js';
import { makeStack, copyStack } from '../inventory.js';
import { ItemEntities } from '../item-entities.js';
import { serverClick } from '../server-handlers.js';
import { Signs, ITEM_SIGN, SIGN_LINES, isSign, placeSign } from '../signs.js';
import { Skulls, SKULL, ITEM_SKULL, placeSkull } from '../skull.js';
import { Beacons, BEACON, pyramidLevel, applyBeaconPick, isPaymentItem } from '../pyramid.js';
import { tickBeacons } from '../pyramid-live.js';
import { canSeeSky } from '../weather.js';
import { MobSpawners } from '../mob-spawner.js';
import { describeTiles, describeCell } from '../tile-sync.js';
import { createServerDig } from '../server-dig.js';
import { eyeInWater } from '../fluids.js';
import { playerMiningState } from '../enchantment-effects.js';
import { BOW, canDraw } from '../bow.js';
import { JavaRandom } from '../java-random.js';
import { ServerSurvival, vitalsOf } from './server-survival.js';
import { ServerItems } from './server-items.js';
import { ServerAchievements } from './server-achievements.js';
import { ServerWither } from './server-wither.js'; // b63 mpwither
import { ServerContainers } from './server-containers.js';
import { ContainerTicks } from './server-container-ticks.js';
import { ServerMobs } from './server-mobs.js';
import { ServerLeads } from './server-leads.js'; // b62
import { ServerVehicles } from './server-vehicles.js'; // b61: minecarts, boats and riding
import { ServerProjectiles } from './server-projectiles.js'; // b62: the one projectile system (dispensers, skeletons, witches, players' bows and throws)
import { ServerDimensions } from './server-dimensions.js'; // b61 mpnether: the Nether, portals and the world swap (server-dimensions.js)
import { IDLE_INPUT, cleanInput, cleanLook, validName, encodeColumn, splitChanges } from './protocol.js';

const noop = () => {};
// What a server-side survival break needs from the world around it. Item entities are real (`itemHost`); the dedicated world has no experience orbs.
// EntityPlayer.itemInUse, by the held item's EnumAction: swords block (ItemSword, 72000 ticks), the bow draws until released, food eats and a milk bucket
// drinks for 32 ticks (this build has no potion items). The pose a remote client draws comes from the held stack, as natively (the flag is only "using", watcher 0 bit 4).
const MILK_BUCKET = 343, USE_TICKS = 32;
// EntityPlayer.updateItemUse(stack, n) on the server: Entity.rand takes the crumb loop's three draws per crumb (the particles go nowhere on a WorldServer), then
// food plays random.eat (volume 0.5 + 0.5 * nextInt(2), pitch (f - f) * 0.2 + 1) and a drink random.drink (world rand, pitch f * 0.1 + 0.9), both through
// World.playSoundToNearExcept: S29 to every other player under 16 blocks (squared distance from the entity's feet to the other's posX/posY/posZ, posY being
// feet + 1.62). ItemFood.onEaten then plays random.burp (0.5, world rand) with World.playSoundAtEntity, which reaches the eater too.
const SOUND_RANGE = 16, EYE_OFFSET = 1.62;
const seeded = () => new JavaRandom(Math.floor(Math.random() * 2 ** 48));
const vector = p => ({ ...p, copy(v) { Object.assign(this, { x: v.x, y: v.y, z: v.z }); return this; } });
export function cleanHotbar(slots) {
  if (!Array.isArray(slots) || slots.length !== 9) return null;
  const out = [];
  for (const s of slots) {
    if (s === null) { out.push(null); continue; }
    if (!s || !Number.isInteger(s.id) || !ITEMS[s.id] || !Number.isInteger(s.damage ?? 0) || (s.damage ?? 0) < 0 || (s.damage ?? 0) > 32767) return null;
    out.push(makeStack(s.id, 64, s.damage ?? 0));
  }
  return out;
}

// One dedicated world, independent of all connected tabs. Finite terrain is an
// explicit first-milestone residency policy, not a host player's moving window.
export class DedicatedSimulation {
  constructor(saved = {}, { world = null, gameMode = 'creative', ...options } = {}) {
    this.difficulty = options.difficulty ?? 2; this.serverSurvival = new ServerSurvival(this); // World.difficultySetting (0-3) for hunger and damage; the players' Survival state
    this.gameMode = gameMode === 'survival' ? 'survival' : 'creative'; // creative (the milestone default) breaks at once; survival runs ItemInWorldManager's dig timer
    if (saved.version !== undefined && saved.version !== 1) throw new Error('Unsupported dedicated save version');
    this.world = world ?? new World(saved.seed ?? 'ledoge0', saved.biome ?? 'java', saved.generationVersion ?? 9);
    if (this.world.streaming) throw new Error('Dedicated v1 requires a finite world');
    // World.restore deliberately limits browser import batches to 100k cells.
    // A long-lived dedicated world can legitimately edit more cells than that.
    const edits = saved.edits ?? [];
    if (!Array.isArray(edits)) throw new Error('Invalid dedicated edits');
    for (let i = 0; i < edits.length; i += 100000) this.world.restore(edits.slice(i, i + 100000));
    this.time = saved.time ?? 6000;
    // World state the operator commands change (src/servercommands-b59.js): game rules, difficulty, the mode a new player starts in.
    this.gameRules = { ...(saved.gameRules ?? {}) }; if (Number.isInteger(saved.difficulty)) this.difficulty = saved.difficulty; this.newPlayerMode = saved.newPlayerMode ?? null; // a saved difficulty wins over the --difficulty option
    this.ticks = saved.ticks ?? 0;
    this.players = new Map();
    // Item entities (EntityItem): a Survival break, drops from a container and the like. Each gets a wire id (`eid`); clients see them in `tick.items` and ask
    // to collect them with `pickup` (the client's own inventory is the authority, as for the hotbar).
    this.items = new ItemEntities();
    this.nextItemId = 0; this.itemsSent = 0;
    this.items.joined = e => { e.eid = ++this.nextItemId; };
    this.itemHost = { spill: (...a) => this.items.spill(...a), dropBlock: (...a) => this.items.dropBlock(...a), dropPlayer: (...a) => this.items.dropPlayer(...a) };
    this.achievements = new ServerAchievements(this); // b60: server-side achievement triggers (server-achievements.js)
    this.wither = new ServerWither(this); // b63: the T of soul sand and three wither skulls builds a wither (server-wither.js)
    this.serverItems = new ServerItems(this, saved); // b59: world drops, XP orbs, inventory authority, pickup, saved items (server-items.js)
    this.savedPlayers = new Map(saved.players ?? []);
    this.changes = new Map();
    this.actions = [];
    this.soundRand = seeded(); this.soundsOut = []; // World.rand for the drink and burp pitch; sounds queued this tick
    this.tiles = new Survival(saved.tiles ?? {}, 'creative');
    this.containers = new ServerContainers(this); // chest, furnace, dispenser, hopper, brewing and ender chest windows (server-containers.js)
    // The tile entities the clients are told about (tile-sync.js); flower pots live on the world. Signs and skulls are placed by `edit`, a sign's
    // text comes in by `updateSign` (C12), a beacon's effects by `chooseBeacon` (MC|Beacon) and a spawner's mob by `setSpawnerEntity`; each
    // marks its cell (`tileChanged`) and the next tick sends the description packet (S33 / S35) with the cell changes.
    this.dirtyTiles = new Set();
    const te = saved.tileEntities ?? {};
    this.tileEntities = { world: this.world, signs: Signs.fromJSON(te.signs), skulls: Skulls.fromJSON(te.skulls), beacons: new Beacons().fromJSON(te.beacons), spawners: MobSpawners.fromJSON(te.spawners), chests: this.tiles.chests, enders: this.tiles.enderTiles }; // chests/enders: the contChest descriptions (tile-sync.js)
    this.weather = new Weather().restore(saved.weather).restoreSimulation(saved.worldRandom);
    this.farming = new Farming(this.world, saved.farms);
    this.fluids = new Fluids(this.world, { random: this.weather.random });
    this.fluids.load(saved.fluidTicks);
    this.fire = new Fire(this.world, { weather: () => this.weather,
      stillLava: (x, y, z) => !this.fluids.pending.has(this.fluids.key(x, y, z, LAVA)) });
    this.fire.watch();
    this.fire.sharedRandomTicks = true;
    this.fire.load(saved.fireTicks);
    this.trees = new Trees(this.world, { random: this.weather.random, apply: noop, drop: this.serverItems.stacksDrop,
      light: (x, y, z) => this.light.level(x, y, z, this.darkness) }).watch();
    this.plants = new Plants(this.world, { drop: this.serverItems.stacksDrop, broken: noop, apply: noop }).watch();
    this.falling = new FallingBlocks(this.world, { drop: this.serverItems.fallingDrop, apply: noop }, saved.falling).watch();
    this.falling.load(saved.fallingTicks);
    for (const System of [Rails, Torches, Doors, Beds]) new System(this.world, { drop: this.serverItems.stacksDrop, apply: noop }).watch();
    this.redstone = new LiveRedstone(this.world, {
      entitiesIn: (box, mode) => mode === 'minecart' || mode === 'inventory' ? this.vehicles?.cartsIn(box, mode) ?? [] : [...this.players.values()].filter(p => p.position.x + .3 > box[0] && p.position.x - .3 < box[3] && p.position.y + 1.8 > box[1] && p.position.y < box[4] && p.position.z + .3 > box[2] && p.position.z - .3 < box[5]).map(p => ({ ...p.position, player: true, living: true })),
      environment: () => ({ sky: 15, skylightSubtracted: this.darkness, celestialAngle: celestialAngle(this.time, 1) * Math.PI * 2, noSky: false }),
      skyLight: (x, y, z) => this.light.skyAt(x, y, z),
    });
    this.redstone.restore(saved.redstone);
    this.light = new LightVolume(this.world, (x, y, z, b) => lightEmission(b, this.redstone.lit.has(`${x},${y},${z}`) || this.containers.litFurnaces.has(`${x},${y},${z}`))); // lit repeater or furnace (container-ticks)
    this.dispense = new ServerProjectiles(this, saved.projectiles); // b61: what dispensers fire (arrows, potions, TNT...), sent to clients as dispEnts / dispFx
    this.containers.ticks = new ContainerTicks(this); // hoppers, dispensers, trapped chest power (server-container-ticks.js)
    this.world.blockLight = (x, y, z) => this.light.blockAt(x, y, z);
    this.world.fullLight = (x, y, z) => this.light.level(x, y, z, 0);
    this.farming.lightLevel = (x, y, z) => this.light.level(x, y, z, this.darkness);
    this.farming.rained = (x, y, z) => canLightningStrikeAt(this.weather, this.world, x, y + 1, z);
    this.weather.fire = this.fire.strikes;
    this.weather.blockTick = (x, y, z, b) => this.fire.randomTick(x, y, z, b) || this.trees.randomTick(x, y, z, b) || this.plants.randomTick(x, y, z, b);
    // Instance hook sees *every* write, including untracked and fluid/redstone
    // writes. Store only the final cell value per tick; never wrap World globally.
    const put = this.world.put.bind(this.world);
    this.world.put = (x, y, z, b, m = 0, track = true) => {
      const old = this.world.get(x, y, z), meta = this.world.getMeta(x, y, z);
      const result = put(x, y, z, b, m, track);
      if (result && (old !== b || meta !== m)) this.changes.set(`${x},${y},${z}`, [x, y, z, b, m]);
      return result;
    };
    // The mobs (server-mobs.js): EntityWorld on this world, every connected player a target; `mobs: false` leaves them out (a test of something else).
    this.mobs = new ServerMobs(this, saved.mobs, { naturalSpawning: options.mobs !== false });
    this.vehicles = new ServerVehicles(this, saved.vehicles); // b61 mpvehicles
    this.leads = new ServerLeads(this); // b62 mpriding2: leads and fence knots (server-leads.js)
    this.vehicles.connect(this.redstone); // b62 mpriding2: powered, detector and activator rails, the detector's cart touch
    this.dispense.vehicles = { dispenseBoat: (x, y, z) => !!this.vehicles.spawnVehicle('boat', x, y, z), dispenseCart: (type, x, y, z) => !!this.vehicles.spawnVehicle({ 0: 'minecart', 1: 'chest_minecart', 2: 'furnace_minecart', 3: 'tnt_minecart', 5: 'hopper_minecart' }[type], x, y, z) }; // b61 lead: BehaviorDispenseBoat / BehaviorDispenseMinecart (chest and hopper carts keep the stack)
    this.mobs.mobs.ignite = (x, y, z) => this.fire.ignite(x, y, z); // a fireball sets fire where it lands
    this.dimensions = new ServerDimensions(this, saved.dimensions); // b61 mpnether: after every system that watches the Overworld
  }
  // Mobs hurt a player here: the player-state track replaces this with the server's health. Returns false when the hit did not land (the default lands and does nothing).
  // A mob's hit (server-mobs.js): the player's own Survival.scaledDamage / damage with the mob's arguments (difficulty scaling, armour, the CombatTracker entry);
  // the death is seen by ServerSurvival.tick. Lead fix at the b59 merge: the mpmobs no-op is replaced by the mpstate health.
  damagePlayer(player, amount, source) { if (!player?.survival || player.dead) return false; return source?.call ? source.call() : player.survival.damage(amount, source?.name ?? 'an accident', true, undefined, source?.from ?? undefined); }
  get darkness() { return skylightSubtracted(celestialAngle(this.time, 1), this.weather.rainStrength(), this.weather.weightedThunder()); }
  addPlayer(id, name, resumeKey, { skin = null } = {}) {
    if (!validName(name) || [...this.players.values()].some(p => p.name.toLowerCase() === name.toLowerCase())) throw new Error('Choose an unused name (1–16 letters, numbers or underscores).');
    if ([...this.players.values()].some(p => p.resumeKey === resumeKey)) throw new Error('That player is already connected.');
    const saved = this.savedPlayers.get(resumeKey), start = saved?.position ?? this.world.spawn();
    const position = vector(start), survival = new Survival(saved?.player ?? {}, this.gameMode);
    if (!saved && this.newPlayerMode) survival.mode = this.newPlayerMode; // /defaultgamemode adventure
    for (const key of ['chests', 'furnaces', 'dispensers', 'hoppers', 'brewing', 'enderTiles']) survival[key] = this.tiles[key];
    const player = { id, name, resumeKey, world: this.world, position, previous: vector(position), velocity: vector({ x: 0, y: 0, z: 0 }), motion: new PlayerMotion(), survival,
      yaw: saved?.yaw ?? 0, pitch: saved?.pitch ?? 0, grounded: false, collidedH: false, flying: false, fallDistance: 0, landedFall: 0, eating: null,
      input: { ...IDLE_INPUT }, lastInput: this.ticks, swing: 0, skin, itemInUse: null, achievementsSaved: saved?.achievements ?? null, spawnpoint: saved?.spawnpoint ?? null, rand: seeded(),
      dig: createServerDig({ crack: (cell, stage) => this.crack(id, cell, stage) }) };
    this.serverItems.join(player, saved);
    this.players.set(id, player);
    this.mobs.addPlayer(player);
    this.vehicles.addPlayer(player); // b61
    this.dimensions.adopt(player, saved); // b61 mpnether: a player saved in the Nether returns to it
    return player;
  }
  removePlayer(id) {
    const p = this.players.get(id);
    if (p) this.vehicles.removePlayer(p); // b61: a rider is let down before the position is saved
    if (p) this.serverItems.inv.leave(p); // b60: the cursor and crafting grid are thrown
    if (p) this.savedPlayers.set(p.resumeKey, this.savePlayer(p));
    this.players.delete(id);
    this.mobs.removePlayer(id);
    this.dimensions.removePlayer(id); // b62 mpnether2: the Nether's mob view
  }
  savePlayer(p) { return { position: { x: p.position.x, y: p.position.y, z: p.position.z }, yaw: p.yaw, pitch: p.pitch,
    player: { slots: p.survival.inventory.serialize(), current: p.survival.inventory.current, armor: p.survival.inventory.serializeArmor(), ...vitalsOf(p.survival), enderItems: p.survival.enderItems.map(copyStack) }, ...this.serverItems.savedFields(p), ...(p.achievementsSaved ? { achievements: p.achievementsSaved } : {}), ...(p.spawnpoint ? { spawnpoint: p.spawnpoint } : {}), ...this.dimensions.savedFields(p) }; }
  input(id, message) {
    const p = this.players.get(id), input = cleanInput(message.controls), look = cleanLook(message.yaw, message.pitch);
    if (!p || !input || !look || !Number.isInteger(message.current) || message.current < 0 || message.current > 8) return false;
    if (!p.window && !this.serverItems.adopt(p, message)) return false; // an open container window owns the server inventory (server-containers.js)
    Object.assign(p, look, { input, lastInput: this.ticks, moved: true });
    p.survival.inventory.current = message.current;
    return true;
  }
  queueEdit(id, message) {
    if (!this.players.has(id) || this.actions.filter(a => a.id === id).length >= 4 || typeof message.place !== 'boolean') return false;
    this.actions.push({ id, place: message.place }); return true;
  }
  // `pickup`: the eids of items the client sees in reach and has room for. EntityItem.onCollideWithPlayer's own test (ItemEntities.collect: pickup delay over, the
  // player's box grown by 1 / 0.5 / 1) is repeated here with the server's position; each item that passes goes to the player as a `collect` stack. Survival only.
  pickup(id, eids, fits) { return this.serverItems.pickup(this.players.get(id), eids, fits); }
  itemList() { return this.items.items.filter(e => !e.dead).map(e => ({ i: e.eid, stack: e.stack, x: e.x, y: e.y, z: e.z, age: e.age, hover: e.hover, delay: e.delay })); }
  // C07 status 0 / 1 / 2 (`dig`) and the item-in-use start / stop (`use`): queued like an edit and handled in the network tick, after the player's own update.
  queueDig(id, status) {
    if (!this.players.has(id) || ![0, 1, 2].includes(status) || this.actions.filter(a => a.id === id).length >= 4) return false;
    this.actions.push({ id, dig: status }); return true;
  }
  // C02 UseEntity, attack: the wire id of a mob (the server repeats the reach test and damages with the held weapon, server-mobs.js).
  queueAttack(id, mob) {
    if (!this.players.has(id) || !Number.isInteger(mob) || mob < 0 || this.actions.filter(a => a.id === id).length >= 4) return false;
    this.actions.push({ id, attack: mob }); return true;
  }
  // C02 UseEntity, interact (b61 animal-use.js): feed, breed, shear, milk, saddle, dye an animal; `claim` is the client's own prediction.
  queueAnimUse(id, mob, claim) {
    if (!this.players.has(id) || !Number.isInteger(mob) || mob < 0 || this.actions.filter(a => a.id === id).length >= 4) return false;
    this.actions.push({ id, animUse: mob, claim: claim === true }); return true;
  }
  queueVehicle(id, m) { return this.vehicles.queue(id, m); } // b61: C02 on a minecart or boat (server-vehicles.js)
  queueUse(id, active) {
    if (!this.players.has(id) || typeof active !== 'boolean' || this.actions.filter(a => a.id === id).length >= 4) return false;
    this.actions.push({ id, use: active }); return true;
  }
  // The server's ray for a dig: the cell the player's own position and look aim at (no client coordinate is trusted), or null.
  aimCell(p) {
    const eye = { x: p.position.x, y: p.position.y + PHYSICS.eye, z: p.position.z };
    const dir = { x: -Math.sin(p.yaw) * Math.cos(p.pitch), y: Math.sin(p.pitch), z: -Math.cos(p.yaw) * Math.cos(p.pitch) };
    const target = raycast(this.world, eye, dir, 5);
    if (!target) return null;
    const gate = serverClick({ kind: 'dig', player: [p.position.x, p.position.y, p.position.z], pos: target.block, adjacent: target.adjacent, hasMoved: !!p.moved });
    if (!gate.accept) { p.refusal = gate.message ?? null; return null; } // a refused dig is silent natively; only the build-height text can reach the player
    return [...target.block];
  }
  // Block.getPlayerRelativeBlockHardness for this player as it is now (null for an air cell), the rate ItemInWorldManager's timer multiplies.
  digRate(p, cell) {
    const b = this.world.get(cell[0], cell[1], cell[2]);
    return b ? playerMiningState(p.survival, b, p.survival.held?.id ?? 0, eyeInWater(this.world, p.position.x, p.position.y + PHYSICS.eye, p.position.z), p.grounded).progress : null;
  }
  breakDug(p, cell) {
    const state = { ...p, world: this.world, farming: this.farming, trees: this.trees, items: this.itemHost, xpOrbs: this.serverItems.xp, heldTool: p.survival.held?.id ?? 0 };
    return this.serverItems.afterBreak(p, cell, () => breakPlayerBlock(state, cell, { creative: p.survival.creative }));
  }
  // World.destroyBlockInWorldPartially -> S25 (bytecode-read, WorldManager mp.b): every player except the breaker, in the same world and under 32 blocks
  // (squared distance from the player's feet below 1024), gets the stage. Stage -1 (or 10, an air cell) takes the crack away.
  crack(breaker, cell, stage) {
    for (const o of this.players.values()) {
      if (o.id === breaker || (o.dimension | 0) !== (this.players.get(breaker)?.dimension | 0)) continue; // b61: the same dimension only
      const dx = cell[0] - o.position.x, dy = cell[1] - o.position.y, dz = cell[2] - o.position.z;
      if (dx * dx + dy * dy + dz * dz < 1024) (o.cracksOut ??= []).push({ id: breaker, x: cell[0], y: cell[1], z: cell[2], stage });
    }
  }
  // C07 for a Survival player: status 0 starts the timer (an instant block breaks), status 1 is cancelDestroyingBlock, status 2 asks the timer to finish.
  // A Creative player breaks at once on status 0 (the same path as `edit`); 1 and 2 do nothing for them. NetHandlerPlayServer resends the block (S23)
  // after status 1 or 2 when it is not air.
  handleDig(p, status) {
    if (p.survival.creative) return status === 0 ? this.edit(p, false) : false;
    if (status === 1) {
      p.dig.abort();
      const at = this.aimCell(p);
      if (at && this.world.get(at[0], at[1], at[2])) (p.resendCells ??= []).push(at);
    } else {
      const cell = this.aimCell(p);
      if (!cell) return false;
      if (status === 0) {
        p.swing = 6;
        const rate = this.digRate(p, cell);
        p.dig.start(cell, rate);
        if (rate !== null && Math.fround(rate) >= 1) this.breakDug(p, cell);
        return true;
      }
      const r = p.dig.finish(cell, this.digRate(p, cell));
      if (r === 'break') this.breakDug(p, cell);
      else if (this.world.get(cell[0], cell[1], cell[2])) (p.resendCells ??= []).push(cell);
      return r === 'break';
    }
    return true;
  }
  // EntityPlayer.itemInUse: the right button on a sword, bow, food or milk bucket starts it (ItemFood needs hunger, and a Creative player cannot
  // eat); releasing it ends it. A changed held item clears it (EntityPlayer.onUpdate), so does a finished eat or drink. Presence carries only the flag.
  handleUse(p, active) {
    if (!active) { if (p.itemInUse?.bow) this.dispense.shootBow(p, p.itemInUse.ticks); /* b62: C07 release */ p.itemInUse = null; return true; }
    if (p.itemInUse) return false;
    const held = p.survival.held, id = held?.id ?? 0, item = ITEMS[id];
    if (item?.kind === 'sword') p.itemInUse = { id, block: true };
    else if (id === BOW && canDraw(p.survival)) p.itemInUse = { id, bow: true, ticks: 0 };
    else if (id === MILK_BUCKET) p.itemInUse = { id, ticks: USE_TICKS };
    else if (item?.food && !p.survival.creative && (p.survival.food < 20 || item.alwaysEdible)) p.itemInUse = { id, ticks: USE_TICKS };
    return !!p.itemInUse;
  }
  tickUse(p) {
    const use = p.itemInUse;
    if (!use) return;
    if ((p.survival.held?.id ?? 0) !== use.id) { p.itemInUse = null; return; }
    if (use.bow) { use.ticks++; return; }
    if (use.block) return;
    // EntityPlayer.onUpdate: updateItemUse(stack, 5) while the remaining count is 25 or less and a multiple of 4, then the count falls; at 0 onItemUseFinish
    // runs updateItemUse(stack, 16) and the item's onEaten (the burp), then clears the item in use.
    if (use.ticks <= 25 && use.ticks % 4 === 0) this.useSound(p, use, 5);
    if (--use.ticks <= 0) {
      this.useSound(p, use, 16);
      if (use.id !== MILK_BUCKET) this.soundsOut.push({ name: 'random.burp', x: p.position.x, y: p.position.y, z: p.position.z, volume: 0.5, pitch: Math.fround(Math.fround(this.soundRand.nextFloat() * Math.fround(0.1)) + Math.fround(0.9)), except: null });
      if (use.id !== MILK_BUCKET) this.serverSurvival.finishEating(p, use.id); else this.serverSurvival.finishDrinking(p); // b60: milk uses a bucket and clears the effects
      p.itemInUse = null; // the eat or drink completes; its food, potion and bottle effects are not modelled here
    }
  }
  useSound(p, use, n) {
    const at = { x: p.position.x, y: p.position.y, z: p.position.z, except: p.id };
    if (use.id === MILK_BUCKET) { this.soundsOut.push({ name: 'random.drink', ...at, volume: 0.5, pitch: Math.fround(Math.fround(this.soundRand.nextFloat() * Math.fround(0.1)) + Math.fround(0.9)) }); return; }
    for (let i = 0; i < n * 3; i++) p.rand.nextFloat();
    const volume = Math.fround(0.5 + Math.fround(0.5 * p.rand.nextInt(2))), a = p.rand.nextFloat(), b = p.rand.nextFloat();
    this.soundsOut.push({ name: 'random.eat', ...at, volume, pitch: Math.fround(Math.fround(Math.fround(a - b) * Math.fround(0.2)) + 1) });
  }
  // WorldManager.playSound / playSoundToNearExcept -> ServerConfigurationManager.sendToAllNearExcept: the players (but `except`) whose posX/Y/Z is within the range.
  deliverSounds() {
    for (const s of this.soundsOut.splice(0)) {
      const range = s.volume > 1 ? SOUND_RANGE * s.volume : SOUND_RANGE;
      for (const o of this.players.values()) {
        if (o.id === s.except || (o.dimension | 0) !== (s.dim ?? this.players.get(s.except)?.dimension ?? 0)) continue; // b61: the sound's dimension (the eater's, unless tagged)
        const dx = s.x - o.position.x, dy = s.y - (o.position.y + EYE_OFFSET), dz = s.z - o.position.z;
        if (dx * dx + dy * dy + dz * dz < range * range) (o.soundsOut ??= []).push({ name: s.name, x: s.x, y: s.y, z: s.z, volume: s.volume, pitch: s.pitch });
      }
    }
  }
  edit(p, place) {
    if (place && this.vehicles.pigs.stick(p)) return true; // b62: ItemCarrotOnAStick.onItemRightClick boosts the pig under the player (server-riding.js)
    // A Survival player breaks only through `dig` and its timer.
    if (!place && !p.survival.creative) return false;
    // Compute the ray on the server from authoritative position/look. No client
    // block coordinate, reach, held item or collision claim is trusted.
    const eye = { x: p.position.x, y: p.position.y + PHYSICS.eye, z: p.position.z };
    const dir = { x: -Math.sin(p.yaw) * Math.cos(p.pitch), y: Math.sin(p.pitch), z: -Math.cos(p.yaw) * Math.cos(p.pitch) };
    const target = raycast(this.world, eye, dir, 5);
    if (!target) return place && ((!p.dimension && this.vehicles.useHeld(p, null)) || this.dispense.throwHeld(p)); // b62: thrown items; vehicles are Overworld only // b61: a boat is placed on water the block ray misses
    // NetHandlerPlayServer C07 / C08 (server-handlers.js): block centre within 8 of the feet for a place (and the player has sent a position),
    // 6 from the eye offset for a dig, nothing at or above the 256 build limit. The ray's 5 blocks sit inside both distances, so only the height
    // and the has-moved rule can refuse here; the refusal text is kept on the player for the connection to deliver.
    const feet = [p.position.x, p.position.y, p.position.z];
    const gate = serverClick({ kind: place ? 'place' : 'dig', player: feet, pos: target.block, adjacent: target.adjacent, hasMoved: !!p.moved });
    // nh.a(jo) always ends a block placement packet (any face but 255) with an S23 for the clicked cell and for the cell on the clicked face, to
    // that player only, accepted or not; a refused dig (status 0, 1, 2 over 6 blocks or at the height limit) returns silently and resends nothing.
    if (place) p.resendCells = [target.block, target.adjacent];
    if (!gate.accept) { p.refusal = gate.message ?? null; return false; }
    p.swing = 6;
    const state = { ...p, world: this.world, farming: this.farming, trees: this.trees, items: { spill: noop }, heldTool: p.survival.held?.id ?? 0 };
    if (!place) return this.serverItems.afterBreak(p, target.block, () => breakPlayerBlock(state, target.block, { creative: true }));
    // Block activations that don't open a GUI remain shared.
    const [x, y, z] = target.block, b = this.world.get(x, y, z);
    if ([108, 111, 112, 124, 126, 127].includes(b) && !p.input.sneak) { this.redstone.use(x, y, z); return true; }
    // BlockBeacon.onBlockActivated: a sneak-free click opens ContainerBeacon (S2D open window), described to the player by `openBeacon`.
    if (b === BEACON && !p.input.sneak) return this.openBeacon(p, x, y, z);
    if (this.containers.use(p, x, y, z, b, !(p.input.sneak && p.survival.held))) return true; // BlockChest / BlockFurnace ... onBlockActivated: S2D open window
    if (place && isFence(b) && !p.dimension && this.leads.fence(p, [x, y, z])) return true; // b62: BlockFence.onBlockActivated: a lead in hand ties the holder's mobs to a knot
    if (place && !p.dimension && this.vehicles.useHeld(p, target)) return true; /* b62: vehicles are Overworld only */ // b61: minecart on a rail, boat on water
    const id = state.heldTool;
    if (this.dimensions.useItem(p, target, id)) return true; // b61: ItemFlintAndSteel (server-dimensions.js)
    if (id === WATER || id === LAVA) return false;
    // ItemSign.onItemUse / ItemSkull.onItemUse on the server ray (signs.js, skull.js): the placer becomes the sign's editor and gets the S36
    // open-editor message; a head keeps its type and (on top of a block) its rotation. b63: a completed T builds a wither (server-wither.js).
    if (id === ITEM_SIGN) {
      return placeSign({ world: this.world, survival: p.survival, yaw: p.yaw }, { id, target }, { signs: this.tileEntities.signs,
        openEditor: tile => { tile.editor = p.id; p.openSign = [tile.x, tile.y, tile.z]; } }).placed;
    }
    if (id === ITEM_SKULL) {
      return placeSkull({ world: this.world, survival: p.survival, yaw: p.yaw }, { id, damage: p.survival.held?.damage ?? 0, target }, this.wither.hooks(p)).placed; // b63: soul sand and the difficulty are passed, so the T builds a wither (Overworld)
    }
    if (place && this.dispense.throwHeld(p)) return true; // b62: snowball, egg, pearl, splash potion, XP bottle
    return placeHeldBlock(state, { id, item: ITEMS[id], target }, {
      collides: w => [...this.players.values()].some(other => {
        // The normal placement path tests this callback after its speculative
        // write, so the same collision test must cover every connected player.
        return collides(w, other.position.x, other.position.y, other.position.z);
      }),
    }).placed;
  }
  // Marks the tile entity at a cell for a description packet on the next tick (World.markBlockForUpdate on a tile edit).
  tileChanged(x, y, z) { this.dirtyTiles.add(`${x},${y},${z}`); }
  // NetHandlerPlayServer.processUpdateSign (C12): only the sign's editable tile, edited by the player it names as editor, takes the lines;
  // each line over 15 characters or with a disallowed one becomes "!?". Anything else is dropped silently (the original logs a warning).
  updateSign(id, m) {
    const p = this.players.get(id);
    if (!p || ![m?.x, m?.y, m?.z].every(Number.isInteger) || !Array.isArray(m.text) || m.text.length !== SIGN_LINES || !m.text.every(t => typeof t === 'string')) return false;
    const tile = this.tileEntities.signs.tile(m.x, m.y, m.z);
    if (!tile || !tile.editable || tile.editor !== id || !isSign(this.world.get(m.x, m.y, m.z))) return false;
    if (!this.tileEntities.signs.update(m.x, m.y, m.z, m.text)) return false;
    this.tileChanged(m.x, m.y, m.z);
    return true;
  }
  // ContainerBeacon as a server window: the dedicated server keeps one open beacon per player (`p.beaconWindow`), whose single payment slot is the
  // tile's own (TileEntityBeacon is the IInventory, so the item stays in the tile when the window closes). The level is refreshed from the pyramid
  // here; the original recounts it every 80 ticks. Players are creative, so a payment taken from the client's slot is not subtracted from an inventory.
  openBeacon(p, x, y, z) {
    const tile = this.tileEntities.beacons.ensure(x, y, z), w = this.world;
    tile.levels = pyramidLevel((cx, cy, cz) => w.get(cx, cy, cz), (cx, cy, cz) => canSeeSky(w, cx, cy, cz), x, y, z);
    p.beaconWindow = [x, y, z]; p.openBeacon = [x, y, z];
    return true;
  }
  // ContainerBeacon.canInteractWith: the block must remain and the player be within 8 blocks of its centre.
  beaconWindowOf(id) {
    const p = this.players.get(id), win = p?.beaconWindow;
    if (!win) return null;
    const [x, y, z] = win;
    if (this.world.get(x, y, z) !== BEACON || (p.position.x - x - .5) ** 2 + (p.position.y - y - .5) ** 2 + (p.position.z - z - .5) ** 2 > 64) { p.beaconWindow = null; return null; }
    return this.tileEntities.beacons.ensure(x, y, z);
  }
  // The payment slot of the open window (a C0E click on slot 0): only an iron ingot, gold ingot, diamond or emerald fits, one at a time (zy.a).
  setBeaconPayment(id, m) {
    const tile = this.beaconWindowOf(id), item = m?.item;
    if (!tile) return false;
    if (item === null) { tile.payment = null; return true; }
    if (!item || !Number.isInteger(item.id) || !isPaymentItem(item.id)) return false;
    tile.payment = { id: item.id, count: 1, damage: Number.isInteger(item.damage) ? item.damage : 0 };
    return true;
  }
  // C0D close window.
  dropHeld(id, all) { return this.achievements.dropThrown(this.players.get(id), !!all); } // b60 achDrop: Q / Ctrl+Q with the thrower name
  // b60 (server-inventory.js): window 0 clicks, ack and close
  invClick(id, m) { return this.serverItems.inv.click(this.players.get(id), m); }
  invAck(id) { this.serverItems.inv.ack(this.players.get(id)); }
  invClose(id) { this.serverItems.inv.close(this.players.get(id)); }
  invCreative(id, m) { return this.serverItems.inv.creative(this.players.get(id), m); } // b61: C10 creative inventory slot / drop
  closeWindow(id) { const p = this.players.get(id); if (p) { p.beaconWindow = null; this.containers.close(p); } }
  clickWindow(id, m) { const p = this.players.get(id); return !!p && this.containers.click(p, m); } // C0E
  // b60 (server-stations.js): C11 EnchantItem and the MC|ItemName payload of the open station window.
  station(id, m) { const p = this.players.get(id); return !!p && (m.type === 'stationEnchant' ? this.containers.stations.enchant(p, m) : m.type === 'stationItemName' && this.containers.stations.rename(p, m)); }
  windowInventory(id, m) { const p = this.players.get(id); return !!p && this.containers.inventory(p, m); }
  confirmTransaction(id, m) { const p = this.players.get(id); if (p) this.containers.confirm(p, m); } // C0F
  // The MC|Beacon custom payload (NetHandlerPlayServer): only while the player has a beacon window open at that cell and a payment sits in slot 0
  // (one item is consumed); each pick is checked against the pyramid level (applyBeaconPick).
  chooseBeacon(id, m) {
    if (![m?.x, m?.y, m?.z, m?.primary, m?.secondary].every(Number.isInteger)) return false;
    const tile = this.beaconWindowOf(id), win = this.players.get(id)?.beaconWindow;
    if (!tile || win[0] !== m.x || win[1] !== m.y || win[2] !== m.z) return false;
    if (!applyBeaconPick(tile, m.primary, m.secondary)) return false;
    this.tileChanged(m.x, m.y, m.z);
    return true;
  }
  // MobSpawnerBaseLogic.setEntityName followed by markBlockForUpdate. 1.7.10's spawn egg has no spawner branch (spawn-egg-use.js), so no client
  // message reaches this; it is the server-side hook for a command or an operator tool.
  setSpawnerEntity(x, y, z, entityId) {
    const spawner = this.world.get(x, y, z) === MOB_SPAWNER ? this.tileEntities.spawners.get(x, y, z) : null;
    if (!spawner || typeof entityId !== 'string' || !entityId || entityId.length > 64) return false;
    spawner.entityId = entityId;
    this.tileChanged(x, y, z);
    return true;
  }
  // A tile entity goes with its block (BlockContainer.breakBlock / World.removeTileEntity).
  dropTiles(x, y, z, block) {
    const t = this.tileEntities;
    this.containers.reap(x, y, z, block);
    if (!isSign(block)) t.signs.remove(x, y, z);
    if (block !== SKULL) t.skulls.remove(x, y, z);
    if (block === BEACON) t.beacons.ensure(x, y, z); else t.beacons.remove(x, y, z); // BlockContainer.onBlockAdded makes the tile, a default one
    if (block === MOB_SPAWNER) { if (!t.spawners.get(x, y, z)) t.spawners.add({ x, y, z }); } else t.spawners.remove(x, y, z);
  }
  tick() {
    const beforeLit = new Set(this.redstone.lit);
    this.ticks++; if (String(this.gameRules.doDaylightCycle ?? 'true').toLowerCase() === 'true') this.time++; // gamerule doDaylightCycle
    this.containers.tick();
    for (const p of this.players.values()) {
      const controls = this.ticks - p.lastInput > 10 ? IDLE_INPUT : p.input;
      this.mobs.knock(p); // b60: a mob's knockback on this player (server-mobs.js)
      const moved = this.vehicles.riding(p) ? this.vehicles.sit(p) : movePlayer(p, p.dead ? IDLE_INPUT : controls); // b61: a rider is carried by the vehicle
      const dead = this.dimensions.within(p, () => this.serverSurvival.tick(p, moved)); // b61: a Nether player's drops and void respawn use the Nether's world and items
      // Survival players: health, food, fall and void damage, death (server-survival.js)
      if (p.position.y < -64 && !dead && p.survival.creative) { (this.events ??= []).push({ type: 'death', id: p.id }); /* Entity.G: outOfWorld damage; the broadcast is server-broadcast.js */ p.position.copy(p.spawnpoint ? { x: p.spawnpoint[0] + 0.5, y: p.spawnpoint[1], z: p.spawnpoint[2] + 0.5 } : p.world.spawn()); p.previous.copy(p.position); Object.assign(p.velocity, { x: 0, y: 0, z: 0 }); } // b61: p.world, the Nether's spawn for a Nether player
      p.survival.time = this.time;
      if (p.swing) p.swing--;
      // EntityPlayerMP.onUpdate: ItemInWorldManager.updateBlockRemoving (the timer's tick and a delayed break), then the item in use, before the network tick.
      if (!p.survival.creative) this.dimensions.within(p, () => { const hit = p.dig.tick(cell => this.digRate(p, cell)); if (hit) this.breakDug(p, hit); }); // b62: a Nether player's delayed break runs in the Nether
      this.tickUse(p);
    }
    if (this.items.items.length) {
      this.items.tick(this.world);
      if (this.items.items.length > 300) this.items.items.splice(0, this.items.items.length - 300); // oldest first, a safety cap for one wire message
    }
    this.serverItems.tickOrbs();
    this.achievements.tick(); // b60: biomes and beacons
    for (const { id, place, dig, use, attack, animUse, claim, veh } of this.actions.splice(0)) {
      const p = this.players.get(id);
      if (!p || p.dead) continue;
      if (veh && !p.dimension) { this.vehicles.act(p, veh); continue; } // b61
      if (animUse !== undefined) { if (p.dimension) continue; /* b61 lead: the Nether has no mobs */ this.mobs.interact(p, animUse, claim); continue; } // b61: C02 interact
      if (p.animHandled && this.ticks <= p.animHandled + 1 && (place === true || use === true)) { p.animHandled = 0; continue; } // the click the animal took is not also an item use
      this.dimensions.within(p, () => { // b61 mpnether: a Nether player's action runs in the Nether (server-dimensions.js)
        if (p.dimension && (dig === 0 || place === false) && this.mobs.punchBall(p)) return; // b62: a punch deflects a fireball first (EntityPlayer.attackEntityFrom path: Nether mobs only)
        if (attack !== undefined) { p.swing = 6; this.mobs.attack(p, attack); } else if (dig !== undefined) this.handleDig(p, dig); else if (use !== undefined) this.handleUse(p, use); else this.edit(p, place);
      });
    }
    for (const p of this.players.values()) if (p.resendCells) {
      p.blocks = p.resendCells.map(([x, y, z]) => [x, y, z, p.world.get(x, y, z), p.world.getMeta(x, y, z)]); // b61: the player's own world p.resendCells = null;
    }
    this.dispense.tick(); // b61: dispensed TNT, balls, arrows, rockets, potions (before the mobs, as tickEntitySimulation)
    this.vehicles.riderInput(); // b62: a pig steers on this tick's keys
    this.mobs.tick();
    this.vehicles.tick(); // b61
    this.dispense.flush();
    for (const p of this.players.values()) this.serverItems.settle(p);
    for (const p of this.players.values()) this.serverSurvival.settle(p); // b61: a hit by a mob or an action kills in its own tick (server-survival.js)
    this.deliverSounds();
    this.weather.tick(this.world);
    this.weather.drain();
    this.falling.tick();
    tickWorldSystems({ farming: this.farming, fluids: this.fluids, fire: this.fire, redstone: this.redstone, hoppers: this.containers.ticks.hoppers },
      { time: this.time, daylight: 1 - this.darkness / 15, x: 64, z: 64 }, { farming: noop, fluids: noop, fire: noop });
    // TileEntityBeacon.updateEntity: every 80 world ticks the pyramid check, then the effects for the players in range (pyramid-live.js, the
    // singleplayer tick). Each grant also goes to that player as an S1D entity-effect message (`effectsOut`, delivered by the connection).
    tickBeacons(this.tileEntities.beacons, { world: this.world, time: this.time, apply: (pl, e) => {
      const p = pl.player;
      p.survival.effects.add(e);
      (p.effectsOut ??= []).push({ id: e.id, amplifier: e.amplifier, duration: e.duration, ambient: !!e.ambient });
    }, players: [...this.players.values()].map(p => ({ x: p.position.x, y: p.position.y, z: p.position.z, width: PHYSICS.width, height: PHYSICS.height, player: p })) });
    for (const key of new Set([...beforeLit, ...this.redstone.lit])) if (beforeLit.has(key) !== this.redstone.lit.has(key)) {
      const [x, y, z] = key.split(',').map(Number);
      this.changes.set(key, [x, y, z, this.world.get(x, y, z), this.world.getMeta(x, y, z)]);
    }
    for (const [x, y, z] of this.changes.values()) this.light.update(x, y, z);
    const final = [...this.changes.values()].map(([x, y, z]) => [x, y, z, this.world.get(x, y, z), this.world.getMeta(x, y, z)]);
    this.changes.clear();
    for (const [x, y, z, b] of final) this.dropTiles(x, y, z, b);
    // PlayerInstance.sendChunkUpdate: under 64 changed cells in a chunk go as cells, 64 resend the chunk (protocol.js splitChanges).
    const { changes, chunks } = splitChanges(final, (cx, cz) => this.world.chunks.get(`${cx},${cz}`), (cx, cz, mask) => describeTiles(this.tileEntities, cx, cz, mask));
    // sendChunkUpdate's other branches: each changed cell that is not inside a resent chunk sends its tile entity's description, and so does an
    // edited tile (dirtyTiles). They ride in `tiles`; expandChunks adds the descriptions of the resent chunks.
    const tiles = [], seen = new Set(), covered = (x, y, z) => chunks.some(c => c.x === x >> 4 && c.z === z >> 4 && (c.mask >> (y >> 4) & 1));
    for (const [x, y, z] of [...changes, ...[...this.dirtyTiles].map(k => k.split(',').map(Number))]) {
      const key = `${x},${y},${z}`;
      if (seen.has(key) || covered(x, y, z)) continue;
      seen.add(key);
      const t = describeCell(this.tileEntities, x, y, z);
      if (t) tiles.push(t);
    }
    this.dirtyTiles.clear();
    return { type: 'tick', tick: this.ticks, time: this.time, changes, ...(chunks.length ? { chunks } : {}), ...(tiles.length ? { tiles } : {}), players: this.presence(), weather: this.weather.save(), redstone: { lit: [...this.redstone.lit] }, ...this.itemsField(), ...this.serverItems.tickFields(), ...this.containers.actionsField() };
  }
  // `items` rides in a tick while any exist, and once more (empty) after the last one is gone.
  itemsField() { const list = this.itemList(); if (!list.length && !this.itemsSent) return {}; this.itemsSent = list.length; return { items: list }; }
  presence(dimension = 0) { return [...this.players.values()].filter(p => (p.dimension | 0) === dimension).map(p => ({ id: p.id, name: p.name, x: p.position.x, y: p.position.y, z: p.position.z,
    yaw: p.yaw, pitch: p.pitch, flying: p.flying, grounded: p.grounded, sneak: p.input.sneak, sprinting: p.motion.sprinting, swing: p.swing,
    held: p.survival.held, ySize: p.motion.ySize, skin: p.skin, using: !!p.itemInUse, ...(p.mount ? { riding: p.mount.key } : {}), ...(p.dead ? { dead: true } : {}), ...(p.vitals?.hurt ? { hurt: true } : {}) })); } // b61: `hurt` = S19 status 2 for the other players' copies
  snapshot(playerId) { const other = this.dimensions.snapshotFor(playerId); if (other) return other; /* b61: a Nether player's world */ const w = this.world; return { gameMode: this.gameMode, items: this.itemList(), seed: w.seed, biome: w.biome, generationVersion: w.generationVersion,
    time: this.time, ticks: this.ticks, columns: [...w.chunks.values()].map(encodeColumn), players: this.presence(), weather: this.weather.save(), redstone: { lit: [...this.redstone.lit] }, contTiles: this.containers.describeAll() }; }
  save() {
    for (const p of this.players.values()) this.savedPlayers.set(p.resumeKey, this.savePlayer(p));
    return { version: 1, seed: this.world.seed, biome: this.world.biome, generationVersion: this.world.generationVersion,
      edits: [...this.world.edits], time: this.time, ticks: this.ticks, gameRules: this.gameRules, difficulty: this.difficulty, newPlayerMode: this.newPlayerMode, weather: this.weather.save(), worldRandom: this.weather.saveSimulation(),
      farms: this.farming.serialize(), fluidTicks: this.fluids.save(), fireTicks: this.fire.save(), falling: this.falling.serialize(), fallingTicks: this.falling.save(),
      redstone: this.redstone.save(), tiles: this.tiles.serialize(), ...this.serverItems.save(), mobs: this.mobs.save(), projectiles: this.dispense.save(), vehicles: this.vehicles.save(), ...this.dimensions.saveField(),
      tileEntities: { signs: this.tileEntities.signs.toJSON(), skulls: this.tileEntities.skulls.toJSON(), beacons: this.tileEntities.beacons.toJSON(), spawners: this.tileEntities.spawners.toJSON() }, players: [...this.savedPlayers] };
  }
}
