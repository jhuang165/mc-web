// b102 horse102: every native S08 (nh.a(DDDFF), bytecode-read) carries yaw/pitch, is answered by one C06, is counted by /netstat, and nh.a(jd) ignores movement packets until that C06.
import test from "node:test";
import assert from "node:assert/strict";
import { DedicatedClient } from "./multiplayer/client.js";
import { sendPosLook, ackPosLook, expectPosLook, awaitingPosLook } from "./multiplayer/server-pos-look.js";
import { readPackets, writePackets } from "./multiplayer/net-packet-ids.js";
import { makeSide } from "../tools/sweep-use75.mjs";

import { IDLE_INPUT as IDLE } from "./multiplayer/protocol.js";
const msg = (yaw, pitch) => ({ type: "input", controls: { ...IDLE }, yaw, pitch, current: 0, hotbar: Array(9).fill(null) });

test("sendPosLook queues an S08 with the player's yaw and pitch and expects one reply", () => {
  const { s, p } = makeSide();
  p.yaw = 2; p.pitch = 0.3; p.dimOut = null;
  sendPosLook(s, p);
  const m = p.dimOut.find((q) => q.type === "posLook");
  assert.equal(m.yaw, 2); assert.equal(m.pitch, 0.3); assert.equal(m.x, p.position.x);
  assert.equal(p.s08.n, 1);
});

test("a stale input (older look) is ignored until the C06 arrives, then the next one applies", () => {
  const { s, p } = makeSide();
  p.yaw = 2; p.pitch = 0.3; sendPosLook(s, p);
  assert.ok(awaitingPosLook(s, p));
  assert.ok(s.input("a", msg(0.1, 0.0)));
  assert.equal(p.yaw, 2); assert.equal(p.pitch, 0.3);
  ackPosLook(p);
  assert.ok(!awaitingPosLook(s, p));
  s.input("a", msg(0.1, 0.0));
  assert.ok(Math.abs(p.yaw - 0.1) < 1e-6);
});

test("two S08 (a dismount) need two replies; a client that never answers is released after the wait", () => {
  const { s, p } = makeSide();
  expectPosLook(s, p, 2);
  ackPosLook(p); assert.ok(awaitingPosLook(s, p));
  ackPosLook(p); assert.ok(!awaitingPosLook(s, p));
  expectPosLook(s, p); s.ticks += 41;
  assert.ok(!awaitingPosLook(s, p));
});

test("the client applies the posLook look through playerOp look and answers with one C06", () => {
  const sent = [], ops = [];
  const c = new DedicatedClient({ onPlayerOp: (m) => ops.push(m) });
  c.send = (m) => sent.push(m); c.socket = {}; c.ready = true;
  c.apply({ type: "posLook", x: 1, y: 2, z: 3, yaw: 0.5, pitch: 0.1 });
  assert.deepEqual(ops[0].args, [0.5, 0.1]); assert.equal(ops[0].op, "look");
  assert.equal(sent.length, 1); assert.equal(sent[0].type, "posLookAck");
  assert.equal(readPackets(sent[0])[0][0], 6);
});

test("/netstat counts posLook, the join and the portal respawn as S08", () => {
  assert.deepEqual(writePackets({ type: "posLook", x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, {}).map((r) => r[0]), [8]);
  assert.ok(writePackets({ type: "welcome", world: { columns: [] } }, {}).some((r) => r[0] === 8));
  assert.ok(writePackets({ type: "dimRespawn", world: { columns: [] } }, {}).some((r) => r[0] === 8));
});
