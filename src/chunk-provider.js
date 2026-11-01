// The 1.7.10 server chunk lifecycle: ChunkProviderServer (load, provide, populate, the unload queue,
// save cadence) and WorldServer's chunk steps (tick order, saveAllChunks, spawn preparation).
// PlayerManager is in player-chunks.js. Replayed against the unchanged classes in
// public/research/chunk-provider-reference.json (tools/probes/ChunkProviderProbe.java).
//
// `world` is the server world state the provider reads: totalTime, spawnX, spawnZ, canRespawnHere,
// hasNoSky, levelSaving, findingSpawnPoint, and optional chunkLoaded/chunkUnloaded hooks.
// `loader` (IChunkLoader): load(x, z) -> Chunk | null, save(chunk), saveExtra(chunk), tick(), flush().
// `generator` (the generating IChunkProvider): provideChunk(x, z) -> Chunk, populate(provider, x, z),
// recreateStructures(x, z).
import { ChunkStore, EmptyChunk, chunkKey } from "./chunk-store.js";

// ---------------------------------------------------------------------------------------------
// The unload queue is Collections.newSetFromMap(new ConcurrentHashMap<Long, Boolean>()) of
// ChunkCoordIntPair.chunkXZ2Int keys, and unloadQueuedChunks drains it in iteration order. This is
// that order: Java 8+ ConcurrentHashMap bins (16 to start, doubled at 3/4 load), tail appends,
// resize splits (the last run kept, nodes before it reversed), and red-black TreeBins for bins of
// more than 8 when the table has 64 or more bins (fewer bins presize instead). A TreeBin iterates its
// insertion-prepended list; its tree shape decides when a removal turns it back into a list.
// Long.hashCode of a chunk key is x ^ z; keys compare as signed longs (z, then x unsigned).
const TREEIFY_THRESHOLD = 8, UNTREEIFY_THRESHOLD = 6, MIN_TREEIFY_CAPACITY = 64, MAXIMUM_CAPACITY = 1 << 30;
const spread = (h) => (h ^ (h >>> 16)) & 0x7fffffff;
const compareKeys = (a, b) => (a.z !== b.z ? (a.z < b.z ? -1 : 1) : a.x === b.x ? 0 : (a.x >>> 0) < (b.x >>> 0) ? -1 : 1);
const tableSizeFor = (c) => {
  const n = c - 1 <= 0 ? 0 : -1 >>> Math.clz32(c - 1);
  return n < 0 ? 1 : n >= MAXIMUM_CAPACITY ? MAXIMUM_CAPACITY : n + 1;
};
const node = (hash, x, z, next = null) => ({ hash, x, z, next });
const treeNode = (hash, x, z, next = null, parent = null) => ({ hash, x, z, next, prev: null, parent, left: null, right: null, red: false });

function rotateLeft(root, p) {
  let r, pp, rl;
  if (p && (r = p.right)) {
    if ((rl = p.right = r.left)) rl.parent = p;
    if (!(pp = r.parent = p.parent)) (root = r).red = false;
    else if (pp.left === p) pp.left = r;
    else pp.right = r;
    r.left = p;
    p.parent = r;
  }
  return root;
}
function rotateRight(root, p) {
  let l, pp, lr;
  if (p && (l = p.left)) {
    if ((lr = p.left = l.right)) lr.parent = p;
    if (!(pp = l.parent = p.parent)) (root = l).red = false;
    else if (pp.right === p) pp.right = l;
    else pp.left = l;
    l.right = p;
    p.parent = l;
  }
  return root;
}
function balanceInsertion(root, x) {
  x.red = true;
  for (let xp, xpp, xppl, xppr; ;) {
    if (!(xp = x.parent)) {
      x.red = false;
      return x;
    } else if (!xp.red || !(xpp = xp.parent)) return root;
    if (xp === (xppl = xpp.left)) {
      if ((xppr = xpp.right) && xppr.red) {
        xppr.red = false;
        xp.red = false;
        xpp.red = true;
        x = xpp;
      } else {
        if (x === xp.right) {
          root = rotateLeft(root, (x = xp));
          xpp = !(xp = x.parent) ? null : xp.parent;
        }
        if (xp) {
          xp.red = false;
          if (xpp) {
            xpp.red = true;
            root = rotateRight(root, xpp);
          }
        }
      }
    } else if (xppl && xppl.red) {
      xppl.red = false;
      xp.red = false;
      xpp.red = true;
      x = xpp;
    } else {
      if (x === xp.left) {
        root = rotateRight(root, (x = xp));
        xpp = !(xp = x.parent) ? null : xp.parent;
      }
      if (xp) {
        xp.red = false;
        if (xpp) {
          xpp.red = true;
          root = rotateLeft(root, xpp);
        }
      }
    }
  }
}
function balanceDeletion(root, x) {
  for (let xp, xpl, xpr; ;) {
    if (!x || x === root) return root;
    else if (!(xp = x.parent)) {
      x.red = false;
      return x;
    } else if (x.red) {
      x.red = false;
      return root;
    } else if ((xpl = xp.left) === x) {
      if ((xpr = xp.right) && xpr.red) {
        xpr.red = false;
        xp.red = true;
        root = rotateLeft(root, xp);
        xpr = !(xp = x.parent) ? null : xp.right;
      }
      if (!xpr) x = xp;
      else {
        let sl = xpr.left, sr = xpr.right;
        if ((!sr || !sr.red) && (!sl || !sl.red)) {
          xpr.red = true;
          x = xp;
        } else {
          if (!sr || !sr.red) {
            if (sl) sl.red = false;
            xpr.red = true;
            root = rotateRight(root, xpr);
            xpr = !(xp = x.parent) ? null : xp.right;
          }
          if (xpr) {
            xpr.red = !xp ? false : xp.red;
            if ((sr = xpr.right)) sr.red = false;
          }
          if (xp) {
            xp.red = false;
            root = rotateLeft(root, xp);
          }
          x = root;
        }
      }
    } else {
      if (xpl && xpl.red) {
        xpl.red = false;
        xp.red = true;
        root = rotateRight(root, xp);
        xpl = !(xp = x.parent) ? null : xp.left;
      }
      if (!xpl) x = xp;
      else {
        let sl = xpl.left, sr = xpl.right;
        if ((!sl || !sl.red) && (!sr || !sr.red)) {
          xpl.red = true;
          x = xp;
        } else {
          if (!sl || !sl.red) {
            if (sr) sr.red = false;
            xpl.red = true;
            root = rotateLeft(root, xpl);
            xpl = !(xp = x.parent) ? null : xp.left;
          }
          if (xpl) {
            xpl.red = !xp ? false : xp.red;
            if ((sl = xpl.left)) sl.red = false;
          }
          if (xp) {
            xp.red = false;
            root = rotateRight(root, xp);
          }
          x = root;
        }
      }
    }
  }
}

// TreeBin(first): the tree is built in list order; the list keeps its order.
function treeBin(first) {
  let r = null;
  for (let x = first, next; x; x = next) {
    next = x.next;
    x.left = x.right = null;
    if (!r) {
      x.parent = null;
      x.red = false;
      r = x;
      continue;
    }
    for (let p = r; ;) {
      const dir = p.hash > x.hash ? -1 : p.hash < x.hash ? 1 : compareKeys(x, p);
      const xp = p;
      if (!(p = dir <= 0 ? p.left : p.right)) {
        x.parent = xp;
        if (dir <= 0) xp.left = x;
        else xp.right = x;
        r = balanceInsertion(r, x);
        break;
      }
    }
  }
  return { tree: true, first, root: r };
}
// TreeBin.putTreeVal for a key known to be absent: the new node is prepended to the list.
function putTreeVal(t, h, x, z) {
  for (let p = t.root; ;) {
    if (!p) {
      t.first = t.root = treeNode(h, x, z);
      return;
    }
    const dir = p.hash > h ? -1 : p.hash < h ? 1 : compareKeys({ x, z }, p);
    const xp = p;
    if (!(p = dir <= 0 ? p.left : p.right)) {
      const f = t.first, n = (t.first = treeNode(h, x, z, f, xp));
      if (f) f.prev = n;
      if (dir <= 0) xp.left = n;
      else xp.right = n;
      if (!xp.red) n.red = true;
      else t.root = balanceInsertion(t.root, n);
      return;
    }
  }
}
// TreeBin.removeTreeNode: true when the bin is too small and should become a list again.
function removeTreeNode(t, p) {
  const next = p.next, pred = p.prev;
  if (!pred) t.first = next;
  else pred.next = next;
  if (next) next.prev = pred;
  if (!t.first) {
    t.root = null;
    return true;
  }
  let r = t.root, rl;
  if (!r || !r.right || !(rl = r.left) || !rl.left) return true;
  let replacement;
  const pl = p.left, pr = p.right;
  if (pl && pr) {
    let s = pr, sl;
    while ((sl = s.left)) s = sl;
    const c = s.red;
    s.red = p.red;
    p.red = c;
    const sr = s.right, pp = p.parent;
    if (s === pr) {
      p.parent = s;
      s.right = p;
    } else {
      const sp = s.parent;
      if ((p.parent = sp)) {
        if (s === sp.left) sp.left = p;
        else sp.right = p;
      }
      if ((s.right = pr)) pr.parent = s;
    }
    p.left = null;
    if ((p.right = sr)) sr.parent = p;
    if ((s.left = pl)) pl.parent = s;
    if (!(s.parent = pp)) r = s;
    else if (p === pp.left) pp.left = s;
    else pp.right = s;
    replacement = sr || p;
  } else replacement = pl || pr || p;
  if (replacement !== p) {
    const pp = (replacement.parent = p.parent);
    if (!pp) r = replacement;
    else if (p === pp.left) pp.left = replacement;
    else pp.right = replacement;
    p.left = p.right = p.parent = null;
  }
  t.root = p.red ? r : balanceDeletion(r, replacement);
  if (p === replacement) {
    const pp = p.parent;
    if (pp) {
      if (p === pp.left) pp.left = null;
      else if (p === pp.right) pp.right = null;
      p.parent = null;
    }
  }
  return false;
}
function untreeify(b) {
  let hd = null, tl = null;
  for (let q = b; q; q = q.next) {
    const p = node(q.hash, q.x, q.z);
    if (!tl) hd = p;
    else tl.next = p;
    tl = p;
  }
  return hd;
}
const binFirst = (f) => (f && f.tree ? f.first : f);

export class ChunkKeySet {
  constructor() {
    this.table = null;
    this.sizeCtl = 0;
    this.size = 0;
    this.keys = new Set(); // membership only; order comes from the table
  }
  has(x, z) { return this.keys.has(chunkKey(x, z)); }
  // Set.add -> ConcurrentHashMap.put: a key already present still counts its bin position, so a
  // long bin can treeify (or presize the table) on a repeated add.
  add(x, z) {
    const hash = spread(x ^ z), key = chunkKey(x, z), found = this.keys.has(key);
    if (!this.table) this.initTable();
    const tab = this.table, i = (tab.length - 1) & hash, f = tab[i];
    if (!f) {
      tab[i] = node(hash, x, z);
      this.keys.add(key);
      this.addCount(1, 0);
      return true;
    }
    let binCount;
    if (!f.tree) {
      binCount = 1;
      for (let e = f; ; ++binCount) {
        if (e.x === x && e.z === z) break;
        if (!e.next) {
          e.next = node(hash, x, z);
          break;
        }
        e = e.next;
      }
    } else {
      binCount = 2;
      if (!found) putTreeVal(f, hash, x, z);
    }
    if (binCount >= TREEIFY_THRESHOLD) this.treeifyBin(tab, i);
    if (found) return false;
    this.keys.add(key);
    this.addCount(1, binCount);
    return true;
  }
  delete(x, z) {
    const key = chunkKey(x, z);
    if (!this.keys.has(key)) return false;
    const tab = this.table, i = (tab.length - 1) & spread(x ^ z), f = tab[i];
    if (!f.tree) {
      for (let e = f, pred = null; e; pred = e, e = e.next)
        if (e.x === x && e.z === z) {
          if (pred) pred.next = e.next;
          else tab[i] = e.next;
          break;
        }
    } else {
      let p = f.first;
      while (p.x !== x || p.z !== z) p = p.next;
      if (removeTreeNode(f, p)) tab[i] = untreeify(f.first);
    }
    this.keys.delete(key);
    this.size--;
    return true;
  }
  // iterator().next()
  first() {
    if (!this.table) return null;
    for (const f of this.table) {
      const e = binFirst(f);
      if (e) return [e.x, e.z];
    }
    return null;
  }
  *[Symbol.iterator]() {
    if (!this.table) return;
    for (const f of this.table) for (let e = binFirst(f); e; e = e.next) yield [e.x, e.z];
  }
  initTable() {
    this.table = new Array(16).fill(null);
    this.sizeCtl = 12;
  }
  addCount(x, check) {
    this.size += x;
    if (check >= 0) while (this.size >= this.sizeCtl && this.table.length < MAXIMUM_CAPACITY) this.transfer();
  }
  tryPresize(size) {
    const c = size >= MAXIMUM_CAPACITY >>> 1 ? MAXIMUM_CAPACITY : tableSizeFor(size + (size >>> 1) + 1);
    while (!(c <= this.sizeCtl || this.table.length >= MAXIMUM_CAPACITY)) this.transfer();
  }
  treeifyBin(tab, index) {
    const n = tab.length, b = tab[index];
    if (n < MIN_TREEIFY_CAPACITY) this.tryPresize(n << 1);
    else if (b && !b.tree) {
      let hd = null, tl = null;
      for (let e = b; e; e = e.next) {
        const p = treeNode(e.hash, e.x, e.z);
        if (!(p.prev = tl)) hd = p;
        else tl.next = p;
        tl = p;
      }
      tab[index] = treeBin(hd);
    }
  }
  transfer() {
    const tab = this.table, n = tab.length, next = new Array(n << 1).fill(null);
    for (let i = n - 1; i >= 0; i--) {
      const f = tab[i];
      if (!f) continue;
      let ln, hn;
      if (!f.tree) {
        let runBit = f.hash & n, lastRun = f;
        for (let p = f.next; p; p = p.next) {
          const b = p.hash & n;
          if (b !== runBit) {
            runBit = b;
            lastRun = p;
          }
        }
        if (runBit === 0) (ln = lastRun), (hn = null);
        else (hn = lastRun), (ln = null);
        for (let p = f; p !== lastRun; p = p.next) {
          if ((p.hash & n) === 0) ln = node(p.hash, p.x, p.z, ln);
          else hn = node(p.hash, p.x, p.z, hn);
        }
      } else {
        let lo = null, loTail = null, hi = null, hiTail = null, lc = 0, hc = 0;
        for (let e = f.first; e; e = e.next) {
          const p = treeNode(e.hash, e.x, e.z);
          if ((e.hash & n) === 0) {
            if (!(p.prev = loTail)) lo = p;
            else loTail.next = p;
            loTail = p;
            ++lc;
          } else {
            if (!(p.prev = hiTail)) hi = p;
            else hiTail.next = p;
            hiTail = p;
            ++hc;
          }
        }
        ln = lc <= UNTREEIFY_THRESHOLD ? untreeify(lo) : hc !== 0 ? treeBin(lo) : f;
        hn = hc <= UNTREEIFY_THRESHOLD ? untreeify(hi) : lc !== 0 ? treeBin(hi) : f;
      }
      next[i] = ln;
      next[i + n] = hn;
    }
    this.table = next;
    this.sizeCtl = (n << 1) - (n >>> 1);
  }
}

// ---------------------------------------------------------------------------------------------
// ChunkProviderServer. Loaded chunks live in the inherited ChunkStore map (id2ChunkMap) and in
// loadedChunks (the ArrayList saves iterate). Cell reads through ChunkStore do not load chunks.
export class ChunkProviderServer extends ChunkStore {
  constructor(world, loader, generator) {
    super(!world.hasNoSky);
    this.world = world;
    this.loader = loader;
    this.generator = generator;
    this.chunksToUnload = new ChunkKeySet();
    this.emptyChunk = new EmptyChunk(0, 0, !world.hasNoSky);
    this.loadChunkOnProvideRequest = true;
    this.loadedChunks = [];
  }
  chunkExists(x, z) { return this.chunks.has(chunkKey(x, z)); }
  // unloadChunksIfNotNearSpawn: in a dimension players respawn in, chunks whose centre is within
  // 128 blocks of the spawn point (on both axes) are never queued.
  unloadChunksIfNotNearSpawn(x, z) {
    const w = this.world;
    if (w.canRespawnHere) {
      const dx = x * 16 + 8 - w.spawnX, dz = z * 16 + 8 - w.spawnZ;
      if (dx < -128 || dx > 128 || dz < -128 || dz > 128) this.chunksToUnload.add(x, z);
    } else this.chunksToUnload.add(x, z);
  }
  unloadAllChunks() {
    for (const c of this.loadedChunks) this.unloadChunksIfNotNearSpawn(c.x, c.z);
  }
  // loadChunk: takes the chunk off the unload queue; a chunk not in memory comes from the loader
  // (lastSaveTime reset, structures recreated) or the generator, joins the world and tries to populate.
  loadChunk(x, z) {
    this.chunksToUnload.delete(x, z);
    const key = chunkKey(x, z);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.safeLoadChunk(x, z);
      if (!chunk) chunk = this.generator ? this.generator.provideChunk(x, z) : this.emptyChunk;
      this.chunks.set(key, chunk);
      this.loadedChunks.push(chunk);
      chunk.onChunkLoad(this.world);
      chunk.populateChunk(this, this, x, z);
    }
    return chunk;
  }
  getChunk(x, z) { return this.chunks.get(chunkKey(x, z)) || null; }
  // provideChunk: a missing chunk loads unless loadChunkOnProvideRequest is off (and the world is not
  // finding a spawn point), when it is the shared EmptyChunk. A queued chunk stays queued.
  provideChunk(x, z) {
    const chunk = this.chunks.get(chunkKey(x, z));
    if (chunk) return chunk;
    return !this.world.findingSpawnPoint && !this.loadChunkOnProvideRequest ? this.emptyChunk : this.loadChunk(x, z);
  }
  safeLoadChunk(x, z) {
    if (!this.loader) return null;
    try {
      const chunk = this.loader.load(x, z);
      if (chunk) {
        chunk.lastSaveTime = this.world.totalTime;
        this.generator?.recreateStructures(x, z);
      }
      return chunk;
    } catch (err) {
      console.error("Couldn't load chunk", err);
      return null;
    }
  }
  safeSaveExtraChunkData(chunk) {
    if (!this.loader) return;
    try {
      this.loader.saveExtra(chunk);
    } catch (err) {
      console.error("Couldn't save entities", err);
    }
  }
  safeSaveChunk(chunk) {
    if (!this.loader) return;
    try {
      chunk.lastSaveTime = this.world.totalTime;
      this.loader.save(chunk);
    } catch (err) {
      console.error("Couldn't save chunk", err);
    }
  }
  // populate: Chunk.func_150809_p marks terrain and light populated (lightPopulate hook: the
  // original's sky-light column checks, left to the lighting port), then the generator decorates.
  populate(provider, x, z) {
    const chunk = this.provideChunk(x, z);
    if (chunk.isTerrainPopulated) return;
    chunk.isTerrainPopulated = true;
    chunk.isLightPopulated = true;
    if (!this.world.hasNoSky && this.world.lightPopulate) this.world.lightPopulate(chunk);
    if (this.generator) {
      this.generator.populate(provider, x, z);
      chunk.modified = true;
    }
  }
  // saveChunks: every loaded chunk (extra data too on a full save); an incremental save stops after 24.
  saveChunks(all) {
    let saved = 0;
    for (const chunk of this.loadedChunks.slice()) {
      if (all) this.safeSaveExtraChunkData(chunk);
      if (chunk.needsSaving(all, this.world.totalTime)) {
        this.safeSaveChunk(chunk);
        chunk.modified = false;
        if (++saved === 24 && !all) return false;
      }
    }
    return true;
  }
  saveExtraData() { this.loader?.flush(); }
  // unloadQueuedChunks: up to 100 queued chunks per tick, first in queue order; each unloads, saves
  // unconditionally and leaves the loaded list. Nothing happens while the level is saving.
  unloadQueuedChunks() {
    if (this.world.levelSaving) return false;
    for (let i = 0; i < 100; i++) {
      const first = this.chunksToUnload.first();
      if (!first) continue;
      const [x, z] = first, key = chunkKey(x, z), chunk = this.chunks.get(key);
      if (chunk) {
        chunk.onChunkUnload(this.world);
        this.safeSaveChunk(chunk);
        this.safeSaveExtraChunkData(chunk);
        const at = this.loadedChunks.indexOf(chunk);
        if (at >= 0) this.loadedChunks.splice(at, 1);
      }
      this.chunksToUnload.delete(x, z);
      this.chunks.delete(key);
    }
    this.loader?.tick();
    return false;
  }
  canSave() { return !this.world.levelSaving; }
  get loadedChunkCount() { return this.chunks.size; }
}

// MinecraftServer.initialWorldChunkLoad: 25 x 25 chunks around the spawn point.
export function prepareSpawnArea(provider) {
  const { spawnX, spawnZ } = provider.world;
  for (let k = -192; k <= 192; k += 16) for (let l = -192; l <= 192; l += 16) provider.loadChunk((spawnX + k) >> 4, (spawnZ + l) >> 4);
}

// WorldServer.saveAllChunks (the chunk part; level.dat is not modelled): save, then queue every
// loaded chunk no PlayerInstance watches.
export function saveAllChunks(provider, playerManager, all) {
  if (!provider.canSave()) return false;
  provider.saveChunks(all);
  for (const chunk of provider.loadedChunks.slice()) if (!playerManager.hasWatcher(chunk.x, chunk.z)) provider.unloadChunksIfNotNearSpawn(chunk.x, chunk.z);
  return true;
}

// The chunk steps of WorldServer.tick, in order: unload queued chunks, advance totalWorldTime,
// update player instances.
export function tickChunks(provider, playerManager) {
  provider.unloadQueuedChunks();
  provider.world.totalTime++;
  playerManager.updatePlayerInstances();
}
