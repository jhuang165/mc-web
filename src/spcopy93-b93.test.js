// Batch 93 spcopy93: the single player's server copy across a portal trip, second pass.
// Executed: public/research/spcopy93-reference.jsonl (tools/probes/SpCopy93Probe.java: real ahb/oi/mt/mn/mq/my classes, distinct entity ids). No browser.
// This track changed no port behaviour; the tests pin the executed facts and the port state they were compared with.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { EntityWorld } from "./entities.js";
import { PlayerWatch } from "./entity-tracker.js";

const rows = readFileSync(new URL("../public/research/spcopy93-reference.jsonl", import.meta.url), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const by = Object.fromEntries(rows.map((r) => [r.case, r]));
const upd = (r) => r.portalTick.filter((o) => o.op === "update").map((o) => o.e);

test("distinct entity ids: the old list loses the player itself (batch 92's ids were all 0 and Entity.equals removed the first entry)", () => {
  assert.deepEqual(by.middle.srcBefore.loaded, ["b0", "b1", "player", "a0", "a1", "a2"]);
  assert.deepEqual(by.middle.srcAfter.loaded, ["b0", "b1", "a0", "a1", "a2"]);
  assert.deepEqual(by.middle.srcNextTick.filter((o) => o.op === "update").map((o) => o.e), ["b0", "b1", "a0", "a1", "a2"], "the old world never updates the player again");
  assert.ok(!upd(by.middle).includes("a0") && upd(by.middle).includes("a1"), "the skip batch 92 found holds with distinct ids");
  assert.ok(upd(by.endExit).includes("a0"), "End exit: no skip");
  assert.equal(by.endExit.isDeadAfter, true, "removeEntity leaves isDead set (no target survives); a transfer clears it");
  for (const c of ["middle", "first", "last", "only", "netherToOver"]) assert.equal(by[c].isDeadAfter, false, c);
});

test("chunk membership after the transfer: out of the departure chunk, listed in the old world's chunk at the scaled position", () => {
  for (const c of ["middle", "first", "last", "only", "netherToOver"]) {
    assert.deepEqual(by[c].srcDepartureChunkHolds, [], `${c}: ahb.f removed it from the chunk it stood in`);
    assert.ok(by[c].srcChunkOfPlayer.includes("player"), `${c}: transferEntityToWorld's updateEntityWithOptionalForce on the old world re-lists it at the scaled position`);
  }
  assert.deepEqual(by.endExit.srcChunkOfPlayer, [], "the End exit is removeEntity: no re-listing");
});

test("arrival: trackEntity sends nothing (the player is not in PlayerManager yet); the spawn goes with the chunk's S26", () => {
  for (const c of ["middle", "first", "last", "only"]) {
    const sent = by[c].dstFirstTick.find((o) => o.op === "chunkSent");
    assert.equal(sent.watchingWhilePending, false, `${c}: a chunk still in loadedChunks is not watched`);
    assert.equal(sent.watchingAfterSend, true);
    assert.equal(sent.spawnAttemptThrew, "IllegalArgumentException", `${c}: mn.a(mw, apx) tries the entity (the probe's entity class has no spawn packet)`);
    assert.ok(!by[c].portalTick.some((o) => o.op === "trackerThrew"), `${c}: no spawn attempt while tracking the arriving player`);
  }
});

test("port state the findings were compared with: no sent-chunk gate on the single-player tracker, and a left copy is not alive for held targets", () => {
  const watch = new PlayerWatch(10);
  assert.equal(watch.gate, undefined, "open: single player has no chunk stream (the dedicated server sets PlayerWatch.gate)");
  assert.equal(watch.watches(3, -2), true);
  const p = new EntityWorld(new World("spcopy93"), [], () => 0.5).ai.player;
  assert.equal(p.alive, true);
  p.left = true;
  assert.equal(p.alive, false, "open: natively isEntityAlive stays true after a transfer (isDead reset), the held target's distance is read at the arrival");
});
