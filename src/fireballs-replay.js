import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { mhSin, mhCos } from "./lighting.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { thrownHit } from "./projectiles.js";
import { slimeFields } from "./slime.js";
import { setGameRuleSource } from "./game-rules.js";
import { drainKnockback } from "./player-knockback.js";
import { FIRE } from "./world.js";
import { lookVector } from "./blaze-ghast.js";
import { plain, LogRandom } from "./legacy-ai-replay.js";

// Replays one FireballProbe record (public/research/fireballs-reference.json, tools/probes/FireballProbe.java): large and small fireballs ticked whole
// (EntityFireball.onUpdate) on the unchanged 1.7.10 classes, against `Fireballs.tick` in the port's EntityWorld. The shooters and targets stand still (the
// replay ticks the fireballs, not the mobs). Row per tick: [entities [x, y, z, vx, vy, vz, health, fire ticks, isDead], fireballs [large, shooter
// index (-1 none, the player is the last index), x, y, z, vx, vy, vz, ax, ay, az, isDead, ticksInAir, ticksAlive, power], explosions [x, y, z, power,
// flaming, smoking, hasExploder], setBlock calls [x, y, z, id], punches [ball, accepted, lookX, lookY, lookZ], hurts [victim, accepted, health]]. An entity's tenth
// value is its entityToAttack index (-1 none) for the mobs in TARGETING.
export const fireballReference = JSON.parse(readFileSync(new URL("../public/research/fireballs-reference.json", import.meta.url))).records;
export const fireballReference41 = JSON.parse(readFileSync(new URL("../public/research/fireballs-b41-reference.json", import.meta.url))).records; // batch 41: inGround and blaze volleys at a mob
export const fireballReference42 = JSON.parse(readFileSync(new URL("../public/research/fireballs-b42-reference.json", import.meta.url))).records; // batch 42: one entity list order, ghast balls at mobs
export const fireballReference43 = JSON.parse(readFileSync(new URL("../public/research/fireballs-b43-reference.json", import.meta.url))).records; // batch 43: idle wanderers, silverfish deaths, golem and blaze, draws per entity
const TYPE_OF = { z: "zombie", p: "pigman", b: "blaze", g: "ghast", m: "magma_cube", s: "spider", k: "silverfish", e: "giant", x: "skeleton", w: "snow_golem", i: "iron_golem" };
// The mobs whose entityToAttack (td.bT) the record keeps: the legacy-action-state mobs (EntityZombie and the other AI-task mobs keep it unused in 1.7.10).
const TARGETING = new Set(["blaze", "silverfish", "giant", "spider", "pigman"]);
const NUM = Number;

export function replayFireballs(r, hooks = {}) {
  const types = r.types, n = types.length;
  const ew = new EntityWorld(plain(r.blocks), [], () => 0.5);
  ew.difficulty = r.difficulty ?? 2;
  ew.worldRandom = new JavaRandom(r.seed);
  ew.isDaytime = () => false;
  ew.brightnessLevel = () => 15; // the probe world's light brightness is 15 everywhere, below the floor too (a try under the floor weighs the same as one above for a zombie's wander)
  const rules = {};
  setGameRuleSource((name) => (name in rules ? rules[name] : true));
  // EntityLiving.despawnEntity is setDead: the native row keeps the health it had and isDead 1; the port marks a despawn as health 0 / death 20 (a corpse's removal), so the replay reads the health at the despawn
  const gone = new Map(), despawn = ew.ai.deps.despawn;
  ew.ai.deps.despawn = (e) => { if (!gone.has(e)) gone.set(e, e.health); despawn(e); }; // setDead can run twice in one update (the silverfish)
  const ents = [], logs = [];
  const late = new Set(r.script.filter((s) => ["join", "idle"].includes(s.split(" ")[1])).map((s) => NUM(s.split(" ")[2]))); // `join k`: mob k joins the list on that tick (a mob created after the balls before it)
  [...types].forEach((ch, i) => {
    const type = TYPE_OF[ch], [x, z, y0 = 0] = r.pos[i], e = type === "iron_golem" ? ew.spawnIronGolem(x, y0, z, false) : ew.create(type, x, y0, z);
    if (type === "magma_cube") Object.assign(e, slimeFields(r.sizes[i], () => 0));
    if (type === "iron_golem") ew.entities.splice(ew.entities.indexOf(e), 1);
    if (!late.has(i)) ew.entities.push(e);
    e.growingAge = 0; e.onGround = type !== "ghast";
    for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) e[k] = 0;
    e.yaw = 0;
    const lr = new LogRandom(BigInt(r.seed * 10 + i)); logs.push(lr); setEntityRandom(e, lr);
    ents.push(e);
  });
  const survival = new Survival({}, "survival");
  survival.difficulty = ew.difficulty; survival.protection = 0; survival.health = 1000;
  const player = { x: r.pos[n][0], y: r.pos[n][2] ?? 0, z: r.pos[n][1], health: 1000, alive: true, width: 0.6, height: 1.8, isPlayer: true };
  ew.ai.player.unticked = true;
  const pending = { seed: 0n }, balls = [], killed = new Set(), sets = [];
  let shotAt = 0;
  let scripted = false;
  ew.fireballSeed = () => (r.tickMobs && !scripted ? BigInt(r.shots[shotAt++]?.[3] ?? 0) : pending.seed); // tickMobs: the mobs launch their own balls, with the seeds the probe recorded
  ew.ignite = (x, y, z) => { sets.push([x, y, z, 51]); ew.world.put(x, y, z, FIRE, 0); }; // World.setBlock: the cell is fire for the next ball
  let look = [0, 0, 1], madeAt = 0;
  ew.playerLook = () => look;
  const pv = { x: 0, y: 0, z: 0 }, targetOf = (e) => { const t = e.type === "ghast" ? (e.ghast?.hasTarget ? ew.ai.player : null) : TARGETING.has(e.type) ? ew.silverfishState(e).target : null; return !t ? -1 : t === ew.ai.player ? n : ents.indexOf(t.e ?? t); }, states = []; // the player double's motion: only knockback moves it
  for (let t = 0; t < r.ticks; t++) {
    const punches = [], hurts = [];
    for (const s of r.script) {
      const p = s.split(" ");
      if (NUM(p[0]) !== t) continue;
      if (p[1] === "ball") {
        pending.seed = BigInt(r.made[madeAt++][10]); scripted = true;
        balls.push(ew.fireballs.launch({ large: p[2] === "1", owner: ents[NUM(p[3])], x: NUM(p[7]), y: NUM(p[8]), z: NUM(p[9]), dx: NUM(p[4]), dy: NUM(p[5]), dz: NUM(p[6]), power: p[10] ? NUM(p[10]) : 1 })); scripted = false;
      } else if (p[1] === "join") ew.entities.push(ents[NUM(p[2])]);
      else if (p[1] === "exact") {
        madeAt++;
        balls.push(ew.fireballs.launch({ large: p[2] === "1", owner: null, x: NUM(p[3]), y: NUM(p[4]), z: NUM(p[5]), exact: [NUM(p[6]), NUM(p[7]), NUM(p[8])], power: p[9] ? NUM(p[9]) : 1 }));
      } else if (p[1] === "punch") {
        const ok = ew.fireballs.punch(balls[NUM(p[2])], look);
        punches.push([NUM(p[2]), ok, ...look]);
      } else if (p[1] === "look") look = lookVector(NUM(p[2]), NUM(p[3]), mhSin, mhCos);
      else if (p[1] === "move") { const i = NUM(p[2]), e = i === n ? player : ents[i]; e.x = NUM(p[3]); e.z = NUM(p[4]); if (p.length > 5) e.y = NUM(p[5]); }
      else if (p[1] === "ground") { const b = balls[NUM(p[2])]; ew.fireballs.stickIn(b, NUM(p[3]), NUM(p[4]), NUM(p[5])); }
      else if (p[1] === "air") ew.world.put(NUM(p[2]), NUM(p[3]), NUM(p[4]), p[5] ? NUM(p[5]) : 0, 0);
      else if (p[1] === "kill") { const e = ents[NUM(p[2])]; killed.add(e); ew.entities.splice(ew.entities.indexOf(e), 1); }
      else if (p[1] === "idle") continue;
      else if (p[1] === "snow") { const v = ents[NUM(p[2])], before = v.health; thrownHit(ew, v, ents[NUM(p[3])], { kind: "snowball", x: 0, y: 0, z: 0 }); hurts.push([NUM(p[2]), v.health < before, v.health]); }
      else if (p[1] === "health") ents[NUM(p[2])].health = NUM(p[3]);
      else if (p[1] === "rule") rules[p[2]] = p[3] === "true";
      else if (p[1] === "hurt") {
        const v = ents[NUM(p[2])], k = p[3], amount = NUM(p[4]);
        const source = k === "p" ? { from: { x: player.x, z: player.z }, player: true, name: "player" }
          : k === "n" ? { name: "fireball", fireball: true, from: { x: 0, z: 0 }, entity: { x: 0, y: 0, z: 0 } } // the probe's shooterless ball at the origin
          : k === "s" ? { from: { x: v.x, z: v.z }, attacker: v, name: "mob" }
          : { from: { x: ents[NUM(k.slice(1))].x, z: ents[NUM(k.slice(1))].z }, attacker: ents[NUM(k.slice(1))], name: "mob" };
        hurts.push([NUM(p[2]), ew.attackEntityFrom(v, amount, source), v.health]);
      }
      else if (p[1] === "fire") { const i = NUM(p[2]); if (i === n) survival.setFire?.(NUM(p[3])); else ents[i].fire = NUM(p[3]) * 20; }
    }
    for (const l of logs) l.log.length = 0; // the probe clears the logs after the tick's script ops
    ew.ai.beginTick(player, survival, 0);
    ew.events.length = 0;
    survival.health = 1000 - (states.length ? 1000 - states[states.length - 1].playerHealth : 0);
    if (r.tickMobs) { ew.tick(player, survival, 0); for (const b of ew.fireballs.list) if (!balls.includes(b)) balls.push(b); } // the mobs shoot: a new ball is the next row entry
    else ew.fireballs.tick();
    drainKnockback(survival, pv, player);
    const booms = [];
    for (const ev of ew.events) if (ev.explode) { const x = ev.explode; booms.push([x.x, x.y, x.z, x.size, x.flaming ? 1 : 0, x.smoking ? 1 : 0, x.source ? 1 : 0]); }
    states.push({
      playerHealth: survival.health,
      ents: [...ents.map((e) => [e.x, e.y, e.z, e.vx ?? 0, e.vy ?? 0, e.vz ?? 0, gone.has(e) ? gone.get(e) : e.health, e.fire ?? 0, killed.has(e) || gone.has(e) || (e.health <= 0 && (e.death ?? 0) >= 20) ? 1 : 0, targetOf(e)]), [player.x, player.y, player.z, pv.x, pv.y, pv.z, survival.health, survival.fire ?? 0, 0, -1]],
      balls: balls.map((b) => [b.large ? 1 : 0, b.owner === "player" ? n : b.owner ? ents.indexOf(b.owner) : -1, b.x, b.y, b.z, b.vx, b.vy, b.vz, b.ax, b.ay, b.az, b.dead ? 1 : 0, b.ticks, b.ticksAlive ?? 0, b.large ? b.power : 0]),
      booms, sets: sets.splice(0), punches, hurts, draws: [...logs.map((l) => l.log.slice()), []], // the player double draws nothing
    });
    hooks.onTick?.(t, ew, ents);
  }
  return { ew, ents, states, balls, survival };
}

const near = (a, b) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : a === b);
// First tick, section and field where a replay differs from the record (null when exact).
export function fireballDivergence(r, got) {
  for (let t = 0; t < r.ticks; t++) {
    const want = r.rows[t], g = got.states[t];
    for (const [sec, w, x] of [["ents", want[0], g.ents], ["balls", want[1], g.balls]]) {
      if (w.length !== x.length) return [t, sec, "count", w.length, x.length];
      for (let i = 0; i < w.length; i++) for (let k = 0; k < w[i].length; k++) {
        if (!near(w[i][k], x[i][k])) return [t, sec, i, k, w[i][k], x[i][k]];
      }
    }
    if (JSON.stringify(want[2]) !== JSON.stringify(g.booms)) return [t, "booms", want[2], g.booms];
    if (JSON.stringify(want[3]) !== JSON.stringify(g.sets)) return [t, "sets", want[3], g.sets];
    if (JSON.stringify(want[4]) !== JSON.stringify(g.punches)) return [t, "punches", want[4], g.punches];
    if (JSON.stringify(want[5]) !== JSON.stringify(g.hurts)) return [t, "hurts", want[5], g.hurts];
    if (r.draws) for (let i = 0; i < want[6].length; i++) if (JSON.stringify(want[6][i]) !== JSON.stringify(g.draws[i])) return [t, "draws", i, want[6][i], g.draws[i]]; // Entity.rand draws of each mob
  }
  return null;
}
