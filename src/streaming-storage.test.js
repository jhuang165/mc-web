import test from 'node:test';import assert from 'node:assert/strict';
import {World} from './world.js';import {StreamStorage} from './streaming-storage.js';import {chunkRecords} from './world-storage.js';
test('saved edits load by window, hold movement until IO and preserve first-edit sequence',async()=>{
 const w=new World('17','javaStreamed',12), calls=[];let finish;
 const records=chunkRecords('w',[['-1,100,-1',20],['10000,100,10000',4],['1,100,1',9]]);
 const loader=new StreamStorage(w,'w',{read:async(id,coords)=>{calls.push(coords);await new Promise(r=>{finish=r;});return coords.map(([x,z])=>records.find(c=>c.x===x&&c.z===z)??{x,z,cells:[],values:[],order:[]});}});
 const waiting=loader.ensure(loader.columns(64,64));assert.equal(loader.ready(64,64),false);finish();await waiting;
 assert.equal(loader.ready(64,64),true);assert.equal(w.get(1,100,1),9);assert.equal(w.edits.has('10000,100,10000'),false);
 assert.equal(calls[0].length,64);assert.deepEqual(w.takeDirtyColumns(),[]);
 const next=loader.ensure(loader.columns(-1,-1));assert.equal(loader.ready(-1,-1),false);finish();await next;w.streamAround(-1,-1);
 assert.equal(w.get(-1,100,-1),20);assert.equal(w.nextEditOrder,3);w.set(-2,100,-2,1);assert.equal(w.nextEditOrder,4);
 assert.equal(w.takeDirtyColumns()[0].order[1],3);
});
test('a rejected read never permits entry; a disposed loader cannot hydrate another world',async()=>{
 const w=new World('17','javaStreamed',12);let errors=0;
 const bad=new StreamStorage(w,'w',{read:async()=>{throw new Error('disk');},onError:()=>errors++});
 await assert.rejects(bad.ensure(bad.columns(64,64)),/disk/);assert.equal(errors,1);assert.equal(bad.ready(64,64),false);
 let finish;const late=new StreamStorage(w,'w',{read:()=>new Promise(r=>{finish=r;})});const promise=late.ensure([[0,0]]);late.dispose();finish(chunkRecords('w',[['1,200,1',20]]));await promise;
 assert.equal(w.edits.size,0);
});
test('damaged column batches are rejected before resident edits or blocks change',()=>{
 const w=new World('17','javaStreamed',12),before=w.get(1,100,1),records=chunkRecords('w',[['1,100,1',20],['32,100,32',9]]);records[1].values[0]=255;
 assert.throws(()=>w.restoreColumns(records),/damaged/);assert.equal(w.edits.size,0);assert.equal(w.get(1,100,1),before);
});

const emptyColumn=(x,z)=>({x,z,cells:[],values:[],order:[]});
const diskReader=disk=>async(id,coords)=>coords.map(([x,z])=>structuredClone(disk.get(`${x},${z}`)??emptyColumn(x,z)));
async function travel(loader,x,z) {
 loader.update(x,z);
 await loader.ensure(loader.columns(x,z,1));
 loader.world.streamAround(x,z);
 loader.trim();
}
test('durable edit caches stay within the window and halo, then reread air, metadata and ordinals',async()=>{
 const w=new World('17','javaStreamed',12),disk=new Map();
 const saved=[['1,0,1',0],['2,200,2',35|(14<<8)],['-17,200,-1',20]];
 for(const c of chunkRecords('w',saved))disk.set(`${c.x},${c.z}`,c);
 let calls=0;
 const read=diskReader(disk),loader=new StreamStorage(w,'w',{read:(...args)=>{calls++;return read(...args);}});
 await travel(loader,64,64);
 assert.equal(w.get(1,0,1),0);assert.equal(w.getMeta(2,200,2),14);
 const origin=w.chunkEdits.get('0,0');
 for(let i=1;i<=10;i++) {
  await travel(loader,64+i*160,64);
  assert.equal(loader.loaded.size,100);
  assert.equal(w.chunkEdits.size,100);
  assert.equal(w.edits.size,0,'distant edits leave both indexes');
 }
 assert.equal(loader.loaded.has('0,0'),false);assert.equal(w.chunkEdits.has('0,0'),false);
 const before=calls;await travel(loader,64,64);assert.ok(calls>before);
 assert.deepEqual(w.chunkEdits.get('0,0'),origin);
 assert.equal(w.get(1,0,1),0);assert.equal(w.get(2,200,2),35);assert.equal(w.getMeta(2,200,2),14);
 await travel(loader,-32,-32);assert.equal(w.get(-17,200,-1),20);
 w.set(-17,200,-1,35,true,5);w.set(-18,200,-1,9);
 const c=w.takeDirtyColumns()[0];assert.deepEqual([...c.order],[2,3]);
});
test('dirty columns and overlapping saves stay pinned; failed saves retain the newest full column',async()=>{
 const w=new World('17','javaStreamed',12),disk=new Map();
 const loader=new StreamStorage(w,'w',{read:diskReader(disk)});
 await travel(loader,64,64);w.set(1,200,1,20);
 await travel(loader,400,64);
 assert.equal(w.edits.get('1,200,1'),20,'unsaved column pinned');
 const first=w.takeDirtyColumns();w.beginColumnSave(first);
 await travel(loader,64,64);w.set(1,200,1,35,true,7);w.set(2,200,2,9);
 const second=w.takeDirtyColumns();w.beginColumnSave(second);
 w.set(3,200,3,4);
 await travel(loader,400,64);
 w.finishColumnSave(first,true);loader.trim();
 assert.equal(w.savingColumns.get('0,0'),1);assert.equal(w.edits.get('1,200,1'),35|(7<<8));
 w.finishColumnSave(second,false);loader.trim();
 assert.equal(w.savingColumns.size,0);assert.ok(w.dirtyColumns.has('0,0'));
 assert.equal(w.chunkEdits.get('0,0').size,3,'failure keeps every edit, including changes after the snapshots');
 const retry=w.takeDirtyColumns();w.beginColumnSave(retry);
 loader.trim();assert.ok(w.chunkEdits.has('0,0'));
 for(const c of retry)disk.set(`${c.x},${c.z}`,structuredClone(c));
 w.finishColumnSave(retry,true);loader.trim();
 assert.equal(w.chunkEdits.has('0,0'),false);assert.equal(w.edits.size,0);
 await travel(loader,64,64);
 assert.equal(w.get(1,200,1),35);assert.equal(w.getMeta(1,200,1),7);assert.equal(w.get(2,200,2),9);
 assert.equal(w.get(3,200,3),4);
});
test('legacy distant edits can evict only after migration, and pending reads cannot overwrite a saving column',async()=>{
 const w=new World('17','javaStreamed',12);
 w.restore([['10000,200,-10000',35|(6<<8)]]);
 const loader=new StreamStorage(w,'w',{read:diskReader(new Map())});
 await travel(loader,64,64);assert.ok(w.chunkEdits.has('625,-625'));
 const batch=w.takeDirtyColumns();w.beginColumnSave(batch);
 loader.trim();assert.ok(w.edits.has('10000,200,-10000'));
 w.restoreColumns([emptyColumn(625,-625)]);
 assert.equal(w.chunkEdits.get('625,-625').size,1,'stale read cannot replace a pending write');
 w.finishColumnSave(batch,true);loader.trim();
 assert.equal(loader.loaded.has('625,-625'),false);assert.equal(w.edits.size,0);
 assert.equal(w.nextEditOrder,1,'eviction never recycles ordinals');
});
