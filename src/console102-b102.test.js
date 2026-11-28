// Batch 102 console102: same-dimension respawn packet sequence, death S19(3) to trackers, exact swingProgressInt gate.
import test from "node:test";
import assert from "node:assert/strict";
import { PLAY_FRAME, writePackets } from "./multiplayer/net-packet-ids.js";
import { gateSwing } from "./multiplayer/server-swing.js";
import { Effects } from "./status-effects.js";

const C = PLAY_FRAME.clientbound;
const ids = (r) => r.map(([i]) => i);

test("a same-dimension respawn counts S39, S07, S08, S05, S1F, S03, S30, S2F, S1F", () => {
  const respawn = { rain: false }; Object.defineProperty(respawn, "slots", { value: new Array(45).fill(null), enumerable: false });
  assert.deepEqual(ids(writePackets({ type: "abilities", respawn }, {})), [57, 7, 8, 5, 31, 3, 48, 47, 31]);
  assert.deepEqual(ids(writePackets({ type: "abilities", respawn: { ...respawn, rain: true } }, {})).slice(5, 9), [3, 43, 43, 43]);
  assert.deepEqual(ids(writePackets({ type: "abilities" }, {})), [57]);
});

test("death S19(3) reaches trackers and the victim counts two S19 for hurt plus death", () => {
  const r = writePackets({ type: "tick", tick: 1, players: [{ id: 1, name: "me" }, { id: 2, name: "a", pk: [], hurt: true, died: true }] }, { self: 1, peers: new Set([2]) });
  assert.equal(r.filter(([i]) => i === 26).length, 2);
  assert.equal(writePackets({ type: "healthHurt", hurt: true, die: true }, {}).length, 2);
  assert.equal(writePackets({ type: "healthHurt", die: true }, {}).length, 1);
});

test("the swing gate follows swingProgressInt exactly, Mining Fatigue III included", () => {
  const run = (effects, n) => {
    const q = gateSwing({ swing: 0, survival: { effects } }), taken = [];
    for (let t = 0; t < n; t++) { q.swingTick(); if (q.swing) q.swing--; const b = q.swingState.progress; q.swing = 6; if (q.swingState.progress === -1 && b !== -1) taken.push(t); }
    return taken;
  };
  assert.deepEqual(run(new Effects(), 12), [0, 4, 8]);
  const fatigue = new Effects(); fatigue.list = [{ id: 4, amplifier: 2 }]; fatigue.ordered = () => fatigue.list; // end 6 + 3 * 2 = 12
  assert.deepEqual(run({ ordered: () => [{ id: 4, amplifier: 2 }] }, 20), [0, 7, 14]);
});
