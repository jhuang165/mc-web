import test from 'node:test';
import assert from 'node:assert/strict';
import { ContainerResidency } from './container-residency.js';
import { Survival } from './survival.js';
import { World } from './world.js';

const world=()=>new World('17','javaStreamed',12);
const reader=disk=>async(id,columns)=>columns.map(([x,z])=>structuredClone(disk.get(`${x},${z}`)??{world:id,x,z,state:{}}));
const chest=()=>({facing:5,items:[{id:322,count:7,damage:0}]});
async function travel(manager,x,z) {
 manager.update(x,z);await manager.ensure(manager.columns(x,z,1));
 manager.world.streamAround(x,z);manager.admit();manager.update(x,z);
}
function commit(manager,disk) {
 const token=manager.beginSave(manager.survival.serialize());
 for(const k of token.scope) {
  const [x,z]=k.split(',').map(Number),state=token.states.get(k);
  if(state)disk.set(k,{world:manager.id,x,z,state:structuredClone(state)});else disk.delete(k);
 }
 manager.finishSave(token,true);return token;
}

test('container window keeps inventories bounded and restores distant negative chests and paused furnaces',async()=>{
 const w=world(),s=new Survival({chests:{'1,70,1':chest()}},'creative'),disk=new Map();
 const manager=new ContainerResidency(w,'w',s,{read:reader(disk)});
 s.furnaceActive=k=>w.isTicking(...[k.split(',')[0],k.split(',')[2]].map(Number));
 s.furnaces['32,70,32']={items:[{id:6,count:2,damage:0},null,null],burn:200,burnTotal:300,cook:50};
 const furnace=structuredClone(s.furnaces['32,70,32']);
 disk.set('-2,-1',{world:'w',x:-2,z:-1,state:{chests:{'-17,70,-1':chest()}}});
 const health=s.health,inventory=s.inventory;
 for(let i=0;i<6;i++) {
  commit(manager,disk);await travel(manager,64+i*192,64);
  assert.ok(manager.live.size+manager.cache.size<=100);
  s.chests[`${64+i*192},70,64`]={facing:3,items:Array(27).fill(null)};
 }
 assert.equal(s.chests['1,70,1'],undefined);assert.equal(s.furnaces['32,70,32'],undefined);
 for(let i=0;i<40;i++)s.tick();
 commit(manager,disk);await travel(manager,64,64);
 assert.equal(s.chests['1,70,1'].items[0].count,7);assert.equal(s.chests['1,70,1'].facing,5);
 assert.deepEqual(s.furnaces['32,70,32'],furnace,'unloaded furnace retains exact counters');
 s.tickFurnaces();assert.equal(s.furnaces['32,70,32'].burn,199);
 assert.equal(s.health,health);assert.equal(s.inventory,inventory,'hydration never replaces player inventory');
 commit(manager,disk);await travel(manager,-32,-32);
 assert.equal(s.chests['-17,70,-1'].items[0].count,7);
});

test('reads gate entry, do not hydrate prefetch data, and disposed responses cannot touch live containers',async()=>{
 const w=world(),s=new Survival();let finish;
 const manager=new ContainerResidency(w,'w',s,{read:(id,columns)=>new Promise(resolve=>{finish=()=>resolve(columns.map(([x,z])=>({x,z,state:x===20&&z===0?{chests:{'320,70,1':chest()}}:{}})));})});
 const pending=manager.ensure(manager.columns(384,64));
 assert.equal(manager.ready(384,64),false);finish();await pending;
 assert.equal(manager.ready(384,64),true);assert.equal(s.chests['320,70,1'],undefined);
 w.streamAround(384,64);manager.admit();assert.equal(s.chests['320,70,1'].items[0].count,7);
 const late=manager.ensure([[80,80]]);manager.dispose();finish();await late;
 assert.equal(manager.cache.size,0);
 const reopened={containerScope:[[80,80]],player:{chests:{'1280,70,1280':chest()}}};
 manager.pruneRecord(reopened);assert.ok(reopened.player.chests['1280,70,1280'],'disposed session cannot prune a reopened snapshot');
});

test('bad or rejected inventory reads never permit traversal or partially hydrate a batch',async()=>{
 const w=world(),s=new Survival();let errors=0;
 const manager=new ContainerResidency(w,'w',s,{onError:()=>errors++,read:async(id,columns)=>columns.map(([x,z],i)=>({x,z,state:i?{chests:{'1,70,1':chest()}}:{}}))});
 await assert.rejects(manager.ensure(manager.columns(384,64)),/damaged/);
 assert.equal(errors,1);assert.equal(manager.cache.size,0);assert.equal(manager.ready(384,64),false);
 const bad=new ContainerResidency(w,'w',s,{read:async()=>{throw new Error('disk');}});
 await assert.rejects(bad.ensure([[80,80]]),/disk/);assert.equal(bad.ready(1344,1344),false);
});

test('overlapping saves and post-snapshot changes keep the newest container pinned until durable',async()=>{
 const w=world(),s=new Survival({chests:{'1,70,1':chest()}}),disk=new Map();
 const manager=new ContainerResidency(w,'w',s,{read:reader(disk)});
 const first=manager.beginSave(s.serialize());
 s.chests['1,70,1'].items[0].count=6;
 const second=manager.beginSave(s.serialize());
 s.chests['1,70,1'].items[0].count=5;
 await travel(manager,400,64);
 manager.finishSave(first,true);assert.ok(s.chests['1,70,1'],'newer save still in flight');
 manager.finishSave(second,true);assert.ok(s.chests['1,70,1'],'latest mutation was not in either save');
 const failed=manager.beginSave(s.serialize());manager.finishSave(failed,false);
 assert.ok(s.chests['1,70,1'],'failed save retains newest inventory');
 commit(manager,disk);assert.equal(s.chests['1,70,1'],undefined);
 await travel(manager,64,64);assert.equal(s.chests['1,70,1'].items[0].count,5);
 s.chests['1,70,1'].items[1]={id:365,count:1,damage:0,stored:[{id:16,lvl:1}]};
 const bookSave=manager.beginSave(s.serialize());
 s.chests['1,70,1'].items[1].stored[0].lvl=2;
 await travel(manager,400,64);manager.finishSave(bookSave,true);
 assert.ok(s.chests['1,70,1'],'nested book data changed after the save snapshot');
 assert.equal(bookSave.states.get('0,0').chests['1,70,1'].items[1].stored[0].lvl,1);
 commit(manager,disk);await travel(manager,64,64);
 assert.equal(s.chests['1,70,1'].items[1].stored[0].lvl,2);
});

test('empty chests stay empty and broken chests never reappear after eviction',async()=>{
 const w=world(),s=new Survival({chests:{'1,70,1':chest()}}),disk=new Map();
 const manager=new ContainerResidency(w,'w',s,{read:reader(disk)});
 s.chests['1,70,1'].items.fill(null);
 commit(manager,disk);await travel(manager,400,64);
 assert.equal(s.chests['1,70,1'],undefined);
 await travel(manager,64,64);assert.ok(s.chests['1,70,1'].items.every(v=>v===null));
 delete s.chests['1,70,1'];commit(manager,disk);assert.equal(disk.has('0,0'),false,'breaking the chest deletes its durable column');
 await travel(manager,400,64);commit(manager,disk);await travel(manager,64,64);
 assert.equal(s.chests['1,70,1'],undefined);
});

test('eviction also releases the last autosave copy without expanding its ownership scope',async()=>{
 const w=world(),s=new Survival({chests:{'1,70,1':chest(),'9000,70,9000':chest()}}),disk=new Map();
 const manager=new ContainerResidency(w,'w',s,{read:reader(disk)}),record={player:s.serialize()};
 const token=manager.beginSave(record.player);record.containerScope=manager.scope(token);
 assert.ok(s.chests['9000,70,9000'],'legacy distant inventories stay pinned until migration');
 manager.finishSave(token,true);manager.pruneRecord(record);
 assert.equal(s.chests['9000,70,9000'],undefined);assert.equal(record.player.chests['9000,70,9000'],undefined);
 const oldScope=record.containerScope.map(c=>c.join(','));
 await travel(manager,400,64);manager.pruneRecord(record);
 assert.ok(record.containerScope.every(c=>oldScope.includes(c.join(','))));
 assert.equal(record.player.chests['1,70,1'],undefined);
});
