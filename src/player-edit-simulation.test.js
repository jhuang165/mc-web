import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, FIRE, RED_FLOWER, TNT, YELLOW_FLOWER } from './world.js';
import { CHEST } from './chest.js';
import { Survival } from './survival.js';
import { Farming } from './farming.js';
import { Trees } from './trees.js';
import { JavaRandom } from './java-random.js';
import { BOW } from './bow.js';
import { makeStack } from './inventory.js';
import { Projectiles } from './projectiles.js';
import { applyPlayerEdit } from './player-edit-simulation.js';
import { capturePlayerAction, dispatchPlayerAction } from './player-actions.js';
import { CAULDRON } from './stone-utility.js';
import { BOAT_ITEM } from './boats.js';

const POS = [42, 12, 42];
const FLOWERS = { yellow: YELLOW_FLOWER, red: RED_FLOWER };
function fixture({ mode = 'survival', tool = 0, count = 1, food = 10, block = 0, target = null,
  place = false, aimedEntity = null, screen = 'playing' } = {}) {
  const world = new World('player-edit-simulation');
  if (block || target?.block) {
    const at = target?.block ?? POS;
    world.set(...at, block, false, 0);
    world.set(at[0], at[1] + 1, at[2], 0, false, 0);
  }
  const survival = new Survival({ food, slots: tool ? [makeStack(tool, count)] : [] }, mode),
    farming = new Farming(world), trees = new Trees(world, { random: new JavaRandom(18) });
  const state = {
    screen, heldTool: tool, world, survival, position: { x: 10.5, y: 10, z: 10.5 }, velocity: { x: 0.1, y: 0, z: 0.2 },
    motion: { sneaking: false, sprinting: false }, mobs: {}, farming, trees, fire: {}, grounded: true,
    fallDistance: 0, wasInWater: false, yaw: 0, eating: null, mining: null, mineCooldown: 0, mineHeld: true,
    flowers: FLOWERS, boneRandom: new JavaRandom(21), itemRand: new JavaRandom(22),
  };
  return { state, request: { place, target, aimedEntity } };
}

test('not-playing gate skips unlock, swing and all requested effects', () => {
  const { state, request } = fixture({ screen: 'home', tool: 318, target: { block: [...POS] }, place: true });
  const calls = [];
  const result = applyPlayerEdit(state, request, { unlock: () => calls.push('unlock'), swing: () => calls.push('swing') });
  assert.deepEqual(result, { handled: false, branch: 'not-playing' });
  assert.deepEqual(calls, []);
  assert.equal(state.eating, null);
});

test('dyed and undyed leather wash exactly one cauldron level in Survival and Creative',()=>{
  for(const mode of ['survival','creative'])for(let level=0;level<4;level++)for(const dyed of [false,true]){
    const target={block:[...POS],adjacent:[POS[0]+1,POS[1],POS[2]]},f=fixture({mode,tool:400,target,block:CAULDRON,place:true}),calls=[];
    f.state.world.set(...POS,CAULDRON,true,level);
    f.state.survival.inventory.main[0]=makeStack(400,1,0,undefined,dyed?{color:0}:{});
    const before=f.state.survival.held;
    const result=applyPlayerEdit(f.state,f.request,{swing:()=>calls.push('swing'),updateBlock:(...args)=>calls.push(['update',...args]),renderHotbar:()=>calls.push('hotbar'),markUnsaved:()=>calls.push('dirty')});
    if(level===0){
      assert.equal(result.branch,'equip-armor');assert.equal(f.state.world.getMeta(...POS)&3,0);assert.equal(f.state.survival.held,null);
    }else{
      assert.equal(result.branch,'wash-leather',`${mode} level ${level} dyed ${dyed}`);
      assert.equal(f.state.world.getMeta(...POS)&3,level-1);assert.equal(f.state.survival.held.count,1);assert.equal(f.state.survival.held.color,undefined);
      assert.equal(calls.filter(c=>c==='hotbar').length,dyed?1:0);assert.equal(calls.filter(c=>c==='dirty').length,1);
      if(dyed)assert.notEqual(f.state.survival.held,before);
    }
  }
});

test('captured dyed armor activation reaches the wet cauldron before armor equip',()=>{
  const target={block:[...POS],adjacent:[POS[0]+1,POS[1],POS[2]]},f=fixture({mode:'survival',tool:400,target,block:CAULDRON,place:true}),calls=[];
  f.state.world.set(...POS,CAULDRON,true,2);
  f.state.survival.inventory.main[0]=makeStack(400,1,0,undefined,{color:0});
  const action=capturePlayerAction({place:true,target,heldTool:400});
  const result=dispatchPlayerAction(f.state,action,{swing:()=>calls.push('swing'),updateBlock:()=>calls.push('block'),renderHotbar:()=>calls.push('hotbar'),markUnsaved:()=>calls.push('dirty')});
  assert.equal(result.branch,'wash-leather');
  assert.equal(f.state.survival.held.color,undefined);
  assert.equal(f.state.survival.inventory.armor[3],null);
  assert.equal(f.state.world.getMeta(...POS)&3,1);
  assert.deepEqual(calls,['swing','hotbar','block','dirty']);
});

test('snowball, bow and bucket paths retain their pre-swing precedence', () => {
  const snowball = fixture({ mode: 'creative', tool: 312, place: true });
  snowball.state.pitch = 0;
  snowball.state.projectiles = new Projectiles(() => 0.25);
  const calls = [];
  assert.deepEqual(applyPlayerEdit(snowball.state, snowball.request, {
    unlock: () => calls.push('unlock'), random: () => 0.5, swing: () => calls.push('swing'),
    playSound: (name, options) => calls.push([name, options.volume, options.pitch]),
    resetEquipped: () => calls.push('reset'),
  }), { handled: true, branch: 'throw-projectile', projectile: 'snowball' });
  assert.deepEqual(calls, ['unlock', ['random.bow', 0.5, 0.4 / (0.5 * 0.4 + 0.8)]]);
  assert.equal(snowball.state.projectiles.balls.length, 1);
  assert.equal(snowball.state.survival.count(312), 1, 'Creative keeps the stack');

  const bow = fixture({ mode: 'creative', tool: BOW, place: true });
  assert.equal(applyPlayerEdit(bow.state, bow.request, { swing: () => calls.push('bow-swing') }).branch, 'begin-bow-use');
  assert.deepEqual(bow.state.eating, { id: BOW, ticks: 0, bow: true });
  assert.equal(calls.includes('bow-swing'), false);

  const milk = fixture({ mode: 'creative', tool: 343, place: true });
  assert.deepEqual(applyPlayerEdit(milk.state, milk.request, { swing: () => calls.push('milk-swing') }),
    { handled: true, branch: 'use-bucket', bucket: 'begin-drinking' });
  assert.deepEqual(milk.state.eating, { id: 343, ticks: 32, drink: true });
  assert.equal(calls.includes('milk-swing'), false);

  // A filled bucket without its captured trace is consumed, not turned into a placement.
  const water = fixture({ tool: 341, place: true, block: 1, target: { block: [...POS], adjacent: [POS[0], POS[1] + 1, POS[2]] } });
  assert.deepEqual(applyPlayerEdit(water.state, water.request, { swing: () => calls.push('water-swing') }),
    { handled: true, branch: 'use-bucket', bucket: 'invalid-bucket-target', skipped: true });
  assert.equal(water.state.world.get(POS[0], POS[1] + 1, POS[2]), 0);
  assert.equal(calls.includes('water-swing'), false);
});

test('a block station intercepts throwable activation and then receives the normal swing', () => {
  const target = { block: [...POS], adjacent: [POS[0] + 1, POS[1], POS[2]] },
    f = fixture({ mode: 'creative', tool: 312, block: 13, target, place: true }), calls = [];
  const result = applyPlayerEdit(f.state, f.request, {
    throwSnowball: () => calls.push('throw'), swing: () => calls.push('swing'), openInventory: (station) => calls.push(`inventory:${station}`),
  });
  assert.equal(result.branch, 'open-workbench');
  assert.deepEqual(calls, ['swing', 'inventory:true']);
});

test('left entity attack clears mining, computes critical/sprint inputs, and routes success effects in order', () => {
  const target = { block: [...POS] }, entity = { type: 'cow' },
    f = fixture({ tool: 103, target, aimedEntity: { entity } }), calls = [];
  f.state.fallDistance = 1;
  f.state.grounded = false;
  f.state.motion.sprinting = true;
  f.state.mining = { block: [...POS], type: 3, progress: 0.5, tool: 103, auto: false };
  f.state.mobs.attack = (...args) => { calls.push(['attack', args[4], args[5]]); return true; };
  const result = applyPlayerEdit(f.state, { ...f.request, place: false }, {
    swing: () => calls.push(['swing']), criticalHit: (e) => calls.push(['crit', e]),
    handleEntityEvents: () => calls.push(['events']), renderHotbar: () => calls.push(['hotbar']), markUnsaved: () => calls.push(['dirty']),
  });
  assert.equal(result.branch, 'attack-entity');
  assert.equal(f.state.mining, null);
  assert.deepEqual(calls, [['swing'], ['attack', 1, true], ['crit', entity], ['events'], ['hotbar'], ['dirty']]);
  assert.equal(f.state.velocity.x, 0.06);
  assert.equal(f.state.velocity.z, 0.12);
  assert.equal(f.state.motion.sprinting, false);
});

test('right entity interaction tries shearing before feeding/dyeing and then food use', () => {
  const entity = { type: 'sheep' }, f = fixture({ tool: 318, count: 1, aimedEntity: { entity }, place: true }), calls = [];
  f.state.mobs.shear = () => { calls.push('shear'); return true; };
  f.state.mobs.feed = () => { calls.push('feed'); return true; };
  f.state.mobs.dye = () => { calls.push('dye'); return true; };
  const result = applyPlayerEdit(f.state, f.request, {
    swing: () => calls.push('swing'), handleEntityEvents: () => calls.push('events'),
    renderHotbar: () => calls.push('hotbar'), markUnsaved: () => calls.push('dirty'),
  });
  assert.equal(result.branch, 'shear-entity');
  assert.deepEqual(calls, ['swing', 'shear', 'events', 'hotbar', 'dirty']);
  assert.equal(f.state.eating, null);
});

test('flint and steel creeper ignition wins before general right-entity interactions', () => {
  const entity = { type: 'creeper', health: 10, x: 2, y: 3, z: 4 },
    f = fixture({ tool: 126, aimedEntity: { entity }, place: true }), calls = [];
  f.state.mobs.shear = () => { throw new Error('creeper special case precedes generic entity interaction'); };
  const result = applyPlayerEdit(f.state, f.request, {
    random: () => 0.5,
    swing: () => calls.push('swing'),
    playSound: (name, options) => calls.push([name, options.pitch]),
    reportBrokenTool: () => calls.push('broken'), renderHotbar: () => calls.push('hotbar'), markUnsaved: () => calls.push('dirty'),
  });
  assert.equal(result.branch, 'ignite-creeper');
  assert.equal(entity.ignited, true);
  assert.deepEqual(calls, ['swing', ['fire.ignite', 1], 'broken', 'hotbar', 'dirty']);
});

test('food with no block target begins eating locally; full hunger only toasts', () => {
  const hungry = fixture({ tool: 318, count: 2, place: true });
  assert.equal(applyPlayerEdit(hungry.state, hungry.request).branch, 'no-block-target');
  assert.deepEqual(hungry.state.eating, { id: 318, ticks: 32 });

  const full = fixture({ tool: 318, food: 20, place: true }), calls = [];
  applyPlayerEdit(full.state, full.request, { toast: (text) => calls.push(text) });
  assert.equal(full.state.eating, null);
  assert.deepEqual(calls, ['You are not hungry.']);
});

test('hoe branch tills real soil before later placement dispatch and keeps observer order', () => {
  const target = { block: [...POS], adjacent: [POS[0] + 1, POS[1], POS[2]] },
    f = fixture({ tool: 120, target, place: true }), calls = [];
  f.state.world.set(...POS, 2, false, 0);
  f.state.world.set(POS[0], POS[1] + 1, POS[2], 0, false, 0);
  const result = applyPlayerEdit(f.state, f.request, {
    applyFarmUpdates: (updates) => calls.push(['farm', updates.length]), renderHotbar: () => calls.push('hotbar'),
    playSound: (name, opts) => calls.push([name, opts.volume]), markUnsaved: () => calls.push('dirty'),
  });
  assert.equal(result.branch, 'use-hoe');
  assert.equal(f.state.world.get(...POS), 29);
  assert.deepEqual(calls, [['farm', 1], 'hotbar', ['step.gravel', 1], 'dirty']);
});

test('TNT activation with flint primes and removes the clicked block before generic placement', () => {
  const target = { block: [...POS], adjacent: [POS[0] + 1, POS[1], POS[2]] },
    f = fixture({ tool: 126, block: TNT, target, place: true }), calls = [];
  const result = applyPlayerEdit(f.state, f.request, {
    lightTnt: (...a) => calls.push(['prime', ...a.slice(0, 4)]), updateBlock: (...a) => calls.push(['update', ...a.slice(0, 3)]),
    reportBrokenTool: () => calls.push('broken'), renderHotbar: () => calls.push('hotbar'), markUnsaved: () => calls.push('dirty'),
  });
  assert.equal(result.branch, 'prime-tnt');
  assert.equal(f.state.world.get(...POS), 0);
  assert.deepEqual(calls, [['prime', ...POS, 'player'], ['update', POS[0], POS[2], POS[1]], 'broken', 'hotbar', 'dirty']);
});

test('left-click extinguisher runs before mining-start and preserves sound/random/update order', () => {
  const target = { block: [...POS], adjacent: [POS[0] + 1, POS[1], POS[2]] },
    f = fixture({ tool: 0, block: 3, target }), calls = [];
  f.state.world.set(...target.adjacent, FIRE, false, 0);
  f.state.fire = {
    extinguish: (...p) => { calls.push(['extinguish', ...p]); f.state.world.set(...p, 0); },
    drain: () => [['fire-change']],
  };
  let n = 0;
  const result = applyPlayerEdit(f.state, { ...f.request, place: false }, {
    swing: () => calls.push('swing'), random: () => [0.1, 0.9][n++],
    playSound: (name, options) => calls.push([name, options.pitch]), updateBlocks: (changes) => calls.push(['updates', changes]),
    markUnsaved: () => calls.push('dirty'), clientEyeInWater: () => false,
  });
  assert.equal(result.branch, 'start-mining');
  assert.deepEqual(calls, ['swing', ['extinguish', ...target.adjacent], ['random.fizz', 1.96], ['updates', [['fire-change']]], 'dirty']);
  assert.deepEqual(f.state.mining, { block: [...POS], type: 3, progress: 0, tool: 0, auto: false });
});

test('Creative left click delegates break and cooldown; sword still stops before breaking', () => {
  const target = { block: [...POS] }, f = fixture({ mode: 'creative', tool: 103, block: 3, target }), calls = [];
  let result = applyPlayerEdit(f.state, { ...f.request, place: false }, {
    breakBlock: (p, creative) => calls.push([p, creative]),
  });
  assert.equal(result.branch, 'creative-break');
  assert.deepEqual(calls, [[POS, true]]);
  assert.equal(f.state.mineCooldown, 5);

  const sword = fixture({ mode: 'creative', tool: 112, block: 3, target });
  result = applyPlayerEdit(sword.state, { ...sword.request, place: false }, { breakBlock: () => calls.push('unexpected') });
  assert.equal(result.branch, 'creative-sword-no-break');
  assert.equal(sword.state.mineCooldown, 0);
});

test('Survival instant break preserves the one-argument break callback contract', () => {
  const target = { block: [...POS] }, f = fixture({ tool: 0, block: 48, target }), calls = [];
  const result = applyPlayerEdit(f.state, { ...f.request, place: false }, {
    clientEyeInWater: () => false,
    breakBlock: function (coords) { calls.push([coords, arguments.length]); },
  });
  assert.equal(result.branch, 'instant-break');
  assert.deepEqual(calls, [[POS, 1]]);
});

test('ordinary ItemBlock dispatch uses the extracted placement helper with real inventory/world state', () => {
  const target = { block: [...POS], adjacent: [POS[0], POS[1] + 1, POS[2]] },
    f = fixture({ tool: 3, count: 1, target, place: true }), calls = [];
  f.state.world.set(...POS, 2, false, 0);
  const result = applyPlayerEdit(f.state, f.request, {
    collides: () => false,
    updateBlock: (...p) => calls.push(['update', ...p]), renderHotbar: () => calls.push('hotbar'),
    sound: (...a) => calls.push(['sound', ...a]), markUnsaved: () => calls.push('dirty'),
  });
  assert.equal(result.branch, 'place-block');
  assert.equal(result.placement.placed, true);
  assert.equal(f.state.world.get(...target.adjacent), 3);
  assert.equal(f.state.survival.count(3), 0);
  assert.deepEqual(calls, [['update', target.adjacent[0], target.adjacent[2], target.adjacent[1]], 'hotbar', ['sound', true, 3], 'dirty']);
});

test('station precedence includes chest even when the held item would otherwise be a projectile', () => {
  const target = { block: [...POS], adjacent: [POS[0] + 1, POS[1], POS[2]] },
    f = fixture({ mode: 'creative', tool: 316, block: CHEST, target, place: true }), calls = [];
  f.state.survival.chests[target.block.join(',')] = { items: Array(27).fill(null), title: 'Chest' };
  const result = applyPlayerEdit(f.state, f.request, {
    swing: () => calls.push('swing'), throwSnowball: () => calls.push('throw'),
    openChest: (chest, key) => calls.push(['open', key, !!chest]),
  });
  assert.equal(result.branch, 'open-chest');
  assert.deepEqual(calls, ['swing', ['open', target.block.join(','), true]]);
});

test('anvil activation takes precedence over a held projectile and uses a captured block key',()=>{
 const target={block:[...POS],adjacent:[POS[0]+1,POS[1],POS[2]]};
 const f=fixture({mode:'creative',tool:316,block:85,target,place:true}),calls=[];
 const result=applyPlayerEdit(f.state,f.request,{swing:()=>calls.push('swing'),useAnvil:key=>calls.push(['anvil',key])});
 assert.equal(result.branch,'open-anvil');assert.deepEqual(calls,['swing',['anvil',target.block.join(',')]]);
});

test('enchanting table activation takes precedence over a held projectile and uses a captured block key',()=>{
 const target={block:[...POS],adjacent:[POS[0]+1,POS[1],POS[2]]};
 const f=fixture({mode:'creative',tool:316,block:86,target,place:true}),calls=[];
 const result=applyPlayerEdit(f.state,f.request,{swing:()=>calls.push('swing'),useEnchantingTable:key=>calls.push(['enchanting',key])});
 assert.equal(result.branch,'open-enchanting-table');assert.deepEqual(calls,['swing',['enchanting',target.block.join(',')]]);
});

test('a held boat opens a targeted chest instead of placing; on other blocks onItemRightClick places it', () => {
  const target = { block: [...POS], adjacent: [POS[0] + 1, POS[1], POS[2]] };
  let f = fixture({ mode: 'creative', tool: BOAT_ITEM, block: CHEST, target, place: true }), calls = [];
  f.state.survival.chests[target.block.join(',')] = { items: Array(27).fill(null), title: 'Chest' };
  let result = applyPlayerEdit(f.state, f.request, { swing: () => calls.push('swing'), placeBoat: () => { calls.push('boat'); return true; },
    openChest: (chest, key) => calls.push(['open', key, !!chest]) });
  assert.equal(result.branch, 'open-chest');
  assert.ok(!calls.includes('boat'));
  f = fixture({ mode: 'creative', tool: BOAT_ITEM, block: 3, target, place: true }); calls = [];
  result = applyPlayerEdit(f.state, f.request, { placeBoat: () => { calls.push('boat'); return true; } });
  assert.equal(result.branch, 'place-boat');
  assert.deepEqual(calls, ['boat']);
});

test('doors, crafting tables and furnaces activate before hoe, seed and bone-meal use; sneaking uses the item', async () => {
  const { DYE } = await import('./world.js');
  const target = { block: [...POS], adjacent: [POS[0], POS[1] + 1, POS[2]] };
  for (const [tool, damage] of [[120, 0], [309, 0], [DYE, 15]]) {
    const bench = fixture({ tool, block: 13, target, place: true }), calls = [];
    if (damage) bench.state.survival.inventory.main[0] = makeStack(tool, 1, damage);
    assert.equal(applyPlayerEdit(bench.state, bench.request, { openInventory: (s) => calls.push(s) }).branch, 'open-workbench', `bench ${tool}`);
    assert.deepEqual(calls, [true]);
    const furnace = fixture({ tool, block: 14, target, place: true }), opened = [];
    if (damage) furnace.state.survival.inventory.main[0] = makeStack(tool, 1, damage);
    assert.equal(applyPlayerEdit(furnace.state, furnace.request, { useFurnace: (k) => opened.push(k) }).branch, 'open-furnace', `furnace ${tool}`);
    assert.deepEqual(opened, [POS.join(',')]);
    const door = fixture({ tool, block: 97, target, place: true });
    if (damage) door.state.survival.inventory.main[0] = makeStack(tool, 1, damage);
    door.state.world.set(POS[0], POS[1] + 1, POS[2], 97, false, 8);
    assert.equal(applyPlayerEdit(door.state, door.request, {}).branch, 'use-door', `door ${tool}`);
  }
  // Sneaking with the hoe skips activation, so the crafting table is not opened.
  const sneak = fixture({ tool: 120, block: 13, target, place: true }), calls = [];
  sneak.state.motion.sneaking = true;
  assert.equal(applyPlayerEdit(sneak.state, sneak.request, { openInventory: () => calls.push('open') }).branch, 'use-hoe');
  assert.deepEqual(calls, []);
});
