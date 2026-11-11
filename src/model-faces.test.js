import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.document ??= { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
const { skinBox } = await import("./first-person.js");

// Executed ModelBox quads (tools/probes/ModelFacesProbe.java, verify-model-faces.mjs): vertices in model pixels with y down.
const reference = JSON.parse(readFileSync(new URL("../public/research/model-faces-reference.json", import.meta.url)));
const FACES = ["+x", "-x", "top", "bottom", "front(z1)", "back(z2)"];
const key = (p) => p.map((n) => Math.round(n * 1000) / 1000).join(",");
// Every mob model draws ModelBox meshes at (x, -y, -z): the box centre keeps x and flips y and z, so a model-space vertex
// (px, py, pz) is at (px - cx, cy - py, cz - pz) in skinBox's centred geometry.
function portFaces(record) {
  const [w, h, d] = record.size, [tw, th] = record.texture, [u, v] = record.uv;
  const g = skinBox(w, h, d, u, v, tw, th, record.mirror), pos = g.attributes.position, uv = g.attributes.uv;
  const faces = [];
  for (let f = 0; f < 6; f++) {
    const m = new Map();
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      m.set(key([pos.getX(i) * 16, pos.getY(i) * 16, pos.getZ(i) * 16]), [uv.getX(i) * tw, (1 - uv.getY(i)) * th]);
    }
    faces.push(m);
  }
  return faces;
}
function nativeFaces(record) {
  const [x, y, z] = record.from, [w, h, d] = record.size, c = [x + w / 2, y + h / 2, z + d / 2];
  return record.quads.map((q) => new Map(q.map(([px, py, pz, uu, vv]) => [key([px - c[0], c[1] - py, c[2] - pz]), [uu, vv]])));
}
// The six faces are matched by the vertex set (the corner positions on one side), not by index order.
test("skinBox faces carry the executed ModelBox uvs", () => {
  const bad = [];
  for (const record of reference.records.filter((r) => r.grow === 0)) {
    const port = portFaces(record), native = nativeFaces(record), seen = new Set();
    for (const [n, nf] of native.entries()) {
      const idx = port.findIndex((pf, j) => !seen.has(j) && [...nf.keys()].every((k) => pf.has(k)));
      assert.ok(idx >= 0, `${record.name} ${FACES[n]}: no port face with the same corners`);
      seen.add(idx);
      for (const [k, want] of nf) {
        const got = port[idx].get(k);
        if (!(Math.abs(got[0] - want[0]) < 1e-3 && Math.abs(got[1] - want[1]) < 1e-3)) bad.push(`${record.name} ${FACES[n]} corner ${k}: port uv ${got} native ${want}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});
