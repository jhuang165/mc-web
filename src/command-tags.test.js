import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCommandRunner, nbtMatches } from './commands.js';
import { createCommandHost } from './command-host.js';
import { parseJsonNbt } from './json-nbt.js';
import { World } from './world.js';
import { EntityWorld } from './entities.js';
import { Survival } from './survival.js';

function game() {
  const world = new World('command-tags', 'meadow', 1), survival = new Survival({}, 'creative'), mobs = new EntityWorld(world, []);
  const active = { mode: 'creative', allowCommands: true }, lines = [], breaks = [];
  const env = { world: () => world, survival: () => survival, mobs: () => mobs, active: () => active,
    position: () => ({ x: 10.8, y: 60.6, z: 10.1 }), changed() {}, refreshInventory() {}, stackName: s => s.displayName ?? 'stack', dropStack() {}, updateBlock() {},
    destroyBlock(x, y, z) { breaks.push([x, y, z]); world.set(x, y, z, 0); } };
  const host = createCommandHost(env); host.print = t => lines.push(t);
  const runner = createCommandRunner(host);
  return { world, survival, mobs, host, breaks, run(s) { lines.length = 0; const ok = runner.run(s); return { ok, lines: [...lines] }; } };
}

test('give tags join all remaining arguments and preserve supported stack data, reporting ignored keys', () => {
  const g = game(), out = g.run('/give @p diamond_sword 1 0 {display:{Name:"A sword",Lore:[hello]},ench:[{id:16,lvl:3}],Unbreakable:1,RepairCost:7,unused:1}');
  const stack = g.survival.inventory.main.find(s => s?.displayName === 'A sword');
  assert.equal(stack.displayName, 'A sword');
  assert.deepEqual(stack.enchantments, [{ id: 16, lvl: 3 }]);
  assert.equal(stack.unbreakable, true); assert.equal(stack.repairCost, 7);
  assert.match(out.lines[1], /^§7Not kept in this build: unused, display.Lore$/);
  for (const tag of ['{bad', '[1,2]', '{a:[x,,y]}']) {
    const bad = g.run('/give @p diamond 1 0 ' + tag);
    assert.equal(bad.ok, true); assert.match(bad.lines[0], /^Data tag parsing failed:/);
  }
  assert.equal(g.survival.count(303), 0);
});

test('summon uses the rounded sender base; tags skip egg rolls, restore fields, fire and bounded motion', () => {
  const g = game();
  assert.equal(g.run('/summon Sheep ~ ~ ~ {Color:12,Sheared:1,Age:-100,HealF:5f,Fire:40,Motion:[1.5d,20d,-2d],Rotation:[90f,0f]}').ok, true);
  const e = g.mobs.entities[0];
  assert.deepEqual([e.x, e.y, e.z], [10.5, 61, 10.5]);
  assert.deepEqual([e.color, e.sheared, e.growingAge, e.health, e.fire, e.vx, e.vy, e.vz], [12, true, -100, 5, 40, 1.5, 0, -2]);
  assert.equal(e.yaw, -Math.PI / 2);
  g.run('/summon Sheep ~ ~ ~ {}'); assert.equal(g.mobs.entities[1].color, 0);
  g.run('/summon Zombie ~ ~ ~ {IsBaby:1,IsVillager:1}');
  assert.equal(g.mobs.entities[2].knockbackResistance, 0); assert.equal(g.mobs.entities[2].villager, true);
  assert.equal(new Set(g.mobs.entities.map(e => e.id)).size, 3);
  assert.equal(g.mobs.nextId, 4);
  const riders = g.run('/summon Pig ~ ~ ~ {Riding:{id:Sheep,Color:4}}');
  assert.equal(g.mobs.entities.length, 5); assert.doesNotMatch(riders.lines.join('\n'), /Riding|unmounted/);
  const [pig, sheep] = g.mobs.entities.slice(3); // CommandSummon: the entity first, then its Riding compound, which it mounts
  assert.deepEqual([pig.type, sheep.type, pig.ridingEntity === sheep, sheep.riddenBy === pig, sheep.color], ['pig', 'sheep', true, true, 4]);
  for (const command of ['/summon Pig ~ 300 ~ {bad', '/summon Dragon', '/summon Pig ~ ~ ~ {bad']) {
    const out = g.run(command); assert.equal(out.ok, true); assert.ok(!out.lines[0].startsWith('§c'));
  }
});

test('setblock parses only tile tags, accepts unknown replace modes, destroys before checking the same block', () => {
  const g = game();
  assert.equal(g.run('/setblock 5 60 5 stone 0 mystery {bad').ok, true);
  assert.equal(g.run('/setblock 5 60 5 stone 0 destroy').ok, true); assert.equal(g.breaks.length, 1);
  assert.match(g.run('/setblock 5 300 5 chest 0 replace {bad').lines[0], /^§cCannot place block outside/);
  assert.match(g.run('/setblock 5 60 5 chest 0 replace {bad').lines[0], /^§cData tag parsing failed/);
});

test('container tags share import/export converters and testforblock checks typed NBT', () => {
  const g = game();
  assert.equal(g.run('/setblock 5 60 5 chest 0 replace {Items:[{Slot:0b,id:264s,Count:3b,Damage:0s}]}').ok, true);
  assert.equal(typeof g.survival.chests['5,60,5'].facing, 'number');
  assert.equal(g.survival.chests['5,60,5'].items[0].count, 3);
  assert.equal(g.run('/testforblock 5 60 5 chest -1 {x:5,Items:[{Slot:0b,id:264s,Count:3b,Damage:0s}]}').ok, true);
  assert.equal(g.run('/testforblock 5 60 5 chest -1 {x:5b}').ok, false);
  assert.match(g.run('/testforblock 5 60 5 chest -1 {x:5b}').lines[0], /required NBT keys/);
  for (const [name, tag, store, field, value] of [
    ['furnace', '{BurnTime:20,CookTime:5}', 'furnaces', 'burn', 20],
    ['hopper', '{TransferCooldown:7,CustomName:Fred}', 'hoppers', 'name', 'Fred'],
    ['brewing_stand', '{BrewTime:25}', 'brewing', 'brewTime', 25],
    ['dropper', '{}', 'dispensers', 'items', Array(9).fill(null)],
  ]) { assert.equal(g.run(`/setblock 6 60 5 ${name} 0 replace ${tag}`).ok, true); assert.deepEqual(g.survival[store]['6,60,5'][field], value); }
  g.run('/setblock 7 60 6 chest');
  assert.equal(g.run('/testforblock 7 60 6 chest -1 {Items:[]}').ok, true);
  g.run('/setblock 7 60 5 enchanting_table');
  assert.match(g.run('/testforblock 7 60 5 enchanting_table -1 {}').lines[0], /tile entity/);
});

test('func_147181_a compounds are subsets but lists compare their complete typed contents', () => {
  const check = (a, b) => nbtMatches(parseJsonNbt(a), parseJsonNbt(b));
  assert.equal(check('{a:{b:1}}', '{a:{b:1,c:2},d:3}'), true);
  assert.equal(check('{a:1}', '{a:1b}'), false);
  assert.equal(check('{a:[{b:1}]}', '{a:[{b:1,c:2}]}'), false);
  assert.equal(check('{a:[1,2]}', '{a:[2,1]}'), false);
  assert.equal(check('{}', '{x:1}'), true);
  assert.equal(check('{a:-0.0f}', '{a:0.0f}'), true);
});


test('summoned trades keep original item ids, and non-ageable mobs ignore Age tags', () => {
  const g = game();
  g.run('/summon Villager ~ ~ ~ {Profession:2,Riches:9,Offers:{Recipes:[{buy:{id:264s,Count:1b},sell:{id:388s,Count:2b}}]}}');
  const v = g.mobs.entities[0];
  assert.equal(v.profession, 2); assert.equal(v.riches, 9);
  assert.equal(v.offers[0].buy.id, 264); assert.equal(v.offers[0].sell.id, 388);
  const out = g.run('/summon Creeper ~ ~ ~ {Age:-200,Health:0}');
  assert.equal(g.mobs.entities[1].growingAge, 0); assert.equal(g.mobs.entities[1].health, 0);
  assert.match(out.lines[0], /Not kept in this build: Age/);
});
