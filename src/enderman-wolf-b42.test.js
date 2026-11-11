import test from "node:test";
import assert from "node:assert/strict";
import { replayEndermanWolf, reference42 as reference, firstDivergence, comparedTicks } from "./enderman-wolf-replay.js";

// enderman-wolf-b42-reference.json: EndermanWolfProbe, a real EntityPlayerMP: enderman gaze, stare timer, anger and teleports; wolf targets (sheep, revenge, call for help, owner hurt/hit).
for (const r of reference.records) {
  test(`enderman/wolf b42: ${r.name} replays with no divergence`, () => {
    assert.equal(firstDivergence(r, replayEndermanWolf(r)), null, r.name);
  });
}

test("enderman/wolf b42: the compared windows keep covering the stare, anger and revenge decisions", () => {
  let compared = 0;
  for (const r of reference.records) compared += comparedTicks(r, replayEndermanWolf(r));
  assert.ok(compared >= 2800, `compared ${compared} ticks`); // of 11270 recorded; the rest is open work (mob wandering and chase timing), see public/research/enderman.md
});
