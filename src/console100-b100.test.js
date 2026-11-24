// Batch 100 console100: /netstat counts of a tracked player. Executed sizes: public/research/console100-reference.json (tools/probes/Console100Probe.java, the real
// classes: S0C, S0A, S0B, S12, S1B, S20 of a sprint toggle, and the dirty set the real EntityPlayer constructor leaves).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLAY_FRAME, writePackets } from "./multiplayer/net-packet-ids.js";
import { ServerPlayerTracker } from "./multiplayer/server-player-tracker.js";
import { Effects } from "./status-effects.js";

const C = PLAY_FRAME.clientbound;
const ref = JSON.parse(readFileSync(new URL("../public/research/console100-reference.json", import.meta.url), "utf8"));
const at = (id) => ref.players.find((r) => r.entityId === id);
const tick = (players, ctx) => writePackets({ type: "tick", tick: 1, players }, ctx);
const ctx = () => ({ self: 1, peers: new Set([2]) });

test("executed sizes match the port's fixed packet table and the VarInt ids", () => {
  assert.equal(C[10], at(1).s0a);
  assert.equal(C[18], at(1).s12);
  assert.equal(C[27], at(1).s1bRide);
  assert.equal(at(1).s1bRide, at(1).s1bDismount);
  assert.equal(at(1).s12, at(1).s12Clamped);
  for (const id of [1, 200, 70000]) {
    const row = at(id);
    assert.equal(row.profileProperties, 0, "an offline-mode profile has no properties");
    assert.deepEqual(writePackets({ type: "sleepWake" }, { self: id }), [[11, row.s0b[1]]]);
    assert.deepEqual(writePackets({ type: "pfx73", events: [{ m: 0, pl: id }] }), [[11, row.s0b[2]]]);
    assert.deepEqual(row.s0b, [row.s0b[0], row.s0b[0], row.s0b[0], row.s0b[0]]);
  }
  assert.deepEqual(writePackets({ type: "pfx73", events: [{ m: 0, i: 300 }] }), [[11, 3]], "a mob target keeps the flat size");
  assert.equal(at(1).sprintOn.bytes, 41 + 25);
});

test("a swing is an S0B(0) for every tracker but the swinger, an S12 for the trackers and himself", () => {
  const swing = tick([{ id: 1, name: "me", swing: 6 }, { id: 2, name: "a", pk: [], swing: 6 }, { id: 3, name: "b", pk: [], swing: 5 }], ctx());
  assert.deepEqual(swing.filter(([i]) => i === 11), [[11, at(1).s0b[0]]]);
  const vel = tick([{ id: 1, name: "me", vel: { x: 0.1, y: 0.4, z: 0 } }, { id: 2, name: "a", pk: [], velSent: true }], ctx());
  assert.deepEqual(vel.filter(([i]) => i === 18), [[18, at(1).s12], [18, at(1).s12]]);
});

const world = () => {
  const players = new Map(), host = { players, ticks: 0, rules: { trackerLimit: 144 } };
  const mk = (id, x) => ({ id, name: `p${id}`, dimension: 0, position: { x, y: 64, z: 0 }, yaw: 0, pitch: 0, grounded: true, input: {}, motion: {}, survival: { health: 20, air: 300, effects: new Effects(), inventory: { armor: [null, null, null, null] } } });
  players.set(1, mk(1, 0)); players.set(2, mk(2, 10));
  const tr = new ServerPlayerTracker(host);
  const step = (t) => { host.ticks = t; const tracked = tr.update(0, {}); return tr.rowsFor(1, [{ id: 1, name: "p1" }, { id: 2, name: "p2" }], tracked.get(1), 0); };
  return { players, tr, step };
};
const pw = (rows, id) => rows.find((r) => r.id === id).pw ?? [];

test("a joining player's first gated pass sends the movementSpeed the constructor left dirty, to his viewers and to himself", () => {
  const { step } = world();
  const first = step(0);
  assert.deepEqual(pw(first, 2), [[32, ref.real.first.bytes]]);
  assert.deepEqual(pw(first, 1), [[32, ref.real.first.bytes]]);
  assert.equal(ref.real.first.bytes, 41);
  for (let t = 1; t < 6; t++) { const rows = step(t); assert.deepEqual(pw(rows, 2), []); assert.deepEqual(pw(rows, 1), []); }
});

test("the dirty set waits for the gate: an attribute-only change goes out on the next even tick", () => {
  const { players, step } = world();
  for (let t = 0; t < 6; t++) step(t);
  const p2 = players.get(2);
  p2.survival.effects.add({ id: 1, duration: 600, amplifier: 0 }); // Speed I: potion colour changes, the gate opens at once
  assert.deepEqual(pw(step(6), 2).map(([i]) => i), [28, 32]);
  p2.survival.effects.add({ id: 1, duration: 600, amplifier: 1 }); // Speed II: same colour, only the modifier changes
  assert.deepEqual(pw(step(7), 2), [], "an odd tick with nothing else changed sends nothing");
  assert.deepEqual(pw(step(8), 2), [[32, 9 + 32 + 25]]);
  assert.deepEqual(pw(step(9), 2), []);
});
