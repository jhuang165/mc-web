// Batch 84 mpplace84. (1) Every ItemBlock canPlace refusal (entity, occupied, *-support) is withheld from the block C08 (bje.a returns before it).
// (2) Lily pads: ItemBlock onItemUse refuses the lake bed, ItemLilyPad.onItemRightClick (aej, bytecode-read) places on the traced source water.
// (3) The dedicated placement collision tests only this player's dimension.
import test from "node:test";
import assert from "node:assert/strict";
import { World, WATER, LILY_PAD } from "./world.js";
import { makeStack } from "./inventory.js";
import { Survival, ITEMS } from "./survival.js";
import { dryPlace } from "./client-prediction.js";
import { clientWithholdsPlace, withheldReason } from "./right-click-swing.js";
import { useLilyPad } from "./lily-use.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });

test("withheldReason: entity, occupied and support refusals; not door, cocoa, empty-stack or build height", () => {
  for (const r of ["entity-collision", "player-collision", "occupied", "torch-support", "lily-support", "gate-support"]) assert.equal(withheldReason(r), true, r);
  for (const r of ["door-support", "door-side", "cocoa-support", "empty-stack", "invalid-position", "not-a-building-block", undefined]) assert.equal(withheldReason(r), false, String(r));
});

function pond() {
  const w = new World("mpplace84-pond");
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    for (let y = 9; y <= 16; y++) w.set(40 + dx, y, 40 + dz, 0, false, 0);
    w.set(40 + dx, 10, 40 + dz, 3, false, 0); w.set(40 + dx, 11, 40 + dz, WATER, false, 0);
  }
  return w;
}
const survivalOf = (id, n = 4) => new Survival({ slots: [makeStack(id, n)] });

test("lily pad: the lake bed click is refused with lily-support and withheld; the pad onto water above is placed; flowing water below refuses", () => {
  const w = pond(), survival = survivalOf(LILY_PAD);
  const bed = { block: [40, 10, 40], adjacent: [40, 11, 40], hit: [40.5, 11, 40.5] };
  const st = { world: w, survival, position: { x: 100.5, y: 60, z: 100.5 }, flowers: {}, yaw: 0 };
  assert.equal(dryPlace(st, { id: LILY_PAD, item: ITEMS[LILY_PAD], target: bed }).result.reason, "lily-support");
  assert.equal(clientWithholdsPlace({ world: w, target: bed, held: survival.held, survival, position: st.position, yaw: 0, flowers: {} }), true);
  w.set(41, 12, 40, 1, false, 0); // a stone beside the surface: the cell above the water is placeable
  const side = { block: [41, 12, 40], adjacent: [40, 12, 40], hit: [41, 12.5, 40.5] };
  assert.equal(dryPlace(st, { id: LILY_PAD, item: ITEMS[LILY_PAD], target: side }).placed, true);
  w.set(40, 11, 40, WATER, false, 3);
  assert.equal(dryPlace(st, { id: LILY_PAD, item: ITEMS[LILY_PAD], target: { block: [40, 11, 40], adjacent: [40, 12, 40], hit: [40.5, 12, 40.5] } }).result.reason, "lily-support");
});

test("useLilyPad: traces the source water and places above it, costing one unless Creative; a miss, flowing water and a covered cell do nothing", () => {
  const w = pond(), survival = survivalOf(LILY_PAD, 2);
  const down = [0, -1, 0];
  assert.deepEqual(useLilyPad(w, survival, [40.5, 12.8, 40.5], down), [40, 12, 40]);
  assert.equal(w.get(40, 12, 40), LILY_PAD);
  assert.equal(survival.held.count, 1);
  assert.equal(useLilyPad(w, survival, [40.5, 12.8, 40.5], down), null, "the pad's own cell is no water: the trace hits the pad's cell above water, which is not water");
  w.set(42, 11, 40, WATER, false, 2);
  assert.equal(useLilyPad(w, survival, [42.5, 12.8, 40.5], down), null, "flowing water is no trace hit");
  assert.equal(survival.held.count, 1);
  assert.equal(useLilyPad(w, survival, [40.5, 20, 40.5], [0, 1, 0]), null);
  survival.mode = "creative";
  assert.deepEqual(useLilyPad(w, survival, [43.5, 12.8, 40.5], down), [43, 12, 40]);
  assert.equal(survival.held.count, 1, "Creative keeps the stack");
});

function placeSim() {
  const world = pond();
  world.spawn = () => ({ x: 40.5, y: 12, z: 40.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival" });
  const a = s.addPlayer("a", "ax", key(1)), o = s.addPlayer("o", "ox", key(2));
  a.position.copy({ x: 40.5, y: 12, z: 40.5 }); a.previous.copy(a.position); a.pitch = -Math.PI / 2; // a negative pitch looks straight down
  o.position.copy({ x: 60.5, y: 12, z: 60.5 }); o.previous.copy(o.position);
  s.input("a", input()); s.input("o", input());
  for (let i = 0; i < 3; i++) s.tick();
  return { s, world, a, o };
}

test("server: the C08 255 with a lily pad places on the water below; the block C08 on the lake bed places nothing", () => {
  const { s, world, a } = placeSim();
  a.pitch = -Math.PI / 2; a.moved = true;
  a.survival.inventory.main[0] = makeStack(LILY_PAD, 3); a.survival.inventory.current = 0;
  s.edit(a, true);
  assert.equal(world.get(40, 12, 40), 0, "the lake bed through the water: onItemUse refuses (lily-support)");
  s.edit(a, true, true);
  assert.equal(world.get(40, 12, 40), LILY_PAD);
  assert.equal(a.survival.held.count, 2);
});

function dimCase(dimension, sleeping) {
  const { s, world, a, o } = placeSim();
  a.pitch = -Math.PI / 2; a.moved = true;
  a.position.copy({ x: 42.5, y: 14, z: 42.5 }); a.previous.copy(a.position); // above the target, so the placer's own box is clear
  a.survival.inventory.main[0] = makeStack(1, 4); a.survival.inventory.current = 0;
  world.set(42, 11, 42, 1, false, 0); // the click lands on this stone; the stone goes into (42, 12, 42), where the other player stands
  o.position.copy({ x: 42.5, y: 12, z: 42.5 }); o.dimension = dimension; o.sleeping = sleeping;
  s.edit(a, true);
  return world.get(42, 12, 42);
}

test("server: a player in another dimension neither blocks a placement nor, asleep, adds a box; the same world's still do", () => {
  assert.equal(dimCase(0, false), 0, "a standing player in the same world refuses");
  assert.equal(dimCase(1, false), 1, "a Nether player's body does not refuse the Overworld placement");
  assert.equal(dimCase(0, true), 0, "a sleeper in the same world refuses");
  assert.equal(dimCase(1, true), 1, "a sleeper in the Nether does not");
});
