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
const DB = 'blockworld.storage.v1', STORE = 'worlds', CHUNKS = 'chunks';
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
    const request = indexed.open(DB,2);
    let abandoned = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id'});
      if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS,{keyPath:['world','x','z']}).createIndex('world','world');
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
    id:r.id,name:r.name,seed:r.seed,biome:r.biome,mode:r.mode,updated:r.updated,storage:'indexeddb',
  });
  const shelfJSON = JSON.stringify(shelf);
  // Capture now; live simulation continues while the transaction is running.
  // Records still in the single-record form are split into column records.
  const splits = streamed.filter(unsplit).map(r=>[r, r.edits, chunkRecords(r.id, r.edits)]);
  const snapshots = streamed.map(r=>{
    if (!unsplit(r)) return structuredClone(r);
    const { edits, ...rest } = r;
    return { ...structuredClone(rest), chunked:true };
  });
  const columns = chunks.map(c=>structuredClone(c));
  // Serialize the shelf with its database writes as well as the transactions.
  // Otherwise a pending save can republish an older shelf after a deletion.
  return serializeWrite(async()=>{
    if (snapshots.length || database) {
      const db = await openWorldStorage();
      await new Promise((resolve,reject)=>{
        const tx = db.transaction([STORE,CHUNKS],'readwrite'), store = tx.objectStore(STORE), chunkStore = tx.objectStore(CHUNKS);
        for (const r of snapshots) store.put(r);
        // Requests run in order: a column passed in `chunks` replaces its split copy.
        for (const [,,split] of splits) for (const c of split) chunkStore.put(c);
        for (const c of columns) chunkStore.put(c);
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('World save failed'));
      });
      // The shelf now holds the split form; drop the copy unless the record changed meanwhile.
      for (const [r,edits] of splits) if (r.edits === edits) { delete r.edits; r.chunked = true; }
    }
    storage.setItem(key,shelfJSON);
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
      const tx = db.transaction([STORE,CHUNKS],'readwrite'), chunkStore = tx.objectStore(CHUNKS);
      tx.objectStore(STORE).delete(id);
      const keys = chunkStore.index('world').getAllKeys(id);
      keys.onsuccess = () => { for (const k of keys.result) chunkStore.delete(k); };
      tx.oncomplete=resolve; tx.onabort=tx.onerror=()=>reject(tx.error);
    });
  });
}
