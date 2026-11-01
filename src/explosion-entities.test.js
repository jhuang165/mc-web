import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Arrows } from './bow.js';
import { ItemEntities } from './item-entities.js';
import { primeTnt, explodeTnt, TNT_Y_OFFSET } from './explosion.js';
import { FallingBlocks, FALLING_Y_OFFSET, spawnFalling } from './falling.js';
import { GaussianRandom, Projectiles } from './projectiles.js';

const reference = JSON.parse(await readFile(new URL('../public/research/explosion-entities-reference.json', import.meta.url)));
const worldFrom = cells => {
  const blocks = new Map(cells.map(([x,y,z,id]) => [`${x},${y},${z}`, ({1:3,9:10,46:55}[id] ?? 0)]));
  const get = (x,y,z) => blocks.get(`${x},${y},${z}`) ?? (y < 0 ? 3 : 0);
  return {get, set:(x,y,z,id) => (blocks.set(`${x},${y},${z}`,id),true), getMeta: () => 0, solid: (x,y,z) => [3,55].includes(get(x,y,z))};
};

test('all six non-living entity families replay original explosion motion, damage and stuck state', () => {
  assert.equal(reference.cases.length, 54);
  for (const c of reference.cases) {
    const world = worldFrom(c.cells), arrows = new Arrows(), items = new ItemEntities(), projectiles = new Projectiles(), falling = new FallingBlocks(world);
    const targets = c.targets.map(([x,y,z], i) => {
      if (c.kind === 'arrow') {
        const a = arrows.make({x,y,z,mx:0.01,my:-0.02,mz:0.03,yaw:0,pitch:0}, new GaussianRandom(1), {inGround: i % 2 === 1});
        arrows.list.push(a);
        return a;
      }
      if (c.kind === 'snowball' || c.kind === 'egg') {
        const b = {x,y,z,mx:0.01,my:-0.02,mz:0.03,kind:c.kind,dead:false}; projectiles.balls.push(b); return b;
      }
      if (c.kind === 'sand') {
        const e = {x,y:y-FALLING_Y_OFFSET,z,vx:0.01,vy:-0.02,vz:0.03,dead:false}; falling.entities.push(e); return e;
      }
      if (c.kind === 'item') return items.spawn({id:3,count:1,damage:0}, x,y,z, {motion:[0.01,-0.02,0.03]});
      const e = primeTnt(x,y,z, {random: () => 0});
      [e.vx,e.vy,e.vz] = [0.01,-0.02,0.03];
      return e;
    });
    if (c.kind === 'arrow') arrows.explode(world,0.5,1.5,0.5,c.size);
    else if (c.kind === 'item') items.explode(world,0.5,1.5,0.5,c.size);
    else if (c.kind === 'sand') falling.explode(0.5,1.5,0.5,c.size);
    else if (c.kind === 'snowball' || c.kind === 'egg') projectiles.explode(world,0.5,1.5,0.5,c.size);
    else targets.forEach(e => explodeTnt(world,e,0.5,1.5,0.5,c.size));
    targets.forEach((e,i) => {
      const y = e.y + (c.kind === 'item' ? 0.125 : c.kind === 'tnt' ? TNT_Y_OFFSET : c.kind === 'sand' ? FALLING_Y_OFFSET : 0);
      const motion = (c.kind === 'tnt' || c.kind === 'sand') ? [e.vx,e.vy,e.vz] : [e.mx,e.my,e.mz];
      assert.deepEqual([e.x,y,e.z,...motion,c.kind === 'item' ? e.health : 0,!!e.dead,!!e.inGround], c.targets[i], `${c.kind}, cover ${c.shield}, power ${c.size}, target ${i}`);
    });
  }
});

test('a blast preserves a stuck arrow until its block is removed, then its next tick releases it', () => {
  const arrows = new Arrows(), rng = new GaussianRandom(7), world = worldFrom([[1,1,0,1]]);
  const a = arrows.make({x:1.5,y:1.5,z:0.5,mx:0.01,my:-0.02,mz:0.03,yaw:0,pitch:0}, rng,
    {inGround:true,xTile:1,yTile:1,zTile:0,inTile:3,inData:0,ticksInGround:10,shake:3,pickup:1});
  arrows.list.push(a);
  arrows.explode(world,0.5,1.5,0.5,3);
  assert.equal(a.inGround,true);
  assert.equal(a.shake,3);
  assert.equal(a.pickup,1);
  const motion = [a.mx,a.my,a.mz];
  arrows.tick(world);
  assert.equal(a.inGround,true);
  assert.equal(a.ticksInGround,11);
  assert.deepEqual([a.mx,a.my,a.mz],motion);
  const saved = arrows.serialize();
  const restored = new Arrows(); restored.load(saved);
  assert.deepEqual([restored.list[0].mx,restored.list[0].my,restored.list[0].mz],motion);
  const expectedRandom = new GaussianRandom(7);
  const expected = motion.map(v => v * Math.fround(expectedRandom.nextFloat() * Math.fround(0.2)));
  arrows.tick(worldFrom([]));
  assert.equal(a.inGround,false);
  assert.equal(a.ticksInGround,0);
  assert.equal(a.ticksInAir,0);
  assert.deepEqual([a.mx,a.my,a.mz],expected);
});

test('blasts skip dead arrows and the explicitly excluded exploder', () => {
  const arrows = new Arrows(), items = new ItemEntities(), world = worldFrom([]);
  const create = extra => arrows.make({x:1.5,y:1.5,z:0.5,mx:0.01,my:-0.02,mz:0.03,yaw:0,pitch:0}, new GaussianRandom(1), extra);
  const dead = create({dead:true}), excluded = create({}); arrows.list.push(dead,excluded);
  arrows.explode(world,0.5,1.5,0.5,3,excluded);
  for (const a of arrows.list) assert.deepEqual([a.mx,a.my,a.mz],[0.01,-0.02,0.03]);
  const item = items.spawn({id:3,count:1},1.5,1.5,0.5,{motion:[0.01,-0.02,0.03]});
  items.explode(world,0.5,1.5,0.5,3,item);
  assert.equal(item.health,5);
  assert.deepEqual([item.mx,item.my,item.mz],[0.01,-0.02,0.03]);
});


test('burning arrows hitting TNT match the original onUpdate ignition, water and last-fire-tick rules', () => {
  assert.equal(reference.ignition.length,48);
  for (const c of reference.ignition) {
    const cells=[[1,1,0,46]]; if(c.water)cells.push([0,1,c.grazing?-1:0,9]);
    const world=worldFrom(cells), arrows=new Arrows(), source=c.shooter?{type:'skeleton'}:null, spawned=[];
    const a=arrows.make({x:c.grazing?0.8:0.5,y:1.5,z:c.grazing?-1:0.5,mx:c.grazing?0:2,my:0,mz:c.grazing?1.5:0,yaw:0,pitch:0},new GaussianRandom(7),{fire:c.fire,shooter:source});
    arrows.list.push(a);
    arrows.tick(world,{igniteTnt:(x,y,z,placer)=>{
      spawned.push(primeTnt(x+0.5,y+0.5,z+0.5,{placer,random:()=>0}));
      world.set(x,y,z,0);
    }});
    const t=spawned[0];
    assert.deepEqual({primed:spawned.length===1,block:world.get(1,1,0)===55?46:0,fuse:t?.fuse??0,placer:!!t&&t.placer===source,sound:!!t},
      {primed:c.primed,block:c.block,fuse:c.fuse,placer:c.placer,sound:c.sound},`fire ${c.fire}, water ${c.water}, shooter ${c.shooter}`);
    assert.equal(a.dead,false);
    assert.equal(a.inGround,!c.grazing);
  }
});


test('blast-deflected thrown items and falling blocks keep their motion across save/load',()=>{
  const world=worldFrom([]),projectiles=new Projectiles(()=>0.25),falling=new FallingBlocks(world);
  projectiles.load([{kind:'egg',x:2,y:5,z:0.5,mx:0.1,my:0.2,mz:0.03,yaw:0,pitch:0}]);
  const e=spawnFalling(6,0,2,4,0);e.ticks=2;falling.entities.push(e);
  projectiles.explode(world,0.5,4.5,0.5,4);falling.explode(0.5,4.5,0.5,4);
  assert.equal(projectiles.balls[0].dead,false);assert.equal(e.dead,false);
  assert.equal(projectiles.events.length,0);assert.equal(projectiles.particles.length,0);
  const saved=projectiles.serialize(),back=new Projectiles();back.load(saved);
  assert.deepEqual(back.serialize(),saved);
  const savedFall=falling.serialize(),backFall=new FallingBlocks(world,{},savedFall);
  assert.deepEqual(backFall.serialize(),savedFall);
  const oldMotion=[back.balls[0].mx,back.balls[0].my,back.balls[0].mz];
  projectiles.explode(world,0.5,4.5,0.5,4,projectiles.balls[0]);
  assert.deepEqual([projectiles.balls[0].mx,projectiles.balls[0].my,projectiles.balls[0].mz],oldMotion);
  const fallMotion=[e.vx,e.vy,e.vz];falling.explode(0.5,4.5,0.5,4,e);
  assert.deepEqual([e.vx,e.vy,e.vz],fallMotion);
});
