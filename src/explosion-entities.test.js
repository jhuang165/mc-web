import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Arrows } from './bow.js';
import { ItemEntities } from './item-entities.js';
import { primeTnt, explodeTnt, TNT_Y_OFFSET } from './explosion.js';
import { GaussianRandom } from './projectiles.js';

const reference = JSON.parse(await readFile(new URL('../public/research/explosion-entities-reference.json', import.meta.url)));
const worldFrom = cells => {
  const blocks = new Map(cells.map(([x,y,z,id]) => [`${x},${y},${z}`, id === 1 ? 3 : 0]));
  const get = (x,y,z) => blocks.get(`${x},${y},${z}`) ?? (y < 0 ? 3 : 0);
  return {get, getMeta: () => 0, solid: (x,y,z) => get(x,y,z) === 3};
};

test('arrows, items and primed TNT replay original explosion motion, damage and stuck state', () => {
  assert.equal(reference.cases.length, 27);
  for (const c of reference.cases) {
    const world = worldFrom(c.cells), arrows = new Arrows(), items = new ItemEntities();
    const targets = c.targets.map(([x,y,z], i) => {
      if (c.kind === 'arrow') {
        const a = arrows.make({x,y,z,mx:0.01,my:-0.02,mz:0.03,yaw:0,pitch:0}, new GaussianRandom(1), {inGround: i % 2 === 1});
        arrows.list.push(a);
        return a;
      }
      if (c.kind === 'item') return items.spawn({id:3,count:1,damage:0}, x,y,z, {motion:[0.01,-0.02,0.03]});
      const e = primeTnt(x,y,z, {random: () => 0});
      [e.vx,e.vy,e.vz] = [0.01,-0.02,0.03];
      return e;
    });
    if (c.kind === 'arrow') arrows.explode(world,0.5,1.5,0.5,c.size);
    else if (c.kind === 'item') items.explode(world,0.5,1.5,0.5,c.size);
    else targets.forEach(e => explodeTnt(world,e,0.5,1.5,0.5,c.size));
    targets.forEach((e,i) => {
      const y = e.y + (c.kind === 'item' ? 0.125 : c.kind === 'tnt' ? TNT_Y_OFFSET : 0);
      const motion = c.kind === 'tnt' ? [e.vx,e.vy,e.vz] : [e.mx,e.my,e.mz];
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
