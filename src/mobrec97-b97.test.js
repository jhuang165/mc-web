// Batch 97 mobrec97: executed mob records on the unchanged 1.7.10 classes.
//  - tools/probes/EndermanWolfProbe.java set b97mr (EndermanWolfScenarios.run97; `EW_SET=b97mr node tools/verify-endermanwolf.mjs` ->
//    public/research/enderman-wolf-b97mr-{,shears-}reference.json): 15 bat records, 7 count-0 shears records.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reference97, replayEndermanWolf, firstDivergence } from "./enderman-wolf-replay.js";
import { Survival } from "./survival.js";

const recs = reference97.records;
const src = (f) => readFileSync(new URL(f, import.meta.url), "utf8");

test("mobrec97: the b97mr references hold 22 executed records (bats, count-0 shears)", () => {
  assert.equal(recs.length, 22);
  assert.equal(recs.filter((r) => r.name.includes("-bat-")).length, 15);
  assert.equal(recs.filter((r) => /shears/.test(r.name)).length, 7);
});
for (const r of recs) {
  test(`mobrec97: ${r.name} replays with no divergence`, () => {
    assert.equal(JSON.stringify(firstDivergence(r, replayEndermanWolf(r))), "null", r.name);
  });
}
test("mobrec97 bat: collideWithNearbyEntities / collideWithEntity are empty in EntityBat, so the port bat tick pushes nothing (Executed b97mr-bat-glass-9714)", () => {
  const s = src("./squid-bat-mobs.js");
  assert.match(s, /EntityBat overrides collideWithNearbyEntities/);
  const at = s.indexOf("function batTick"), body = s.slice(at, s.indexOf("\nfunction ", at + 10));
  assert.ok(at > 0);
  assert.doesNotMatch(body, /m\.push\(e, t\)/);
});
test("mobrec97 shears: a broken stack stays as a size-0 stack in the hand (EntitySheep.interact returns false), keepEmpty 'held'", () => {
  const p = new Survival({ inventory: { 125: 1 } }), inv = p.inventory;
  inv.getStack(inv.find(125)).damage = 238;
  inv.current = inv.find(125);
  assert.equal(p.wear(125, 1, "held"), true);
  assert.deepEqual([inv.held.id, inv.held.count, inv.held.damage], [125, 0, 0]);
  const q = new Survival({ inventory: { 125: 1 } });
  q.inventory.getStack(q.inventory.find(125)).damage = 238;
  q.inventory.current = q.inventory.find(125);
  assert.equal(q.wear(125, 1), true);
  assert.equal(q.inventory.held, null);
});
test("mobrec97 shears: the sheep shear tests the held item id, not its count; a melee blow destroys the size-0 stack", () => {
  const s = src("./entities.js");
  assert.match(s, /survival\.inventory\.held\?\.id!==id&&!survival\.count\(id\)\)return false/);
  assert.match(s, /survival\.wear\(id,1,'held'\)/);
  assert.match(s, /hs\.count === 0 && !survival\.creative/);
});
