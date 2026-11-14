// Batch 68 chunkscan2: java.util.HashMap's treeified bins (Java 8 and later), for the iteration order of a HashSet (java-hashset-order.js).
// A bin that reaches 9 nodes in a table of 64 or more buckets becomes a red-black tree (TREEIFY_THRESHOLD 8, MIN_TREEIFY_CAPACITY 64); the TreeNodes still keep their `next` chain, which
// is what the iterator walks, and that chain is reordered by two rules: moveRootToFront (the tree root becomes the bin's first node) and putTreeVal (a new node is linked right AFTER its
// tree parent, not at the end). This is a port of those methods of the OpenJDK 8 source (recalled, then checked against the executed ActiveChunksProbe output in the tests).
// A bin here is an array of nodes in `next` order with `bin.tree = true` once treeified; a node gets { parent, left, right, red } when it is in a tree.
// Ordering inside the tree compares the (spread) hash as a signed int; equal hashes of different keys would use tieBreakOrder (identityHashCode for a key that is not Comparable, as
// ChunkCoordIntPair is), which is not reproducible: `ties.count` counts those and they are placed by a fixed rule.
export const TREEIFY_THRESHOLD = 8, UNTREEIFY_THRESHOLD = 6, MIN_TREEIFY_CAPACITY = 64;
export const ties = { count: 0 };

function rotateLeft(root, p) {
  let r, pp, rl;
  if (p && (r = p.right)) {
    if ((rl = p.right = r.left)) rl.parent = p;
    if (!(pp = r.parent = p.parent)) { root = r; r.red = false; } else if (pp.left === p) pp.left = r; else pp.right = r;
    r.left = p; p.parent = r;
  }
  return root;
}
function rotateRight(root, p) {
  let l, pp, lr;
  if (p && (l = p.left)) {
    if ((lr = p.left = l.right)) lr.parent = p;
    if (!(pp = l.parent = p.parent)) { root = l; l.red = false; } else if (pp.right === p) pp.right = l; else pp.left = l;
    l.right = p; p.parent = l;
  }
  return root;
}
function balanceInsertion(root, x) {
  x.red = true;
  for (let xp, xpp, xppl, xppr; ;) {
    if (!(xp = x.parent)) { x.red = false; return x; }
    if (!xp.red || !(xpp = xp.parent)) return root;
    if (xp === (xppl = xpp.left)) {
      if ((xppr = xpp.right) && xppr.red) { xppr.red = false; xp.red = false; xpp.red = true; x = xpp; }
      else {
        if (x === xp.right) { root = rotateLeft(root, x = xp); xpp = (xp = x.parent) ? xp.parent : null; }
        if (xp) { xp.red = false; if (xpp) { xpp.red = true; root = rotateRight(root, xpp); } }
      }
    } else if (xppl && xppl.red) { xppl.red = false; xp.red = false; xpp.red = true; x = xpp; }
    else {
      if (x === xp.left) { root = rotateRight(root, x = xp); xpp = (xp = x.parent) ? xp.parent : null; }
      if (xp) { xp.red = false; if (xpp) { xpp.red = true; root = rotateLeft(root, xpp); } }
    }
  }
}
const direction = (p, h) => { // the descent step of treeify and putTreeVal: -1 or 1 (0 never: equal hashes fall to the tie rule)
  if (p.hash > h) return -1;
  if (p.hash < h) return 1;
  ties.count++; return -1;
};
// moveRootToFront: the root leaves its place in the next chain and becomes the first node.
function moveRootToFront(bin, root) {
  const at = bin.indexOf(root);
  if (at > 0) { bin.splice(at, 1); bin.unshift(root); }
}
// TreeNode.treeify: rebuilds the tree from the chain in order (each node is inserted by hash, then rebalanced), then moves the root to the front.
export function treeify(bin) {
  let root = null;
  for (const x of bin) {
    x.left = x.right = null;
    if (!root) { x.parent = null; x.red = false; root = x; continue; }
    for (let p = root; ;) {
      const dir = direction(p, x.hash), xp = p;
      if (!(p = dir <= 0 ? p.left : p.right)) {
        x.parent = xp; if (dir <= 0) xp.left = x; else xp.right = x;
        root = balanceInsertion(root, x); break;
      }
    }
  }
  bin.tree = true;
  moveRootToFront(bin, root);
}
// HashMap.putTreeVal for a key that is not in the bin: the new node goes right after its tree parent in the chain, then the (possibly new) root moves to the front.
export function putTreeVal(bin, x) {
  let root = bin[0];
  while (root.parent) root = root.parent;
  x.left = x.right = null;
  for (let p = root; ;) {
    const dir = direction(p, x.hash), xp = p;
    if (!(p = dir <= 0 ? p.left : p.right)) {
      if (dir <= 0) xp.left = x; else xp.right = x;
      bin.splice(bin.indexOf(xp) + 1, 0, x);
      x.parent = xp;
      moveRootToFront(bin, balanceInsertion(root, x));
      return;
    }
  }
}
export function untreeify(bin) {
  for (const x of bin) x.parent = x.left = x.right = null;
  bin.tree = false;
}
// TreeNode.split on a resize: the chain divides by the new hash bit keeping its order; a half of 6 or fewer nodes is untreeified, a larger half stays a tree and is rebuilt when the other half
// is not empty (when everything stays on one side the existing tree is kept as it is). Returns [lo, hi] bins.
export function split(bin, bit) {
  const lo = [], hi = [];
  for (const e of bin) ((e.hash & bit) === 0 ? lo : hi).push(e);
  for (const [half, other] of [[lo, hi], [hi, lo]]) {
    if (!half.length) continue;
    if (half.length <= UNTREEIFY_THRESHOLD) untreeify(half);
    else { half.tree = true; if (other.length) treeify(half); }
  }
  return [lo, hi];
}
