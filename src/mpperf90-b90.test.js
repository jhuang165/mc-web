// Batch 90 mpperf90: MC_MPPERF90 off / on / verify give the same server state with fewer allocations: the vehicle per-view loop, FineGrid's recycled arrays, world.get's
// inline path (and moveEntityBody's closure moved to a module function).
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fast90, eachView90 } from "./mpperf90-fast.js";
import { FineGrid, fineConfig, beginPushGrid, endPushGrid, pushNear } from "./push-grid.js";
import { World, WorldChunk } from "./world.js";
import { buildPlayersScene, lcg } from "./mpperf77-scene.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";

const withMode = (mode, fn) => { const was = fast90.mode; fast90.mode = mode; try { return fn(); } finally { fast90.mode = was; } };

test("eachView90: the same visits as the for-of loop, entries added or deleted during the walk included", () => {
  const walk = (mode) => withMode(mode, () => {
    const m = new Map([["a", 1], ["b", 2], ["c", 3], ["d", 4]]), seen = [];
    eachView90(m, (v, id) => { seen.push([id, v]); if (v === 2) { m.delete("d"); m.set("z", 9); } if (v === 9) m.set("y", 10); });
    return seen;
  });
  const off = walk("off");
  assert.deepEqual(off.map((x) => x[0]), ["a", "b", "c", "z", "y"]);
  assert.deepEqual(walk("on"), off);
  assert.deepEqual(walk("verify"), off);
});

// Random mobs in a pen; each round is one mob loop (begin, a query per mob with some moved, end). The grids hand their arrays on, as the server's ticks do.
function gridRounds(mode, rounds) {
  const r = lcg(90), answers = [];
  return withMode(mode, () => {
    const was = fineConfig.mode; fineConfig.mode = mode === "verify" ? "verify" : "on";
    try {
      const list = [];
      for (let i = 0; i < 130; i++) list.push({ x: r() * 30, z: r() * 30, y: 4, w: 0.3 + r() * 0.5 });
      for (let round = 0; round < rounds; round++) {
        if (round === 3) list.splice(10, 7); // a different length: a new grid, arrays sized again
        if (round === 5) for (let i = 0; i < 12; i++) list.push({ x: r() * 30, z: r() * 30, y: 4, w: 4 }); // wide ones: `big`
        beginPushGrid();
        for (let k = 0; k < list.length; k++) {
          const e = list[k]; e.x += r() - 0.5; e.z += r() - 0.5;
          const near = [e.x - e.w, 0, e.z - e.w, e.x + e.w, 2, e.z + e.w];
          const got = pushNear(list, e, near, (o) => o.w / 2, (o) => Math.abs(o.x - e.x) < e.w + o.w / 2 && Math.abs(o.z - e.z) < e.w + o.w / 2);
          answers.push(got === null ? null : got.map((o) => list.indexOf(o)).join(","));
        }
        endPushGrid();
      }
      return createHash("sha256").update(JSON.stringify(answers)).digest("hex");
    } finally { fineConfig.mode = was; }
  });
}

test("FineGrid with recycled arrays answers every query as fresh ones do, across loops, a changed length and wide entities", () => {
  const off = gridRounds("off", 8);
  assert.equal(gridRounds("on", 8), off);
  assert.equal(gridRounds("verify", 8), off);
});

test("FineGrid recycling takes the retired grid's arrays and clears the cell lists", () => {
  const list = Array.from({ length: 70 }, (_, i) => ({ x: i % 10, z: Math.floor(i / 10), y: 1 }));
  const a = withMode("on", () => new FineGrid(list, () => 0.3));
  const near = [0, 0, 0, 20, 2, 20];
  const first = a.query(near).length;
  const b = withMode("on", () => new FineGrid(list.slice(0, 40), () => 0.3, a));
  assert.equal(b.ents, a.ents); assert.equal(b.keyAt, a.keyAt); assert.equal(b.buf, a.buf);
  assert.equal(b.ents.length, 40); assert.equal(b.keyAt.length, 40);
  assert.equal(first, 70); assert.equal(b.query(near).length, 40);
  const c = withMode("off", () => new FineGrid(list, () => 0.3, b));
  assert.notEqual(c.ents, b.ents);
});

test("world.get: the inline read gives the reference answer for in-column, other-column, outside and non-integer cells (off / on / verify)", () => {
  const world = new World("g90", "javaStreamed", 15, "flat", "");
  world.chunks = new Map();
  for (const [x, z] of [[0, 0], [1, 0], [-1, -1]]) world.chunks.set(`${x},${z}`, new WorldChunk(x, z, world.height));
  world.lastChunk = null;
  for (let y = 0; y < 30; y++) world.set(5, y, 5, 3, false); world.set(20, 7, 3, 4, false); world.set(-3, 9, -3, 5, false);
  const cells = [[5, 10, 5], [5, 40, 5], [5, -1, 5], [5, world.height, 5], [20, 7, 3], [-3, 9, -3], [5, 10, 5], [6.5, 10, 5], [5, 10.5, 5], [100, 10, 100], [5, 3, 5], [NaN, 3, 5], [2 ** 31, 3, 5], [-0, 3, 5], [5, 3, 5]];
  const run = (mode) => withMode(mode, () => { world.lastChunk = null; return cells.map(([x, y, z]) => world.get(x, y, z)); });
  const off = run("off");
  assert.ok(off.includes(3) && off.includes(4) && off.includes(5));
  assert.deepEqual(run("on"), off);
  assert.deepEqual(run("verify"), off);
});

// A seeded multiplayer scene with vehicles near the players, one of whom leaves: every packet hashed (as mpperf89's scene).
function sceneHash(mode) {
  const real = Math.random, rs = lcg(12390); Math.random = () => rs();
  try {
    return withMode(mode, () => {
      const s = buildPlayersScene({ players: 4, mobs: 80, seed: 90, size: 120 }), h = createHash("sha256"), r = lcg(901);
      Object.defineProperty(s.chunkViews, "radius", { value: 3 }); s.chunkViews.watches.clear();
      for (const p of s.players.values()) {
        s.vehicles.boats.spawnBoat({ x: p.position.x + 3, y: 10, z: p.position.z + 1 });
        s.vehicles.carts.spawnEmpty({ x: p.position.x - 3, y: 10, z: p.position.z - 1 });
      }
      let carried = 0;
      for (let tick = 0; tick < 50; tick++) {
        if (tick % 10 === 0) for (const id of s.players.keys()) s.input(id, { type: "input", controls: { ...IDLE_INPUT, forward: r() < 0.7 ? 1 : 0 }, yaw: r() * 6, pitch: -0.2, current: 0, hotbar: Array(9).fill(null) });
        if (tick === 25) s.removePlayer("p1");
        for (const p of s.players.values()) { const k = +p.id.slice(1); p.position.x = Math.min(115, Math.max(5, p.position.x + 2 * Math.cos(tick / 9 + k))); p.position.z = Math.min(115, Math.max(5, p.position.z + 2 * Math.sin(tick / 7 + k))); }
        s.tick();
        for (const [id, p] of s.players) {
          if (p.vehPackets) carried++;
          h.update(JSON.stringify([tick, id, p.chunkOut ?? null, p.mobPackets ?? null, p.vehPackets ?? null, p.dispOut ?? null, p.position.x, p.position.z]));
          p.chunkOut = null; p.mobPackets = null; p.vehPackets = null; p.dispOut = null; p.dimOut = null;
        }
      }
      assert.ok(carried > 3 && !s.players.has("p1"), `carried ${carried}`);
      return h.digest("hex");
    });
  } finally { Math.random = real; }
}

test("a seeded scene with carts, boats and a departure sends the same packets off / on / verify", () => {
  const off = sceneHash("off");
  assert.equal(sceneHash("on"), off);
  assert.equal(sceneHash("verify"), off);
});

test("seeded server scenes hash the same off / on / verify (MC_MPPERF83..90 all verify)", () => {
  const verifyAll = { MC_MPPERF83: "verify", MC_MPPERF84: "verify", MC_MPPERF85: "verify", MC_MPPERF86: "verify", MC_MPPERF87: "verify", MC_MPPERF88: "verify", MC_MPPERF89: "verify" };
  const tail = (s) => s.split("mobs=").pop();
  for (const scene of ["pen", "terrain", "travel"]) {
    const hash = (m) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", `--scene=${scene}`, "--state", "--ticks=100", "--mobs=70"], { env: { ...process.env, MC_MPPERF90: m, ...(m === "verify" ? verifyAll : {}) }, encoding: "utf8" }).stdout.trim();
    const off = hash("off");
    assert.match(off, /mode90=off (mode91=\w+ )?(mode92=\w+ )?(mode93=\w+ )?(mode94=\w+ )?(mode95=\w+ )?(mode96=\w+ )?mobs=\d+ \[/);
    assert.equal(tail(hash("on")), tail(off));
    assert.equal(tail(hash("verify")), tail(off));
  }
  const mobs = (m) => spawnSync(process.execPath, ["tools/bench-server-mobs.mjs", "--state"], { env: { ...process.env, MC_MPPERF90: m, ...(m === "verify" ? verifyAll : {}) }, encoding: "utf8" }).stdout.trim().split("\n").pop();
  const off = mobs("off");
  assert.match(off, /^\["[0-9a-f]+"/);
  assert.equal(mobs("on"), off);
  assert.equal(mobs("verify"), off);
});
