// Batch 86 spcopy86: the integrated server's copy of the player (ai.js PlayerView, entities.js serverPlayerUpdate / processPlayer) follows NetHandlerPlayServer.processPlayer
// (nh.a(jd), bytecode-read) without b85's shortcuts: the packet is processed in the network tick after the world's entities (mobs read the accepted position), there is no 10-block
// teleport guard and no `packetGround` gate, and nh.r (hasMoved) waits for the client's C06 answer to an S08, resending it every 20th network tick. The server-side moves
// (/tp, the ender pearl, the bed wake) are setPlayerLocation. Rubber-banding is only visible in a browser, so the walks below run the real client physics (player-physics.js
// movePlayer, the code main.js runs) into the copy and require that no S08 ever answers.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, LADDER, WATER, STONE_SLAB } from "./world.js";
import { Survival } from "./survival.js";
import { EntityWorld } from "./entities.js";
import { movePlayer } from "./player-physics.js";
import { vector } from "./player-physics-fixture.js";
import { PlayerMotion } from "./player-movement.js";
import { awaitedAnswer } from "./server-process-player.js";

const STONE = 1;
const flat = (name) => {
  const world = new World(name);
  for (let x = 30; x <= 50; x++) for (let z = 26; z <= 54; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? STONE : 0, 0, false);
  return world;
};
const body = { alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
function host(name, build, at = { x: 40.5, y: 10, z: 48.5 }) {
  const world = flat(name); build?.(world);
  const w = new EntityWorld(world, [], () => 0.5), s = new Survival({});
  const fixes = [];
  w.serverCorrect = (to) => fixes.push({ ...to }); // the S08 (main.js puts the client there)
  const state = { world, position: vector(at.x, at.y, at.z), previous: vector(at.x, at.y, at.z), velocity: vector(0, 0, 0), motion: new PlayerMotion(), grounded: true, collidedH: false,
    flying: false, fallDistance: 0, landedFall: 0, yaw: 0, survival: { creative: false, food: 20, exhaustion: 0, exhaust(n) { this.exhaustion += n; } }, eating: null };
  const p = w.ai.player;
  // One game tick as main.js runs it: the client moves (movePlayer), then the integrated server ticks with the C03 flags (living-simulation.js).
  const step = (controls = {}, { trail = true } = {}) => {
    const c = { forward: 0, strafe: 0, sneak: false, sprint: false, jump: false, ...controls };
    movePlayer(state, c);
    Object.assign(p, { sneaking: !!c.sneak, flying: false, riding: false, packetGround: !!state.grounded, sprinting: !!state.motion.sprinting, yaw: state.yaw });
    w.tick({ ...body, x: state.position.x, y: state.position.y, z: state.position.z }, s);
    const d = (p.x - state.position.x) ** 2 + (p.y - state.position.y) ** 2 + (p.z - state.position.z) ** 2;
    if (trail) assert.ok(d <= 9.0E-4 + 1e-9, `the copy trails the client by at most the C03 threshold (${d})`);
  };
  for (let i = 0; i < 3; i++) step();
  return { w, s, p, state, step, fixes };
}
const clean = (h, what) => {
  assert.equal(h.p.corrected ?? 0, 0, `${what}: no setPlayerLocation`);
  assert.equal(h.fixes.length, 0, `${what}: no S08 reached the client`);
  assert.equal(h.p.hasMoved, true);
};

test("an ordinary walk, sprint, jump and sprint-jump: no correction", () => {
  const h = host("spcopy86-walk");
  for (let i = 0; i < 20; i++) h.step({ forward: 1 });
  for (let i = 0; i < 10; i++) h.step();
  assert.ok(h.state.position.z < 46, "walked");
  clean(h, "walk");
  const r = host("spcopy86-sprint");
  for (let i = 0; i < 25; i++) r.step({ forward: 1, sprint: true });
  assert.ok(r.state.motion.sprinting || r.state.position.z < 42, "sprinted");
  let top = 0, jumps = 0;
  const air = () => { top = Math.max(top, r.state.position.y); if (r.p.motion.y > 0.3) jumps++; };
  for (let i = 0; i < 12; i++) { r.step({ forward: 1, sprint: true, jump: true }); air(); } // sprint-jumping: the copy's jump rule (mw.bj with the sprint push) runs on each take-off
  for (let i = 0; i < 6; i++) { r.step({ jump: true }); air(); } // jumping in place
  for (let i = 0; i < 20; i++) r.step();
  assert.ok(top > 11 && jumps >= 2, `jumped (${top}, ${jumps} take-offs on the copy)`);
  assert.ok(r.state.position.z < 38);
  clean(r, "sprint and jump");
});

test("a fall off a ledge and a long drop: no correction", () => {
  // A 4-high platform the walk leaves at z = 43.
  const h = host("spcopy86-fall", (world) => { for (let x = 30; x <= 50; x++) for (let z = 44; z <= 54; z++) for (let y = 10; y <= 13; y++) world.put(x, y, z, STONE, 0, false); }, { x: 40.5, y: 14, z: 48.5 });
  for (let i = 0; i < 40; i++) h.step({ forward: 1 });
  assert.ok(h.state.position.y < 10.01 && h.state.grounded, "fell to the floor");
  clean(h, "ledge");
  const d = host("spcopy86-drop", (world) => { for (let x = 30; x <= 50; x++) for (let z = 26; z <= 54; z++) world.put(x, 22, z, STONE, 0, false); }, { x: 40.5, y: 23, z: 40.5 });
  d.w.world.put(40, 22, 40, 0, 0, false); // a hole: a 13-block drop
  for (let i = 0; i < 40; i++) d.step();
  assert.ok(d.state.position.y < 10.01);
  clean(d, "drop");
});

test("slabs climbed with the client's 0.5 step, a wall walked into and slid along, a sneak to an edge: no correction", () => {
  const h = host("spcopy86-steps", (world) => {
    for (let x = 30; x <= 50; x++) {
      world.put(x, 10, 45, STONE_SLAB, 0, false);
      for (let z = 30; z <= 44; z++) world.put(x, 10, z, STONE, 0, false);
      for (let z = 30; z <= 43; z++) world.put(x, 11, z, STONE_SLAB, 0, false);
      for (let y = 11; y <= 14; y++) world.put(x, y, 34, STONE, 0, false); // the wall
    }
  });
  for (let i = 0; i < 70; i++) h.step({ forward: 1 });
  assert.ok(h.state.position.y > 11.4, "on the upper slabs");
  assert.ok(h.state.collidedH, "against the wall");
  for (let i = 0; i < 20; i++) h.step({ forward: 1, strafe: 1 }); // sliding along it
  clean(h, "steps and wall");
  const e = host("spcopy86-edge", (world) => { for (let x = 30; x <= 50; x++) for (let z = 26; z <= 44; z++) world.put(x, 9, z, 0, 0, false); });
  for (let i = 0; i < 40; i++) e.step({ forward: 1, sneak: true });
  assert.ok(e.state.position.z > 44.5 && e.state.grounded, "the sneak edge held the client");
  clean(e, "sneak edge");
});

test("a ladder climb and a swim: no correction", () => {
  const h = host("spcopy86-ladder", (world) => { for (let y = 10; y <= 20; y++) { world.put(40, y, 39, STONE, 0, false); world.put(40, y, 40, LADDER, 3, false); } }, { x: 40.5, y: 10, z: 40.65 });
  for (let i = 0; i < 40; i++) h.step({ forward: 1 });
  assert.ok(h.state.position.y > 14, "climbed");
  for (let i = 0; i < 10; i++) h.step({ sneak: true }); // holding on
  for (let i = 0; i < 30; i++) h.step(); // sliding down
  clean(h, "ladder");
  const s = host("spcopy86-swim", (world) => { for (let x = 36; x <= 44; x++) for (let z = 36; z <= 44; z++) for (let y = 10; y <= 12; y++) world.put(x, y, z, WATER, 0, false); }, { x: 40.5, y: 10, z: 43.5 });
  for (let i = 0; i < 30; i++) s.step({ forward: 1, jump: i % 3 === 0 });
  clean(s, "swim");
});

test("the world tick's mobs read the accepted position; processPlayer moves the copy to the packet's in the network tick", () => {
  const h = host("spcopy86-order");
  const seen = [];
  h.w.afterEntities = () => seen.push(h.p.z); // World.updateEntities' tile pass: after every mob, before the network tick
  const before = h.p.z;
  h.step({ forward: 1 });
  h.step({ forward: 1 });
  assert.equal(seen[0], before, "the mobs of the tick the packet was sent saw the previous accepted position");
  assert.ok(seen[1] < before, "the next tick they see the one processPlayer accepted");
  assert.equal(h.p.z, h.p.sent.z, "after the network tick the copy is at the packet's position");
});

test("no packetGround gate: a caller that gives no packet flags still runs processPlayer (a packet into a wall answers with an S08)", () => {
  const world = flat("spcopy86-nogate"); for (let y = 10; y <= 12; y++) world.put(41, y, 43, STONE, 0, false);
  const w = new EntityWorld(world, [], () => 0.5), s = new Survival({}), client = { ...body, x: 40.5, y: 10, z: 43.5 };
  for (let i = 0; i < 3; i++) w.tick(client, s);
  const p = w.ai.player;
  assert.equal(p.packetGround, undefined);
  w.tick({ ...client, x: 41.0 }, s);
  assert.equal(p.corrected, 1);
  assert.equal(p.x, 40.5);
});

test("hasMoved (nh.r): after an S08 the copy ignores packets (no mw.i) until one gives the spot exactly, and resends every 20th network tick", () => {
  assert.equal(awaitedAnswer({ x: 1, y: 2.09, z: 3 }, { x: 1, y: 2, z: 3 }), true, "(y - p)^2 < 0.01");
  assert.equal(awaitedAnswer({ x: 1, y: 2.1, z: 3 }, { x: 1, y: 2, z: 3 }), false);
  assert.equal(awaitedAnswer({ x: 1.0000001, y: 2, z: 3 }, { x: 1, y: 2, z: 3 }), false, "x and z must be exact");
  assert.equal(awaitedAnswer(null, { x: 1, y: 2, z: 3 }), false, "a C03 without a position");
  const world = flat("spcopy86-hasmoved"); for (let y = 10; y <= 12; y++) world.put(41, y, 43, STONE, 0, false);
  const w = new EntityWorld(world, [], () => 0.5), s = new Survival({}), client = { ...body, x: 40.5, y: 10, z: 43.5 };
  for (let i = 0; i < 3; i++) w.tick(client, s);
  const p = w.ai.player; // no serverCorrect: no client takes the S08
  let moved = 0;
  w.serverCopyMoved = () => moved++;
  w.tick({ ...client, x: 41.0 }, s);
  assert.equal(p.corrected, 1);
  assert.equal(p.hasMoved, false);
  assert.equal(p.answer, null, "nobody answered");
  moved = 0;
  const sent = [];
  for (let i = 0; i < 45; i++) { const n = p.netTicks; const c = p.corrected; w.tick({ ...client, x: 40.7 + (i % 2) * 0.1 }, s); if (p.corrected > c) sent.push(n); }
  assert.equal(moved, 0, "an ignored packet runs no onUpdateEntity");
  assert.ok(sent.length >= 2 && sent.every((n) => n % 20 === 0), `resent at e % 20 == 0 (${sent})`);
  assert.equal(p.x, 40.5);
  w.tick({ ...client, x: 41.2 }, s); // the client's C03 keeps going out (its last reported spot is not reset), but not at o / q
  w.tick({ ...client, x: 40.5, y: 10.05 }, s); // the C06 answer: x and z exact, y within 0.1
  assert.equal(p.hasMoved, true);
  assert.equal(moved, 1, "processed again");
});

test("the host's answer: the C06 comes first in the next network tick, then the tick's own C03 from the corrected spot", () => {
  const world = flat("spcopy86-answer"); for (let y = 10; y <= 12; y++) world.put(41, y, 43, STONE, 0, false);
  const w = new EntityWorld(world, [], () => 0.5), s = new Survival({}), client = { ...body, x: 40.5, y: 10, z: 43.5 };
  for (let i = 0; i < 3; i++) w.tick(client, s);
  const p = w.ai.player, fixes = [];
  w.serverCorrect = (at) => fixes.push({ ...at });
  let moved = 0;
  w.serverCopyMoved = () => moved++;
  w.tick({ ...client, x: 41.0 }, s);
  assert.deepEqual(fixes, [{ x: 40.5, y: 10, z: 43.5 }]);
  assert.deepEqual(p.answer, { x: 40.5, y: 10, z: 43.5, onGround: false });
  moved = 0;
  w.tick({ ...client, x: 40.3 }, s); // the client walked on from where the S08 put it
  assert.equal(moved, 2, "two packets this network tick: the answer and the C03, each with its mw.i()");
  assert.equal(p.hasMoved, true);
  assert.equal(p.x, 40.3);
  assert.equal(p.corrected, 1);
});

test("server-side moves are setPlayerLocation: a /tp through a wall is kept, and the same jump as a client move is put back by the native checks", () => {
  const box = (world) => { for (let x = 30; x <= 50; x++) for (let y = 10; y <= 20; y++) world.put(x, y, 40, STONE, 0, false); }; // a wall between z 48 and z 32
  const raw = host("spcopy86-tp-raw", box);
  raw.state.position.set(40.5, 10, 32.5); // the client is moved with no setPlayerLocation
  raw.step({}, { trail: false });
  assert.equal(raw.p.corrected, 1, "mw.d clips at the wall: moved wrongly -> S08 back");
  const tp = host("spcopy86-tp", box);
  tp.state.position.set(40.5, 10, 32.5);
  tp.p.setLocation(tp.state.position); // main.js env.teleport: CommandTeleport -> setPlayerLocation, the client already there
  assert.equal(tp.p.z, 32.5, "the copy is moved at once");
  for (let i = 0; i < 10; i++) tp.step({ forward: 1 });
  clean(tp, "/tp");
  // A pearl landing inside the server tick: the C03 already in flight (from before) is dropped; the answer is processed in that network tick.
  const pearl = host("spcopy86-pearl", box);
  pearl.w.afterEntities = () => { pearl.state.position.set(40.5, 10, 32.5); pearl.p.setLocation({ x: 40.5, y: 10, z: 32.5 }); pearl.w.afterEntities = null; };
  pearl.step({ forward: 1 });
  for (let i = 0; i < 10; i++) pearl.step({ forward: 1 });
  clean(pearl, "pearl");
  const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(main, /fallDistance = 0; saved = false; mobs\?\.ai\?\.player\?\.setLocation\?\.\(position\);/, "/tp");
  assert.match(main, /mobs\?\.ai\?\.player\?\.setLocation\?\.\(to\); \/\/ b86 spcopy86: EntityEnderPearl/, "pearl");
  assert.match(main, /mobs\?\.ai\?\.player\?\.setLocation\?\.\(position\); \/\/ b86 spcopy86: wakeUpPlayer/, "bed wake");
});

test("the server places the copy itself while riding, on the dismount, asleep and for a `placed` harness", () => {
  const h = host("spcopy86-direct");
  const p = h.p;
  p.riding = true;
  p.update({ ...body, x: 44.5, y: 10, z: 44.5 }, h.s, 0);
  assert.equal(p.direct, true); assert.equal(p.x, 44.5, "the mount carries it");
  p.riding = false;
  p.update({ ...body, x: 46.5, y: 10, z: 44.5 }, h.s, 0);
  assert.equal(p.direct, true, "the dismount (mountEntity -> setPlayerLocation)"); assert.equal(p.x, 46.5);
  p.update({ ...body, x: 46.0, y: 10, z: 44.5 }, h.s, 0);
  assert.equal(p.direct, false); assert.equal(p.x, 46.5, "a walking packet waits for the network tick"); assert.deepEqual(p.packet, { x: 46.0, y: 10, z: 44.5 });
  p.placed = true;
  p.update({ ...body, x: 45.0, y: 10, z: 44.5 }, h.s, 0);
  assert.equal(p.direct, true); assert.equal(p.x, 45.0);
  const replay = readFileSync(new URL("./enderman-wolf-replay.js", import.meta.url), "utf8");
  assert.match(replay, /ew\.ai\.player\.placed = true;/);
});
