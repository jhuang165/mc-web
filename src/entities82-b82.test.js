// b82 entities82: the entity catalogue audit's fixes.
//  * The firework star's overlay tint (ItemFireworkCharge acr: requiresMultipleRenderPasses, a(int,int) the overlay icon for pass > 0,
//    a(add,int) pass 1 = the Colors average or 9079434), bytecode-read.
//  * The daylight helmet of zombies and skeletons (yq.e / yl.e), executed for the zombie (zombie-wander-reference.json zw-helm-*),
//    bytecode-read for the skeleton.
//  * The giant as a dedicated-server mob kind (summon, spawners, the tracker's IAnimals default 80 / 3).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ITEM_FIREWORK_STAR, STAR_DEFAULT_TINT } from "./fireworks.js";
import { itemPasses, itemPassColor } from "./item-passes.js";
import { daylightHelmet, HELMET } from "./mob-equipment.js";
import { JavaRandom } from "./java-random.js";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { RemoteMobs } from "./multiplayer/remote-mobs.js";
import { SUPPORTED } from "./multiplayer/server-mobs.js";
import { mobTrackRange } from "./multiplayer/server-spawners.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { ENTITY_TYPES } from "./entities.js";

const star = (colors) => ({ id: ITEM_FIREWORK_STAR, count: 1, damage: 0, ...(colors ? { explosion: { type: 0, colors, fade: [], flicker: false, trail: false } } : {}) });

test("firework star: two passes, the plain charge and the overlay tinted by pass 1 (acr)", () => {
  const p = itemPasses(ITEM_FIREWORK_STAR, 0, itemPassColor(star([0xB3312C])));
  assert.match(p.base, /fireworks_charge\.png$/);
  assert.match(p.overlay, /fireworks_charge_overlay\.png$/);
  assert.deepEqual(p.tint, [1, 1, 1], "pass 0 is untinted (a(add,int) returns 16777215 for pass 0)");
  assert.equal(p.color, 0xB3312C);
  assert.deepEqual(p.overlayTint.map((v) => Math.round(v * 255)), [0xB3, 0x31, 0x2C]);
});

test("firework star: several Colors average per channel with integer division; no Colors is 9079434 (0x8A8A8A)", () => {
  // red 0xB3312C + blue 0x253192: (179+37)/2=108, (49+49)/2=49, (44+146)/2=95
  assert.equal(itemPassColor(star([0xB3312C, 0x253192])), (108 << 16) | (49 << 8) | 95);
  assert.equal(itemPassColor(star([0x000001, 0x000000])), 0, "idiv truncates");
  assert.equal(itemPassColor(star()), STAR_DEFAULT_TINT);
  assert.equal(STAR_DEFAULT_TINT, 0x8A8A8A);
  assert.equal(itemPasses(ITEM_FIREWORK_STAR).color, STAR_DEFAULT_TINT, "no colour argument draws the default");
  assert.equal(itemPassColor({ id: 1, color: 7 }), 7, "other items keep their own colour");
  assert.equal(itemPassColor(null), undefined);
});

test("daylight helmet: no helmet burns, a pumpkin or unbreakable helmet blocks without wear, a zero-size stack still blocks", () => {
  const r = new JavaRandom(1n);
  assert.equal(daylightHelmet([null, null, null, null, null], r), true);
  assert.equal(daylightHelmet(undefined, r), true);
  const pumpkin = { id: 86, count: 1, damage: 0 }, eq = [null, null, null, null, pumpkin];
  for (let i = 0; i < 20; i++) assert.equal(daylightHelmet(eq, r), false);
  assert.equal(pumpkin.damage, 0);
  const unbreakable = { id: 298, count: 1, damage: 54, unbreakable: true }, eq2 = [null, null, null, null, unbreakable];
  for (let i = 0; i < 20; i++) assert.equal(daylightHelmet(eq2, r), false);
  assert.equal(unbreakable.damage, 54);
  assert.equal(eq2[HELMET], unbreakable);
  const empty = { id: 310, count: 0, damage: 0 };
  assert.equal(daylightHelmet([null, null, null, null, empty], new JavaRandom(2n)), false, "getEquipmentInSlot is non-null; the stack size is not read");
});

test("daylight helmet: wear is rand.nextInt(2) on the mob's Random; at maxDamage the break runs and the slot clears", () => {
  const seed = 7n, mine = new JavaRandom(seed), ref = new JavaRandom(seed);
  const helmet = { id: 298, count: 1, damage: 50 }, eq = [null, null, null, null, helmet]; // leather cap, max damage 55
  let breaks = 0, ticks = 0, want = 50;
  while (eq[HELMET] && ticks < 200) {
    assert.equal(daylightHelmet(eq, mine, () => { breaks++; for (let i = 0; i < 15; i++) mine.nextFloat(); }), false, "the breaking tick still protects");
    want += ref.nextInt(2);
    if (want >= 55) for (let i = 0; i < 15; i++) ref.nextFloat();
    ticks++;
  }
  assert.equal(eq[HELMET], null);
  assert.equal(breaks, 1);
  assert.equal(helmet.damage, 55);
  assert.equal(mine.nextInt(1 << 30), ref.nextInt(1 << 30), "same draws as native: one nextInt(2) a tick, 15 floats on the break");
  assert.equal(daylightHelmet(eq, mine), true, "with the slot cleared the mob burns");
});

// ---- the giant on the dedicated server ----
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture() {
  const world = new World("entities82-giant");
  for (let x = 30; x <= 100; x++) for (let z = 30; z <= 100; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "creative", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const packets = (p) => { const out = p.mobPackets ?? []; p.mobPackets = null; return JSON.parse(JSON.stringify(out)); };

test("the giant is a server mob kind: kept, tracked at the IAnimals default 80 and copied to the client with its 3.6 x 10.8 box", () => {
  assert.ok(SUPPORTED.has("giant"));
  assert.equal(mobTrackRange("giant"), 80);
  assert.equal(Object.keys(ENTITY_TYPES).filter((k) => !SUPPORTED.has(k)).length, 0, "no port mob kind is left off the server");
  const s = fixture(), a = s.addPlayer("a", "ax", key(1));
  a.position.copy({ x: 64.5, y: 10, z: 64.5 }); a.previous.copy(a.position); s.input("a", input());
  const remote = new RemoteMobs(s.world);
  const g = s.mobs.mobs.create("giant", 72.5, 10, 64.5); s.mobs.mobs.entities.push(g);
  for (let i = 0; i < 4; i++) { s.tick(); remote.apply(packets(a)); remote.tick(); }
  assert.ok(s.mobs.mobs.entities.includes(g), "the tick's filter keeps it");
  const c = remote.copies.get(Number(g.id.slice(4)));
  assert.ok(c, "the client has a copy");
  assert.equal(c.mob.type, "giant");
  assert.ok(Math.abs(c.client.height - 10.8) < 1e-6, "box height " + c.client.height);
  assert.equal(s.mobs.save().filter((r) => r.type === "giant").length, 1, "it saves with the dimension's mobs");
});
