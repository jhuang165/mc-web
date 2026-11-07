// GuiScreenResourcePacks (bgf) with GuiResourcePackAvailable / GuiResourcePackSelected (bgj, bgl over bgk) and the
// GuiResourcePackListEntry rows (bgg, bgi, bgh). Geometry and arrow rules are bytecode-read (public/research/resource-packs.md):
// two 200 wide lists at width / 2 - 204 and width / 2 + 4, top 32, bottom height - 51, 36 high rows with a 13 unit header;
// a 32 x 32 icon, the name at (x + 34, y + 1) and two description lines at y + 12 and y + 22 (wrapped at 157, gray);
// buttons 150 x 20 at y = height - 48. The folder button opens a file picker here (a web page has no pack folder).
import { t, textWidth, trimToWidth, splitLines, slotMetrics, COLOR } from "./menu-screens.js";
import {
  packStore, openStoredPack, packInfo, PackLists, sameSelection, addPackFromFile, addPackFromFolder, applyPacks, refreshWorker, deleteStoredPack,
  DEFAULT_DESCRIPTION,
} from "./resource-packs.js";

const ROW = 36, HEADER = 13, LIST_W = 200, TEXT_W = 157;
const px = (n) => `calc(${n}*var(--u))`;
const at = (x, y, w, h) => `left:${px(x)};top:${px(y)}` + (w != null ? `;width:${px(w)}` : "") + (h != null ? `;height:${px(h)}` : "");
const div = (cls, style) => { const e = document.createElement("div"); if (cls) e.className = cls; if (style) e.style.cssText = style; return e; };
const SPRITE = "url('/media/1.7.10/gui/resource_packs.png')";
export function resourcePacksLayout(w, h) {
  const c = Math.trunc(w / 2), top = 32, bottom = h - 55 + 4;
  const list = { top, bottom, slotHeight: ROW, headerPadding: HEADER, width: LIST_W };
  return {
    title: [c, 16], info: [c - 77, h - 26], left: c - 4 - LIST_W, right: c + 4, list,
    buttons: { folder: { x: c - 154, y: h - 48, w: 150, h: 20 }, done: { x: c + 4, y: h - 48, w: 150, h: 20 } },
  };
}
// bgg.a(...) arrow state for the pointer at (dx, dy) inside a row's icon: which sprite cells are drawn hovered.
export function arrowCells(kind, dx, dy, { canUp, canDown }) {
  const cells = [];
  if (kind === "available") cells.push([0, dx < 32 ? 32 : 0]);
  else {
    cells.push([32, dx < 16 ? 32 : 0]);
    if (canUp) cells.push([96, dx < 32 && dx > 16 && dy < 16 ? 32 : 0]);
    if (canDown) cells.push([64, dx < 32 && dx > 16 && dy > 16 ? 32 : 0]);
  }
  return cells;
}

export function resourcePacksScreen(ctx, parent, show) {
  const store = packStore();
  let infos = new Map(), lists = null, loaded = false, loading = false, scroll = { available: 0, selected: 0 }, urls = [], gui = null, mouseX = 0;
  const initial = [...(ctx.options.resourcePacks ?? [])];
  const reload = async () => {
    const names = await store.listPacks();
    infos = new Map();
    for (const name of names) {
      const rec = await store.getPack(name);
      try { infos.set(name, await packInfo(await openStoredPack(rec))); } catch (e) { infos.set(name, { name, valid: false, description: String(e.message ?? e), icon: null }); }
    }
    lists = new PackLists(names, lists ? lists.names : initial);
    loaded = true;
    if (gui?.screen === screen) gui.build();
  };
  async function addFiles(files, folder) {
    try {
      if (folder) await addPackFromFolder(store, files);
      else for (const f of files) await addPackFromFile(store, f);
    } catch (e) { ctx.notice?.("Cannot read pack: " + (e.message ?? e)); }
    await reload();
  }
  const picker = (folder) => {
    const input = document.createElement("input");
    input.type = "file";
    if (folder) input.webkitdirectory = true; else { input.accept = ".zip,application/zip"; input.multiple = true; }
    input.onchange = () => { if (input.files.length) addFiles(input.files, folder); };
    input.click();
  };
  const done = async () => {
    const names = lists ? lists.names : initial;
    if (sameSelection(names, ctx.options.resourcePacks ?? [])) return show(parent());
    ctx.options.resourcePacks = names;
    ctx.saveOptions();
    try {
      await applyPacks(names, store);
      await refreshWorker();
    } catch (e) { ctx.notice?.("Resource packs failed: " + (e.message ?? e)); return show(parent()); }
    // Minecraft.refreshResources: in place (resource-refresh.js), the world keeps running; without a refresher the page reloads.
    try { await (ctx.reloadResources ? ctx.reloadResources() : location.reload()); } catch (e) { ctx.notice?.("Resource reload failed: " + (e.message ?? e)); }
    show(parent());
  };
  // Not native (1.7.10 has no delete control; packs live in the pack folder there): hover a pack row and press Delete twice to remove
  // the stored pack from this browser. A removed pack that was applied is dropped from the selection and the resources refresh.
  let hovered = null, pendingDelete = null;
  const removePack = async (name) => {
    try {
      const wasApplied = (ctx.options.resourcePacks ?? []).includes(name);
      const left = await deleteStoredPack(store, name, lists ? lists.names : initial);
      const i = initial.indexOf(name); if (i >= 0) initial.splice(i, 1);
      ctx.notice?.(`Deleted resource pack "${name}"`);
      if (wasApplied) {
        ctx.options.resourcePacks = (ctx.options.resourcePacks ?? []).filter((n) => n !== name);
        ctx.saveOptions();
        await applyPacks(ctx.options.resourcePacks, store);
        await refreshWorker();
        await ctx.reloadResources?.();
      }
      lists = null; initial.length = 0; initial.push(...left);
      await reload();
    } catch (e) { ctx.notice?.("Cannot delete pack: " + (e.message ?? e)); }
  };

  const screen = {
    id: "resource-packs",
    // GuiScreen.keyTyped: Escape leaves without applying the lists.
    escape: () => ctx.closeScreen(),
    key(e) {
      if (e.code !== "Delete" || !hovered) return false;
      if (pendingDelete !== hovered) { pendingDelete = hovered; ctx.notice?.(`Press Delete again to remove "${hovered}" from this browser`); return true; }
      const name = hovered; pendingDelete = hovered = null;
      removePack(name);
      return true;
    },
    close() { for (const u of urls) URL.revokeObjectURL(u); urls = []; },
    wheel(dir) {
      if (!gui) return;
      const L = resourcePacksLayout(gui.w, gui.h), which = mouseX >= gui.w / 2 ? "selected" : "available";
      const count = (which === "selected" ? lists.selected.length + 1 : lists.available.length);
      scroll[which] = slotMetrics(L.list, count, scroll[which] + (dir * ROW) / 2).scroll;
      gui.build();
    },
    init(g, w, h) {
      gui = g;
      if (!loaded && !loading) { loading = true; reload(); }
      const L = resourcePacksLayout(w, h), b = L.buttons;
      g.layer.onpointermove = (e) => { mouseX = g.mouse(e).x; };
      // Pack zips can also be dropped on the screen.
      g.layer.ondragover = (e) => e.preventDefault();
      g.layer.ondrop = (e) => { e.preventDefault(); const f = [...e.dataTransfer.files].filter((x) => /\.zip$/i.test(x.name)); if (f.length) addFiles(f, false); };
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls = [];
      if (loaded) {
        const sel = lists.selected.map((n) => infos.get(n)).filter(Boolean);
        buildList(g, w, L, "available", L.left, lists.available.map((n) => infos.get(n)).filter(Boolean), t("resourcePack.available.title"));
        buildList(g, w, L, "selected", L.right, [...sel, { name: "Default", description: DEFAULT_DESCRIPTION, valid: true, builtin: true }], t("resourcePack.selected.title"));
      }
      g.text(t("resourcePack.title"), ...L.title, { center: true });
      g.text(t("resourcePack.folderInfo"), ...L.info, { center: true, color: COLOR.gray });
      // The native button opens the pack folder; here it picks pack files (Shift: a pack folder).
      const folder = g.button(b.folder, t("resourcePack.openFolder"), () => picker(false));
      folder.el.title = "Add .zip resource packs (Shift+click: add a pack folder). Packs can also be dropped on this screen.";
      folder.el.addEventListener("click", (e) => { if (e.shiftKey) { e.stopImmediatePropagation(); picker(true); } }, true);
      g.button(b.done, t("gui.done"), done);
    },
  };

  // One GuiResourcePackList: header, rows with arrow hover/click, scroll bar.
  function buildList(g, w, L, kind, left, entries, title) {
    const { top, bottom } = L.list, spec = L.list;
    const m = slotMetrics(spec, entries.length, scroll[kind]);
    scroll[kind] = m.scroll;
    const frame = div("mc-slot", at(left, top, LIST_W, bottom - top) + `;--top:${top}`);
    const content = div("mc-slot-content", at(0, 4 - Math.trunc(m.scroll), LIST_W, entries.length * ROW + HEADER));
    frame.style.setProperty("--scroll", String(Math.trunc(m.scroll)));
    frame.append(content);
    const head = trimToWidth(title, LIST_W);
    g.text("§n§l" + head, left + Math.trunc(LIST_W / 2) - Math.trunc(textWidth(head) / 2), Math.min(top + 3, top + 4 - Math.trunc(m.scroll)), { parent: g.layer });
    const rows = [];
    entries.forEach((info, i) => {
      const y = HEADER + i * ROW, x = 2;
      const icon = div("", at(x, y, 32, 32));
      const src = info.icon ? (urls.push(URL.createObjectURL(new Blob([info.icon], { type: "image/png" }))), urls.at(-1)) : "/media/1.7.10/misc/unknown_pack.png";
      icon.style.background = `url('${src}') 0 0/100% 100% no-repeat`;
      icon.style.imageRendering = "pixelated";
      content.append(icon);
      let name = info.name;
      if (textWidth(name) > TEXT_W) name = trimToWidth(name, TEXT_W - textWidth("...")) + "...";
      g.text(name, x + 34, y + 1, { parent: content });
      splitLines(info.description ?? "", TEXT_W).slice(0, 2).forEach((line, k) => g.text(line, x + 34, y + 12 + 10 * k, { color: COLOR.gray, parent: content }));
      const overlay = div("", at(x, y, 32, 32) + ";display:none;pointer-events:none");
      content.append(overlay);
      rows.push({ info, y, overlay });
    });
    // bgk.drawScreen: bands over the dirt above and below, the 4 unit shadows, the scroll bar at the list's right edge - 6.
    g.layer.prepend(frame);
    g.layer.append(
      div("mc-band", at(0, 0, w, top)), div("mc-band", at(0, bottom, w, g.h - bottom) + `;--top:${bottom}`),
      div("mc-shadow top", at(left, top, LIST_W, 4)), div("mc-shadow bottom", at(left, bottom - 4, LIST_W, 4)),
    );
    const track = div("mc-scroll", at(left + LIST_W - 6, top, 6, bottom - top)), thumb = document.createElement("i");
    track.append(thumb);
    thumb.style.cssText = at(0, m.thumbY - top, 6, m.thumb);
    track.hidden = m.max <= 0;
    g.layer.append(track);
    const metrics = (v) => slotMetrics(spec, entries.length, v);
    const rowAt = (p) => {
      const rel = p.y - top - HEADER + Math.trunc(m.scroll) - 4, i = Math.trunc(rel / ROW);
      if (rel < 0 || i < 0 || i >= entries.length || p.y < top || p.y > bottom || p.x < left || p.x > left + LIST_W - 6) return null;
      return { i, dx: p.x - (left + 2), dy: rel - i * ROW };
    };
    const paint = (hit) => {
      rows.forEach((r) => (r.overlay.style.display = "none"));
      hovered = hit && !rows[hit.i].info.builtin ? rows[hit.i].info.name : null;
      if (!hit) return;
      const row = rows[hit.i], info = row.info;
      if (info.builtin) return;
      const name = info.name;
      row.overlay.style.display = "block";
      row.overlay.innerHTML = "";
      row.overlay.style.background = "rgba(144,144,144,.627)"; // 0xA0909090
      const cells = arrowCells(kind, hit.dx, hit.dy, { canUp: lists.canMoveUp(name) && !entries[hit.i - 1]?.builtin, canDown: lists.canMoveDown(name) });
      for (const [u, v] of cells) row.overlay.append(div("", `left:0;top:0;width:${px(32)};height:${px(32)};background:${SPRITE} ${px(-u)} ${px(-v)}/${px(256)} ${px(256)};image-rendering:pixelated`));
    };
    frame.addEventListener("pointermove", (e) => paint(rowAt(g.mouse(e))));
    frame.addEventListener("pointerleave", () => paint(null));
    frame.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const hit = rowAt(g.mouse(e));
      if (!hit || entries[hit.i].builtin || hit.dx < 0 || hit.dx > 32) return;
      const name = entries[hit.i].name;
      let changed = false;
      if (kind === "available") changed = lists.select(name);
      else if (hit.dx < 16) changed = lists.deselect(name);
      else if (hit.dy < 16) changed = lists.moveUp(name);
      else if (hit.dy > 16) changed = lists.moveDown(name);
      if (changed) { e.preventDefault(); g.build(); }
    });
    track.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const mm = metrics(m.scroll), mult = -1 / ((bottom - top - mm.thumb) / Math.max(1, mm.max));
      let last = g.mouse(e).y, amount = m.scroll;
      g.drag = { move: (p) => { amount = metrics(amount - (p.y - last) * mult).scroll; last = p.y; scroll[kind] = amount; content.style.top = px(4 - Math.trunc(amount)); frame.style.setProperty("--scroll", String(Math.trunc(amount))); thumb.style.cssText = at(0, metrics(amount).thumbY - top, 6, mm.thumb); } };
    });
  }
  return screen;
}
