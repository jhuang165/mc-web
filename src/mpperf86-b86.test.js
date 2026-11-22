// Batch 86 mpperf86: MC_MPPERF86 off / on / verify give the same packet order, walk order, state lists, packets and item physics.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fast86, seqOrder, seqScratch, seqDone, plainPacket, wireNum, parsedState, samePacket, stateDiffs86 } from "./mpperf86-fast.js";
import { stateDiffs, fastConfig as fast77 } from "./mpperf77-fast.js";
import { MobTracker } from "./entity-tracker.js";
import { ItemEntities } from "./item-entities.js";
import { World, BLOCKS, WATER, LAVA, FIRE } from "./world.js";
import { lcg } from "./mpperf77-scene.js";

const withMode = (mode, fn) => { const was = fast86.mode; fast86.mode = mode; try { return fn(); } finally { fast86.mode = was; } };

test("seqOrder: ascending stamps like the stable triple sort; duplicate, missing or widely spread stamps fall back", () => {
  const r = lcg(86);
  for (let round = 0; round < 200; round++) {
    const seq = new Map(), parts = [], n = Math.floor(r() * 40);
    const stamps = Array.from({ length: n }, (_, k) => 1000 + k * (round % 3 === 0 ? 2 : 1));
    for (let k = stamps.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [stamps[k], stamps[j]] = [stamps[j], stamps[k]]; }
    let at = 0;
    while (at < n) { const take = 1 + Math.floor(r() * 4), packets = []; for (let k = 0; k < take && at < n; k++) { const p = { type: "move", k: at }; seq.set(p, stamps[at++]); packets.push(p); } parts.push({ entry: { packets } }); }
    const ref = []; for (const en of parts) for (const pk of en.entry.packets) ref.push([seq.get(pk), en, pk]); ref.sort((a, b) => a[0] - b[0]);
    const sc = seqScratch(), got = seqOrder(parts, (p) => seq.get(p), sc);
    assert.equal(got, n);
    for (let k = 0; k < n; k++) { assert.equal(sc.pk[k], ref[k][2]); assert.equal(sc.en[k], ref[k][1]); }
    seqDone(sc);
    assert.equal(sc.slotP.filter((x) => x !== undefined).length, 0);
  }
  const two = (a, b) => [{ entry: { packets: [{ s: a }] } }, { entry: { packets: [{ s: b }] } }];
  assert.equal(seqOrder(two(5, 5), (p) => p.s, seqScratch()), -1); // packetSeq 0 for an unstamped packet: ties keep the stable sort
  assert.equal(seqOrder(two(1, 1e6), (p) => p.s, seqScratch()), -1);
  assert.equal(seqOrder(two(1.5, 2), (p) => p.s, seqScratch()), -1);
  assert.equal(seqOrder([], (p) => p.s, seqScratch()), 0);
});

test("packet copies: plain packets spread whole, the wire number and the parsed state cache give the reference values", () => {
  const pk = { type: "move", dx: 1, dy: -0, dz: 2 };
  assert.ok(plainPacket(pk));
  assert.ok(!plainPacket({ type: "attach", mode: 0, entity: {}, vehicle: null }));
  assert.ok(!plainPacket({ type: "spawn", after: undefined }));
  const { entity, vehicle, holder, after, ...rest } = pk;
  assert.ok(samePacket({ ...pk, i: 3 }, { ...rest, i: 3 }));
  assert.ok(!samePacket({ a: 1, b: 2 }, { b: 2, a: 1 })); // key order counts
  assert.ok(!samePacket({ a: 0 }, { a: -0 }));
  const num = (e) => Number(String(e.id).replace(/^mob-/, ""));
  const e = { id: "mob-41" };
  for (const mode of ["on", "verify"]) withMode(mode, () => { assert.equal(wireNum(e, num), 41); e.id = "mob-42"; assert.equal(wireNum(e, num), 42); e.id = "mob-41"; });
  for (const s of ['{}', '{"dead":1,"hurt":1}', '{"tamed":1,"collar":14,"hp":8}', '{"held":{"id":373,"damage":0}}', '{"hy":[0.5,1],"hpi":[0,0]}', '{"carried":"x","carriedData":0}']) {
    const a = parsedState(s), b = parsedState(s);
    assert.deepEqual({ type: "state", i: 1, ...a }, { type: "state", i: 1, ...JSON.parse(s) });
    if (/[[{]/.test(s.slice(1))) assert.notEqual(a, b, "nested values are parsed fresh"); else assert.equal(a, b);
  }
});

test("stateDiffs86: the same lists per view as mpperf77 stateDiffs (fast and reference), with the state asked once per watched entry", () => {
  const r = lcg(861);
  for (let round = 0; round < 50; round++) {
    const watchers = Array.from({ length: 1 + Math.floor(r() * 5) }, (_, k) => ({ k }));
    const views = watchers.flatMap((w) => Array.from({ length: 1 + Math.floor(r() * 2) }, () => ({ watcher: w, known: new Map() })));
    views.push({ watcher: { lost: true }, known: new Map() });
    const entries = new Map();
    for (let n = 0; n < 30; n++) {
      const e = { n, s: `s${Math.floor(r() * 3)}` }, set = new Set();
      for (const w of watchers) if (r() < 0.5) set.add(w);
      entries.set(e, { entry: { set } });
      for (const v of views) if (r() < 0.5) v.known.set(e, `s${Math.floor(r() * 3)}`);
    }
    let asks = 0;
    const stateOf = (e) => { asks++; return e.s; };
    const got = stateDiffs86(views.values(), entries, stateOf), mine = asks;
    for (const m of ["on", "off"]) {
      const was = fast77.mode; fast77.mode = m;
      try {
        asks = 0;
        const ref = stateDiffs(views.values(), entries, stateOf);
        if (m === "on") assert.equal(mine, asks);
        assert.equal(got.size, ref.size);
        for (const [v, l] of ref) assert.deepEqual(got.get(v), l);
      } finally { fast77.mode = was; }
    }
  }
});

test("walk: one pass gives keys() (and its filter) in every mode, with a shared order and the player's key", () => {
  const mk = (n0) => { const t = new MobTracker(10); for (let n = n0; n < n0 + 40; n++) t.entryOf({ id: `mob-${n}`, type: "cow", x: n, y: 64, z: 0 }, 0.9, 1.3); return t; };
  const a = mk(1), b = mk(100);
  const ref = () => [a.walkReference(), b.walkReference()];
  const before = ref();
  for (const mode of ["on", "verify"]) withMode(mode, () => assert.deepEqual([a.walk(), b.walk()], before));
  b.shareOrder(a); a.playerId = 7; a.addPlayerKey();
  const shared = ref();
  assert.ok(shared[0].length === 40 && shared[1].length === 40);
  for (const mode of ["on", "verify", "off"]) withMode(mode, () => assert.deepEqual([a.walk(), b.walk()], shared));
});

// A real World with stairs, fences, slabs, webs, soul sand, cactus, water, lava, fire and every other id over a stone floor.
function soup(r, span = 16, height = 5) {
  const w = new World("mpperf86-test");
  for (let x = 0; x < span; x++) for (let z = 0; z < span; z++) {
    w.put(x, 0, z, 1, 0, false);
    for (let y = 1; y < height; y++) {
      const q = r();
      if (q < 0.55) continue;
      const id = q < 0.6 ? WATER : q < 0.62 ? LAVA : q < 0.64 ? FIRE : 1 + Math.floor(r() * (BLOCKS.length - 1));
      w.put(x, y, z, id, Math.floor(r() * 16), false);
    }
  }
  return w;
}
test("item physics: off, on and verify move every item the same (positions, motion, boxes, fire, health, sounds)", () => {
  const run = (mode) => withMode(mode, () => {
    const r = lcg(8686), w = soup(r), items = new ItemEntities(lcg(5));
    for (let n = 0; n < 160; n++) items.spawn({ id: 1 + (n % 4), count: 1, damage: 0 }, 1 + r() * 14, 1 + r() * 7, 1 + r() * 14, { motion: [(r() - 0.5) * 0.6, (r() - 0.5) * 0.8, (r() - 0.5) * 0.6] });
    for (let t = 0; t < 80; t++) {
      items.tick(w);
      if (t % 10 === 3) for (const e of items.items.slice(0, 8)) items.push(w, e, 0.25, 0, -0.25); // a piston-style outside move
    }
    return JSON.stringify([items.items.map((e) => [e.x, e.y, e.z, e.mx, e.my, e.mz, e.bxz, e.onGround, e.collidedH, e.fire, e.health, e.dead, e.inWeb, e.stack.count].map((v) => (Object.is(v, -0) ? "-0" : v))), items.sounds ?? null]);
  });
  const off = run("off");
  assert.equal(run("on"), off);
  assert.equal(run("verify"), off);
});

test("seeded server scenes hash the same off / on / verify", () => {
  const hash = (m) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", "--scene=pen", "--state", "--ticks=100", "--mobs=60"], { env: { ...process.env, MC_MPPERF86: m, ...(m === "verify" ? { MC_MPPERF85: m, MC_MPPERF84: m, MC_MPPERF83: m } : {}) }, encoding: "utf8" }).stdout.trim();
  const off = hash("off");
  assert.match(off, /mode86=off (mode87=\w+ )?(mode88=\w+ )?(mode89=\w+ )?(mode90=\w+ )?(mode91=\w+ )?(mode92=\w+ )?(mode93=\w+ )?(mode94=\w+ )?(mode95=\w+ )?mobs=\d+ \[/); // b87: the bench prints mode87 after mode86; b88: and mode88; b89: and mode89
  const tail = (s) => s.split("mobs=").pop();
  assert.equal(tail(hash("on")), tail(off));
  assert.equal(tail(hash("verify")), tail(off));
});
