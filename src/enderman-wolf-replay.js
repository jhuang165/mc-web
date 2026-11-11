import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { WATER, LAVA, WEB } from "./world.js";
import { fromOriginal } from "./block-registry.js";
import { revengeOf } from "./revenge-target.js";
import { setPathNodeCap } from "./pathfinding.js";

// Replays one EndermanWolfProbe record (public/research/enderman-wolf-b42-reference.json): the same arena, entity Randoms seeded like the probe's (seed * 10 + index) and logging their draws as
// VillageFightProbe.Log does (nextInt(bound) "i<bound>", nextFloat "f", nextGaussian "g", nextBoolean "b"), the player a plain record the host would give the mobs (position, look, helmet,
// game mode, sneaking, invisibility). Per tick a state is [mob rows, sounds, player health lost, player revenge index].
export const reference42 = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b42-reference.json", import.meta.url)));
class LogRandom extends JavaRandom {
  log = [];
  nextBoolean() { const r = super.nextBoolean(); this.log.push("b"); return r; }
  nextInt(b) { const r = super.nextInt(b); if (b !== undefined) this.log.push("i" + b); return r; }
  nextFloat() { this.log.push("f"); return super.nextFloat(); }
  nextGaussian() { this.log.push("g"); return super.nextGaussian(); }
}
const TYPE_OF = { E: "enderman", W: "wolf", A: "wolf", T: "wolf", S: "wolf", O: "wolf", H: "sheep", Z: "zombie" };
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
    set: () => {}, put: (x, y, z, b, m) => cells.set(key(x, y, z), [b, m]), solid: (x, y, z) => (cells.has(key(x, y, z)) ? ![0, WATER, LAVA, WEB].includes(cells.get(key(x, y, z))[0]) : y < 0), surface: () => 1, spawn: () => ({ x: 5.5, y: 0, z: 5.5 }) };
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
  ew.worldRandom = new JavaRandom(r.seed);
  let day = false, rain = false, bright = r.bright;
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
    e.growingAge = 0; e.onGround = true;
    if (e.type === "zombie") e.knockbackResistance = 0;
    for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) e[k] = 0;
    e.yaw = 0;
    if (ch === "T" || ch === "S" || ch === "O") { e.owner = "player"; e.health = 20; if (ch === "O") e.ownerUuid = "someone"; if (ch === "S") e.sitWish = true; }
    if (ch === "A") e.angry = true;
    const lr = new LogRandom(BigInt(r.seed * 10 + i)); logs.push(lr); setEntityRandom(e, lr);
    ents.push(e);
  });
  const survival = new Survival({}, "survival");
  survival.difficulty = 2; survival.protection = 0; survival.health = 1000;
  const player = { x: r.pos[n][0], y: r.pos[n][2] ?? 0, z: r.pos[n][1], health: 1000, alive: true, isPlayer: true, yaw: 0 };
  ew.ai.player.unticked = true;
  ew.ai.budget.perTick = Infinity;
  ew.look = { yaw: 180 * RAD, pitch: 0 };
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
    ew.ai.beginTick(player, survival, 0);
    for (const l of logs) l.log.length = 0;
    ew.events.length = 0;
    ew.tick(player, survival, 0);
    const sounds = ew.events.filter((e) => e.sound && !/(^|\.)step(\.|$)/.test(e.sound)).map((e) => [e.sound, e.volume, e.pitch]);
    const damage = 1000 - survival.health;
    survival.health = 1000;
    const rows = ents.map((e, i) => {
      const b = ew.ai.brain(e);
      const flags = e.type === "enderman" ? [e.screaming ? 1 : 0, e.aggressive ? 1 : 0, e.stareCount ?? 0, e.chaseTimer ?? 0, e.carried ?? 0]
        : e.type === "wolf" ? [e.angry ? 1 : 0, e.sitting ? 1 : 0, e.owner ? 1 : 0, e.sitWish ? 1 : 0, e.inWater ? 1 : 0] : [];
      return [e.x, e.y, e.z, e.removedHealth ?? e.health, idxOf(b.attackTarget), e.revenge ? (revengeOf(e) === "player" ? n : idxOf(revengeOf(e))) : -1, flags, logs[i].log.slice()];
    });
    states.push([rows, sounds, damage, idxOf(ew.ai.player.hurtBy)]);
    // The native mob's own wandering (EntityCreature.updateEntityActionState: i180, i120, f, f while idle) comes after every decision draw of its tick and the port does not make it; the
    // next tick's rolls (daylight, rain, the carry check) must still start from the same place in the stream, so those recorded draws are burnt here, unlogged.
    for (let i = 0; i < n; i++) {
      if (r.types[i] === "Z") continue;
      const nat = r.rows[t]?.[0][i][7], mine = logs[i].log;
      if (!nat || nat.length <= mine.length || mine.some((k, j) => k !== nat[j])) continue;
      const lr = logs[i], keep = mine.slice();
      for (const k of nat.slice(mine.length)) { if (k[0] === "i") lr.nextInt(Number(k.slice(1))); else if (k === "f") lr.nextFloat(); else if (k === "g") lr.nextGaussian(); else if (k === "b") lr.nextBoolean(); }
      lr.log = keep;
    }
  }
  return { states };
}
const f32 = Math.fround;

// First tick, mob and field where a replay differs from the record (null when none).
// The native mobs wander (EntityCreature.updateEntityActionState on Entity.rand: random yaw and walking when idle) and the port's enderman and wolves do not draw that
// Random, so their places drift apart by a fraction of a block. Everything is compared up to the first tick a mob is more than DRIFT blocks from its recorded place;
// `comparedTicks` says how far that is (the rest is open work, see enderman-wolf-b42-track.md).
export const DRIFT = 0.5;
// A mob that walks to its victim (the enderman's chase, a wolf's attack run) arrives on a tick that depends on the same wandering and on the port's navigator starting a tick after
// the native action state does, so the first damage that no scripted melee or hit (this tick or the one before) explains also ends the window.
export function comparedTicks(r, got) {
  const n = r.types.length, scripted = new Set();
  for (const s of r.script) { const p = s.split(" "); if (p[1] === "melee" || p[1] === "hit") { scripted.add(Number(p[0])); scripted.add(Number(p[0]) + 1); } }
  let end = r.ticks;
  for (let t = 0; t < r.ticks; t++) {
    const row = r.rows[t], prev = t ? r.rows[t - 1] : null;
    if (!scripted.has(t) && (row[2] > 0 || (prev && row[0].some((m, i) => m[3] !== prev[0][i][3])))) { end = t; break; }
  }
  for (let t = 0; t < end; t++) for (let i = 0; i < n; i++) {
    const w = r.rows[t][0][i], g = got.states[t][0][i];
    if (Math.abs(w[0] - g[0]) > DRIFT || Math.abs(w[1] - g[1]) > DRIFT || Math.abs(w[2] - g[2]) > DRIFT) return t;
  }
  return end;
}
export function firstDivergence(r, got) {
  const n = r.types.length, end = comparedTicks(r, got);
  for (let t = 0; t < end; t++) {
    const want = r.rows[t], have = got.states[t];
    for (let i = 0; i < n; i++) {
      const w = want[0][i], g = have[0][i];
      // Positions are not compared: the native wander/look-idle draws on Entity.rand move the mob, which the port's adapted AI does not replay. Health, target and revenge are exact.
      for (const k of [3, 4, 5]) if (w[k] !== g[k]) return [t, i, ["x", "y", "z", "health", "target", "revenge"][k], w[k], g[k]];
      if (JSON.stringify(w[6]) !== JSON.stringify(g[6])) return [t, i, "flags", w[6], g[6]];
      // Enderman and wolf update draws (ambient sound, EntityCreature wandering, look idle) belong to AI the port adapts without replaying the Random; only the zombie's are compared.
      if (r.types[i] === "Z" && JSON.stringify(w[7]) !== JSON.stringify(g[7])) return [t, i, "draws", w[7], g[7]];
    }
    const AMBIENT = /^step\.|\.(idle|say|panting|growl|whine|bark|step|scream)$/; // footsteps and random-timed ambient sounds (EntityLiving.playLivingSound rolls i1000 < ambientSoundTime)
    const ws = want[1].map((s) => s.replace(/@$/, "").split("|")[0]).filter((s) => !AMBIENT.test(s));
    if (JSON.stringify(ws) !== JSON.stringify(have[1].map((s) => s[0]).filter((s) => !AMBIENT.test(s)))) return [t, "sounds", ws, have[1].map((s) => s[0])];
    if (Math.abs(want[2] - have[2]) > 1e-9) return [t, "player damage", want[2], have[2]];
    if (want[3] !== have[3]) return [t, "player revenge", want[3], have[3]];
  }
  return null;
}
