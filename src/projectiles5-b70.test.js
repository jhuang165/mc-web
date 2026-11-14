import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import { Arrows, ARROW } from "./bow.js";
import { Survival } from "./survival.js";
import { GaussianRandom } from "./projectiles.js";
import { makeStack } from "./inventory.js";

// Batch 70 (projectiles5). public/research/arrow-pickup-reference.json (tools/probes/ArrowPickupProbe.java, executed: the unchanged
// EntityArrow.onCollideWithPlayer on a real EntityPlayer with a real InventoryPlayer; only EntityPlayer.onItemPickup is recorded).
const ref = JSON.parse(readFileSync(new URL("../public/research/arrow-pickup-reference.json", import.meta.url)));
const records = ref.records;
const STONE = 1;

function playerWith(inv, creative) {
  const s = new Survival({}, creative ? "creative" : "survival");
  const main = s.inventory.main;
  main.fill(null);
  if (inv === "arrows") main[0] = makeStack(ARROW, 10);
  if (inv.startsWith("full")) {
    for (let i = 0; i < 35; i++) main[i] = makeStack(STONE, 64);
    main[35] = inv === "full" ? makeStack(STONE, 64) : makeStack(ARROW, inv === "full63" ? 63 : 64);
  }
  return s;
}
const arrowCount = (s) => s.inventory.main.reduce((n, st) => n + (st && st.id === ARROW ? st.count : 0), 0);
const stackCount = (s) => s.inventory.main.filter(Boolean).length;

test("the executed record covers the pickup matrix", () => {
  assert.equal(records.length, 300);
  assert.equal(records.filter((r) => r.removed).length, 13);
});

test("Arrows.collect matches EntityArrow.onCollideWithPlayer across shake, pickup mode, Creative and inventories", () => {
  for (const r of records) {
    const label = JSON.stringify([r.shake, r.inGround, r.pickup, r.creative, r.inventory]);
    const arrows = new Arrows(() => 0.5);
    const a = arrows.make({ x: 0.5, y: 65, z: 0.5, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, new GaussianRandom(1), { pickup: r.pickup });
    a.rand = new JavaRandom(7); a.inGround = r.inGround; a.shake = r.shake;
    arrows.list.push(a);
    const s = playerWith(r.inventory, r.creative);
    assert.equal(arrowCount(s), r.arrowsBefore, label);
    const n = arrows.collect([0.2, 65, 0.2, 0.8, 66.8, 0.8], s);
    assert.equal(n === 1, r.removed, label);
    assert.equal(arrows.list.length === 0, r.removed, label);
    assert.equal(arrowCount(s), r.arrowsAfter, label);
    assert.equal(stackCount(s), r.stacksAfter, label);
    const sounds = arrows.drain().filter((e) => e.sound);
    assert.equal(sounds.length, r.sounds.length, label);
    for (const [i, [name, vol, pitch]] of r.sounds.entries()) { assert.equal(sounds[i].sound, name, label); assert.equal(sounds[i].volume, Math.fround(vol), label); assert.equal(sounds[i].pitch, Math.fround(pitch), label); }
    assert.equal(a.rand.nextFloat(), Math.fround(r.nextFloat), `${label} random after`);
  }
});

// public/research/fireball-pick-reference.json (tools/probes/FireballPickProbe.java): the entity half of EntityRenderer.getMouseOver (bytecode-read loop) over the real
// EntityFireball / AxisAlignedBB / Vec3 objects. The replay is Fireballs.pick, which the dedicated server's punchBall (server-mobs.js) and the single-player click share.
import { Fireballs } from "./fireballs.js";
const pickRef = JSON.parse(readFileSync(new URL("../public/research/fireball-pick-reference.json", import.meta.url))).records;

test("balls: only the large fireball can be collided with; both have collision border 1.0 and the 1.0 / 0.3125 box", () => {
  const [large, small] = pickRef.filter((r) => r.case === "class");
  assert.deepEqual([large.canBeCollidedWith, small.canBeCollidedWith, large.border, small.border], [true, false, 1, 1]);
  assert.deepEqual(large.box, [-0.5, 10, -0.5, 0.5, 11, 0.5]);
  const fb = new Fireballs({ random: () => 0.5, fireballSeed: () => 1 });
  for (const r of [large, small]) {
    const b = fb.launch({ large: r.large, x: 0, y: 10, z: 0, dx: 0, dy: 0, dz: 0.1, exact: [0, 0, 0.1] });
    assert.deepEqual(fb.boxOf({ ...b, ticks: 1 }), r.box);
  }
});

test("Fireballs.pick picks the ball getMouseOver picks, at the distance it records", () => {
  const scenes = pickRef.filter((r) => r.case === "pick");
  let picked = 0;
  for (const [n, r] of scenes.entries()) {
    const fb = new Fireballs({ fireballSeed: () => 1 });
    const made = r.balls.map(([x, y, z, large]) => { const b = fb.launch({ large: !!large, x, y, z, dz: 0.1, exact: [0, 0, 0.1] }); b.ticks = 1; return b; });
    const reach = r.creative ? 6 : 3;
    const viewer = [r.eye[0] - 0.3, r.eye[1] - 1.62, r.eye[2] - 0.3, r.eye[0] + 0.3, r.eye[1] + 0.18, r.eye[2] + 0.3];
    const hit = fb.pick({ x: r.eye[0], y: r.eye[1], z: r.eye[2] }, { x: r.look[0], y: r.look[1], z: r.look[2] }, reach, r.wall >= 0 ? r.wall : reach, viewer);
    const got = hit ? made.indexOf(hit.entity) : -1;
    // the probe has no large/small split in its answer: a small ball is never collidable, so it never answers
    assert.equal(got, r.picked, `scene ${n}`);
    if (got >= 0) { picked++; assert.ok(hit.distance === r.distance, `scene ${n} distance ${hit.distance} vs ${r.distance}`); }
  }
  assert.ok(picked > 1500);
});
