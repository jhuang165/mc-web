// Batch 85 spcopy85: NetHandlerPlayServer.processPlayer's walking branch (nh.a(jd), bytecode-read) on the integrated server's copy (ai.js PlayerView, entities.js
// serverPlayerUpdate): mw.i() and the packet's move start at the LAST ACCEPTED position, the packet's delta is moved with collisions (clipped axes zero the motion), the "moved wrongly"
// test and the collision test answer with setPlayerLocation (S08). "Moved too quickly" is skipped for the integrated server's owner and applies on a dedicated server.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { EntityWorld } from "./entities.js";
import { JUMP_MOTION } from "./player-movement.js";
import { movedTooQuickly, movedWrongly, needsCorrection, quickMove, wrongMove, shrunkBox } from "./server-process-player.js";

const flat = (name) => {
  const world = new World(name);
  for (let x = 30; x <= 50; x++) for (let z = 30; z <= 50; z++) for (let y = 9; y <= 20; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  return world;
};
const client = { x: 40.5, y: 10, z: 43.5, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
function setup(name, build) {
  const world = flat(name); build?.(world);
  const w = new EntityWorld(world, [], () => 0.5), s = new Survival({});
  for (let i = 0; i < 3; i++) w.tick(client, s);
  const p = w.ai.player;
  Object.assign(p, { packetGround: true, sprinting: false, yaw: 0 });
  return { w, s, p };
}
const send = (p, w, s, to, packetGround = true) => { p.update({ ...client, ...to }, s, 0); p.packetGround = packetGround; w.serverPlayerUpdate(p); };

test("the checks: too quickly skips the single-player owner and fires on a dedicated server; wrongly ignores |dy| < 0.5, sleepers and Creative", () => {
  const delta = { x: 11, y: 0, z: 0 }, motion = { x: 12, y: 0, z: 0 };
  assert.equal(quickMove(delta, motion), 121);
  assert.equal(movedTooQuickly(delta, motion, { owner: true }), false, "N() && M().equals(name): the integrated server's owner");
  assert.equal(movedTooQuickly(delta, motion, { owner: false }), true, "a dedicated server has no owner: N() is false");
  assert.equal(movedTooQuickly(delta, { x: 1, y: 0, z: 0 }), false, "min(|delta|, |motion|)");
  assert.equal(wrongMove({ x: 0, y: 0.49, z: 0 }, { x: 0, y: 0, z: 0 }), 0, "dy within (-0.5, 0.5) counts as 0");
  assert.equal(wrongMove({ x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: 0 }), 0.25);
  assert.equal(movedWrongly({ x: 0.3, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), true);
  assert.equal(movedWrongly({ x: 0.25, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), false, "0.0625 is not over 0.0625");
  assert.equal(movedWrongly({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { creative: true }), false);
  assert.equal(movedWrongly({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { sleeping: true }), false);
  assert.equal(needsCorrection({ clearBefore: true, wrongly: false, clearAfter: true }), false);
  assert.equal(needsCorrection({ clearBefore: true, wrongly: true, clearAfter: true }), true);
  assert.equal(needsCorrection({ clearBefore: true, wrongly: false, clearAfter: false }), true);
  assert.equal(needsCorrection({ clearBefore: false, wrongly: true, clearAfter: false }), false, "d28: the copy was already stuck");
  assert.equal(needsCorrection({ clearBefore: true, wrongly: true, clearAfter: false, sleeping: true }), false);
  const b = shrunkBox({ x: 0, y: 0, z: 0 }, 0.6, 1.8);
  assert.ok(Math.abs(b[0] - (-0.3 + 0.0625)) < 1e-6 && Math.abs(b[4] - (1.8 - 0.0625)) < 1e-6);
});

test("the copy's own move starts at the last accepted position, the packet's delta follows, and the position becomes the packet's", () => {
  const { w, s, p } = setup("spcopy85-from");
  const seen = [];
  w.serverCopyMoved = (c) => seen.push({ x: c.x, y: c.y, z: c.z });
  const from = { x: p.x, y: p.y, z: p.z };
  p.motion.x = 0.2; // a push: the copy's own move carries it 0.2 east from the accepted position
  send(p, w, s, { x: 40.6 });
  assert.deepEqual(seen, [from], "mw.i() charges the move from the accepted position, not from the packet's");
  assert.equal(p.x, 40.6, "mw.a(d5, d7, d9): the copy ends at the packet's position");
  assert.equal(p.corrected ?? 0, 0);
  assert.equal(p.sent.x, 40.6);
});

test("a packet into a wall: mw.d clips the delta, the copy is wrongly placed, and setPlayerLocation puts it back (S08) with the client reset", () => {
  const { w, s, p } = setup("spcopy85-wall", (world) => { for (let y = 10; y <= 12; y++) world.put(41, y, 43, 1, 0, false); });
  const fixes = [];
  w.serverCorrect = (at) => fixes.push({ ...at });
  const from = { x: p.x, y: p.y, z: p.z };
  send(p, w, s, { x: 41.0 });
  assert.equal(p.corrected, 1);
  assert.deepEqual(fixes, [from], "the S08 carries the last accepted position");
  assert.deepEqual({ x: p.x, y: p.y, z: p.z }, from);
  assert.equal(p.motion.x, 0, "the clipped axis zeroes the motion");
  // b86 spcopy86: the S08 does not reset the client's last reported position (bjb.a(fu) sends its C06 from the handler); the copy now waits for that answer (nh.r, spcopy86-b86.test.js)
  assert.equal(p.hasMoved, false);
  assert.deepEqual(p.answer, { ...from, onGround: false }, "the host took the S08: its C06 answer is queued");
  // Creative is exempt from "moved wrongly" but the collision test at the packet's position still answers.
  const c = setup("spcopy85-wall-creative", (world) => { for (let y = 10; y <= 12; y++) world.put(41, y, 43, 1, 0, false); });
  c.s.mode = "creative";
  send(c.p, c.w, c.s, { x: 41.0 });
  assert.equal(c.p.corrected, 1, "d28 and not d32");
});

test("a free move is accepted untouched; a jump packet under a ceiling clips the jump's motion (mw.d)", () => {
  const free = setup("spcopy85-free");
  const fixes = [];
  free.w.serverCorrect = (at) => fixes.push(at);
  for (let i = 0; i < 5; i++) send(free.p, free.w, free.s, { x: 40.5 + 0.2 * (i + 1) });
  assert.equal(free.p.corrected ?? 0, 0);
  assert.equal(fixes.length, 0);
  assert.ok(Math.abs(free.p.x - 41.5) < 1e-9);
  const jump = setup("spcopy85-ceiling", (world) => { world.put(40, 12, 43, 1, 0, false); });
  assert.equal(jump.p.onGround, true);
  send(jump.p, jump.w, jump.s, { y: 10.42 }, false);
  assert.equal(jump.p.motion.y, 0, "bj() gave 0.42 and mw.d's clipped climb zeroed it");
  assert.ok(JUMP_MOTION > 0);
  const open = setup("spcopy85-jump");
  send(open.p, open.w, open.s, { y: 10.42 }, false);
  assert.equal(open.p.motion.y, JUMP_MOTION, "open air: the jump's motion stays");
});

// b86 spcopy86: the 10-block guard is gone; a far packet runs the native checks: the owner is exempt from "moved too quickly" and an open path is not "moved wrongly".
test("a packet over 10 blocks through open air: the owner skips 'moved too quickly' and the copy takes it with no correction", () => {
  const { w, s, p } = setup("spcopy85-teleport");
  const fixes = [];
  w.serverCorrect = (at) => fixes.push(at);
  send(p, w, s, { x: 49.5, z: 31.5 });
  assert.equal(fixes.length, 0);
  assert.equal(p.x, 49.5);
});

test("the replay / probe copy (`placed`, b86) keeps its old order; main.js hooks the S08; the dedicated server keeps its own copy path", () => {
  const world = flat("spcopy85-legacy"), w = new EntityWorld(world, [], () => 0.5), s = new Survival({});
  for (let i = 0; i < 3; i++) w.tick(client, s);
  const p = w.ai.player;
  p.placed = true;
  p.motion.x = 0.2;
  p.update({ ...client, x: 40.6 }, s, 0);
  w.serverPlayerUpdate(p);
  assert.equal(p.x, 40.6);
  assert.equal(p.corrected ?? 0, 0);
  const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(main, /mobs\.serverCorrect = \(at\) => \{ position\.set\(at\.x, at\.y, at\.z\); previous\.copy\(position\); velocity\.set\(0, 0, 0\); \}/);
  const sim = readFileSync(new URL("./multiplayer/simulation.js", import.meta.url), "utf8");
  assert.match(sim, /serverCopyBefore\(p, controls/, "the dedicated server moves the player from its input (server-authoritative) and keeps its copy step");
  assert.doesNotMatch(sim, /server-process-player/, "its checks stay the dedicated ones: no owner, no packet position to correct");
});
