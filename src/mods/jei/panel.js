// Recipe viewer mod (not 1.7.10): the item list to the right of an open container screen and the recipe view over it.
// Written for this project; the layout follows the usual pattern of such viewers (paged item grid, search box, recipe pages).
//
// main.js creates one panel and calls attach() from openContainer, detach() from closeContainer, escape()/key() from its
// keydown handler, and skips its own pointer handling for targets inside `.jei-ui`. Everything is drawn in GUI pixels
// (var(--u), the --gui-scale unit the container screens use).
import { bitmapHtml } from "../../bitmap-text.js";
import { getStringWidth } from "../../font-renderer.js";
import { ITEMS } from "../../survival.js";
import { ViewerState } from "./model.js";

const SLOT = 18, BUTTON = 20, MARGIN = 4, SEARCH_H = 16, VIEW_W = 176, ENTRY_GAP = 4;
// The recipe box: the title row above the entries, the Back/Fwd/page row below them.
const VIEW_HEAD = 26, VIEW_FOOT = BUTTON + 8;
const ENTRY_H = { crafting: 10 + 54, smelting: 10 + 36, fuel: 10 + 18 };
const entryHeight = (e) => e.category === "smithing" ? 10 + Math.max(3, Math.ceil(e.slots.length / 3)) * SLOT : ENTRY_H[e.category] ?? 64;
const at = (x, y, w, h) => `left:calc(${x}*var(--u));top:calc(${y}*var(--u))` + (w != null ? `;width:calc(${w}*var(--u));height:calc(${h}*var(--u))` : "");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const text = (s, x, y, color = 0xffffff, flat = false) => `<span class="mc-text jei-text${flat ? " flat" : ""}" style="${at(x, y)}">${bitmapHtml(s, color)}</span>`;
const button = (action, label, x, y, w, { disabled = false, title = label } = {}) =>
  `<button type="button" class="mc-button jei-button${disabled ? " disabled" : ""}" data-jei="${action}" aria-label="${esc(title)}" style="${at(x, y, w, BUTTON)};--hw:${Math.trunc(w / 2)}">` +
  `<span class="mc-text mc-label" style="${at(Math.trunc(w / 2) - Math.trunc(getStringWidth(label) / 2), 6)}">${bitmapHtml(label, null)}</span></button>`;

export const CATEGORY_NAMES = { crafting: "Crafting", smithing: "Gun Smith Table", smelting: "Smelting", fuel: "Fuel" };

/**
 * deps: {
 *   stackHtml(stack) -> item icon markup (main.js stackHtml),
 *   tooltip(stack) -> { html, width } (tooltipHtml of tooltipLines),
 *   name(stack) -> display name, creative() -> whether the player may take items,
 *   give(stack, count), hovered() -> the container stack under the pointer (for the R and U keys),
 *   sound() -> the button click,
 * }
 */
export function createViewerPanel(deps) {
  const state = new ViewerState({ name: deps.name });
  let root = null, overlay = null, layout = null, giveMode = false, tick = 0, timer = null, hoveredStack = null, pointer = { x: 0, y: 0 };
  const scale = () => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gui-scale")) || 1;

  // The list fills the space right of the container panel: a navigation row, the item grid, (creative) the give toggle, the search box.
  function measure() {
    const shell = overlay?.querySelector(".gui-shell-panel");
    if (!shell) return null;
    const s = scale(), box = shell.getBoundingClientRect(), W = Math.floor(innerWidth / s), H = Math.floor(innerHeight / s);
    const left = Math.ceil(box.right / s) + MARGIN, width = W - left - MARGIN;
    const cols = Math.floor(width / SLOT), searchY = H - MARGIN - SEARCH_H, giveY = searchY - 2 - BUTTON;
    const gridTop = MARGIN + BUTTON + 2, gridBottom = (deps.creative() ? giveY : searchY) - 2;
    const rows = Math.floor((gridBottom - gridTop) / SLOT);
    if (cols < 2 || rows < 1) return null;
    const gridW = cols * SLOT, x = left + Math.floor((width - gridW) / 2);
    return { W, H, x, cols, rows, gridTop, searchY, giveY, gridW, perPage: cols * rows, centre: Math.floor(W / 2), viewTop: Math.max(MARGIN, Math.floor(box.top / s)) };
  }

  function slotHtml(stack, x, y, ref, { frame = false } = {}) {
    return `<div class="jei-slot${frame ? " framed" : ""}" data-jei-slot="${ref}" style="${at(x, y)}"><div class="gui-slot">${stack ? deps.stackHtml(stack) : ""}</div></div>`;
  }

  // ---- the item list ----
  const listStacks = [];
  function renderList() {
    const L = layout;
    const items = state.pageItems(L.perPage), pages = state.pages(L.perPage);
    listStacks.length = 0;
    let html = `<div class="jei-list" style="${at(L.x, 0, L.gridW, L.H)}">`;
    const label = `${state.page + 1}/${pages}`;
    html += button("prev", "<", 0, MARGIN, BUTTON, { title: "Previous page" }) + button("next", ">", L.gridW - BUTTON, MARGIN, BUTTON, { title: "Next page" });
    html += text(label, Math.floor(L.gridW / 2 - getStringWidth(label) / 2), MARGIN + 6);
    items.forEach((s, i) => {
      listStacks.push(s);
      html += slotHtml(s, (i % L.cols) * SLOT, L.gridTop + Math.floor(i / L.cols) * SLOT, "l" + i);
    });
    if (deps.creative()) html += button("give", "Give: " + (giveMode ? "ON" : "OFF"), 0, L.giveY, L.gridW, { title: giveMode ? "Clicking an item gives it (on)" : "Clicking an item gives it (off)" });
    html += `<input class="jei-search" type="text" spellcheck="false" autocomplete="off" maxlength="64" aria-label="Search items" placeholder="Search" style="${at(0, L.searchY, L.gridW, SEARCH_H)}">`;
    html += "</div>";
    const old = root.querySelector(".jei-list"), field = old?.querySelector(".jei-search"), focused = field && document.activeElement === field, caret = field?.selectionStart;
    old?.remove();
    root.insertAdjacentHTML("afterbegin", html);
    const input = root.querySelector(".jei-search");
    input.value = state.query;
    input.oninput = () => { state.setQuery(input.value); renderList(); };
    if (focused) { input.focus(); input.setSelectionRange(caret, caret); }
  }

  // ---- the recipe view ----
  const viewStacks = new Map();
  function viewPerPage() {
    const room = layout.H - 2 * MARGIN - VIEW_HEAD - VIEW_FOOT;
    const tallest = Math.max(...state.view.entries.map(entryHeight));
    return Math.max(1, Math.min(3, Math.floor(room / (tallest + ENTRY_GAP))));
  }
  function entryHtml(e, y, n) {
    const ref = (i) => `v${n}:${i}`;
    let html = "", label = CATEGORY_NAMES[e.category];
    if (e.category === "crafting" && e.shapeless) label += " (shapeless)";
    html += text(label, 8, y, 0x404040, true);
    if (e.note) html += text(e.note, VIEW_W - 8 - getStringWidth(e.note), y, 0x707070, true);
    y += 10;
    const put = (stack, x, sy, i) => { viewStacks.set(ref(i), stack); return slotHtml(stack, x, sy, ref(i), { frame: true }); };
    if (e.category === "crafting" || e.category === "smithing") {
      const cells = Array.from({ length: e.category === "crafting" ? 9 : e.slots.length }, (_, i) => cellAt(e, i));
      for (let i = 0; i < cells.length; i++) html += put(cells[i], 30 + (i % 3) * SLOT, y + Math.floor(i / 3) * SLOT, i);
      if (e.station) html += put({ id: e.station, count: 1, damage: 0 }, 8, y + 18, "station");
      html += `<i class="jei-arrow" style="${at(30 + 54 + 6, y + 18 + 1)}"></i>`;
      html += put(e.output, 30 + 54 + 36, y + 18, "out");
    } else if (e.category === "smelting") {
      html += put(cellAt(e, 0), 50, y, 0);
      html += `<i class="jei-flame" style="${at(51, y + 20)}"></i>`;
      html += `<i class="jei-arrow" style="${at(74, y + 1)}"></i>`;
      html += put(e.output, 106, y, "out");
      if (e.xp) { const xp = `${Math.round(e.xp * 100) / 100} XP`; html += text(xp, 106 + 9 - Math.floor(getStringWidth(xp) / 2), y + 22, 0x404040, true); }
    } else {
      html += put(cellAt(e, 0), 50, y, 0);
      html += `<i class="jei-flame" style="${at(74, y + 2)}"></i>`;
      const items = e.burn / 200, line = `Smelts ${Number.isInteger(items) ? items : items.toFixed(1)} item${items === 1 ? "" : "s"}`;
      html += text(line, 94, y + 5, 0x404040, true);
    }
    return html;
  }
  // The stack a slot shows this second: alternatives cycle once a second, slot by slot.
  function cellAt(e, i) {
    const slot = e.slots[i];
    if (!slot) return null;
    const alt = slot[tick % slot.length];
    return Array.isArray(alt) ? { id: alt[0], count: 1, damage: alt[1] | 0 } : alt;
  }
  function renderView() {
    root.querySelector(".jei-view")?.remove();
    viewStacks.clear();
    if (!state.view) return;
    const per = viewPerPage(), entries = state.viewEntries(per), pages = state.viewPages(per), v = state.view;
    const h = VIEW_HEAD + entries.reduce((n, e) => n + entryHeight(e) + ENTRY_GAP, 0) + VIEW_FOOT;
    const x = Math.max(MARGIN, Math.min(layout.x - VIEW_W - MARGIN, layout.centre - VIEW_W / 2)) | 0;
    const y = Math.max(MARGIN, Math.min(layout.viewTop, layout.H - h - MARGIN));
    const title = `${v.mode === "uses" ? "Uses" : "Recipes"}: ${deps.name(v.stack)}`;
    let html = `<div class="jei-view" role="dialog" aria-label="${esc(title)}"><i class="jei-backdrop" data-jei="close"></i><div class="jei-view-box" style="${at(x, y, VIEW_W, h)}">`;
    html += slotHtml(v.stack, 6, 6, "vt", { frame: false });
    viewStacks.set("vt", v.stack);
    let shown = title;
    while (getStringWidth(shown) > VIEW_W - 30 - 8 && shown.length > 4) shown = shown.slice(0, -2) + "…";
    html += text(shown, 26, 10, 0x404040, true);
    const pageLabel = `${v.page + 1}/${pages}`;
    html += button("back", "Back", 6, h - BUTTON - 4, 40, { disabled: !state.back.length, title: "Back" });
    html += button("vprev", "<", VIEW_W - 6 - BUTTON * 2 - 34, h - BUTTON - 4, BUTTON, { disabled: pages < 2, title: "Previous recipe page" });
    html += text(pageLabel, VIEW_W - 6 - BUTTON - 17 - Math.floor(getStringWidth(pageLabel) / 2), h - BUTTON + 2, 0x404040, true);
    html += button("vnext", ">", VIEW_W - 6 - BUTTON, h - BUTTON - 4, BUTTON, { disabled: pages < 2, title: "Next recipe page" });
    html += button("forward", "Fwd", 50, h - BUTTON - 4, 30, { disabled: !state.forward.length, title: "Forward" });
    let ey = VIEW_HEAD;
    entries.forEach((e, n) => { html += entryHtml(e, ey, n); ey += entryHeight(e) + ENTRY_GAP; });
    html += "</div></div>";
    root.insertAdjacentHTML("beforeend", html);
  }

  function render() {
    if (!root) return;
    layout = measure();
    root.hidden = !layout;
    if (!layout) return;
    renderList();
    renderView();
    renderTooltip();
  }

  function renderTooltip() {
    const tip = root?.querySelector(".jei-tooltip");
    if (!tip) return;
    if (!hoveredStack) { tip.classList.add("hidden"); return; }
    const t = deps.tooltip(hoveredStack);
    tip.innerHTML = t.html;
    tip.style.setProperty("--tw", t.width);
    tip.style.left = pointer.x + "px";
    tip.style.top = pointer.y + "px";
    tip.classList.remove("hidden");
  }

  const stackAtRef = (ref) => (!ref ? null : ref[0] === "l" ? listStacks[+ref.slice(1)] : viewStacks.get(ref)) ?? null;
  function open(mode, stack) {
    if (!state.show(mode, stack)) return false;
    hoveredStack = null;
    render();
    return true;
  }

  function onPointerDown(e) {
    const actionEl = e.target.closest("[data-jei]"), slotEl = e.target.closest("[data-jei-slot]");
    if (e.target.closest(".jei-search")) return; // the browser focuses the field
    e.preventDefault();
    if (document.activeElement?.classList.contains("jei-search")) document.activeElement.blur();
    if (actionEl) {
      if (actionEl.classList.contains("disabled")) return;
      const a = actionEl.dataset.jei, per = layout?.perPage ?? 1;
      if (a !== "close") deps.sound?.();
      if (a === "prev") state.turn(-1, per);
      else if (a === "next") state.turn(1, per);
      else if (a === "give") giveMode = !giveMode;
      else if (a === "close") state.close();
      else if (a === "back") state.goBack();
      else if (a === "forward") state.goForward();
      else if (a === "vprev") state.turnView(-1, viewPerPage());
      else if (a === "vnext") state.turnView(1, viewPerPage());
      render();
      return;
    }
    const stack = stackAtRef(slotEl?.dataset.jeiSlot);
    if (!stack) return;
    const inList = slotEl.dataset.jeiSlot[0] === "l";
    if (inList && giveMode && deps.creative()) {
      deps.give(stack, e.button === 2 ? 1 : ITEMS[stack.id]?.stack ?? 64);
      return;
    }
    open(e.button === 2 ? "uses" : "recipes", stack);
  }
  function onPointerMove(e) {
    pointer = { x: e.clientX, y: e.clientY };
    const slotEl = e.target.closest?.("[data-jei-slot]");
    const next = stackAtRef(slotEl?.dataset.jeiSlot);
    root.querySelectorAll(".jei-slot.hover").forEach((el) => el !== slotEl && el.classList.remove("hover"));
    slotEl?.classList.add("hover");
    hoveredStack = next;
    renderTooltip();
  }
  function onWheel(e) {
    e.preventDefault();
    e.stopPropagation();
    const d = e.deltaY > 0 ? 1 : -1;
    if (state.view && e.target.closest(".jei-view")) state.turnView(d, viewPerPage());
    else if (e.target.closest(".jei-list")) state.turn(d, layout?.perPage ?? 1);
    else return;
    render();
  }

  return {
    state,
    get attached() { return !!root; },
    attach(modal) {
      this.detach();
      overlay = modal;
      root = document.createElement("div");
      root.className = "jei-ui";
      root.innerHTML = '<div class="slot-tooltip hidden jei-tooltip" role="tooltip"></div>';
      overlay.append(root);
      root.addEventListener("pointerdown", onPointerDown);
      root.addEventListener("pointermove", onPointerMove);
      root.addEventListener("pointerleave", () => { hoveredStack = null; renderTooltip(); });
      root.addEventListener("wheel", onWheel, { passive: false });
      root.addEventListener("contextmenu", (e) => e.preventDefault());
      addEventListener("resize", render);
      timer = setInterval(() => { tick++; if (state.view) { renderView(); } }, 1000);
      state.close();
      render();
    },
    detach() {
      if (!root) return;
      clearInterval(timer);
      removeEventListener("resize", render);
      root.remove();
      root = overlay = layout = null;
      hoveredStack = null;
      state.close();
    },
    // The ITEMS table changed (a mod turned on or off).
    reset() { state.reset(); state.close(); },
    // Escape closes the recipe view first; true when it did.
    escape() {
      if (!root || !state.view) return false;
      state.close();
      render();
      return true;
    },
    // R: recipes, U: uses of the stack under the pointer (a list or recipe slot, else the container slot); Backspace goes back.
    key(e) {
      if (!root || e.ctrlKey || e.metaKey || e.altKey) return false;
      if (e.target instanceof Element && e.target.matches("input,textarea")) return false;
      const k = e.key.toLowerCase();
      if (k === "backspace" && state.view) { state.goBack(); render(); return true; }
      if (k !== "r" && k !== "u") return false;
      const stack = hoveredStack ?? deps.hovered?.();
      if (!stack) return false;
      open(k === "u" ? "uses" : "recipes", stack);
      return true;
    },
    render,
    open,
  };
}
