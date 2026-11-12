import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { EntityWorld, ENTITY_TYPES, setEntityRandom, entityRandom, setMovingBoxes } from "./entities.js";
import { growSize } from "./horse-live.js";
import { Survival } from "./survival.js";
import { WATER, LAVA, WEB, PISTON_MOVING } from "./world.js";
import { fromOriginal } from "./block-registry.js";
import { revengeOf } from "./revenge-target.js";
import { setPathNodeCap } from "./pathfinding.js";
import { makeStack } from "./inventory.js";
import { itemFromOriginal } from "./region-import.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { applyExplosion } from "./explosion-simulation.js";
import { WitchPotions } from "./witch-potions.js";
import { setGameRuleSource, ruleOn } from "./game-rules.js";
import { powerCreeper, creeperIgnite } from "./creeper.js";
import { struckByLightning } from "./weather.js";
import { addMobEffect, speedModifiers } from "./mob-effects.js";
import { liveAttribute } from "./mob-attributes.js";
import { slimeFields } from "./slime.js";
import { RedstoneWorld, pistonTile } from "./redstone.js";
import { installPistons } from "./piston-live.js";

// Replays one EndermanWolfProbe record (public/research/enderman-wolf-b42-reference.json): the same arena, entity Randoms seeded like the probe's (seed * 10 + index) and logging their draws as
// VillageFightProbe.Log does (nextInt(bound) "i<bound>", nextFloat "f", nextGaussian "g", nextBoolean "b", nextDouble "d"), the player a plain record the host would give the mobs (position, look, helmet,
// game mode, sneaking, invisibility). Per tick a state is [mob rows, sounds, player health lost, player revenge index].
export const reference42 = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b42-reference.json", import.meta.url)));
export const reference44 = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b44-reference.json", import.meta.url)));
export const referenceCW = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b45cw-reference.json", import.meta.url)));
export const reference46 = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b46mp-reference.json", import.meta.url)));
export const reference47sp = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b47sp-reference.json", import.meta.url)));
export const reference45 = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b45-reference.json", import.meta.url)));
export const reference50 = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b50lb-reference.json", import.meta.url)));
export const reference51 = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b51sf-reference.json", import.meta.url)));
export const reference49 = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b49po-reference.json", import.meta.url)));
export const reference48 = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b48pp-reference.json", import.meta.url)));
export const reference47h = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b47h-reference.json", import.meta.url)));
export const reference43 = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b43-reference.json", import.meta.url)));
class LogRandom extends JavaRandom {
  log = [];
  nextBoolean() { const r = super.nextBoolean(); this.log.push("b"); return r; }
  nextInt(b) { const r = super.nextInt(b); if (b !== undefined) this.log.push("i" + b); return r; }
  nextFloat() { this.log.push("f"); return super.nextFloat(); }
  nextGaussian() { this.log.push("g"); this.inGauss = true; try { return super.nextGaussian(); } finally { this.inGauss = false; } }
  nextDouble() { const r = super.nextDouble(); if (!this.inGauss) this.log.push("d"); return r; }
}
const TYPE_OF = { E: "enderman", W: "wolf", A: "wolf", T: "wolf", S: "wolf", O: "wolf", H: "sheep", Z: "zombie",
  C: "cow", M: "mooshroom", P: "pig", R: "horse", L: "ocelot", U: "ocelot", G: "iron_golem", B: "spider", I: "slime", f: "silverfish", g: "giant", z: "pigman", a: "blaze", N: "snow_golem", K: "witch", X: "creeper", c: "cow", p: "pig", m: "mooshroom",
  Q: "horse", q: "horse", D: "horse", F: "horse", Y: "horse", V: "horse", 3: "horse", 4: "horse", 5: "horse", 6: "horse" }; // b44: the other EntityAITasks mobs (lower case: a baby)
const ANIMALS = new Set(["cow", "mooshroom", "pig", "horse", "ocelot", "sheep"]);
// b45 (horses): tame adult horses Q and q, a tame donkey D, a wild foal F, a tame foal Y: [type, variant, tame, growing age, max health, speed, jump] (EndermanWolfProbe.b45Horse); R is the wild adult the batch 44 probe builds (health, max health and speed fixed)
const HORSES45 = { R: [0, 0, false, 0, 20, Math.fround(0.2), 0.7], Q: [0, 258, true, 0, 24, 0.25, 0.55], q: [0, 773, true, 0, 18, 0.3, 0.65], D: [1, 0, true, 0, 22, 0.175, 0.5], F: [0, 258, false, -24000, 20, 0.2, 0.7], Y: [0, 258, true, -24000, 20, 0.2, 0.7], 3: [3, 0, false, 0, 15, 0.2, 0.5], 4: [4, 0, false, 0, 15, 0.2, 0.5], 5: [3, 0, true, 0, 15, 0.2, 0.5], 6: [4, 0, true, 0, 15, 0.2, 0.5] }; // b47h: zombie (3) and skeleton (4) horses, wild and tame
const ITEM_OF = { 352: 311, 319: 202 };
const key = (x, y, z) => `${x},${y},${z}`;
const PORT_ID = { 1: 3, 9: WATER, 20: 9 };
function plain(blocks = []) {
  const cells = new Map();
  for (const [x0, y0, z0, x1, y1, z1, id, meta] of blocks) for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    if (id in PORT_ID) cells.set(key(x, y, z), [PORT_ID[id], meta]);
    else { const c = fromOriginal(id, meta); cells.set(key(x, y, z), [c.id, c.meta]); }
  }
  return { numericSeed: 1, height: 256, floorBelow: true, minX: -3e7, maxX: 3e7, minZ: -3e7, maxZ: 3e7,
    get: (x, y, z) => cells.get(key(x, y, z))?.[0] ?? (y < 0 ? PORT_ID[1] : 0), getMeta: (x, y, z) => cells.get(key(x, y, z))?.[1] ?? 0,
    set: (x, y, z, b, _notify, m = 0) => cells.set(key(x, y, z), [b, m]), put: (x, y, z, b, m) => cells.set(key(x, y, z), [b, m]), solid: (x, y, z) => (cells.has(key(x, y, z)) ? ![0, WATER, LAVA, WEB, PISTON_MOVING].includes(cells.get(key(x, y, z))[0]) : y < 0), surface: () => 1, spawn: () => ({ x: 5.5, y: 0, z: 5.5 }) };
}
const RAD = Math.PI / 180;

export function replayEndermanWolf(r) {
  const was = setPathNodeCap(Infinity);
  try { return run(r); } finally { setPathNodeCap(was); setGameRuleSource(null); setMovingBoxes(null); }
}
function run(r) {
  const types = r.types, n = types.length;
  const ew = new EntityWorld(plain(r.blocks), [], () => 0.5);
  ew.difficulty = 2;
  // Original block 62 (lit furnace) is the port's furnace with a fire; EntityAIOcelotSit reads the furnace's lit id, which the plain cell map cannot hold.
  const lit = (x, y, z) => (r.blocks ?? []).some(([x0, y0, z0, x1, y1, z1, id]) => id === 62 && x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1);
  ew.ocelotBlocks = { chestUsers: () => 0, furnaceLit: lit };
  ew.worldRandom = new JavaRandom(r.seed);
  let day = false, rain = false, bright = r.bright, held = 0;
  ew.isDaytime = () => day;
  ew.isRaining = () => rain;
  ew.brightnessLevel = () => bright;
  ew.lightAt = () => r.bright;
  const roofed = (x, z) => r.roofs.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
  ew.ai.deps.canSeeSky = (x, y, z) => !roofed(x, z);
  const ents = [], logs = [], init = [], spawnOpts = {};
  [...types].forEach((ch, i) => {
    const [x, z, y0 = 0] = r.pos[i], e = ew.create(TYPE_OF[ch], x, y0, z);
    ew.entities.push(e);
    e.growingAge = "cpm".includes(ch) ? -24000 : 0; e.onGround = true;
    if (e.type === "zombie") e.knockbackResistance = 0;
    for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) e[k] = 0;
    e.yaw = 0;
    if (ch === "T" || ch === "S" || ch === "O") { e.owner = "player"; e.health = 20; if (ch === "O") e.ownerUuid = "someone"; if (ch === "S") e.sitWish = true; }
    if (ch === "A") e.angry = true;
    if (ch === "I") Object.assign(e, slimeFields(4, () => 0), { jumpDelay: 20 }); // b49po: a size 4 slime with the probe's fixed jump timer (bn = 20)
    if (ch === "U") { e.owner = "player"; e.health = 10; }
    if (ch === "R") { e.horse.maxHealth = e.health = 20; e.horse.speed = f32(0.2); } // fixed in the probe too (the rolled health and speed are not task draws)
    if (r.init && HORSES45[ch]) {
      const [type, variant, tame, age, maxHealth, speed, jump] = HORSES45[ch];
      Object.assign(e.horse, { type, variant, tame, maxHealth, speed, jump });
      e.growingAge = age; e.health = maxHealth;
    }
    const lr = new LogRandom(BigInt(r.seed * 10 + i)); logs.push(lr); setEntityRandom(e, lr);
    if (ch === "V") ew.onSpawnWithEgg(e, spawnOpts); // the herd's GroupData passes on to the next V
    init.push(lr.log.slice()); lr.log.length = 0;
    ents.push(e);
  });
  const survival = new Survival({}, "survival");
  survival.difficulty = 2; survival.protection = 0; survival.health = 1000;
  // Batch 45 (creepers and witches): rows carry a fifth element [explosions, spawned entities, changed cells, player motion]; the arena also needs the
  // item, orb and explosion machinery, the witch's potion list (seeded per throw from the record) and the gamerule mobGriefing.
  const xcw = r.rows[0][5] !== undefined && !r.init; // the horse set (b45, record.init) also has a sixth row element
  const items = new ItemEntities(() => 0.5), orbs = new ExperienceOrbs([], () => 0.5), pv = { x: 0, y: 0, z: 0 };
  const potionSeeds = [];
  let grief = true;
  if (xcw) {
    setGameRuleSource((name) => (name === "mobGriefing" ? grief : ruleOn(null, name)));
    ew.potions = new WitchPotions(ew, () => potionSeeds.shift() / 2 ** 48);
    ew.potions.tick = () => {}; ew.potions.tickOne = () => {}; // the probe never flies a potion it spawned: the record keeps the launch
  }
  const player = { x: r.pos[n][0], y: r.pos[n][2] ?? 0, z: r.pos[n][1], health: 1000, alive: true, isPlayer: true, yaw: 0 };
  // Batch 46 (mobpush): the probe also ticks its player like EntityPlayerMP.onUpdateEntity after the mobs (the world's player collision and motion) and puts the server copy back at the client's place;
  // the rows' player motion is compared every tick (x and z).
  const x48 = /^b(4[89](pp|po)|50lb|51sf)/.test(r.name), x47 = x48 || r.name.startsWith("b47sp") || r.name.startsWith("b46mp"), x46 = x47, b47 = r.name.startsWith("b47h");
  ew.ai.player.unticked = !x46;
  if (x48) ew.ai.player.onGround = true; // the probe's copy starts as a grounded player (EndermanWolfProbe B46: onGround true)
  if (x46) ew.ai.player.motion.y = -0.0784000015258789; // the probe player starts as a grounded EntityLivingBase (motionY -0.0784), not on its first tick with motionY 0
  ew.ai.budget.perTick = Infinity;
  // b48pp: real moving piston blocks (redstone.js tiles, piston-live.js pushes) over the arena; the tile loop runs after every entity and before the server copy's update (World.updateEntities, then the network tick).
  const moving = [], rw = x48 ? new RedstoneWorld({ seed: 1 }) : null;
  if (x48) {
    const pistons = installPistons({ redstone: rw, world: ew.world, entities: { mobs: () => ew, serverPlayer: () => ew.ai.player } });
    setMovingBoxes((box) => pistons.collisionBoxes(box));
    ew.afterEntities = () => {
      rw.updateTileEntities();
      for (const m of moving) if (!m.done && m.tile.invalid) { // TileEntityPiston.updateEntity's last call put the stored block back (the probe's cell map follows)
        m.done = true;
        const c = m.tile.block in PORT_ID ? { id: PORT_ID[m.tile.block], meta: m.tile.meta } : fromOriginal(m.tile.block, m.tile.meta); // the tile stores the original's block id
        ew.world.put(m.tile.x, m.tile.y, m.tile.z, c.id, c.meta);
        cells.push([m.tile.x, m.tile.y, m.tile.z, 0, 0]);
      }
    };
  }
  ew.look = { yaw: 180 * RAD, pitch: 0 };
  ew.playerLook = () => ew.look; // OcelotTempt's scared check reads the player's view
  const booms = [], cells = [], primed = [], gone = new Set(), none = { explode() {} };
  // World.newExplosion for one creeper event (living-simulation.js explodeEvent): Explosion.doExplosionA and B over the arena's systems.
  const boom = (ev) => {
    const x = ev.explode, src = x.source;
    const out = applyExplosion({ world: ew.world, random: ew.worldRandom, mobs: ew, items, xpOrbs: orbs, arrows: none, projectiles: none, primed, survival, position: player, velocity: pv, farming: { observe() {} } },
      { x: x.x, y: x.y, z: x.z, size: x.size, exploder: src, attacker: src, smoking: x.smoking ?? true, flaming: !!x.flaming },
      { sound: (name, o) => ew.events.push({ sound: name, volume: o.volume, pitch: o.pitch }) });
    booms.push([x.x, x.y, x.z, x.size, x.flaming ? 1 : 0, x.smoking ?? true ? 1 : 0, out.playerHit ? out.playerHit.push : null]);
    for (const c of out.changes) if (c[1] >= 0) cells.push([c[0], c[1], c[2], 0, 0]); // the probe's world tracks no cell of its implicit floor (y < 0)
    if (src) { ew.entities = ew.entities.filter((m) => m !== src); gone.add(ents.indexOf(src)); } // EntityCreeper.func_146077_cc: setDead
  };
  if (xcw) ew.explodeInline = (ev) => boom(ev); // a creeper explodes inside its own update, before the mobs after it in the list move
  const script = r.script.map((s) => s.split(" ")), vel = new Array(n + 1).fill(null).map(() => [0, 0]), states = [];
  const idxOf = (b) => (!b ? -1 : b.isPlayer ? n : ents.indexOf(b.e ?? b));
  for (let t = 0; t < r.ticks; t++) {
    for (const p of script) {
      if (Number(p[0]) !== t) continue;
      const op = p[1];
      if (op === "look") ew.look = { yaw: f32((180 - Number(p[2])) * RAD), pitch: f32(-Number(p[3]) * RAD) }, player.yaw = ew.look.yaw;
      else if (op === "helmet") survival.inventory.armor[3] = p[2] === "0" ? null : { id: p[2] === "86" ? 67 : 1, count: 1, damage: 0 };
      else if (op === "day") day = p[2] === "on";
      else if (op === "rain") rain = p[2] === "on";
      else if (op === "bright") bright = Number(p[2]);
      else if (op === "creative") survival.mode = p[3] === "on" ? "creative" : "survival";
      else if (op === "adventure") survival.mode = p[3] === "on" ? "adventure" : "survival";
      else if (op === "invisible") { if (p[3] === "on") survival.effects.add({ id: 14, duration: 1e9, amplifier: 0 }); else survival.effects.remove(14); }
      else if (op === "holdn") {
        const m = p[2] === "0" ? null : itemFromOriginal(Number(p[2]), 0);
        survival.inventory.main[0] = m ? makeStack(m.id, Number(p[3]), m.damage ?? 0) : null; survival.inventory.current = 0; held = m ? m.id : 0;
      }
      else if (op === "age") { const e = ents[Number(p[2])], was = e.growingAge; e.growingAge = Number(p[3]); growSize(e, was, ew.world); } // b47h: EntityAgeable.setGrowingAge resizes the box at once
      else if (op === "mount") { const at = { x: player.x, y: player.y, z: player.z }; ew.horseSeats.mount(ents[Number(p[2])], Object.assign(player, { player: true })); Object.assign(player, at); } // b47h: EntityPlayerMP.mountEntity(horse) (the probe seats the rider only after the horse's update, wi.ac(), so the player stays put for this tick)
      else if (op === "temper") ents[Number(p[2])].horse.temper = Number(p[3]);
      else if (op === "health") ents[Number(p[2])].health = Number(p[3]);
      else if (op === "health-old") ents[Number(p[2])].health = Number(p[3]);
      else if (op === "use") {
        // player-edit-simulation.js's order for the mobs here: wolf, ocelot, then EntityAnimal.interact (feed).
        const e = ents[Number(p[2])];
        if (e.type === "creeper") creeperIgnite(e, entityRandom(e)); // EntityCreeper.interact (flint and steel); its sound is cleared with the tick's ops
        else if (e.type === "wolf") ew.wolfInteract(e, survival);
        else if (e.type === "ocelot") ew.ocelotInteract(e, survival);
        else if (e.type === "horse") ew.horseInteract(e, survival, { sneak: false, horses: { player: Object.assign(player, { player: true }), mount: (h, p) => ew.horseSeats.mount(h, p) } }); // b47h: the mount action seats the player
        else ew.feed(e, survival.inventory.held?.id ?? 0, survival);
        held = survival.inventory.held?.id ?? 0;
      }
      else if (op === "hold" && xcw) { const m = p[2] === "0" ? null : itemFromOriginal(Number(p[2]), 0); survival.inventory.main[0] = m ? makeStack(m.id, 1, 0) : null; survival.inventory.current = 0; held = m ? m.id : 0; }
      else if (op === "hold") held = ITEM_OF[p[2]] ?? Number(p[2]); // original item id -> the project's (bone 352 -> 311, raw porkchop 319 -> 202); the player's held item id (the beg tasks)
      else if (op === "sneak") ew.ai.player.sneaking = p[3] === "on";
      else if (op === "fly") ew.ai.player.flying = p[3] === "on"; // b47sp: abilities.isFlying of the server copy
      else if (op === "piston") { // b48pp: BlockPistonMoving with its TileEntityPiston in the cell (original block ids)
        const [px, py, pz, face, ext, block, meta] = p.slice(2, 9).map(Number), tile = pistonTile(block, meta, face, ext === 1, p[9] === "1");
        rw.setRaw(px, py, pz, 36, face); ew.world.put(px, py, pz, PISTON_MOVING, face); rw.setTileEntity(px, py, pz, tile); tile.world = true; tile.x = px; tile.y = py; tile.z = pz;
        moving.push({ tile, done: false });
      }
      else if (op === "ground") { /* b47sp: the onGround flag of every position packet; the record carries it (row element 6) */ }
      else if (op === "angry") ents[Number(p[2])].angry = true;
      else if (op === "sit") ents[Number(p[2])].sitWish = p[3] === "on";
      else if (op === "walk") { vel[Number(p[2])] = [Number(p[3]), Number(p[4])]; }
      else if (op === "move") { const k = Number(p[2]), e = k === n ? player : ents[k]; e.x = Number(p[3]); e.z = Number(p[4]); if (p.length > 5) e.y = Number(p[5]); }
      else if (op === "melee") ew.attack(ents[Number(p[2])], 0, survival, player);
      else if (op === "difficulty") ew.difficulty = survival.difficulty = Number(p[2]);
      else if (op === "grief") grief = p[2] === "on";
      else if (op === "power") powerCreeper(ents[Number(p[2])]);
      else if (op === "fire") { if (Number(p[2]) === n) survival.setFire?.(Number(p[3])); else ents[Number(p[2])].fire = Number(p[3]) * 20; }
      else if (op === "effect") { const k = Number(p[2]), id = Number(p[3]); if (k === n) survival.effects.add({ id, duration: Number(p[4]), amplifier: 0 }); else addMobEffect(ents[k], id, Number(p[4]), 0); }
      else if (op === "bolt") { // Entity.onStruckByLightning on the mob (weather-simulation.js: 5 fire damage, the fire counter, a creeper turns charged)
        const e = ents[Number(p[2])], hit = struckByLightning(e.fire || 0, e.equipment ?? []);
        ew.hazard(e, hit.damage, "inFire"); e.fire = hit.fire;
        if (e.type === "creeper") powerCreeper(e);
      }
      else if (op === "arrowkill") ew.damage(ents[Number(p[2])], Number(p[3]), 0, 0, false, "skeleton", { arrow: true }); // DamageSource.causeArrowDamage(arrow, skeleton at the origin)
      else if (op === "hit") {
        const v = Number(p[2]), a = ents[Number(p[3])];
        if (v === n) { const hit = survival.scaledDamage(Math.fround(Number(p[4])), "a " + a.type, { from: a }); if (hit) ew.ai.playerHurtBy(a); }
        else ew.attackEntityFrom(ents[v], Number(p[4]), { from: { x: a.x, z: a.z }, attacker: a, name: "mob", player: false });
      }
    }
    player.x += vel[n][0]; player.z += vel[n][1];
    if (x46) player.y = r.rows[t][7]; // the client's y (the probe's server copy falls and rises with its own motion; the replay takes it as the position packet's y)
    if (!x46) ew.ai.beginTick(player, survival, held); // b46mp, b47sp: ew.tick's own beginTick is the only one, so the position packet counter and the revenge timer count once a tick
    for (const l of logs) l.log.length = 0;
    booms.length = cells.length = 0;
    const pending = xcw ? ew.events.filter((ev) => !ev.sound) : []; // the kill a script op made queued its drops, orbs and so on: they run with this tick's events
    if (!b47) ew.events.length = 0; // b47h: the sounds a script op made (feed, rear) are in the tick's row
    if (xcw) { potionSeeds.length = 0; potionSeeds.push(...r.rows[t][5][1].filter((x) => x[0] === "potion").map((x) => x[8])); }
    if (!x47) ew.ai.player.sent = null; // every harness but b47sp sets the probe player (the server copy itself) where the script puts it, so every tick is a position packet (b46mp: put back at the client's place, y included; b47h: a thrown or seated rider)
    if (x46 && !(x48 && (r.rows[t][9].length || r.rows[t][5][2].length))) ew.ai.player.onGround = r.rows[t][6] === 1; // the position packet's onGround flag, as the probe's server copy saw it (b48pp: on a tick with a push row 6 is read after the tile loop moved the copy, so the copy's own flag, kept from its last update, is the input then)
    ew.tick(player, survival, held);
    if (b47 && player.vehicle) ew.horseSeats.updateRiderPosition(player.vehicle); // b47h: the probe's wi.ac() after the horse's update seats the rider
    if (ew._golemBalls) ew._golemBalls.balls.length = 0; // the probe never ticks the snowballs a snow golem throws (the shot's draws are in the record, the flight is not)
    // The probe never ticks a baby the mating task spawned (World.spawnEntityInWorld adds it to no tick list there), so the replay drops it too.
    const kids = ew.entities.filter((x) => !ents.includes(x) && x.type === "horse").map(horseFlags);
    ew.entities = ew.entities.filter((x) => ents.includes(x));
    let sounds = ew.events.filter((e) => e.sound).map((e) => [e.sound, e.volume, e.pitch]);
    if (xcw) {
      // The events main.js drains (living-simulation.js drainMobEvents): sound, xp orbs, explosion, item drops, in queue order. An explosion queues its hurt sounds while it
      // damages the mobs and its random.explode last, as Explosion.doExplosionA runs before doExplosionB plays it.
      sounds = [];
      ew.events.unshift(...pending);
      for (let i = 0; i < ew.events.length; i++) {
        const ev = ew.events[i];
        if (ev.sound) sounds.push([ev.sound, ev.volume, ev.pitch]);
        if (ev.xp) orbs.spawn(ev.xp, ev.position);
        if (ev.explode) boom(ev);
        if (ev.drop) items.dropMob(ev.drop, ev.count, ev.position, ev.damage, ev);
      }
      ew.events.length = 0;
    }
    if (b47) ew.events.length = 0;
    const damage = 1000 - survival.health;
    survival.health = 1000;
    const rows = ents.map((e, i) => {
      const b = ew.ai.brain(e);
      const flags = xcw && e.type === "witch" ? [e.drinking ? 1 : 0, e.drinkTimer ?? 0, e.held ? e.held.damage : -1, liveAttribute(e, "generic.movementSpeed", ENTITY_TYPES.witch.movement, [...(e.drinking ? [[-0.25, 0]] : []), ...speedModifiers(e)])]
        : xcw && e.type === "creeper" ? [e.creeperState, e.fuseTime, e.lastActive, e.powered ? 1 : 0, e.ignited ? 1 : 0]
        : e.type === "enderman" ? [e.screaming ? 1 : 0, e.aggressive ? 1 : 0, e.stareCount ?? 0, e.chaseTimer ?? 0, e.carried ?? 0]
        : e.type === "wolf" ? [e.angry ? 1 : 0, e.sitting ? 1 : 0, e.owner ? 1 : 0, e.sitWish ? 1 : 0, e.inWater ? 1 : 0, ...(r.ext ? [e.love ?? 0, e.growingAge] : [])]
        : r.init && e.type === "horse" ? horseFlags(e)
        : r.ext && ANIMALS.has(e.type) ? [e.love ?? 0, e.growingAge] : [];
      return [e.x, e.y, e.z, e.removedHealth ?? e.health, idxOf(b.attackTarget), e.revenge ? (revengeOf(e) === "player" ? n : idxOf(revengeOf(e))) : -1, flags, logs[i].log.slice(), [e.vx, e.vy, e.vz, e.rotationYaw, e.rotationPitch ?? 0, e.rotationYawHead, e.renderYawOffset, e.onGround ? 1 : 0, e.jumping ? 1 : 0, e.moveForward ?? 0, e.moveStrafing ?? 0]];
    });
    const state = [rows, sounds, damage, idxOf(ew.ai.player.hurtBy), r.init ? kids : null];
    if (xcw) {
      // Spawned entities, in the record's order of kinds; the count of an item stack is summed per spot (dropFewItems makes one EntityItem of n, the port one of 1 each).
      const spawned = [];
      for (const it of items.items.splice(0)) spawned.push(["item-port", it.stack.id, it.stack.damage ?? 0, it.stack.count, it.x, it.y + 0.125, it.z]);
      for (const o of orbs.orbs.splice(0)) spawned.push(["xp", o.value, o.x, o.posY, o.z]);
      for (const _ of primed.splice(0)) spawned.push(["other", "xw"]); // EntityTNTPrimed (xw) a blast chained
      for (const b of ew.potions.projectiles.balls.splice(0)) spawned.push(["potion", b.damage, b.x, b.y, b.z, b.mx, b.my, b.mz]);
      const pm = ew.ai.player.motion; // b46mp: the server copy's motion (mob pushes, hits, blasts); the older sets: the blasts' push on `pv` only
      state.push([booms.slice(), spawned, cells.slice(), x46 ? [pm.x, pm.y, pm.z] : [pv.x, pv.y, pv.z]]);
      state.gone = [...gone];
      state.pos = [ew.ai.player.x, ew.ai.player.y, ew.ai.player.z]; // b47sp: where the server copy rests
      if (x48) state.pistons = rw.pistonTiles().map((t) => [t.x, t.y, t.z, t.progress, t.lastProgress]);
    }
    states.push(state);
  }
  return { states, init };
}
const f32 = Math.fround;
// b45: [love, growing age, type, variant, tame, temper, max health, speed, jump, health] as EndermanWolfProbe.horseFlags
const horseFlags = (e) => [e.love ?? 0, e.growingAge, e.horse.type, e.horse.variant, e.horse.tame ? 1 : 0, e.horse.temper, e.horse.maxHealth, e.horse.speed, e.horse.jump, e.health];

// First tick, mob and field where a replay differs from the record (null when none). Everything is compared for every tick of every record: position, health, target, revenge, flags and every Entity.rand draw
// of every mob, the sounds (name, volume, pitch, in order) and the player's damage and revenge target.
export const comparedTicks = (r) => r.ticks;
const same = (a, b) => (typeof a === "number" && typeof b === "number" ? Object.is(a, b) || a === b : JSON.stringify(a) === JSON.stringify(b));
function soundOf(s) { const [name, vol, pitch] = s.replace(/@$/, "").split("|"); return [name, Math.fround(Number(vol)), Math.fround(Number(pitch))]; }
export function firstDivergence(r, got) {
  const n = r.types.length;
  if (r.init && JSON.stringify(r.init) !== JSON.stringify(got.init)) return ["init", r.init, got.init];
  let exploded = false;
  for (let t = 0; t < r.ticks; t++) {
    const want = r.rows[t], have = got.states[t];
    for (let i = 0; i < n; i++) {
      const w = want[0][i], g = have[0][i];
      // A creeper that exploded is setDead: the original still finishes that update (it falls into its crater, one more AI step) and is never ticked again; the port removes it
      // at once. Only its health is compared on that tick.
      if (have.gone?.includes(i)) { if (!same(w[3], g[3])) return [t, i, "health", w[3], g[3]]; continue; }
      for (let k = 0; k < 6; k++) if (!same(w[k], g[k])) return [t, i, ["x", "y", "z", "health", "target", "revenge"][k], w[k], g[k]];
      if (JSON.stringify(w[6]) !== JSON.stringify(g[6])) return [t, i, "flags", w[6], g[6]];
      if (JSON.stringify(w[7]) !== JSON.stringify(g[7])) return [t, i, "draws", w[7], g[7]];
      for (let k = 0; k < 11; k++) if (!same(w[8][k], g[8][k])) return [t, i, ["vx", "vy", "vz", "yaw", "pitch", "headYaw", "bodyYaw", "onGround", "jumping", "moveForward", "moveStrafing"][k], w[8][k], g[8][k]];
    }
    // fire.fire: the blaze crackle is EntityBlaze.onLivingUpdate's isRemote half; the probe world double records it, the port plays it on the client copy.
    const ws = want[1].map(soundOf).filter(([name]) => name !== "" && name !== "none" && name !== "fire.fire"), gs = have[1].map((s) => [s[0], s[1], s[2]]);
    if (JSON.stringify(ws) !== JSON.stringify(gs)) return [t, "sounds", ws, gs];
    if (Math.abs(want[2] - have[2]) > 1e-9) return [t, "player damage", want[2], have[2]];
    if (want[3] !== have[3]) return [t, "player revenge", want[3], have[3]];
    if (want[5] && have[5]) {
      const [wb, ws, wc, wm] = want[5], [gb, gs, gc, gm] = have[5];
      if (wb.length) exploded = true;
      const bad = (k, a, b) => (!deepSame(a, b) ? [t, k, a, b] : null);
      const d = bad("explosions", wb, gb) ?? bad("spawned", spawnedOf(ws), spawnedOf(gs)) ?? bad("changed cells", wc.map((c) => c.slice(0, 3)).sort(cmp), gc.map((c) => c.slice(0, 3)).sort(cmp)) ?? (exploded && !r.name.startsWith("b46mp") && !r.name.startsWith("b47sp") && !/^b(4[89](pp|po)|50lb|51sf)/.test(r.name) ? bad("player motion", wm, gm) : null);
      const d2 = /^b(4[89](pp|po)|50lb|51sf)/.test(r.name) ? bad("player motion", wm, gm) ?? bad("server copy position", want[8], have.pos) ?? bad("moving tiles", want[9], have.pistons) : r.name.startsWith("b47sp") || r.name.startsWith("b46mp") ? bad("player motion", wm, gm) ?? bad("server copy position", want[8], have.pos) : null; // b47sp and b46mp (regenerated in batch 50 under the b47 harness): all three motion axes and the copy's resting position (row element 8)
      if (d) return d;
      if (d2) return d2; // the b46mp records compare the server copy's motion (x, z) every tick; the older sets only after a blast, the only push on a player their probe applied (its player is not ticked)
    }
    if (r.init && JSON.stringify(want[5]) !== JSON.stringify(have[4])) return [t, "spawned horses", want[5], have[4]];
  }
  return null;
}

// Batch 45 extras. Numbers compare as the other fields do (exact); lists of spawned entities compare as sets (the order the explosion and the death queue made them in is not a rule).
const cmp = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b));
const deepSame = (a, b) => (Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((v, i) => deepSame(v, b[i])) : same(a, b));
function spawnedOf(list) {
  const items = new Map(), out = [];
  for (const e of list) {
    if (e[0] === "item") {
      // The record's ids are the original's (blocks and items); the port's come through itemFromOriginal.
      const m = itemFromOriginal(e[1], e[2]) ?? { id: e[1], damage: e[2] }, k = JSON.stringify([m.id, m.damage ?? 0, e[4], e[5], e[6]]);
      items.set(k, (items.get(k) ?? 0) + e[3]);
    } else if (e[0] === "item-port") { const k = JSON.stringify([e[1], e[2], e[4], e[5], e[6]]); items.set(k, (items.get(k) ?? 0) + e[3]); }
    else if (e[0] === "xp") out.push(["xp", e[1], e[2], e[3], e[4]]); // the velocity is Math.random in EntityXPOrb's constructor
    else out.push(e.slice(0, 8));
  }
  for (const [k, n] of items) { const [id, dmg, x, y, z] = JSON.parse(k); out.push(["item", id, dmg, n, x, y, z]); }
  return out.sort(cmp);
}
