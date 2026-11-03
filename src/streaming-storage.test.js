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
