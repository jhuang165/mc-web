// Batch 69 mpfixes69: pistons break hanging entities (EntityHanging.moveEntity), /summon tag coordinates map into the End window, spawn eggs and dispenser eggs ignore the mob cap,
// a sleeper's clicks and mob distances read posY. Facts: .shared-memory/notes/mpfixes69-b69-track.md (bytecode-read ss.g/ss.d, nh.a(ji)/nh.a(jo), sv.l, yz.a(III)). No sockets, no browser.
import test from "node:test";
import assert from "node:assert/strict";
import { World, REDSTONE_BLOCK } from "./world.js";
import { PISTON } from "./dispenser-piston.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial, chatDisplay } from "./server-broadcast.js";
import { langReady } from "./chat-component.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { MOB_LIMIT } from "./multiplayer/server-mobs.js";
import { useOnBlock } from "./multiplayer/server-use.js";
import { tagToLocal } from "./multiplayer/server-summon.js";
import { Hanging, PAINTING_ITEM, FRAME_ITEM } from "./hanging.js";
import { pistonPushExtras } from "./piston-push.js";
import { EntityWorld } from "./entities.js";
import { ITEM_SPAWN_EGG } from "./spawn-eggs.js";
import { aimOriginY, serverPosY } from "./sleeper-eye.js";
import { NBT } from "./nbt.js";

await langReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const OK = "Object successfully summoned";
function fixture(gameMode = "creative") {
  const world = new World("b69-mpfixes");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode }), inbox = {};
  sim.mobs.mobs.entities.length = 0;
  const social = new ServerSocial({ simulation: sim, ops: ["Alex"], deliver: (id, m) => (inbox[id] ??= []).push(m) });
  const p = sim.addPlayer("a", "Alex", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  const say = (line) => { inbox.a = []; social.command("a", line); return (inbox.a ?? []).filter((m) => m.type === "chat").map((m) => chatDisplay(m).unformatted()); };
  return { sim, p, say };
}

// ---- (1) pistons and hanging entities (the tile is the wall block: facing 0 puts the entity in the cell at tz + 1) ----
test("pistonPushExtras: a pushed painting, frame (with item) and knot break; a moved entity with zero delta does not", () => {
  const world = new World("b69-extras"), h = new Hanging({ ids: undefined });
  const painting = h.make("painting", 0, 10, 10, 10), frame = h.make("frame", 0, 12, 10, 10, { item: { id: 1, count: 1, damage: 0 } });
  h.entities.push(painting, frame);
  const mobs = new EntityWorld({ get: () => 0, getMeta: () => 0, solid: () => false }, [], () => 0.5);
  const knot = mobs.knotCreate(14, 10, 10);
  const extras = pistonPushExtras(world, { hanging: () => h, mobs: () => mobs });
  assert.equal(extras.length, 3);
  for (const x of extras) x.move(0, 0, 0);
  assert.ok(!painting.dead && !frame.dead && !knot.dead, "no motion, no break");
  for (const x of extras) x.move(0.0625, 0, 0);
  assert.ok(painting.dead && frame.dead && knot.dead);
  assert.equal(h.entities.length, 0);
  assert.deepEqual(mobs.knotList, []);
  const drops = h.drain();
  assert.deepEqual(drops.map((d) => d.stack.id).sort((a, b) => a - b), [1, PAINTING_ITEM, FRAME_ITEM].sort((a, b) => a - b));
});

test("server: an extending piston breaks a frame, a painting and a knot in the head cell and drops the items; one beyond the head is untouched", () => {
  const f = fixture("survival"), s = f.sim, hang = s.vehicles.hanging.h;
  const frame = hang.make("frame", 0, 61, 10, 63, { item: { id: 1, count: 1, damage: 0 } }), painting = hang.make("painting", 0, 61, 10, 63), far = hang.make("frame", 0, 80, 10, 64);
  hang.entities.push(frame, painting, far);
  const knot = s.mobs.mobs.knotCreate(61, 10, 64);
  s.world.put(60, 10, 64, PISTON, 5, false); s.world.put(60, 10, 63, REDSTONE_BLOCK, 0, false);
  s.redstone.notifyBlocksOfNeighborChange?.(60, 10, 63, 0);
  for (let i = 0; i < 6; i++) s.tick();
  assert.deepEqual([frame.dead, painting.dead, knot.dead], [true, true, true]);
  assert.ok(!far.dead);
  assert.deepEqual(hang.entities, [far]);
  const ids = s.items.items.map((i) => i.stack?.id ?? i.id).sort((a, b) => a - b);
  assert.deepEqual(ids, [1, PAINTING_ITEM, FRAME_ITEM].sort((a, b) => a - b), "painting item, frame item and the held item dropped");
});

// ---- (2) summon tag coordinates in the End ----
test("tagToLocal shifts TileX/TileZ, Leash X/Z and xTile/zTile by the origin and leaves the Overworld tag alone", () => {
  const num = (type, value) => ({ type, value });
  const tag = new Map([["TileX", num(NBT.INT, 100)], ["TileY", num(NBT.INT, 60)], ["TileZ", num(NBT.INT, 5)], ["xTile", num(NBT.SHORT, -1)], ["zTile", num(NBT.SHORT, 7)],
    ["Leash", num(NBT.COMPOUND, new Map([["X", num(NBT.INT, 10)], ["Y", num(NBT.INT, 64)], ["Z", num(NBT.INT, -3)]]))],
    ["Riding", num(NBT.COMPOUND, new Map([["TileX", num(NBT.INT, 1)]]))]]);
  assert.equal(tagToLocal(tag, 0, 0), tag);
  const out = tagToLocal(tag, -128, -128);
  assert.equal(out.get("TileX").value, 228); assert.equal(out.get("TileY").value, 60); assert.equal(out.get("TileZ").value, 133);
  assert.equal(out.get("xTile").value, -1, "unset stays unset"); assert.equal(out.get("zTile").value, 135);
  const l = out.get("Leash").value; assert.deepEqual([l.get("X").value, l.get("Y").value, l.get("Z").value], [138, 64, 125]);
  assert.equal(out.get("Riding").value.get("TileX").value, 129);
  assert.equal(tag.get("TileX").value, 100, "the original is not changed");
});

test("End: a summoned painting and a leashed mob take native tag coordinates", () => {
  const f = fixture(); f.sim.dimensions.arrive(f.p, 1);
  const end = f.sim.dimensions.end.n;
  end.mobs.mobs.entities.length = 0;
  assert.deepEqual(f.say('/summon Painting ~ ~ ~ {TileX:100,TileY:60,TileZ:0,Direction:0,Motive:"Kebab"}'), [OK]);
  const e = end.vehicles.hanging.h.entities[0];
  assert.deepEqual([e.tx, e.ty, e.tz], [228, 60, 128], "native (100, 0) is stored cell (228, 128)");
  assert.deepEqual(f.say("/summon Pig ~ ~ ~ {Leashed:1b,Leash:{X:100,Y:60,Z:0}}"), [OK]);
  const pig = end.mobs.mobs.entities.find((m) => m.type === "pig");
  assert.deepEqual([pig.leash?.knot?.x, pig.leash?.knot?.y, pig.leash?.knot?.z], [228, 60, 128]);
});

// ---- (3) eggs ignore the mob cap ----
function fill(f, n) { for (let i = 0; i < n; i++) f.sim.mobs.mobs.entities.push(f.sim.mobs.mobs.create("pig", 45.5 + (i % 20), 10, 45.5 + Math.floor(i / 20))); }
test("a spawn egg used on a block creates the mob past MOB_LIMIT and the cull keeps it", () => {
  const f = fixture("survival"), s = f.sim; fill(f, MOB_LIMIT + 2);
  f.p.survival.inventory.main.fill(null); f.p.survival.add(ITEM_SPAWN_EGG, 1, 90); // 90: ocelot? any supported kind below
  const before = s.mobs.mobs.entities.length;
  f.p.survival.inventory.main.fill(null);
  const stack = { id: ITEM_SPAWN_EGG, count: 1, damage: 90 }; f.p.survival.inventory.main[0] = stack; f.p.survival.selected = 0;
  assert.equal(useOnBlock(s, f.p, { block: [64, 9, 64], adjacent: [64, 10, 64], side: 1 }, ITEM_SPAWN_EGG), true);
  const made = s.mobs.mobs.entities.filter((e) => e.summonKeep);
  assert.equal(s.mobs.mobs.entities.length, before + 1);
  assert.equal(made.length, 1);
  for (let i = 0; i < 3; i++) s.tick();
  assert.ok(s.mobs.mobs.entities.includes(made[0]), "the cull leaves it");
});

test("a dispenser's spawn egg creates the mob past MOB_LIMIT (summonKeep)", () => {
  const f = fixture("survival"), s = f.sim; fill(f, MOB_LIMIT + 2);
  let stopped = false;
  s.dispense.host(() => { stopped = true; }).spawnEgg({ id: ITEM_SPAWN_EGG, count: 1, damage: 90 }, { x: 64.5, y: 10, z: 64.5 }, () => 0.5);
  assert.equal(stopped, false);
  assert.equal(s.mobs.mobs.entities.filter((e) => e.summonKeep).length, 1);
});

// ---- (4) a sleeper's posY ----
test("aimOriginY: standing eye = minY + 1.62, lying = posY = minY + 0.2", () => {
  assert.ok(Math.abs(aimOriginY(10, false, 1.62) - 11.62) < 1e-9);
  assert.equal(aimOriginY(10.7375, true, 1.62), serverPosY(10.7375, true));
  assert.ok(Math.abs(aimOriginY(10.7375, true) - 10.9375) < 1e-6);
});

test("server: a sleeper's dig ray starts at posY (the cell it looks at is found from the bed, not from minY + 1.62)", () => {
  const f = fixture(), s = f.sim, p = f.p;
  s.world.put(64, 10, 62, 1, 0, false); // stone cell in front (yaw 0 looks toward -z) at the lying level
  p.position.copy({ x: 64.5, y: 10.7375, z: 64.5 }); p.sleeping = true; p.yaw = 0; p.pitch = 0;
  assert.deepEqual(s.aimCell(p), [64, 10, 62], "from y = 10.94 the level ray hits the cell at y 10");
  p.sleeping = false;
  assert.equal(s.aimCell(p), null, "standing at that minY the eye is at 12.36: the level ray passes over it");
});

test("PlayerView.posY: mob distance reads minY + 0.2 for a lying player", () => {
  const f = fixture("survival"), s = f.sim;
  s.input("a", { type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  s.tick();
  const view = s.mobs.views.get("a").view, ai = s.mobs.mobs.ai;
  assert.equal(view.posY, view.y);
  f.p.sleeping = true; f.p.position.copy({ x: 64.5, y: 10.7375, z: 64.5 }); s.tick();
  assert.equal(view.posY, view.y + Math.fround(0.2));
  // World.getClosestVulnerablePlayer reads posY: a mob 1.0 below the sleeper's minY is within range 1.1 of posY (0.8) but not of minY... (1.0 < 1.1 both), so test the exact edge
  const mob = { x: view.x, y: view.y + 0.2 + 1.0, z: view.z };
  assert.equal(ai.closestVulnerablePlayer(mob, 1.0 - 1e-6), null);
  assert.equal(ai.closestVulnerablePlayer(mob, 1.0 + 1e-6)?.sleeping, true, "distance is mob.y - posY = 1.0, not 1.2 from minY");
});
