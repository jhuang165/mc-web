// Guns mod (not 1.7.10): the attachment screen, opened with Z while a gun is in hand (hooks.js). TaCZ refits a gun at its
// refit screen: a row of slot buttons and, for the chosen slot, the parts the player carries that fit. Here it is the same
// as a menu-ui.js screen: one button per slot the gun has (with what is fitted), a GuiSlot list of the carried parts for that
// slot (every fitting part in creative) headed by "Remove", their effects, and Fit / Done. The fitting itself is the pure
// fitFromInventory below; main.js supplies the inventory and plays the part's install sound.
import { ATTACHMENTS, GUNS, gunOf } from "./catalog.js";
import { ATTACHMENT_TYPES, TYPE_NAMES, fitsGun, refit } from "./fit.js";
import { ensureStyle } from "./smith-screen.js";

// The slots this gun has: those its data allows that some part fits (the pack's allow list), in the screen's order.
export function gunSlots(gun) {
  if (!gun?.attachments?.size) return [];
  const types = new Set();
  for (const a of Object.values(ATTACHMENTS)) if (gun.attachments.has(a.key)) types.add(a.type);
  return ATTACHMENT_TYPES.filter((t) => types.has(t));
}

// The parts on offer for one slot: { attachment, count, slots: [inventory indexes] } for each kind carried (every kind
// that fits, uncounted, in creative), in the pack's order.
export function attachmentChoices(gun, type, main, creative = false) {
  const out = new Map();
  const base = gun?.base ?? gun;
  for (const a of Object.values(ATTACHMENTS)) if (a.type === type && fitsGun(base, a) && creative) out.set(a.id, { attachment: a, count: Infinity, slots: [] });
  main.forEach((s, i) => {
    const a = s && s.count > 0 ? ATTACHMENTS[s.id] : null;
    if (!a || a.type !== type || !fitsGun(base, a)) return;
    const c = out.get(a.id) ?? { attachment: a, count: 0, slots: [] };
    if (c.count !== Infinity) c.count += s.count;
    c.slots.push(i);
    out.set(a.id, c);
  });
  return [...out.values()].sort((x, y) => (x.attachment.sort - y.attachment.sort) || (x.attachment.id - y.attachment.id));
}

const pct = (m) => Math.round((m - 1) * 100);
const signed = (n, unit = "") => `${n > 0 ? "+" : ""}${n}${unit}`;
// One line of what a part changes, from its data (fit.js stats): "ADS +0.03s Recoil -20% Mag III Silenced".
export function partSummary(att, gun = null) {
  const s = att.stats, bits = [];
  const ads = s.ads[0], adsMul = pct(s.ads[1]);
  if (ads) bits.push(`ADS ${signed(Math.round(ads * 100) / 100, "s")}`);
  if (adsMul) bits.push(`ADS ${signed(adsMul, "%")}`);
  const rec = pct((s.recoil[0] + s.recoil[1]) / 2);
  if (rec) bits.push(`Recoil ${signed(rec, "%")}`);
  const spread = pct(s.inaccuracy);
  if (spread) bits.push(`Spread ${signed(spread, "%")}`);
  const dmg = pct(s.damage);
  if (dmg) bits.push(`Damage ${signed(dmg, "%")}`);
  if (s.extendedMag > 0) {
    const size = gun?.extendedMag?.[s.extendedMag - 1];
    bits.push(size ? `Mag ${size}` : `Mag ${"I".repeat(s.extendedMag)}`);
  }
  if (s.silence) bits.push("Silenced");
  if (att.zoom) bits.push(`${att.zoom.map((z) => `${z}x`).join("/")}`);
  return bits.join("  ");
}

// Fits `attachment` (or null to take the slot's part off) into the gun at main[index]. Takes the part from the inventory
// (not in creative) and returns { ok, give: [stacks for the player: the part taken off, rounds a smaller magazine no
// longer holds], sound }; the gun stack changes in place, so the hotbar keeps the same object.
export function fitFromInventory(main, index, type, attachment, { creative = false } = {}) {
  const stack = main[index], gun = gunOf(stack);
  if (!gun?.base && !GUNS[stack?.id]) return { ok: false, give: [], sound: null };
  if (attachment && !fitsGun(gun.base ?? gun, attachment)) return { ok: false, give: [], sound: null };
  const fitted = stack.modTag?.attachments?.[type];
  if (attachment && fitted === attachment.id) return { ok: false, give: [], sound: null };
  if (!attachment && fitted == null) return { ok: false, give: [], sound: null };
  if (attachment && !creative) {
    const i = main.findIndex((s, k) => k !== index && s?.id === attachment.id && s.count > 0);
    if (i < 0) return { ok: false, give: [], sound: null };
    if (--main[i].count <= 0) main[i] = null;
  }
  const { stack: next, removed, unloaded } = refit(stack, type, attachment, { gunOf, ATTACHMENTS });
  for (const k of Object.keys(stack)) if (!(k in next)) delete stack[k];
  Object.assign(stack, next);
  const give = [];
  if (removed && !creative) give.push({ id: removed.id, count: 1, damage: 0 });
  if (unloaded > 0 && !creative) give.push({ id: gun.ammo, count: unloaded, damage: 0 });
  const sound = attachment ? attachment.sounds.install : (removed?.sounds.uninstall ?? removed?.sounds.install ?? null);
  return { ok: true, give, sound };
}

// ctx: { slots() -> the inventory's main stacks, index() -> the held slot, creative, icon(id), name(id), fit(type, attachment
// | null) -> bool, close, show }.
export function attachmentScreen({ slots, index, creative = false, icon, fit, close, show, type = null }) {
  let selected = -1, scroll = 0;
  const self = {
    id: "gun-attachments",
    escape: close,
    init(g, w, h) {
      ensureStyle();
      const c = Math.trunc(w / 2), main = slots(), stack = main[index()], gun = gunOf(stack);
      if (!gun) { close(); return; }
      const types = gunSlots(gun.base ?? gun);
      if (!types.includes(type)) type = types[0] ?? null;
      g.text(`${gun.name} Attachments`, c, 8, { center: true });
      if (!type) {
        g.text("This gun takes no attachments", c, Math.trunc(h / 2) - 4, { center: true, color: 0xa0a0a0 });
        g.button({ x: c - 75, y: h - 28, w: 150, h: 20 }, "Done", close);
        return;
      }
      // Slot buttons, two rows of three: the slot's name and what is fitted.
      const bw = 100, fittedName = (t) => gun.parts?.[t]?.name;
      types.forEach((t, i) => {
        const row = Math.trunc(i / 3), col = i % 3, inRow = Math.min(3, types.length - row * 3);
        const x = c - Math.trunc((inRow * (bw + 2) - 2) / 2) + col * (bw + 2), y = 18 + row * 22;
        const label = `${TYPE_NAMES[t]}${fittedName(t) ? "*" : ""}`;
        const b = g.button({ x, y, w: bw, h: 20 }, label, () => { if (type !== t) { type = t; selected = -1; scroll = 0; show(self); } }, { enabled: type !== t });
        if (fittedName(t)) b.el.title = fittedName(t);
      });
      const top = 18 + Math.ceil(types.length / 3) * 22 + 14;
      const now = gun.parts?.[type], own = stack.modTag?.attachments?.[type];
      g.text(`${TYPE_NAMES[type]}: ${now ? now.name : "None"}${now && own == null ? " (built in)" : ""}`, c, top - 11, { center: true, color: 0xa0a0a0 });
      const choices = attachmentChoices(gun, type, main, creative);
      const rows = [{ remove: true }, ...choices];
      g.slotList({ top, bottom: h - 36, slotHeight: 24, width: 300, scrollbarX: c + 154 }, {
        count: rows.length, scroll,
        selected: (i) => i === selected,
        click: (i, double) => { selected = i; fitButton.enable(canFit(i)); if (double && canFit(i)) apply(); },
        entry(i, y, parent, x) {
          const r = rows[i];
          if (r.remove) {
            g.text(own != null ? "Remove" : "Nothing to remove", x + 22, y + 6, { parent, color: own != null ? 0xffffff : 0x808080 });
            return;
          }
          const a = r.attachment, cell = g.image("smith-icon", x + 1, y + 1, 18, 18, parent);
          cell.innerHTML = icon(a.id);
          const count = r.count === Infinity ? "" : ` x${r.count}`;
          g.text(`${a.name}${count}${own === a.id ? " (fitted)" : ""}`, x + 22, y + 1, { parent });
          g.text(partSummary(a, gun.base ?? gun) || "No effect on stats", x + 22, y + 12, { parent, color: 0xa0a0a0 });
        },
      });
      const canFit = (i) => (rows[i]?.remove ? own != null : !!rows[i] && own !== rows[i].attachment.id);
      const apply = () => {
        const r = rows[selected];
        if (!r || !fit(type, r.remove ? null : r.attachment)) return;
        selected = -1;
        show(self);
      };
      const fitButton = g.button({ x: c - 154, y: h - 28, w: 150, h: 20 }, "Fit", apply, { enabled: selected >= 0 && canFit(selected) });
      g.button({ x: c + 4, y: h - 28, w: 150, h: 20 }, "Done", close);
    },
  };
  return self;
}
