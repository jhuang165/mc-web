import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { loadMeleePacks, meleeWeapon, meleeUrl, coneTargets, MeleeController, strikeDamage, meleeSpeed } from "./mods/guns/melee.js";
import { setMeleePacks, setGunsEnabled, meleeOf, creativeOrder } from "./mods/guns/install.js";
import { createGunHooks } from "./mods/guns/hooks.js";
import { parseAnimations } from "./mods/guns/animation.js";
import { meleeClip, meleeLayers, loadMeleeAssets, PackMeleeView, meleeHeldModel } from "./mods/guns/melee-view.js";
import { Survival, ITEMS, setExtraCrafting } from "./survival.js";
import { CREATIVE_TABS, SEARCH_ORDER } from "./creative.js";
import { groundAccel } from "./player-movement.js";
import { movePlayer } from "./player-physics.js";
import { playerFixture } from "./player-physics-fixture.js";

// Synthetic pack data: tests run without installing or redistributing the private CS2 pack.
const entry = () => ({
  index: { name: "knife.name", base_item: "lrtactical:melee", data: {
    attributes: { "generic.attack_damage": 11, "minecraft:generic.movement_speed": { amount: 0.05, operation: "percent" } },
    draw_time: 3, put_away_time: 1,
    attack: Object.fromEntries([["left", 1, 110], ["right", 1.5, 60]].map(([kind, factor, angle]) => [`attack_${kind}`, {
      factor, cooldown: 8, delay: 4, knockback: 0.25, hitbox: { type: "cone", max_range: 4, max_angle: angle },
    }])),
  } },
  display: { model: "cs2_wt:melee/test", texture: "cs2_wt:melee/test", animation: "cs2_wt:melee/test", slot_texture: "cs2_wt:slot/test" },
});
const raw = () => [{ namespace: "cs2_wt", lang: {}, melee: { karambit: entry() } }];
const weapon = () => meleeWeapon("cs2_wt", "karambit", entry());
const tables = () => ({ items: ITEMS, combatTab: CREATIVE_TABS[8].items, search: SEARCH_ORDER, setCrafting: setExtraCrafting });
const animations = () => parseAnimations({ animations: Object.fromEntries(["static_idle", "draw", "inspect", "melee_1", "melee_2", "melee_3"].map((name) => [name, {
  animation_length: 1, bones: {}, sound_effects: name === "static_idle" ? {} : { 0: { effect: `cs2_wt:${name}` } },
}])) });

test("melee pack loader tolerates absent and broken installs, resolves namespace assets", async () => {
  assert.equal(await loadMeleePacks(async () => null), null);
  assert.equal(await loadMeleePacks(async () => "invalid"), null);
  const files = {
    "/mods/lrtactical/index.json": { packs: [{ namespace: "cs2_wt", melee: ["karambit", "missing"], lang: ["en_us"], sounds: ["draw"] }] },
    "/mods/lrtactical/cs2_wt/data/cs2_wt/index/melee/karambit.json": entry().index,
    "/mods/lrtactical/cs2_wt/assets/cs2_wt/display/melee/karambit.json": entry().display,
    "/mods/lrtactical/cs2_wt/assets/cs2_wt/lang/en_us.json": { "knife.name": "Test Knife" },
  };
  const [p] = await loadMeleePacks(async (url) => files[url] ? JSON.stringify(files[url]) : null);
  assert.deepEqual(Object.keys(p.melee), ["karambit"]);
  assert.equal(meleeWeapon(p.namespace, "karambit", p.melee.karambit, p.lang).name, "Test Knife");
  assert.equal(meleeUrl.geo("cs2_wt:melee/test", "unused"), "/mods/lrtactical/cs2_wt/assets/cs2_wt/geo_models/melee/test.json");
  assert.equal(meleeUrl.animation("melee/test", "test"), "/mods/lrtactical/test/assets/test/animations/melee/test.animation.json");
});

test("weapon stats keep tick units, light/heavy damage and the movement attribute", () => {
  const w = weapon();
  assert.equal(w.name, "Karambit"); assert.equal(w.draw, 3); assert.equal(w.putAway, 1);
  assert.equal(strikeDamage(w, w.attacks.left), 12);
  assert.equal(strikeDamage(w, w.attacks.right), 18);
  assert.equal(meleeSpeed(w), 1.05);
  assert.ok(Math.abs(groundAccel(false, 0.546, meleeSpeed(w)) / groundAccel(false, 0.546) - 1.05) < 1e-6);
  assert.equal(meleeSpeed(null), 1);
  assert.equal(meleeWeapon("unknown", "knife", entry()), null);
});

test("holding a knife increases ground movement, and putting it away restores normal movement", () => {
  const step = (multiplier) => {
    const s = playerFixture("land");
    s.moveSpeedMultiplier = multiplier;
    movePlayer(s, { forward: 1, strafe: 0, sprint: false, sneak: false, jump: false });
    return 65.5 - s.position.z;
  };
  const normal = step(undefined), knife = step(meleeSpeed(weapon()));
  assert.ok(Math.abs(knife / normal - 1.05) < 1e-5);
  assert.equal(step(meleeSpeed(null)), normal);
});

test("knife items are opt-in, searchable and persistent when their pack goes missing", () => {
  const combat = [...CREATIVE_TABS[8].items], search = [...SEARCH_ORDER];
  setMeleePacks(raw());
  try {
    setGunsEnabled(true, tables());
    assert.equal(ITEMS[4603].name, "Karambit"); assert.equal(ITEMS[4603].stack, 1);
    assert.ok(creativeOrder().includes(4603)); assert.ok(SEARCH_ORDER.includes(4603));
    assert.equal(meleeOf({ id: 4603 }).attacks.right.factor, 1.5);
    assert.equal(new Survival({ slots: [{ id: 4603, count: 1 }] }, "creative").held.id, 4603);
    setGunsEnabled(false, tables()); setMeleePacks(null); setGunsEnabled(true, tables());
    assert.equal(ITEMS[4603].missingPack, true);
    assert.equal(new Survival({ slots: [{ id: 4603, count: 1 }] }, "creative").held.id, 4603);
    assert.equal(meleeOf({ id: 4603 }), undefined);
    assert.ok(!creativeOrder().includes(4603));
  } finally { setGunsEnabled(false, tables()); setMeleePacks(null); }
  assert.equal(ITEMS[4603], undefined);
  assert.deepEqual(CREATIVE_TABS[8].items, combat); assert.deepEqual(SEARCH_ORDER, search);
});

test("cone includes an edge in view even when the centre is outside; rejects range, behind, dead and blocked", () => {
  const e = (min, max, health = 20) => ({ min, max, health });
  const edge = e([2, -1, 0.1], [6, 1, 6]), front = e([-0.3, -1, 2], [0.3, 1, 2.5]);
  const behind = e([-0.3, -1, -3], [0.3, 1, -2]), far = e([-0.3, -1, 5], [0.3, 1, 6]);
  const dead = e([-0.3, -1, 1], [0.3, 1, 2], 0), blocked = e([-0.3, -1, 1], [0.3, 1, 2]);
  const hits = coneTargets([edge, behind, far, dead, front, blocked], [0, 0, 0], [1, 0, 0], { range: 4, angle: 20 }, (x) => x, (x) => x !== blocked);
  assert.deepEqual(hits.map((h) => h.entity), [edge]);
  const inside = e([-1, -1, -1], [1, 1, 1]);
  assert.equal(coneTargets([inside], [0, 0, 0], [0, 0, -1], { range: 1, angle: 1 }, (x) => x).length, 1);
});

test("controller respects full draw delay, delayed damage, shared cooldown and alternating slashes", () => {
  const w = weapon(), c = new MeleeController();
  assert.equal(c.tick(w)[0].type, "draw"); c.press("left", true);
  assert.deepEqual(c.tick(w), []); assert.deepEqual(c.tick(w), []);
  const swing = c.tick(w); assert.equal(swing[0].type, "swing"); assert.equal(swing[0].count, 0);
  assert.deepEqual(c.tick(w), []); assert.deepEqual(c.tick(w), []); assert.deepEqual(c.tick(w), []);
  assert.equal(c.tick(w)[0].type, "strike");
  c.press("left", false); c.press("right", true);
  assert.deepEqual(c.tick(w), []); assert.deepEqual(c.tick(w), []); assert.deepEqual(c.tick(w), []);
  assert.equal(c.tick(w)[0].kind, "right");
  c.cancel(); c.cooldown = 0; c.press("left", true);
  assert.equal(c.tick(w)[0].count, 1);
});

test("quick clicks latch once; switching even to another slot with the same knife cancels pending hits", () => {
  const w = weapon(), c = new MeleeController();
  c.tick(w, "0"); for (let i = 0; i < w.draw; i++) c.tick(w, "0");
  c.press("left", true); c.press("left", false);
  assert.equal(c.tick(w, "0")[0].type, "swing");
  assert.equal(c.tick(w, "1")[0].type, "draw");
  assert.equal(c.pending.length, 0);
  for (let i = 0; i < 20; i++) assert.ok(!c.tick(w, "1").some((e) => e.type === "strike" || e.type === "swing"));
  c.press("right", true); c.tick(w, "1"); c.cancel();
  assert.equal(c.pending.length, 0); assert.equal(c.held.right, false);
});

function fixture() {
  setMeleePacks(raw()); setGunsEnabled(true, tables());
  const survival = new Survival({ slots: [{ id: 4603, count: 1 }] }, "creative");
  const target = { type: "zombie", x: 0, y: 0, z: -2, health: 40, hurt: 9, vx: 0, vy: 0, vz: 0, onGround: true };
  const wall = new Set(), hits = [], sounds = [], events = [];
  let clock = 0, playing = true;
  const hooks = createGunHooks({
    survival, world: { get: (x, y, z) => wall.has(`${x},${y},${z}`) ? 1 : 0, getMeta: () => 0 },
    mobs: { entities: [target], attackEntityFrom(e, amount) { hits.push({ amount, hurt: e.hurt }); e.health -= amount; return true; } },
    eye: () => ({ origin: [0, 1.62, 0], dir: [0, 0, -1] }), playerPos: () => ({ x: 0, z: 0 }),
    now: () => clock, playing: () => playing, random: () => 0.5, meleeAssets: () => ({ animations: animations() }),
    sneaking: () => false, moving: () => false, renderHotbar() {}, markUnsaved() {}, toast() {},
    sound: (e) => sounds.push(e), onEvent: (e) => events.push(e),
  });
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { hooks.tick(); clock += 50; } };
  tick(4);
  return { hooks, target, hits, sounds, events, wall, tick, setPlaying: (p) => { playing = p; }, survival };
}
const cleanup = () => { setGunsEnabled(false, tables()); setMeleePacks(null); };

test("game hooks consume light/heavy input, delay hits, play sound keys and inspect on F without aiming", () => {
  const f = fixture();
  try {
    assert.equal(f.hooks.speed(), 1.05); assert.equal(f.hooks.fov(), 1);
    assert.equal(f.hooks.attack(true), true); f.hooks.attack(false); f.tick();
    assert.equal(f.hooks.view().clip, "melee_1"); assert.equal(f.hits.length, 0);
    f.tick(3); assert.equal(f.hits.length, 0); f.tick();
    assert.deepEqual(f.hits, [{ amount: 12, hurt: 0 }]); assert.ok(f.target.vz < 0);
    assert.ok(f.sounds.includes("guns.cs2_wt:melee_1"));
    f.tick(4); assert.equal(f.hooks.aimHold(true), true); f.hooks.aimHold(false); f.tick(5);
    assert.equal(f.hits[1].amount, 18); assert.equal(f.hooks.view().aim, 0);
    f.tick(4); assert.equal(f.hooks.key(33), true); assert.equal(f.hooks.view().clip, "inspect");
    assert.equal(f.hooks.hudState(), null);
  } finally { cleanup(); }
});

test("walls block knife damage; menus, reset and item switching cancel delayed attacks", () => {
  const f = fixture();
  try {
    for (let x = -2; x <= 2; x++) for (let y = -1; y <= 4; y++) f.wall.add(`${x},${y},-1`);
    f.hooks.tap(); f.tick(12); assert.equal(f.hits.length, 0);
    f.wall.clear(); f.hooks.tap(); f.tick(); f.setPlaying(false); f.tick(10); assert.equal(f.hits.length, 0);
    f.setPlaying(true); f.hooks.tap(); f.tick(); f.hooks.reset(); f.tick(12); assert.equal(f.hits.length, 0);
    f.hooks.tap(); f.tick(); f.survival.inventory.current = 1; f.tick(10); assert.equal(f.hits.length, 0);
    assert.equal(f.hooks.view(), null); assert.equal(f.hooks.attack(true), false); assert.equal(f.hooks.speed(), 1);
  } finally { cleanup(); }
});

test("touch heavy tap fires exactly once, and a new slash interrupts inspect", () => {
  const f = fixture();
  try {
    f.hooks.key(33); assert.equal(f.hooks.view().clip, "inspect");
    f.hooks.aimToggle(); f.tick(20);
    assert.equal(f.hits.length, 1); assert.equal(f.hits[0].amount, 18);
    assert.equal(f.events.filter((e) => e.type === "swing").length, 1);
    assert.equal(f.hooks.view().clip, "melee_3");
  } finally { cleanup(); }
});

test("animation layers return to idle, alternate idle clips and select slash variants", () => {
  const a = animations();
  assert.equal(meleeClip(a, "left", 0), "melee_1"); assert.equal(meleeClip(a, "left", 1), "melee_2");
  assert.equal(meleeClip(a, "right"), "melee_3");
  a.set("inspect_1", { length: 2, bones: new Map() });
  assert.equal(meleeClip(a, "inspect", 0, () => 0.99), "inspect_1");
  assert.equal(meleeLayers(a, { clip: "draw", sinceClip: 0.5, sinceDraw: 0.5 }).length, 2);
  assert.equal(meleeLayers(a, { clip: "draw", sinceClip: 1.1, sinceDraw: 1.1 }).length, 1);
  a.set("static_idle_1", { name: "static_idle_1", length: 2 });
  assert.equal(meleeLayers(a, { sinceDraw: 1.5 })[0][0].name, "static_idle_1");
});

test("model loader and both views build without private pack files or a browser", async () => {
  const geo = { "minecraft:geometry": [{ description: { texture_width: 16, texture_height: 16 }, bones: [
    { name: "weapon", pivot: [0, 0, 0], cubes: [{ origin: [-1, 0, 0], size: [2, 5, 1], uv: [0, 0] }] },
    { name: "idle_view", pivot: [0, 2, 8] }, { name: "thirdperson_hand", pivot: [0, 0, 0] },
  ] }] };
  const w = weapon(), a = await loadMeleeAssets(w, async (url) => url.endsWith("animation.json") ? { animations: {} } : geo);
  const material = (o) => new THREE.MeshBasicMaterial(o), texture = () => new THREE.Texture();
  const view = new PackMeleeView(w, a, { material, texture });
  assert.equal(view.root.userData.meleeId, 4603);
  assert.ok(view.update({ sinceDraw: 0 }).elements.every(Number.isFinite));
  const held = meleeHeldModel(w, a, material, texture);
  assert.equal(held.userData.meleeId, 4603); assert.equal(held.scale.x, 1 / 16);
  assert.equal(await loadMeleeAssets(w, async () => null), null);
  view.dispose();
});
