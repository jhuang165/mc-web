import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCommandRunner, SUMMONABLE } from './commands.js';
import { createCommandHost } from './command-host.js';
import { World } from './world.js';
import { EntityWorld } from './entities.js';
import { Survival } from './survival.js';
import { Minecarts } from './minecarts.js';
import { ENTITY_SUMMON, entityIdOfSummon } from './entity-summon.js';
import { CART_SUMMON } from './cart-summon.js';
import { JavaRandom } from './java-random.js';

// /summon through the command host with fake hosts for the entity lists, the real EntityWorld for mobs and Minecarts for carts.
function game() {
  const world = new World('summon-coverage', 'meadow', 1), survival = new Survival({}, 'creative'), mobs = new EntityWorld(world, []);
  const lines = [], minecarts = new Minecarts({}), calls = { items: [], orbs: [], primed: [], falling: [], boats: [], loads: [] };
  const holder = (name) => ({ serialize: () => [], load: (list) => calls.loads.push([name, list.at(-1)]) });
  const hosts = {
    items: { spawn: (stack, x, y, z, o) => { const e = { stack, x, y, z, ...o }; calls.items.push(e); return e; } },
    xpOrbs: { orbs: calls.orbs }, primed: calls.primed,
    falling: { entities: calls.falling, entityRandom: () => new JavaRandom(1) },
    boats: { spawnBoat: (o) => { const b = { ...o }; calls.boats.push(b); return b; } },
    projectiles: holder('projectiles'), arrows: holder('arrows'), eyes: { serialize: () => ({ random: 0, eyes: [] }), load: (s) => calls.loads.push(['eyes', s.eyes.at(-1)]) },
    mobs: { potions: holder('potions'), fireballs: holder('fireballs'), skulls: holder('skulls') }, dimension: 0,
  };
  const env = { world: () => world, survival: () => survival, mobs: () => mobs, active: () => ({ mode: 'creative', allowCommands: true }),
    position: () => ({ x: 10.8, y: 60.6, z: 10.1 }), changed() {}, refreshInventory() {}, stackName: () => 'stack', dropStack() {}, updateBlock() {}, destroyBlock() {},
    minecarts: () => minecarts, entityHosts: () => hosts };
  const host = createCommandHost(env); host.print = (t) => lines.push(t);
  const runner = createCommandRunner(host);
  return { mobs, minecarts, calls, hosts, run(s) { lines.length = 0; const ok = runner.run(s); return { ok, lines: [...lines] }; } };
}
const failed = (out) => out.lines.some((l) => /Unable to summon|summon\.failed/.test(l));

test('every EntityList registration the build implements is summonable; the rest are listed as gaps', () => {
  assert.ok(Object.keys(ENTITY_SUMMON).length >= 14);
  for (const id of ['Item', 'XPOrb', 'PrimedTnt', 'FallingSand', 'Boat', 'Arrow', 'Snowball', 'ThrownPotion', 'ThrownExpBottle', 'ThrownEnderpearl', 'Fireball', 'SmallFireball', 'WitherSkull', 'EyeOfEnderSignal'])
    assert.equal(SUMMONABLE[id], 'entity:' + id, id);
  assert.equal(SUMMONABLE.MinecartSpawner, CART_SUMMON.MinecartSpawner);
  assert.equal(entityIdOfSummon(SUMMONABLE.Boat), 'Boat');
  for (const id of ['Painting', 'ItemFrame', 'LeashKnot']) assert.equal(SUMMONABLE[id], 'entity:' + id, id);
  for (const id of ['Mob', 'Monster']) assert.equal(SUMMONABLE[id], undefined, id);
});

test('summon MinecartSpawner reads the logic keys and spawns a type 4 cart', () => {
  const g = game();
  const out = g.run('/summon MinecartSpawner ~ ~ ~ {EntityId:Zombie,Delay:7s,MinSpawnDelay:10s,MaxSpawnDelay:30s,SpawnCount:2s,SpawnRange:3s,SpawnData:{Fire:20s},SpawnPotentials:[{Type:Skeleton,Weight:2,Properties:{}}]}');
  assert.equal(out.ok, true); assert.ok(!failed(out));
  const c = g.minecarts.carts[0], s = c.spawner;
  assert.equal(c.type, 4);
  assert.deepEqual([s.entityId, s.delay, s.minSpawnDelay, s.maxSpawnDelay, s.spawnCount, s.spawnRange, s.maxNearbyEntities], ['Zombie', 7, 10, 30, 2, 3, 6]);
  assert.equal(s.spawnData.type, 'Zombie');
  assert.deepEqual(s.potentials.map((p) => [p.type, p.weight]), [['Skeleton', 2]]);
});

test('summon Item, XPOrb, PrimedTnt, FallingSand and Boat build the entity at the command position', () => {
  const g = game();
  assert.ok(!failed(g.run('/summon Item ~ ~ ~ {Item:{id:264s,Count:3b,Damage:0s},Age:5s,PickupDelay:10s,Motion:[0.1d,0.2d,0.3d]}')));
  assert.deepEqual([g.calls.items[0].x, g.calls.items[0].y, g.calls.items[0].z, g.calls.items[0].stack.count, g.calls.items[0].delay, g.calls.items[0].age], [10.5, 61, 10.5, 3, 10, 5]);
  assert.ok(!failed(g.run('/summon XPOrb ~ ~ ~ {Value:7s}')));
  assert.equal(g.calls.orbs[0].value, 7);
  assert.ok(!failed(g.run('/summon PrimedTnt ~ ~ ~ {Fuse:20b}')));
  assert.equal(g.calls.primed[0].fuse, 20);
  assert.ok(!failed(g.run('/summon FallingSand ~ ~ ~ {Tile:12b,Time:3b}')));
  assert.equal(g.calls.falling.length, 1);
  assert.ok(!failed(g.run('/summon Boat ~ ~ ~ {Rotation:[90f,5f]}')));
  assert.deepEqual([g.calls.boats[0].x, g.calls.boats[0].z, g.calls.boats[0].yaw], [10.5, 10.5, 90]);
});

test('summon projectiles reach their holders with the command position', () => {
  const g = game();
  for (const id of ['Snowball', 'Arrow', 'ThrownPotion', 'Fireball', 'SmallFireball', 'WitherSkull', 'ThrownExpBottle', 'ThrownEnderpearl']) assert.ok(!failed(g.run(`/summon ${id} ~ ~ ~ {}`)), id);
  assert.ok(g.calls.loads.length >= 5);
});

test('unregistered, abstract and unsupported ids fail the command like the original', () => {
  const g = game();
  for (const id of ['Mob', 'Monster', 'NoSuchEntity']) { const out = g.run(`/summon ${id} ~ ~ ~`); assert.equal(out.ok, true); assert.ok(failed(out) || out.lines.every((l) => !l.startsWith('§c') || /summon/.test(l)), id); }
  assert.equal(g.mobs.entities.length, 0);
});

test('Riding chain: each mount is spawned at the command position and mounted by the previous entity', () => {
  const g = game();
  const out = g.run('/summon Zombie ~ ~ ~ {Riding:{id:Pig,Riding:{id:Sheep,Color:4}}}');
  assert.ok(!failed(out)); assert.doesNotMatch(out.lines.join('\n'), /unmounted/);
  const [zombie, pig, sheep] = g.mobs.entities;
  assert.deepEqual([zombie.ridingEntity === pig, pig.riddenBy === zombie, pig.ridingEntity === sheep, sheep.riddenBy === pig, sheep.color], [true, true, true, true, 4]);
  // A failed mount creation ends the loop; the spawned riders stay.
  const g2 = game();
  g2.run('/summon Zombie ~ ~ ~ {Riding:{id:Pig,Riding:{id:Dragon,Riding:{id:Sheep}}}}');
  assert.deepEqual(g2.mobs.entities.map((e) => e.type), ['zombie', 'pig']);
  // A mob riding a cart: Entity.mountEntity(cart) links it (vehicle-riders.js) and the cart carries it.
  const g3 = game();
  const note = g3.run('/summon Zombie ~ ~ ~ {Riding:{id:MinecartRideable}}');
  assert.equal(g3.minecarts.carts.length, 1); assert.equal(g3.mobs.entities[0].ridingEntity, g3.minecarts.carts[0]);
  assert.equal(g3.minecarts.carts[0].passenger, g3.mobs.entities[0]);
  assert.doesNotMatch(note.lines.join('\n'), /Riding/);
});

test('summon Painting, ItemFrame and LeashKnot follow readEntityFromNBT then setLocationAndAngles', async () => {
  const { Hanging } = await import('./hanging.js');
  const g = game(); g.hosts.hanging = new Hanging(); g.hosts.mobs.knotSummon = (...a) => g.mobs.knotSummon(...a);
  const h = g.hosts.hanging;
  assert.ok(!failed(g.run('/summon Painting ~ ~ ~ {Motive:Pool,Direction:1b,TileX:4,TileY:70,TileZ:5}')));
  let p = h.entities[0];
  assert.deepEqual([p.kind, p.art, p.dir, p.tx, p.ty, p.tz, p.x, p.y, p.z, p.yaw], ['painting', 0 + p.art, 1, 4, 70, 5, 10.5, 61, 10.5, 90]);
  assert.deepEqual(p.bb, [10.25, 61, 10.25, 10.75, 61.5, 10.75]);
  // No tag keys: Kebab, legacy Dir 0 maps to facing 2, tile 0, 0, 0.
  assert.ok(!failed(g.run('/summon Painting ~ ~ ~ {}')));
  p = h.entities[1];
  assert.deepEqual([p.art, p.dir, p.tx, p.ty, p.tz], [0, 2, 0, 0, 0]);
  assert.ok(!failed(g.run('/summon Painting ~ ~ ~ {Dir:1b,Direction:3b}')));
  assert.equal(h.entities[2].dir, 3);
  assert.ok(!failed(g.run('/summon Painting ~ ~ ~ {Dir:3b}')));
  assert.equal(h.entities[3].dir, 3);
  assert.ok(!failed(g.run('/summon Painting ~ ~ ~ {Dir:9b}')));
  assert.equal(h.entities[4].dir, 0); // an out-of-range legacy Dir leaves the field at its default 0
  // Directions outside 0..3 are not kept.
  const n = h.entities.length;
  assert.match(g.run('/summon Painting ~ ~ ~ {Direction:7b}').lines.join('\n'), /Direction/);
  assert.equal(h.entities.length, n);
  // Item frame: rotation and drop chance are read only with a non-empty Item; rotation is i % 4.
  assert.ok(!failed(g.run('/summon ItemFrame ~ ~ ~ {ItemRotation:6b,ItemDropChance:0.5f,Item:{id:264s,Count:2b,Damage:0s}}')));
  let f = h.entities.at(-1);
  assert.deepEqual([f.kind, f.item.count, f.rotation, f.dropChance], ['frame', 2, 2, 0.5]);
  assert.ok(!failed(g.run('/summon ItemFrame ~ ~ ~ {ItemRotation:3b,Item:{}}')));
  f = h.entities.at(-1);
  assert.deepEqual([f.item, f.rotation, f.dropChance], [null, 0, 1]);
  // LeashKnot: tile 0,0,0, at the command position, dies on its 101st update without a fence.
  assert.ok(!failed(g.run('/summon LeashKnot ~ ~ ~')));
  const knots = g.mobs.leashKnots();
  assert.deepEqual([knots.length, knots[0].x, knots[0].y, knots[0].z, knots[0].px, knots[0].py, knots[0].pz], [1, 0, 0, 0, 10.5, 61, 10.5]);
  for (let i = 0; i < 100; i++) g.mobs.knotTick();
  assert.equal(g.mobs.leashKnots().length, 1);
  g.mobs.knotTick();
  assert.equal(g.mobs.leashKnots().length, 0);
});
