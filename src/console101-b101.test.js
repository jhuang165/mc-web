// Batch 101 console101: respawn replaces the tracker entry, hurt S19 and wake S0B reach trackers in /netstat, the swing gate of sv.ba.
import test from "node:test";
import assert from "node:assert/strict";
import { PLAY_FRAME, writePackets } from "./multiplayer/net-packet-ids.js";
import { ServerPlayerTracker } from "./multiplayer/server-player-tracker.js";
import { ServerSleep } from "./multiplayer/server-sleep.js";
import { gateSwing, swingEnd } from "./multiplayer/server-swing.js";
import { Effects } from "./status-effects.js";

const C = PLAY_FRAME.clientbound;
const tick = (players, ctx) => writePackets({ type: "tick", tick: 1, players }, ctx);

test("hurt S19 and wake S0B(2) rows count for trackers", () => {
  const r = tick([{ id: 1, name: "me" }, { id: 2, name: "a", pk: [], hurt: true }, { id: 3, name: "b", pk: [], woke: true }], { self: 1, peers: new Set([2, 3]) });
  assert.deepEqual(r.filter(([i]) => i === 25 || i === 11 || i === 26 || i === 10 || i === 11), [[26, C[26]], [11, 3]]);
  assert.equal(tick([{ id: 2, name: "a", pk: [] }], { self: 1, peers: new Set([2]) }).some(([i]) => i === 26 || i === 11), false);
});

test("the sleeper's wake-up row field lasts one tick", () => {
  const sim = { ticks: 5 }, sl = new ServerSleep(sim), p = { woke: {} };
  assert.equal(sl.field(p).woke, true);
  assert.equal(sl.field(p).woke, true);
  sim.ticks = 6;
  assert.equal(sl.field(p).woke, undefined);
  assert.equal(p.woke, null);
});

const world = () => {
  const players = new Map(), host = { players, ticks: 0, rules: { trackerLimit: 144 } };
  const mk = (id, x) => ({ id, name: `p${id}`, dimension: 0, position: { x, y: 64, z: 0 }, yaw: 0, pitch: 0, grounded: true, input: {}, motion: {}, survival: { health: 20, air: 300, effects: new Effects(), inventory: { armor: [null, null, null, null] } } });
  players.set(1, mk(1, 0)); players.set(2, mk(2, 10));
  const tr = new ServerPlayerTracker(host);
  const keys = new Map(), rows = [{ id: 1, name: "p1" }, { id: 2, name: "p2" }];
  const step = (t, viewer) => { host.ticks = t; const tracked = tr.update(0, keys.get(t) ?? keys.set(t, {}).get(t)); return tr.rowsFor(viewer, rows, tracked.get(viewer), 0); };
  return { tr, step };
};

test("a respawn gives trackers S13 and a new first pass, and the respawner his own spawns", () => {
  const { tr, step } = world();
  const peers1 = new Set(), peers2 = new Set();
  const run = (t) => {
    const a = tick(step(t, 1), { self: 1, peers: peers1 }), b = tick(step(t, 2), { self: 2, peers: peers2 });
    return { a, b };
  };
  run(0);
  const quiet = run(1);
  assert.equal(quiet.a.some(([i]) => i === 12 || i === 19), false);
  tr.respawned(2);
  const after = run(2);
  assert.deepEqual(after.a.filter(([i]) => i === 19 || i === 12).map(([i]) => i), [19, 12], "viewer 1: S13 of the old entry, S0C of the new one");
  assert.equal(after.a.some(([i]) => i === 28), true, "whole watcher S1C");
  assert.deepEqual(after.b.filter(([i]) => i === 19 || i === 12).map(([i]) => i), [12], "the respawner gets S0C of the others, no S13");
  const next = run(4);
  assert.equal(next.a.some(([i]) => i === 12 || i === 19), false);
  assert.equal(next.b.some(([i]) => i === 12 || i === 19), false);
});

test("the swing gate follows sv.ba: a repeat C0A is taken from the 4th tick on", () => {
  const accepted = [];
  const q = gateSwing({ swing: 0, survival: { effects: new Effects() } });
  for (let t = 0; t < 12; t++) { q.swingTick?.(); if (q.swing) q.swing--; const before = q.swing; q.swing = 6; if (q.swing === 6 && before !== 6) accepted.push(t); }
  assert.deepEqual(accepted, [0, 4, 8]);
  assert.equal(swingEnd(q), 6);
});
