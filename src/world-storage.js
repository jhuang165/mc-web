import { splitRuntime, joinRuntime, hasRuntime, separateContainers, validateContainerColumns } from './chunk-runtime.js';
// Streamed records live in IndexedDB rather than the small synchronous
// localStorage quota. The shelf keeps only their identity/summary there. Legacy
// records retain their existing representation. Publish the shelf only after
// the transaction commits, so a failed write never replaces a durable record.
//
// Since 0.31.0 (WORLD-02h) a streamed world's block edits are stored per chunk
// column in CHUNKS, one record per edited column, and the world record keeps the
// rest of the save (player, entities, pending ticks) with `chunked: true`. A save
// writes the world record and only the columns edited since the last save in one
// transaction. Records written before then (or imported) carry an `edits` array;
// their first write moves it into column records.
const DB = 'blockworld.storage.v1', STORE = 'worlds', CHUNKS = 'chunks', RUNTIME = 'runtime', CONTAINERS = 'containers', BASES = 'bases';
// Bounded write fingerprints, never a second copy of every explored inventory.
const runtimeCopies = new Map(), COPY_LIMIT = 256;
const copyKey = (store,c) => JSON.stringify([store,c.world,c.x,c.z]);
function rememberCopies(store,world,columns,scope) {
  const next=new Set(columns.map(c=>copyKey(store,c)));
  for(const [k,v] of runtimeCopies) if(v.world===world&&v.store===store&&!next.has(k)&&(!scope||scope.has(v.column)))runtimeCopies.delete(k);
  for(const c of columns) {
    const k=copyKey(store,c);runtimeCopies.delete(k);
    runtimeCopies.set(k,{store,world,column:`${c.x},${c.z}`,json:JSON.stringify(c)});
  }
  while(runtimeCopies.size>COPY_LIMIT)runtimeCopies.delete(runtimeCopies.keys().next().value);
}
let database, opening;
let writes = Promise.resolve();
const serializeWrite = task => {
  const next = writes.catch(()=>{}).then(task);
  writes = next;
  return next;
};
export async function openWorldStorage(indexed = globalThis.indexedDB) {
  if (database) return database;
  if (opening) return opening;
  if (!indexed) throw new Error('This browser cannot store streamed worlds');
  opening = new Promise((resolve,reject)=>{
    const request = indexed.open(DB,5);
    let abandoned = false;
    request.onupgradeneeded = () => {
      const db = request.result, migrateContainers=db.objectStoreNames.contains(RUNTIME)&&!db.objectStoreNames.contains(CONTAINERS);
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id'});
      if (!db.objectStoreNames.contains(RUNTIME)) db.createObjectStore(RUNTIME,{keyPath:['world','x','z']}).createIndex('world','world');
      if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS,{keyPath:['world','x','z']}).createIndex('world','world');
      if (!db.objectStoreNames.contains(CONTAINERS)) db.createObjectStore(CONTAINERS,{keyPath:['world','x','z']}).createIndex('world','world');
      // v5: stored full columns of imported Java saves (whole-save-columns.js), read by exact key like CHUNKS.
      if (!db.objectStoreNames.contains(BASES)) db.createObjectStore(BASES,{keyPath:['world','x','z']}).createIndex('world','world');
      if(migrateContainers) {
        // The upgrade transaction moves inventories atomically; a failed upgrade
        // leaves the v3 runtime records intact for the next open attempt.
        const inventories=request.transaction.objectStore(CONTAINERS), cursor=request.transaction.objectStore(RUNTIME).openCursor();
        cursor.onsuccess=()=>{
          const row=cursor.result;if(!row)return;
          const {runtime,containers}=separateContainers([row.value]);
          if(containers.length) {
            inventories.put(containers[0]);
            if(runtime.length)row.update(runtime[0]);else row.delete();
          }
          row.continue();
        };
      }
    };
    request.onsuccess = () => abandoned ? request.result.close() : resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => { abandoned = true; reject(new Error('Close other Blockworld tabs to update storage')); };
  });
  try {
    const db = await opening;
    database = db;
    db.onversionchange = () => { db.close(); if (database === db) database = null; };
    return db;
  } finally { opening = null; }
}
export async function readWorldShelf(records) {
  if (!records.some(r=>r?.storage === 'indexeddb')) return records;
  const db = await openWorldStorage();
  return Promise.all(records.map(r=>r?.storage !== 'indexeddb' ? r : new Promise((resolve,reject)=>{
    const request = db.transaction(STORE).objectStore(STORE).get(r.id);
    request.onsuccess = () => request.result ? resolve(request.result) : reject(new Error(`Saved world ${r.name} is unavailable`));
    request.onerror = () => reject(request.error);
  })));
}
// A column's edits: `cells` packs the local cell as x << 12 | z << 8 | y (a
// 16 x 256 x 16 column), `values` holds block | meta << 8 as in World.edits, and
// `order` is each cell's position in the world's first-edit order, so a load
// replays edits in the order they were first made.
const CELL_KEY = /^(-?\d+),(-?\d+),(-?\d+)$/;
export function chunkRecords(world, edits) {
  const columns = new Map();
  let order = 0;
  for (const [key, value] of edits) {
    const m = CELL_KEY.exec(String(key));
    if (!m) throw new Error('Invalid edit');
    const x = Number(m[1]), y = Number(m[2]), z = Number(m[3]), cx = x >> 4, cz = z >> 4, k = `${cx},${cz}`;
    if (y < 0 || y > 255) throw new Error('Invalid edit');
    let c = columns.get(k);
    if (!c) columns.set(k, c = { world, x:cx, z:cz, cells:[], values:[], order:[] });
    c.cells.push(((x & 15) << 12) | ((z & 15) << 8) | y); c.values.push(value); c.order.push(order++);
  }
  return [...columns.values()].map(c=>({ ...c, cells:Uint16Array.from(c.cells), values:Uint16Array.from(c.values), order:Uint32Array.from(c.order) }));
}
// The [key, value] edit list of a world's column records, in first-edit order.
export function editsFromChunks(records) {
  const all = [];
  for (const r of records) {
    const n = r?.cells?.length;
    if (!Number.isInteger(r?.x) || !Number.isInteger(r?.z) || !Number.isInteger(n) || r.values?.length !== n || r.order?.length !== n)
      throw new Error('Saved chunk is damaged');
    for (let i = 0; i < n; i++) {
      const c = r.cells[i];
      all.push([r.order[i], `${r.x * 16 + (c >> 12)},${c & 255},${r.z * 16 + ((c >> 8) & 15)}`, r.values[i]]);
    }
  }
  return all.sort((a,b)=>a[0]-b[0]).map(([,key,value])=>[key,value]);
}
// Records the shelf may still hold in the single-record form.
const unsplit = r => r.biome === 'javaStreamed' && Array.isArray(r.edits);
// `chunks`: column records (world, x, z, cells, values, order) to replace,
// normally World.takeDirtyColumns for the active world.
export async function writeWorldShelf(records, storage, key, chunks = []) {
  const streamed = records.filter(r=>r.biome === 'javaStreamed');
  const shelf = records.map(r=>r.biome !== 'javaStreamed' ? r : {
    id:r.id,name:r.name,seed:r.seed,biome:r.biome,worldType:r.worldType,mode:r.mode,updated:r.updated,storage:'indexeddb',
  });
  const shelfJSON = JSON.stringify(shelf);
  // Capture now; live simulation continues while the transaction is running.
  // Records still in the single-record form are split into column records.
  const splits = streamed.filter(unsplit).map(r=>[r, r.edits, chunkRecords(r.id, r.edits)]);
  const runtimes = streamed.filter(r=>hasRuntime(r)||!r.runtimeChunked).map(r=>[r,{...splitRuntime(r),scope:r.containerScope?new Set(r.containerScope.map(([x,z])=>`${x},${z}`)):null}]);
  const runtimeById = new Map(runtimes.map(([r,s])=>[r.id,s]));
  const snapshots = streamed.map(original=>{
    const r=runtimeById.get(original.id)?.metadata??original;
    if (!unsplit(r)) return structuredClone(r);
    const { edits, ...rest } = r;
    return { ...structuredClone(rest), chunked:true };
  });
  const columns = chunks.map(c=>structuredClone(c));
  // Serialize the shelf with its database writes as well as the transactions.
  // Otherwise a pending save can republish an older shelf after a deletion.
  return serializeWrite(async()=>{
    if (snapshots.length || columns.length || database) {
      const db = await openWorldStorage();
      await new Promise((resolve,reject)=>{
        const tx = db.transaction([STORE,CHUNKS,RUNTIME,CONTAINERS],'readwrite'), store = tx.objectStore(STORE), chunkStore = tx.objectStore(CHUNKS);
        for (const [r,{columns:payloads,scope}] of runtimes) {
          const parts=separateContainers(payloads);
          for(const [name,records] of [[RUNTIME,parts.runtime],[CONTAINERS,parts.containers]]) {
            const target=tx.objectStore(name), next=new Set(records.map(c=>JSON.stringify([c.world,c.x,c.z])));
            for(const c of records)if(runtimeCopies.get(copyKey(name,c))?.json!==JSON.stringify(c))target.put(c);
            if(name===CONTAINERS&&scope) {
              for(const k of scope) {
                const [x,z]=k.split(',').map(Number), tuple=[r.id,x,z];
                if(!next.has(JSON.stringify(tuple)))target.delete(tuple);
              }
            } else {
              const keys=target.index('world').getAllKeys(r.id);
              keys.onsuccess=()=>{for(const k of keys.result)if(!next.has(JSON.stringify(k)))target.delete(k);};
            }
          }
        }
        for (const r of snapshots) store.put(r);
        // Requests run in order: a column passed in `chunks` replaces its split copy.
        for (const [r,edits,split] of splits) if (r.edits === edits) for (const c of split) chunkStore.put(c);
        for (const c of columns) chunkStore.put(c);
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('World save failed'));
      });
      for (const [r,{columns:payloads,scope}] of runtimes) {
        const parts=separateContainers(payloads);
        rememberCopies(RUNTIME,r.id,parts.runtime,null);rememberCopies(CONTAINERS,r.id,parts.containers,scope);
        r.runtimeChunked=true;
      }
      // The shelf now holds the split form; drop the copy unless the record changed meanwhile.
      for (const [r,edits] of splits) if (r.edits === edits) { delete r.edits; r.chunked = true; }
    }
    storage.setItem(key,shelfJSON);
  });
}
// Edit columns an away run produced (away-world.js): complete column records, written in one transaction after the shelf writes before it.
export async function writeChunkColumns(id, columns) {
  if (!columns.length) return;
  return serializeWrite(async () => {
    const db = await openWorldStorage();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([CHUNKS], 'readwrite'), store = tx.objectStore(CHUNKS);
      for (const c of columns) store.put({ world: id, x: c.x, z: c.z, cells: c.cells, values: c.values, order: c.order });
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Away columns could not be saved'));
    });
  });
}
// The stored edits of a chunked world, in first-edit order.
export async function readChunkEdits(id) {
  const db = await openWorldStorage();
  const records = await new Promise((resolve,reject)=>{
    const request = db.transaction(CHUNKS).objectStore(CHUNKS).index('world').getAll(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return editsFromChunks(records);
}
export async function deleteStoredWorld(id) {
  return serializeWrite(async()=>{
    const db = await openWorldStorage();
    await new Promise((resolve,reject)=>{
      const tx = db.transaction([STORE,CHUNKS,RUNTIME,CONTAINERS,BASES],'readwrite'), chunkStore = tx.objectStore(CHUNKS);
      const baseStore=tx.objectStore(BASES), baseKeys=baseStore.index('world').getAllKeys(id);
      baseKeys.onsuccess=()=>{for(const k of baseKeys.result)baseStore.delete(k);};
      const runtimeStore=tx.objectStore(RUNTIME), runtimeKeys=runtimeStore.index('world').getAllKeys(id);
      runtimeKeys.onsuccess=()=>{for(const k of runtimeKeys.result) runtimeStore.delete(k);};
      const containerStore=tx.objectStore(CONTAINERS), containerKeys=containerStore.index('world').getAllKeys(id);
      containerKeys.onsuccess=()=>{for(const k of containerKeys.result)containerStore.delete(k);};
      tx.objectStore(STORE).delete(id);
      const keys = chunkStore.index('world').getAllKeys(id);
      keys.onsuccess = () => { for (const k of keys.result) chunkStore.delete(k); };
      tx.oncomplete=resolve; tx.onabort=tx.onerror=()=>reject(tx.error);
    });
    for(const [k,v] of runtimeCopies)if(v.world===id)runtimeCopies.delete(k);
  });
}

// Exact-key reads only; exploring a column never scans another column's edits.
export async function readChunkColumns(id, columns) {
  const db=await openWorldStorage();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction([CHUNKS,BASES]), out=[];
    for (const [x,z] of columns) {
      const request=tx.objectStore(CHUNKS).get([id,x,z]), record={};
      request.onsuccess=()=>{Object.assign(record,request.result??{world:id,x,z,cells:new Uint16Array(),values:new Uint16Array(),order:new Uint32Array()});};
      out.push(record);
      // A stored full column of an imported save rides along with the edit record (World.restoreColumns decodes it).
      const base=tx.objectStore(BASES).get([id,x,z]);
      base.onsuccess=()=>{if(base.result)record.base=base.result;};
    }
    tx.oncomplete=()=>resolve(out); tx.onabort=tx.onerror=()=>reject(tx.error??new Error('Could not read columns'));
  });
}
// Whole-save import: stored full columns, written in bounded batches while region files stream through the importer.
export async function writeBaseColumns(records) {
  if (!records.length) return;
  return serializeWrite(async()=>{
    const db=await openWorldStorage();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction([BASES],'readwrite'), store=tx.objectStore(BASES);
      for(const r of records)store.put(r);
      tx.oncomplete=resolve; tx.onabort=tx.onerror=()=>reject(tx.error??new Error('Could not store imported columns'));
    });
  });
}
// Exact-key reads of stored full columns (export, tests): [] entries for columns the world does not hold.
export async function readBaseColumns(id, columns) {
  const db=await openWorldStorage();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction([BASES]), out=[];
    for (const [x,z] of columns) {
      const request=tx.objectStore(BASES).get([id,x,z]);
      request.onsuccess=()=>out.push(request.result??null);
    }
    tx.oncomplete=()=>resolve(out); tx.onabort=tx.onerror=()=>reject(tx.error??new Error('Could not read imported columns'));
  });
}
// The coordinates of every stored full column of a world (keys only, nothing decoded).
export async function listBaseColumns(id) {
  const db=await openWorldStorage();
  return new Promise((resolve,reject)=>{
    const request=db.transaction([BASES]).objectStore(BASES).index('world').getAllKeys(id);
    request.onsuccess=()=>resolve(request.result.map(([,x,z])=>[x,z]));
    request.onerror=()=>reject(request.error);
  });
}
// Exact-key inventory reads: empty columns are explicit readiness records.
export async function readContainerColumns(id,columns) {
  const db=await openWorldStorage();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(CONTAINERS),out=[];
    for(const [x,z] of columns) {
      const request=tx.objectStore(CONTAINERS).get([id,x,z]);
      request.onsuccess=()=>out.push(request.result??{world:id,x,z,state:{}});
    }
    tx.oncomplete=()=>{try{validateContainerColumns(out,columns);resolve(out);}catch(e){reject(e);}};
    tx.onabort=tx.onerror=()=>reject(tx.error??new Error('Could not read containers'));
  });
}
const readRuntimeStore=async(name,id)=>{
  const db=await openWorldStorage();
  return new Promise((resolve,reject)=>{
    const request=db.transaction(name).objectStore(name).index('world').getAll(id);
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
};
export async function readRuntimeState(record,{containerColumns}={}) {
  if (!record.runtimeChunked||(hasRuntime(record)&&!record.containerScope)) return record;
  const live=hasRuntime(record)?splitRuntime(record):null;
  const [runtime,inventories]=await Promise.all([
    live?Promise.resolve(separateContainers(live.columns).runtime):readRuntimeStore(RUNTIME,record.id),
    containerColumns?readContainerColumns(record.id,containerColumns):readRuntimeStore(CONTAINERS,record.id),
  ]);
  if(!containerColumns)validateContainerColumns(inventories,inventories.map(c=>[c.x,c.z]));
  let all=inventories;
  if(record.containerScope) {
    const scope=new Set(record.containerScope.map(([x,z])=>`${x},${z}`));
    all=[...inventories.filter(c=>!scope.has(`${c.x},${c.z}`)),...separateContainers(live.columns).containers];
  }
  const joined=joinRuntime(live?.metadata??record,[...runtime,...all]);
  if(containerColumns)joined.containerScope=containerColumns.map(c=>[...c]);
  return joined;
}
