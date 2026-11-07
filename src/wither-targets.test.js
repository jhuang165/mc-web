// Replays public/research/wither-targets-reference.json (tools/probes/WitherRound3Probe.java): the unchanged EntityWither.bn() head loop on a
// world of real chunks (genuine World.getEntitiesWithinAABB, selector and line of sight), and the head particles of EntityWither.e().
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./entities.js"; // loads the engine before wither-boss-mobs.js (circular imports)
import { JavaRandom } from "./java-random.js";
import { headPass, witherPool } from "./wither-targeting.js";
import { nativeOrder, witherIsUndead } from "./wither-boss-mobs.js";
import { headPosition, headParticleSpecs, witherPose, partMatrix, witherScalePartial, WITHER_ARMOR_PASS, armorScroll, armored } from "./wither-boss.js";
import { WITHER_MODEL } from "./wither-boss-renderer.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/wither-targets-reference.json", import.meta.url), "utf8"));
const logged = (seed) => {
  const r = new JavaRandom(seed), log = [];
  return { log, nextInt: (n) => { const v = r.nextInt(n); log.push(`i${n}:${v}`); return v; }, nextDouble: () => { const v = r.nextDouble(); log.push(`d:${v}`); return v; },
    nextFloat: () => { const v = r.nextFloat(); log.push(`f:${v}`); return v; }, nextGaussian: () => { const v = r.nextGaussian(); log.push(`g:${v}`); return v; } };
};
// Java prints floats and doubles in their own shortest form and StrictMath.log may differ from Math.log in the last digit of a gaussian:
// the kind and the integers must match exactly, floats as floats, gaussians to 1e-12.
const sameDraws = (got, want, label) => {
  assert.equal(got.length, want.length, `${label}: draw count ${got.length} vs ${want.length}`);
  got.forEach((d, i) => {
    const [k, v] = d.split(":"), [k2, v2] = want[i].split(":");
    assert.equal(k, k2, `${label}: draw ${i} kind`);
    if (k === "g") assert.ok(Math.abs(+v - +v2) <= 1e-12 * Math.max(1, Math.abs(+v2)), `${label}: gaussian ${i} ${v} vs ${v2}`);
    else if (k === "f") assert.equal(Math.fround(+v), Math.fround(+v2), `${label}: float ${i}`);
    else assert.equal(+v, +v2, `${label}: draw ${i}`);
  });
};
const intersects = (a, b) => b[3] > a[0] && b[0] < a[3] && b[4] > a[1] && b[1] < a[4] && b[5] > a[2] && b[2] < a[5];
const expand = (b, x, y, z) => [b[0] - x, b[1] - y, b[2] - z, b[3] + x, b[4] + y, b[5] + z];

for (const sc of ref.records.filter((r) => r.case === "targets")) {
  test(`wither head targeting replays the native bn() loop: ${sc.name}`, () => {
    const rand = logged(sc.seed), s = { bt: [0, 0], bu: [0, 0], heads: [null, null, null] };
    const cands = sc.candidates.map((c, i) => ({ ...c, i, alive: true, player: c.type === "player" || c.type === "creative", creative: c.type === "creative" }));
    const w = sc.wither, wbox = expand(w.box, 20, 8, 20), shots = [];
    const undeadTypes = { zombie: true };
    const io = {
      pos: w, difficulty: sc.difficulty,
      pool: () => witherPool(cands, { overlaps: (c) => intersects(wbox, c.box), undead: (c) => !!undeadTypes[c.type] || witherIsUndead({ type: c.type }), order: (l) => nativeOrder(l, (c) => c) }),
      alive: (c) => c.alive, near: (c) => (c.x - w.x) ** 2 + (c.y - w.y) ** 2 + (c.z - w.z) ** 2 <= 900,
      sees: (c) => sc.wall === null || (w.x - sc.wall) * (c.x - sc.wall) > 0, isPlayer: (c) => c.player, creative: (c) => c.creative, self: () => false,
      launchCoords: (h) => shots.push(headPosition({ x: w.x, y: w.y, z: w.z }, h, 0)), launchEntity: (h) => shots.push(headPosition({ x: w.x, y: w.y, z: w.z }, h, 0)),
    };
    const kills = new Map(sc.kills);
    for (const t of sc.ticks) {
      for (const [idx, tick] of kills) if (tick === t.tick) cands[idx].alive = false;
      shots.length = 0; rand.log.length = 0;
      headPass(s, rand, t.tick, io);
      assert.deepEqual(rand.log, t.draws, `${sc.name} tick ${t.tick}: Random draws`);
      assert.deepEqual(s.heads.slice(1).map((c) => (c ? String(c.i) : "-")), t.heads, `${sc.name} tick ${t.tick}: heads`);
      assert.deepEqual(s.bt, t.bt); assert.deepEqual(s.bu, t.bu);
      assert.equal(shots.length, t.skulls.length, `${sc.name} tick ${t.tick}: shots`);
      shots.forEach((p, k) => { assert.ok(Math.abs(p.x - t.skulls[k][0]) < 1e-5 && Math.abs(p.y - t.skulls[k][1]) < 1e-5 && Math.abs(p.z - t.skulls[k][2]) < 1e-5, `${sc.name} tick ${t.tick}: skull position`); });
    }
  });
}

for (const sc of ref.records.filter((r) => r.case === "particles")) {
  test(`wither head particles and their Random draws replay the native onLivingUpdate tail: ${sc.name}`, () => {
    const z = logged(sc.zseed), w = logged(sc.wseed);
    for (const t of sc.ticks) {
      z.log.length = 0; w.log.length = 0;
      const out = headParticleSpecs({ x: t.x, y: t.y, z: t.z, renderYawOffset: t.bodyYaw, invul: t.invul, health: t.health }, z, w);
      sameDraws(z.log, t.zDraws, `${sc.name} tick ${t.tick}: entity Random`);
      sameDraws(w.log, t.wDraws, `${sc.name} tick ${t.tick}: world Random`);
      assert.equal(out.length, t.particles.length, `${sc.name} tick ${t.tick}: particle count`);
      out.forEach((p, k) => {
        const n = t.particles[k];
        assert.equal(p[0], n[0]);
        for (let a = 1; a < 7; a++) assert.ok(Math.abs(p[a] - n[a]) < 1e-9, `${sc.name} tick ${t.tick} particle ${k} arg ${a}: ${p[a]} vs ${n[a]}`);
      });
    }
  });
}

const model = JSON.parse(readFileSync(new URL("../public/research/wither-model-reference.json", import.meta.url), "utf8"));
test("ModelWither boxes, rotation points and texture offsets match the native ModelBox/ModelRenderer", () => {
  const boxes = Object.fromEntries(model.records.filter((r) => r.case === "boxes").map((r) => [r.name, r]));
  assert.deepEqual(Object.keys(boxes), ["shoulders", "spine", "tail", "head0", "head1", "head2"]);
  assert.deepEqual(WITHER_MODEL.map((p) => p.name), Object.keys(boxes));
  for (const p of WITHER_MODEL) assert.deepEqual(p.boxes, boxes[p.name].boxes.map((b) => b.slice(0, 8)), `${p.name} boxes`);
});
test("ModelWither pose (setRotationAngles + setLivingAnimations) and per-part matrices replay the native render", () => {
  const poses = model.records.filter((r) => r.case === "pose");
  assert.ok(poses.length >= 6);
  for (const r of poses) {
    const a = witherPose({ age: r.age, headYaw: r.netYaw, headPitch: r.netPitch, bodyYaw: r.bodyYaw, sideYaw: r.headYaw, sidePitch: r.headPitch });
    ["shoulders", "spine", "tail", "head0", "head1", "head2"].forEach((name, i) => {
      const [px, py, pz, rx, ry, rz] = r.parts[i];
      [...a[name].point, ...a[name].rot].forEach((v, k) => assert.ok(Math.abs(v - [px, py, pz, rx, ry, rz][k]) < 2e-6, `${r.name} ${r.partial} ${name} component ${k}: ${v} vs ${[px, py, pz, rx, ry, rz][k]}`));
    });
    for (const [name, mat] of r.calls) {
      const m = partMatrix(a[name]);
      mat.forEach((v, k) => assert.ok(Math.abs(v - m[k]) < 2e-5, `${r.name} ${r.partial} ${name} matrix ${k}: ${m[k]} vs ${v}`));
    }
  }
});
test("RenderWither: scale uses the partial tick, the armour pass runs whenever health <= 150 (also during the spawn), scroll and pass numbers", () => {
  assert.equal(witherScalePartial(0, 0.5), 2);
  assert.equal(witherScalePartial(220, 0), Math.fround(2 - 0.5));
  assert.ok(Math.abs(witherScalePartial(110, 0.5) - (2 - ((110 - 0.5) / 220) * 0.5)) < 1e-6);
  assert.deepEqual(WITHER_ARMOR_PASS, { color: 0.5, translateY: -0.01, scale: Math.fround(1.1) });
  assert.equal(armored(100), true);
  const [sx, sy] = armorScroll(100.5);
  assert.ok(Math.abs(sx - Math.cos(100.5 * 0.02) * 3) < 1e-3 && Math.abs(sy - 1.005) < 1e-6);
});
