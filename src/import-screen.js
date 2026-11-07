// Browser addition (no 1.7.10 original): the screen behind the Select World "Import" button, in the style of a GuiScreen with
// 200x20 buttons. Two sources: a Blockworld export (.blockworld.json) and a Java 1.7.10 save folder (save-folder-import.js).
const btn = (x, y, w = 200, h = 20) => ({ x, y, w, h });
export const importLayout = (w, h) => {
  const c = Math.trunc(w / 2), q = Math.trunc(h / 4);
  return { title: [c, 20], info: [[c, q + 20], [c, q + 32], [c, q + 44]], buttons: { file: btn(c - 100, q + 60), folder: btn(c - 100, q + 84), cancel: btn(c - 100, q + 120) } };
};
export const IMPORT_INFO = [
  "A Java save folder is read in this tab: level.dat, the player, stats and every",
  "chunk of region/, DIM-1 and DIM1 (loaded as saved; missing chunks come from the",
  "seed). Nothing is uploaded.",
];
export function importScreen({ ctx, parent, show }) {
  return {
    id: "import-world",
    escape: () => show(parent),
    init(g, w, h) {
      const L = importLayout(w, h);
      g.text("Import World", ...L.title, { center: true });
      IMPORT_INFO.forEach((line, i) => g.text(line, ...L.info[i], { center: true, color: 0xa0a0a0 }));
      if (ctx.importStatus) g.text(ctx.importStatus, L.title[0], L.buttons.cancel.y + 28, { center: true, color: 0xffff55 });
      g.button(L.buttons.file, "Blockworld export (.json)...", () => { show(parent); ctx.importWorld(); });
      g.button(L.buttons.folder, "Java save folder...", () => { show(parent); ctx.importFolder?.(); });
      g.button(L.buttons.cancel, "Cancel", () => { if (ctx.importCancel) ctx.importCancel(); else show(parent); });
    },
  };
}
