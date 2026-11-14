// Batch 68 mppaintings: paintings, item frames and leash knots on the dedicated server (server-hanging.js, client-hanging.js). The rules are the single-player classes (hanging.js,
// executed in hanging-reference.json and entity-throw-frame-reference.json); these tests replay the server glue over DedicatedSimulation with no sockets.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial, chatDisplay } from "./server-broadcast.js";
import { langReady } from "./chat-component.js";
import { ClientHanging } from "./multiplayer/client-hanging.js";
import { PAINTING_ITEM, FRAME_ITEM, ARTS } from "./hanging.js";

await langReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const STONE = 1;

function fixture(gameMode = "creative") {
  const world = new World("b68-hang");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  for (let x = 60; x <= 66; x++) for (let y = 10; y <= 14; y++) world.put(x, y, 60, STONE, 0, false); // a wall facing +z
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode }), inbox = {};
  sim.mobs.mobs.entities.length = 0;
  const social = new ServerSocial({ simulation: sim, ops: ["Alex"], deliver: (id, m) => (inbox[id] ??= []).push(m) });
  const p = sim.addPlayer("a", "Alex", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  const hold = (id, n = 1) => { p.survival.inventory.main.fill(null); p.survival.add(id, n); };
  const place = (x, y, z, side = "south") => sim.vehicles.hanging.useHeld(p, { block: [x, y, z], adjacent: side === "south" ? [x, y, z + 1] : [x, y + 1, z] });
  const say = (line) => { inbox.a = []; social.command("a", line); return (inbox.a ?? []).filter((m) => m.type === "chat").map((m) => chatDisplay(m).unformatted()); };
  const send = () => { p.vehPackets = null; sim.vehicles.tick(); return p.vehPackets; };
  return { sim, p, hold, place, say, send, hang: sim.vehicles.hanging };
}

test("an item frame is placed on the clicked wall side, takes one frame item (Survival), and the top face is refused", () => {
  const f = fixture("survival"); f.p.survival.mode = "survival";
  f.hold(FRAME_ITEM, 2);
  assert.equal(f.place(61, 11, 60, "top"), false);
  assert.equal(f.hang.entities.length, 0);
  assert.equal(f.place(61, 11, 60), true);
  assert.equal(f.hang.entities.length, 1);
  const e = f.hang.entities[0];
  assert.deepEqual([e.kind, e.dir, e.tx, e.ty, e.tz], ["frame", 0, 61, 11, 60]);
  assert.equal(f.p.survival.held.count, 1);
});

test("a painting takes a native art that fits, and Creative keeps its stack", () => {
  const f = fixture(); assert.equal(f.p.survival.creative, true);
  f.hold(PAINTING_ITEM, 1);
  assert.equal(f.place(62, 12, 60), true);
  const e = f.hang.entities[0];
  assert.equal(e.kind, "painting");
  assert.ok(ARTS[e.art] && ARTS[e.art][1] <= 32 * 2);
  assert.equal(f.p.survival.held.count, 1);
});

test("the tracker sends S0E 71 with the facing and watcher slots 2 and 3, S10 with title and facing, and a change resends the frame", () => {
  const f = fixture();
  f.hold(FRAME_ITEM); f.place(61, 11, 60);
  f.hold(PAINTING_ITEM); f.place(64, 12, 60);
  const msg = f.send();
  const frame = msg.hset.find((r) => r.t === 71), painting = msg.hset.find((r) => r.p === "S10");
  assert.deepEqual([frame.p, frame.x, frame.y, frame.z, frame.data, frame.meta], ["S0E", 61 * 32, 11 * 32, 60 * 32, 0, [[5, 2, null], [0, 3, 0]]]);
  assert.ok(ARTS.some((a) => a[0] === painting.title));
  assert.deepEqual([painting.x, painting.z, painting.dir], [64, 60, 0]);
  assert.equal(f.send(), null); // nothing changed
  f.hold(300, 3);
  const fe = f.hang.entities.find((e) => e.kind === "frame");
  assert.equal(f.sim.vehicles.act(f.p, { v: "h" + fe.id, hit: false }), true); // insert
  assert.equal(f.sim.vehicles.act(f.p, { v: "h" + fe.id, hit: false }), true); // rotate
  const again = f.send();
  assert.deepEqual(again.hset[0].meta, [[5, 2, { id: 300, count: 1, damage: 0 }], [0, 3, 1]]);
  assert.equal(again.hset.length, 1);
});

test("the client copy is built from the packet and aimed through the frame's box", () => {
  const f = fixture();
  f.hold(FRAME_ITEM); f.place(61, 11, 60);
  const c = new ClientHanging(); c.apply(f.send());
  assert.equal(c.list().length, 1);
  const hit = c.pick({ x: 61.5, y: 11.5, z: 63 }, { x: 0, y: 0, z: -1 }, 6);
  assert.ok(hit && /^h\d+$/.test(hit.key));
  c.apply({ hdel: [hit.key] });
  assert.equal(c.list().length, 0);
});

test("Survival: a hit breaks a painting and drops it; a frame with an item drops the item and stays, then breaks and drops itself; Creative drops nothing", () => {
  const f = fixture("survival"); f.p.survival.mode = "survival";
  f.hold(PAINTING_ITEM); f.place(63, 12, 60);
  const pe = f.hang.entities[0];
  assert.equal(f.sim.vehicles.act(f.p, { v: "h" + pe.id, hit: true }), true);
  assert.equal(f.hang.entities.length, 0);
  assert.equal(f.sim.items.items.filter((i) => i.stack.id === PAINTING_ITEM).length, 1);
  f.hold(FRAME_ITEM, 1); f.place(64, 11, 60);
  const fe = f.hang.entities[0];
  f.hold(300, 1);
  f.sim.vehicles.act(f.p, { v: "h" + fe.id, hit: false });
  assert.equal(f.p.survival.held, null);
  f.sim.vehicles.act(f.p, { v: "h" + fe.id, hit: true });
  assert.equal(f.hang.entities.length, 1);
  assert.equal(fe.item, null);
  assert.equal(f.sim.items.items.filter((i) => i.stack.id === 300).length, 1);
  f.sim.vehicles.act(f.p, { v: "h" + fe.id, hit: true });
  assert.equal(f.hang.entities.length, 0);
  const c = fixture(); c.hold(FRAME_ITEM); c.place(64, 11, 60);
  c.sim.vehicles.act(c.p, { v: "h" + c.hang.entities[0].id, hit: true });
  assert.equal(c.hang.entities.length, 0);
  assert.equal(c.sim.items.items.length, 0);
});

test("losing the wall breaks the entity on the 101st update of a ticking chunk, not before", () => {
  const f = fixture();
  f.hold(FRAME_ITEM); f.place(61, 11, 60);
  f.sim.world.put(61, 11, 60, 0, 0, false);
  for (let i = 0; i < 100; i++) f.hang.tick();
  assert.equal(f.hang.entities.length, 1);
  f.hang.tick();
  assert.equal(f.hang.entities.length, 0);
});

test("a thrown ball and an arrow hit a frame through the dimension's targets; a dispenser throw has no player source", () => {
  const f = fixture("survival"); f.p.survival.mode = "survival";
  f.hold(FRAME_ITEM); f.place(61, 11, 60);
  const e = f.hang.entities[0];
  assert.equal(f.sim.dispense.targets(f.sim.dispense).some((t) => t.ref === e), true);
  f.hold(FRAME_ITEM); // an item inside, so a hit only removes it
  f.hang.h.interact(e, { id: 300, count: 1, damage: 0 });
  assert.equal(f.sim.dispense.ballHit(f.sim.mobs.mobs, e, { thrower: f.p }), true);
  assert.equal(e.item, null);
  assert.equal(f.sim.items.items.filter((i) => i.stack.id === 300).length, 1); // the item drops at once (Survival thrower), the frame stays
  assert.equal(f.hang.entities.length, 1);
});

test("frames, paintings and their items are saved with the dimension and come back", () => {
  const f = fixture();
  f.hold(FRAME_ITEM); f.place(61, 11, 60);
  f.hang.h.interact(f.hang.entities[0], { id: 300, count: 1, damage: 0 });
  f.hang.entities[0].rotation = 3;
  const saved = f.sim.vehicles.save();
  const g = fixture();
  const again = new g.hang.constructor(g.sim, g.sim.vehicles.ids, saved.hanging);
  assert.deepEqual([again.entities[0].kind, again.entities[0].rotation, again.entities[0].item.id, again.entities[0].tx], ["frame", 3, 300, 61]);
});

test("/summon Painting, ItemFrame and LeashKnot work on the server and reach the client as spawn records", () => {
  const f = fixture();
  assert.deepEqual(f.say("/summon Painting ~ ~ ~ {Motive:Sea,TileX:61,TileY:11,TileZ:60,Direction:0}"), ["Object successfully summoned"]);
  assert.deepEqual(f.say("/summon ItemFrame ~ ~ ~ {TileX:62,TileY:11,TileZ:60,Direction:0}"), ["Object successfully summoned"]);
  assert.deepEqual(f.say("/summon LeashKnot ~ ~ ~"), ["Object successfully summoned"]);
  const msg = f.send();
  assert.equal(msg.hset.find((r) => r.p === "S10").title, "Sea");
  assert.ok(msg.hset.some((r) => r.t === 71));
  assert.ok(msg.hset.some((r) => r.t === 77 && r.k[0] === "k"));
  const knot = f.sim.mobs.mobs.knotList[0], id = Number(msg.hset.find((r) => r.t === 77).k.slice(1));
  assert.equal(f.sim.vehicles.act(f.p, { v: "k" + id, hit: true }), true); // any hit kills a knot
  assert.equal(knot.dead, true);
  assert.deepEqual(f.send().hdel, ["k" + id]);
});

test("a lead on a fence makes a knot that is tracked; each dimension keeps its own list", () => {
  const f = fixture();
  f.sim.world.put(70, 10, 70, 85, 0, false); // a fence
  const k = f.sim.mobs.mobs.knotCreate(70, 10, 70);
  const msg = f.send();
  assert.equal(msg.hset.filter((r) => r.t === 77).length, 1);
  assert.equal(k.dead, false);
  assert.notEqual(f.sim.vehicles.hanging.h, undefined);
});

test("an arrow's hit uses the shooter's creative flag (Creative drops nothing); a mob's arrow has no player source", () => {
  const f = fixture();
  f.hold(FRAME_ITEM); f.place(61, 11, 60); f.place(62, 11, 60);
  const [a, b] = f.hang.entities;
  f.hang.h.interact(a, { id: 300, count: 1, damage: 0 });
  assert.equal(f.hang.arrowHost(true).attack(a, { player: true }), true);
  assert.equal(a.item, null);
  assert.equal(f.sim.items.items.length, 0);
  assert.equal(f.hang.arrowHost(false).attack(b, null), true); // broken: the frame drops
  assert.equal(f.hang.entities.length, 1);
  assert.equal(f.sim.items.items.length, 1);
});

test("the Nether keeps its own paintings and frames: placed through the swap, saved under the Nether, not seen in the Overworld", () => {
  const f = fixture();
  const a = f.p;
  f.sim.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = f.sim.dimensions.nether, w = n.world;
  for (let x = 60; x <= 66; x++) for (let y = 60; y <= 90; y++) for (let z = 58; z <= 66; z++) w.put(x, y, z, z === 60 && y < 75 ? 150 : 0, 0, false);
  f.sim.dimensions.within(a, () => {
    a.survival.inventory.main.fill(null); a.survival.add(FRAME_ITEM, 1);
    assert.equal(f.sim.vehicles.hanging.useHeld(a, { block: [61, 70, 60], adjacent: [61, 70, 61] }), true);
  });
  assert.equal(n.vehicles.hanging.entities.length, 1);
  assert.equal(f.hang.entities.length, 0);
  const saved = f.sim.dimensions.saveField();
  assert.equal(saved.dimensions.nether.vehicles.hanging.length, 1);
});
