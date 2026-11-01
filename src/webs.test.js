import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WEB, World, BLOCKS, blockBounds, opaqueCube, normalCube, collides } from './world.js';
import { webContact, webMove } from './webs.js';
import { moveEntity } from './entities.js';
import { ItemEntities } from './item-entities.js';
import { Survival, MATERIALS } from './survival.js';
import { lightOpacity } from './lighting.js';
import { defaultClassify } from './pathfinding.js';
import { rayTraceBlocks } from './buckets.js';
import { blockTile, TILES } from './block-textures.js';
import { itemTexture } from './first-person.js';

const reference = JSON.parse(await readFile(new URL('../public/research/web-reference.json', import.meta.url)));
const world = { get: (x,y,z) => y<0 ? 3 : x===0 && y>=2 && y<=5 && z===0 ? WEB : 0, solid: (x,y,z) => y<0 };
const near = (actual, expected, label) => assert.ok(Math.abs(actual-expected)<1e-6, `${label}: ${actual} != ${expected}`);

test('252 original BlockWeb, Entity move/contact and spider immunity records', () => {
  assert.equal(reference.records.length, 252);
  const facts = reference.records[0];
  assert.equal(MATERIALS[WEB].hardness, facts.hardness);
  assert.equal(lightOpacity(WEB), facts.opacity);
  assert.equal(opaqueCube(WEB), facts.opaque);
  assert.equal(normalCube(WEB), facts.normal);
  assert.equal(defaultClassify(WEB).passable, facts.passable);
  assert.equal(facts.drop, 287);
  for (const r of reference.records.filter(r=>r.case==='player')) {
    const state={fallDistance:12};webContact(world,[0,4,0,1,5,1],state,r.flying);
    assert.equal(!!state.inWeb,r.web);assert.equal(state.fallDistance,r.fall);
  }
  const items = new ItemEntities();
  for (const type of ['pig', 'spider', 'item']) {
    const e = type==='item' ? items.spawn({id:321,count:1,damage:0}, .5,4.125,.5) : { type, x:.5,y:4,z:.5, fallDistance:12 };
    for (const r of reference.records.filter(r => r.case==='move' && r.type===type)) {
      const dx=r.tick<40?.12:1, dz=r.tick<40?-.08:0;
      if (type==='item') { e.mx=dx;e.my=-.4;e.mz=dz;items.move(world,e,false); }
      else { e.vx=dx;e.vy=-.4;e.vz=dz;moveEntity(world,e,type==='spider'?1.4:.9,.9,dx,-.4,dz); }
      for (const a of ['x','y','z']) near(e[a],r[a],`${type} ${r.tick} ${a}`);
      for (const [a,b] of [['vx','mx'],['vy','my'],['vz','mz']]) near(e[type==='item'?b:a],r[a],`${type} ${r.tick} ${a}`);
      assert.equal(!!e.inWeb,r.web,`${type} ${r.tick} web`);
      if(type!=='item') near(e.fallDistance,r.fall,`${type} ${r.tick} fall`);
    }
  }
  for (const r of reference.records.filter(r=>r.case==='contact')) {
    const e={type:'pig',x:r.at,y:4,z:.5,vx:0,vy:0,vz:0,fallDistance:12};
    moveEntity(world,e,.9,.9,0,0,0);
    assert.equal(!!e.inWeb,r.web,`boundary ${r.at}`);
    near(e.fallDistance,r.fall,`boundary ${r.at} fall`);
  }
});

test('player web movement consumes prior contact before motion and clears fall distance', () => {
  const state = { fallDistance:14 }, velocity={x:1,y:-2,z:-1};
  assert.deepEqual(webMove(state,velocity,['x','y','z']),[1,-2,-1]);
  webContact(world,[0,4,0,1,5.8,1],state);
  assert.equal(state.fallDistance,0);
  assert.deepEqual(webMove(state,velocity,['x','y','z']),[.25,-.10000000149011612,-.25]);
  assert.deepEqual(velocity,{x:0,y:0,z:0});
  assert.equal(state.inWeb,false);
  assert.deepEqual(webMove(state,{x:1,y:2,z:3},['x','y','z']),[1,2,3]);
});

test('webs are selectable full blocks without collision, support requirements or plant replacement', () => {
  const w=Object.create(World.prototype);
  w.get=world.get;w.getMeta=()=>0;
  assert.equal(w.solid(0,4,0),false);
  assert.equal(collides(w,.5,4,.5),false);
  assert.deepEqual(blockBounds(w,0,4,0),[0,0,0,1,1,1]);
  const start=[-2,4.5,.5],end=[2,4.5,.5];
  assert.ok(rayTraceBlocks(w,start,end));
  assert.equal(rayTraceBlocks(w,start,end,false,true),null);
  assert.equal(BLOCKS[WEB].name,'Cobweb');
  assert.equal(TILES[blockTile(WEB,0)],'web');
  assert.equal(itemTexture(WEB),'/media/1.7.10/blocks/web.png');
});

test('1.7.10 swords and shears harvest string; shears never return a cobweb without silk touch', () => {
  const p=new Survival({slots:[{id:125,count:1},{id:112,count:1},{id:103,count:1}]});
  assert.equal(p.mining(WEB,0).harvest,false);
  assert.equal(p.mining(WEB,103).harvest,false);
  for(const tool of [125,112]) {
    assert.equal(p.mining(WEB,tool).speed,15);
    assert.equal(p.mining(WEB,tool).harvest,true);
    p.wearBlock(WEB,tool);
  }
  assert.equal(MATERIALS[WEB].drop,321);
  assert.equal(p.inventory.main[0].damage,1);
  assert.equal(p.inventory.main[1].damage,2);
});

test('web edits and stacks survive save/restore; water washes the block away', async () => {
  const { Fluids } = await import('./fluids.js');
  const w=new World('web persistence');
  for(const c of w.chunks.values()){c.blocks.fill(0);c.meta.fill(0);c.tickCounts=null;}w.edits.clear();
  w.set(64,40,64,WEB);
  const restored=new World('web persistence');restored.restore([...w.edits]);
  assert.equal(restored.get(64,40,64),WEB);
  const p=new Survival({slots:[{id:WEB,count:8,damage:0}]});
  assert.deepEqual(new Survival(p.serialize()).held,p.held);
  const washed=[],fluids=new Fluids(w,{wash:(x,y,z,b)=>washed.push([x,y,z,b])});
  fluids.flowInto(64,40,64,1,10);
  assert.deepEqual(washed,[[64,40,64,WEB]]);
  assert.equal(w.get(64,40,64),10);
});

test('XP orbs use web contact, consume its slowdown and omit transient flags from saves', async () => {
  const { ExperienceOrbs, Experience }=await import('./experience.js');
  const orbs=new ExperienceOrbs([{x:.5,y:4,z:.5,value:1,life:200}]),o=orbs.orbs[0];
  const player={x:40,y:4,z:40},xp=new Experience();
  orbs.tick(world,player,xp);assert.equal(o.inWeb,true);
  const y=o.y;
  orbs.tick(world,player,xp);
  near(o.y-y,(-.03*.98-.03)*0.05000000074505806,'orb web fall');
  assert.equal(o.vy,0);
  assert.ok(!('inWeb' in orbs.serialize()[0]));
});
