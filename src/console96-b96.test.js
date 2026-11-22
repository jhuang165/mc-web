// Batch 96 console96: /netstat counts the S0C (and what follows it) when a player enters a viewer's tracked set, and a tracked player's per-tick packets are the entry's own
// (S15 / S16 / S17 / S18 / S19), not one S18 per row per tick; far rows count nothing. Executed: public/research/console96-reference.json (tools/probes/Console96Probe.java).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLAY_FRAME, writePackets } from "./multiplayer/net-packet-ids.js";
import { ServerPlayerTracker } from "./multiplayer/server-player-tracker.js";

const C = PLAY_FRAME.clientbound;
const ref = JSON.parse(readFileSync(new URL("../public/research/console96-reference.json", import.meta.url), "utf8"));
const tick = (players, ctx) => writePackets({ type: "tick", tick: 1, players }, ctx);
const ids = (r) => r.map(([id]) => id);

test("executed S0C sizes: 87 + the id VarInt + the name string, whatever the held item", () => {
  for (const r of ref.s0c) assert.equal(r.bytes, 87 + 1 + 1 + Buffer.byteLength(r.name), r.name);
  const [s0c] = tick([{ id: 2, name: "Steve", pk: [] }], { self: 1, peers: new Set() });
  assert.deepEqual(s0c, [12, ref.s0c.find((r) => r.name === "Steve").bytes]);
  assert.equal(tick([{ id: 200, name: "Steve", pk: [] }], { self: 1, peers: new Set() })[0][1], 95, "a two byte entity id");
});

test("a player entering the set counts S0C, the whole S1C, S20, then what his state adds, once", () => {
  const f = ref.follow[0], peers = new Set(), ctx = { self: 1, peers };
  const row = { id: 2, name: "Steve", pk: [] };
  assert.deepEqual(tick([row], ctx), [[12, 94], [28, f.s1cWhole], [32, f.s20]]);
  assert.deepEqual(tick([row], ctx), [], "already tracked: nothing on an off beat tick");
  const all = tick([row, { id: 3, name: "Steve", pk: [], sprinting: true, riding: 9, held: { id: 267, count: 1, damage: 0 }, sleep: [0, 0, 0, 0], invisible: true }], ctx);
  assert.deepEqual(all, [[12, 94], [28, f.s1cWhole], [32, f.s20Sprint], [27, f.s1bAttach], [4, f.s04Sword], [10, C[10]], [29, f.s1d]]);
  assert.deepEqual(tick([{ id: 4, name: "Steve", far: true }], ctx).filter(([i]) => i !== 19), [], "a far row never spawns");
});

test("a tick counts the packets the entry sent, only for tracked rows", () => {
  const ctx = { self: 1 };
  assert.deepEqual(tick([{ id: 2, name: "a", pk: [] }, { id: 3, name: "b", far: true }, { id: 1, name: "me", pk: ["teleport"] }], ctx), [], "off beat, far and self: nothing");
  assert.deepEqual(tick([{ id: 2, name: "a", pk: ["moveLook", "head"] }, { id: 3, name: "b", pk: ["move"] }, { id: 4, name: "c", pk: ["teleport"] }, { id: 5, name: "d", pk: ["look"] }], ctx),
    [[23, C[23]], [25, C[25]], [21, C[21]], [24, C[24]], [22, C[22]]]);
  assert.deepEqual(ids(tick([{ id: 2, name: "a" }], ctx)), [24], "a row from a caller without the tracker keeps one S18");
});

test("the tracker rows carry the entry's kinds: still player, then a resync teleport", () => {
  const players = new Map(), host = { players, ticks: 0, rules: { trackerLimit: 144 } };
  const mk = (id, x) => ({ id, name: `p${id}`, dimension: 0, position: { x, y: 64, z: 0 }, yaw: 0, pitch: 0, grounded: true, input: {}, motion: {}, survival: {} });
  players.set(1, mk(1, 0)); players.set(2, mk(2, 10));
  const tr = new ServerPlayerTracker(host);
  const seen = [], rowsOf = () => {
    const key = {}, tracked = tr.update(0, key), rows = [{ id: 1, name: "p1" }, { id: 2, name: "p2" }];
    return tr.rowsFor(1, rows, tracked.get(1), 0).find((r) => r.id === 2);
  };
  for (let t = 0; t < 2000; t++) { host.ticks = t; seen.push(rowsOf()); }
  assert.ok(seen.every((r) => Array.isArray(r.pk)), "every tracked tick carries pk");
  const sent = seen.flatMap((r, t) => r.pk.map((k) => [t, k]));
  assert.ok(sent.length > 0 && sent.length < 60, `a standing player sends few packets in 2000 ticks, got ${sent.length}`);
  assert.ok(sent.filter(([, k]) => k === "teleport").length >= 2, "teleports once the entry's beat counter passes 400 (every 2nd tick: about every 800 ticks)");
});
