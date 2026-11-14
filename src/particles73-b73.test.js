// Batch 73 particles73: the fishing wake (EntityFishWakeFX, executed against the unchanged class), the three block display ticks
// (mycelium townaura, brewing stand and end portal smoke, bytecode-read), and the crit animations for the dedicated server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { Fx } from "./fx.js";
import { extraDisplayTick, MYCELIUM, BREWING_STAND, END_PORTAL } from "./block-display-b73.js";
import { sendCritFx, serverCritical } from "./multiplayer/server-crit-fx.js";
import { applyCritFx } from "./multiplayer/client-crit-fx.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/wake-particle-reference.json", import.meta.url)));
const state = (raw) => { const r = new JavaRandom(0); r.seed = BigInt(raw); return r; };
const STONE = 3;
const world = (fixture) => {
  const get = (x, y, z) => (fixture === 1 && x >= 9 && x <= 11 && z >= 9 && z <= 11 && y >= 64 && y <= 66 ? 9 : fixture === 2 && x === 10 && y === 66 && z === 10 ? STONE : y < 64 ? STONE : 0);
  return { get, getMeta: () => 0, solid: (x, y, z) => get(x, y, z) === STONE };
};

test("wake: constructor and every update replay EntityFishWakeFX", () => {
  const list = ref.records.filter((c) => c.case === "particle");
  assert.equal(list.length, 6);
  for (const c of list) {
    const w = world(c.fixture), r = state(c.math);
    let first = c.initial.seed;
    const fx = new Fx({ random: () => r.nextDouble(), entityRandom: () => { const s = first ?? 0; first = null; return state(s); }, world: w });
    fx.viewer = [10.5, 65.62, 10.5];
    const p = fx.spawn("wake", ...c.args), q = c.initial, what = `fixture ${c.fixture} ${c.args}`;
    assert.ok(p, what);
    assert.deepEqual([p.x, p.y, p.z, p.mx, p.my, p.mz, p.jx, p.jy, p.gravity, [p.r, p.g, p.b], p.width, p.height, p.scale, p.max, p.tex],
      [q.x, q.y, q.z, q.vx, q.vy, q.vz, q.jx, q.jy, q.gravity, q.rgb, q.width, q.height, q.scale, q.maxAge, q.tex ?? 19], what + " constructor");
    c.tracks.forEach((expected, t) => {
      fx.step(w, p);
      assert.deepEqual([p.x, p.y, p.z, p.mx, p.my, p.mz, p.age, p.tex, !!p.dead, p.onGround, p.r, p.g, p.b], expected, `${what} tick ${t}`);
    });
    assert.ok(p.dead, what + " dies");
  }
});

test("fishing wake events reach the particle system (no longer skipped)", () => {
  const src = readFileSync(new URL("./fishing-simulation.js", import.meta.url), "utf8");
  assert.ok(!/name === 'wake'\) return/.test(src));
});

test("mycelium, brewing stand and end portal display ticks use the native draws", () => {
  const f = Math.fround, calls = [];
  const fx = { spawn: (...a) => calls.push(a) };
  const seq = (...v) => { let i = 0; return { nextInt: () => v[i++], nextFloat: () => v[i++] }; };
  assert.equal(extraDisplayTick(MYCELIUM, 4, 70, 5, seq(3), fx), true);
  assert.equal(calls.length, 0);
  extraDisplayTick(MYCELIUM, 4, 70, 5, seq(0, 0.25, 0.75), fx);
  assert.deepEqual(calls.pop(), ["townaura", 4.25, f(70 + f(1.1)), 5.75, 0, 0, 0]);
  extraDisplayTick(BREWING_STAND, 4, 70, 5, seq(0.5, 0.25, 0.75), fx);
  assert.deepEqual(calls.pop(), ["smoke", f(f(4 + f(0.4)) + f(0.5 * f(0.2))), f(f(70 + f(0.7)) + f(0.25 * f(0.3))), f(f(5 + f(0.4)) + f(0.75 * f(0.2))), 0, 0, 0]);
  extraDisplayTick(END_PORTAL, 4, 70, 5, seq(0.5, 0.125), fx);
  assert.deepEqual(calls.pop(), ["smoke", 4.5, f(70 + f(0.8)), 5.125, 0, 0, 0]);
  assert.equal(extraDisplayTick(1, 0, 0, 0, seq(), fx), false);
});

test("townaura and a wake spawn through Fx", () => {
  const fx = new Fx({ world: world(0) });
  fx.viewer = [4, 70, 5];
  assert.ok(fx.spawn("townaura", 4.2, 71.1, 5.7, 0, 0, 0));
  assert.ok(fx.spawn("wake", 4, 70, 5, 0.01, 0.01, 0.01));
});

test("server crit animations: sent to players in range of the attacker's dimension, applied as Crit2FX", () => {
  const mk = (id, x, dim) => ({ id, dimension: dim, position: { x, y: 64, z: 0 } });
  const a = mk(1, 0, 0), near = mk(2, 30, 0), far = mk(3, 200, 0), other = mk(4, 0, -1);
  const sim = { players: new Map([a, near, far, other].map((p) => [p.id, p])) };
  sendCritFx(sim, a, { x: 5, y: 64, z: 0, w: 0.6, h: 1.8, mx: 0, my: 0, mz: 0 }, true);
  assert.equal(a.dispOut.length, 1);
  assert.equal(near.dispOut.length, 1);
  assert.equal(far.dispOut, undefined);
  assert.equal(other.dispOut, undefined);
  const calls = [];
  applyCritFx(a.dispOut[0], { crit2: (t, magic) => calls.push([t(), magic]) });
  assert.deepEqual(calls, [[{ x: 5, z: 0, minY: 64, width: 0.6, height: 1.8, mx: 0, my: 0, mz: 0 }, true]]);
  assert.equal(serverCritical({ fallDistance: 1, grounded: false }), true);
  assert.equal(serverCritical({ fallDistance: 1, grounded: true }), false);
  assert.equal(serverCritical({ fallDistance: 0, grounded: false }), false);
  assert.equal(serverCritical({ fallDistance: 1, grounded: false, inWater: true }), false);
});

test("dedicated server: a jump attack on a mob deals the 1.5x critical and sends the crit animation", async () => {
  const { World } = await import("./world.js");
  const { DedicatedSimulation } = await import("./multiplayer/simulation.js");
  const { IDLE_INPUT } = await import("./multiplayer/protocol.js");
  const world = new World("particles73");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: true });
  s.mobs.spawning = false;
  const a = s.addPlayer("a", "ax", "00000000-0000-0000-0000-000000000001");
  a.position.copy({ x: 64.5, y: 10, z: 64.5 }); a.previous.copy(a.position);
  s.input("a", { type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  s.mobs.mobs.entities.length = 0;
  const pig = s.mobs.mobs.create("pig", 66.5, 10, 64.5);
  s.mobs.mobs.entities.push(pig);
  s.tick();
  const before = pig.health;
  const real = s.mobs.attack.bind(s.mobs);
  a.fallDistance = 2; a.grounded = false;
  assert.equal(real(a, Number(pig.id.slice(4))), true);
  assert.equal(before - pig.health, 1.5);
  const msgs = (a.dispOut ?? []).filter((m) => m.type === "pfx73");
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].events[0].m, 0);
});
