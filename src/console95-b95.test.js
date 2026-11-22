// Batch 95 console95: another player's removal is the one S13 that is not queued (EntityPlayerMP.func_152339_d sends it at once for a player entity, queues every other id), executed in
// public/research/console95-reference.json (tools/probes/Console95Probe.java) and counted in the tick message that stops carrying his full row.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLAY_FRAME, writePackets, drainDestroyed } from "./multiplayer/net-packet-ids.js";

const C = PLAY_FRAME.clientbound;
const ref = JSON.parse(readFileSync(new URL("../public/research/console95-reference.json", import.meta.url), "utf8"));
const rows = (...ids) => ids.map((id) => ({ id, name: `p${id}` }));
const s13 = (r) => r.filter(([id]) => id === 19);

test("executed reference: a player id sends one 6 byte S13 at once, a pig id is queued and sends nothing", () => {
  const pig = ref.removed.find((r) => r.entity === "pig"), player = ref.removed.find((r) => r.entity === "player");
  assert.deepEqual([pig.queued, pig.packets], [1, 0]);
  assert.deepEqual([player.queued, player.packets, player.sent], [0, 1, "hq:6"]);
  assert.equal(C[19] + 4, 6);
  assert.equal(ref.s13[0].bytes, 6);
});

test("a tracked player who leaves the tracked set costs one immediate S13, never the queue", () => {
  const q = { n: 0, next: 0 }, peers = new Set(), ctx = { self: 1, peers, destroyed: q };
  assert.deepEqual(s13(writePackets({ type: "tick", players: rows(1, 2, 3) }, ctx)), []); // both enter: no S13
  assert.deepEqual([...peers].sort(), [2, 3]);
  const gone = writePackets({ type: "tick", players: [rows(1)[0], { id: 2, name: "p2", far: true }, rows(3)[0]] }, ctx);
  assert.deepEqual(s13(gone), [[19, 6]], "player 2 turned far: S13 now");
  assert.deepEqual([q.n, q.next], [0, 0], "nothing waits for the player's drain");
  assert.deepEqual(drainDestroyed(q), []);
  const left = writePackets({ type: "tick", players: rows(1) }, ctx); // player 3 disconnected
  assert.deepEqual(s13(left), [[19, 6]]);
  assert.deepEqual(s13(writePackets({ type: "tick", players: rows(1) }, ctx)), [], "counted once");
});

test("two players leaving in one tick are two packets; without a peer set nothing is counted", () => {
  const ctx = { self: 1, peers: new Set([2, 3]) };
  assert.equal(s13(writePackets({ type: "tick", players: rows(1) }, ctx)).length, 2);
  assert.deepEqual(s13(writePackets({ type: "tick", players: rows(1) }, { self: 1 })), []);
});

test("a mob's removal stays queued while a player's is immediate in the same tick", () => {
  const q = { n: 0, next: 0 }, ctx = { self: 1, peers: new Set([2]), destroyed: q };
  const out = [...writePackets({ type: "mobs", packets: [{ type: "destroy", i: 9 }] }, ctx), ...writePackets({ type: "tick", players: rows(1) }, ctx)];
  assert.deepEqual(s13(out), [[19, 6]]);
  assert.deepEqual(drainDestroyed(q), [[19, 6]]);
});
