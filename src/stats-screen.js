// GuiStats (bej) of Minecraft Java 1.7.10: the General, Blocks, Items and Mobs tabs over a GuiSlot. Layout constants are
// bytecode-read (public/research/stats-reference.json "screen"); sorting is beq.h (stats.js nextSort/sortRows).
import { GENERAL, BLOCK_LIST, ITEM_LIST, EGGS, formatStat, mineStat, craftStat, useStat, breakStat, lang, nextSort, sortRows } from "./stats.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { nativeName } from "./item-names.js";
import { EN_US } from "./lang-en-us.js";

const SPRITE = "/media/1.7.10/gui/container/stats_icons.png";
const px = (n) => `calc(${n}*var(--u))`;
const COLOR_ODD = 0x909090, COLOR_NONE = 0x606060;
let styled = false;
function ensureStyle() {
  if (styled || typeof document === "undefined") return;
  styled = true;
  const s = document.createElement("style");
  s.textContent = `.stat-sprite{position:absolute;background:url('${SPRITE}') no-repeat;image-rendering:pixelated;pointer-events:auto}
.stat-icon{position:absolute;overflow:hidden}.stat-icon .vanilla-item-icon{position:absolute;left:0;top:0;width:100%;height:100%}`;
  document.head.append(s);
}
const sprite = (g, parent, x, y, u, v, pressed = false) => {
  const e = g.image("stat-sprite", x, y, 18, 18, parent);
  e.style.backgroundPosition = `${px(-u)} ${px(-v)}`;
  e.style.backgroundSize = `${px(128)} ${px(128)}`;
  return e;
};
const live = (original) => ORIGINAL_ITEMS[original] ?? original;
const COLUMNS = {
  blocks: { ids: () => BLOCK_LIST, stat: [craftStat, useStat, mineStat], u: [18, 36, 54], tips: ["stat.crafted", "stat.used", "stat.mined"] },
  items: { ids: () => ITEM_LIST, stat: [breakStat, craftStat, useStat], u: [72, 18, 36], tips: ["stat.depleted", "stat.crafted", "stat.used"] },
};
const DX = [115, 165, 215], ARROW = [79, 129, 179], CLICK = [[79, 115], [129, 165], [179, 215]];

// GuiStats.drawScreen before the stats arrive: drawDefaultBackground, multiplayer.downloadingStats centred at h / 2 and
// LOADING_FRAMES[(getSystemTime() / 150) % 7] a line and a half lower (h / 2 + fontHeight * 2), both white. No buttons yet.
export const LOADING_FRAMES = Object.freeze(["oooooo", "Oooooo", "oOoooo", "ooOooo", "oooOoo", "ooooOo", "oooooO"]);
export const loadingFrame = (ms) => LOADING_FRAMES[Math.floor(ms / 150) % LOADING_FRAMES.length];
function drawLoading(g, w, h, rebuild, loading) {
  const c = Math.trunc(w / 2), y = Math.trunc(h / 2), fh = 9;
  g.text(EN_US["multiplayer.downloadingStats"], c, y, { center: true, color: 0xffffff });
  const spin = g.text(loadingFrame(Date.now()), c, y + fh * 2, { center: true, color: 0xffffff });
  const timer = setInterval(() => {
    if (!spin.el.isConnected) { clearInterval(timer); return; }
    if (!loading()) { clearInterval(timer); rebuild(); return; }
    spin.set(loadingFrame(Date.now()));
  }, 50);
}
// ctx: { stats, icon(id, damage), back, show, tab }. The tab is kept across the re-init a tab button causes.
// `loading()` (a multiplayer tab): true until the server's numbers arrived (bej.field_146543_v, set by
// func_146509_g on S37PacketStatistics); the screen then shows only the download line and spinner and rebuilds once they are in.
export function statsScreen({ stats, icon, back, show, tab = "general", loading = () => false }) {
  let sort = { column: -1, direction: 0 }, scroll = 0;
  const self = {
    id: "stats",
    escape: back,
    init(g, w, h) {
      ensureStyle();
      if (loading()) { drawLoading(g, w, h, () => show(self), loading); return; }
      const c = Math.trunc(w / 2), top = 32, bottom = h - 64, spec = { top, bottom, width: 220, scrollbarX: c + 124 };
      const rowsOf = {
        blocks: () => stats.blocks(), items: () => stats.items(), mobs: () => stats.mobs(),
      };
      const empty = { blocks: !stats.blocks().length, items: !stats.items().length, mobs: !stats.mobs().length };
      if (tab !== "general" && empty[tab]) tab = "general";
      if (tab === "general") {
        g.slotList({ ...spec, slotHeight: 10 }, {
          count: GENERAL.length, scroll,
          entry(i, y, parent, x) {
            const color = i % 2 === 0 ? 0xffffff : COLOR_ODD, value = formatStat(GENERAL[i].id, stats.get(GENERAL[i].id));
            g.text(lang(GENERAL[i].id), x + 2, y + 1, { color, parent });
            g.text(value, x + 2 + 213, y + 1, { color, right: true, parent });
          },
        });
      } else if (tab === "mobs") {
        const rows = rowsOf.mobs(), fh = 9;
        g.slotList({ ...spec, slotHeight: fh * 4 }, {
          count: rows.length, scroll,
          entry(i, y, parent, x) {
            const e = rows[i], name = lang(`entity.${e.name}.name`), kills = stats.get(e.kills), by = stats.get(e.killedBy);
            g.text(name, x + 2 - 10, y + 1, { parent });
            const fmt = (s, ...a) => a.reduce((t, v) => t.replace(/%[ds]/, v), s);
            g.text(kills ? fmt(lang("stat.entityKills"), kills, name) : fmt(lang("stat.entityKills.none"), name), x + 2, y + 1 + fh, { color: kills ? COLOR_ODD : COLOR_NONE, parent });
            g.text(by ? fmt(lang("stat.entityKilledBy"), name, by) : fmt(lang("stat.entityKilledBy.none"), name), x + 2, y + 1 + fh * 2, { color: by ? COLOR_ODD : COLOR_NONE, parent });
          },
        });
      } else {
        const kind = COLUMNS[tab], valueOf = (id, col) => { const s = kind.stat[col](id); return s ? stats.get(s) : null; };
        const rows = sortRows(rowsOf[tab](), sort, valueOf);
        g.slotList({ ...spec, slotHeight: 20, headerPadding: 20 }, {
          count: rows.length, scroll,
          entry(i, y, parent, x) {
            if (i === 0) {
              // The header scrolls with the list: each column's icon button, and the arrow on the sorted column.
              for (let col = 0; col < 3; col++) {
                const pressed = sort.column === col;
                const base = sprite(g, parent, x + DX[col] - 18, 1, 0, pressed ? 0 : 18);
                base.title = lang(kind.tips[col]);
                const icon = sprite(g, parent, x + DX[col] - 18 + (pressed ? 1 : 0), 1 + (pressed ? 1 : 0), kind.u[col], 18);
                icon.style.pointerEvents = "none";
                if (pressed) sprite(g, parent, x + ARROW[col], 1, sort.direction === 1 ? 36 : 18, 0).style.pointerEvents = "none";
                base.addEventListener("pointerdown", () => { sort = nextSort(sort, col); scroll = 0; show(self); });
              }
            }
            const id = rows[i], rowY = y, color = i % 2 === 0 ? 0xffffff : COLOR_ODD;
            sprite(g, parent, x + 40 + 1, rowY + 1, 0, 0);
            const cell = g.image("stat-icon", x + 40 + 2, rowY + 2, 16, 16, parent);
            cell.innerHTML = icon(live(id), 0);
            cell.title = nativeName(id) ?? `item ${id}`;
            for (let col = 0; col < 3; col++) {
              const s = kind.stat[col](id);
              g.text(s ? formatStat(s, stats.get(s)) : "-", x + DX[col], rowY + 5, { color, right: true, parent });
            }
          },
        });
      }
      g.text(lang("gui.stats"), c, 20, { center: true });
      g.button({ x: c + 4, y: h - 28, w: 150, h: 20 }, lang("gui.done"), () => back());
      const tabs = [["general", "stat.generalButton", -160], ["blocks", "stat.blocksButton", -80], ["items", "stat.itemsButton", 0], ["mobs", "stat.mobsButton", 80]];
      for (const [name, key, dx] of tabs) {
        g.button({ x: c + dx, y: h - 52, w: 80, h: 20 }, lang(key), () => { tab = name; sort = { column: -1, direction: 0 }; scroll = 0; show(self); },
          { enabled: name === "general" || !empty[name] });
      }
    },
  };
  return self;
}
