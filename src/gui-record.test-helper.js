// Test helper (no DOM): runs a menu screen's init with a recording stand-in for the Gui widget factory (menu-ui.js Gui) and returns what
// it created: buttons (rect, label, enabled), text calls, lists. Used by gui-menus-b75.test.js to replay the executed 1.7.10 records.
export function recorder(width = 320) {
  const rec = { width, buttons: [], texts: [], lists: [], fields: [], sliders: [], shown: [], images: [] };
  const handle = (entry) => ({
    el: { setAttribute() {}, style: {}, append() {} },
    get enabled() { return entry.enabled; },
    enable(v) { entry.enabled = !!v; }, show(v = true) { entry.hidden = !v; }, hide() { entry.hidden = true; }, set(label) { entry.label = label; }, setLabel(label) { entry.label = label; },
  });
  const g = {
    button(r, label, action, opts = {}) { const e = { ...r, label, action, enabled: (opts.enabled ?? true) && !opts.reason, reason: opts.reason ?? '' }; rec.buttons.push(e); return handle(e); },
    slider(r, opts = {}) { const e = { ...r, label: opts.label, enabled: !opts.reason, slider: true, reason: opts.reason ?? '' }; rec.buttons.push(e); rec.sliders.push(e); return handle(e); },
    text(s, x, y, opts = {}) { const e = { text: String(s), x, y, ...opts }; rec.texts.push(e); return { el: { style: {}, setAttribute() {} }, set() {} }; },
    splitText(s, x, y, w, opts = {}) { rec.texts.push({ text: String(s), x, y, width: w, split: true, ...opts }); },
    field(r, opts = {}) { const e = { ...r, ...opts }; rec.fields.push(e); return { focus() {}, show() {}, hide() {}, value: opts.value ?? '', el: { style: {}, setAttribute() {} } }; },
    // Entries are drawn into the list's content box: y is relative to it, which starts 4 units under the list top (menu-ui.js slotList).
    slotList(L, opts) {
      const e = { ...L, ...opts }; rec.lists.push(e);
      const left = Math.trunc((rec.width ?? 320) / 2) - Math.trunc(L.width / 2), pad = L.headerPadding ?? 0;
      for (let i = 0; i < opts.count; i++) {
        const b0 = rec.buttons.length, t0 = rec.texts.length, y = pad + i * L.slotHeight;
        opts.entry(i, y, {}, left + 2);
        for (const b of rec.buttons.slice(b0)) { b.y += L.top + 4; b.inList = i; }
        for (const t of rec.texts.slice(t0)) { t.y += L.top + 4; t.inList = i; }
      }
      return { scroll: 0, wheel() {}, select() {}, set() {}, refresh() {} };
    },
    image(...a) { rec.images.push(a); return { setAttribute() {}, style: {} }; },
    languageButton(...a) { rec.language = a; }, sound() {}, build() {}, mouse() { return { x: 0, y: 0 }; },
    layer: { addEventListener() {}, removeEventListener() {} }, root: {},
  };
  return { g, rec };
}
export function fakeGui(rec = []) {
  return { show(s) { rec.push(s); }, build() {}, layer: { addEventListener() {}, removeEventListener() {} } };
}
