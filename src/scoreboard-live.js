// The scoreboard's live criteria for the local player and its HUD: EntityPlayerMP.addStat (+1 on the stat's criteria per call, any
// amount; achievements every time they are triggered), onDeath (deathCount), EntityPlayer.onKillEntity (totalKillCount, plus
// playerKillCount for a player victim), EntityPlayerMP.onUpdate (health = ceil(health + absorption), only when that sum changed;
// the first value starts at -1e8, so a new health objective has no score until the health changes), and the GuiIngame sidebar.
import { STAT } from "./stats.js";
import { sidebarLayout } from "./scoreboard.js";
import { textHtml } from "./menu-ui.js";

export class ScoreboardLive {
  constructor({ scoreboard, stats, achievements, name = () => "Player" }) {
    this.board = scoreboard;
    this.name = name;
    this.lastHealth = -99999999; // EntityPlayerMP.field_130068_bO
    if (stats) stats.onIncrement = (id) => this.stat(id);
    if (achievements) achievements.onTrigger = (id) => this.board.increment(this.name(), "achievement." + id);
  }
  stat(id) {
    const b = this.board, p = this.name();
    if (id === STAT.deaths) b.increment(p, "deathCount");
    if (id === STAT.mobKills || id === STAT.playerKills) b.increment(p, "totalKillCount");
    if (id === STAT.playerKills) b.increment(p, "playerKillCount");
    b.increment(p, id);
  }
  // Once per tick with the player's float health and absorption.
  tick(health, absorption = 0) {
    const sum = Math.fround(Math.fround(health) + Math.fround(absorption));
    if (sum === this.lastHealth) return;
    this.lastHealth = sum;
    this.board.setCriteria(this.name(), "health", Math.ceil(sum)); // ScoreHealthCriteria: MathHelper.ceiling_float_int
  }
  respawn() { this.lastHealth = -99999999; } // a new EntityPlayerMP
}

const STYLE = `
#scoreboard-sidebar{position:fixed;left:0;top:0;width:100%;height:100%;z-index:8;pointer-events:none;display:none;font-size:calc(8*var(--u))}
#scoreboard-sidebar.on{display:block}
#scoreboard-sidebar>div{position:absolute;white-space:pre;line-height:calc(9*var(--u));height:calc(9*var(--u))}
#scoreboard-sidebar .sb-rect{line-height:0}
`;

// The sidebar (display slot 1) as a DOM overlay in GUI pixels (--u), redrawn only when the scoreboard or the screen size changes.
export class SidebarUi {
  constructor(doc) {
    const style = doc.createElement("style");
    style.textContent = STYLE;
    this.box = doc.createElement("div");
    this.box.id = "scoreboard-sidebar";
    this.box.setAttribute("aria-label", "Scoreboard");
    doc.head.append(style);
    doc.body.append(this.box);
    this.key = "";
  }
  // width / height: the scaled screen size in GUI pixels; fontWidth: FontRenderer.getStringWidth.
  update(board, visible, width, height, fontWidth) {
    if (this.board !== board) { this.board = board; this.key = null; } // b64 mpscoreboard: the multiplayer replica and the world's board alternate
    const obj = visible ? board.slot(1) : null;
    const key = obj ? `${board.revision}|${width}|${height}` : "";
    if (key === this.key) return;
    this.key = key;
    const layout = obj && sidebarLayout(board, obj, width, height, fontWidth);
    if (!layout) { this.box.classList.remove("on"); this.box.innerHTML = ""; return; }
    const px = (n) => `calc(${n}*var(--u))`, rgba = (c) => `rgba(0,0,0,${((c >>> 24) / 255).toFixed(4)})`;
    let html = "";
    for (const r of layout.rects) html += `<div class="sb-rect" style="left:${px(r.x0)};top:${px(r.y0)};width:${px(r.x1 - r.x0)};height:${px(r.y1 - r.y0)};background:${rgba(r.color)}"></div>`;
    for (const r of layout.rows) {
      html += `<div style="left:${px(r.nameX)};top:${px(r.y)}">${textHtml(r.name, 0xffffff)}</div>`;
      html += `<div style="left:${px(r.scoreX)};top:${px(r.y)}">${textHtml(r.score, 0xffffff)}</div>`;
    }
    html += `<div style="left:${px(layout.title.x)};top:${px(layout.title.y)}">${textHtml(layout.title.text, 0xffffff)}</div>`;
    this.box.innerHTML = html;
    this.box.classList.add("on");
  }
}
