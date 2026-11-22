// Batch 95 spcopy95: the single player's server copy across a portal trip, third pass.
// Executed: public/research/spcopy95-reference.jsonl (tools/probes/SpCopy95Probe.java: real ahb/oi/mt/mn/mq classes). No browser.
// 1. The arrival is known before the old world's save point (dimension-live.js announceArrival) and held targets keep the copy at it.
// 2. The old world lists the copy in the chunk at the SCALED position (not the arrival's): PlayerView.listedIn.
// 3. The sent-column gate switch is set when the world launches, before its first tracker.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { DimensionWorld } from "./dimension-world.js";
import { DimensionLive, viewRecord } from "./dimension-live.js";
import { MobTracker } from "./entity-tracker.js";
import { newMobTracker, spGateConfig } from "./sp-chunk-gate.js";

const rows = readFileSync(new URL("../public/research/spcopy95-reference.jsonl", import.meta.url), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const by = Object.fromEntries(rows.map((r) => [r.case, r]));
const chunkOf = (v) => Math.floor(v) >> 4;
const flat = () => {
  const world = new World("spcopy95");
  for (let x = 0; x <= 80; x++) for (let z = 0; z <= 80; z++) for (let y = 0; y <= 8; y++) world.put(x, y, z, y === 0 ? 1 : 0, 0, false);
  return world;
};
const body = { alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };

test("executed: the old world lists the copy at the scaled chunk, not the arrival chunk; the End exit lists nothing", () => {
  for (const c of ["blockedWest", "blockedEast"]) {
    const r = by[c], scaled = [chunkOf(r.start[0] / 8), chunkOf(r.start[1] / 8)];
    assert.notDeepEqual(r.arrivalChunk, scaled, `${c}: the Teleporter built the portal in the next chunk`);
    assert.deepEqual(r.srcChunksHoldingPlayer, [scaled.join(",")], `${c}: the old world holds it at the scaled chunk`);
    assert.deepEqual(r.dstChunksHoldingPlayer, [r.arrivalChunk.join(",")], c);
  }
  assert.deepEqual(by.endExit.srcChunksHoldingPlayer, []);
  assert.deepEqual(by.originOverToNether.srcChunksHoldingPlayer, [], "scaled chunk = departure chunk: no re-listing (ag already true), so it stays out");
});

test("listedIn finds the copy only through the scaled chunk's list (ahb.b: chunks (min - 2) / 16 .. (max + 2) / 16)", () => {
  const p = new EntityWorld(flat(), [], () => 0.5).ai.player;
  p.x = 40.5; p.y = 64; p.z = 40.5;
  p.left = true;
  assert.equal(p.listedIn([18, 62, 4, 19, 64, 5]), false, "no arrival hint: not listed");
  p.depart({ x: 19, y: 64.5, z: 4, scaled: { x: 15, y: 64, z: 5 } }); // blockedWest: scaled chunk 0, arrival chunk 1
  assert.deepEqual([p.x, p.y, p.z], [19, 64.5, 4], "the copy reads as the arrival");
  assert.equal(p.listedIn([18.7, 64.5, 3.7, 19.3, 66.3, 4.3]), false, "a box at the arrival: chunk range 1..1 misses chunk 0");
  assert.equal(p.listedIn([13.9, 64.5, 3.7, 14.5, 66.3, 4.3]), true, "(14.5 + 2) / 16 reaches chunk 1 and (13.9 - 2) / 16 chunk 0");
  assert.equal(p.listedIn([18.0, 64.5, 3.7, 18.6, 66.3, 4.3]), false, "(18 - 2) / 16 = 1: chunk 1 only");
  assert.equal(p.listedIn([17.9, 64.5, 3.7, 18.5, 66.3, 4.3]), true, "(17.9 - 2) / 16 < 1: chunk 0 is in range");
  assert.equal(p.listedIn([17.9, 100, 3.7, 18.5, 101.8, 4.3]), false, "the Y slice of the old height (64 -> 4) is not in range");
  p.depart(null);
  assert.deepEqual([p.x, p.y, p.z], [40.5, 64, 40.5], "back where it was");
  p.left = false;
  assert.equal(p.listedIn([13.9, 64.5, 3.7, 14.5, 66.3, 4.3]), false);
});

test("a mob holding the copy as its target keeps it when the arrival is within follow range, drops it otherwise (isEntityAlive and distance, not membership)", () => {
  const run = (hint) => {
    const w = new EntityWorld(flat(), [{ id: "z1", type: "zombie", x: 36.5, y: 1, z: 40.5, health: 20 }], () => 0.5), z = w.entities[0], p = w.ai.player, s = new Survival({});
    w.serverCorrect = () => {};
    const state = { ...body, x: 40.5, y: 1, z: 40.5 };
    for (let i = 0; i < 3; i++) w.tick(state, s, 0);
    const brain = w.ai.brain(z);
    assert.equal(brain.attackTarget, p, "the zombie targets the player");
    p.left = true;
    if (hint) p.depart(hint);
    for (let i = 0; i < 3; i++) w.tick(state, s, 0);
    return brain.attackTarget;
  };
  assert.equal(run(null), null, "before the arrival is known (the old behaviour): dropped at once");
  const near = { x: 39.5, y: 1, z: 40.5, scaled: { x: 5, y: 64, z: 5 } };
  assert.ok(run(near) !== null, "an arrival 1 block from the zombie: still its target");
  assert.equal(run({ ...near, x: 500.5, z: 500.5 }), null, "an arrival beyond the follow range: dropped");
});

test("announceArrival: the Teleporter result before the save equals the one arrive computes, and the shared cache is untouched", async () => {
  const root = { id: "w95", seed: 1234, biome: "javaStreamed", chunked: true };
  const got = [];
  const host = { worlds: () => [root], active: () => root, ticks: () => 0, arrivalHint: (h) => got.push(h) };
  const dims = new DimensionLive(host);
  dims.readEdits = async () => [];
  dims.busy = true;
  const p = { x: 133.5, y: 64, z: 41.5, yaw: 0, motion: { x: 0, y: 0, z: 0 } };
  await dims.announceArrival(root, p, -1);
  assert.equal(got.length, 1);
  assert.equal(dims.exitCache.get("w95:-1")?.cache.size ?? 0, 0, "the real Teleporter run (arrive) owns the shared cache");
  assert.deepEqual(got[0].scaled, { x: 16, y: 64, z: 5 });
  const record = { ...viewRecord(root, -1), transit: { from: 0, x: p.x, y: p.y, z: p.z, yaw: p.yaw, dir: 0 } };
  await dims.arrive(new DimensionWorld(root.seed, -1), record, {});
  assert.deepEqual([got[0].x, got[0].y, got[0].z], [record.position.x, record.position.y, record.position.z], "same arrival");
  await dims.announceArrival(root, p, 0);
  assert.equal(got.length, 1, "Overworld destination: no preview (its terrain is built after the save)");
});

test("the sent-column gate switch is set when the world launches, before its first tracker (a tracker made in the first movement tick was ungated)", () => {
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  const launch = src.slice(src.indexOf("async function launch("));
  const on = launch.indexOf("spGateConfig.enabled = !active?.remote"), made = launch.indexOf("mobs = new EntityWorld(");
  assert.ok(on > 0 && on < made, "switched at launch before the new EntityWorld");
  spGateConfig.enabled = true;
  assert.ok(newMobTracker(MobTracker, 10).chunkGate, "a tracker made while switched on is gated");
  spGateConfig.enabled = false;
});
