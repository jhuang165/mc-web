// Batch 76 mphorse76: riding horses on the dedicated server (server-horses.js). Single-player rules are reused; these tests replay them through DedicatedSimulation with no sockets.
import test from "node:test";
import assert from "node:assert/strict";
import { makeSide, spawn, stock, serverClick } from "../tools/sweep-use75.mjs";
import { Survival } from "./survival.js";
import { buildWindow } from "./multiplayer/client-containers.js";
import { makeStack } from "./inventory.js";
import { JavaRandom } from "./java-random.js";
import { setEntityRandom } from "./entities.js";

const SADDLE = 363;
const tick = (s, n = 1) => { for (let i = 0; i < n; i++) s.tick(); };
const ctl = (side, c) => side.s.input("a", { type: "input", controls: { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false, ...c }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function tameSaddled(side, type = 0) {
  const e = spawn(side, "horse"); e.horse.tame = true; e.horse.saddled = true; e.horse.type = type; e.horse.speed = 0.3; e.horse.jump = 0.7; e.health = 30; e.growingAge = 0; e.onGround = true;
  return e;
}
const mountIt = (side, e) => { side.p.survival.inventory.main[0] = null; serverClick(side, e); };

test("an empty hand on a tame saddled horse seats the player; sneaking lets go", () => {
  const side = makeSide(), e = tameSaddled(side);
  mountIt(side, e);
  assert.ok(side.p.mount && side.p.mount.mob === e && e.rider);
  tick(side.s, 2);
  assert.ok(Math.hypot(side.p.position.x - e.x, side.p.position.z - e.z) < 0.6);
  ctl(side, { sneak: true }); tick(side.s, 2);
  assert.equal(side.p.mount, null); assert.equal(e.rider, null);
});

test("a tame horse is not mounted while sneaking with an empty hand (the window opens)", () => {
  const side = makeSide(), e = tameSaddled(side);
  ctl(side, { sneak: true }); mountIt(side, e);
  assert.ok(!side.p.mount); assert.equal(side.p.window?.kind, "horse");
});

test("a rider's forward key walks the saddled horse", () => {
  const side = makeSide(), e = tameSaddled(side);
  mountIt(side, e); tick(side.s, 3);
  const x0 = e.x, z0 = e.z;
  ctl(side, { forward: 1 }); tick(side.s, 30);
  assert.ok(Math.hypot(e.x - x0, e.z - z0) > 1.5, "the horse walked");
  assert.ok(Math.hypot(side.p.position.x - e.x, side.p.position.z - e.z) < 0.6, "the rider stays on it");
});

test("horseJump (C0B action 6) sets the power and the horse leaves the ground", () => {
  const side = makeSide(), e = tameSaddled(side);
  mountIt(side, e); tick(side.s, 3);
  assert.equal(side.s.horseJump("a", 100), true);
  assert.equal(e.jumpPower, 1);
  tick(side.s, 2);
  assert.ok(e.y > 10.05 || e.vy > 0, "jumped");
  assert.equal(side.s.horseJump("zz", 5), false);
});

test("horseJump needs a ridden horse; negative counts as 0.4; an unsaddled horse gets no power", () => {
  const side = makeSide(), e = tameSaddled(side);
  assert.equal(side.s.horseJump("a", 50), false, "not riding");
  mountIt(side, e);
  side.s.horseJump("a", -1); assert.equal(Math.fround(e.jumpPower), Math.fround(0.4));
  e.horse.saddled = false; e.jumpPower = 0; side.s.horseJump("a", 90); assert.equal(e.jumpPower, 0);
});

test("without a horseJump message the held jump key charges the bar and releasing jumps", () => {
  const side = makeSide(), e = tameSaddled(side);
  mountIt(side, e); tick(side.s, 3);
  ctl(side, { jump: true }); tick(side.s, 6);
  ctl(side, { jump: false }); tick(side.s, 1);
  assert.ok(e.jumpPower > 0 || e.jumpingHorse || e.vy > 0, "the release started a jump");
});

test("C0B action 7 opens the inventory window of the ridden horse; it is a horse window the client builds", () => {
  const side = makeSide(), e = tameSaddled(side, 1); e.horse.chested = true;
  assert.equal(side.s.horseInventory("a"), false);
  mountIt(side, e);
  assert.equal(side.s.horseInventory("a"), true);
  const open = side.p.windowOut.find(m => m.type === "openWindow");
  assert.equal(open.kind, "horse"); assert.equal(open.horse.chested, true); assert.equal(open.size, 17 + 36);
  const built = buildWindow(open, { survival: new Survival({}, "creative"), world: side.s.world });
  assert.ok(built && built.container.slots.length === open.size);
});

test("a saddle in hand on a tame unsaddled horse opens the window; clicking the saddle slot saddles it", () => {
  const side = makeSide(), e = spawn(side, "horse"); e.growingAge = 0; e.horse.tame = true;
  stock(side, SADDLE, 0, 1); serverClick(side, e);
  const win = side.p.window; assert.equal(win?.kind, "horse");
  side.s.windowInventory("a", { windowId: win.id, slots: side.p.survival.inventory.main.map(s => s && { id: s.id, count: s.count, damage: s.damage ?? 0 }) });
  // inventory slot 0 of the hotbar is container slot 2 + 27 + 0 -> index = size(2) + 27
  const idx = win.container.slots.length - 9;
  side.s.clickWindow("a", { windowId: win.id, slot: idx, button: 0, mode: 0, action: 1, item: { id: SADDLE, count: 1, damage: 0 } });
  side.s.clickWindow("a", { windowId: win.id, slot: 0, button: 0, mode: 0, action: 2, item: null });
  assert.equal(e.horse.saddled, true);
});

test("the window closes when the horse is more than 8 blocks away or dies", () => {
  const side = makeSide(), e = tameSaddled(side);
  ctl(side, { sneak: true }); mountIt(side, e);
  const win = side.p.window; assert.ok(win);
  e.x += 20; tick(side.s, 1);
  assert.equal(side.p.window, null);
  assert.ok(side.p.windowOut.some(m => m.type === "windowClose"));
});

test("riding a wild horse: the run-around task rolls temper and eventually throws the rider (temper rises by 5)", () => {
  const side = makeSide(), e = spawn(side, "horse"); e.growingAge = 0; e.horse.tame = false; e.horse.temper = 0; e.horse.saddled = false;
  setEntityRandom(e, new JavaRandom(11));
  mountIt(side, e);
  assert.ok(side.p.mount, "a wild horse takes an empty-handed rider");
  let thrown = false;
  for (let i = 0; i < 400 && !thrown; i++) { tick(side.s, 1); if (!side.p.mount) thrown = true; if (e.horse.tame) break; }
  assert.ok(thrown || e.horse.tame, "thrown or tamed within 400 ticks");
  if (thrown) { assert.ok(e.horse.temper >= 5); assert.equal(e.rider, null); }
});

test("a horse tamed by riding carries the tamer's name", () => {
  const side = makeSide(), e = tameSaddled(side);
  mountIt(side, e); e.horse.owner = "player";
  tick(side.s, 1);
  assert.equal(e.horse.owner, "Alice");
});

test("distance on a horse is the horse statistic, not the pig's", () => {
  const side = makeSide(), e = tameSaddled(side);
  mountIt(side, e); tick(side.s, 3);
  ctl(side, { forward: 1 }); tick(side.s, 40);
  const st = side.p.stats;
  assert.ok((st.get?.("stat.horseOneCm") ?? st.values?.get?.("stat.horseOneCm") ?? 0) > 0);
  assert.equal(st.get?.("stat.pigOneCm") ?? st.values?.get?.("stat.pigOneCm") ?? 0, 0);
});
