import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { World } from './world.js';
import { Survival } from './survival.js';
import { createCommandHost } from './command-host.js';
import { createCommandRunner } from './commands.js';
import { createRedstoneRuntime } from './redstone-runtime.js';
import { commandBlockSender, newCommandBlock, readCommandBlock, writeCommandBlock } from './command-block.js';
import { splitRuntime, joinRuntime } from './chunk-runtime.js';
import { parseJsonNbt } from './json-nbt.js';

function game() {
  const world = new World('command-block', 'meadow', 1), survival = new Survival({}, 'creative'), active = { mode: 'creative', allowCommands: true }, lines = [];
  let runtime;
  const host = createCommandHost({ active: () => active, world: () => world, survival: () => survival,
    position: () => ({ x: 30.5, y: 60, z: 30.5 }), commandTile: (...p) => runtime.commandBlocks.tile(...p),
    changed() {}, updateBlock() {}, refreshInventory() {}, stackName: () => 'diamond', dropStack() {},
    setTime() {}, destroyBlock(x,y,z) { world.set(x,y,z,0); } });
  host.print = text => lines.push(text);
  runtime = createRedstoneRuntime({ world, game: { commandHost: () => host } });
  return { world, survival, active, host, runtime, lines, run: createCommandRunner(host).run };
}

test('command block executes once, one tick after each rising edge, with comparator success', () => {
  const g = game(), r = g.runtime.redstone;
  g.run('/setblock 10 60 10 command_block 0 replace {Command:"time set 1234"}');
  r.setBlock(11,60,10,152,0,3);
  assert.equal(g.survival.time, 0);
  g.runtime.tick();
  assert.equal(g.survival.time, 1234);
  const tile = g.runtime.commandBlocks.tile(10,60,10);
  assert.equal(tile.successCount, 1); assert.match(tile.lastOutput, /Set the time to 1234/);
  assert.equal(r.behaviours[137].comparator(r,10,60,10), 1);
  tile.command = 'time add 10';
  for (let i=0;i<4;i++) g.runtime.tick();
  assert.equal(g.survival.time, 1234);
  r.setBlockToAir(11,60,10); r.setBlock(11,60,10,152,0,3); g.runtime.tick();
  assert.equal(g.survival.time, 1244);
  tile.command = 'testfor Nobody';
  r.setBlockToAir(11,60,10); r.setBlock(11,60,10,152,0,3); g.runtime.tick();
  assert.equal(tile.successCount, 0);
  g.runtime.dispose();
});

test('command block sender has level 2, its own position and name, player selectors and independent tracked output', () => {
  const g = game(), tile = newCommandBlock(), sender = commandBlockSender(g.host, tile, {x:10,y:60,z:10}, {now:()=>new Date(2026,10,4,12,34,56)}), runner = createCommandRunner(sender);
  assert.equal(runner.run('give @p diamond 2'), true);
  assert.equal(g.survival.count(303), 2);
  assert.match(g.lines[0], /^§7§o\[@: Given/);
  g.active.gameRules.commandBlockOutput = 'false'; g.lines.length = 0;
  runner.run('time set 3'); assert.equal(g.lines.length, 0); assert.match(tile.lastOutput, /\[12:34:56\] Set the time to 3/);
  tile.trackOutput = false; const before = tile.lastOutput;
  runner.run('time set 4'); assert.equal(tile.lastOutput, before);
  assert.equal(runner.run('publish'), false); assert.equal(runner.run('kill'), false);
  assert.equal(runner.run('say hello'), true); assert.equal(g.lines[0], '[@] hello');
  for (const selector of ['@p','@a','@r']) assert.equal(runner.run('testfor '+selector), true);
  assert.equal(runner.run('setblock ~ ~1 ~ stone'), true);
  assert.equal(g.world.get(10,61,10), 3);
  g.runtime.dispose();
});

test('Control tiles retain NBT, command tests, runtime chunk saves and redstone reload', () => {
  const g = game();
  g.run('/setblock 10 60 10 command_block 0 replace {Command:"give @p diamond 1",CustomName:Tester,TrackOutput:0b}');
  assert.equal(g.run('/testforblock 10 60 10 command_block -1 {Command:"give @p diamond 1",TrackOutput:0b}'), true);
  const records = g.runtime.commandBlocks.save(), record = {id:'test',commandBlocks:records};
  const {metadata,columns}=splitRuntime(record), joined=joinRuntime(metadata,columns);
  assert.deepEqual(joined.commandBlocks, records);
  g.runtime.commandBlocks.restore(joined.commandBlocks);
  const tile=g.runtime.commandBlocks.tile(10,60,10);
  assert.deepEqual(readCommandBlock(writeCommandBlock(tile,10,60,10)), tile);
  const withOutput=readCommandBlock(parseJsonNbt('{Command:seed,LastOutput:"hello",SuccessCount:4}').value);
  assert.equal(withOutput.successCount,4);
  g.runtime.dispose();
});

test('command block bytecode evidence records native timing, power bit, permission and output rule', async () => {
  const r=JSON.parse(await readFile(new URL('../public/research/command-block-reference.json',import.meta.url)));
  assert.equal(r.clientSha1,'e80d9b3bf5085002218d4be59e668bac718abbc6');
  assert.deepEqual(r.constants,{originalId:137,internalId:139,triggerBit:1,tickRate:1,permissionLevel:2,maxCommandLength:32767});
  assert.equal(r.evidence,'javap bytecode assertions; no integrated native server execution');
});


test('command tiles in unloaded columns survive a save; TrackOutput only reads an actual byte tag', () => {
  const g=game();
  g.run('/setblock 10 60 10 command_block 0 replace {Command:seed}');
  g.runtime.redstone.loaded=()=>false;
  g.world.get=()=>0;
  assert.equal(g.runtime.commandBlocks.save().length,1);
  assert.equal(readCommandBlock(parseJsonNbt('{TrackOutput:0}').value).trackOutput,true);
  assert.equal(readCommandBlock(parseJsonNbt('{TrackOutput:0b}').value).trackOutput,false);
  g.runtime.dispose();
});


test('the command block item places its original block, has its original texture, and resists explosions', async () => {
  const {placeHeldBlock}=await import('./block-placement-simulation.js');
  const {ITEMS}=await import('./survival.js');
  const {blockTile,TILES}=await import('./block-textures.js');
  const {explosionResistance}=await import('./explosion.js');
  const g=game(); g.world.set(10,59,10,3); g.world.set(10,60,10,0);
  const result=placeHeldBlock({world:g.world,survival:g.survival,position:{x:20,y:60,z:20},yaw:0,farming:{observe(){}}}, {id:1139,item:ITEMS[1139],target:{block:[10,59,10],adjacent:[10,60,10]}});
  assert.equal(result.placed,true); assert.equal(g.world.get(10,60,10),139);
  assert.equal(TILES[blockTile(1139,0)],'command_block');
  assert.equal(explosionResistance(139),3600000);
  g.runtime.dispose();
});
