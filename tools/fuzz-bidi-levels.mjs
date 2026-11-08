// Shows ICU4J's direction/paragraph levels/per-character levels (probe "levels") next to src/bidi.js for the given strings (hex code units, one
// argument per string), as printed by tools/fuzz-bidi.mjs.
import { runProbe } from "./font-style-probe.mjs";
import { bidiReorder, resolveLevels, shapeArabic } from "../src/bidi.js";
const hex = (s) => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(4, "0")).join(" ");
const unhex = (h) => h.split(" ").map((x) => String.fromCharCode(parseInt(x, 16))).join("");
const list = process.argv.slice(2).map(unhex);
const lv = (await runProbe("levels", list.map(hex).join("\n") + "\n")).trim().split("\n");
const ro = (await runProbe("bidi", list.map(hex).join("\n") + "\n")).split("\n");
list.forEach((s, i) => {
  console.log(hex(s));
  console.log("  icu ", lv[i], "|", ro[i].trim());
  console.log("  mine l" + resolveLevels(shapeArabic(s)).levels.join(",") + ",", "|", hex(bidiReorder(s)));
});
