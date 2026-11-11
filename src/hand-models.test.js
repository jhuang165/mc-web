// The held and dropped block-item models against the executed renderBlockAsItem records: the chest family (chest-item-reference.json: TileEntityRendererChestHelper ->
// ModelChest) and the cactus and the pistons (item-render-reference.json). Every quad of the port's hand mesh, moved to item space, must equal a recorded quad's four
// (position, uv) pairs; the compared frame is the hand mesh's own (turned by 90 degrees about y when the native item turns), so the check covers the geometry, the uv
// orientation and the cropping.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { gl, transformPoint } from "./icon-cube.js";
import { chestItemModel } from "./chest-renderer.js";
import { blockItemGeometry, blockItemTurn, blockCubeGeometry } from "./first-person.js";
import { TILES, tileAtUv, tileRect } from "./block-textures.js";
import { toOriginal } from "./block-registry.js";
import { CACTUS_ITEM_QUADS } from "./render-shapes.js";

const read = (n) => JSON.parse(readFileSync(new URL(`../public/research/${n}`, import.meta.url), "utf8"));
const bf = new Float32Array(1), bi = new Int32Array(bf.buffer), fl = (b) => { bi[0] = b; return bf[0]; };
const r5 = (v) => (Math.round(v * 1e5) / 1e5 + 0).toFixed(5);
const key = (verts) => verts.map((v) => v.map(r5).join(",")).sort().join(" | ");

// Replay the GL calls from the identity matrix; every draw becomes quads of [x, y, z, u, v] vertices in item space (native v from the top).
function nativeQuads(events, uvOf = (u, v) => [u, v]) {
  let m = gl.identity(); const stack = [], out = [];
  for (const e of events) {
    if (e[0] === "T") m = gl.translate(m, e[1], e[2], e[3]);
    else if (e[0] === "S") m = gl.scale(m, e[1], e[2], e[3]);
    else if (e[0] === "R") m = gl.rotate(m, e[1], e[2], e[3], e[4]);
    else if (e[0] === "P") stack.push(m);
    else if (e[0] === "O") m = stack.pop();
    else if (e[0] === "D") for (let q = 0; q < e[1]; q += 4) {
      const verts = [];
      for (let i = q; i < q + 4; i++) { const o = i * 8, p = transformPoint(m, fl(e[2][o]), fl(e[2][o + 1]), fl(e[2][o + 2])); verts.push([...p, ...uvOf(fl(e[2][o + 3]), fl(e[2][o + 4]))]); }
      out.push(verts);
    }
  }
  return out;
}
// The port's mesh tree as quads of [x, y, z, u, v] with v from the top: BoxGeometry draws four vertices per face, a box geometry or the indexed box item geometry the same.
function meshQuads(object, uvOf = (u, v) => [u, v]) {
  object.updateMatrixWorld(true);
  const out = [];
  object.traverse((node) => {
    if (!node.isMesh) return;
    const g = node.geometry, pos = g.attributes.position, uv = g.attributes.uv, p = new THREE.Vector3();
    for (let q = 0; q < pos.count; q += 4) {
      const verts = [];
      for (let i = q; i < q + 4; i++) { p.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld); verts.push([p.x, p.y, p.z, ...uvOf(uv.getX(i), 1 - uv.getY(i))]); }
      out.push(verts);
    }
  });
  return out;
}
const multiset = (quads) => { const m = new Map(); for (const q of quads) m.set(key(q), (m.get(key(q)) ?? 0) + 1); return m; };
function sameQuads(port, native, what) {
  const a = multiset(port), b = multiset(native), missing = [...b.keys()].filter((k) => a.get(k) !== b.get(k)), extra = [...a.keys()].filter((k) => !b.has(k));
  assert.equal(port.length, native.length, `${what}: quad count`);
  assert.deepEqual({ missing: missing, extra }, { missing: [], extra: [] }, `${what}: quads differ`);
}

test("the held chest model draws the executed ModelChest quads, uvs included", () => {
  const ref = read("chest-item-reference.json"), native = nativeQuads(ref.items[0].events);
  assert.equal(native.length, 18);
  const hand = new THREE.Group(), model = chestItemModel(new THREE.MeshBasicMaterial());
  model.rotation.y = Math.PI / 2; // first-person.js select()
  hand.add(model);
  sameQuads(meshQuads(hand), native, "chest hand");
});

// Texture coordinates as [native icon index, fraction s, fraction t from the top]: the record's u is 2 * icon index + fraction (see its "icons" list), the port's are atlas uvs.
const item = read("item-render-reference.json"), icons = item.icons;
const nativeUv = (u, v) => [icons.indexOf(icons[Math.floor(u / 2)]), u - 2 * Math.floor(u / 2), v]; // the list repeats names (water, piston_side): first index stands for all
function portUv(u, vTop) {
  const tile = tileAtUv(u, 1 - vTop), r = tileRect(tile), name = icons.indexOf(TILES[tile]);
  assert.ok(name >= 0, `tile ${TILES[tile]} is a native icon`);
  return [name, (u - r.u0) / (r.u1 - r.u0), (vTop - (1 - r.v1)) / (r.v1 - r.v0)];
}
function handQuads(id, meta, scale = 1) {
  const hand = new THREE.Group(), mesh = new THREE.Mesh(blockItemGeometry(id, meta, scale) ?? blockCubeGeometry(id, meta, scale), new THREE.MeshBasicMaterial());
  mesh.rotation.y = blockItemTurn(id, meta);
  hand.add(mesh);
  return meshQuads(hand, portUv);
}
const nativeItem = (id, meta = 0) => nativeQuads(item.items.find((e) => e.id === id && e.meta === meta).events, nativeUv);

test("the held cactus is the executed renderBlockAsItem type 13 quads (full top and bottom, sides inset 1/16, not turned)", () => {
  const native = nativeItem(81);
  assert.equal(native.length, 6);
  assert.equal(blockItemTurn(53), 0);
  sameQuads(handQuads(53, 0), native, "cactus hand");
  assert.equal(CACTUS_ITEM_QUADS.length, 6);
});

test("the held pistons are the executed type 16 quads, turned 90 degrees", () => {
  assert.equal(blockItemTurn(117), Math.PI / 2);
  for (const [portId, nativeId] of [[116, 29], [117, 33]]) {
    for (const hold of [portId, 1000 + portId]) sameQuads(handQuads(hold, 0), nativeItem(nativeId), `piston ${hold}`);
  }
});

test("the held dispenser and dropper draw their front as the executed metadata 3 item", () => {
  for (const [hold, nativeId] of [[1115, 23], [1132, 158]]) sameQuads(handQuads(hold, 0), nativeItem(nativeId), `dispenser family ${hold}`);
});

test("plain cubes (stone, cobblestone, planks, sand, logs, bricks, crafting table) match the executed quads with their bottom face", () => {
  const portOf = (o) => { for (let b = 1; b < 256; b++) { const t = toOriginal(b, 0); if (t?.[0] === o && t[1] === 0) return b; } throw new Error(`no port block for ${o}`); };
  for (const nativeId of [1, 4, 5, 12, 17, 45, 58]) sameQuads(handQuads(portOf(nativeId), 0), nativeItem(nativeId), `cube ${nativeId}`);
});

test("block items that renderBlockAsItem does not turn keep yaw 0 in hands and drops, the others turn 90 degrees", () => {
  for (const id of [53 + 0]) assert.equal(blockItemTurn(id), 0);
  assert.equal(blockItemTurn(1), Math.PI / 2, "stone");
  assert.equal(blockItemTurn(54), Math.PI / 2, "chest");
  for (const [native, expectTurn] of [[53, 0], [85, 0], [107, 0], [138, 0], [145, 0], [139, 0], [122, 0]]) assert.ok(item.items.some((e) => e.id === native), `native ${native} recorded`);
});
