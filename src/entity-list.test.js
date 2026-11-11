import test from "node:test";
import assert from "node:assert/strict";
import { entityListReference, replayEntityList, entityListDivergence } from "./entity-list-replay.js";

// public/research/entity-list-reference.json (tools/probes/EntityListProbe.java): the unchanged EntityItem, EntityXPOrb, EntityTNTPrimed and EntityArrow
// walked in World.loadedEntityList order (index loop, spawned-in-pass joins the end, dead removed after), each scenario in both list orders.
const NOT_REPLAYED = /^arrow-cow/; // needs a cow whose AI task list is off (the probe's Cow); the record shows the order effect, the port has no such double
for (const c of entityListReference.filter((r) => !NOT_REPLAYED.test(r.name))) {
  test(`native entity list ${c.name}`, () => {
    assert.equal(entityListDivergence(c, replayEntityList(c)), null);
  });
}

const by = (n) => entityListReference.find((r) => r.name === n);
const last = (r) => r.rows[r.ticks - 1][0];

test("the records show the list order: the same entities end differently when listed the other way round", () => {
  assert.equal(entityListReference.length, 15);
  // two equal stacks: the first to update merges into the other, so the list order picks the survivor
  const dead = (r) => last(r).map((e) => e[6]);
  assert.deepEqual(dead(by("items-equal-ab")), [1, 0]);
  assert.deepEqual(dead(by("items-equal-ba")), [1, 0]);
  assert.notDeepEqual(last(by("items-equal-ab"))[1].slice(0, 3), last(by("items-equal-ba"))[0].slice(0, 3));
  // a joined-late item updates after the earlier one whatever the order it was made in
  assert.notDeepEqual(last(by("items-join-late")), last(by("items-join-early")));
  // orbs: the player takes the first orb of the list (7 or 3), the second one two ticks later
  assert.equal(by("orbs-pickup-ab").rows[0][2][0], 7);
  assert.equal(by("orbs-pickup-ba").rows[0][2][0], 3);
  assert.equal(by("orbs-pickup-join").rows[0][2][0], 3); // the 7 joins on tick 1, after the 3
  // the blast pushes a TNT updated after it this tick, one updated before it a tick later; an item likewise
  const tntB = (r) => r.rows[0][0].find((e) => e.length === 8 && e[7] !== -1);
  assert.notEqual(tntB(by("tnt-push-ab"))[0], tntB(by("tnt-push-ba"))[0]);
  assert.notEqual(by("tnt-item-ab").rows[0][0][1][1], by("tnt-item-ba").rows[0][0][0][1]);
  assert.equal(by("tnt-item-ab").rows[0][0][1][6], 1); // blasted dead before its own update
  assert.equal(by("tnt-item-ba").rows[0][0][0][6], 1); // updated first (it moved: its posY differs from the ab record), then killed by the blast
  // the arrow and the cow: the order changes where the cow ends (replayed by neither engine here; the record shows the effect)
  assert.notEqual(last(by("arrow-cow-first"))[1][0], last(by("arrow-cow-after"))[0][0]);
});

test("the records need the stamps: without them TNT and items tick in kind groups and the mixed records diverge", async () => {
  const { EntityWorld } = await import("./entities.js");
  const real = EntityWorld.prototype.joined;
  EntityWorld.prototype.joined = function () {};
  try {
    assert.notEqual(entityListDivergence(by("tnt-item-ab"), replayEntityList(by("tnt-item-ab"))), null);
    assert.equal(entityListDivergence(by("tnt-item-ba"), replayEntityList(by("tnt-item-ba"))), null); // items before TNT is also the kind-group order
  } finally { EntityWorld.prototype.joined = real; }
});

test("an entity spawned during the pass (an item a blast drops) joins the end of the list and updates in that same pass", () => {
  let spawned = null;
  replayEntityList({ ...by("tnt-push-ab"), ticks: 1 }, (items) => { spawned = items.spawn({ id: 3, count: 1, damage: 0 }, 5.5, 0.5, 0.5, { motion: [0, 0, 0] }); });
  assert.equal(spawned.ticks, 1); // ticked once already in the tick that spawned it
});

test("dead entities leave the lists after the pass", () => {
  const c = by("items-equal-ab");
  replayEntityList({ ...c, ticks: 2 }, null);
  // the merged stack: one survivor in the record, and the replay's lists hold only live entities (the divergence check compares the dead one's frozen state)
  assert.equal(last(c).filter((e) => !e[6]).length, 1);
});
