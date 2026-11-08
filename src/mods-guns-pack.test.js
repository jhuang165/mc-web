// Guns mod (not 1.7.10): the TaCZ pack import (pack.js, install.js setGunPack), its Bedrock models and animations
// (bedrock.js, animation.js, pack-view.js) and the gun smith table (smith-screen.js). Every pack file here is a small
// synthetic stand-in: tests never read the Git-ignored pack under public/mods/tacz/.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { parseLenient } from "./mods/guns/json5.js";
import { bedrockGeometry, buildBedrockModel, boneMatrix, defaultVisibility } from "./mods/guns/bedrock.js";
import { parseAnimations, sampleTrack, Pose, poseModel, gunLayers } from "./mods/guns/animation.js";
import { taczGun, taczAmmo, taczRecipes, loadTaczPack, packUrl } from "./mods/guns/pack.js";
import { setGunPack, gunPack, gunSmithRecipes, creativeOrder } from "./mods/guns/install.js";
import { gunAssets, gunAssetsFailed, loadGunAssets, PackGunView, mirrorMagazine } from "./mods/guns/pack-view.js";
import { muzzleOverride, gunMuzzle } from "./mods/guns/model.js";
import { smithMatches, smithCount, canSmith, smithCraft } from "./mods/guns/smith-screen.js";
import { GUNS, AMMO, AKM, CREATIVE_ORDER, GUN_ITEMS } from "./mods/guns/catalog.js";
import { GunController } from "./mods/guns/firing.js";
import { TACZ_GUN_IDS, TACZ_AMMO_IDS } from "./mods/guns/ids.js";

const LANG = { "tacz.gun.glock_17.name": "§6Glock 17", "tacz.gun.minigun.name": "Minigun", "tacz.ammo.9mm.name": "9mm Round" };
const glockEntry = () => ({
  index: { name: "tacz.gun.glock_17.name", type: "pistol", sort: 2, data: "tacz:glock_17_data", display: "tacz:glock_17_display" },
  data: {
    ammo: "tacz:9mm", ammo_amount: 17, rpm: 600, fire_mode: ["semi", "burst"], burst_data: { count: 3, bpm: 1200, min_interval: 0.3 },
    bullet: { damage: 6, extra_damage: { head_shot_multiplier: 1.5, damage_adjust: [{ distance: 10, damage: 6 }, { distance: 30, damage: 4 }] } },
    reload: { type: "magazine", cooldown: { tactical: 1.5, empty: 2 } }, draw_time: 0.4, bolt: "closed_bolt",
  },
  display: { model: "tacz:gun/glock_17_geo", texture: "tacz:gun/uv/glock_17", slot: "tacz:gun/slot/glock_17", animation: "tacz:glock_17",
    use_default_animation: "pistol", iron_zoom: 1.2, model_fov: 60, zoom_model_fov: 40, sounds: { shoot: "tacz:glock_17/glock_17_shoot" } },
});
const minigunEntry = () => ({
  index: { name: "tacz.gun.minigun.name", type: "mg", data: "x", display: "y" },
  data: { ammo: "tacz:9mm", ammo_amount: 0, rpm: 1200, fire_mode: ["auto"], bullet: { damage: 4 }, reload: { type: "inventory" } },
  display: { model: "tacz:gun/minigun_geo", texture: "tacz:gun/uv/minigun" },
});
const rawPack = () => ({
  index: {}, lang: LANG,
  guns: { glock_17: glockEntry(), minigun: minigunEntry() },
  ammo: { "9mm": { index: { name: "tacz.ammo.9mm.name", stack_size: 60 }, display: { slot: "tacz:ammo/slot/9mm" } } },
  recipes: [
    { name: "glock_17", result: { type: "gun", id: "tacz:glock_17" }, materials: [
      { item: { tag: "forge:ingots/iron" }, count: 12 }, { item: { tag: "forge:nuggets/iron" }, count: 10 }, { item: { tag: "minecraft:logs" }, count: 2 }] },
    { name: "9mm", result: { type: "ammo", id: "tacz:9mm", count: 30 }, materials: [{ item: { tag: "forge:gunpowder" }, count: 1 }, { item: { tag: "forge:gems/lapis" }, count: 1 }, { item: { tag: "forge:ingots/copper" }, count: 2 }] },
    { name: "odd", result: { type: "gun", id: "tacz:glock_17" }, materials: [{ item: { item: "minecraft:obsidian_unknown" }, count: 1 }] },
  ],
});

test("pack files parse with comments and trailing commas, strings untouched", () => {
  assert.deepEqual(parseLenient('{ // note\n "a": "http://x/*y*/", /* gone */ "b": [1, 2,], }'), { a: "http://x/*y*/", b: [1, 2] });
  assert.deepEqual(parseLenient('{"q": "say \\"hi\\" // not a comment"}'), { q: 'say "hi" // not a comment' });
});

test("a pack gun converts to this game's gun shape", () => {
  const g = taczGun("glock_17", glockEntry(), LANG);
  assert.equal(g.id, TACZ_GUN_IDS.glock_17);
  assert.equal(g.name, "Glock 17"); // formatting codes stripped
  assert.equal(g.ammo, TACZ_AMMO_IDS["9mm"]);
  assert.equal(g.magazine, 17);
  assert.deepEqual(g.modes, ["semi", "burst"]);
  assert.deepEqual(g.burst, { count: 3, bpm: 1200, minInterval: 0.3, continuous: false });
  assert.deepEqual(g.damage, [[10, 6], [30, 4], [Infinity, 4]]);
  assert.equal(g.headshot, 1.5);
  assert.deepEqual(g.reload, { kind: "magazine", tactical: 1.5, empty: 2 });
  assert.equal(g.sounds.shoot, "glock_17/glock_17_shoot");
  assert.equal(g.pack.modelFov, 60);
  assert.equal(g.pack.defaultAnimation, "pistol");
  assert.equal(taczGun("minigun", minigunEntry(), LANG).feed, "inventory");
  assert.equal(taczGun("not_a_pack_gun", glockEntry(), LANG), null);
  assert.equal(packUrl.geo("tacz:gun/glock_17_geo"), "/mods/tacz/pack/assets/tacz/geo_models/gun/glock_17_geo.json");
});

test("pack recipes map materials to this game's items, merging and dropping unknowns", () => {
  const r = taczRecipes(rawPack());
  assert.equal(r.length, 2); // the recipe with an unknown material is dropped
  const glock = r.find((x) => x.key === "glock_17");
  assert.deepEqual(glock.materials, [{ item: 302, count: 14 }, { item: "log", count: 2 }]); // 10 nuggets round up to 2 ingots
  const ammo = r.find((x) => x.key === "9mm");
  assert.equal(ammo.count, 30);
  assert.deepEqual(ammo.materials, [{ item: 330, count: 1 }, { item: 351, damage: 4, count: 1 }, { item: 301, count: 2 }]); // copper is coal or charcoal
  assert.equal(taczAmmo("9mm", rawPack().ammo["9mm"], LANG).stack, 60);
});

test("loadTaczPack returns null when the pack is not installed", async () => {
  assert.equal(await loadTaczPack(async () => null), null);
});

test("setGunPack adds the pack's guns, ammo, recipes and placeholders, and undoes them", () => {
  try {
    const p = setGunPack(rawPack());
    const glock = TACZ_GUN_IDS.glock_17, nine = TACZ_AMMO_IDS["9mm"];
    assert.equal(p.installed, true);
    assert.equal(GUNS[glock].name, "Glock 17");
    assert.equal(AMMO[nine].name, "9mm Round");
    assert.equal(gunSmithRecipes().length, 5); // the pack's two entries plus the three fallback guns
    assert.deepEqual(creativeOrder().slice(0, CREATIVE_ORDER.length), CREATIVE_ORDER);
    assert.ok(creativeOrder().includes(glock));
    const items = new Map(gunPack().items.map((i) => [i.id, i]));
    assert.equal(items.get(glock).iconUrl, packUrl.texture("tacz:gun/slot/glock_17"));
    assert.equal(items.get(TACZ_GUN_IDS.rpg7).missingPack, true); // not in this pack: kept as a placeholder
    assert.equal(items.get(AKM), undefined); // the hand-made guns stay in catalog.js
  } finally {
    setGunPack(null);
  }
  assert.equal(GUNS[TACZ_GUN_IDS.glock_17], undefined);
  assert.equal(AMMO[TACZ_AMMO_IDS["9mm"]], undefined);
  assert.equal(gunSmithRecipes().length, 3); // fallback guns remain craftable at the table without a pack
  assert.ok(gunPack().items.every((i) => i.missingPack)); // without the pack every pack id is a placeholder
});

test("with the pack, the hand-made guns use its slot icons; without it, their own", () => {
  const akm = GUN_ITEMS.find((i) => i.id === AKM);
  const entry = glockEntry();
  try {
    setGunPack({ ...rawPack(), guns: { ...rawPack().guns, ak47: entry } });
    assert.ok(GUNS[AKM].pack.slot);
    assert.equal(akm.iconUrl, packUrl.texture(GUNS[AKM].pack.slot));
  } finally { setGunPack(null); }
  assert.equal(akm.iconUrl, "/media/mods/guns/akm.png");
});

test("burst fire: count rounds at the burst rate, then the minimum interval", () => {
  try {
    setGunPack(rawPack());
    const id = TACZ_GUN_IDS.glock_17, stack = { id, count: 1, damage: 0 }, c = new GunController();
    const ctx = { held: stack, slot: 0, creative: false, count: () => 0, take: () => false };
    c.modes[id] = "burst";
    for (let i = 0; i < 8; i++) c.tick(ctx); // draw
    c.press();
    const shots = [];
    for (let t = 0; t < 40; t++) if (c.tick(ctx).some((e) => e.type === "shot")) shots.push(t);
    assert.equal(shots.length, 3); // one burst per trigger pull
    assert.deepEqual(shots.slice(1).map((t, i) => t - shots[i]), [1, 1]); // 1200 bpm: a tick apart
    assert.equal(stack.damage, 3);
    c.release(); c.press();
    const next = [];
    for (let t = 0; t < 40; t++) if (c.tick(ctx).some((e) => e.type === "shot")) next.push(t);
    assert.equal(next.length, 3);
  } finally { setGunPack(null); }
});

test("an inventory-fed gun fires the ammo carried, never reloads, and runs dry with it", () => {
  try {
    setGunPack(rawPack());
    const id = TACZ_GUN_IDS.minigun, nine = TACZ_AMMO_IDS["9mm"], stack = { id, count: 1, damage: 0 }, c = new GunController();
    let carried = 5;
    const ctx = { held: stack, slot: 0, creative: false, count: (a) => (a === nine ? carried : 0), take: (a, n) => (carried -= n, true) };
    assert.equal(c.startReload(ctx), false);
    for (let i = 0; i < 20; i++) c.tick(ctx);
    c.press();
    const events = [];
    for (let i = 0; i < 40; i++) events.push(...c.tick(ctx));
    assert.equal(events.filter((e) => e.type === "shot").length, 5);
    assert.equal(carried, 0);
    assert.equal(stack.damage, 0);
    assert.ok(events.some((e) => e.type === "empty"));
  } finally { setGunPack(null); }
});

// A two-bone model: root, and `b` (pivot [2, 4, 0]) with one cube 2 x 1 x 1 at x 1..3.
const GEO = { "minecraft:geometry": [{ description: { texture_width: 32, texture_height: 32 }, bones: [
  { name: "root", pivot: [0, 0, 0] },
  { name: "b", parent: "root", pivot: [2, 4, 0], cubes: [{ origin: [1, 4, 0], size: [2, 1, 1], uv: { north: { uv: [0, 0], uv_size: [2, 1] } } }] },
  { name: "mag_extended_1", parent: "root", pivot: [0, 0, 0] },
] }] };

test("bedrock geometry mirrors x and places bones at their pivots", () => {
  const geo = bedrockGeometry(GEO);
  assert.equal(geo.width, 32);
  const model = buildBedrockModel(geo, () => new THREE.MeshBasicMaterial(), { hidden: defaultVisibility(geo) });
  const at = new THREE.Vector3().setFromMatrixPosition(boneMatrix(model, "b"));
  assert.deepEqual(at.toArray(), [-2, 4, 0]);
  const box = new THREE.Box3().setFromBufferAttribute(model.meshes.get("b").geometry.attributes.position);
  assert.deepEqual([box.min.x, box.max.x], [-1, 1]); // x -3..-1 mirrored, relative to the pivot at -2
  assert.equal(model.bones.get("mag_extended_1").visible, false); // extended magazines are attachments
  assert.equal(bedrockGeometry({}), null);
});

const ANIM = { animations: {
  reload_tactical: { animation_length: 1, bones: { b: { rotation: { "0": [0, 0, 0], "1": [10, 0, 0] } } },
    sound_effects: { "0.5": { effect: "tacz:glock_17/mag_in" }, "0.1": { effect: "tacz:glock_17/mag_out" } } },
  static_idle: { loop: true, bones: { b: { position: [0, 1, 0] } } },
  shoot: { animation_length: 0.2, bones: { b: { position: { "0": [0, 0, 1], "0.2": [0, 0, 0] } } } },
  step: { bones: { b: { rotation: { "0": { post: [5, 0, 0], lerp_mode: "step" }, "1": [9, 0, 0] } } } },
} };

test("animations interpolate keyframes and list their sound effects in time order", () => {
  const a = parseAnimations(ANIM);
  const rot = a.get("reload_tactical").bones.get("b").rotation;
  assert.deepEqual(sampleTrack(rot, 0.5), [5, 0, 0]);
  assert.deepEqual(sampleTrack(rot, 2), [10, 0, 0]);
  assert.deepEqual(sampleTrack(a.get("step").bones.get("b").rotation, 0.9), [5, 0, 0]);
  assert.deepEqual(a.get("reload_tactical").sounds, [[0.1, "glock_17/mag_out"], [0.5, "glock_17/mag_in"]]);
  assert.equal(a.get("static_idle").loop, true);
  const model = buildBedrockModel(bedrockGeometry(GEO), () => new THREE.MeshBasicMaterial());
  poseModel(model, [[a.get("reload_tactical"), 0.5, "set"]], new Pose());
  assert.ok(Math.abs(model.bones.get("b").rotation.x + (5 * Math.PI) / 180) < 1e-9); // Bedrock x is negated
});

test("gun layers: idle under a reload, the shoot animation added after a shot", () => {
  const a = parseAnimations(ANIM);
  const idle = gunLayers(a, null, { sinceDraw: Infinity, sinceShot: Infinity, empty: false, mode: "semi", bolt: "closed_bolt", timeline: null });
  assert.deepEqual(idle.map(([x]) => x.name), ["static_idle"]);
  const reload = gunLayers(a, null, { sinceDraw: Infinity, sinceShot: Infinity, empty: true, timeline: { kind: "magazine", since: 0.3, empty: true } });
  assert.deepEqual(reload.map(([x, t]) => [x.name, t]), [["static_idle", 0], ["reload_tactical", 0.3]]); // no reload_empty: the tactical one
  const shot = gunLayers(a, null, { sinceDraw: Infinity, sinceShot: 0.05, empty: false, timeline: null });
  assert.deepEqual(shot.map(([x, , m]) => [x.name, m]), [["static_idle", "set"], ["shoot", "add"]]);
});

test("a finished or never-played inspect does not cover the bolt catch (TaCZ PLAY_ONCE_STOP)", () => {
  const a = parseAnimations({ animations: {
    static_idle: { loop: true, bones: { root: { position: [0, 0, 0] } } },
    static_bolt_caught: { loop: true, animation_length: 0.5, bones: { slide: { position: [0, 0, 2.25] } } },
    inspect: { loop: "hold_on_last_frame", animation_length: 6, bones: { slide: { position: { "0": [0, 0, 0], "6": [0, 0, 0] } } } },
    shoot: { animation_length: 0.6, bones: { slide: { position: { "0": [0, 0, 0], "0.03": [0, 0, 2.5], "0.06": [0, 0, 0] } } } },
  } });
  const names = (s) => gunLayers(a, null, { sinceDraw: Infinity, sinceShot: Infinity, timeline: null, mode: "semi", ...s }).map(([x]) => x.name);
  assert.deepEqual(names({ empty: true, sinceInspect: Infinity }), ["static_idle", "static_bolt_caught"]); // never inspected
  assert.deepEqual(names({ empty: true, sinceInspect: 9 }), ["static_idle", "static_bolt_caught"]); // inspect ended
  assert.deepEqual(names({ empty: false, sinceInspect: 2 }), ["static_idle", "inspect"]); // inspect playing
  const pose = new Pose();
  const slide = (s) => { pose.clear(); for (const [x, t, m] of gunLayers(a, null, { sinceDraw: Infinity, sinceShot: Infinity, timeline: null, sinceInspect: Infinity, ...s })) pose.apply(x, t, m); return pose.bones.get("slide")?.position[2] ?? 0; };
  assert.equal(slide({ empty: false }), 0); // rounds left: slide forward
  assert.equal(slide({ empty: true }), 2.25); // empty: locked back
});

// The fake pack's files for one gun: a model with idle_view, iron_view and muzzle_flash bones.
const VIEW_GEO = { "minecraft:geometry": [{ description: {}, bones: [
  { name: "root", pivot: [0, 0, 0] },
  { name: "idle_view", parent: "root", pivot: [0, 10, -20] },
  { name: "iron_view", parent: "root", pivot: [0, 12, -24] },
  { name: "muzzle_flash", parent: "root", pivot: [0, 10, -40] },
  { name: "righthand_pos", parent: "root", pivot: [-3, 4, -8] },
] }] };
const viewGun = () => ({ ...taczGun("glock_17", glockEntry(), LANG), flash: null });

test("gun assets load once, report arrival, and take reload sounds from the animations", async () => {
  const gun = viewGun(), urls = [];
  const load = async (url) => { urls.push(url); return url.includes("geo_models") ? VIEW_GEO : url.endsWith("glock_17.animation.json") ? ANIM : null; };
  let arrived = 0;
  assert.equal(gunAssets(gun, () => arrived++, load), null);
  assert.equal(gunAssets(gun, () => arrived++, load), null); // the same load, not a second one
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(arrived, 2);
  const a = gunAssets(gun, undefined, load);
  assert.ok(a.geo && a.animations.has("reload_tactical"));
  assert.equal(urls.filter((u) => u.includes("geo_models")).length, 1);
  assert.deepEqual(gun.sounds.tactical, [[0.1, "glock_17/mag_out"], [0.5, "glock_17/mag_in"]]);
  assert.deepEqual(gun.sounds.empty, gun.sounds.tactical); // no reload_empty: the tactical keys
  const broken = { ...viewGun(), id: 99999 };
  gunAssets(broken, undefined, async () => null);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(gunAssetsFailed(broken), true);
});

test("a gun's display clips for inspect and reload play with its keyframes (TaCZ SoundPlayManager)", async () => {
  const entry = glockEntry();
  entry.display.sounds = { ...entry.display.sounds, inspect: "tacz:mk14/mk14_inspect", inspect_empty: "tacz:mk14/mk14_inspect_empty", reload_tactical: "tacz:mk14/mk14_reload_tactical" };
  const gun = { ...taczGun("glock_17", entry, LANG), flash: null };
  const anim = { animations: { inspect: { animation_length: 2, bones: {} }, reload_tactical: { animation_length: 2, bones: {}, sound_effects: { "0.4": { effect: "tacz:mk14/mag_out" } } } } };
  const a = await loadGunAssets(gun, async (url) => (url.includes("geo_models") ? VIEW_GEO : url.endsWith(".animation.json") && !url.includes("_default") ? anim : null));
  assert.ok(a);
  assert.deepEqual(gun.inspectSounds, { full: [[0, "mk14/mk14_inspect"]], empty: [[0, "mk14/mk14_inspect_empty"]] });
  assert.deepEqual(gun.sounds.tactical, [[0, "mk14/mk14_reload_tactical"], [0.4, "mk14/mag_out"]]);
  assert.deepEqual(gun.sounds.empty, gun.sounds.tactical); // no reload_empty clip or keys: the tactical ones
});

test("the first-person pack view puts the camera at idle_view, moving to iron_view as it aims", () => {
  const gun = viewGun(), geo = bedrockGeometry(VIEW_GEO);
  const view = new PackGunView(gun, { geo, animations: new Map(), defaults: new Map() }, {
    material: (o) => new THREE.MeshBasicMaterial(o), texture: () => null, arm: () => new THREE.Mesh(new THREE.BoxGeometry(4, 12, 4)),
  });
  try {
    const state = { sinceShot: Infinity, empty: false, aim: 0, timeline: null };
    view.update(state);
    assert.deepEqual(view.muzzle.map((v) => +v.toFixed(6)), [0, 0, -1.25]); // 20 px in front of the camera, in blocks
    assert.deepEqual(gunMuzzle(gun.id), view.muzzle);
    view.update({ ...state, aim: 1 });
    assert.deepEqual(view.muzzle.map((v) => +v.toFixed(6)), [0, -0.125, -1]);
    assert.equal(view.fov(0), 60);
    assert.equal(view.fov(1), 40);
    assert.equal(view.model.bones.get("righthand_pos").children.length, 1); // the player's arm, placed with no placeholder cube
  } finally {
    view.dispose();
  }
  assert.equal(muzzleOverride.has(gun.id), false);
});

test("the gun smith crafts from carried materials: any log, exact dye, guns unloaded", () => {
  const LOG = 4, ACACIA = 70, IRON = 302, DYE = 351;
  const slots = [{ id: IRON, count: 10, damage: 0 }, { id: IRON, count: 10, damage: 0 }, { id: ACACIA, count: 1, damage: 1 }, { id: LOG, count: 3, damage: 2 }, { id: DYE, count: 5, damage: 0 }];
  assert.equal(smithMatches(slots[2], { item: "log" }), true);
  assert.equal(smithMatches(slots[4], { item: DYE, damage: 4 }), false); // ink sac is not lapis
  assert.equal(smithMatches({ id: 301, count: 1, damage: 1 }, { item: 301 }), true); // charcoal stands in for copper too
  assert.equal(smithCount(slots, { item: "log" }), 4);
  const glock = { output: 4114, count: 1, materials: [{ item: IRON, count: 14 }, { item: "log", count: 2 }] };
  const lapis = { output: 4220, count: 30, materials: [{ item: DYE, damage: 4, count: 1 }] };
  assert.equal(canSmith(slots, lapis), false);
  assert.equal(smithCraft(slots, lapis), null);
  try {
    setGunPack(rawPack());
    const out = smithCraft(slots, glock);
    assert.deepEqual(out, { id: 4114, count: 1, damage: 17 }); // all 17 rounds counted as fired
    assert.deepEqual(slots.map((s) => s?.count ?? null), [null, 6, null, 2, 5]);
    assert.equal(slots[0], null);
    assert.equal(slots[1].count, 6);
    assert.equal(slots[2], null); // the acacia log went first
    assert.equal(slots[3].count, 2);
  } finally { setGunPack(null); }
  const ammo = smithCraft([{ id: DYE, count: 1, damage: 4 }], lapis);
  assert.deepEqual(ammo, { id: 4220, count: 30, damage: 0 });
});

test("the outgoing magazine is a copy of the fitted magazine drawn in the additional_magazine bone (TaCZ)", () => {
  const cube = (origin) => ({ origin, size: [1, 2, 1], uv: { north: { uv: [0, 0], uv_size: [1, 2] } } });
  const geo = { width: 16, height: 16, bones: [
    { name: "root", pivot: [0, 0, 0] },
    { name: "additional_magazine", parent: "root", pivot: [0, 4, 2] },
    { name: "magazine", parent: "root", pivot: [0, 4, 2] },
    { name: "mag_standard", parent: "magazine", pivot: [0, 3, 2], cubes: [cube([0, 1, 2])] },
    { name: "mag_extended_1", parent: "magazine", pivot: [0, 3, 2], cubes: [cube([0, 0, 2])] },
  ] };
  const mat = new THREE.MeshBasicMaterial();
  const model = buildBedrockModel(geo, () => mat, { hidden: (n) => n === "mag_standard" });
  const mirror = mirrorMagazine(model);
  const out = model.bones.get("additional_magazine");
  const ext = mirror.copy.getObjectByName("mag_extended_1"), std = mirror.copy.getObjectByName("mag_standard");
  assert.equal(mirror.copy.parent, out);
  assert.ok(ext && std);
  model.bones.get("mag_extended_1").position.y += 1;
  mirror.sync();
  assert.equal(std.visible, false, "the hidden standard magazine stays hidden in the copy");
  assert.equal(ext.visible, true);
  assert.deepEqual(ext.position.toArray(), model.bones.get("mag_extended_1").position.toArray());
  const meshOf = (g) => g.children.find((c) => c.isMesh);
  assert.equal(meshOf(ext).geometry, meshOf(model.bones.get("mag_extended_1")).geometry, "geometry is shared");
  assert.equal(mirrorMagazine(buildBedrockModel({ width: 16, height: 16, bones: [{ name: "magazine", pivot: [0, 0, 0] }] }, () => mat)), null);
});
