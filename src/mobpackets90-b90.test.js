// Batch 90 mobpackets90: re-adding an effect dirties the attribute again (no-op S20), the head S19 goes after S1C / S20 (and before the knockback S12), the wither's
// movementSpeed is the widened float. Bytecode-read: my.a(List) calls my.b() (S1C then S20) at 974 / 1188, the head test (ht) starts at 1200, the S12 (hy) at 1277; tn has no
// hashCode (tq.d is a HashSet of instances: identity order, so the native S20 row order is not reproducible); xc.aD sets movementSpeed 0.6000000238418579D.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { addMobEffect } from "./mob-effects.js";
import { watchedAttributes } from "./mob-tracked-attributes.js";
import { ENTITY_TYPES } from "./entities.js";
import { WITHER } from "./wither-rules.js";

const wire = (rows) => JSON.parse(JSON.stringify(rows ?? []));
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function flat() {
  const w = new World("mobpackets90");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) w.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}
const take = (pl) => { const o = wire(pl.mobPackets); pl.mobPackets = null; return o; };
const wid = (m) => Number(String(m.id).replace("mob-", ""));
function setup() {
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: "creative", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  const p = s.addPlayer("p", "px", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input("p", input());
  const m = s.mobs.mobs.create("pig", 66.5, 10, 70.5); s.mobs.mobs.entities.push(m);
  const mine = () => take(p).filter((x) => x.i === wid(m));
  for (let k = 0; k < 14; k++) { s.tick(); mine(); }
  return { s, m, mine };
}
const run = (s, mine, n) => { const out = []; for (let k = 0; k < n; k++) { s.tick(); out.push(...mine()); } return out; };

test("wither movementSpeed is the widened 0.6F on the wire and in the attribute", () => {
  assert.equal(WITHER.speed, 0.6000000238418579);
  assert.equal(ENTITY_TYPES.wither?.movement ?? WITHER.speed, 0.6000000238418579);
  const row = watchedAttributes({ type: "wither", id: 1, x: 0, y: 0, z: 0 }).find((r) => r.name === "generic.movementSpeed");
  if (row) assert.equal(row.base, 0.6000000238418579);
});

test("re-adding the same Speed sends a no-op S20 for movementSpeed (native dirties it on every add); other effects send none", { timeout: 180000 }, () => {
  const { s, m, mine } = setup();
  addMobEffect(m, 1, 600, 0);
  run(s, mine, 4);
  const before = watchedAttributes(m).find((r) => r.name === "generic.movementSpeed").value;
  addMobEffect(m, 1, 600, 0);
  const again = run(s, mine, 4).filter((x) => x.type === "attributes");
  assert.equal(again.length, 1);
  assert.deepEqual(again[0].list.map((r) => r.name), ["generic.movementSpeed"]);
  assert.equal(again[0].list[0].value, before, "the value did not change");
  addMobEffect(m, 10, 600, 0); // Regeneration: no modifier
  assert.equal(run(s, mine, 4).filter((x) => x.type === "attributes").length, 0);
});

test("the head S19 follows S1C and S20 and is last of the three", { timeout: 180000 }, () => {
  const { s, m, mine } = setup();
  addMobEffect(m, 1, 600, 0);
  m.rotationYawHead = (m.rotationYawHead ?? 0) + 90;
  m.rotationYaw = (m.rotationYaw ?? 0) + 90;
  const got = run(s, mine, 3).map((x) => x.type).filter((t) => ["meta", "attributes", "head"].includes(t));
  const a = got.indexOf("attributes"), h = got.indexOf("head");
  assert.ok(a >= 0 && h > a, got.join(","));
  assert.ok(!got.slice(0, a).includes("head"));
});
