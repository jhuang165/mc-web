import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { StreamStorage } from './streaming-storage.js';
import { chunkRecords, editsFromChunks, writeWorldShelf, readWorldShelf, readChunkEdits, deleteStoredWorld, readRuntimeState, readContainerColumns } from './world-storage.js';

// A small in-memory IndexedDB: object stores with key paths and one index, readwrite transactions
// whose requests run in order and that commit (or abort) after their last request, and structured
// cloning on the way in and out. `failNext` aborts the next readwrite transaction.
function fakeIndexedDB() {
  const stores = new Map(), names = { contains: (n) => stores.has(n) };
  const keyOf = (store, value) => JSON.stringify(Array.isArray(store.keyPath) ? store.keyPath.map((k) => value[k]) : value[store.keyPath]);
  const db = {
    objectStoreNames: names, failNext: false, writes: [], reads: [],
    createObjectStore(name, { keyPath }) {
      const store = { keyPath, rows: new Map(), indexes: new Map() };
      stores.set(name, store);
      return { createIndex(index, path) { store.indexes.set(index, path); } };
    },
    transaction(list, mode = 'readonly') {
      const queue = [], fail = mode === 'readwrite' && db.failNext, staged = new Map();
      if (fail) db.failNext = false;
      const tx = { oncomplete: null, onabort: null, onerror: null, error: null };
      const rows = (name) => {
        if (!staged.has(name)) staged.set(name, new Map(stores.get(name).rows));
        return staged.get(name);
      };
      const request = (run) => {
        const r = { onsuccess: null, onerror: null, result: undefined };
        queue.push(() => { r.result = run(); r.onsuccess?.(); });
        return r;
      };
      tx.objectStore = (name) => {
        const store = stores.get(name);
        return {
          put: (value) => request(() => { rows(name).set(keyOf(store, value), structuredClone(value)); db.writes.push([name, keyOf(store, value)]); }),
          get: (key) => request(() => {db.reads.push([name,structuredClone(key)]);return structuredClone(rows(name).get(JSON.stringify(key)));}),
          openCursor: () => {
            const r={},keys=[...rows(name).keys()];let i=0;
            const next=()=>queue.push(()=>{
              const k=keys[i++];
              r.result=k===undefined?null:{value:structuredClone(rows(name).get(k)),
                update:value=>request(()=>rows(name).set(k,structuredClone(value))),
                delete:()=>request(()=>rows(name).delete(k)),continue:next};
              r.onsuccess?.();
            });next();return r;
          },
          delete: (key) => request(() => { rows(name).delete(JSON.stringify(key)); }),
          index: (index) => {
            const path = store.indexes.get(index), match = (v) => [...rows(name).entries()].filter(([, row]) => row[path] === v);
            return {
              getAll: (v) => request(() => {db.reads.push([name,'all',v]);return match(v).map(([, row]) => structuredClone(row));}),
              getAllKeys: (v) => request(() => match(v).map(([k]) => JSON.parse(k))),
            };
          },
        };
      };
      setTimeout(() => {
        for (let i = 0; i < queue.length; i++) queue[i]();
        if (fail) { tx.error = new Error('quota'); tx.onabort?.(); return; }
        for (const [name, m] of staged) stores.get(name).rows = m;
        tx.oncomplete?.();
      });
      return tx;
    },
    count: (name, pred = () => true) => [...stores.get(name).rows.values()].filter(pred).length,
  };
  // Start from an existing v3 database so the real upgrade callback is tested.
  db.createObjectStore('worlds',{keyPath:'id'});
  for(const name of ['chunks','runtime'])db.createObjectStore(name,{keyPath:['world','x','z']}).createIndex('world','world');
  const migrated={world:'v3',x:-1,z:-2,state:{entities:[{order:0,value:{type:'pig',x:-1,y:70,z:-17}}],chests:{'-1,70,-17':{facing:5,items:[{id:322,count:7,damage:0}]}}}};
  stores.get('runtime').rows.set(JSON.stringify(['v3',-1,-2]),migrated);
  stores.get('runtime').rows.set(JSON.stringify(['v3',2,0]),{world:'v3',x:2,z:0,state:{furnaces:{'32,70,0':{items:[],burn:23,cook:4}}}});
  return {
    db,
    open() {
      const r = { result: db };
      setTimeout(() => {r.transaction=db.transaction([...stores.keys()],'readwrite');r.transaction.oncomplete=()=>r.onsuccess?.();r.onupgradeneeded?.();});
      return r;
    },
  };
}
const idb = fakeIndexedDB();
globalThis.indexedDB = idb;
const shelf = () => { const m = new Map(); return { setItem: (k, v) => m.set(k, v), getItem: (k) => m.get(k) ?? null }; };
const streamed = () => { const w = new World('17', 'javaStreamed', 12); w.blockLight = () => 0; return w; };

test('column records keep every edit and the first-edit order, negative coordinates included', () => {
  const edits = [['5,70,5', 1], ['-1,0,-17', 4 | (3 << 8)], ['20,255,-300', 20], ['5,71,5', 9], ['-16,64,15', 0]];
  const records = chunkRecords('w', edits);
  assert.deepEqual(records.map((r) => [r.x, r.z]).sort(), [[0, 0], [-1, -2], [1, -19], [-1, 0]].sort());
  assert.ok(records.every((r) => r.world === 'w' && r.cells instanceof Uint16Array && r.order instanceof Uint32Array));
  assert.deepEqual(editsFromChunks(records.reverse()), edits);
  assert.throws(() => chunkRecords('w', [['1,256,1', 1]]), /Invalid edit/);
  assert.throws(() => editsFromChunks([{ x: 0, z: 0, cells: [1], values: [], order: [0] }]), /damaged/);
});

test('a streamed world reports the columns edited since the last save, each in full', () => {
  const w = streamed();
  w.set(10, 100, 10, 1); w.set(11, 101, 12, 20, true, 0); w.set(40, 90, 40, 4);
  w.restore([['500,80,-500', 5]]); // an unloaded column
  let taken = w.takeDirtyColumns();
  assert.deepEqual(taken.map((c) => `${c.x},${c.z}`).sort(), ['0,0', '2,2', '31,-32']);
  const all = editsFromChunks(taken);
  assert.deepEqual(all, [...w.edits]);
  assert.deepEqual(w.takeDirtyColumns(), [], 'nothing is dirty after a take');
  // Re-editing a cell keeps its first-edit position; a new cell goes last.
  w.set(40, 90, 40, 1); w.set(12, 100, 10, 3);
  taken = w.takeDirtyColumns();
  assert.deepEqual(taken.map((c) => `${c.x},${c.z}`).sort(), ['0,0', '2,2']);
  assert.equal(taken.find((c) => c.x === 0).cells.length, 3, 'the whole column, not just the new cell');
  const merged = new Map([...all.map(([k]) => k)].map((k) => [k, 0]));
  for (const c of [...taken]) for (const [k, v] of editsFromChunks([c])) merged.set(k, v);
  assert.deepEqual([...merged.keys()], [...w.edits.keys()]);
  // Columns from a failed write come back.
  w.markColumnsDirty(taken);
  assert.equal(w.takeDirtyColumns().length, 2);
  // Loaded columns read stored values, metadata included, after travelling away and back.
  w.set(20, 120, 20, 35, true, 14);
  w.streamAround(64 + 16 * 40, 64); w.streamAround(64, 64);
  assert.equal(w.get(20, 120, 20), 35); assert.equal(w.getMeta(20, 120, 20), 14);
  assert.equal(w.get(500, 80, -500), 0, 'still unloaded');
});

test('streamed saves write only edited columns, convert single-record saves and reload in order', async () => {
  const storage = shelf(), finite = { id: 'f', name: 'Finite', biome: 'meadow', edits: [['1,2,3', 1]] };
  const legacy = { id: 'a', name: 'Old', seed: '17', biome: 'javaStreamed', generationVersion: 12, edits: [['3,70,3', 1], ['-20,70,3', 4], ['3,71,3', 20]] };
  const legacyEdits = legacy.edits;
  await writeWorldShelf([legacy, finite], storage, 'k');
  assert.equal(legacy.edits, undefined, 'the live record drops its copy');
  assert.equal(legacy.chunked, true);
  assert.equal(idb.db.count('chunks', (r) => r.world === 'a'), 2);
  const [stored] = await readWorldShelf([{ id: 'a', name: 'Old', biome: 'javaStreamed', storage: 'indexeddb' }]);
  assert.equal(stored.edits, undefined); assert.equal(stored.chunked, true);
  assert.deepEqual(await readChunkEdits('a'), legacyEdits);
  const saved = JSON.parse(storage.getItem('k'));
  assert.deepEqual(saved[1], finite, 'finite worlds stay on the localStorage shelf');
  assert.equal(saved[0].storage, 'indexeddb'); assert.equal(saved[0].edits, undefined, 'the shelf entry is only a summary');

  // Play: restore, edit one column, save just that column.
  const w = streamed();
  w.restore(await readChunkEdits('a')); w.dirtyColumns.clear();
  w.set(4, 70, 4, 9);
  idb.db.writes.length = 0;
  await writeWorldShelf([legacy], storage, 'k', w.takeDirtyColumns().map((c) => ({ world: 'a', ...c })));
  assert.deepEqual(idb.db.writes.filter(([s]) => s === 'chunks').map(([, k]) => k), ['["a",0,0]']);
  assert.deepEqual(await readChunkEdits('a'), [...w.edits]);

  // A failed transaction changes nothing, and the record keeps its single-record copy for the retry.
  const other = { id: 'b', biome: 'javaStreamed', edits: [['1,1,1', 1]] }, otherEdits = other.edits;
  idb.db.failNext = true;
  await assert.rejects(writeWorldShelf([legacy, other], storage, 'k'));
  assert.equal(other.edits, otherEdits);
  assert.equal(idb.db.count('chunks', (r) => r.world === 'b'), 0);
  await writeWorldShelf([legacy, other], storage, 'k');
  assert.deepEqual(await readChunkEdits('b'), otherEdits);

  // A world launched from the single-record form writes every column on its first save, and the
  // fresh columns win over the split of the stale copy in the same transaction.
  const c = { id: 'c', biome: 'javaStreamed', edits: [['3,70,3', 1], ['40,70,40', 4]] }, cw = streamed();
  cw.restore(c.edits); cw.set(3, 70, 3, 20);
  await writeWorldShelf([c], storage, 'k', cw.takeDirtyColumns().map((col) => ({ world: 'c', ...col })));
  assert.deepEqual(await readChunkEdits('c'), [['3,70,3', 20], ['40,70,40', 4]]);

  await deleteStoredWorld('a');
  assert.equal(idb.db.count('chunks', (r) => r.world === 'a'), 0);
  assert.equal(idb.db.count('worlds', (r) => r.id === 'a'), 0);
  assert.equal(idb.db.count('chunks', (r) => r.world === 'b'), 1, 'other worlds keep theirs');
});

test('v3 runtime migration is atomic, changed columns only write, emptied/moved payloads are removed', async()=>{
  const {readRuntimeState,readChunkColumns}=await import('./world-storage.js');
  const record={id:'runtime',biome:'javaStreamed',edits:[['1,70,1',20],['9000,70,9000',9]],player:{health:19,chests:{'1,70,1':{items:[]}},furnaces:{}},entities:[{x:1,y:70,z:1,type:'pig'}],fluidTicks:{version:1,time:80,entries:[{x:1,y:71,z:1,block:10,delay:2}]}}, storage=shelf();
  idb.db.failNext=true;await assert.rejects(writeWorldShelf([record],storage,'runtime'));
  assert.equal(record.runtimeChunked,undefined);assert.equal(idb.db.count('runtime',c=>c.world==='runtime'),0);
  await writeWorldShelf([record],storage,'runtime');
  const [stored]=await readWorldShelf([{id:record.id,storage:'indexeddb'}]);
  assert.equal(stored.entities,undefined);assert.equal(stored.player.chests,undefined);assert.equal(stored.fluidTicks,undefined);
  const loaded=await readRuntimeState(stored);assert.deepEqual(loaded.entities,record.entities);assert.deepEqual(loaded.fluidTicks,record.fluidTicks);
  assert.deepEqual(editsFromChunks(await readChunkColumns(record.id,[[0,0]])),[['1,70,1',20]],'unrequested distant edits are not read');
  idb.db.writes.length=0;await writeWorldShelf([loaded],storage,'runtime');
  assert.equal(idb.db.writes.filter(([s])=>s==='runtime').length,0,'unchanged payloads do not write');
  loaded.entities[0].x=-20;loaded.player.chests={};loaded.fluidTicks.entries=[];
  await writeWorldShelf([loaded],storage,'runtime');
  assert.equal(idb.db.count('runtime',c=>c.world===record.id),1,'empty former column removed');
  const [moved]=await readWorldShelf([{id:record.id,storage:'indexeddb'}]);
  const restored=await readRuntimeState(moved);assert.equal(restored.entities[0].x,-20);assert.deepEqual(restored.player.chests,{});assert.deepEqual(restored.fluidTicks.entries,[]);
  await deleteStoredWorld(record.id);assert.equal(idb.db.count('runtime',c=>c.world===record.id),0);
});

test('overlapping first saves cannot replay a stale split over a successful fresh column',async()=>{
 const record={id:'overlap',biome:'javaStreamed',edits:[['1,70,1',1],['32,70,32',4]]}, storage=shelf();
 const first=writeWorldShelf([record],storage,'overlap',chunkRecords(record.id,[['1,70,1',20],['32,70,32',9]]));
 const second=writeWorldShelf([record],storage,'overlap',chunkRecords(record.id,[['1,70,1',3]]));
 await Promise.all([first,second]);assert.deepEqual(await readChunkEdits(record.id),[['1,70,1',3],['32,70,32',9]]);
});

test('column eviction waits for durable saves, retries an aborted migration and reloads exact edits',async()=>{
 const w=streamed(), storage=shelf(), record={id:'eviction',biome:'javaStreamed',edits:[['1,0,1',0],['2,200,2',35|(14<<8)],['-1000,200,-1000',20]]};
 w.restore(record.edits);
 const loader=new StreamStorage(w,record.id);
 const save=async()=>{
  const columns=w.takeDirtyColumns().map(c=>({world:record.id,...c}));
  w.beginColumnSave(columns);
  try {await writeWorldShelf([record],storage,'eviction',columns);w.finishColumnSave(columns,true);}
  catch(e){w.finishColumnSave(columns,false);throw e;}
  finally{loader.trim();}
 };
 const travel=async(x,z)=>{loader.update(x,z);await loader.ensure(loader.columns(x,z,1));w.streamAround(x,z);loader.trim();};
 idb.db.failNext=true;await assert.rejects(save(),/quota/);
 assert.ok(w.dirtyColumns.has('-63,-63'));assert.ok(w.edits.has('-1000,200,-1000'));
 await save();assert.equal(record.chunked,true);assert.equal(w.chunkEdits.has('-63,-63'),false);
 assert.deepEqual(await readChunkEdits(record.id),[['1,0,1',0],['2,200,2',35|(14<<8)],['-1000,200,-1000',20]]);
 await travel(400,64);assert.equal(w.edits.size,0);
 await travel(64,64);assert.equal(w.get(1,0,1),0);assert.equal(w.getMeta(2,200,2),14);
 w.set(2,200,2,35,true,5);w.set(3,200,3,9);
 const saving=save();await travel(400,64);await saving;
 assert.equal(w.edits.size,0);
 await travel(64,64);assert.equal(w.getMeta(2,200,2),5);assert.equal(w.get(3,200,3),9);
 assert.deepEqual((await readChunkEdits(record.id)).map(([k])=>k),['1,0,1','2,200,2','-1000,200,-1000','3,200,3']);
 await deleteStoredWorld(record.id);
});


test('v3 upgrade separates mixed and container-only columns without losing other runtime fields',async()=>{
 const r=await readRuntimeState({id:'v3',runtimeChunked:true});
 assert.equal(r.player.chests['-1,70,-17'].items[0].count,7);
 assert.equal(r.player.furnaces['32,70,0'].burn,23);assert.equal(r.entities[0].type,'pig');
 assert.equal(idb.db.count('containers',c=>c.world==='v3'),2);
 assert.equal(idb.db.count('runtime',c=>c.world==='v3'),1,'container-only runtime row removed');
});

test('windowed container saves preserve unseen columns, delete observed empties, and export failed-save overlays',async()=>{
 const record={id:'scoped',biome:'javaStreamed',edits:[],player:{health:19,chests:{'1,70,1':{facing:5,items:[{id:322,count:7,damage:0}]},'-1000,70,-1000':{facing:3,items:[]}},furnaces:{'9000,70,9000':{items:[],burn:23,cook:4}}},entities:[{x:1,y:70,z:1,type:'pig'}]},storage=shelf();
 await writeWorldShelf([record],storage,'scoped');
 const [stored]=await readWorldShelf([{id:record.id,storage:'indexeddb'}]);
 idb.db.reads.length=0;
 const loaded=await readRuntimeState(stored,{containerColumns:[[0,0],[1,0]]});
 assert.deepEqual(Object.keys(loaded.player.chests),['1,70,1']);assert.deepEqual(loaded.player.furnaces,{});
 assert.deepEqual(idb.db.reads.filter(([name])=>name==='containers'),[['containers',['scoped',0,0]],['containers',['scoped',1,0]]],'cold open never scans distant inventories');
 assert.equal(loaded.entities[0].type,'pig');assert.equal(stored.containerScope,undefined);
 loaded.player.chests['1,70,1'].items[0].count=2;
 await writeWorldShelf([loaded],storage,'scoped');
 assert.equal(idb.db.count('containers',c=>c.world==='scoped'),3);
 let exported=await readRuntimeState(loaded);
 assert.equal(exported.player.chests['1,70,1'].items[0].count,2);
 assert.ok(exported.player.chests['-1000,70,-1000']);assert.equal(exported.player.furnaces['9000,70,9000'].burn,23);
 assert.equal(exported.containerScope,undefined,'scope never leaks into a backup');
 loaded.player.chests={};
 idb.db.failNext=true;await assert.rejects(writeWorldShelf([loaded],storage,'scoped'),/quota/);
 exported=await readRuntimeState(loaded);assert.equal(exported.player.chests['1,70,1'],undefined,'unsaved break wins over durable inventory in export');
 assert.ok(exported.player.chests['-1000,70,-1000']);
 assert.equal((await readContainerColumns(record.id,[[0,0]]))[0].state.chests['1,70,1'].items[0].count,2,'aborted write leaves durable data alone');
 await writeWorldShelf([loaded],storage,'scoped');
 assert.equal((await readContainerColumns(record.id,[[0,0]]))[0].state.chests,undefined);
 assert.equal(idb.db.count('containers',c=>c.world==='scoped'),2,'unseen columns remain after deleting an observed chest');
 await deleteStoredWorld(record.id);assert.equal(idb.db.count('containers',c=>c.world==='scoped'),0);
});

test('overlapping scoped saves snapshot their scopes and do not delete each other’s distant containers',async()=>{
 const record={id:'container-overlap',biome:'javaStreamed',edits:[],player:{chests:{'1,70,1':{items:[]},'320,70,1':{items:[]}}}},storage=shelf();
 await writeWorldShelf([record],storage,'container-overlap');
 const [stored]=await readWorldShelf([{id:record.id,storage:'indexeddb'}]);
 const a=await readRuntimeState(stored,{containerColumns:[[0,0]]}), b=await readRuntimeState(stored,{containerColumns:[[20,0]]});
 a.player.chests={};b.player.chests['320,70,1'].facing=5;
 const first=writeWorldShelf([a],storage,'container-overlap');
 const second=writeWorldShelf([b],storage,'container-overlap');
 b.containerScope.push([0,0]); // Captured scope must not expand with later mutations.
 await Promise.all([first,second]);
 const all=await readRuntimeState(stored);assert.equal(all.player.chests['1,70,1'],undefined);assert.equal(all.player.chests['320,70,1'].facing,5);
 await deleteStoredWorld(record.id);
});

test('bounded fingerprints may rewrite unchanged columns and never skip a recreated world’s inventories',async()=>{
 const record={id:'fingerprints',biome:'javaStreamed',edits:[],player:{chests:Object.fromEntries(Array.from({length:300},(_,i)=>[`${i*16},70,0`,{facing:3,items:[]}]))}},storage=shelf();
 await writeWorldShelf([record],storage,'fingerprints');
 idb.db.writes.length=0;await writeWorldShelf([record],storage,'fingerprints');
 assert.equal(idb.db.writes.filter(([name])=>name==='containers').length,44,'only 256 column fingerprints are retained');
 assert.equal(idb.db.count('containers',c=>c.world===record.id),300,'cache eviction never deletes durable inventories');
 await deleteStoredWorld(record.id);
 await writeWorldShelf([record],storage,'fingerprints');
 assert.equal(idb.db.count('containers',c=>c.world===record.id),300,'deleting a world invalidates its write fingerprints');
 await deleteStoredWorld(record.id);
});

test('damaged container ownership fails cold-window and complete-backup reads before hydration',async()=>{
 await new Promise((resolve,reject)=>{
  const tx=idb.db.transaction('containers','readwrite');
  tx.objectStore('containers').put({world:'damaged-inventory',x:0,z:0,state:{chests:{'320,70,0':{items:[]}}}});
  tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
 });
 const record={id:'damaged-inventory',runtimeChunked:true};
 await assert.rejects(readRuntimeState(record,{containerColumns:[[0,0]]}),/damaged/);
 await assert.rejects(readRuntimeState(record),/damaged/);
 assert.equal(record.player,undefined);
 await deleteStoredWorld(record.id);
});
