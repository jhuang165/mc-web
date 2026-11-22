// Batch 87 mpperf87: MC_MPPERF87 off / on / verify give the same mob, item and tracker results with fewer allocations per server tick.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fast87, attackEquipment87, sameNum, sameBxz, EntryStamps, shareDone, dryEntity, dryBounds, addZero, mobTargetAt } from "./mpperf87-fast.js";
import { fast81, dryBox } from "./mpperf81-fast.js";
import { packetSeq } from "./entity-tracker.js";
import { SharedEntry } from "./multiplayer/server-mob-entries.js";
import { mobTargets } from "./projectiles.js";
import { ItemEntities } from "./item-entities.js";
import { World, BLOCKS, WATER, LAVA, FIRE } from "./world.js";
import { lcg } from "./mpperf77-scene.js";

const withMode = (mode, fn) => { const was = fast87.mode; fast87.mode = mode; try { return fn(); } finally { fast87.mode = was; } };
const idCopy = (s) => (s ? { id: s.id } : null);

test("attackEquipment87: the same ids as the map, the last array kept while the slots hold the same ids", () => {
  const r = lcg(87);
  for (const mode of ["on", "verify"]) withMode(mode, () => {
    let prev;
    for (let round = 0; round < 300; round++) {
      const eq = Array.from({ length: 5 }, () => (r() < 0.4 ? null : { id: 256 + Math.floor(r() * 3), count: 1 }));
      const got = attackEquipment87(prev, eq);
      assert.deepEqual(got, eq.map(idCopy));
      assert.equal(attackEquipment87(got, eq.map((s) => (s ? { ...s, count: 2 } : null))), got); // only the ids decide
      prev = got;
    }
    const foreign = [{ id: 1 }, null];
    assert.notEqual(attackEquipment87(foreign, [{ id: 1 }, null]), foreign); // an array not made here is never handed back
  });
  withMode("off", () => { const eq = [{ id: 3 }], a = attackEquipment87(undefined, eq); assert.notEqual(attackEquipment87(a, eq), a); });
});

test("sameNum is Object.is for numbers; sameBxz compares the four stored numbers", () => {
  const vals = [0, -0, 1, -1, 0.1, NaN, Infinity, -Infinity, 1e-300, Number.MIN_VALUE];
  for (const a of vals) for (const b of vals) assert.equal(sameNum(a, b), Object.is(a, b), `${a} ${b}`);
  assert.equal(sameBxz([1, 2, 3, 4], 1, 2, 3, 4), true);
  assert.equal(sameBxz([1, 2, 3, -0], 1, 2, 3, 0), false);
  assert.equal(sameBxz(undefined, 1, 2, 3, 4), false);
  assert.equal(sameBxz([1, 2, 3], 1, 2, 3, undefined), false);
});

test("EntryStamps: newest stamp per packet, emptied with the packet list, compacted when it grows past it", () => {
  const s = new EntryStamps(), packets = [], a = { type: "move" }, b = { type: "move" }, d1 = ["w1"], d2 = ["w2"];
  packets.push(a); s.put(packets, a, 5, d1);
  packets.push(b); s.put(packets, b, 6, d2);
  assert.deepEqual([s.seqOf(a), s.seqOf(b), s.destOf(a), s.destOf(b)], [5, 6, d1, d2]);
  packets.push(a); s.put(packets, a, 9, d2); // the same object again: the last stamp wins, as WeakMap.set did
  assert.deepEqual([s.seqOf(a), s.destOf(a)], [9, d2]);
  assert.deepEqual([s.seqOf({}), s.destOf({})], [0, undefined]);
  packets.length = 0; const c = { type: "look" };
  packets.push(c); s.put(packets, c, 10, d1); // the list was emptied: the old stamps go
  assert.equal(s.n, 1);
  assert.equal(s.seqOf(a), 0);
  const big = new EntryStamps(), keep = [{ k: "keep" }];
  big.put(keep, keep[0], 1, d1);
  for (let k = 0; k < 100; k++) { const p = { k }; big.put([keep[0], p], p, 2 + k, d1); } // a list that never empties (stamps of gone packets pile up)
  assert.ok(big.n <= 4 * 2 + 33);
  assert.equal(big.seqOf(keep[0]), 1);
});

test("SharedEntry: stamps and destinations beside the packets give the WeakMap answers (verify writes both)", () => {
  for (const mode of ["on", "verify", "off"]) withMode(mode, () => {
    const e = { type: "pig", x: 1, y: 2, z: 3, rotationYaw: 0, rotationPitch: 0, health: 10 }, owner = { watchers: new Map() };
    const en = new SharedEntry(e, { range: 80 }, { log: null }, owner), w1 = { id: 1 }, w2 = { id: 2 };
    en.set.add(w1); en.set.add(w2);
    const p1 = { type: "move" }, p2 = { type: "look" };
    en.emit(p1);
    en.cur = w1; en.emit(p2); en.cur = null;
    assert.deepEqual(en.packets, [p1, p2]);
    assert.ok(en.seqOf(p1) > 0 && en.seqOf(p2) === en.seqOf(p1) + 1);
    assert.deepEqual(en.destOf(p1), [w1, w2]);
    assert.deepEqual(en.destOf(p2), [w1]);
    if (mode === "on") { assert.equal(packetSeq(p1), 0); assert.equal(en.dest.get(p1), undefined); } // no WeakMap writes
    else { assert.equal(packetSeq(p1), en.seqOf(p1)); assert.equal(en.dest.get(p2), en.destOf(p2)); }
    en.packets.length = 0;
    const p3 = { type: "move" }; en.emit(p3);
    assert.ok(en.seqOf(p3) > en.seqOf(p2) || mode === "off");
    assert.deepEqual(en.destOf(p3), [w1, w2]);
  });
});

test("shareDone freezes the shared packet copy only in verify", () => {
  withMode("verify", () => assert.ok(Object.isFrozen(shareDone({ type: "move", i: 1 }))));
  withMode("on", () => assert.ok(!Object.isFrozen(shareDone({ type: "move", i: 1 }))));
});

// A real World with stairs, fences, slabs, webs, soul sand, cactus, water, lava, fire and every other id over a stone floor.
function soup(r, span = 16, height = 5) {
  const w = new World("mpperf87-test");
  for (let x = 0; x < span; x++) for (let z = 0; z < span; z++) {
    w.put(x, 0, z, 1, 0, false);
    for (let y = 1; y < height; y++) {
      const q = r();
      if (q < 0.55) continue;
      const id = q < 0.62 ? WATER : q < 0.64 ? LAVA : q < 0.66 ? FIRE : 1 + Math.floor(r() * (BLOCKS.length - 1));
      w.put(x, y, z, id, Math.floor(r() * 16), false);
    }
  }
  return w;
}

test("dryEntity / dryBounds give mpperf81 dryBox's answer for the same box", () => {
  const was = fast81.mode; fast81.mode = "on";
  try {
    const r = lcg(8787), w = soup(r);
    for (let k = 0; k < 3000; k++) {
      const e = { x: r() * 16, y: r() * 5, z: r() * 16 }, wd = [0.3, 0.6, 0.9, 1.4, 0.25][k % 5], h = [0.7, 1.8, 0.9, 2.9, 0.25][k % 5];
      const ref = dryBox(w, e.x - wd / 2, e.y, e.z - wd / 2, e.x + wd / 2, e.y + h, e.z + wd / 2);
      assert.equal(dryEntity(w, e, wd, h, WATER), ref);
      assert.equal(dryBounds(w, [e.x - wd / 2, e.y, e.z - wd / 2, e.x + wd / 2, e.y + h, e.z + wd / 2], WATER), ref);
    }
  } finally { fast81.mode = was; }
});

test("addZero leaves the record as `+= 0` would", () => {
  const vals = [0, -0, 0.5, -3, NaN, Infinity, undefined, "1", null];
  for (const vx of vals) for (const vy of [0, -0, 2]) {
    const a = { vx, vy, vz: -0 }, b = { vx, vy, vz: -0 };
    addZero(a); b.vx += 0; b.vy += 0; b.vz += 0;
    assert.ok(Object.is(a.vx, b.vx) && Object.is(a.vy, b.vy) && Object.is(a.vz, b.vz), `${String(vx)} ${vy}`);
  }
});

test("mobTargets: the same targets off / on / verify; a record is kept while its mob stays and nobody marks it", () => {
  const r = lcg(870), types = ["pig", "cow", "zombie", "slime", "chicken"];
  const mobs = Array.from({ length: 40 }, (_, k) => ({ type: types[k % types.length], x: r() * 20, y: r() * 3, z: r() * 20, growingAge: k % 7 === 0 ? -100 : 0, size: 2, health: 10 }));
  const flat = (l) => l.map((t) => [t.ref, ...t.box, t.thrower ?? null]);
  const ref = withMode("off", () => flat(mobTargets(mobs, null)));
  for (const mode of ["on", "verify"]) withMode(mode, () => {
    const list = mobs.slice(), a = mobTargets(list, null);
    assert.deepEqual(flat(a), ref);
    const b = mobTargets(list, null);
    assert.ok(a.every((t, k) => t === b[k])); // nothing moved: the same records
    b[3].thrower = true; // a caller marks one (server-dispense.js targets)
    list[5].x += 0.25; // one moves
    const c = mobTargets(list, null);
    assert.notEqual(c[3], b[3]); assert.equal(c[3].thrower, undefined);
    assert.notEqual(c[5], b[5]); assert.equal(c[5].box[0], b[5].box[0] + 0.25);
    assert.equal(c[7], b[7]);
    list[5].x -= 0.25;
  });
  withMode("on", () => { const st = []; assert.equal(mobTargetAt(st, 0, mobs[0], { width: 0.9, height: 0.9 }, false), st[0].rec87); });
});

test("item physics: off, on and verify move and merge every item the same (positions, motion, boxes, fire, health, sounds)", () => {
  const run = (mode) => withMode(mode, () => {
    const r = lcg(8787), w = soup(r), items = new ItemEntities(lcg(7));
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

test("seeded server scenes hash the same off / on / verify (MC_MPPERF83..87 all verify)", () => {
  const verifyAll = { MC_MPPERF83: "verify", MC_MPPERF84: "verify", MC_MPPERF85: "verify", MC_MPPERF86: "verify" };
  for (const scene of ["pen", "terrain"]) {
    const hash = (m) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", `--scene=${scene}`, "--state", "--ticks=100", "--mobs=60"], { env: { ...process.env, MC_MPPERF87: m, ...(m === "verify" ? verifyAll : {}) }, encoding: "utf8" }).stdout.trim();
    const off = hash("off");
    assert.match(off, /mode87=off (mode88=\w+ )?(mode89=\w+ )?(mode90=\w+ )?(mode91=\w+ )?(mode92=\w+ )?(mode93=\w+ )?(mode94=\w+ )?(mode95=\w+ )?(mode96=\w+ )?mobs=\d+ \[/); // b88: the bench prints mode88 after mode87; b89: and mode89
    const tail = (s) => s.split("mobs=").pop();
    assert.equal(tail(hash("on")), tail(off));
    assert.equal(tail(hash("verify")), tail(off));
  }
});
