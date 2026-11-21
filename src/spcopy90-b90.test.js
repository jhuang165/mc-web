// Batch 90 spcopy90: the integrated server's copy of the player after spcopy89.
// Bytecode-read (1.7.10 jar, javap -c -p):
//   - transferPlayerToDimension (oi.a(mw, int)) writes only mw.ap and mw.K, the transfer (oi.a(sa, int, mt, mt)) only the position (sa.t), the Teleporter only v/w/x and y-rotation:
//     no write of onGround (sa.D), so the copy arrives with the onGround mw.i() left on it, and it holds until the C06 answer's processPlayer sets it (mw.D = packet onGround).
//   - setPlayerLocation (nh.a(DDDFF)) sends the S08 from the server tick that calls it (the C02 of mountEntity / sleepInBedAt / the break, or the world pass); the client handles it
//     in its next network processing and answers with the C06, so the answer is the next network tick's packet and this tick's C03 meets r == false (dropped).
// Nothing here is a browser check.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { EntityWorld } from "./entities.js";
import { takeAnswer } from "./server-process-player.js";

const flat = (name) => {
  const world = new World(name);
  for (let x = 30; x <= 50; x++) for (let z = 26; z <= 54; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  return world;
};
const body = { alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };

// A copy that arrives with `ground` and a sliding motion; two ticks (the arrival's S08 is answered in the first network tick, as the trip's own tick has passed).
function arrive(ground) {
  const w = new EntityWorld(flat("spcopy90-arrive-" + ground), [], () => 0.5), s = new Survival({});
  const p = w.ai.player;
  p.arriveFrom({ fallDistance: 0, inWater: false, onGround: ground, motion: { x: 0.2, y: 0, z: 0 }, corrected: 0 });
  assert.equal(p.onGround, ground, "arrives with the old copy's onGround");
  const pos = { x: 40.5, y: 10, z: 40.5 };
  Object.assign(p, { packetGround: ground, sneaking: false, flying: false, riding: false, sleeping: false, sprinting: false, yaw: 0 });
  w.serverCorrect = () => {};
  w.tick({ ...body, ...pos }, s);
  return { p, w };
}

test("a portal arrival keeps the old copy's onGround for the first mw.i(), grounded or airborne", () => {
  const g = arrive(true), a = arrive(false);
  assert.equal(g.p.hasMoved, true);
  assert.equal(a.p.hasMoved, true);
  // EntityLivingBase.onLivingUpdate's friction: 0.6 * 0.91 on the ground, 0.91 in the air, so the slide differs by the carried flag.
  assert.ok(Math.abs(g.p.motion.x) < Math.abs(a.p.motion.x), `${g.p.motion.x} < ${a.p.motion.x}`);
});

test("the carried onGround is not overwritten from the client's state while the copy waits or has left the world", () => {
  const src = readFileSync(new URL("./living-simulation.js", import.meta.url), "utf8");
  assert.match(src, /state\.onGround !== undefined && !mobs\.ai\.player\.left && mobs\.ai\.player\.hasMoved !== false\) mobs\.ai\.player\.onGround/);
  const ai = readFileSync(new URL("./ai.js", import.meta.url), "utf8");
  assert.match(ai, /this\.onGround = !!old\.onGround;/);
});

test("takeAnswer holds an S08 of this network tick until the next one", () => {
  const p = { answer: { x: 1, y: 2, z: 3, onGround: false }, answerFrom: 5, netTicks: 4 };
  assert.equal(takeAnswer(p), null);
  assert.ok(p.answer, "still queued");
  p.netTicks = 5;
  assert.deepEqual(takeAnswer(p), { x: 1, y: 2, z: 3, onGround: false });
  assert.equal(p.answer, null);
});

test("the sleep, mount and dismount S08 are answered one network tick later; the arrival's and a correction's are not held", () => {
  const w = new EntityWorld(flat("spcopy90-late"), [], () => 0.5), s = new Survival({});
  const p = w.ai.player;
  w.serverCorrect = () => {};
  const pos = { x: 40.5, y: 10, z: 40.5 };
  const base = { packetGround: true, sneaking: false, flying: false, riding: false, sleeping: false, sprinting: false, yaw: 0 };
  for (let i = 0; i < 3; i++) { Object.assign(p, base); w.tick({ ...body, ...pos }, s); }
  Object.assign(p, base, { sleeping: true });
  w.tick({ ...body, ...pos, y: 10.5625 }, s);
  assert.equal(p.hasMoved, false, "the sleep tick: the C06 is not here yet");
  Object.assign(p, base, { sleeping: true });
  w.tick({ ...body, ...pos, y: 10.5625 }, s);
  assert.equal(p.hasMoved, true, "answered the next network tick");
  p.setLocation({ x: 1, y: 2, z: 3 }); // a correction's (processPlayer) or an arrival's: queued for the same network tick's packets
  assert.equal(p.answerFrom, 0);
});

test("one broken mount sends one S08 even when the client's link ends a tick after the network tick", () => {
  const ents = readFileSync(new URL("./entities.js", import.meta.url), "utf8"), ai = readFileSync(new URL("./ai.js", import.meta.url), "utf8");
  assert.match(ents, /p\.mount\.remounted && p\.brokenSent !== p\.mount/);
  assert.match(ai, /this\.mount\.remounted && this\.brokenSent !== this\.mount\) this\.brokenSeat/);
});
