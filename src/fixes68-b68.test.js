// Batch 68 (fixes68): the lying player's eye and box in explosions and mob sight, the bed blast's call, a TNT cart that never ticked struck by lightning,
// and the world Random for the player's own bone meal click (single player and server). Bytecode-read facts are in the track note; no sockets, no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World, DYE, PHYSICS, BED } from './world.js';
import { Survival } from './survival.js';
import { Farming } from './farming.js';
import { Trees } from './trees.js';
import { JavaRandom } from './java-random.js';
import { makeStack } from './inventory.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { useOnBlock } from './multiplayer/server-use.js';
import { applyPlayerEdit } from './player-edit-simulation.js';
import { LightningBolt } from './weather.js';
import { explosionImpact } from './explosion.js';
import { serverPosY, serverEyeY, SLEEP_BOX } from './sleeper-eye.js';
import { bedExplosion } from './dimension-live.js';
import { BedSleep } from './bed.js';
import { fromOriginal } from './block-registry.js';
const mushroom = (w, x, y, z) => { const m = fromOriginal(39, 0); w.put(x, y, z, m.id, m.meta, false); }; // native brown mushroom

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(name = 'fixes68') {
  const world = new World(name);
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, x = 64.5, z = 64.5) => { const p = s.addPlayer('a', 'ax', key(1)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input('a', input()); s.tick(); p.survival.protection = 0; return p; };

test('sleeper-eye: posY is minY + 0.2 while lying and the eye is posY + 1.62 (yz.a(III) yOffset 0.2, mw.g 1.62)', () => {
  assert.equal(serverPosY(10, false), 10);
  assert.equal(serverEyeY(10, false), 10 + Math.fround(1.62));
  assert.equal(serverPosY(10.7375, true), 10.7375 + Math.fround(0.2));
  assert.equal(serverEyeY(10.7375, true), 10.7375 + Math.fround(0.2) + Math.fround(1.62));
  const bed = new BedSleep(), w = new World('b68-bed');
  w.put(5, 10, 5, BED, 8, false);
  bed.begin(w, 5, 10, 5, { player: { x: 5, y: 10, z: 5, alive: true }, daytime: false });
  assert.ok(Math.abs(bed.boxY - 10.7375) < 1e-6);
  assert.ok(Math.abs(serverPosY(bed.boxY, true) - bed.pos.y) < 1e-6, 'posY is the head position + 0.9375');
});

test('the bed blast is BlockBed.onBlockActivated: head centre, power 5 (bedExplosion); the server hands it flaming and smoking', () => {
  const w = new World('b68-bed2');
  w.put(5, 10, 5, BED, 8, false); w.put(5, 10, 6, BED, 0, false);
  const boom = bedExplosion({ ...w, get: (...a) => w.get(...a), getMeta: (...a) => w.getMeta(...a), put: (...a) => w.put(...a), dimension: -1, rules: { bedExplodes: true } }, 5, 10, 5);
  assert.ok(boom, 'the Nether blast happens');
  assert.equal(boom.size, 5); assert.equal(boom.x, 5.5); assert.equal(boom.y, 10.5); assert.equal(boom.z, 5.5);
});

test('a server explosion takes a sleeper at posY = minY + 0.2 with the 0.2 box and the lying eye (Explosion.doExplosionA)', () => {
  const s = fixture(), p = join(s);
  const cx = 64.5, cy = 10.2, cz = 67.5;
  const lie = (on) => { p.sleeping = on; p.position.copy({ x: 64.5, y: on ? 10.7375 : 10, z: 64.5 }); p.survival.health = 20; p.survival.fire = 0; };
  lie(true);
  const want = explosionImpact(s.world, cx, cy, cz, 4, 64.5, serverPosY(10.7375, true), 64.5, serverEyeY(10.7375, true),
    [64.4, 10.7375, 64.4, 64.6, 10.9375, 64.6]);
  const stand = explosionImpact(s.world, cx, cy, cz, 4, 64.5, 10.7375, 64.5, 10.7375 + Math.fround(1.62), [64.2, 10.7375, 64.2, 64.8, 12.5375, 64.8]);
  const v0 = { ...p.velocity };
  s.mobs.explode({ x: cx, y: cy, z: cz, size: 4, source: null });
  assert.ok(want, 'the blast reaches the sleeper');
  {
    const lost = 20 - p.survival.health;
    assert.ok(lost > 0);
    assert.notDeepEqual(p.velocity.y - v0.y, stand?.push?.[1] ?? NaN, 'not the standing box and eye');
    assert.ok(Math.abs((p.velocity.y - v0.y) - want.push[1]) < 1e-6, 'the push follows the lying eye');
  }
  assert.equal(SLEEP_BOX, Math.fround(0.2));
});

test('a mob sees a lying player at posY + 1.62 above the lying box: PlayerView.eyeHeight', () => {
  const s = fixture(), p = join(s);
  s.tick();
  const view = s.mobs.views.get('a').view;
  assert.equal(view.eyeHeight, Math.fround(1.62));
  p.sleeping = true; p.position.copy({ x: 64.5, y: 10.7375, z: 64.5 });
  s.tick();
  assert.equal(view.eyeHeight, Math.fround(0.2) + Math.fround(1.62));
  assert.equal(view.width, Math.fround(0.2));
  p.sleeping = false; s.tick();
  assert.equal(view.eyeHeight, Math.fround(1.62));
});

test('a TNT cart that never ticked explodes when a bolt strikes it (fire damage, killMinecart)', () => {
  const s = fixture(), v = s.vehicles;
  let blasts = 0; const was = s.mobs.explode.bind(s.mobs); s.mobs.explode = ev => { blasts++; return was(ev); };
  const cart = v.spawnVehicle('tnt_minecart', 64.5, 10, 64.5);
  assert.equal(v.carts.host ?? null, null, 'no tick has run');
  s.lightning.strike(new LightningBolt(64.5, 10, 64.5, new JavaRandom(7), s.fire.strikes));
  assert.equal(cart.dead, true);
  assert.equal(blasts, 1);
  assert.equal(v.carts.host ?? null, null, 'the temporary host is removed again');
});

test('the server bone meal click draws from the world Random (sim.weather.random), not a private stream', () => {
  const s = fixture(), p = join(s);
  p.survival.inventory.main[0] = makeStack(DYE, 10, 15); p.survival.inventory.current = 0;
  mushroom(s.world, 64, 10, 64); // a mushroom: one nextFloat for the 0.4 gate
  let draws = 0; const r = s.weather.random, f = r.nextFloat.bind(r); r.nextFloat = () => { draws++; return f(); };
  assert.equal(useOnBlock(s, p, { block: [64, 10, 64], adjacent: [64, 11, 64] }, DYE), true);
  assert.ok(draws >= 1, `world Random draws: ${draws}`);
});

test('the single-player bone meal click draws from state.worldRand', () => {
  const world = new World('b68-sp');
  for (let x = 40; x <= 50; x++) for (let z = 40; z <= 50; z++) world.put(x, 10, z, 1, 0, false);
  mushroom(world, 45, 10, 45);
  const survival = new Survival({ food: 10, slots: [] }, 'survival');
  survival.inventory.main[0] = makeStack(DYE, 10, 15); survival.inventory.current = 0;
  const worldRand = new JavaRandom(5); let draws = 0; const f = worldRand.nextFloat.bind(worldRand); worldRand.nextFloat = () => { draws++; return f(); };
  const state = { screen: 'playing', heldTool: DYE, world, survival, position: { x: 45.5, y: 11, z: 43.5 }, velocity: { x: 0, y: 0, z: 0 }, motion: { sneaking: false, sprinting: false },
    mobs: {}, farming: new Farming(world), trees: new Trees(world, { random: new JavaRandom(1) }), fire: {}, grounded: true, fallDistance: 0, wasInWater: false, yaw: 0,
    eating: null, mining: null, mineCooldown: 0, mineHeld: true, flowers: {}, boneRandom: new JavaRandom(2), itemRand: new JavaRandom(3), worldRand, items: { spawn() {}, items: [] } };
  const out = applyPlayerEdit(state, { place: true, target: { block: [45, 10, 45], adjacent: [45, 11, 45] } }, {});
  assert.equal(out.handled, true);
  assert.ok(draws >= 1, `world Random draws: ${draws} (${out.branch})`);
});
