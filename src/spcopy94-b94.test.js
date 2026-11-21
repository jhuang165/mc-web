// Batch 94 spcopy94: the single-player sent-column gate. Natively an entity is only started for a player whose PlayerManager holds the column as sent (isPlayerWatchingChunk); login
// and arrival queue the square and EntityPlayerMP.onUpdate sends the nearest five columns per tick in spiral order, each sent column re-testing its entities (func_85172_a).
import test from "node:test";
import assert from "node:assert/strict";
import { MobTracker } from "./entity-tracker.js";
import { ObjectTracker, OBJECT_KINDS } from "./object-tracker.js";
import { EntityIds } from "./entity-ids.js";
import { SpChunkGate } from "./sp-chunk-gate.js";
import { ChunkWatch } from "./multiplayer/server-chunk-view.js";

const player = { x: 0.5, y: 0, z: 0.5 };
const SIZE = () => [0.3, 0.7];
const grass = { numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, surface: () => 0 };
const chicken = (n, cx, cz) => ({ type: "chicken", id: "mob-" + n, uuid: "u" + n, x: cx * 16 + 3.5, y: 0, z: cz * 16 + 3.5, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 4, onGround: true });
const item = (id, cx, cz) => ({ entityId: id, x: cx * 16 + 3.5, y: 1 - OBJECT_KINDS.item.yOff, z: cz * 16 + 3.5, mx: 0, my: 0, mz: 0, rotationYaw: 0, stack: { id: 1, count: 1, damage: 0 }, onGround: true });
const gated = (m) => { m.setChunkGate(new SpChunkGate()); return m; };
const spiral = (r = 10) => new ChunkWatch(r, 0.5, 0.5).queue.map(([x, z]) => `${x},${z}`);

test("the gate sends five columns per tick in the native spiral, own column first", () => {
  const g = new SpChunkGate();
  assert.equal(g.sees(0, 0), true, "no view yet: nothing to gate");
  g.restart();
  assert.equal(g.sees(0, 0), false, "after a join nothing was sent");
  const order = spiral(), got = [];
  assert.equal(order.length, 441);
  assert.deepEqual(order.slice(0, 9), ["0,0", "1,0", "1,1", "0,1", "-1,1", "-1,0", "-1,-1", "0,-1", "1,-1"]);
  for (let t = 1; t <= 89; t++) {
    const sent = g.step(0.5, 0.5, 10).map(c => c.join(","));
    assert.equal(sent.length, t < 89 ? 5 : 1, "tick " + t);
    got.push(...sent);
    assert.equal(g.sees(0, 0), true);
  }
  assert.deepEqual(got, order);
  assert.deepEqual(g.step(0.5, 0.5, 10), [], "everything is sent");
  g.restart();
  assert.equal(g.sees(0, 0), false, "an arrival starts over");
});

test("an entity in an unsent column appears the tick its column is sent (arrival and login)", () => {
  const m = gated(new MobTracker(10)), order = spiral();
  m.beforePlayer = () => true; m.joinPlayer(40);
  const at = [[0, 0], [-1, 0], [2, -1], [4, 3], [-5, -5]]; // 80 blocks: the chicken's tracking range is 5 columns
  const mobs = at.map(([x, z], i) => chicken(i + 1, x, z));
  const seen = new Map();
  for (let t = 1; t <= 90; t++) {
    m.update(mobs, player, SIZE);
    for (const e of mobs) if (m.entries.get(e).entry.tracked && !seen.has(e.id)) seen.set(e.id, t);
  }
  at.forEach(([x, z], i) => {
    const idx = order.indexOf(`${x},${z}`), want = Math.floor(idx / 5) + 1, e = mobs[i];
    const inRange = Math.abs(x) <= 5 && Math.abs(z) <= 5;
    assert.equal(seen.get(e.id), inRange ? want : undefined, `column ${x},${z}`);
  });
  assert.equal(seen.get("mob-1"), 1);
  assert.equal(seen.get("mob-2"), 2);
});

test("an arrival (leaveWorld) queues the columns again; a spawn in a sent column shows at once", () => {
  const m = gated(new MobTracker(10)), a = chicken(1, 0, 0), far = chicken(2, 3, 3);
  m.beforePlayer = () => true; m.joinPlayer(40);
  for (let t = 0; t < 89; t++) m.update([a, far], player, SIZE);
  assert.ok(m.entries.get(far).entry.tracked);
  const late = chicken(3, 1, 1);
  m.update([a, far, late], player, SIZE);
  assert.ok(m.entries.get(late).entry.tracked, "its column was sent");
  m.leaveWorld(); // portal trip: the old world's tracker lets the player go
  m.update([a, far, late], player, SIZE); // the arrival pass
  assert.equal(m.entries.get(a).entry.tracked, true);
  assert.equal(m.entries.get(far).entry.tracked, false, "column 3,3 is not sent yet");
  assert.equal(m.entries.get(late).entry.tracked, true, "column 1,1 is the third of the spiral");
});

test("the object tracker shares the gate (joint pass)", () => {
  const m = gated(new MobTracker(10)), o = new ObjectTracker(10, () => 0.5, new EntityIds(1)), order = spiral();
  m.beforePlayer = () => false; m.joinPlayer(40);
  const near = item(101, 0, 0), far = item(102, 3, 2);
  let tickOfFar = 0;
  for (let t = 1; t <= 40; t++) {
    m.update([], player, SIZE, null, { tracker: o, lists: { item: [near, far] }, world: grass });
    if (t === 1) assert.equal(o.entries.get(near)?.entry.tracked, true);
    if (!tickOfFar && o.entries.get(far)?.entry.tracked) tickOfFar = t;
  }
  assert.equal(tickOfFar, Math.floor(order.indexOf("3,2") / 5) + 1);
  assert.ok(tickOfFar > 1);
});

test("without a gate every column of the square shows at the first pass (unit-test default, multiplayer replica)", () => {
  const m = new MobTracker(10), far = chicken(1, 4, 4);
  m.beforePlayer = () => true; m.joinPlayer(40);
  m.update([far], player, SIZE);
  assert.equal(m.entries.get(far).entry.tracked, true);
});
