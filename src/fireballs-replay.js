import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { mhSin, mhCos } from "./lighting.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
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
// flaming, smoking, hasExploder], setBlock calls [x, y, z, id], punches [ball, accepted, lookX, lookY, lookZ]].
export const fireballReference = JSON.parse(readFileSync(new URL("../public/research/fireballs-reference.json", import.meta.url))).records;
const TYPE_OF = { z: "zombie", p: "pigman", b: "blaze", g: "ghast", m: "magma_cube" };
const NUM = Number;

export function replayFireballs(r) {
  const types = r.types, n = types.length;
  const ew = new EntityWorld(plain(r.blocks), [], () => 0.5);
  ew.difficulty = r.difficulty ?? 2;
  ew.worldRandom = new JavaRandom(r.seed);
  ew.isDaytime = () => false;
  const rules = {};
  setGameRuleSource((name) => (name in rules ? rules[name] : true));
  const ents = [];
  [...types].forEach((ch, i) => {
    const type = TYPE_OF[ch], [x, z, y0 = 0] = r.pos[i], e = ew.create(type, x, y0, z);
    if (type === "magma_cube") Object.assign(e, slimeFields(r.sizes[i], () => 0));
    ew.entities.push(e);
    e.growingAge = 0; e.onGround = type !== "ghast";
    for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) e[k] = 0;
    e.yaw = 0;
    setEntityRandom(e, new LogRandom(BigInt(r.seed * 10 + i)));
    ents.push(e);
  });
  const survival = new Survival({}, "survival");
  survival.difficulty = ew.difficulty; survival.protection = 0; survival.health = 1000;
  const player = { x: r.pos[n][0], y: r.pos[n][2] ?? 0, z: r.pos[n][1], health: 1000, alive: true, width: 0.6, height: 1.8, isPlayer: true };
  ew.ai.player.unticked = true;
  const pending = { seed: 0n }, balls = [], killed = new Set(), sets = [];
  ew.fireballSeed = () => pending.seed;
  ew.ignite = (x, y, z) => { sets.push([x, y, z, 51]); ew.world.put(x, y, z, FIRE, 0); }; // World.setBlock: the cell is fire for the next ball
  let look = [0, 0, 1], madeAt = 0;
  ew.playerLook = () => look;
  const pv = { x: 0, y: 0, z: 0 }, states = []; // the player double's motion: only knockback moves it
  for (let t = 0; t < r.ticks; t++) {
    const punches = [];
    for (const s of r.script) {
      const p = s.split(" ");
      if (NUM(p[0]) !== t) continue;
      if (p[1] === "ball") {
        pending.seed = BigInt(r.made[madeAt++][10]);
        balls.push(ew.fireballs.launch({ large: p[2] === "1", owner: ents[NUM(p[3])], x: NUM(p[7]), y: NUM(p[8]), z: NUM(p[9]), dx: NUM(p[4]), dy: NUM(p[5]), dz: NUM(p[6]), power: p[10] ? NUM(p[10]) : 1 }));
      } else if (p[1] === "exact") {
        madeAt++;
        balls.push(ew.fireballs.launch({ large: p[2] === "1", owner: null, x: NUM(p[3]), y: NUM(p[4]), z: NUM(p[5]), exact: [NUM(p[6]), NUM(p[7]), NUM(p[8])], power: p[9] ? NUM(p[9]) : 1 }));
      } else if (p[1] === "punch") {
        const ok = ew.fireballs.punch(balls[NUM(p[2])], look);
        punches.push([NUM(p[2]), ok, ...look]);
      } else if (p[1] === "look") look = lookVector(NUM(p[2]), NUM(p[3]), mhSin, mhCos);
      else if (p[1] === "move") { const i = NUM(p[2]), e = i === n ? player : ents[i]; e.x = NUM(p[3]); e.z = NUM(p[4]); if (p.length > 5) e.y = NUM(p[5]); }
      else if (p[1] === "kill") { const e = ents[NUM(p[2])]; killed.add(e); ew.entities.splice(ew.entities.indexOf(e), 1); }
      else if (p[1] === "rule") rules[p[2]] = p[3] === "true";
      else if (p[1] === "fire") { const i = NUM(p[2]); if (i === n) survival.setFire?.(NUM(p[3])); else ents[i].fire = NUM(p[3]) * 20; }
    }
    ew.ai.beginTick(player, survival, 0);
    ew.events.length = 0;
    survival.health = 1000 - (states.length ? 1000 - states[states.length - 1].playerHealth : 0);
    ew.fireballs.tick();
    drainKnockback(survival, pv, player);
    const booms = [];
    for (const ev of ew.events) if (ev.explode) { const x = ev.explode; booms.push([x.x, x.y, x.z, x.size, x.flaming ? 1 : 0, x.smoking ? 1 : 0, x.source ? 1 : 0]); }
    states.push({
      playerHealth: survival.health,
      ents: [...ents.map((e) => [e.x, e.y, e.z, e.vx ?? 0, e.vy ?? 0, e.vz ?? 0, e.health, e.fire ?? 0, killed.has(e) ? 1 : 0]), [player.x, player.y, player.z, pv.x, pv.y, pv.z, survival.health, survival.fire ?? 0, 0]],
      balls: balls.map((b) => [b.large ? 1 : 0, b.owner === "player" ? n : b.owner ? ents.indexOf(b.owner) : -1, b.x, b.y, b.z, b.vx, b.vy, b.vz, b.ax, b.ay, b.az, b.dead ? 1 : 0, b.ticks, 0, b.large ? b.power : 0]),
      booms, sets: sets.splice(0), punches,
    });
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
        if (sec === "balls" && k === 13) continue; // ticksAlive only counts while inGround, which no 1.7.10 path sets
        if (!near(w[i][k], x[i][k])) return [t, sec, i, k, w[i][k], x[i][k]];
      }
    }
    if (JSON.stringify(want[2]) !== JSON.stringify(g.booms)) return [t, "booms", want[2], g.booms];
    if (JSON.stringify(want[3]) !== JSON.stringify(g.sets)) return [t, "sets", want[3], g.sets];
    if (JSON.stringify(want[4]) !== JSON.stringify(g.punches)) return [t, "punches", want[4], g.punches];
  }
  return null;
}
