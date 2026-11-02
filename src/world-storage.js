// Streamed records live in IndexedDB rather than the small synchronous
// localStorage quota. The shelf keeps only their identity/summary there. Legacy
// records retain their existing representation. Publish the shelf only after
// the transaction commits, so a failed write never replaces a durable record.
const DB = 'blockworld.storage.v1', STORE = 'worlds';
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
    const request = indexed.open(DB,1);
    let abandoned = false;
    request.onupgradeneeded = () => request.result.createObjectStore(STORE,{keyPath:'id'});
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
export async function writeWorldShelf(records, storage, key) {
  const streamed = records.filter(r=>r.biome === 'javaStreamed');
  const shelf = records.map(r=>r.biome !== 'javaStreamed' ? r : {
    id:r.id,name:r.name,seed:r.seed,biome:r.biome,mode:r.mode,updated:r.updated,storage:'indexeddb',
  });
  const shelfJSON = JSON.stringify(shelf);
  // Capture now; live simulation continues while the transaction is running.
  const snapshots = streamed.map(r=>structuredClone(r));
  // Serialize the shelf with its database writes as well as the transactions.
  // Otherwise a pending save can republish an older shelf after a deletion.
  return serializeWrite(async()=>{
    if (snapshots.length || database) {
      const db = await openWorldStorage();
      await new Promise((resolve,reject)=>{
        const tx = db.transaction(STORE,'readwrite'), store = tx.objectStore(STORE);
        for (const r of snapshots) store.put(r);
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('World save failed'));
      });
    }
    storage.setItem(key,shelfJSON);
  });
}
export async function deleteStoredWorld(id) {
  return serializeWrite(async()=>{
    const db = await openWorldStorage();
    await new Promise((resolve,reject)=>{
      const tx = db.transaction(STORE,'readwrite'); tx.objectStore(STORE).delete(id);
      tx.oncomplete=resolve; tx.onabort=tx.onerror=()=>reject(tx.error);
    });
  });
}
