// Records unchanged 1.7.10 FontRenderer (bbu) behaviour for the styled-text and bidirectional work; see probes/FontStyleProbe.java.
//   draw: every primitive drawString/drawStringWithShadow issues (glyph quads, underline and strikethrough bars), both unicode flags
//   bidi: FontRenderer.bidiReorder (ICU4J ArabicShaping LETTERS_SHAPE, then Bidi DEFAULT_RTL with DO_MIRRORING) of probe strings
// Requires the pinned client JAR, a JDK and the usual probe libraries. Writes public/research/font-style-reference.json,
// replayed by src/font-style.test.js.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runProbe } from "./font-style-probe.mjs";

const hex = (s) => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(4, "0")).join(" ");
let seed = 20271108;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const range = (a, b) => { let t = ""; for (let c = a; c <= b; c++) t += String.fromCharCode(c); return t; };
const sets = {
  latin: "abc XYZ", digits: "0123", arabic: "ابلمنتيءآأإةهوك", tash: "َُّ", adig: "١٢", hebrew: "אבג", punct: "()[]<>,.:;!-+%$/ \"'",
  tat: "ـ‍", ctl: "‪‫‬‭‮‎‏", nsm: "̀", sect: "§c§l", pres: range(0xfe70, 0xfefc), ablock: range(0x600, 0x6ff), hblock: range(0x590, 0x5ff),
  misc: "  　­​‌²0¹٫٬−€ก中", fbp: range(0xfb1d, 0xfb4f) + range(0xfb50, 0xfbff),
};
const mixes = [
  ["latin", "arabic", "punct", "hebrew", "digits", "adig", "tash", "tat", "ctl", "nsm"],
  ["latin", "arabic", "pres", "ablock", "hblock", "misc", "fbp", "punct"],
  ["arabic", "arabic", "arabic", "tash", "punct", "adig", "latin", "sect"],
];
const strings = ["", "Hello", "שלום עולם", "مرحبا بالعالم", "اللغة العربية (ar_SA)", "abc אבג 123 def", "لا لآ لأ لإ", "ـبـ", "§nمرحبا§r abc", "(a) ב (c)", "a<b ג>d"];
for (let k = 0; k < 400; k++) {
  const mix = mixes[k % mixes.length], len = 1 + Math.floor(rnd() * 12);
  let s = "";
  for (let i = 0; i < len; i++) { const set = sets[mix[Math.floor(rnd() * mix.length)]]; s += set[Math.floor(rnd() * set.length)]; }
  strings.push(s);
}
// paragraph separators: only inputs with a strong character in the first paragraph (see Follow-ups on strong-less paragraphs)
strings.push("א\nב", "a\nא", "א\n(b)", "אבג\r\nabc", "a ב", "ב\u0085a", "(ב\nc)");
const draw = (await runProbe("draw")).trim().split("\n").map((l) => JSON.parse(l));
const bidiOut = (await runProbe("bidi", strings.map(hex).join("\n") + "\n")).split("\n");
const bidi = strings.map((s, i) => [hex(s), bidiOut[i].trim()]);
const out = fileURLToPath(new URL("../public/research/font-style-reference.json", import.meta.url));
await writeFile(out, JSON.stringify({
  source: "unchanged 1.7.10 client jar (sha1 e80d9b3b...), FontRenderer bbu; ICU4J 51.2 (icu4j-core-mojang) for the bidirectional reorder",
  note: "draw rows: [x, y] pen start, ret is the int drawString returns, prims are the Tessellator vertices (float32) per quad in call order",
  draw, bidi,
}));
console.log("draw rows", draw.reduce((n, d) => n + d.rows.length, 0), "bidi strings", bidi.length, "->", out);
