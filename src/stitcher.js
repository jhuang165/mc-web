// The 1.7.10 Stitcher (bpv, with Holder bpw and Slot bpx; bytecode-read and checked against the executed class in public/research/stitcher-reference.json, vanilla sets
// and the HD cases of tools/probes/StitcherProbe.java): sprites are sorted largest first, placed into a tree of free slots, and the atlas grows by one sprite edge at a time
// (power-of-two sides when forcePOT, as TextureMap does). Used for texture packs whose sprites are not 16 px: the sheets (item-atlas.js) are stitched at the pack's own sizes
// instead of scaling 16 px cells.
//
// Holder sizes are rounded up to a multiple of 2^mip (Stitcher.getMipLevelSize); a Holder is "rotated" (its width/height swapped) when its height is the larger side or
// when a second placement attempt flips it, which can only change anything for non-square sprites.

// Stitcher.getMipLevelSize (bpv.b(int, int)): (x >> level) + (low bits set ? 1 : 0), shifted back up.
export function mipSize(x, level) { return ((x >> level) + ((x & ((1 << level) - 1)) === 0 ? 0 : 1)) << level; }
// MathHelper.roundUpToPowerOfTwo (qh.b(int)): the bit-smearing version, so 0 stays 0 and a power of two stays itself.
export function roundUpPow2(v) { let i = v - 1; i |= i >> 1; i |= i >> 2; i |= i >> 4; i |= i >> 8; i |= i >> 16; return i + 1; }
// MathHelper.calculateLogBaseTwo (qh.c(int)): log2 of the value rounded up to a power of two.
export function log2Ceil(v) { return 31 - Math.clz32(roundUpPow2(v)); }
// TextureMap.loadTextureAtlas: the mipmap level count is the setting capped by log2 of the smallest sprite side (missingno, 16 px, is always one of the sprites).
export function mipLevelsFor(sizes, requested) { let min = 16; for (const s of sizes) min = Math.min(min, s); return Math.min(requested, log2Ceil(min)); }

class Holder {
  constructor(sprite, mip) {
    this.sprite = sprite; this.w = sprite.width; this.h = sprite.height; this.mip = mip;
    this.rotated = mipSize(this.h, mip) > mipSize(this.w, mip);
  }
  get width() { return mipSize(this.rotated ? this.h : this.w, this.mip); }
  get height() { return mipSize(this.rotated ? this.w : this.h, this.mip); }
  rotate() { this.rotated = !this.rotated; }
}
// Holder.compareTo: taller first, then wider, then the sprite name (String.compareTo: UTF-16 code units).
function compare(a, b) {
  if (a.height !== b.height) return a.height < b.height ? 1 : -1;
  if (a.width !== b.width) return a.width < b.width ? 1 : -1;
  const x = a.sprite.name, y = b.sprite.name;
  return x < y ? -1 : x > y ? 1 : 0;
}
class Slot {
  constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; this.subs = null; this.holder = null; }
  add(holder) {
    if (this.holder) return false;
    const w = holder.width, h = holder.height;
    if (w > this.w || h > this.h) return false;
    if (w === this.w && h === this.h) { this.holder = holder; return true; }
    if (!this.subs) {
      this.subs = [new Slot(this.x, this.y, w, h)];
      const rw = this.w - w, rh = this.h - h;
      if (rh > 0 && rw > 0) {
        if (Math.max(this.h, rw) >= Math.max(this.w, rh)) { this.subs.push(new Slot(this.x, this.y + h, w, rh)); this.subs.push(new Slot(this.x + w, this.y, rw, this.h)); }
        else { this.subs.push(new Slot(this.x + w, this.y, rw, h)); this.subs.push(new Slot(this.x, this.y + h, this.w, rh)); }
      } else if (rw === 0) this.subs.push(new Slot(this.x, this.y + h, w, rh));
      else if (rh === 0) this.subs.push(new Slot(this.x + w, this.y, rw, h));
    }
    for (const s of this.subs) if (s.add(holder)) return true;
    return false;
  }
  leaves(out) { if (this.holder) out.push(this); else if (this.subs) for (const s of this.subs) s.leaves(out); }
}

// sprites: [{ name, width, height }] (the first square frame of each texture); options: maxSize (GL_MAX_TEXTURE_SIZE, 16384 as in the executed probe), forcePOT (TextureMap: true),
// mip (the mipmap level the Stitcher was built with). Returns { width, height, sprites: [{ name, x, y, w, h, rotated }] } in slot-tree order; throws the native "Unable to fit".
export function stitch(sprites, { maxSize = 16384, forcePOT = true, mip = 0 } = {}) {
  const holders = sprites.map((s) => new Holder(s, mip)).sort(compare), slots = [];
  let curW = 0, curH = 0;
  const expand = (holder) => {
    const i = Math.min(holder.width, holder.height), first = curW === 0 && curH === 0;
    let growWidth;
    if (forcePOT) {
      const j = roundUpPow2(curW), k = roundUpPow2(curH), l = roundUpPow2(curW + i), i1 = roundUpPow2(curH + i), okW = l <= maxSize, okH = i1 <= maxSize;
      if (!okW && !okH) return false;
      const wChanges = j !== l, hChanges = k !== i1;
      growWidth = wChanges !== hChanges ? !wChanges : okW && j <= k;
    } else {
      const okW = curW + i <= maxSize, okH = curH + i <= maxSize;
      if (!okW && !okH) return false;
      growWidth = okW && (first || curW <= curH);
    }
    const edge = Math.max(holder.width, holder.height);
    if (roundUpPow2((growWidth ? curH : curW) + edge) > maxSize) return false;
    let slot;
    if (growWidth) {
      if (holder.width > holder.height) holder.rotate();
      if (curH === 0) curH = holder.height;
      slot = new Slot(curW, 0, holder.width, curH);
      curW += holder.width;
    } else {
      slot = new Slot(0, curH, curW, holder.height);
      curH += holder.height;
    }
    slot.add(holder);
    slots.push(slot);
    return true;
  };
  const allocate = (holder) => {
    for (const slot of slots) {
      if (slot.add(holder)) return true;
      holder.rotate();
      if (slot.add(holder)) return true;
      holder.rotate();
    }
    return expand(holder);
  };
  for (const h of holders) if (!allocate(h)) throw new Error(`Unable to fit: ${h.sprite.name} - size: ${h.sprite.width}x${h.sprite.height} - Maybe try a lowerresolution resourcepack?`);
  if (forcePOT) { curW = roundUpPow2(curW); curH = roundUpPow2(curH); }
  const leaves = [];
  for (const s of slots) s.leaves(leaves);
  return { width: curW, height: curH, sprites: leaves.map((s) => ({ name: s.holder.sprite.name, x: s.x, y: s.y, w: s.holder.sprite.width, h: s.holder.sprite.height, rotated: s.holder.rotated })) };
}
