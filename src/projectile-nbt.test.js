// In-flight projectile NBT and creeper Fuse/ExplosionRadius, replayed from the unchanged 1.7.10 classes:
// public/research/projectile-nbt-reference.json (tools/probes/ProjectileNbtProbe.java) and creeper-nbt-reference.json
// (tools/probes/CreeperNbtProbe.java), both made by tools/verify-projectile-nbt.mjs. Notes: public/research/projectile-nbt.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import projectiles from '../public/research/projectile-nbt-reference.json' with { type: 'json' };
import creepers from '../public/research/creeper-nbt-reference.json' with { type: 'json' };
import { decodeNbt, NBT } from './nbt.js';
import { javaProjectileFromNbt, javaProjectileToNbt, JAVA_PROJECTILES } from './java-projectiles.js';
import { fromOriginal } from './block-registry.js';
import { javaMobFromNbt } from './java-mobs.js';
import { creeperTick, creeperFlash, creeperFall, creeperFields } from './creeper.js';
import { EntityWorld } from './entities.js';
import { Projectiles } from './projectiles.js';
import { WitchPotions } from './witch-potions.js';
import { Arrows } from './bow.js';
import { EyesOfEnder } from './eye-of-ender-live.js';
import { FireworkRockets } from './fireworks-live.js';
import { ITEM_FIREWORK_ROCKET } from './fireworks.js';
import { Fireballs } from './fireballs.js';
import { WitherSkulls } from './wither-boss-mobs.js';
import { Chunk } from './chunk-store.js';
import { chunkToNbt, chunkFromNbt } from './chunk-nbt.js';
import { encodeRegionChunk, writeRegion, readRegion, decodeRegionChunk, regionSlot, regionAddress } from './region-file.js';
import { importJavaRegionArea } from './region-import.js';
import { importedRuntime } from './world-import.js';

const f = Math.fround;
const bytes = (hex) => Uint8Array.from(hex.match(/../g).map((b) => parseInt(b, 16)));
const tagOf = (hex) => decodeNbt(bytes(hex)).tag.value;
const get = (map, key) => map.get(key)?.value;
const NATIVE = projectiles.projectiles.filter((p) => p.loaded && JAVA_PROJECTILES[p.id]);
// The first five kinds go through the generic read-back test; fireballs, eyes and rockets have their own tests below.
const CLASSIC = NATIVE.filter((p) => ['projectiles', 'thrownPotions', 'arrows'].includes(JAVA_PROJECTILES[p.id]));
const ofKind = (kind, i = 0) => projectiles.projectiles.filter((p) => p.kind === kind)[i];
const flat = { get: () => 0, getMeta: () => 0, solid: () => false, surface: () => 0, spawn: () => ({ x: 0, y: 0, z: 0 }), numericSeed: 1 };

test('the probe saw every converted class, and the egg is outside the conversion', () => {
  assert.equal(projectiles.projectiles.length, 31);
  assert.deepEqual([...new Set(NATIVE.map((p) => p.id))].sort(), Object.keys(JAVA_PROJECTILES).sort());
  const egg = projectiles.projectiles.find((p) => p.kind === 'egg');
  assert.deepEqual([egg.id, egg.saved], [null, false], 'EntityEgg has no EntityList id: writeToNBTOptional refuses it');
  assert.deepEqual(projectiles.projectiles.filter((p) => /fireball|skull/.test(p.kind)).map((p) => p.id), ['Fireball', 'Fireball', 'Fireball', 'Fireball', 'SmallFireball', 'WitherSkull', 'WitherSkull']);
  assert.deepEqual(projectiles.projectiles.filter((p) => /eye|rocket/.test(p.kind)).map((p) => p.id), Array(2).fill('EyeOfEnderSignal').concat(Array(5).fill('FireworksRocketEntity')));
  // EntityFishHook (xe) is not an EntityList class; the digest list records it next to the registered ones.
  assert.ok(projectiles.classes.xe && projectiles.classes.zl);
});

for (const [i, p] of CLASSIC.entries()) {
  test(`native ${p.kind} (${p.id}) NBT #${i} imports with the native read-back`, () => {
    const tag = tagOf(p.nbt), made = javaProjectileFromNbt(tag, { shiftX: 10, shiftZ: -20 });
    const owned = get(tag, 'ownerName') !== undefined && get(tag, 'ownerName') !== '';
    assert.ok(made.record, JSON.stringify(made));
    if (p.id === 'ThrownEnderpearl') assert.equal(made.record.owner, owned ? 'player' : undefined, 'an unowned pearl loads without an owner');
    assert.equal(made.list, JAVA_PROJECTILES[p.id]);
    const r = made.record;
    assert.deepEqual([r.x, r.y, r.z, r.mx, r.my, r.mz, r.yaw, r.pitch], [p.x + 10, p.y, p.z - 20, p.mx, p.my, p.mz, p.yaw, p.pitch]);
    if (p.id === 'ThrownPotion') {
      assert.equal(r.damage, get(get(tag, 'Potion'), 'Damage'));
      assert.equal(r.owner, owned ? 'player' : undefined);
    }
    if (p.id === 'Arrow') {
      const stuck = get(tag, 'inGround') === 1;
      assert.equal(r.pickup, get(tag, 'pickup'));
      assert.equal(r.damage, get(tag, 'damage'));
      assert.equal(r.life, get(tag, 'life'));
      assert.equal(r.shake, get(tag, 'shake') & 255);
      assert.equal(r.inGround, stuck);
      // zTile -21 moves to -41, outside the imported world, which is the unset marker -1; stone (original 1) is the port's own id.
      if (stuck) assert.deepEqual([r.xTile, r.yTile, r.zTile, r.inTile, r.inData], [get(tag, 'xTile') + 10, get(tag, 'yTile'), -1, fromOriginal(1, 0).id, 0]);
    }
    // The browser systems accept the record as one live projectile.
    const live = { projectiles: new Projectiles(), thrownPotions: new WitchPotions({ entities: [], projectiles: new Projectiles() }), arrows: new Arrows() }[made.list];
    live.load([r]);
    const count = made.list === 'projectiles' ? live.balls.length : made.list === 'thrownPotions' ? live.projectiles.balls.length : live.list.length;
    assert.equal(count, 1);
  });
}

test('Potion absent: the legacy potionValue int, or a plain bottle (the probe loaded both)', () => {
  const legacy = projectiles.projectiles.find((p) => p.kind === 'potion' && !get(tagOf(p.in), 'Potion') && get(tagOf(p.in), 'potionValue'));
  assert.equal(javaProjectileFromNbt(tagOf(legacy.in)).record.damage, 16457);
  assert.equal(get(get(tagOf(legacy.nbt), 'Potion'), 'Damage'), 16457);
  const bare = projectiles.projectiles.find((p) => p.kind === 'potion' && !get(tagOf(p.in), 'Potion') && !get(tagOf(p.in), 'potionValue'));
  assert.equal(javaProjectileFromNbt(tagOf(bare.in)).record.damage, 0);
});

test('an arrow without pickup uses the legacy "player" boolean, and without damage 2.0', () => {
  const arrows = projectiles.projectiles.filter((p) => p.kind === 'arrow' && get(tagOf(p.in), 'pickup') === undefined);
  assert.equal(arrows.length, 2);
  for (const a of arrows) {
    const native = tagOf(a.nbt), r = javaProjectileFromNbt(tagOf(a.in)).record;
    assert.equal(r.pickup, get(native, 'pickup'));
    assert.equal(r.damage, get(native, 'damage'));
  }
});

// Exporter: the key set and values of each written entity equal the native write (minus the random UUID the browser has no field for).
const BROWSER = {
  Snowball: ['projectiles', {}], ThrownEnderpearl: ['projectiles', { kind: 'enderPearl', owner: 'player' }], ThrownPotion: ['thrownPotions', {}],
  ThrownExpBottle: ['thrownPotions', { kind: 'expBottle', damage: 0 }], Arrow: ['arrows', {}],
  Fireball: ['fireballs', { kind: 'fireball', vx: 0.1, vy: 0, vz: 0.2, power: 1 }], SmallFireball: ['fireballs', { kind: 'smallFireball', vx: 0.1, vy: 0, vz: 0.2 }],
  WitherSkull: ['fireballs', { kind: 'witherSkull', vx: 0.1, vy: 0, vz: 0.2 }], EyeOfEnderSignal: ['eyes', {}], FireworksRocketEntity: ['rockets', { life: 3, lifetime: 20, stack: { id: ITEM_FIREWORK_ROCKET, count: 1, damage: 0 } }],
};
test('exported projectile compounds have the native key set', () => {
  for (const [id, [list, extra]] of Object.entries(BROWSER)) {
    const native = tagOf(NATIVE.find((p) => p.id === id && !get(tagOf(p.in), 'ownerName') && !get(tagOf(p.in), 'inGround') && (id !== 'FireworksRocketEntity' || get(tagOf(p.in), 'FireworksItem'))).nbt);
    const record = { x: 1, y: 2, z: 3, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0, damage: 16388, inGround: false, xTile: -1, yTile: -1, zTile: -1, ...extra };
    const out = javaProjectileToNbt(list, record, { itemNbt: () => new Map([['id', { type: NBT.SHORT, value: 401 }], ['Count', { type: NBT.BYTE, value: 1 }], ['Damage', { type: NBT.SHORT, value: 0 }]]) });
    assert.equal(out.id, id);
    const keys = new Set(Object.keys(out.fields));
    // Entity's own keys are added by the region exporter; every other native key has to come from here.
    const entityKeys = ['Pos', 'Motion', 'Rotation', 'FallDistance', 'Fire', 'Air', 'OnGround', 'Dimension', 'Invulnerable', 'PortalCooldown', 'UUIDMost', 'UUIDLeast', 'id'];
    assert.deepEqual([...keys].sort(), [...native.keys()].filter((k) => !entityKeys.includes(k)).sort(), id);
    for (const [k, t] of Object.entries(out.fields)) assert.equal(t.type, native.get(k).type, `${id}.${k} type`);
  }
});

test('an egg is not exported; an unowned pearl is, with an empty ownerName', () => {
  assert.equal(javaProjectileToNbt('projectiles', { kind: 'egg' }), null);
  const out = javaProjectileToNbt('projectiles', { kind: 'enderPearl', owner: null, x: 0, y: 0, z: 0, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 });
  assert.equal(out.id, 'ThrownEnderpearl');
  assert.equal(out.fields.ownerName.value, '');
});

async function exportThenRead(record) {
  const { World } = await import('./world.js');
  const { Survival } = await import('./survival.js');
  const { exportJavaSave } = await import('./region-export.js');
  const w = new World('17', 'javaStreamed', 12), player = new Survival({}, 'survival').serialize();
  const { files, report } = await exportJavaSave({ id: 'pn', name: 'PN', seed: '17', biome: 'javaStreamed', generationVersion: 12, mode: 'survival', edits: [], player,
    position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, updated: 1700000000000, ...record }, { world: w });
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz);
  const chunk = chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z))));
  return { w, chunk, report };
}

test('export then import keeps snowballs, pearls, potions, bottles and arrows', async () => {
  const at = (i) => ({ x: -2 - i, y: 102.5, z: -2.5, mx: 0.1 * i, my: -0.2, mz: 0.3, yaw: 10 * i - 20, pitch: 5 - i });
  const record = {
    projectiles: [{ ...at(0) }, { ...at(1), kind: 'enderPearl', owner: 'player' }, { ...at(2), kind: 'egg' }],
    thrownPotions: [{ ...at(3), damage: 16421, ticks: 4, owner: 'player' }, { ...at(4), damage: 16388, ticks: 1 }, { ...at(5), kind: 'expBottle', damage: 0, ticks: 0 }],
    arrows: [{ ...at(6), xTile: 3, yTile: 100, zTile: 5, life: 12, inTile: 1, inData: 0, shake: 3, inGround: true, pickup: 2, damage: 3.5, fire: 40 },
      { ...at(7), xTile: -1, yTile: -1, zTile: -1, life: 0, inTile: 0, inData: 0, shake: 0, inGround: false, pickup: 1, damage: 2 }],
  };
  const { w, chunk, report } = await exportThenRead(record);
  assert.equal(report.unsupportedEntities, 1, 'only the egg');
  const back = chunk.entities.map((e) => ({ id: get(e, 'id'), made: javaProjectileFromNbt(e, { shiftX: -w.originX, shiftZ: -w.originZ }) }));
  assert.deepEqual(back.map((b) => b.id).sort(), ['Arrow', 'Arrow', 'Snowball', 'ThrownEnderpearl', 'ThrownExpBottle', 'ThrownPotion', 'ThrownPotion']);
  const by = (list, pick) => back.filter((b) => b.made.list === list).map((b) => b.made.record).filter(pick);
  const same = (b, a) => { for (const k of ['x', 'y', 'z', 'mx', 'my', 'mz']) assert.ok(Math.abs(b[k] - a[k]) < 1e-9, k); assert.ok(Math.abs(b.yaw - f(a.yaw)) < 1e-6 && Math.abs(b.pitch - f(a.pitch)) < 1e-6); };
  same(by('projectiles', (r) => !r.kind)[0], record.projectiles[0]);
  same(by('projectiles', (r) => r.kind === 'enderPearl')[0], record.projectiles[1]);
  assert.equal(by('thrownPotions', () => true).length, 3);
  const owned = by('thrownPotions', (r) => r.damage === 16421)[0];
  assert.equal(owned.owner, 'player');
  assert.equal(by('thrownPotions', (r) => r.damage === 16388)[0].owner, undefined);
  assert.equal(by('thrownPotions', (r) => r.kind === 'expBottle').length, 1);
  const stuck = by('arrows', (r) => r.inGround)[0], air = by('arrows', (r) => !r.inGround)[0];
  assert.deepEqual([stuck.xTile, stuck.yTile, stuck.zTile, stuck.life, stuck.inTile, stuck.shake, stuck.pickup, stuck.damage, stuck.fire], [3, 100, 5, 12, 1, 3, 2, 3.5, 40]);
  assert.deepEqual([air.xTile, air.pickup, air.damage, air.fire], [-1, 1, 2, undefined]);
});

test('a region with native projectiles imports them as saved projectiles, not as lost entities', async () => {
  const chunk = new Chunk(0, 0);
  const place = (m, i) => {
    const tag = new Map(tagOf(m.nbt));
    tag.set('Pos', { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [0.5 + (i % 8) * 1.9, 70, 0.5 + Math.floor(i / 8) * 3.5] } });
    return tag;
  };
  const entities = projectiles.projectiles.filter((p) => p.nbt).map(place);
  const { x, z } = regionAddress(0, 0);
  const files = [{ filename: 'r.0.0.mca', bytes: writeRegion([await encodeRegionChunk(chunkToNbt(chunk, { entities, tileEntities: [] }), { x, z })]) }];
  const { record, report } = await importJavaRegionArea(files, { area: { chunkX: 0, chunkZ: 0, width: 1, depth: 1 }, mode: 'survival' });
  // Everything converts except the probe's dead fireball (no "direction" list: setDead on load).
  const converted = Object.values(report.entities.converted).reduce((a, b) => a + b, 0);
  assert.equal(converted, 29, JSON.stringify(report.entities));
  assert.equal(JSON.stringify(report.entities.lost).match(/\d+/g)?.map(Number).reduce((a, b) => a + b, 0), 1, JSON.stringify(report.entities.lost));
  assert.deepEqual(report.entities.converted, { Snowball: 3, ThrownEnderpearl: 2, ThrownPotion: 4, ThrownExpBottle: 2, Arrow: 5, Fireball: 3, SmallFireball: 1, WitherSkull: 2, EyeOfEnderSignal: 2, FireworksRocketEntity: 5 }, JSON.stringify(report.entities));
  const runtime = importedRuntime(JSON.parse(JSON.stringify(record)));
  assert.equal(runtime.projectiles.length, 5);
  assert.equal(runtime.projectiles.filter((r) => r.kind === 'enderPearl' && r.owner === undefined).length, 1, 'the unowned pearl is kept');
  assert.equal(runtime.thrownPotions.length, 6);
  assert.equal(runtime.arrows.length, 5);
  assert.equal(runtime.fireballs.length, 6);
  assert.equal(runtime.eyes.eyes.length, 2);
  assert.equal(runtime.rockets.rockets.length, 5);
  new Projectiles().load(runtime.projectiles);
  new Arrows().load(runtime.arrows);
  const rockets = new FireworkRockets();
  rockets.load(runtime.rockets);
  assert.equal(rockets.rockets.length, 5);
  const eyes = new EyesOfEnder();
  eyes.load(runtime.eyes);
  assert.equal(eyes.eyes.length, 2);
  const mobs = { entities: [], random: () => 0.5 };
  const balls = new Fireballs(mobs), skulls = new WitherSkulls(mobs);
  balls.load(runtime.fireballs);
  skulls.load(runtime.fireballs);
  assert.deepEqual([balls.list.length, skulls.list.length], [4, 2]);
});

const BALLS = projectiles.projectiles.filter((p) => /fireball|skull/.test(p.kind) && p.kind !== 'witherskull-dangerous');
test('native fireballs import with the native read-back: direction is the motion, acceleration and shooter are not saved', () => {
  for (const p of BALLS.filter((b) => !b.dead)) {
    const made = javaProjectileFromNbt(tagOf(p.nbt), { shiftX: 10, shiftZ: -20, dimension: -1 });
    assert.equal(made.list, 'fireballs');
    const r = made.record;
    assert.deepEqual([r.x, r.y, r.z, r.vx, r.vy, r.vz, r.ax, r.ay, r.az, r.dimension], [p.x + 10, p.y, p.z - 20, p.mx, p.my, p.mz, p.fields.b, p.fields.c, p.fields.d, -1]);
    assert.equal(r.owner, undefined);
    assert.equal(r.power, p.id === 'Fireball' ? p.fields.e : undefined, 'ExplosionPower only on the large fireball');
  }
  const dead = BALLS.find((b) => b.dead);
  assert.deepEqual(javaProjectileFromNbt(tagOf(dead.nbt)), { lost: 'unusable' }, 'no direction list: setDead on load');
  const powered = BALLS.find((b) => b.fields['ze.e'] === 9);
  assert.equal(javaProjectileFromNbt(tagOf(powered.nbt)).record.power, 3);
  const skull = projectiles.projectiles.find((p) => p.kind === 'witherskull-dangerous');
  assert.deepEqual([skull.srcFields.dangerous, skull.fields.dangerous], [true, false], 'the dangerous flag is a data-watcher value and is not saved');
});

test('imported fireballs keep their saved motion with zero acceleration; the browser save keeps owners and flight state', () => {
  const made = javaProjectileFromNbt(tagOf(BALLS[0].nbt));
  const mobs = { entities: [{ id: 'mob-7', health: 10, death: 0 }], random: () => 0.5 };
  const balls = new Fireballs(mobs);
  balls.load([{ ...made.record }, { ...made.record, dimension: 1 }, { kind: 'witherSkull', x: 1, y: 2, z: 3, vx: 0, vy: 0, vz: 0 }, { kind: 'smallFireball', x: NaN, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }]);
  assert.equal(balls.list.length, 1, 'wrong kind, other dimension and NaN records are skipped');
  const ball = balls.list[0];
  assert.deepEqual([ball.large, ball.power, ball.owner, ball.ax, ball.vz], [true, 1, null, 0, made.record.vz]);
  ball.owner = mobs.entities[0];
  ball.ticks = 12;
  ball.ax = 0.01;
  const saved = JSON.parse(JSON.stringify(balls.serialize(0)));
  assert.deepEqual([saved[0].owner, saved[0].ticks, saved[0].dimension, saved[0].ax], ['mob-7', 12, 0, 0.01]);
  const again = new Fireballs(mobs);
  again.load(saved, 0);
  assert.equal(again.list[0].owner, mobs.entities[0]);
  assert.deepEqual([again.list[0].ticks, again.list[0].ax], [12, 0.01]);
  again.load(saved, 1);
  assert.equal(again.list.length, 0);
  const skulls = new WitherSkulls(mobs);
  skulls.load([{ kind: 'witherSkull', x: 1, y: 2, z: 3, vx: 0.1, vy: 0, vz: 0, blue: true, owner: 'player' }, { kind: 'fireball', x: 1, y: 2, z: 3, vx: 0, vy: 0, vz: 0 }]);
  assert.equal(skulls.list.length, 1);
  assert.equal(skulls.list[0].owner, 'player');
});

test('native eyes of ender import with the native defaults: no target, no age, shatter flag off', () => {
  const eyes = projectiles.projectiles.filter((p) => p.kind === 'eye');
  assert.equal(eyes[0].srcFields.e, true, 'the source eye had a target and the drop flag');
  for (const p of eyes) {
    assert.deepEqual(p.fields, { a: 0, b: 0, c: 0, d: 0, e: false }, 'target, age and the drop flag are not saved');
    const made = javaProjectileFromNbt(tagOf(p.nbt), { shiftX: 10, shiftZ: -20 });
    assert.equal(made.list, 'eyes');
    const r = made.record;
    assert.deepEqual([r.x, r.y, r.z, r.vx, r.vy, r.vz, r.tx, r.ty, r.tz, r.age, r.drops], [p.x + 10, p.y, p.z - 20, p.mx, p.my, p.mz, 10, 0, -20, 0, false]);
  }
  const live = new EyesOfEnder();
  live.load({ eyes: [javaProjectileFromNbt(tagOf(eyes[1].nbt)).record] });
  assert.equal(live.eyes.length, 1);
});

test('native firework rockets import Life, LifeTime and the FireworksItem', () => {
  const rockets = projectiles.projectiles.filter((p) => p.kind === 'rocket');
  assert.equal(rockets.length, 5);
  for (const p of rockets) {
    const tag = tagOf(p.nbt);
    assert.equal(get(tag, 'Life'), p.fields.a);
    assert.equal(get(tag, 'LifeTime'), p.fields.b);
    assert.equal(tag.get('Life').type, NBT.INT);
    const made = javaProjectileFromNbt(tag, { shiftX: 10, shiftZ: -20, convertItem: () => ({ id: ITEM_FIREWORK_ROCKET, count: 1, damage: 0 }) });
    assert.equal(made.list, 'rockets');
    const r = made.record;
    assert.deepEqual([r.x, r.y, r.z, r.mx, r.my, r.mz, r.life, r.lifetime], [p.x + 10, p.y, p.z - 20, p.mx, p.my, p.mz, p.fields.a, p.fields.b]);
    assert.equal(r.stack !== undefined, tag.has('FireworksItem'), 'the stack follows FireworksItem');
  }
});

test('an unowned native pearl loads without an owner and saves again', () => {
  const pearl = projectiles.projectiles.filter((p) => p.kind === 'enderpearl')[0];
  const made = javaProjectileFromNbt(tagOf(pearl.nbt));
  assert.equal(made.record.owner, undefined);
  const live = new Projectiles();
  live.load([JSON.parse(JSON.stringify(made.record))]);
  assert.equal(live.balls.length, 1);
  assert.equal(live.serialize().length, 1);
});

test('eggs and fishing bobbers are not EntityList classes and are not exported', () => {
  assert.ok(projectiles.classes.zl && projectiles.classes.xe);
  assert.equal(javaProjectileToNbt('projectiles', { kind: 'egg' }), null);
});

test('export then import keeps fireballs, skulls, eyes and rockets', async () => {
  const at = (i) => ({ x: -2 - i, y: 102.5, z: -2.5, mx: 0.1, my: -0.2, mz: 0.3, yaw: 10 * i, pitch: 5 });
  const record = {
    fireballs: [
      { kind: 'fireball', x: -2, y: 102.5, z: -2.5, vx: 0.1, vy: -0.2, vz: 0.3, ax: 0, ay: 0, az: 0, power: 3, dimension: 0 },
      { kind: 'smallFireball', x: -4, y: 102.5, z: -2.5, vx: 0.2, vy: 0, vz: 0.1, ax: 0, ay: 0, az: 0, dimension: 0 },
      { kind: 'witherSkull', x: -6, y: 102.5, z: -2.5, vx: 0.3, vy: 0, vz: 0.1, ax: 0, ay: 0, az: 0, dimension: 0 },
    ],
    eyes: { eyes: [{ ...at(3), vx: 0.1, vy: -0.2, vz: 0.3, tx: 0, ty: 0, tz: 0, age: 0, drops: false }] },
    rockets: { rockets: [{ ...at(4), life: 5, lifetime: 30, stack: { id: ITEM_FIREWORK_ROCKET, count: 1, damage: 0 } }] },
  };
  const { w, chunk, report } = await exportThenRead(record);
  assert.equal(report.unsupportedEntities ?? 0, 0);
  const ids = chunk.entities.map((e) => get(e, 'id')).sort();
  assert.deepEqual(ids, ['EyeOfEnderSignal', 'Fireball', 'FireworksRocketEntity', 'SmallFireball', 'WitherSkull']);
  const back = Object.fromEntries(chunk.entities.map((e) => [get(e, 'id'), javaProjectileFromNbt(e, { shiftX: -w.originX, shiftZ: -w.originZ, convertItem: () => ({ id: ITEM_FIREWORK_ROCKET, count: 1, damage: 0 }) }).record]));
  assert.equal(back.Fireball.power, 3);
  assert.ok(Math.abs(back.Fireball.vx - 0.1) < 1e-9 && Math.abs(back.Fireball.vz - 0.3) < 1e-9);
  assert.ok(Math.abs(back.WitherSkull.vx - 0.3) < 1e-9);
  assert.deepEqual([back.FireworksRocketEntity.life, back.FireworksRocketEntity.lifetime], [5, 30]);
  assert.ok(back.EyeOfEnderSignal);
});

// Creepers.
test('the creeper probe covers defaults, explicit values, integer-typed tags and ignored strings', () => {
  assert.equal(creepers.creepers.length, 9);
  const byName = Object.fromEntries(creepers.creepers.map((c) => [c.name, c]));
  assert.deepEqual([byName.default.fuse, byName.default.radius], [30, 3]);
  assert.deepEqual([byName['string-ignored'].fuse, byName['string-ignored'].radius], [30, 3], 'getShort/getByte are only read for numeric tags');
  assert.deepEqual([byName['wide-radius'].fuse, byName['wide-radius'].radius], [4464, -56], 'int 70000 narrows to a short, int 200 to a byte');
});

for (const c of creepers.creepers) {
  test(`native creeper "${c.name}" keeps Fuse/ExplosionRadius through import and the live fuse`, () => {
    const tag = tagOf(c.nbt), r = javaMobFromNbt(tag);
    assert.ok(r);
    assert.deepEqual([r.maxFuse ?? 30, r.explosionRadius ?? 3], [c.fuse, c.radius]);
    const world = new EntityWorld({ ...flat, height: 256 }, [{ ...r, x: 64.5, y: 1, z: 64.5 }], () => 0.5);
    const e = world.entities[0];
    assert.deepEqual([e.maxFuse, e.explosionRadius, e.powered, e.ignited], [c.fuse, c.radius, c.powered, c.ignited]);
    // The saved browser mob restores the same fields.
    const again = new EntityWorld({ ...flat, height: 256 }, JSON.parse(JSON.stringify(world.serialize())), () => 0.5).entities[0];
    assert.deepEqual([again.maxFuse, again.explosionRadius], [c.fuse, c.radius]);
    // EntityCreeper.onUpdate with the swell state held at 1, as the probe ran it.
    const run = { ...e, x: 0.5, y: 0, z: 0.5, creeperState: 1 };
    let explodedAt = -1, explosion = null;
    for (let i = 0; i < c.ticks.length && explodedAt < 0; i++) {
      run.creeperState = 1;
      const out = creeperTick(run);
      assert.deepEqual([run.fuseTime, creeperFlash(run, 0) + 0, creeperFlash(run, 0.5) + 0], [c.ticks[i][0], f(c.ticks[i][1]) + 0, f(c.ticks[i][2]) + 0], `tick ${i}`); // + 0 folds a -0 flash (Fuse 0 divides by -2)
      if (out.explode) { explodedAt = i; explosion = out.explode; }
    }
    assert.equal(explodedAt, c.explodedAt);
    if (c.explosion) assert.deepEqual([explosion.x, explosion.y, explosion.z, explosion.size], c.explosion.slice(0, 4));
    // EntityCreeper.fall pushes timeSinceIgnited on, at most to fuseTime - 5.
    for (const [start, distance, t] of c.falls) {
      const fall = { ...creeperFields(), maxFuse: e.maxFuse, fuseTime: start };
      creeperFall(fall, f(distance));
      assert.equal(fall.fuseTime, t, `fall ${start} ${distance}`);
    }
  });
}

test('EntityWorld explosion event uses the saved radius (powered doubles it) and the saved fuse', () => {
  const ground = { get: (x, y) => (y < 32 ? 3 : 0), getMeta: () => 0, solid: (x, y) => y < 32, surface: () => 32, spawn: () => ({ x: 64, z: 64 }), numericSeed: 1 };
  const survival = { time: 1000, creative: false, health: 20, damage() {}, count: () => 0 };
  for (const [powered, fuse, radius, size] of [[false, 8, 5, 5], [true, 6, 4, 8]]) {
    const w = new EntityWorld(ground, [{ id: 'mob-1', type: 'creeper', x: 64.5, y: 32, z: 64.5, health: 20, powered, ignited: true, maxFuse: fuse, explosionRadius: radius }]);
    let boom = null, ticks = 0;
    for (; ticks < 40 && !boom; ticks++) { w.tick({ x: 100, y: 32, z: 100 }, survival); boom = w.events.find((ev) => ev.explode); }
    assert.ok(boom);
    assert.equal(boom.explode.size, size);
    assert.equal(ticks, fuse, 'the explosion tick is the saved fuse');
  }
});

test('export writes the live creeper Fuse and ExplosionRadius, and import reads them back', async () => {
  const mob = { type: 'creeper', health: 20, x: -2, y: 102, z: -2, powered: true, maxFuse: 18, explosionRadius: 6 };
  const plain = { type: 'creeper', health: 20, x: -3, y: 102, z: -2 };
  const { w, chunk } = await exportThenRead({ entities: [mob, plain] });
  const tags = chunk.entities.filter((e) => get(e, 'id') === 'Creeper');
  const nbt = Object.fromEntries(tags.map((t) => [get(t, 'powered') ? 'powered' : 'plain', t]));
  assert.deepEqual([get(nbt.powered, 'Fuse'), get(nbt.powered, 'ExplosionRadius')], [18, 6]);
  assert.deepEqual([get(nbt.plain, 'Fuse'), get(nbt.plain, 'ExplosionRadius')], [30, 3]);
  assert.equal(nbt.powered.get('Fuse').type, NBT.SHORT);
  assert.equal(nbt.powered.get('ExplosionRadius').type, NBT.BYTE);
  const back = javaMobFromNbt(nbt.powered, { shiftX: -w.originX, shiftZ: -w.originZ });
  assert.deepEqual([back.maxFuse, back.explosionRadius, back.powered], [18, 6, true]);
});
