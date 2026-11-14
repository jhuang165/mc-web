// Batch 65 itemsprites2: tinted flat block items (blocks-sheet cell times getRenderColor), pack animation of every item sprite in the atlas, and the first-person map pose
// replayed against the executed ItemRenderer.renderItemInFirstPerson map branch (first-person-reference.json, tools/verify-first-person.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";

globalThis.document ??= { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
const { itemPasses, flatTintOfTile } = await import("./item-passes.js");
const { itemTexture } = await import("./first-person.js");
const { mapHandMatrices } = await import("./map-render.js");
const { swingPose } = await import("./animation.js");
const { flatBlockItem } = await import("./flat-block-items.js");
const { blockTile, TILES } = await import("./block-textures.js");
const { itemFromOriginal } = await import("./region-import.js");
const { blockSpriteName } = await import("./item-atlas.js");

const leaf = JSON.parse(readFileSync(new URL("../public/research/leafcolor-reference.json", import.meta.url))).records[0];
const fp = JSON.parse(readFileSync(new URL("../public/research/first-person-reference.json", import.meta.url)));
const RAD = Math.PI / 180, f32 = Math.fround;
const byId = (id) => leaf.items.find((i) => i.id === id);

test("tinted flat block items are the blocks-sheet cell times the executed render colour", () => {
  const cases = [[31, 1, "tallgrass", byId(31).pass0[1]], [31, 2, "fern", byId(31).pass0[2]], [175, 2, "double_plant_grass_bottom", byId(175).pass0[2]], [175, 3, "double_plant_fern_bottom", byId(175).pass0[3]],
    [106, 0, "vine", byId(106).pass0[0]], [111, 0, "waterlily", byId(111).pass0[0]]];
  for (const [orig, damage, tile, colour] of cases) {
    const item = itemFromOriginal(orig, damage), p = itemPasses(item.id, item.damage);
    assert.ok(p, `${orig}:${damage} has a tint pass`);
    assert.equal(p.base, "/media/1.7.10/blocks/" + tile + ".png");
    assert.equal(p.color, colour & 0xffffff, `${orig}:${damage} colour`);
    assert.equal(p.overlay, null);
    assert.ok(blockSpriteName(p.base), tile + " is a cell of the blocks sheet");
    assert.ok(p.tint.every((c) => c >= 0 && c <= 1));
  }
});

test("white blocks stay untinted (dead shrub, sunflower, rose, rails, ladder) and no flat item returns a baked data url", () => {
  for (const [orig, damage] of [[31, 0], [175, 0], [175, 1], [175, 4], [175, 5], [65, 0], [66, 0], [27, 0]]) {
    const item = itemFromOriginal(orig, damage);
    if (item) assert.equal(itemPasses(item.id, item.damage), null, `${orig}:${damage}`);
  }
  for (const id of [31, 106, 111, 175, 37, 38, 39, 40]) for (let d = 0; d < 6; d++) {
    const item = itemFromOriginal(id, d);
    if (!item) continue;
    const url = itemTexture(item.id, item.damage);
    assert.ok(url === null || !String(url).startsWith("data:"), `${id}:${d} ${url}`);
  }
  assert.equal(flatTintOfTile("deadbush"), null);
  assert.equal(flatTintOfTile("rail_normal"), null);
});

test("every flat item the tint covers draws a blocks png through itemTexture", () => {
  for (const [orig, damage] of [[31, 1], [31, 2], [106, 0], [111, 0], [175, 2], [175, 3]]) {
    const item = itemFromOriginal(orig, damage);
    assert.ok(flatBlockItem(item.id), `${orig} is a flat block item`);
    assert.match(itemTexture(item.id, item.damage), /^\/media\/1\.7\.10\/blocks\/[a-z_]+\.png/);
  }
  assert.ok(TILES.includes("vine"));
});

test("item sprite animation reaches the atlas for every sprite, not only the clock and compass", () => {
  const src = readFileSync(new URL("./item-animation.js", import.meta.url), "utf8"), atlas = readFileSync(new URL("./item-atlas.js", import.meta.url), "utf8");
  assert.match(src, /setItemAtlasFrame\(sprite, entry\.anim\.frame\)/);
  assert.match(src, /setFrameUrlResolver\(\(url\) => byData\.get\(url\)\?\.base\)/);
  assert.match(atlas, /frameUrlResolver\(url\) \?\? url/);
});

// The map branch of bly.a: after the light group's pop, the pose up to the first arm (P ... T T R R), each arm's own group (P ... S, A, O), then the map matrix (R R R S R R T S) up to the quad.
function mapFrames(events) {
  const m = new THREE.Matrix4(), t = new THREE.Matrix4(), apply = (target, e) => {
    if (e[0] === "T") target.multiply(t.makeTranslation(e[1], e[2], e[3]));
    else if (e[0] === "S") target.multiply(t.makeScale(e[1], e[2], e[3]));
    else if (e[0] === "R") target.multiply(t.makeRotationAxis(new THREE.Vector3(e[2], e[3], e[4]), e[1] * RAD));
  };
  let i = events.findIndex((e) => e[0] === "O") + 1;
  const base = new THREE.Matrix4(), arms = [], map = new THREE.Matrix4();
  // sway rotations, colours, push
  for (; events[i][0] !== "P"; i++) apply(base, events[i]);
  i++; // the map branch's own push
  for (; events[i][0] !== "P"; i++) apply(base, events[i]);
  while (events[i][0] === "P") {
    const arm = new THREE.Matrix4(); i++;
    for (; events[i][0] !== "A"; i++) apply(arm, events[i]);
    arms.push(arm);
    while (events[i][0] !== "O") i++;
    i++;
  }
  for (; events[i][0] !== "D"; i++) apply(map, events[i]);
  return { base, arms, map };
}

test("the first-person map pose replays every executed ItemRenderer map case", () => {
  const cases = fp.cases.filter((c) => c.id === 358);
  assert.equal(cases.length, 25);
  for (const c of cases) {
    const [pitch, prevPitch, yaw, , armPitch, armPitchPrev, armYaw, armYawPrev] = c.view;
    const lerp = (a, b) => f32(a + f32(f32(b - a) * f32(c.partial)));
    const equip = lerp(c.prevEquip, c.equip), nativePitch = lerp(prevPitch, pitch);
    const pose = { progress: c.swing, item: c.id, equip, swing: swingPose(c.swing), bob: { x: 0, y: 0, rz: 0, rx: 0 },
      sway: { x: f32(f32(pitch - lerp(armPitchPrev, armPitch)) * 0.1) * RAD, y: f32(f32(yaw - lerp(armYawPrev, armYaw)) * 0.1) * RAD } };
    const got = mapHandMatrices(pose, nativePitch), want = mapFrames(c.events);
    assert.deepEqual(c.events.filter((e) => e[0] === "A").length, 2, "both arms draw");
    assert.ok(c.events.some((e) => e[0] === "M"), "the map colours draw");
    const near = (a, b, what) => { for (let k = 0; k < 16; k++) assert.ok(Math.abs(a.elements[k] - b.elements[k]) < 3e-4 * Math.max(1, Math.abs(b.elements[k])), `${what} swing ${c.swing} equip ${equip} pitch ${nativePitch} view ${c.view} element ${k}: ${a.elements[k]} vs ${b.elements[k]}`); };
    near(got.base, want.base, "base");
    got.arms.forEach((a, k) => near(a, want.arms[k], "arm " + k));
    near(got.map, want.map, "map");
  }
});
