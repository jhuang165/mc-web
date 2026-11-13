// Batch 55: the horse client copy's own animation, an unsaddled ridden copy's physics, and the run-around buck's dismount.
// Replays public/research/horse-rear-reference.json (tools/probes/HorseRearProbe.java: the unchanged wi (EntityHorse), executed) against horse-copy.js and entities.js.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { newHorseAnim, stepHorseAnim, horseLean, horseRear, horseMouth, horseFlagsOf, HORSE_EATING, HORSE_REARING, HORSE_MOUTH } from "./horse-copy.js";
import { moveEntityWithHeading } from "./entities.js";
import { dismountSpot } from "./minecarts.js";

const ref = JSON.parse(await readFile(new URL("../public/research/horse-rear-reference.json", import.meta.url), "utf8"));
const f = Math.fround;

const SCRIPTS = {
  rearThenEat: [[2, 24, HORSE_REARING], [30, 44, HORSE_EATING]],
  mouthRearEat: [[1, 6, HORSE_MOUTH], [4, 10, HORSE_REARING], [8, 30, HORSE_EATING], [20, 22, HORSE_MOUTH]],
  rearWhileEating: [[0, 12, HORSE_EATING], [6, 16, HORSE_REARING]],
};

test("the copy's counters follow its own flags exactly as the executed wi.h() does (3 scripts x 50 ticks)", () => {
  assert.equal(ref.anim.length, 3);
  for (const s of ref.anim) {
    const a = newHorseAnim();
    s.ticks.forEach((t, i) => {
      a.flags = SCRIPTS[s.name].reduce((v, [from, to, bit]) => (i >= from && i <= to ? v | bit : v), 0);
      stepHorseAnim(a);
      const at = `${s.name} tick ${i}`;
      assert.equal(a.headLean, f(t.headLean), at + " bJ"); assert.equal(a.prevHeadLean, f(t.prevHeadLean), at + " bK");
      assert.equal(a.rearAmount, f(t.rearAmount), at + " bL"); assert.equal(a.prevRearAmount, f(t.prevRearAmount), at + " bM");
      assert.equal(a.mouth, f(t.mouth), at + " bN"); assert.equal(a.prevMouth, f(t.prevMouth), at + " bO");
      assert.equal(horseLean(a, f(0.5)), f(t.p), at + " p"); assert.equal(horseRear(a, f(0.5)), f(t.q), at + " q"); assert.equal(horseMouth(a, f(0.5)), f(t.r), at + " r");
    });
  }
});

test("the live horse's flags are the watcher bits the animation reads", () => {
  assert.equal(horseFlagsOf({ horse: { tame: true, saddled: true } }), 6);
  assert.equal(horseFlagsOf({ horse: {}, rearing: true, mouthTicks: 3 }), HORSE_REARING | HORSE_MOUTH);
  assert.equal(horseFlagsOf({ horse: { eating: true } }), HORSE_EATING);
});

test("a ridden unsaddled horse's copy falls, hovers over an unloaded chunk and stands as the executed copy does (3 scenarios)", () => {
  assert.equal(ref.copy.length, 3);
  const world = { get: (x, y) => (y < 0 ? 1 : 0), solid: (x, y) => y < 0, getMeta: () => 0 };
  for (const s of ref.copy) {
    const c = { x: s.start[0], y: s.start[1], z: s.start[2], vx: s.motion[0], vy: s.motion[1], vz: s.motion[2], onGround: s.start[1] === 0, inWater: false, inLava: false, fallDistance: 0,
      rotationYaw: 0, aiMoveSpeed: 0, stepHeight: 0.5, clientUnloaded: !s.loaded };
    s.ticks.forEach((t, i) => {
      c.vx *= 0.98; c.vy *= 0.98; c.vz *= 0.98; // the remote copy's drag, then the 0.005 cut (entity-tracker.js ClientEntity)
      if (Math.abs(c.vx) < 0.005) c.vx = 0; if (Math.abs(c.vy) < 0.005) c.vy = 0; if (Math.abs(c.vz) < 0.005) c.vz = 0;
      moveEntityWithHeading(world, c, 1.4, 1.6, 0);
      const at = `${s.name} tick ${i}`;
      for (const [k, r] of [["x", t.x], ["y", t.y], ["z", t.z], ["vx", t.mx], ["vy", t.my], ["vz", t.mz]]) assert.ok(Math.abs(c[k] - r) < 1e-9, `${at} ${k}: ${c[k]} vs ${r}`);
      assert.equal(c.onGround, t.onGround, at + " onGround");
    });
  }
});

test("the run-around buck and a direct mountEntity(null) both land the player on the dismount spot, never at the seat (executed, 7 cells x 2 modes)", () => {
  assert.equal(ref.buck.length, 14);
  for (const b of ref.buck) {
    assert.equal(b.mounted, false); assert.equal(b.horseHasRider, false);
    assert.deepEqual(b.after, b.spots.at(-1), b.name); // the server player is where setPlayerLocation put it
    assert.notDeepEqual(b.after, b.seat, b.name + ": the spot, not the seat");
    assert.equal(b.status === 6, b.mode === "task", b.name + " status 6 only from the task");
  }
  // the port's search (dismountSpot) against every record: stone cells as the probe built them
  for (const b of ref.buck) {
    const cells = new Set();
    for (const [x0, y0, z0, x1, y1, z1] of b.cells) for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) cells.add(`${x},${y},${z}`);
    const stone = (x, y, z) => y < 0 || cells.has(`${x},${y},${z}`);
    const world = { get: (x, y, z) => (stone(x, y, z) ? 1 : 0), solid: stone, getMeta: () => 0 };
    const clear = (bb) => { for (let x = Math.floor(bb[0]); x < Math.floor(bb[3] + 1); x++) for (let y = Math.floor(bb[1]); y < Math.floor(bb[4] + 1); y++) for (let z = Math.floor(bb[2]); z < Math.floor(bb[5] + 1); z++) if (stone(x, y, z)) return false; return true; };
    const spot = dismountSpot(world, { x: b.seat[0], y: b.seat[1], z: b.seat[2] }, { x: b.horse[0], minY: b.horseMinY, height: b.horseHeight, z: b.horse[2] }, clear);
    b.after.forEach((v, i) => assert.ok(Math.abs([spot.x, spot.y, spot.z][i] - v) < 1e-6, `${b.name} ${b.mode} axis ${i}: ${[spot.x, spot.y, spot.z][i]} vs ${v}`));
  }
});
