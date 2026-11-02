import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World, WATER, FIRE, SAND } from './world.js';
import { toOriginal } from './block-registry.js';
import { Fluids } from './fluids.js';
import { Fire } from './fire.js';
import { FallingBlocks } from './falling.js';
import { Weather, precipitationHeight } from './weather.js';
import { StreamingLight } from './streaming-light.js';
import { movePlayer } from './player-physics.js';
import { playerFixture } from './player-physics-fixture.js';
import { ItemEntities } from './item-entities.js';
import { makeStack } from './inventory.js';
import { Survival } from './survival.js';
import { EntityWorld } from './entities.js';
import { Projectiles } from './projectiles.js';
import { Arrows } from './bow.js';
import { Minecarts } from './minecarts.js';
import { ExperienceOrbs } from './experience.js';
import { primeTnt } from './explosion.js';
import { tickPrimedTnt } from './entity-simulation.js';

const sha = a => createHash('sha1').update(a).digest('hex');
const json = v => JSON.parse(JSON.stringify(v));
const world = () => { const w=new World('17','javaStreamed'); w.blockLight=()=>0; return w; };

test('streamed negative and distant chunks replay independent native cave/terrain fixtures',()=>{
  const ref=JSON.parse(readFileSync(new URL('../public/research/carver-reference.json',import.meta.url)));
  const w=new World('0','javaStreamed');
  const samples=ref.records.filter(r=>r.kind==='chunk'&&r.type==='default'&&r.seed==='0');
  assert.ok(samples.length>=3);
  for(const r of samples){
    const x=r.x-w.originX/16,z=r.z-w.originZ/16;
    w.streamAround(x*16+8,z*16+8);
    const c=w.chunkAt(x,z),bytes=Buffer.alloc(c.blocks.length*2);
    for(let i=0;i<c.blocks.length;i++){
      const [id]=toOriginal(c.blocks[i],c.meta[i]);
      bytes.writeUInt16LE(id===8?9:id===10?11:id,i*2);
    }
    assert.equal(sha(bytes),r.runtimeSha1,`${r.x},${r.z}`);
    assert.equal(sha(c.meta),r.metadataSha1);
  }
});

test('resident memory stays at 64 columns and edits survive eviction, negative coordinates and JSON reload',()=>{
  const w=world(),baseline=sha(w.chunkAt(4,4).blocks);
  w.set(64,180,64,58,true,12); w.set(65,0,64,0);
  const retained=w.chunkAt(4,4);
  w.streamAround(80,64);
  assert.equal(w.chunkAt(4,4),retained,'overlapping columns stay resident');
  for(const [x,z] of [[-48,-32],[512,-256],[-1024,2048],[1048592,0]]){
    w.streamAround(x,z); assert.equal(w.chunks.size,64);
    assert.ok(w.javaGenerator.manager.cache.size<=100,'biome lookup arrays are evicted too');
    assert.equal(w.set(x,180,z,19,true,14),true);
  }
  assert.equal(w.isLoaded(64,64),false);
  assert.equal(w.set(64,180,64,3),false,'an unloaded write never creates a ghost column');
  const restored=world();restored.restore(json([...w.edits]));
  for(const [x,z] of [[64,64],[-48,-32],[512,-256],[-1024,2048],[1048592,0]]){
    restored.streamAround(x,z);
    assert.equal(restored.chunks.size,64);
    assert.equal(restored.get(x,180,z),x===64?58:19);
    assert.equal(restored.getMeta(x,180,z),x===64?12:14);
  }
  w.streamAround(64,64);
  assert.equal(w.get(65,0,64),0,'an air edit in the floor survives regeneration');
  w.set(64,180,64,0);
  // Ignore just the edited cell when comparing the regenerated terrain to its original fingerprint.
  const clean=world();
  assert.equal(sha(clean.chunkAt(4,4).blocks),baseline);
  assert.equal(w.chunkEdits.size,5,'only edited columns acquire a journal');
  assert.throws(()=>w.restore([['NaN,0,0',1]]));
  assert.throws(()=>w.restore([[`${30000000-w.originX},0,0`,1]]));
});

test('fluid, fire and falling deadlines pause while unloaded and retain order through a saved checkpoint',()=>{
  const w=world();
  w.set(64,180,64,WATER);w.set(66,180,64,FIRE);w.set(68,180,64,SAND);
  const fluids=new Fluids(w),fire=new Fire(w,{weather:()=>new Weather()});fire.sharedRandomTicks=true;
  const falling=new FallingBlocks(w);
  fluids.schedule(64,180,64,7);fire.schedule(66,180,64,9);falling.schedule(68,180,64);
  const initial=[fluids.save().entries,fire.save().entries,falling.save().entries];
  w.streamAround(-512,-512);
  for(let i=0;i<30;i++){fluids.tick();fire.tick();falling.tick();}
  assert.deepEqual([fluids.save().entries,fire.save().entries,falling.save().entries],initial);
  const resumed=world();resumed.restore(json([...w.edits]));resumed.streamAround(-512,-512);
  const f2=new Fluids(resumed),fire2=new Fire(resumed,{weather:()=>new Weather()}),s2=new FallingBlocks(resumed);fire2.sharedRandomTicks=true;
  f2.load(json(fluids.save()));fire2.load(json(fire.save()));s2.load(json(falling.save()));
  assert.deepEqual([f2.save(),fire2.save(),s2.save()],[fluids.save(),fire.save(),falling.save()]);
  resumed.streamAround(64,64);
  f2.tick();fire2.tick();s2.tick();
  assert.deepEqual([f2.save().entries[0].delay,fire2.save().entries[0].delay,s2.save().entries[0].delay],[6,8,1]);
  s2.tick();assert.equal(s2.entities.length,1,'falling work resumes when its column returns');
  assert.equal(resumed.get(68,180,64),0);
  // Positions that aliased in the old finite flat index now have distinct pending entries.
  resumed.streamAround(-64,64);resumed.set(-1,180,64,WATER);resumed.set(0,180,-64,WATER);
  f2.enqueue(-1,180,64,WATER,5);f2.enqueue(0,180,-64,WATER,5);
  assert.notEqual(f2.key(-1,180,64,WATER),f2.key(0,180,-64,WATER));
});

test('light and weather cross zero and player movement crosses the former map edge',()=>{
  const w=world();w.streamAround(0,0);
  w.set(-1,200,0,20);const light=new StreamingLight(w);
  assert.equal(light.blockAt(-1,200,0),14);assert.equal(light.blockAt(0,200,0),13);
  assert.equal(light.skyAt(-1,230,0),15);
  assert.ok(precipitationHeight(w,-1,0)>0);
  assert.equal(Weather.activeChunks(-1,0,10,w).length,36);
  assert.ok(Weather.activeChunks(-1,0,10,w).some(([x])=>x<0));
  w.set(-1,200,0,0);light.update(-1,200,0);assert.equal(light.blockAt(0,200,0),0);
  w.streamAround(128,128);
  const s=playerFixture('land');s.world=w;s.position={x:128.5,y:220,z:128.5};s.previous={...s.position};s.velocity={x:0,y:0,z:0};s.flying=true;
  movePlayer(s,{});
  assert.ok(s.position.x>128 && s.position.z>128,'the legacy 127.69 clamp is gone');
});

test('unloaded drops and furnaces freeze while retaining their save data',()=>{
  const w=world(),items=new ItemEntities();
  items.spawn(makeStack(3,1),64.5,180,64.5,{delay:10});
  const player=new Survival({},'creative');
  player.furnaces['64,180,64']={items:[makeStack(16,1),makeStack(301,1),null],burn:10,burnTotal:10,cook:5};
  player.furnaceActive=key=>{const [x,,z]=key.split(',').map(Number);return w.isTicking(x,z);};
  const before=json(items.serialize()),furnaces=json(player.serialize().furnaces);
  w.streamAround(-512,-512);
  for(let i=0;i<20;i++){items.tick(w);player.tickFurnaces();}
  assert.deepEqual(json(items.serialize()),before);assert.deepEqual(json(player.serialize().furnaces),furnaces);
  w.streamAround(64,64);items.tick(w);player.tickFurnaces();
  assert.notDeepEqual(json(items.serialize()),before);assert.equal(player.furnaces['64,180,64'].cook,6);
});

test('mobs, carts, projectiles, XP and primed TNT retain unloaded state and resume on return',()=>{
  const w=world(),p={x:64.5,y:180,z:64.5},survival=new Survival({},'creative');
  const mobs=new EntityWorld(w,[]);mobs.entities.push(mobs.create('pig',p.x,p.y,p.z));
  const balls=new Projectiles(),arrows=new Arrows(),carts=new Minecarts(),orbs=new ExperienceOrbs();
  balls.throwSnowball(p,0,0);arrows.shootPlayer(p,0,0,1);carts.spawnEmpty(p);orbs.spawn(1,p);
  const tnt=[primeTnt(64,180,64,{fuse:80})];
  const snapshot=()=>json([mobs.serialize(),balls.serialize(),arrows.serialize(),carts.toJSON(),orbs.serialize(),tnt]);
  const before=snapshot();
  w.streamAround(-512,-512);
  for(let i=0;i<10;i++){
    mobs.tick({x:-512,y:180,z:-512},survival);balls.tick(w);arrows.tick(w);carts.tick(w);orbs.tick(w,null);tickPrimedTnt(w,tnt);
  }
  assert.deepEqual(snapshot(),before);
  const restored=new EntityWorld(w,json(mobs.serialize()));
  assert.equal(restored.entities.length,1,'unloaded entities are accepted on restore');
  w.streamAround(64,64);balls.tick(w);arrows.tick(w);carts.tick(w);orbs.tick(w,null);tickPrimedTnt(w,tnt);
  assert.notDeepEqual(snapshot(),before);assert.equal(tnt[0].fuse,79);
});

test('a failed generation batch leaves the current resident set and bounds intact',()=>{
  const w=world(),chunks=w.chunks,generate=w.generateTerrainChunk;
  let calls=0;w.generateTerrainChunk=(...args)=>{if(++calls===3)throw new Error('generation failed');return generate(...args);};
  assert.throws(()=>w.streamAround(-512,-512),/generation failed/);
  assert.equal(w.chunks,chunks);assert.deepEqual([w.minX,w.minZ,w.maxX,w.maxZ],[0,0,128,128]);
  assert.equal(w.isLoaded(64,64),true);
});
