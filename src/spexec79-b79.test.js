// Batch 79 spexec79: three more executed checks against public/research/spexec79-reference.json (tools/probes/SpExec79Probe.java, run by tools/verify-spexec79.mjs on the
// unchanged 1.7.10 classes): an ender pearl flying and landing in water, lava or air (EntityThrowable / EntityEnderPearl), a bowl on a calf cow or mooshroom, and a dispenser
// firing a fire charge on a server world against a client world. Plus the gaussian audit: every Entity.rand / World.rand gaussian comes from java-random.js.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Projectiles, GaussianRandom } from "./projectiles.js";
import { impactEnderPearl } from "./ender-pearl.js";
import { Fireballs } from "./fireballs.js";
import { Dispensing, ITEM } from "./dispense.js";
import { JavaRandom, gaussianFrom } from "./java-random.js";
import { mooshroomUse, useBowl, BOWL, MUSHROOM_STEW } from "./mooshroom.js";
import { milkCow } from "./buckets.js";
import { makeStack } from "./inventory.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/spexec79-reference.json", import.meta.url), "utf8"));
const of = (kind) => ref.records.filter((r) => r.kind === kind);

test("the reference holds the executed records of the three scopes", () => {
  assert.match(ref.target, /1\.7\.10/);
  assert.equal(of("pearl79").length, 36);
  assert.equal(of("milk79").length, 32);
  assert.equal(of("fire79").length, 24);
});

// ---- ender pearl through water and lava ------------------------------------------------------------------------------------------------------------------------

const PORT_LIQUID = { 9: 10, 8: 10, 11: 42, 10: 42, 0: 0 }; // native water / lava ids to the port's single WATER (10) and LAVA (42)
// Java prints floats and doubles in its own shortest form; compare numerically (sound volume and pitch are floats).
const norm = (e) => e.split(" ").map((w, i) => (i > 0 && w !== "" && !isNaN(w) ? (e.startsWith("sound") ? Math.fround(Number(w)) : Number(w)) : w)).join(" ");

test("pearl in water, flowing water, lava and air (executed): flight, drag, bubbles, splash, landing and the client copy match tick for tick", () => {
  for (const r of of("pearl79")) {
    const lid = PORT_LIQUID[r.liquid];
    const world = {
      get: (x, y, z) => (y <= r.floorTop ? 3 : y <= r.liquidTop && lid ? lid : 0),
      solid(x, y, z) { const id = this.get(x, y, z); return id !== 0 && id !== 10 && id !== 42; },
      getMeta: () => 0, remote: r.remote,
    };
    const pr = new Projectiles(() => 0.5), log = [];
    pr.remote = r.remote;
    const particle = (n, x, y, z, vx, vy, vz) => log.push(`particle ${n} ${x} ${y} ${z} ${vx} ${vy} ${vz}`);
    pr.spawner = { spawn: particle };
    pr.sink = particle;
    const rand = new GaussianRandom(9);
    const owner = { kind: "playerMP", connected: true, world, riding: false, fallDistance: 12 };
    const b = { kind: "enderPearl", owner: "player", x: r.start[0], y: r.start[1], z: r.start[2], px: r.start[0], py: r.start[1], pz: r.start[2], mx: r.launch[0], my: r.launch[1], mz: r.launch[2], yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0, ticks: 0, rand, random: rand, dead: false };
    pr.balls.push(b);
    for (const t of r.ticks) {
      const n0 = log.length, e0 = pr.events.length;
      pr.tick(world, [], () => {}, ({ pearl, world: w, hit }) => impactEnderPearl(pearl, { world: w, owner, hit }, {
        particle: (p) => log.push(`particle portal ${p.x} ${p.y} ${p.z} ${p.mx} ${p.my} ${p.mz}`),
        teleport: (_o, x, y, z) => log.push(`setPositionAndUpdate ${x} ${y} ${z}`),
        damage: (_o, d) => { log.push(`attack owner ${d.amount.toFixed(1)}`); return true; },
      }));
      const got = log.slice(n0);
      for (const e of pr.events.slice(e0)) if (e.sound) got.unshift(`sound ${e.sound} ${e.volume} ${e.pitch}`);
      const want = t.events.map((e) => e.replace(/^attack owner ([\d.]+) .*/, "attack owner $1"));
      const label = `${r.name} remote=${r.remote} tick ${t.tick}`;
      assert.deepEqual(got.map(norm), want.map(norm), label + " events");
      assert.equal([b.x, b.y, b.z, b.mx, b.my, b.mz].join(), [...t.pos, ...t.motion].join(), label + " state");
      assert.equal(b.dead, t.dead, label + " dead");
      assert.equal(!!b.water, t.inWater, label + " in water");
      if (b.dead && !r.remote) break;
    }
  }
});

// ---- bowl on a calf ---------------------------------------------------------------------------------------------------------------------------------------------

const NATIVE = { 281: BOWL, 282: MUSHROOM_STEW };
function player(r) {
  const inv = { main: new Array(36).fill(null), current: 0, get held() { return this.main[this.current]; } };
  inv.main[0] = makeStack(BOWL, r.count, r.damage);
  if (r.full) for (let i = 1; i < 36; i++) inv.main[i] = makeStack(1, 64);
  return { creative: r.creative, inventory: inv, get held() { return inv.held; }, add(id, n) { const i = inv.main.findIndex((s) => !s); if (i < 0) return 0; inv.main[i] = makeStack(id, n); return n; } };
}
const snapshot = (p) => p.inventory.main.map((s, i) => (s ? [i, s.id, s.count, s.damage ?? 0] : null)).filter(Boolean);

test("a bowl on a calf cow or mooshroom does nothing; on an adult mooshroom it makes stew (executed, server side)", () => {
  const rows = of("milk79").filter((x) => !x.remote && x.case === "bowl");
  assert.ok(rows.length >= 8);
  for (const r of rows) {
    const p = player(r);
    let result = false;
    if (r.mob === "mooshroom") { const use = mooshroomUse(p.held?.id, r.age); if (use === "bowl") result = useBowl(p, makeStack); }
    if (!result) result = milkCow(p, { drop: () => {} });
    const want = r.inventory.map(([i, id, c, d]) => [i, NATIVE[id] ?? id, c, d]);
    assert.equal(result, r.result, `${r.mob} age ${r.age} n${r.count} full=${r.full} creative=${r.creative}`);
    assert.deepEqual(snapshot(p), want, `${r.mob} age ${r.age} n${r.count} inventory`);
    if (r.age < 0) assert.deepEqual(r.spawned, [], "a calf spawns nothing");
  }
});

// ---- dispenser fire charge ---------------------------------------------------------------------------------------------------------------------------------------

const X = 10, Y = 64, Z = 10;
class Fake {
  constructor(seed) { this.rand = new JavaRandom(seed); }
  getBlock() { return 0; }
  getBlockMetadata() { return 0; }
  get() { return 0; }
  solid() { return false; }
}
function mobsFor(world, smoke) {
  return { world, entities: [], random: () => 0.5, isActive: () => true, fx: { spawn: (...a) => smoke.push(a) }, tickOrder: null };
}

test("dispenser fire charge: the server fires one small fireball with executed acceleration and smoke; a client world dispenses nothing", () => {
  for (const r of of("fire79")) {
    const [dx, dy, dz] = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][r.facing];
    if (r.remote) { // BlockDispenser.updateTick returns at once on a client world: nothing is consumed, spawned or logged
      assert.deepEqual(r.after[0], [385, 2, 0], "the stack of two is untouched (the server world leaves one)");
      assert.deepEqual(r.log, []);
      assert.deepEqual(r.spawned, []);
      assert.deepEqual(r.flight, []);
      continue;
    }
    const w = new Fake(r.seed), smoke = [], mobs = mobsFor(w, smoke), balls = new Fireballs(mobs), aux = [];
    mobs.fireballs = balls;
    const engine = new Dispensing({ aux: (a, x, y, z, d) => aux.push(`aux,${a},${x},${y},${z},${d}`), spawnItem: () => {}, fireball: ({ x, y, z, ax, ay, az }) => balls.launch({ large: false, owner: null, x, y, z, exact: [ax, ay, az] }) });
    engine.dispense(w, X, Y, Z, r.facing, { id: ITEM.FIRE_CHARGE, count: 1, damage: 0 });
    assert.deepEqual(aux, r.log.filter((l) => l.startsWith("aux")), `f${r.facing} aux`);
    assert.equal(balls.list.length, 1);
    const b = balls.list[0], e = r.spawned[0];
    assert.ok(Math.abs(b.x - e.x) < 1e-12 && Math.abs(b.y - e.y) < 1e-12 && Math.abs(b.z - e.z) < 1e-12, `f${r.facing} start`);
    for (const t of r.flight) {
      const n0 = smoke.length;
      balls.tickBall(b);
      assert.equal(b.dead, t.dead);
      assert.ok([b.x, b.y, b.z].every((v, i) => Math.abs(v - t.pos[i]) < 1e-12), `f${r.facing} tick ${t.tick} position`);
      assert.deepEqual(smoke.slice(n0).map((s) => norm(`particle ${s.join(" ")}`)), t.particles.map(norm), `f${r.facing} tick ${t.tick} smoke`);
    }
  }
});

// ---- gaussian audit ---------------------------------------------------------------------------------------------------------------------------------------------

test("gaussianFrom is java.util.Random.nextGaussian (polar method on StrictMath.log, second value cached) over the same nextDouble stream", () => {
  for (const seed of [0, 1, 7, 123456789, 2 ** 40 + 5]) {
    const a = new JavaRandom(seed), b = new JavaRandom(seed), g = gaussianFrom(() => b.nextDouble());
    for (let i = 0; i < 64; i++) assert.equal(g(), a.nextGaussian(), `seed ${seed} draw ${i}`);
  }
});

// ---- batch 78's pearl records through the multiplayer server (ServerDispense.pearlImpact) ----------------------------------------------------------------------------

const ref78 = JSON.parse(readFileSync(new URL("../public/research/spexec78-reference.json", import.meta.url), "utf8"));

test("server pearl landing (spexec78 executed records): a connected player of this dimension is moved, dismounted, hurt 5 and loses the fall; nobody else is touched", async () => {
  const { ServerDispense } = await import("./multiplayer/server-dispense.js");
  for (const r of ref78.records.filter((x) => x.kind === "pearl" && !x.remote)) { // a dedicated server world is never remote
    const log = [];
    const p = r.owner === "none" || r.owner === "disconnected" ? null : {
      dead: false, dimension: r.owner === "other-world" ? 1 : 0, mount: r.owner === "riding" ? {} : null, fallDistance: 12,
      position: { copy: ({ x, y, z }) => log.push(`setPositionAndUpdate ${x} ${y} ${z}`) }, previous: { copy: () => {} }, velocity: {},
    };
    const hitMob = { type: "zombie" }, hit = r.owner === "with-hit" ? hitMob : null;
    const pp = r.owner === "with-hit" ? { dead: false, dimension: 0, mount: null, fallDistance: 12, position: { copy: ({ x, y, z }) => log.push(`setPositionAndUpdate ${x} ${y} ${z}`) }, previous: { copy: () => {} }, velocity: {} } : p;
    const host = {
      ownerOf: () => pp, hangingOf: () => null, throwerBody: () => null, // b92 credit92: the stub host gains the new helper (no dead thrower in these records)
      sim: { vehicles: { dismount: () => log.push("mountEntity null") }, damagePlayer: (_p, amount) => log.push(`attack owner ${amount.toFixed(1)}`) },
    };
    const lane = { dim: 0, world: { remote: false }, mobs: { entities: [hitMob], damage: (e, amount) => { log.push(`attack ${e.type} ${amount.toFixed(1)}`); return true; } } };
    const pearl = { x: 10.25, y: 20.5, z: 30.75, random: new GaussianRandom(7), dead: false };
    ServerDispense.prototype.pearlImpact.call(host, lane, { pearl, hit });
    const want = r.events.filter((e) => !e.startsWith("particle")).map((e) => e.replace(/ (type|source)=.*$/, ""));
    assert.deepEqual(log, want, r.owner);
    assert.equal(pearl.dead, r.dead, r.owner + " dead");
    if (pp) assert.equal(pp.fallDistance, r.fallDistance, r.owner + " fall distance"); // an offline owner has no player entity on the server to keep a fall
  }
});

test("server cow and mooshroom use (spexec78 + spexec79 executed records): bucket, bowl, shears and milk bucket, calves and adults, full inventories and Creative", async () => {
  const { serverAnimalUse } = await import("./multiplayer/animal-use.js");
  const { installMooshroomGolem } = await import("./mooshroom-golem-live.js");
  const { SHEARS, BUCKET, MILK_BUCKET, RED_MUSHROOM } = await import("./mooshroom.js");
  class Stub {}
  installMooshroomGolem(Stub);
  const native = { 281: BOWL, 282: MUSHROOM_STEW, 325: BUCKET, 335: MILK_BUCKET, 359: SHEARS, 40: RED_MUSHROOM };
  const item = { shear: 359, bowl: 281, bucket: 325, "milk-bucket": 335 };
  const rows = [...ref78.records.filter((x) => x.kind === "milk"), ...of("milk79")].filter((x) => !x.remote && item[x.case]);
  assert.ok(rows.length >= 40);
  for (const r of rows) {
    const inv = { main: new Array(36).fill(null), current: 0, get held() { return this.main[this.current]; } };
    inv.main[0] = makeStack(native[item[r.case]], r.count, r.damage);
    if (r.full) for (let i = 1; i < 36; i++) inv.main[i] = makeStack(1, 64);
    const survival = {
      creative: r.creative, inventory: inv, get held() { return inv.held; },
      add(id, n) { const i = inv.main.findIndex((s) => !s); if (i < 0) return 0; inv.main[i] = makeStack(id, n); return n; },
      wear(id, n) { inv.main[0].damage += n; },
    };
    const e = { type: r.mob, health: 10, growingAge: r.age, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    const mobs = new Stub();
    Object.assign(mobs, { entities: [e], events: [], create: (type) => ({ type }), fx: null, shear: () => false, feed: () => false, dye: () => false });
    const drops = [];
    const result = serverAnimalUse(mobs, { id: 1, survival }, e, { drop: (s) => drops.push(s) });
    const label = `${r.case} ${r.mob} age ${r.age} n${r.count} full=${r.full} creative=${r.creative}`;
    assert.equal(result, r.result, label);
    assert.deepEqual(inv.main.map((s, i) => (s ? [i, s.id, s.count, s.damage ?? 0] : null)).filter(Boolean), r.inventory.map(([i, id, c, d]) => [i, native[id] ?? id, c, d]), label + " inventory");
    assert.deepEqual([...drops.map((s) => s.id), ...mobs.events.filter((v) => v.drop).map((v) => v.drop)], r.spawned.filter((s) => s.item).map((s) => native[s.item[0]]), label + " dropped");
  }
});
