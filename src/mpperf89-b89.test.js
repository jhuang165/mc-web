// Batch 89 mpperf89: MC_MPPERF89 off / on / verify give the same mobs, AI decisions, packets and tracker results, with fewer allocations and less work per server tick.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fast89, eachValue89, leftAny89, anyGone89, anyNew89, restoreShaped89, aiOf89, canUse89, canUseReference89 } from "./mpperf89-fast.js";
import { fast88, mobShape88 } from "./mpperf88-fast.js";
import { EntityWorld } from "./entities.js";
import { Task, TaskList } from "./ai.js";
import { buildPlayersScene, lcg } from "./mpperf77-scene.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { SNOWBALL } from "./player-throw-simulation.js";

const withMode = (mode, fn) => { const was = fast89.mode; fast89.mode = mode; try { return fn(); } finally { fast89.mode = was; } };
const same = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k, i) => k === Object.keys(b)[i] && Object.is(a[k], b[k]));

test("eachValue89: the same visits as the for-of loop, entries added or deleted during the walk included (Map, Set, array)", () => {
  const walk = (mode, make) => withMode(mode, () => {
    const c = make(), seen = [];
    eachValue89(c, (v, k) => {
      seen.push([v, k]);
      if (c instanceof Map) { if (v === 2) { c.delete("d"); c.set("z", 9); } if (v === 9) c.set("y", 10); }
      else if (c instanceof Set) { if (v === 2) { c.delete(4); c.add(9); } }
      else if (v === 2) c.push(9);
    });
    return seen;
  });
  const makers = [() => new Map([["a", 1], ["b", 2], ["c", 3], ["d", 4]]), () => new Set([1, 2, 3, 4]), () => [1, 2, 3, 4], () => new Map()];
  for (const make of makers) {
    const off = walk("off", make);
    assert.deepEqual(walk("on", make), off);
    assert.deepEqual(walk("verify", make), off);
  }
  assert.deepEqual(walk("on", makers[0]).map(([v]) => v), [1, 2, 3, 9, 10]); // "d" deleted before it was reached; "z" and "y" added and visited
});

test("leftAny89 / anyGone89 / anyNew89: true exactly when the guarded loop has something to do", () => {
  const r = lcg(8901);
  for (let round = 0; round < 400; round++) {
    const ids = Array.from({ length: Math.floor(r() * 6) }, (_, k) => "p" + Math.floor(r() * 8) + k % 2);
    const watchers = new Map(ids.map((id) => [id, { pid: id }])), players = new Map(Array.from({ length: Math.floor(r() * 6) }, () => "p" + Math.floor(r() * 8) + Math.floor(r() * 2)).map((id) => [id, {}]));
    assert.equal(leftAny89(watchers, players), [...watchers.keys()].some((pid) => !players.has(pid)));
    const ents = Array.from({ length: 6 }, (_, k) => ({ k }));
    const objs = new Map(ents.filter(() => r() < 0.5).map((e) => [e, { e }])), list = ents.filter(() => r() < 0.5).map((e) => ({ e })), alive = new Set(list.map((x) => x.e));
    assert.equal(anyGone89(objs, alive), [...objs.keys()].some((e) => !alive.has(e)));
    assert.equal(anyNew89(list, objs), list.some((x) => !objs.has(x.e)));
  }
});

// A task whose answers come from a seeded stream and whose calls are logged.
class Probe extends Task {
  constructor(name, mutex, r, log, interruptible = true) { super(); this.name = name; this.mutex = mutex; this.r = r; this.log = log; this.interruptibleAnswer = interruptible; }
  shouldExecute() { this.log.push("should " + this.name); return this.r() < 0.5; }
  continueExecuting() { this.log.push("continue " + this.name); return this.r() < 0.7; }
  isInterruptible() { return this.interruptibleAnswer; }
  startExecuting() { this.log.push("start " + this.name); }
  resetTask() { this.log.push("reset " + this.name); }
  updateTask() { this.log.push("update " + this.name); }
}

test("canUse89: the reference answer for random task lists (priorities, mutex bits, non-interruptible tasks)", () => {
  const r = lcg(8902);
  for (let round = 0; round < 500; round++) {
    const t = new TaskList(), log = [];
    const n = 1 + Math.floor(r() * 7);
    for (let k = 0; k < n; k++) t.add(Math.floor(r() * 4), new Probe("t" + k, Math.floor(r() * 8), r, log, r() < 0.7));
    t.running = t.entries.filter(() => r() < 0.5);
    if (r() < 0.3) t.running.push({ priority: Math.floor(r() * 4), action: new Probe("gone", Math.floor(r() * 8), r, log, r() < 0.5) }); // a running task no longer in the list
    for (const entry of t.entries) for (const mode of ["on", "verify"]) withMode(mode, () => assert.equal(canUse89(t, entry), canUseReference89(t, entry)));
    for (const entry of t.entries) assert.equal(withMode("on", () => t.canUse(entry)), withMode("off", () => t.canUse(entry)));
  }
});

// A probe that, now and then, removes a task from its list or adds one while the list is being walked (the live-array semantics of the loops).
class Meddler extends Probe {
  constructor(name, mutex, r, log, list) { super(name, mutex, r, log); this.list = list; this.made = 0; }
  meddle(when) {
    const x = this.r();
    if (x < 0.06 && this.list.entries.length > 1) { const victim = this.list.entries[Math.floor(this.r() * this.list.entries.length)].action; this.log.push(`${when} ${this.name} removes ${victim.name}`); this.list.remove(victim); }
    else if (x > 0.95 && this.list.entries.length < 8) { const name = `${this.name}+${this.made++}`; this.log.push(`${when} ${this.name} adds ${name}`); this.list.add(Math.floor(this.r() * 4), new Probe(name, 1 << Math.floor(this.r() * 3), this.r, this.log)); }
  }
  shouldExecute() { this.meddle("should"); return super.shouldExecute(); }
  continueExecuting() { this.meddle("continue"); return super.continueExecuting(); }
  updateTask() { super.updateTask(); this.meddle("update"); }
}

test("TaskList.tick: the same calls when tasks remove or add tasks during the walk, off / on / verify", () => {
  const run = (mode) => withMode(mode, () => {
    const r = lcg(8905), log = [], lists = [];
    for (let m = 0; m < 20; m++) {
      const t = new TaskList();
      for (let k = 0; k < 5; k++) t.add(Math.floor(r() * 4), k % 2 ? new Meddler(`m${m}t${k}`, 1 << Math.floor(r() * 3), r, log, t) : new Probe(`m${m}t${k}`, 1 << Math.floor(r() * 3), r, log));
      lists.push(t);
    }
    for (let tick = 0; tick < 80; tick++) for (const t of lists) { t.tick(); log.push(t.running.map((e) => e.action.name).join(",") + "|" + t.entries.map((e) => e.action.name).join(",")); }
    return log;
  });
  const off = run("off");
  assert.ok(off.some((x) => x.includes(" removes ")) && off.some((x) => x.includes(" adds ")));
  assert.deepEqual(run("on"), off);
  assert.deepEqual(run("verify"), off);
});

test("TaskList.tick: the same calls, in the same order, and the same running list off / on / verify", () => {
  const run = (mode) => withMode(mode, () => {
    const r = lcg(8903), log = [], lists = [];
    for (let m = 0; m < 30; m++) {
      const t = new TaskList();
      const n = 1 + Math.floor(r() * 6);
      for (let k = 0; k < n; k++) t.add(Math.floor(r() * 4), new Probe(`m${m}t${k}`, 1 << Math.floor(r() * 3), r, log, r() < 0.8));
      lists.push(t);
    }
    for (let tick = 0; tick < 60; tick++) for (const t of lists) { t.tick(); log.push(t.running.map((e) => e.action.name).join(",")); }
    return log;
  });
  const off = run("off");
  assert.ok(off.some((x) => x.startsWith("update ")) && off.some((x) => x.startsWith("reset ")));
  assert.deepEqual(run("on"), off);
  assert.deepEqual(run("verify"), off);
});

test("EntityWorld.restore: a restored mob has the same keys and values off / on / verify (the wrapper runs after every install wrapper)", () => {
  const types = ["pig", "cow", "sheep", "chicken", "zombie", "skeleton", "creeper", "spider", "villager", "slime", "enderman", "wolf", "ocelot", "horse", "pigman", "ghast", "blaze", "squid", "bat", "ender_dragon"];
  const saved = (() => {
    const w = new EntityWorld({ size: 128, height: 256 }, [], lcg(89));
    for (const [k, t] of types.entries()) { const e = w.create(t, 10 + k * 0.5, 64, -0); if (e) w.entities.push(e); }
    return JSON.parse(JSON.stringify(w.serialize()));
  })();
  const load = (mode) => withMode(mode, () => new EntityWorld({ size: 128, height: 256 }, JSON.parse(JSON.stringify(saved)), lcg(89)).entities);
  const off = load("off");
  assert.ok(off.length >= types.length - 1);
  for (const mode of ["on", "verify"]) {
    const got = load(mode);
    assert.equal(got.length, off.length);
    got.forEach((e, k) => {
      assert.deepEqual(Object.keys(e), Object.keys(off[k]), e.type);
      assert.ok(same({ ...e, ai: null }, { ...off[k], ai: null }) || JSON.stringify(e) === JSON.stringify(off[k]), e.type);
    });
  }
  assert.equal(EntityWorld.prototype.restore.name, "restore89");
  const dragon = withMode("on", () => new EntityWorld({ size: 128, height: 256 }, [], lcg(89)).restore(saved.find((e) => e.type === "ender_dragon") ?? { type: "pig", x: 1, y: 64, z: 1 }));
  assert.ok(dragon && (dragon.type !== "ender_dragon" || "dragonSave" in dragon)); // the dragon's own restore wrapper still ran
});

test("restoreShaped89: null passes through; off skips the shape; verify throws when the shape changes a key or value", () => {
  let shaped = 0;
  const shape = (e) => { shaped++; return e; };
  const base = function (e) { return e; };
  const wrapped = restoreShaped89(base, shape);
  withMode("on", () => { assert.equal(wrapped.call({}, null), null); assert.equal(shaped, 0); const e = { x: 1 }; assert.equal(wrapped.call({}, e), e); assert.equal(shaped, 1); });
  withMode("off", () => { wrapped.call({}, { x: 1 }); assert.equal(shaped, 1); });
  const bad = restoreShaped89(base, (e) => { e.x = 2; return e; });
  withMode("verify", () => assert.throws(() => bad.call({}, { x: 1 }), /mpperf89 restore shape mismatch/));
  withMode("verify", () => { const e = { x: -0, y: NaN }; assert.equal(restoreShaped89(base, mobShape88).call({}, e), e); assert.ok(Object.is(e.x, -0) && Number.isNaN(e.y)); });
  assert.equal(fast88.mode === "off" || typeof mobShape88 === "function", true);
});

test("EntityWorld ai: one MobAI per world, the same object off / on / verify; aiOf89 makes it when missing", () => {
  const w = new EntityWorld({ size: 128, height: 256 }, [], lcg(8904));
  const a = withMode("on", () => w.ai);
  assert.equal(withMode("off", () => w.ai), a);
  assert.equal(withMode("verify", () => w.ai), a);
  assert.equal(w.mobAI, a);
  const w2 = new EntityWorld({ size: 128, height: 256 }, [], lcg(8904));
  const b = withMode("on", () => aiOf89(w2));
  assert.ok(b && b === w2.mobAI && b !== a);
});

// A seeded multiplayer scene: moving players who throw snowballs, carts and boats near them, a /summon-style restore of saved mobs, and one player who leaves. Every packet each
// player is sent (chunk view, mobs, vehicles, dispense lanes with the thrown trackers) is hashed. Math.random is seeded as in the benches.
function sceneHash(mode) {
  const real = Math.random, rs = lcg(12389); Math.random = () => rs();
  try {
    return withMode(mode, () => {
      const s = buildPlayersScene({ players: 4, mobs: 80, seed: 89, size: 120 }), h = createHash("sha256"), r = lcg(891);
      Object.defineProperty(s.chunkViews, "radius", { value: 3 }); s.chunkViews.watches.clear();
      const host = s.mobs.mobs;
      for (const p of s.players.values()) {
        p.survival.inventory.main[0] = { id: SNOWBALL, count: 64, damage: 0 }; p.survival.selected = 0;
        s.vehicles.boats.spawnBoat({ x: p.position.x + 3, y: 10, z: p.position.z + 1 });
        s.vehicles.carts.spawnEmpty({ x: p.position.x - 3, y: 10, z: p.position.z - 1 });
      }
      const saved = host.entities.slice(0, 6).map((e) => host.serializeOne(e));
      let thrown = 0, carried = 0, restored = 0;
      for (let tick = 0; tick < 60; tick++) {
        if (tick % 10 === 0) for (const id of s.players.keys()) s.input(id, { type: "input", controls: { ...IDLE_INPUT, forward: r() < 0.7 ? 1 : 0 }, yaw: r() * 6, pitch: -0.2, current: 0, hotbar: Array(9).fill(null) });
        if (tick % 4 === 1) for (const p of s.players.values()) if (s.dispense.throwHeld(p)) thrown++;
        if (tick === 12) for (const rec of saved) { const m = host.restore({ ...rec, id: "mob-" + host.nextId++, x: rec.x + 1, z: rec.z + 1 }, { summoned: true }); if (m) { host.entities.push(m); restored++; } }
        if (tick === 30) s.removePlayer("p1");
        for (const p of s.players.values()) { const k = +p.id.slice(1); p.position.x = Math.min(115, Math.max(5, p.position.x + 2 * Math.cos(tick / 9 + k))); p.position.z = Math.min(115, Math.max(5, p.position.z + 2 * Math.sin(tick / 7 + k))); }
        s.tick();
        for (const [id, p] of s.players) {
          if (p.vehPackets) carried++;
          h.update(JSON.stringify([tick, id, p.chunkOut ?? null, p.mobPackets ?? null, p.vehPackets ?? null, p.dispOut ?? null, p.position.x, p.position.z]));
          p.chunkOut = null; p.mobPackets = null; p.vehPackets = null; p.dispOut = null; p.dimOut = null;
        }
      }
      for (const e of host.entities) h.update(JSON.stringify({ ...host.serializeOne(e), uuid: null }));
      assert.ok(thrown > 20 && carried > 3 && restored === 6 && !s.players.has("p1"), `thrown ${thrown} carried ${carried} restored ${restored}`);
      return h.digest("hex");
    });
  } finally { Math.random = real; }
}

test("a seeded scene with thrown snowballs, carts, boats, restored mobs and a departure sends the same packets off / on / verify", () => {
  const off = sceneHash("off");
  assert.equal(sceneHash("on"), off);
  assert.equal(sceneHash("verify"), off);
});

test("seeded server scenes hash the same off / on / verify (MC_MPPERF83..89 all verify)", () => {
  const verifyAll = { MC_MPPERF83: "verify", MC_MPPERF84: "verify", MC_MPPERF85: "verify", MC_MPPERF86: "verify", MC_MPPERF87: "verify", MC_MPPERF88: "verify" };
  for (const scene of ["pen", "terrain"]) {
    const hash = (m) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", `--scene=${scene}`, "--state", "--ticks=100", "--mobs=60"], { env: { ...process.env, MC_MPPERF89: m, ...(m === "verify" ? verifyAll : {}) }, encoding: "utf8" }).stdout.trim();
    const off = hash("off");
    assert.match(off, /mode89=off (mode90=\w+ )?(mode91=\w+ )?(mode92=\w+ )?mobs=\d+ \[/);
    const tail = (s) => s.split("mobs=").pop();
    assert.equal(tail(hash("on")), tail(off));
    assert.equal(tail(hash("verify")), tail(off));
  }
  const mobs = (m) => spawnSync(process.execPath, ["tools/bench-server-mobs.mjs", "--state"], { env: { ...process.env, MC_MPPERF89: m, ...(m === "verify" ? verifyAll : {}) }, encoding: "utf8" }).stdout.trim().split("\n").pop();
  const off = mobs("off");
  assert.match(off, /^\["[0-9a-f]+"/);
  assert.equal(mobs("on"), off);
  assert.equal(mobs("verify"), off);
});
