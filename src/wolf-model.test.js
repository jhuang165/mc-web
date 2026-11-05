// ModelWolf (bio) pose maths against the unchanged original (public/research/wolf-reference.json "model" rows).
import test from "node:test";
import assert from "node:assert/strict";
import { reference } from "./wolf.test.js";
import { wolfParts, WOLF_BOXES } from "./wolf-renderer.js";
import { tailAngle, interestedAngle, shakeAngle, isTamed } from "./wolf.js";

const STATES = {
  wild: { tamed: false, sitting: false, hp: 8, bu: 0, bv: 0, q: 0, r: 0, angry: false },
  tamedFull: { tamed: true, sitting: false, hp: 20, bu: 0, bv: 0, q: 0, r: 0, angry: false },
  tamedHurt: { tamed: true, sitting: false, hp: 6, bu: 0, bv: 0, q: 0, r: 0, angry: false },
  sitting: { tamed: true, sitting: true, hp: 20, bu: 0, bv: 0, q: 0, r: 0, angry: false },
  angry: { tamed: false, sitting: false, hp: 8, bu: 0, bv: 0, q: 0, r: 0, angry: true },
  shaking: { tamed: false, sitting: false, hp: 8, bu: 0.6, bv: 0.55, q: 0, r: 0, angry: false },
  shakingSitting: { tamed: true, sitting: true, hp: 20, bu: 0.9, bv: 0.85, q: 0, r: 0, angry: false },
  begging: { tamed: false, sitting: false, hp: 8, bu: 0, bv: 0, q: 1, r: 1, angry: false },
};
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-5, `${what}: ${a} vs ${b}`);

test("ModelWolf pose matches every recorded row", () => {
  let n = 0;
  for (const row of reference.model) {
    if (row.tag === "rest") continue;
    const s = STATES[row.tag],
      e = { owner: s.tamed ? "player" : "", sitting: s.sitting, angry: s.angry, dwHealth: s.hp, shakeTime: s.bu, prevShakeTime: s.bv, headTilt: s.q, prevHeadTilt: s.r };
    assert.equal(isTamed(e), s.tamed);
    const w = {
      sitting: s.sitting, angry: s.angry, tail: tailAngle(e), interested: interestedAngle(e, row.partial),
      shakeHead: shakeAngle(e, row.partial, 0), shakeMane: shakeAngle(e, row.partial, -0.08),
      shakeBody: shakeAngle(e, row.partial, -0.16), shakeTail: shakeAngle(e, row.partial, -0.2),
    };
    const parts = wolfParts(w, { limbSwing: row.limbSwing, limbAmount: row.limbAmount, headYaw: row.headYaw, headPitch: row.headPitch });
    for (const [k, p] of Object.entries(row.parts)) {
      // The recorded tail x is the age argument, which the renderer replaces with the tail angle.
      const want = k === "g" ? [w.tail, p.angle[1], p.angle[2]] : p.angle;
      p.point.forEach((v, i) => near(parts[k].point[i], v, `${row.tag}#${k} point`));
      want.forEach((v, i) => near(parts[k].angle[i], v, `${row.tag} ${row.limbSwing} ${row.partial} #${k} angle${i}`));
      n++;
    }
  }
  assert.ok(n > 300);
});

test("ModelWolf boxes and uv match the recorded model", () => {
  const rest = reference.model.find((r) => r.tag === "rest").parts;
  for (const [k, p] of Object.entries(rest)) {
    const mine = WOLF_BOXES[k].map(([ox, oy, oz, w, h, d, u, v]) => [[ox, oy, oz], [ox + w, oy + h, oz + d], [u, v]]);
    const theirs = p.boxes.map((b) => [b.from, b.to, b.uv]);
    assert.deepEqual(mine, theirs, k);
  }
});
