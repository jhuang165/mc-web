// Dragon part sweep replay: which parts World.getEntitiesWithinAABBExcludingEntity lists for a query box (the dragon's own box and chunk gate them) and which part a
// real EntityArrow / EntitySnowball strikes first (tools/probes/DragonSweepProbe.java, public/research/dragon-sweep-reference.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dragonBox, reachesDragon, dragonPartTargets, isDragon } from "./dragon-parts.js";
import { mobTargets, Projectiles } from "./projectiles.js";
import { Arrows, arrowTargets } from "./bow.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/dragon-sweep-reference.json", import.meta.url)));
const lists = ref.records.filter((r) => r.case === "sweepList"), shots = ref.records.filter((r) => r.case === "sweepShot");
const dragonOf = (r) => ({ type: "ender_dragon", x: r.dragon[0], y: r.dragon[1], z: r.dragon[2], health: 200, dragon: { parts: r.boxes.map((box) => ({ box })) } });
const overlap = (a, b) => a[3] > b[0] && a[0] < b[3] && a[4] > b[1] && a[1] < b[4] && a[5] > b[2] && a[2] < b[5];

test("reference covers the unchanged classes", () => {
  assert.equal(ref.target, "Minecraft Java 1.7.10");
  assert.equal(lists.length, 5);
  assert.equal(shots.length, 7);
  assert.equal(lists.reduce((n, r) => n + r.queries.length, 0), 1250);
});

test("the dragon's own box is 16 x 8 at its feet (moveEntity derives the position from the box, so the last bit may differ)", () => {
  for (const r of lists) dragonBox(dragonOf(r)).forEach((v, i) => assert.ok(Math.abs(v - r.parent[i]) < 1e-9, `${r.scene} ${i}`));
});

test("a query lists the dragon (and then each part it meets, in part order) only for the dragon's box and chunk range", () => {
  let gated = 0, listed = 0;
  for (const r of lists) {
    const e = dragonOf(r);
    for (const q of r.queries) {
      const got = reachesDragon(e, q.box) ? e.dragon.parts.map((p, i) => (overlap(p.box, q.box) ? i : -1)).filter((i) => i >= 0) : [];
      assert.deepEqual(got, q.list.filter((i) => i < 7), JSON.stringify(q.box));
      assert.equal(reachesDragon(e, q.box), q.list.includes(7), "the dragon itself is listed under the same gate");
      if (overlap(dragonBox(e), q.box) && !reachesDragon(e, q.box)) gated++;
      if (q.list.length) listed++;
    }
  }
  assert.ok(gated > 0, "the chunk gate is exercised");
  assert.ok(listed > 100);
});

test("mobTargets carries the reach gate for every part", () => {
  const r = lists[0], e = dragonOf(r), t = mobTargets([e], null);
  assert.equal(t.length, 7);
  assert.ok(isDragon(e) && dragonPartTargets(e).length === 7);
  assert.deepEqual(t.map((x) => x.part), [0, 1, 2, 3, 4, 5, 6]);
  assert.ok(t.every((x) => typeof x.reach === "function"));
});

const air = { get: () => 0, getMeta: () => 0, solid: () => false, inside: () => true, height: 256 };
const rnd = { nextFloat: () => 0.5, nextInt: () => 0, nextDouble: () => 0.5, nextGaussian: () => 0, nextLong: () => 0 };

test("an arrow or snowball strikes the same part first, on the same tick, as the native entity", () => {
  let checked = 0, hits = 0, misses = 0;
  for (const r of shots) for (const s of r.shots) {
    const e = dragonOf(r), targets = mobTargets([e], null);
    e.dragon.lastPart = undefined;
    let hitTick = -1;
    if (r.kind === "arrow") {
      const arrows = new Arrows(() => 0.5), a = arrows.make({ x: s.start[0], y: s.start[1], z: s.start[2], mx: s.motion[0], my: s.motion[1], mz: s.motion[2], yaw: 1, pitch: 1 }, rnd, { shooter: null });
      const ctx = { targets: arrowTargets(targets, false), mobs: { entities: [e], damage: () => true } };
      for (let t = 1; t <= 4 && hitTick < 0; t++) {
        arrows.step(air, a, ctx);
        if (e.dragon.lastPart !== undefined) hitTick = t;
        else assert.ok(Math.hypot(a.x - s.path[t - 1][0], a.y - s.path[t - 1][1], a.z - s.path[t - 1][2]) < 1e-6, `arrow path ${r.scene} ${s.target}/${s.dir} tick ${t}`);
      }
    } else {
      const proj = new Projectiles(() => 0.5), b = { x: s.start[0], y: s.start[1], z: s.start[2], mx: s.motion[0], my: s.motion[1], mz: s.motion[2], yaw: 1, pitch: 1, px: 0, py: 0, pz: 0, prevYaw: 1, prevPitch: 1, kind: "snowball", ticks: 0, rand: rnd, random: rnd, dead: false, owner: "player" };
      for (let t = 1; t <= 4 && hitTick < 0; t++) {
        proj.step(air, b, targets, () => {});
        if (e.dragon.lastPart !== undefined) hitTick = t;
      }
    }
    assert.equal(hitTick, s.hitTick, `${r.kind} scene ${r.scene} target ${s.target} dir ${s.dir}`);
    assert.equal(hitTick < 0 ? -1 : e.dragon.lastPart, s.hit, `${r.kind} scene ${r.scene} target ${s.target} dir ${s.dir}`);
    checked++;
    if (hitTick > 0) hits++; else misses++;
  }
  assert.ok(checked > 500 && hits > 400 && misses > 0, `${checked} shots, ${hits} hits, ${misses} misses`);
});
