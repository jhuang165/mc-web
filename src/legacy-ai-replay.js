import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { EntityWorld, setEntityRandom, entityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { WOODEN_DOOR, WATER } from "./world.js";
import { fromOriginal } from "./block-registry.js";
import { setPathNodeCap } from "./pathfinding.js";
import { slimeFields } from "./slime.js";
import { fireballAcceleration } from "./blaze-ghast.js";

// Replays one LegacyAiProbe record (public/research/legacy-ai-reference.json, tools/probes/LegacyAiProbe.java) through the port's ticked mobs:
// native slimes (ym), magma cubes (yf), ghasts (yd) and blazes (xx) next to a player double, entity Randoms seeded seed * 10 + index and logging their
// draws as the probe's Log does (nextInt(bound) "i<bound>", nextFloat "f", nextGaussian "g", nextBoolean "b"). Per tick `rows[t]` is
// [entities, sounds, level events, fireballs]; an entity is [x, y, z, vx, vy, vz, yaw, onGround, health, target index, [type fields], [draws]] (the
// player, the last of the starting list, has only the first nine). Split slimes follow the player in the list.
export const legacyReference = JSON.parse(readFileSync(new URL("../public/research/legacy-ai-reference.json", import.meta.url)));

export class LogRandom extends JavaRandom {
  log = [];
  nextBoolean() { const r = super.nextBoolean(); this.log.push("b"); return r; }
  nextInt(b) { const r = super.nextInt(b); if (b !== undefined) this.log.push("i" + b); return r; }
  nextFloat() { this.log.push("f"); return super.nextFloat(); }
  nextGaussian() { this.log.push("g"); return super.nextGaussian(); }
}
const key = (x, y, z) => `${x},${y},${z}`;
const TYPE_OF = { s: "slime", m: "magma_cube", g: "ghast", b: "blaze" };
const PORT_ID = { 1: 3, 9: WATER };
const DOOR = [WOODEN_DOOR, 0];
export function plain(blocks = []) {
  const cells = new Map([[key(50, 0, 50), DOOR], [key(50, 1, 50), [WOODEN_DOOR, 8]]]);
  for (const [x0, y0, z0, x1, y1, z1, id, meta] of blocks) for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    const c = id in PORT_ID ? [PORT_ID[id], meta] : (() => { const r = fromOriginal(id, meta); return [r.id, r.meta]; })();
    cells.set(key(x, y, z), c);
  }
  return { numericSeed: 1, height: 256, floorBelow: true, minX: -3e7, maxX: 3e7, minZ: -3e7, maxZ: 3e7,
    get: (x, y, z) => cells.get(key(x, y, z))?.[0] ?? (y < 0 ? PORT_ID[1] : 0), getMeta: (x, y, z) => cells.get(key(x, y, z))?.[1] ?? 0,
    set: () => {}, put: (x, y, z, b, m) => cells.set(key(x, y, z), [b, m]),
    solid: (x, y, z) => (cells.has(key(x, y, z)) ? ![0, WATER].includes(cells.get(key(x, y, z))[0]) : y < 0), surface: () => 1, spawn: () => ({ x: 50.5, y: 0, z: 50.5 }) };
}

export function replayLegacy(r, hooks = {}) {
  const was = setPathNodeCap(Infinity);
  try { return replayUncapped(r, hooks); } finally { setPathNodeCap(was); }
}
function replayUncapped(r, hooks) {
  const types = r.types, n = types.length;
  const ew = new EntityWorld(plain(r.blocks), [], () => 0.5);
  ew.difficulty = r.difficulty ?? 2;
  ew.worldRandom = new JavaRandom(r.seed);
  ew.isDaytime = () => false;
  ew.brightnessLevel = () => r.bright;
  ew.lightAt = () => 15;
  ew.ai.deps.canSeeSky = (x, y, z) => !(x >= 40 && x <= 49 && z >= 0 && z <= 100);
  // EntityLiving.despawnEntity is setDead: the native row keeps the health it had, the port marks a despawn as health 0 / death 20 (a corpse's removal)
  const gone = new Map(), despawn = ew.ai.deps.despawn;
  ew.ai.deps.despawn = (e) => { gone.set(e, e.health); despawn(e); };
  const ents = [], logs = [], kidsLeft = (r.children ?? []).slice(), fireLeft = [], shotLog = [];
  [...types].forEach((ch, i) => {
    const type = TYPE_OF[ch], [x, z, y0 = 0] = r.pos[i], e = ew.create(type, x, y0, z);
    if (type === "slime" || type === "magma_cube") Object.assign(e, slimeFields(r.sizes[i], () => 0));
    if (type === "slime" || type === "magma_cube") e.jumpDelay = 10 + ((r.seed + i * 7) % 20);
    ew.entities.push(e);
    e.growingAge = 0; e.onGround = type !== "ghast";
    for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) e[k] = 0;
    e.yaw = 0;
    const lr = new LogRandom(BigInt(r.seed * 10 + i)); lr.logBooleans = true; logs.push(lr); setEntityRandom(e, lr);
    ents.push(e);
  });
  let tick = 0;
  const made = [];
  ew.entitySeed = (c, kind) => {
    if (kind !== "slime-split") return;
    const rec = kidsLeft.shift(), lr = new LogRandom(BigInt(rec ? rec[7] : 1));
    setEntityRandom(c, lr);
    c.growingAge = 0;
    lr.nextInt(3); lr.nextInt(20); lr.log.length = 0; // the constructor's size and first jump delay rolls (the record's child draws, cleared like the probe's)
    if (rec) c.jumpDelay = rec[9];
    if (rec) { c.onGround = false; for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) c[k] = Math.fround(rec[6]); c.yaw = (-Math.fround(rec[6]) * Math.PI) / 180; }
    made.push([tick, c]);
    ents.push(c); logs.push(lr);
  };
  let dust = [];
  ew.landingDust = (e, x, y, z) => dust.push(`2006|${x},${y},${z}`);
  ew.fireballSeed = () => fireLeft.length ? fireLeft.shift() : undefined;
  const survival = new Survival({}, "survival");
  survival.difficulty = ew.difficulty; survival.protection = 0; survival.health = 1000;
  const player = { x: r.pos[n][0], y: r.pos[n][2] ?? 0, z: r.pos[n][1], health: 1000, alive: true, width: 0.6, height: 1.8, isPlayer: true };
  ew.ai.player.unticked = true;
  ew.ai.budget.perTick = Infinity;
  // The probe never ticks the spawned fireballs (World.d only adds slimes to the entity list), so flight and impact are not native evidence here: the replay compares launches only.
  ew.fireballs.tick = () => {};
  const vel = [0, 0], script = r.script.map((s) => s.split(" ")), hits = [], states = [];
  let taken = 0;
  for (let t = 0; t < r.ticks; t++) {
    tick = t;
    for (const p of script) {
      if (Number(p[0]) !== t) continue;
      if (p[1] === "hit") {
        const v = ents[Number(p[2])];
        hits.push([t, ew.attackEntityFrom(v, Number(p[3]), { from: { x: player.x, z: player.z }, player: true, name: "player" }), v.health]);
      } else if (p[1] === "walk" && Number(p[2]) === n) { vel[0] = Number(p[3]); vel[1] = Number(p[4]); }
      else if (p[1] === "move" && Number(p[2]) !== n) { const e = ents[Number(p[2])]; e.x = Number(p[3]); e.z = Number(p[4]); if (p.length > 5) e.y = Number(p[5]); }
      else if (p[1] === "move") { player.x = Number(p[3]); player.z = Number(p[4]); }
    }
    player.x += vel[0]; player.z += vel[1];
    ew.ai.beginTick(player, survival, 0);
    // fireballs: the recorded seed of each shot of this tick, in launch order
    fireLeft.length = 0;
    for (const s of r.rows[t][3]) fireLeft.push(BigInt(s[12]));
    const shots = [], launch = ew.fireballs.launch.bind(ew.fireballs);
    ew.fireballs.launch = (o) => { const b = launch(o); b.shooter = ents.indexOf(o.owner); shots.push(b); return b; };
    for (const l of logs) l.log.length = 0;
    survival.health = 1000;
    ew.events.length = 0;
    ew.tick(player, survival, 0);
    const pos = (k) => (k < n ? k : k + 1); // the player sits at index n; children follow it
    const idx = (b) => (!b ? -1 : b === player || b.isPlayer ? n : pos(ents.indexOf(b.e ?? b)));
    const rows = ents.map((e, i) => ({ e, i, row: rowOf(ew, e, i, idx, player, logs[i], gone) }));
    taken += 1000 - survival.health;
    rows.splice(n, 0, { e: player, i: n, row: [player.x, player.y, player.z, 0, 0, 0, 0, 1, 1000 - taken] });
    const ball = (b) => [b.large ? 1 : 0, b.shooter, b.x, b.y, b.z, b.vx, b.vy, b.vz, b.ax, b.ay, b.az, b.large ? b.power : 0];
    states.push({ ents: rows, shots: shots.map(ball), ...splitEvents(ew.events, dust) });
    dust = [];
    survival.health = 1000;
    hooks.onTick?.(t, ew, ents);
  }
  return { ew, ents, logs, hits, states, made };
}

// The port's event queue as the probe's two lists: sounds "name|volume|pitch" and level events "id|x,y,z" (the ghast's charge and shot, the blaze's shot: 1007-1009).
// natively the pitch of a level event is drawn client-side, so only the id and block are compared.
function splitEvents(events, dust) {
  const sounds = [], aux = [];
  for (const x of events) {
    if (!x.sound) continue;
    const at = x.position;
    if (x.sound === "mob.ghast.charge") aux.push(`1007|${at.x | 0},${at.y | 0},${at.z | 0}`);
    else if (x.sound === "mob.ghast.fireball") aux.push(`${x.volume === 2 ? 1009 : 1008}|${Math.floor(at.x)},${Math.floor(at.y)},${Math.floor(at.z)}`);
    else if (x.sound !== "fire.fire") sounds.push([x.sound, x.volume, x.pitch]); // the blaze's crackle is EntityBlaze.onLivingUpdate's isRemote half: the server never plays it

  }
  return { sounds, aux: [...aux, ...dust] };
}
// A port entity as the probe's row, up to the type fields
function rowOf(ew, e, i, idx, player, log, gone) {
  const st = e.type === "slime" || e.type === "magma_cube" ? null : ew.silverfishState(e);
  const target = e.type === "ghast" ? (e.ghast?.hasTarget ? player : null) : st?.target;
  return [e.x, e.y, e.z, e.vx, e.vy, e.vz, e.rotationYaw, e.onGround ? 1 : 0, gone.has(e) ? gone.get(e) : e.removedHealth ?? e.health, e.type === "slime" || e.type === "magma_cube" ? (ew.ai.brain(e).canSee ? -1 : -1) : idx(target), fieldsOf(ew, e, st), log.log.slice()];
}
function fieldsOf(ew, e, st) {
  if (e.type === "slime" || e.type === "magma_cube") return [e.squishAmount, e.squishFactor, e.prevSquishFactor, e.jumpDelay, e.jumping ? 1 : 0, e.moveForward, e.moveStrafing || 0, e.entityAge ?? 0];
  if (e.type === "ghast") { const g = e.ghast ?? {}; return [g.wx, g.wy, g.wz, g.wander, g.charge, g.prevCharge, g.delay, g.hasTarget ? 1 : 0, e.idle ?? 0]; }
  if (e.type === "blaze") { const b = e.blaze ?? {}; return [b.attackTime, b.shots, b.hasAttacked ? 1 : 0, b.hoverOffset, b.hoverDelay, st.path ? 1 : 0, st.entityAge, e.blazeBurning ? 1 : 0, e.moveForward, e.moveStrafing || 0, e.jumping ? 1 : 0]; }
  return [];
}

const near = (a, b) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : a === b);
// first tick, entity, field where a replay differs from the record; fields 0..9 are the row heads, "fields" the type fields, "draws"
export function firstDivergence(r, got, only = null) {
  for (let t = 0; t < r.ticks; t++) {
    const want = r.rows[t][0], g = got.states[t].ents;
    for (let i = 0; i < want.length; i++) {
      const w = want[i], x = g[i]?.row;
      if (!x) return [t, i, "missing entity"];
      if (w.length === 9) { for (const k of [0, 2, 8]) if (!near(w[k], x[k])) return [t, i, "player", k, w[k], x[k]]; continue; }
      for (let k = 0; k < 10; k++) { if (only && !only.includes(k)) continue; if (!near(w[k], x[k])) return [t, i, k, w[k], x[k]]; }
      if (!only || only.includes("fields")) if (JSON.stringify(w[10]) !== JSON.stringify(x[10]) && x[10].length) return [t, i, "fields", w[10], x[10]];
      if (!only || only.includes("draws")) if (JSON.stringify(w[11]) !== JSON.stringify(x[11])) return [t, i, "draws", w[11], x[11]];
    }
    const st = got.states[t];
    if (!only || only.includes("events")) {
      const sw = r.rows[t][1].map((q) => { const [a, b, c] = q.split("|"); return [a, Math.fround(Number(b)), Math.fround(Number(c))]; }), sg = st.sounds.map(([a, b, c]) => [a, Math.fround(b), Math.fround(c)]);
      if (JSON.stringify(sw) !== JSON.stringify(sg)) return [t, "sounds", r.rows[t][1], st.sounds];
      if (JSON.stringify(r.rows[t][2]) !== JSON.stringify(st.aux)) return [t, "level events", r.rows[t][2], st.aux];
    }
    if (!only || only.includes("shots")) {
      const want = r.rows[t][3].map((b) => b.slice(0, 12));
      if (want.length !== st.shots.length) return [t, "shots", want.length, st.shots.length];
      for (let k = 0; k < want.length; k++) for (let j = 0; j < 12; j++) if (!near(want[k][j], st.shots[k][j])) return [t, "shot", k, j, want[k][j], st.shots[k][j]];
    }
  }
  if ((!only || only.includes("hits")) && JSON.stringify(r.hits) !== JSON.stringify(got.hits)) return ["hits", r.hits, got.hits];
  return null;
}
