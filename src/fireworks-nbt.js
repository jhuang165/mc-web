// ItemStack tag <-> browser stack for fireworks: tag.Explosion (firework star) and tag.Fireworks (rocket), Java 1.7.10
// ItemFireworkCharge / ItemFirework. Keeps region-export.js and region-import.js hooks one line each.
import { NBT } from './nbt.js';
import { normalizeExplosion, normalizeFireworks } from './fireworks.js';

const tag = (type, value) => ({ type, value });
const explosionTag = (e) => tag(NBT.COMPOUND, new Map([
  ['Type', tag(NBT.BYTE, e.type)], ['Colors', tag(NBT.INT_ARRAY, Int32Array.from(e.colors))], ['FadeColors', tag(NBT.INT_ARRAY, Int32Array.from(e.fade))],
  ['Flicker', tag(NBT.BYTE, e.flicker ? 1 : 0)], ['Trail', tag(NBT.BYTE, e.trail ? 1 : 0)]]));
// Adds Explosion / Fireworks to the `tag` entries object of an item compound.
export function writeFireworkTags(stack, entries) {
  const e = normalizeExplosion(stack.explosion), f = normalizeFireworks(stack.fireworks);
  if (stack.explosion && e) entries.Explosion = explosionTag(e);
  if (stack.fireworks && f) {
    const m = new Map();
    if (f.flight !== undefined) m.set('Flight', tag(NBT.BYTE, f.flight));
    m.set('Explosions', tag(NBT.LIST, { elementType: f.explosions.length ? NBT.COMPOUND : NBT.END, items: f.explosions.map((e) => explosionTag(e).value) }));
    entries.Fireworks = tag(NBT.COMPOUND, m);
  }
}
const num = (t) => (t && typeof t.value === 'number' ? t.value : typeof t?.value === 'bigint' ? Number(t.value) : 0);
const readExplosion = (c) => {
  if (!(c instanceof Map)) return null;
  const ints = (k) => { const t = c.get(k); return t?.type === NBT.INT_ARRAY ? [...t.value] : []; };
  return normalizeExplosion({ type: num(c.get('Type')), colors: ints('Colors'), fade: ints('FadeColors'), flicker: num(c.get('Flicker')) !== 0, trail: num(c.get('Trail')) !== 0 });
};
// Reads Explosion / Fireworks from an item `tag` compound Map onto the stack.
export function readFireworkNbt(stack, nbt) {
  const ex = nbt.get('Explosion');
  if (ex?.type === NBT.COMPOUND) { const e = readExplosion(ex.value); if (e) stack.explosion = e; }
  const fw = nbt.get('Fireworks');
  if (fw?.type === NBT.COMPOUND) {
    const list = fw.value.get('Explosions'), explosions = list?.type === NBT.LIST && list.value.elementType === NBT.COMPOUND ? list.value.items.map(readExplosion).filter(Boolean) : [];
    const out = { explosions }, flight = fw.value.get('Flight');
    if (flight) out.flight = (num(flight) << 24) >> 24;
    stack.fireworks = out;
  }
  return ['Explosion', 'Fireworks'];
}
