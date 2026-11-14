// Batch 64 mpwither2: the server wither's loose ends. The T in the Nether (per-dimension mob lists), the wither effect S1D / S1E for hit players, wither skulls saved across a restart,
// head targets among every player in range, level events 1012 / 1014 as S28 within 64 blocks. No sockets.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { makeStack } from "./inventory.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { dispenserAux } from "./multiplayer/client-containers.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { SKULL, ITEM_SKULL } from "./skull.js";
import { SOUL_SAND } from "./nether-blocks.js";
import { witherState } from "./wither-boss-mobs.js";

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const NETHERRACK = 150;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(saved = {}) {
  const world = new World("mp-wither-b64");
  for (let x = 14; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation(saved, { world, gameMode: "survival", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, id, n, x = 64.5, z = 64.5, y = 10) => { const p = s.addPlayer(id, id + "x", key(n)); p.position.copy({ x, y, z }); p.previous.copy(p.position); s.input(id, input()); s.tick(); p.survival.protection = 0; p.dispOut = null; p.itemsOut = null; p.mobPackets = null; return p; };
const clear = (...ps) => { for (const p of ps) { p.dispOut = null; p.itemsOut = null; p.mobPackets = null; } };

test("a Nether player builds a wither with the Nether's own mob list; only Nether players track it", { timeout: 120000 }, () => {
  const s = fixture();
  const a = s.addPlayer("a", "Alice", key(1)), b = join(s, "b", 2, 64.5, 64.5);
  s.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = s.dimensions.nether, w = n.world;
  n.mobs.spawning = false; n.mobs.mobs.entities.length = 0;
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 60; y <= 90; y++) w.put(x, y, z, y === 69 ? NETHERRACK : 0, 0, false);
  s.input("a", input());
  for (const x of [60, 61, 62]) w.put(x, 70, 64, SOUL_SAND, 0, false);
  w.put(61, 69, 64, SOUL_SAND, 0, false);
  for (const x of [60, 61]) { w.put(x, 71, 64, SKULL, 0, false); n.tileEntities.skulls.create(x, 71, 64, 1, 0); }
  a.position.copy({ x: 62.5, y: 73, z: 64.5 }); a.previous.copy(a.position);
  a.survival.inventory.main[0] = makeStack(ITEM_SKULL, 1, 1); a.survival.inventory.current = 0;
  a.yaw = 0; a.pitch = -Math.PI / 2; clear(a, b);
  s.queueEdit("a", { place: true });
  s.tick();
  const inNether = n.mobs.mobs.entities.filter(e => e.type === "wither"), inOver = s.mobs.mobs.entities.filter(e => e.type === "wither");
  assert.equal(inNether.length, 1, "the Nether's list holds it");
  assert.equal(inOver.length, 0, "the Overworld's does not");
  assert.ok(inNether[0].invul > 200 && Math.abs(inNether[0].health - 100) < 3);
  for (const x of [60, 61, 62]) assert.equal(w.get(x, 71, 64), 0, "skulls gone");
  assert.equal(n.tileEntities.skulls.tile(60, 71, 64), null, "the Nether's skull store was used");
  for (let i = 0; i < 4; i++) { s.input("a", input()); s.input("b", input()); s.tick(); }
  assert.ok((a.mobPackets ?? []).some(p => p.type === "spawn" && p.mob === "wither"), "the Nether player is sent it");
  assert.equal((b.mobPackets ?? []).some(p => p.type === "spawn" && p.mob === "wither"), false, "the Overworld player is not");
});

test("Peaceful refuses the T in any dimension (hooks carry the server difficulty)", () => {
  const s = fixture(); s.difficulty = 0;
  assert.equal(s.wither.hooks({ dimension: -1 }).difficulty, 0);
  s.difficulty = 3;
  assert.equal(s.wither.hooks({ dimension: -1 }).difficulty, 3, "a Nether click no longer forces 0");
});

test("a wither skull's wither effect and the wither skeleton's reach the player as S1D, and S1E when it ends", () => {
  const s = fixture(), a = join(s, "a", 1, 64.5, 66.5);
  const w = s.mobs.mobs.create("wither", 64.5, 10, 80.5); w.invul = 0; w.health = 300; s.mobs.mobs.entities.push(w);
  s.mobs.mobs.skulls.launch({ owner: w, x: 64.5, y: 12, z: 74, dx: 0, dy: -0.1, dz: -8 });
  const sent = [];
  for (let i = 0; i < 40 && !sent.length; i++) { s.tick(); sent.push(...s.serverSurvival.outgoing(a).filter(m => m.type === "healthEffect")); clear(a); }
  assert.ok(sent.some(m => m.id === 20 && m.amplifier === 1 && m.duration > 0), `S1D wither amplifier 1 (${JSON.stringify(sent)})`);
  a.survival.effects.remove(20);
  assert.ok(s.serverSurvival.outgoing(a).some(m => m.type === "healthEffectEnd" && m.id === 20), "S1E on removal");
  // the skeleton type: EntityWorld.attack path adds the same effect to the AI's survival, which is the player's object
  const view = s.mobs.views.get(a.id);
  view.survival.effects.add({ id: 20, duration: 200, amplifier: 0 });
  assert.ok(s.serverSurvival.outgoing(a).some(m => m.type === "healthEffect" && m.id === 20 && m.amplifier === 0), "an effect added through the AI's survival view is sent");
});

test("wither skulls survive a restart: saved as fireball records and restored into the mob list", () => {
  const s = fixture();
  join(s, "a", 1, 40.5, 40.5);
  const w = s.mobs.mobs.create("wither", 64.5, 10, 80.5); w.invul = 0; s.mobs.mobs.entities.push(w);
  s.mobs.mobs.skulls.launch({ owner: w, x: 64.5, y: 12, z: 74, dx: 0, dy: 0, dz: -8, blue: true });
  const rows = JSON.parse(JSON.stringify(s.dispense.save())).lanes?.[0]?.fireballs ?? [];
  assert.ok(rows.some(r => r.kind === "witherSkull" && r.blue === true), `saved (${JSON.stringify(rows)})`);
  const t = fixture({ projectiles: JSON.parse(JSON.stringify(s.dispense.save())) });
  join(t, "a", 1, 40.5, 40.5);
  const list = t.mobs.mobs._skulls?.list ?? [];
  assert.equal(list.filter(b => !b.dead).length >= 1, true, "a skull is back");
  assert.equal(list[0].blue, true);
});

test("head targets: both players in range become candidates, and a skull aimed past the nearer player hurts the one it reaches", () => {
  const s = fixture(), a = join(s, "a", 1, 60.5, 70.5), b = join(s, "b", 2, 70.5, 70.5);
  const w = s.mobs.mobs.create("wither", 65.5, 10, 78.5); w.invul = 0; w.health = 300; s.mobs.mobs.entities.push(w);
  const heads = new Set();
  for (let i = 0; i < 300; i++) {
    s.input("a", input()); s.input("b", input()); s.tick();
    const st = witherState(w);
    for (const h of [st.heads[1], st.heads[2]]) if (h?.isPlayer) heads.add(h);
    if (i % 12 === 11) st.heads[1] = st.heads[2] = null; // drop the held targets so the heads draw again
    a.survival.health = b.survival.health = 20; clear(a, b);
  }
  const views = [...s.mobs.views.values()].map(v => v.view);
  assert.ok(heads.has(views[0]) && heads.has(views[1]), `a side head took each player (${heads.size})`);
  // the sweep: a skull from far behind, aimed along x = 70.5 at b, with a standing nearer to its start
  const sm = s.mobs.mobs; sm.skulls.list.length = 0;
  w.health = 300; a.survival.health = b.survival.health = 20;
  const hpA = a.survival.health, hpB = b.survival.health;
  sm.skulls.launch({ owner: null, x: 62.5, y: 11.5, z: 90, dx: 8, dy: 0, dz: -20 });
  for (let i = 0; i < 40; i++) { s.tick(); clear(a, b); }
  assert.ok(b.survival.health < hpB, `the skull flew past a and hit b (${hpB} -> ${b.survival.health})`);
  assert.equal(a.survival.health, hpA, "a was not on its path");
});

test("1012 and 1014 are S28 level events within 64 blocks of this dimension's players; the client plays them at volume 2", () => {
  const s = fixture(), near = join(s, "a", 1, 64.5, 64.5), far = join(s, "b", 2, 100.5, 100.5);
  s.mobs.nearAux({ id: 1014, x: 60, y: 12, z: 50 }); // 114 blocks from the far player, 14 from the near one
  assert.deepEqual(near.itemsOut?.[0], { type: "aux", events: [{ id: 1014, x: 60, y: 12, z: 50, data: 0 }] });
  assert.equal(far.itemsOut?.length ?? 0, 0, "100 blocks away hears nothing");
  const played = [];
  for (const id of [1012, 1014]) assert.equal(dispenserAux({ id, x: 3, y: 4, z: 5, data: 0 }, { play: (...a) => played.push(a), smoke() {} }), true);
  assert.deepEqual(played.map(p => [p[0], p[1], p[2], p[3], p[4]]), [["mob.zombie.woodbreak", 3.5, 4.5, 5.5, 2], ["mob.wither.shoot", 3.5, 4.5, 5.5, 2]]);
});

test("a wither shot goes out as S28 1014, and its block sweep as 1012, not as S29 sounds", () => {
  const s = fixture(), a = join(s, "a", 1, 64.5, 66.5);
  const w = s.mobs.mobs.create("wither", 64.5, 12, 80.5); w.invul = 0; w.health = 300; s.mobs.mobs.entities.push(w);
  const ids = new Set(), sounds = [];
  for (let i = 0; i < 500 && !ids.has(1014); i++) {
    s.tick();
    for (const m of a.itemsOut ?? []) if (m.type === "aux") for (const e of m.events) ids.add(e.id);
    sounds.push(...(s.soundsOut ?? []).filter(x => x.name === "mob.wither.shoot"));
    clear(a); a.survival.health = 20;
  }
  assert.ok(ids.has(1014), "S28 1014 sent");
  assert.equal(sounds.length, 0, "no S29 mob.wither.shoot");
});
