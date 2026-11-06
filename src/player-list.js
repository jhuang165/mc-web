// The tab player list of 1.7.10: GuiIngame.renderGameOverlay (bbv) draws it while key.playerlist (Tab) is held. Layout,
// colours and the ping icon follow the javap output of bbv.a(float, boolean, int, int) (see public/research/chat-options.md).
import { textHtml } from "./menu-ui.js";

// IntegratedPlayerList (the integrated server's ServerConfigurationManager) sets maxPlayers = 8; the join packet carries it to
// NetHandlerPlayClient.field_147304_c (bjb.c), which is the number of slots the overlay lays out.
export const INTEGRATED_MAX_PLAYERS = 8;

// GuiIngame: `if (keyPlayerList.getIsKeyPressed() && (!mc.isIntegratedServerRunning() || playerInfoList.size() > 1 || scoreObjective != null))`.
// A one-player integrated server therefore never shows the list. This build has only the local player, so `lanShared` (the world
// is Open to LAN) stands in for the second player: a documented deviation that lets the overlay be seen.
export function playerListVisible({ integrated = true, players = 1, hasObjective = false, lanShared = false } = {}) {
  return !integrated || players > 1 || hasObjective || lanShared;
}

// Columns and rows: rows = slots while at most 20, otherwise columns grow until ceil(slots / columns) <= 20; each column is
// min(150, 300 / columns) wide and the block is centred on the scaled screen width at y = 10.
export function playerListLayout(slots, screenWidth) {
  let rows = slots, cols = 1;
  while (rows > 20) { cols++; rows = Math.trunc((slots + cols - 1) / cols); }
  let colWidth = Math.trunc(300 / cols);
  if (colWidth > 150) colWidth = 150;
  const x0 = Math.trunc((screenWidth - cols * colWidth) / 2), y0 = 10;
  const cells = [];
  for (let i = 0; i < slots; i++) cells.push({ x: x0 + (i % cols) * colWidth, y: y0 + Math.trunc(i / cols) * 9 });
  // Backdrop fill(x0 - 1, y0 - 1, x0 + colWidth * cols, y0 + 9 * rows, 0x80000000); each cell fill(x, y, x + colWidth - 1, y + 8, 0x20FFFFFF).
  return { cols, rows, colWidth, x0, y0, cells, backdrop: { x: x0 - 1, y: y0 - 1, w: colWidth * cols + 1, h: 9 * rows + 1 } };
}

// The ping bars: latency < 0 draws row 5 (no connection), < 150 row 0, < 300 row 1, < 600 row 2, < 1000 row 3, else row 4; the
// 10 x 8 sprite is at icons.png (0, 176 + 8 * row) and is drawn at (cellX + colWidth - 12, cellY).
export function pingRow(ping) {
  return ping < 0 ? 5 : ping < 150 ? 0 : ping < 300 ? 1 : ping < 600 ? 2 : ping < 1000 ? 3 : 4;
}

const STYLE = `
#player-list{position:fixed;left:0;top:0;width:100%;height:100%;z-index:9;pointer-events:none;display:none;font-size:calc(8*var(--u))}
#player-list.on{display:block}
#player-list>div{position:absolute;overflow:hidden;white-space:pre;line-height:calc(9*var(--u))}
#player-list .pl-back{background:rgba(0,0,0,.502)}
#player-list .pl-cell{background:rgba(255,255,255,.1255);height:calc(8*var(--u))}
#player-list .pl-name{height:calc(9*var(--u))}
#player-list .pl-name span{text-shadow:var(--u) var(--u) 0 var(--sh,#3f3f3f)}
#player-list .pl-ping{width:calc(10*var(--u));height:calc(8*var(--u));background:url('/media/1.7.10/gui/icons.png') no-repeat;background-size:calc(256*var(--u)) calc(256*var(--u));image-rendering:pixelated}
`;

export class PlayerListUi {
  constructor(doc) {
    this.doc = doc;
    const style = doc.createElement("style");
    style.textContent = STYLE;
    this.box = doc.createElement("div");
    this.box.id = "player-list";
    this.box.setAttribute("role", "status");
    doc.head.append(style);
    doc.body.append(this.box);
  }
  // players: [{ name, ping }]; screenWidth is the window width in GUI pixels.
  show(players, screenWidth, slots = INTEGRATED_MAX_PLAYERS) {
    const L = playerListLayout(slots, screenWidth);
    const px = (n) => `calc(${n}*var(--u))`;
    let html = `<div class="pl-back" style="left:${px(L.backdrop.x)};top:${px(L.backdrop.y)};width:${px(L.backdrop.w)};height:${px(L.backdrop.h)}"></div>`;
    L.cells.forEach((c, i) => {
      html += `<div class="pl-cell" style="left:${px(c.x)};top:${px(c.y)};width:${px(L.colWidth - 1)}"></div>`;
      const p = players[i];
      if (!p) return;
      html += `<div class="pl-name" style="left:${px(c.x)};top:${px(c.y)};width:${px(L.colWidth - 13)}">${textHtml(p.name)}</div>`;
      html += `<div class="pl-ping" style="left:${px(c.x + L.colWidth - 12)};top:${px(c.y)};background-position:0 ${px(-(176 + 8 * pingRow(p.ping)))}"></div>`;
    });
    this.box.innerHTML = html;
    this.box.classList.add("on");
  }
  hide() { this.box.classList.remove("on"); }
  get shown() { return this.box.classList.contains("on"); }
}
