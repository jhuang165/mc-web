import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { WATER, LAVA, WEB } from "./world.js";
import { fromOriginal } from "./block-registry.js";
import { revengeOf } from "./revenge-target.js";
import { setPathNodeCap } from "./pathfinding.js";
import { makeStack } from "./inventory.js";
import { itemFromOriginal } from "./region-import.js";

// Replays one EndermanWolfProbe record (public/research/enderman-wolf-b42-reference.json): the same arena, entity Randoms seeded like the probe's (seed * 10 + index) and logging their draws as
// VillageFightProbe.Log does (nextInt(bound) "i<bound>", nextFloat "f", nextGaussian "g", nextBoolean "b", nextDouble "d"), the player a plain record the host would give the mobs (position, look, helmet,
// game mode, sneaking, invisibility). Per tick a state is [mob rows, sounds, player health lost, player revenge index].
export const reference42 = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b42-reference.json", import.meta.url)));
export const reference44 = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b44-reference.json", import.meta.url)));
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
  C: "cow", M: "mooshroom", P: "pig", R: "horse", L: "ocelot", U: "ocelot", G: "iron_golem", N: "snow_golem", K: "witch", X: "creeper", c: "cow", p: "pig", m: "mooshroom" }; // b44: the other EntityAITasks mobs (lower case: a baby)
const ANIMALS = new Set(["cow", "mooshroom", "pig", "horse", "ocelot", "sheep"]);
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
    set: (x, y, z, b, _notify, m = 0) => cells.set(key(x, y, z), [b, m]), put: (x, y, z, b, m) => cells.set(key(x, y, z), [b, m]), solid: (x, y, z) => (cells.has(key(x, y, z)) ? ![0, WATER, LAVA, WEB].includes(cells.get(key(x, y, z))[0]) : y < 0), surface: () => 1, spawn: () => ({ x: 5.5, y: 0, z: 5.5 }) };
}
const RAD = Math.PI / 180;

export function replayEndermanWolf(r) {
  const was = setPathNodeCap(Infinity);
  try { return run(r); } finally { setPathNodeCap(was); }
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
  const ents = [], logs = [];
  [...types].forEach((ch, i) => {
    const [x, z, y0 = 0] = r.pos[i], e = ew.create(TYPE_OF[ch], x, y0, z);
    ew.entities.push(e);
    e.growingAge = "cpm".includes(ch) ? -24000 : 0; e.onGround = true;
    if (e.type === "zombie") e.knockbackResistance = 0;
    for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) e[k] = 0;
    e.yaw = 0;
    if (ch === "T" || ch === "S" || ch === "O") { e.owner = "player"; e.health = 20; if (ch === "O") e.ownerUuid = "someone"; if (ch === "S") e.sitWish = true; }
    if (ch === "A") e.angry = true;
    if (ch === "U") { e.owner = "player"; e.health = 10; }
    if (ch === "R") { e.horse.maxHealth = e.health = 20; e.horse.speed = f32(0.2); } // fixed in the probe too (the rolled health and speed are not task draws)
    const lr = new LogRandom(BigInt(r.seed * 10 + i)); logs.push(lr); setEntityRandom(e, lr);
    ents.push(e);
  });
  const survival = new Survival({}, "survival");
  survival.difficulty = 2; survival.protection = 0; survival.health = 1000;
  const player = { x: r.pos[n][0], y: r.pos[n][2] ?? 0, z: r.pos[n][1], health: 1000, alive: true, isPlayer: true, yaw: 0 };
  ew.ai.player.unticked = true;
  ew.ai.budget.perTick = Infinity;
  ew.look = { yaw: 180 * RAD, pitch: 0 };
  ew.playerLook = () => ew.look; // OcelotTempt's scared check reads the player's view
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
      else if (op === "health") ents[Number(p[2])].health = Number(p[3]);
      else if (op === "use") {
        // player-edit-simulation.js's order for the mobs here: wolf, ocelot, then EntityAnimal.interact (feed).
        const e = ents[Number(p[2])];
        if (e.type === "wolf") ew.wolfInteract(e, survival);
        else if (e.type === "ocelot") ew.ocelotInteract(e, survival);
        else ew.feed(e, survival.inventory.held?.id ?? 0, survival);
        held = survival.inventory.held?.id ?? 0;
      }
      else if (op === "hold") held = ITEM_OF[p[2]] ?? Number(p[2]); // original item id -> the project's (bone 352 -> 311, raw porkchop 319 -> 202); the player's held item id (the beg tasks)
      else if (op === "sneak") ew.ai.player.sneaking = p[3] === "on";
      else if (op === "angry") ents[Number(p[2])].angry = true;
      else if (op === "sit") ents[Number(p[2])].sitWish = p[3] === "on";
      else if (op === "walk") { vel[Number(p[2])] = [Number(p[3]), Number(p[4])]; }
      else if (op === "move") { const k = Number(p[2]), e = k === n ? player : ents[k]; e.x = Number(p[3]); e.z = Number(p[4]); if (p.length > 5) e.y = Number(p[5]); }
      else if (op === "melee") ew.attack(ents[Number(p[2])], 0, survival, player);
      else if (op === "hit") {
        const v = Number(p[2]), a = ents[Number(p[3])];
        if (v === n) { const hit = survival.scaledDamage(Math.fround(Number(p[4])), "a " + a.type, { from: a }); if (hit) ew.ai.playerHurtBy(a); }
        else ew.attackEntityFrom(ents[v], Number(p[4]), { from: { x: a.x, z: a.z }, attacker: a, name: "mob", player: false });
      }
    }
    player.x += vel[n][0]; player.z += vel[n][1];
    ew.ai.beginTick(player, survival, held);
    for (const l of logs) l.log.length = 0;
    ew.events.length = 0;
    ew.tick(player, survival, held);
    if (ew._golemBalls) ew._golemBalls.balls.length = 0; // the probe never ticks the snowballs a snow golem throws (the shot's draws are in the record, the flight is not)
    // The probe never ticks a baby the mating task spawned (World.spawnEntityInWorld adds it to no tick list there), so the replay drops it too.
    ew.entities = ew.entities.filter((x) => ents.includes(x));
    const sounds = ew.events.filter((e) => e.sound).map((e) => [e.sound, e.volume, e.pitch]);
    const damage = 1000 - survival.health;
    survival.health = 1000;
    const rows = ents.map((e, i) => {
      const b = ew.ai.brain(e);
      const flags = e.type === "enderman" ? [e.screaming ? 1 : 0, e.aggressive ? 1 : 0, e.stareCount ?? 0, e.chaseTimer ?? 0, e.carried ?? 0]
        : e.type === "wolf" ? [e.angry ? 1 : 0, e.sitting ? 1 : 0, e.owner ? 1 : 0, e.sitWish ? 1 : 0, e.inWater ? 1 : 0, ...(r.ext ? [e.love ?? 0, e.growingAge] : [])]
        : r.ext && ANIMALS.has(e.type) ? [e.love ?? 0, e.growingAge] : [];
      return [e.x, e.y, e.z, e.removedHealth ?? e.health, idxOf(b.attackTarget), e.revenge ? (revengeOf(e) === "player" ? n : idxOf(revengeOf(e))) : -1, flags, logs[i].log.slice(), [e.vx, e.vy, e.vz, e.rotationYaw, e.rotationPitch ?? 0, e.rotationYawHead, e.renderYawOffset, e.onGround ? 1 : 0, e.jumping ? 1 : 0, e.moveForward ?? 0, e.moveStrafing ?? 0]];
    });
    states.push([rows, sounds, damage, idxOf(ew.ai.player.hurtBy)]);
  }
  return { states };
}
const f32 = Math.fround;

// First tick, mob and field where a replay differs from the record (null when none). Everything is compared for every tick of every record: position, health, target, revenge, flags and every Entity.rand draw
// of every mob, the sounds (name, volume, pitch, in order) and the player's damage and revenge target.
export const comparedTicks = (r) => r.ticks;
const same = (a, b) => (typeof a === "number" && typeof b === "number" ? Object.is(a, b) || a === b : JSON.stringify(a) === JSON.stringify(b));
function soundOf(s) { const [name, vol, pitch] = s.replace(/@$/, "").split("|"); return [name, Math.fround(Number(vol)), Math.fround(Number(pitch))]; }
export function firstDivergence(r, got) {
  const n = r.types.length;
  for (let t = 0; t < r.ticks; t++) {
    const want = r.rows[t], have = got.states[t];
    for (let i = 0; i < n; i++) {
      const w = want[0][i], g = have[0][i];
      for (let k = 0; k < 6; k++) if (!same(w[k], g[k])) return [t, i, ["x", "y", "z", "health", "target", "revenge"][k], w[k], g[k]];
      if (JSON.stringify(w[6]) !== JSON.stringify(g[6])) return [t, i, "flags", w[6], g[6]];
      if (JSON.stringify(w[7]) !== JSON.stringify(g[7])) return [t, i, "draws", w[7], g[7]];
      for (let k = 0; k < 11; k++) if (!same(w[8][k], g[8][k])) return [t, i, ["vx", "vy", "vz", "yaw", "pitch", "headYaw", "bodyYaw", "onGround", "jumping", "moveForward", "moveStrafing"][k], w[8][k], g[8][k]];
    }
    const ws = want[1].map(soundOf).filter(([name]) => name !== "" && name !== "none"), gs = have[1].map((s) => [s[0], s[1], s[2]]);
    if (JSON.stringify(ws) !== JSON.stringify(gs)) return [t, "sounds", ws, gs];
    if (Math.abs(want[2] - have[2]) > 1e-9) return [t, "player damage", want[2], have[2]];
    if (want[3] !== have[3]) return [t, "player revenge", want[3], have[3]];
  }
  return null;
}
