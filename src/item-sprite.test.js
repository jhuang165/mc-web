// The held and dropped flat items against the unchanged 1.7.10 classes (tools/probes/ItemSpriteProbe.java, DroppedSpriteProbe.java; public/research/item-sprite-reference.json):
// ItemRenderer.renderItemIn2D vertex for vertex, and RenderItem's sprite path (copy counts, z stacking, the fast graphics scatter).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spriteGeometry } from "./sprite-geometry.js";
import { blockCopyCount, spriteCopyCount, fancySpriteZ, fancySpriteStart, flatSpriteOffsets } from "./drop-sprite.js";
import { JavaRandom } from "./lighting.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/item-sprite-reference.json", import.meta.url), "utf8"));
const bf = new Float32Array(1), bi = new Int32Array(bf.buffer), fl = (b) => { bi[0] = b; return bf[0]; };
const quadsOf = (events) => events.filter((e) => e[0] === "D").flatMap((e) => { const out = []; for (let k = 0; k < e[1]; k += 4) { const q = []; for (let i = k; i < k + 4; i++) { const o = i * 8; q.push([0, 1, 2, 3, 4].map((c) => fl(e[2][o + c]))); } out.push(q); } return out; });

test("spriteGeometry has the vertices and uvs of renderItemIn2D, in draw order", () => {
  for (const c of ref.sprite.cases) {
    const [f1, f2, f3, f4, w, h, t] = c.args;
    if (!(f1 === 1 && f2 === 0 && f3 === 0 && f4 === 1)) continue; // the port's icon is the whole texture
    const g = spriteGeometry(w, h, t), pos = g.attributes.position, uv = g.attributes.uv, nat = quadsOf(c.events);
    assert.equal(pos.count, nat.length * 6, `${w}x${h} vertex count`);
    nat.forEach((q, qi) => [0, 1, 2, 0, 2, 3].forEach((vi, k) => {
      const i = qi * 6 + k, v = q[vi];
      assert.deepEqual([pos.getX(i), pos.getY(i), pos.getZ(i), uv.getX(i), uv.getY(i)], [v[0], v[1], v[2], v[3], Math.fround(1 - v[4])], `${w}x${h} quad ${qi} vertex ${vi}`);
    }));
    g.dispose();
  }
});

test("dropped sprite stacks: the fancy copy count and z stacking, the fast copy count and scatter", () => {
  assert.equal(ref.dropped.cases.length, 26);
  for (const c of ref.dropped.cases) {
    const draws = c.events.filter((e) => e[0] === "D").length / (c.fancy ? 6 : 1); // six draws per fancy copy, one quad per fast copy
    if (c.fancy) {
      assert.equal(draws, spriteCopyCount(c.size), `fancy ${c.size}`);
      const ts = c.events.filter((e) => e[0] === "T"), zs = fancySpriteZ(draws);
      assert.deepEqual(ts[0].slice(1, 3), [-0.5, -0.25]);
      let z = Math.fround(ts[0][3]); // the first translate, then one step per copy
      ts.slice(1).forEach((t, k) => { z = Math.fround(z + Math.fround(t[3])); assert.equal(z, zs[k], `fancy ${c.size} copy ${k}`); });
      assert.equal(Math.fround(ts[0][3]), fancySpriteStart(draws), `fancy ${c.size} start`);
      const r = c.events.find((e) => e[0] === "R");
      assert.ok(Math.abs(r[1] - ((17 + 0.5) / 20 + 0.3) * 57.295776) < 1e-3);
    } else {
      assert.equal(draws, blockCopyCount(c.size), `fast ${c.size}`);
      const ts = c.events.filter((e) => e[0] === "T").map((e) => e.slice(1).map(Math.fround)), off = flatSpriteOffsets(draws, new JavaRandom(187)).slice(1);
      assert.deepEqual(ts, off, `fast ${c.size} scatter`);
      for (const r of c.events.filter((e) => e[0] === "R")) assert.equal(r[1], 150, "180 minus the view yaw");
    }
  }
});

test("a fast graphics sprite is one quad from (-0.5, -0.25) of unit size", () => {
  const c = ref.dropped.cases.find((e) => !e.fancy && e.size === 1), [q] = quadsOf(c.events);
  assert.deepEqual(q.map((v) => v.slice(0, 3)), [[-0.5, -0.25, 0], [0.5, -0.25, 0], [0.5, 0.75, 0], [-0.5, 0.75, 0]]);
});
