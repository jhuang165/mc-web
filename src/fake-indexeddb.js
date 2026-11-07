// A small in-memory IndexedDB for tests (the one world-storage.test.js uses, empty at the start): object stores with key paths and
// one index, readwrite transactions whose requests run in order and commit after their last request, structured cloning on the way in
// and out. open() runs the real onupgradeneeded callback.
export function fakeIndexedDB() {
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
  return {
    db,
    open() {
      const r = { result: db };
      setTimeout(() => {r.transaction=db.transaction([...stores.keys()],'readwrite');r.transaction.oncomplete=()=>r.onsuccess?.();r.onupgradeneeded?.();});
      return r;
    },
  };
}
