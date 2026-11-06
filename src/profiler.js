// Profiler (qi) and the /debug dump of CommandDebug (ak) from Minecraft Java 1.7.10. getProfilingData is replayed against the
// "profiler" records of public/research/commands-b13-reference.json (tools/probes/CommandsProbe.java); the dump layout, the
// witty comments and the file name pattern are read from ak with javap (tools/verify-commands-b13.mjs). The port has no
// integrated server, so the sections are the browser's own tick phases (main.js), not MinecraftServer's.
export const WITTY_COMMENTS = Object.freeze(["Shiny numbers!", "Am I not running fast enough? :(", "I'm working as hard as I can!", "Will I ever be good enough for you? :(", "Speedy. Zoooooom!", "Hello world", "40% better than a crash report.", "Now with extra numbers", "Now with less numbers", "Now with the same numbers", "You should add flames to things, it makes them go faster!", "Do you feel the need for... optimization?", "*cracks redstone whip*", "Maybe if you treated it better then it'll have more motivation to work faster! Poor server."]);
export const WITTY_FALLBACK = "Witty comment unavailable :(";

export class Profiler {
  constructor(now = () => Math.round(performance.now() * 1e6)) {
    this.now = now; // System.nanoTime
    this.enabled = false;
    this.clear();
  }
  // clearProfiling
  clear() { this.map = new Map(); this.section = ""; this.sections = []; this.stamps = []; }
  // startSection: "a.b.c" paths; nothing while disabled.
  start(name) {
    if (!this.enabled) return;
    if (this.section.length > 0) this.section += ".";
    this.section += name;
    this.sections.push(this.section);
    this.stamps.push(this.now());
  }
  // endSection: the elapsed nanoseconds add to the path (the 100 ms "Something's taking too long!" warning is the log's).
  end() {
    if (!this.enabled || !this.sections.length) return;
    const dt = this.now() - this.stamps.pop();
    this.sections.pop();
    this.map.set(this.section, (this.map.get(this.section) ?? 0) + dt);
    this.section = this.sections.length ? this.sections[this.sections.length - 1] : "";
  }
  endStart(name) { this.end(); this.start(name); }
  // getProfilingData: [name, use %, total %] rows; the first row is the section itself, the rest sorted by Result.compareTo.
  // Every stored time decays to v * 999 / 1000 afterwards (long division).
  results(name) {
    if (!this.enabled) return null;
    const self = this.map.has(name) ? this.map.get(name) : -1;
    let total = this.map.has("root") ? this.map.get("root") : 0;
    const prefix = name.length > 0 ? name + "." : name;
    const child = (k) => k.length > prefix.length && k.startsWith(prefix) && k.indexOf(".", prefix.length + 1) < 0;
    let sum = 0;
    for (const [k, v] of this.map) if (child(k)) sum += v;
    const f = Math.fround(sum);
    if (sum < self) sum = self;
    if (total < sum) total = sum;
    const list = [];
    for (const [k, v] of this.map) if (child(k)) list.push({ name: k.slice(prefix.length), use: (v * 100) / sum, total: (v * 100) / total });
    for (const [k, v] of this.map) this.map.set(k, Math.trunc((v * 999) / 1000));
    if (Math.fround(sum) > f) {
      const rest = Math.fround(Math.fround(sum) - f);
      list.push({ name: "unspecified", use: (rest * 100) / sum, total: (rest * 100) / total });
    }
    // Result.compareTo: higher use first, then the names in reverse order.
    list.sort((a, b) => (b.use < a.use ? -1 : b.use > a.use ? 1 : b.name < a.name ? -1 : b.name > a.name ? 1 : 0));
    list.unshift({ name, use: 100, total: (sum * 100) / total });
    return list;
  }
}

// String.format("%.2f", d) (a Float argument is widened to double first): java.util.Formatter rounds the shortest decimal digits
// of the double (FormattedFloatingDecimal) HALF_UP, so 0.125 prints 0.13 and 1.005 prints 1.01, unlike toFixed.
export function format2(d) { return javaFixed(d, 2); }
export function javaFixed(d, digits) {
  if (Number.isNaN(d)) return "NaN";
  if (!Number.isFinite(d)) return d > 0 ? "Infinity" : "-Infinity";
  const neg = d < 0 || Object.is(d, -0);
  const [i, frac = ""] = plainDecimal(Math.abs(d)).split(".");
  const padded = frac.padEnd(digits + 1, "0");
  let keep = BigInt(i + padded.slice(0, digits));
  if (Number(padded[digits]) >= 5) keep += 1n;
  const str = keep.toString().padStart(digits + 1, "0");
  return (neg ? "-" : "") + (digits ? str.slice(0, -digits) + "." + str.slice(-digits) : str);
}
// The shortest round-trip digits of a non-negative double written without an exponent.
function plainDecimal(a) {
  const s = String(a), e = s.indexOf("e");
  if (e < 0) return s;
  const [m, x] = [s.slice(0, e), Number(s.slice(e + 1))];
  const digits = m.replace(".", ""), point = (m.indexOf(".") < 0 ? m.length : m.indexOf(".")) + x;
  if (point <= 0) return "0." + "0".repeat(-point) + digits;
  if (point >= digits.length) return digits + "0".repeat(point - digits.length);
  return digits.slice(0, point) + "." + digits.slice(point);
}

// CommandDebug.func_147202_a: the tree below `name`, a section with fewer than three rows (itself, one child, unspecified)
// prints nothing; "unspecified" is not descended into.
function dumpSection(profiler, depth, name, out) {
  const list = profiler.results(name);
  if (!list || list.length < 3) return;
  for (let i = 1; i < list.length; i++) {
    const r = list[i];
    out.push(`[${String(depth).padStart(2, "0")}] ${" ".repeat(depth)}${r.name} - ${format2(r.use)}%/${format2(r.total)}%\n`);
    if (r.name !== "unspecified") dumpSection(profiler, depth + 1, name + "." + r.name, out);
  }
}
// CommandDebug.func_147203_a: the profile-results file text. `pick` stands in for System.nanoTime() % length.
export function profileResults(profiler, ms, ticks, pick = Math.floor(Math.random() * WITTY_COMMENTS.length)) {
  const out = ["---- Minecraft Profiler Results ----\n", "// ", WITTY_COMMENTS[pick] ?? WITTY_FALLBACK, "\n\n"];
  out.push("Time span: " + ms + " ms\n", "Tick span: " + ticks + " ticks\n");
  out.push("// This is approximately " + format2(Math.fround(ticks / Math.fround(ms / 1000))) + " ticks per second. It should be 20 ticks per second\n\n");
  out.push("--- BEGIN PROFILE DUMP ---\n\n");
  dumpSection(profiler, 0, "root", out);
  out.push("--- END PROFILE DUMP ---\n\n");
  return out.join("");
}
// new SimpleDateFormat("yyyy-MM-dd_HH.mm.ss") under debug/.
export function profileFileName(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `profile-results-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}.txt`;
}
