// Seeded fuzz of src/bidi.js against the unchanged 1.7.10 FontRenderer bidiReorder (ICU4J 51.2). Usage: node tools/fuzz-bidi.mjs [count] [seed] [heavy]
// Prints the number of differences
import { runProbe } from "./font-style-probe.mjs";
import { bidiReorder } from "../src/bidi.js";
const hex = (s) => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(4, "0")).join(" ");
const count = +process.argv[2] || 40000; let seed = +process.argv[3] || 1;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const sets = ["abcXYZ ", "012", "ابلمنتءآ", "َُّ", "١٢", "אבג", "()[]<>,.:;!-+%$/ \"'", "\n\n\r\u0085\u001c", "§c§l§k", "ـ‍", "²€٫", "̀", "‎‏", "‪‫‬‭‮", "‪‫‬‭‮", "­​‌\u0001\u007f", "\n", " "];
// third argument "heavy": a corpus dominated by separators, embedding codes, BN and neutrals (the multi-paragraph cases)
const heavy = process.argv[4] === "heavy";
if (heavy) sets.splice(0, sets.length, "a", "b", "א", "ب", "12", "١", "(", " ", "\n\r\u0085\u001c\u2029", "‪‫‬‭‮", "‪‫‬‭‮", "‪‫‬‭‮", "\u00ad\u200d\u0001", "̀", "‎‏", "§c");
const strings = [];
for (let k = 0; k < count; k++) {
  const len = 1 + Math.floor(rnd() * 14); let s = "";
  for (let i = 0; i < len; i++) { const set = sets[Math.floor(rnd() * sets.length)]; s += set[Math.floor(rnd() * set.length)]; }
  strings.push(s);
}
const out = (await runProbe("bidi", strings.map(hex).join("\n") + "\n")).split("\n");
const special = /[\u202a-\u202e\u00ad\u200b-\u200d\u0001\u007f]/;
let bad = 0, badPlain = 0; const shown = [];
strings.forEach((s, i) => { if (hex(bidiReorder(s)) !== out[i].trim()) { bad++; if (!special.test(s)) badPlain++; if (shown.length < 15) shown.push(hex(s)); } });
console.log("strings", count, "differences", bad, "(without embedding codes or BN:", badPlain + ")");
for (const h of shown) console.log(h);
export { strings };
