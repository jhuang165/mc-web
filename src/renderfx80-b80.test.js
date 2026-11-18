// Batch 80 renderfx80: the end portal (bmt), the big and small stem planes (blm func_147740_a / func_147795_a), RenderWitherSkull (bpd) and the
// brewing stand bounds, against the unchanged 1.7.10 classes run headlessly (tools/probes/RenderFx80Probe.java via tools/verify-renderfx80.mjs ->
// public/research/renderfx80-reference.json).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { END_PORTAL_LAYERS, endPortalUv, endPortalScroll, endPortalQuad } from "./end-portal-renderer.js";
import { stemSmall, stemBig } from "./render-vessels.js";
import { stemQuads, stemBounds } from "./stems-cake.js";
import { skullGeometry, skullMatrix } from "./projectile-renderer.js";
import { fireballTurn, interpolateRotation, lerpPitch } from "./fireball-turn.js";
import { BREWING_BOXES, BREWING_SELECTION_AFTER_PASS } from "./brewing.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/renderfx80-reference.json", import.meta.url), "utf8"));
const cases = (c) => ref.records.filter((r) => r.case === c);
const f = Math.fround;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const rgb = (c) => [c & 255, (c >> 8) & 255, (c >> 16) & 255];
// Column-major 4x4 helpers.
const mulVec = (m, v) => [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
const invert = (m) => new THREE.Matrix4().fromArray(m).invert().toArray();
const rowTimes = (p, m) => [0, 1, 2, 3].map((c) => p[0] * m[c * 4] + p[1] * m[c * 4 + 1] + p[2] * m[c * 4 + 2] + p[3] * m[c * 4 + 3]);

test("the reference covers every case", () => {
  assert.deepEqual(ref.counts, { stemBig: 128, stemSmall: 32, portal: 5, skull: 6, skullLists: 1, icons: 1 });
});

test("end portal: 16 passes, textures, blending and colour bytes as bmt draws them", () => {
  for (const r of cases("portal")) {
    const draws = r.log.filter((e) => e[0] === "draw"), binds = r.log.filter((e) => e[0] === "bind").map((e) => e[1]), blends = r.log.filter((e) => e[0] === "blend").map((e) => e.slice(1));
    assert.equal(draws.length, 16);
    assert.deepEqual(binds, ["textures/environment/end_sky.png", "textures/entity/end_portal.png"]); // pass 1 binds once; later passes keep it
    assert.deepEqual(blends, [[770, 771], [1, 1]]); // pass 1 switches to additive once; later passes keep it
    assert.ok(r.log.some((e) => e[0] === "disable" && e[1] === 2896)); // lighting off
    draws.forEach((d, i) => {
      const L = END_PORTAL_LAYERS[i], verts = d[3];
      assert.equal(L.texture, i === 0 ? "sky" : "portal");
      assert.deepEqual(verts.map((v) => rgb(v[5])), Array(4).fill(L.colour), `layer ${i} colour`);
      assert.deepEqual(verts.map((v) => v.slice(0, 3)), endPortalQuad(...r.rel).map((p) => p.map(f)), `layer ${i} quad`);
    });
  }
  assert.deepEqual(END_PORTAL_LAYERS[0].colour, [25, 25, 25]);
  assert.deepEqual(END_PORTAL_LAYERS.map((L) => L.depth), [65, ...Array.from({ length: 15 }, (_, i) => 15 - i)]);
});

test("end portal: the closed-form texture coordinates equal the GL texgen and texture matrix", () => {
  const worst = {};
  for (const r of cases("portal")) {
    const planes = {}, draws = [];
    for (const e of r.log) {
      if (e[0] === "texGen") planes[e[1]] = { plane: e[3], mv: e[4], eye: e[2] === 9474 };
      if (e[0] === "draw") draws.push({ tex: e[1], mv: e[2], verts: e[3], planes: { ...planes } });
    }
    const eye = r.cam.map((c, k) => c + r.object[k]), scroll = endPortalScroll(r.time);
    draws.forEach((d, i) => {
      const p0 = d.verts[0], p2 = d.verts[2];
      const samples = [...d.verts.map((v) => v.slice(0, 3)), [0.5, 0.5], [0.13, 0.91], [0.77, 0.21]].map((s) => (s.length === 3 ? s : [p0[0] + (p2[0] - p0[0]) * s[0], p0[1], p0[2] + (p2[2] - p0[2]) * s[1]]));
      for (const v of samples) {
        // OpenGL: object-linear coordinates from the vertex, eye-linear q from the plane transformed by the inverse modelview at glTexGen.
        const obj = [v[0], v[1], v[2], 1], eyeV = mulVec(d.mv, obj);
        const coord = [8192, 8193, 8194, 8195].map((c) => {
          const g = d.planes[c];
          const plane = g.eye ? rowTimes(g.plane, invert(g.mv)) : g.plane;
          return (g.eye ? eyeV : obj).reduce((a, x, k) => a + x * plane[k], 0);
        });
        const t = mulVec(d.tex, coord), gl = [t[0] / t[3], t[1] / t[3]];
        const port = endPortalUv(i, eye, v.map((c, k) => c + r.cam[k]), scroll);
        // The replay runs on the logged float matrices: q is a small difference of terms as large as the camera coordinates (the eye plane
        // goes through the modelview translated to the camera's world position), so float rounding there, relative 6e-8 of those terms,
        // grows by 1 / |q| in s / q and t / q. The bound below is that rounding; the closed form is the same algebra without it.
        const big = Math.max(...d.planes[8195].mv.slice(12, 15).map(Math.abs), ...d.mv.slice(12, 15).map(Math.abs), 1), q = Math.abs(t[3]);
        const tol = 1e-5 + 4 * 6e-8 * (big / q) * (Math.abs(gl[0]) + Math.abs(gl[1]) + 1) + 1e-6 * (Math.abs(gl[0]) + Math.abs(gl[1]));
        close(port[0], gl[0], tol, `portal t=${r.time} layer ${i} s`);
        close(port[1], gl[1], tol, `portal t=${r.time} layer ${i} t`);
        worst[r.time] = Math.max(worst[r.time] ?? 0, Math.abs(port[0] - gl[0]), Math.abs(port[1] - gl[1]));
      }
    });
  }
  assert.ok(worst[1234567] < 1e-4 && worst[0] < 1e-3); // the cameras near the origin: float noise only
});

test("end portal: the scroll clock and the per-layer rotation", () => {
  for (const r of cases("portal")) {
    const tex = r.log.find((e) => e[0] === "draw")[1];
    // Pass 0 has no rotation (0 degrees): the texture matrix is the scale with translations, so its t row's constant term carries the scroll.
    assert.equal(tex[0], END_PORTAL_LAYERS[0].scale);
    assert.equal(endPortalScroll(r.time), f(f(r.time % 700000) / f(700000)));
  }
  assert.equal(END_PORTAL_LAYERS[1].rotation, (4321 + 9) * 2);
  assert.equal(END_PORTAL_LAYERS[15].rotation, (225 * 4321 + 135) * 2);
});

const iconOf = (u) => Math.floor(u / 2), names = cases("icons")[0].names;
const nativeIcon = (verts) => names[Math.floor(Math.min(...verts.map((v) => v[3])) / 2)];
const portQuads = (quads) => quads.flatMap((q) => q.verts.map((p, k) => ({ xyz: p.map(f), uv: q.uv[k].map(f) })));
const fr = (v) => v.map(f); // the reference prints Java floats by Float.toString (shortest digits), so read them back as floats

test("stems: render-vessels stemBig / stemSmall equal func_147740_a / func_147795_a vertex for vertex", () => {
  for (const r of cases("stemBig")) {
    const icon = nativeIcon(r.verts), port = portQuads(stemBig(r.x, r.y, r.z, r.h, r.dir, icon));
    assert.equal(icon.endsWith("_connected"), true);
    assert.deepEqual(port.map((v) => v.xyz), r.verts.map((v) => fr(v.slice(0, 3))), `big ${r.id} dir ${r.dir} h ${r.h} at ${r.x}`);
    assert.deepEqual(port.map((v) => v.uv), r.verts.map((v) => fr([v[3] - 2 * names.indexOf(icon), v[4]])), `big uv ${r.dir}`);
  }
  for (const r of cases("stemSmall")) {
    const icon = nativeIcon(r.verts), port = portQuads(stemSmall(r.x, r.y, r.z, r.h, icon));
    assert.equal(icon.endsWith("_disconnected"), true);
    assert.deepEqual(port.map((v) => v.xyz), r.verts.map((v) => fr(v.slice(0, 3))), `small ${r.id} h ${r.h} at ${r.x}`);
    assert.deepEqual(port.map((v) => v.uv), r.verts.map((v) => fr([v[3] - 2 * names.indexOf(icon), v[4]])), `small uv ${r.h}`);
  }
});

test("stems: stems-cake stemQuads is renderBlockStem's quad list in block-local coordinates", () => {
  const at = (x, y, z) => cases("stemSmall").concat(cases("stemBig")).filter((r) => r.id === 104 && r.x === x && r.z === z && r.y === f(y - 0.0625));
  const cell = at(8, 8, 8), meta = { 0.125: 0, 0.5: 3, 0.875: 6, 1: 7 };
  const local = (r) => r.verts.map((v) => [v[0] - 8, v[1] - 8, v[2] - 8, v[3] - 2 * Math.floor(Math.min(...r.verts.map((w) => w[3])) / 2), v[4]]);
  const flat = (qs) => qs.flatMap((q) => q.verts.map((p, k) => [...p, ...q.uvs[k]]));
  const same = (a, b, msg) => { assert.equal(a.length, b.length, msg); a.forEach((v, i) => v.forEach((c, k) => close(c, b[i][k], 1e-6, `${msg} vertex ${i}`))); };
  for (const [h, m] of Object.entries(meta)) {
    assert.equal(stemBounds(m)[4], f(Number(h)));
    same(flat(stemQuads(m, -1)), local(cell.find((r) => r.case === "stemSmall" && r.h === Number(h))), `disconnected meta ${m}`);
  }
  for (let dir = 0; dir < 4; dir++) {
    const small = local(cell.find((r) => r.case === "stemSmall" && r.h === 0.5)), big = local(cell.find((r) => r.case === "stemBig" && r.h === 1 && r.dir === dir));
    const qs = stemQuads(7, dir);
    assert.deepEqual(qs.map((q) => q.tile), [...Array(4).fill("disconnected"), "connected", "connected"]);
    same(flat(qs), [...small, ...big], `connected dir ${dir}`);
  }
});

test("wither skull: the model box, texture offset (0, 35) on 64 x 64 and the modelview, as drawn", () => {
  const list = cases("skullLists")[0].lists["1"], g = skullGeometry(), pos = g.attributes.position, uv = g.attributes.uv;
  assert.equal(list.length, 24);
  for (const r of cases("skull")) {
    const bind = r.log.find((e) => e[0] === "bind")[1], call = r.log.find((e) => e[0] === "callList");
    assert.equal(bind, r.blue ? "textures/entity/wither/wither_invulnerable.png" : "textures/entity/wither/wither.png");
    assert.ok(r.log.some((e) => e[0] === "disable" && e[1] === 2884)); // culling off: DoubleSide
    const yaw = interpolateRotation(r.prevYaw, r.yaw, r.partial), pitch = lerpPitch(r.prevPitch, r.pitch, r.partial), m = skullMatrix(...r.pos, yaw, pitch).elements;
    // skinBox geometry is in the mob frame (x, -y, -z) = diag(1, -1, -1) of the model axes the display list is in: columns 1 and 2 flip.
    m.forEach((c, k) => close(c, (k >= 4 && k < 12 ? -1 : 1) * call[2][k], 2e-6, `skull matrix ${k} (${r.prevYaw} -> ${r.yaw})`));
    // Each native quad (4 list vertices through the callList modelview) is one skinBox face: same corners, same texel corner at each.
    const port = [];
    for (let i = 0; i < pos.count; i++) port.push({ p: mulVec(m, [pos.getX(i), pos.getY(i), pos.getZ(i), 1]), uv: [uv.getX(i), 1 - uv.getY(i)] });
    for (let q = 0; q < 6; q++) {
      const quad = list.slice(q * 4, q * 4 + 4).map((v) => ({ p: mulVec(call[2], [v[0], v[1], v[2], 1]), uv: [v[3], v[4]] }));
      const face = [0, 1, 2, 3, 4, 5].map((k) => port.slice(k * 4, k * 4 + 4)).find((fc) => quad.every((v) => fc.some((w) => v.p.every((c, k) => Math.abs(c - w.p[k]) < 1e-5))));
      assert.ok(face, `skull quad ${q} has a face`);
      for (const v of quad) {
        const w = face.find((w) => v.p.every((c, k) => Math.abs(c - w.p[k]) < 1e-5));
        close(w.uv[0], v.uv[0], 1e-6, `skull quad ${q} u`);
        close(w.uv[1], v.uv[1], 1e-6, `skull quad ${q} v`);
      }
    }
  }
});

test("wither skull: EntityFireball's turn toward its motion (float arithmetic)", () => {
  const e = { yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0 };
  fireballTurn(e, 0, 0, 1); // +z: target yaw 180, exactly 180 away, so the previous yaw moves to 360 first and the turn goes down to 324
  assert.equal(e.prevYaw, 360);
  assert.equal(e.yaw, 324);
  assert.equal(e.pitch, 0);
  const g = { yaw: 170, pitch: 0, prevYaw: 170, prevPitch: 0 };
  fireballTurn(g, 0.1, 0, -0.1); // target 45 + 90 ... wraps the previous value when more than 180 away
  assert.equal(g.yaw, f(170 + f(f(f(f((Math.atan2(-0.1, 0.1) * 180) / 3.1415927410125732) + 90) - 170) * f(0.2))));
  const d = { yaw: -170, pitch: 0, prevYaw: -170, prevPitch: 0 }, a = (170 * Math.PI) / 180;
  fireballTurn(d, Math.cos(a), 0, Math.sin(a)); // target about 260: the previous yaw moves up by 360 to 190 first
  assert.equal(d.prevYaw, 190);
  close(d.yaw, 204, 1e-4, "wrapped yaw");
  const still = { yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0 };
  fireballTurn(still, 0, 0, 0); // atan2(0, 0) = 0: yaw 90, pitch -90 targets
  assert.deepEqual([still.yaw, still.pitch], [18, -18]);
  assert.equal(interpolateRotation(350, 10, 0.5), 360);
  assert.equal(interpolateRotation(10, 350, 0.5), 0);
});

test("brewing stand: bounds as BlockBrewingStand sets them (pole, then setBlockBoundsForItemRender)", () => {
  assert.deepEqual(BREWING_SELECTION_AFTER_PASS, [0, 0, 0, 1, 0.125, 1]);
  assert.deepEqual(BREWING_BOXES.map((b) => [...b]).sort((a, b) => a[4] - b[4]), [[0, 0, 0, 1, 0.125, 1], [0.4375, 0, 0.4375, 0.5625, 0.875, 0.5625]]);
});
