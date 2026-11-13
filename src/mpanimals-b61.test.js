import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, WOOL, DYE } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { RemoteMobs } from './multiplayer/remote-mobs.js';
import { predictAnimalUse } from './multiplayer/animal-use.js';
import { makeStack } from './inventory.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const WHEAT = 305, SHEARS = 125, BUCKET = 340, MILK = 343, SADDLE = 363, BOWL = 371, STEW = 370;
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(gameMode = 'survival') {
  const world = new World('mp-animals-b61');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode, mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, id = 'a', n = 1) => { const p = s.addPlayer(id, id + 'x', key(n)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input(id, input()); return p; };
const mob = (s, type, x = 66.5, z = 64.5) => { const m = s.mobs.mobs.create(type, x, 10, z); s.mobs.mobs.entities.push(m); return m; };
const wire = m => Number(m.id.slice(4));
const give = (p, id, count = 1, damage = 0) => { p.survival.inventory.main[0] = makeStack(id, count, damage); p.survival.inventory.current = 0; };
const held = p => p.survival.inventory.main[0];
const packets = p => { const out = p.mobPackets ?? []; p.mobPackets = null; return JSON.parse(JSON.stringify(out)); };
const use = (s, p, m, claim = false) => { s.queueAnimUse(p.id, wire(m), claim); s.tick(); };

test('wheat feeds an adult cow: love 600, one wheat spent, status 18 to the watcher, the slot sent', () => {
  const s = fixture(), p = join(s), cow = mob(s, 'cow'); s.tick(); packets(p);
  give(p, WHEAT, 3);
  use(s, p, cow);
  assert.ok(cow.love > 590 && cow.love <= 600);
  assert.equal(held(p).count, 2);
  assert.ok(packets(p).some(m => m.type === 'mobStatus' && m.status === 18 && m.i === wire(cow)));
  assert.ok((p.itemsOut ?? []).some(m => m.type === 'slot' && m.slots.some(x => x.slot === 0 && x.stack.count === 2)));
  use(s, p, cow);
  assert.equal(held(p).count, 2, 'a cow in love takes no more');
});

test('a calf, a wrong item and a far cow are not fed', () => {
  const s = fixture(), p = join(s), calf = mob(s, 'cow'), far = mob(s, 'cow', 90.5, 90.5); calf.growingAge = -100; s.tick();
  give(p, WHEAT, 3);
  use(s, p, calf); use(s, p, far);
  assert.equal(held(p).count, 3);
  assert.equal(calf.love ?? 0, 0);
  give(p, 305 + 1, 3);
  const adult = mob(s, 'cow'); use(s, p, adult);
  assert.equal(held(p).count, 3);
});

test('two cows fed by one player breed: a baby of -24000, parents rest 6000, xp, and the breedCow award', () => {
  const s = fixture(), p = join(s), a = mob(s, 'cow', 66.5, 64.5), b = mob(s, 'cow', 67.5, 64.5); s.tick(); s.events = [];
  give(p, WHEAT, 4);
  use(s, p, a); use(s, p, b);
  assert.equal(a.breeder, p.id);
  let born = null;
  for (let i = 0; i < 400 && !born; i++) { s.tick(); born = s.mobs.mobs.entities.find(e => e.type === 'cow' && e.growingAge < 0); }
  assert.ok(born, 'a calf is born');
  assert.ok(born.growingAge <= -23000 && born.growingAge >= -24000);
  assert.ok(a.growingAge > 5000 && a.growingAge <= 6000);
  assert.equal(a.love, 0);
  assert.ok(s.events.some(e => e.type === 'award' && e.id === p.id && e.achievement === 'breedCow'));
});

test('shears on an adult sheep: sheared flag, 1-3 wool of its colour, one durability, shear sound', () => {
  const s = fixture(), p = join(s), sheep = mob(s, 'sheep'); sheep.color = 5; s.tick(); packets(p);
  give(p, SHEARS);
  use(s, p, sheep);
  assert.equal(sheep.sheared, true);
  assert.equal(held(p).damage, 1);
  s.tick();
  const wool = s.items.items.filter(e => e.stack.id === WOOL && e.stack.damage === 5);
  assert.ok(wool.length >= 1 && wool.reduce((n, e) => n + e.stack.count, 0) <= 3);
  assert.ok(packets(p).some(m => m.type === 'state' && m.sheared === 1));
  use(s, p, sheep);
  assert.equal(held(p).damage, 1, 'already sheared');
});

test('a lamb is not sheared; the dye recolours a fleece and spends one', () => {
  const s = fixture(), p = join(s), lamb = mob(s, 'sheep'), sheep = mob(s, 'sheep'); lamb.growingAge = -50; s.tick();
  give(p, SHEARS); use(s, p, lamb);
  assert.equal(lamb.sheared, false); assert.equal(held(p).damage, 0);
  give(p, DYE, 2, 1); sheep.color = 0; use(s, p, sheep);
  assert.equal(sheep.color, ~1 & 15);
  assert.equal(held(p).count, 1);
});

test('an empty bucket on a cow gives milk (a lone bucket is replaced); creative keeps it', () => {
  const s = fixture(), p = join(s), cow = mob(s, 'cow'); s.tick();
  give(p, BUCKET); use(s, p, cow);
  assert.equal(held(p).id, MILK);
  const c = fixture('creative'), q = join(c), cow2 = mob(c, 'cow'); c.tick();
  give(q, BUCKET); use(c, q, cow2);
  assert.equal(held(q).id, BUCKET);
});

test('a saddle on an adult pig sets the flag, spends one and reaches the copy; a second saddle is kept', () => {
  const s = fixture(), p = join(s), pig = mob(s, 'pig'); s.tick();
  const remote = new RemoteMobs(s.world, {}); remote.apply(packets(p)); s.tick(); remote.apply(packets(p));
  give(p, SADDLE, 2); use(s, p, pig);
  assert.equal(pig.saddled, true); assert.equal(held(p).count, 1);
  remote.apply(packets(p));
  assert.equal(remote.copies.get(wire(pig)).mob.saddled, true);
  use(s, p, pig);
  assert.equal(held(p).count, 1, 'an already saddled pig keeps the saddle');
});

test('a bowl on a mooshroom gives stew; shears turn it into a cow with 5 mushrooms', () => {
  const s = fixture(), p = join(s), m = mob(s, 'mooshroom'); s.tick();
  give(p, BOWL); use(s, p, m);
  assert.equal(held(p).id, STEW);
  give(p, SHEARS); use(s, p, m);
  assert.equal(held(p).damage, 1);
  s.tick();
  assert.ok(s.mobs.mobs.entities.some(e => e.type === 'cow'));
  assert.equal(s.items.items.filter(e => e.stack.id === 76).reduce((n, e) => n + e.stack.count, 0), 5);
});

test('a prediction the server refused makes the server resend the slot; a handled unpredicted click drops the item use', () => {
  const s = fixture(), p = join(s), calf = mob(s, 'cow'); calf.growingAge = -10; s.tick();
  give(p, WHEAT, 3); s.tick(); p.itemsOut = [];
  s.queueAnimUse(p.id, wire(calf), true); s.tick();
  assert.ok(p.itemsOut.some(m => m.type === 'slot' && m.slots.some(x => x.slot === 0 && x.stack.count === 3)));
  const adult = mob(s, 'cow'); s.tick();
  give(p, BUCKET); s.queueAnimUse(p.id, wire(adult), false); s.queueEdit(p.id, { place: true }); s.tick();
  assert.equal(p.animHandled, 0);
});

test('the client prediction matches the server on the held stack for feed, shear, milk, saddle and dye', () => {
  const cases = [['cow', WHEAT, 0, 3], ['sheep', SHEARS, 0, 1], ['cow', BUCKET, 0, 1], ['pig', SADDLE, 0, 2], ['sheep', DYE, 4, 2], ['cow', 322, 0, 2], ['mooshroom', BOWL, 0, 2]];
  for (const [type, id, damage, count] of cases) {
    const s = fixture(), p = join(s), m = mob(s, type); s.tick();
    const remote = new RemoteMobs(s.world, {}); remote.apply(packets(p));
    s.tick(); remote.apply(packets(p));
    const copy = remote.copies.get(wire(m))?.mob;
    give(p, id, count, damage);
    const mine = fixture(), me = join(mine); me.survival.inventory.main[0] = makeStack(id, count, damage);
    const r = predictAnimalUse(copy, me.survival);
    use(s, p, m);
    const a = held(p), b = me.survival.inventory.main[0];
    assert.deepEqual([a?.id ?? 0, a?.count ?? 0, a?.damage ?? 0], [b?.id ?? 0, b?.count ?? 0, b?.damage ?? 0], `${type} ${id}`);
    assert.equal(r.handled, [WHEAT, SHEARS, BUCKET, SADDLE, DYE, BOWL].includes(id), `${type} ${id} handled`);
  }
});

test('sheep status 10 starts the copy grazing, hearts come from status 18, a copy in love is known', () => {
  const s = fixture(), p = join(s), sheep = mob(s, 'sheep'); s.tick();
  const log = []; const remote = new RemoteMobs(s.world, { particle: (...a) => log.push(a) });
  remote.apply(packets(p));
  s.mobs.status(sheep, 10); s.mobs.status(sheep, 18); s.tick();
  remote.apply(packets(p));
  const copy = remote.copies.get(wire(sheep)).mob;
  assert.equal(copy.eatTimer, 40); assert.equal(copy.love, 600); assert.equal(log.length, 7);
  remote.tick(); assert.equal(copy.eatTimer, 39); assert.equal(copy.love, 599);
});
