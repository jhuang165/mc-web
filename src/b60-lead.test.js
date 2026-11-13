// Batch 60 lead: the wiring added at merge between the window tracks and server-achievements.js (mpcommands2).
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { makeStack } from "./inventory.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { craftedAchievement, ITEM } from "./achievements-live.js";

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
function fixture() {
  const world = new World("lead-b60");
  for (let x = 56; x <= 72; x++) for (let z = 52; z <= 70; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival" });
  const p = s.addPlayer("alice", "Alice", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 });
  return { s, p };
}
const awards = s => (s.events ?? []).filter(e => e.type === "award").map(e => [e.id, e.achievement]);
const TABLE = ITEM.craftingTable; // the port id

test("a workbench result taken on the server awards its crafting achievement", () => {
  const { s, p } = fixture();
  const a = craftedAchievement(TABLE);
  assert.ok(a);
  s.containers.stations.crafted(p, makeStack(TABLE, 1), 1);
  assert.deepEqual(awards(s), [[p.id, a]]);
});

test("the window 0 (2x2 grid) result taken on the server awards its crafting achievement", () => {
  const { s, p } = fixture();
  const win = s.serverItems.inv.win(p);
  win.container.onCraft(makeStack(TABLE, 1), 1);
  assert.deepEqual(awards(s), [[p.id, craftedAchievement(TABLE)]]);
});
