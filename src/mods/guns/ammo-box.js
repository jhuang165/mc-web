// Guns mod (not 1.7.10): ammo boxes, after TaCZ's. A box holds rounds of one ammo type, several stacks' worth (iron 3, gold 5,
// diamond 7 stacks); a creative box stands for endless rounds of every type. A gun's reload and an inventory-fed gun count
// and take the rounds in boxes after the loose ones. Using a box (right click) fills it from the inventory with its ammo
// type, or with the first ammo found while it is empty; using it while sneaking empties it into the inventory. The stack
// keeps its contents in `modTag.box` ({ ammo: id, count }, saved with the stack; inventory.js). Pure: no DOM.
import { AMMO } from "./catalog.js";

export const AMMO_BOX_IRON = 4301, AMMO_BOX_GOLD = 4302, AMMO_BOX_DIAMOND = 4303, AMMO_BOX_CREATIVE = 4304;
export const AMMO_BOXES = {
  [AMMO_BOX_IRON]: { id: AMMO_BOX_IRON, key: "iron", name: "Iron Ammo Box", stacks: 3 },
  [AMMO_BOX_GOLD]: { id: AMMO_BOX_GOLD, key: "gold", name: "Gold Ammo Box", stacks: 5 },
  [AMMO_BOX_DIAMOND]: { id: AMMO_BOX_DIAMOND, key: "diamond", name: "Diamond Ammo Box", stacks: 7 },
  [AMMO_BOX_CREATIVE]: { id: AMMO_BOX_CREATIVE, key: "creative", name: "Creative Ammo Box", stacks: Infinity },
};
export const isAmmoBox = (id) => AMMO_BOXES[id] !== undefined;

// { ammo, count } of a box stack, or null when it is empty (or not a box).
export function boxContents(stack) {
  const b = isAmmoBox(stack?.id) ? stack.modTag?.box : null;
  return b && AMMO[b.ammo] && b.count > 0 ? { ammo: b.ammo, count: b.count } : null;
}
// How many rounds of `ammo` the box holds at most.
export const boxCapacity = (stack, ammo) => (AMMO_BOXES[stack?.id]?.stacks ?? 0) * (AMMO[ammo]?.stack ?? 0);

function setContents(stack, ammo, count) {
  const tag = { ...(stack.modTag ?? {}) };
  if (count > 0) tag.box = { ammo, count }; else delete tag.box;
  if (Object.keys(tag).length) stack.modTag = tag; else delete stack.modTag;
}

// Rounds of `id` carried: loose stacks plus boxes (Infinity with a creative box).
export function carriedAmmo(main, id) {
  let n = 0;
  for (const s of main) {
    if (!s || !(s.count > 0)) continue;
    if (s.id === id) n += s.count;
    else if (s.id === AMMO_BOX_CREATIVE && AMMO[id]) return Infinity;
    else { const b = boxContents(s); if (b?.ammo === id) n += b.count; }
  }
  return n;
}
// Takes `n` rounds of `id`, loose ones first, then from boxes; false (taking nothing) when there are too few.
// `decr(i, k)` takes k from the loose stack in slot i (PlayerInventory.decr, which empties the slot at zero).
export function takeAmmo(main, id, n, decr = (i, k) => { main[i].count -= k; if (main[i].count <= 0) main[i] = null; }) {
  if (carriedAmmo(main, id) < n) return false;
  for (let i = 0; i < main.length && n > 0; i++) {
    const s = main[i];
    if (s?.id !== id || !(s.count > 0)) continue;
    const k = Math.min(n, s.count);
    decr(i, k); n -= k;
  }
  for (let i = 0; i < main.length && n > 0; i++) {
    const s = main[i];
    if (s?.id === AMMO_BOX_CREATIVE && s.count > 0) return true;
    const b = boxContents(s);
    if (b?.ammo !== id) continue;
    const k = Math.min(n, b.count);
    setContents(s, id, b.count - k); n -= k;
  }
  return n <= 0;
}

// Fills the box at main[index] from the loose rounds in `main`: its own type, else the first ammo found. Returns the rounds
// moved (0: nothing to move or the box is full).
export function fillBox(main, index) {
  const box = main[index];
  if (!isAmmoBox(box?.id) || box.id === AMMO_BOX_CREATIVE) return 0;
  const inside = boxContents(box), ammo = inside?.ammo ?? main.find((s, i) => i !== index && s && s.count > 0 && AMMO[s.id])?.id;
  if (ammo == null) return 0;
  let have = inside?.count ?? 0, moved = 0;
  const room = () => boxCapacity(box, ammo) - have;
  for (let i = 0; i < main.length && room() > 0; i++) {
    const s = main[i];
    if (i === index || s?.id !== ammo || !(s.count > 0) || s.modTag) continue;
    const k = Math.min(room(), s.count);
    s.count -= k; if (s.count <= 0) main[i] = null;
    have += k; moved += k;
  }
  if (moved) setContents(box, ammo, have);
  return moved;
}
// Empties the box at main[index]: returns the rounds as stacks of at most the ammo's stack size, for the caller to add.
export function emptyBox(main, index) {
  const box = main[index], inside = boxContents(box);
  if (!inside) return [];
  setContents(box, inside.ammo, 0);
  const out = [], size = AMMO[inside.ammo].stack;
  for (let left = inside.count; left > 0; left -= size) out.push({ id: inside.ammo, count: Math.min(size, left), damage: 0 });
  return out;
}

// A saved box stack's tag (item readTag, install.js): { box: { ammo, count } } with a known ammo id and a sane count.
export function readBoxTag(tag) {
  const b = tag?.box;
  if (!b || !Number.isInteger(b.ammo) || !Number.isInteger(b.count) || b.count <= 0) return null;
  return { box: { ammo: b.ammo, count: Math.min(b.count, 7 * 64 * 16) } };
}
// The tooltip line for a box: "180/180 .45 ACP Rounds", "Empty" or "Endless rounds".
export function boxLabel(stack) {
  if (stack?.id === AMMO_BOX_CREATIVE) return "Endless rounds of every type";
  const b = boxContents(stack);
  return b ? `${b.count}/${boxCapacity(stack, b.ammo)} ${AMMO[b.ammo].name}` : "Empty";
}
