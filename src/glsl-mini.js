// A small typed interpreter for the straight-line GLSL ES 1.00 subset the port's hand-written shaders use (tests only): global uniform /
// attribute / varying declarations, functions, local declarations, assignments, returns, the ternary and float / vec / mat4 arithmetic with
// GLSL ES 1.00's rules (no implicit int -> float, matching vector sizes, scalar-vector broadcasting). It refuses what a conservative
// WebGL 1 shader should not contain: loops, if/else, precision statements, #version, bit operators, %, GLSL ES 3.00 keywords and texture().
// It is not a GPU compiler: it checks structure and types and evaluates in double precision.

const TYPES = new Set(["float", "int", "bool", "vec2", "vec3", "vec4", "mat4", "sampler2D", "void"]);
const SIZE = { float: 1, vec2: 2, vec3: 3, vec4: 4 };
const VEC = { 1: "float", 2: "vec2", 3: "vec3", 4: "vec4" };
const FORBIDDEN = new Set(["for", "while", "do", "if", "else", "switch", "precision", "in", "out", "inout", "layout", "uint", "texture", "discard", "highp", "mediump", "lowp", "uvec2", "uvec3", "uvec4", "ivec2", "ivec3", "ivec4"]);
const SWIZZLE = ["xyzw", "rgba", "stpq"];

export function tokenize(src) {
  if (/#/.test(src)) throw new Error("preprocessor directives are not allowed");
  const re = /\s+|\/\/[^\n]*|(\d+\.\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+)|(\d+)|([A-Za-z_]\w*)|(&&|\|\||==|!=|<=|>=|\+=|-=|\*=|\/=|\+\+|--|<<|>>|[-+*/<>=?:;,.(){}\[\]!%&|^~])/y;
  const out = [];
  let m;
  re.lastIndex = 0;
  while (re.lastIndex < src.length) {
    const at = re.lastIndex;
    if (!(m = re.exec(src))) throw new Error(`bad character at ${at}: ${JSON.stringify(src.slice(at, at + 10))}`);
    if (m[1]) out.push({ k: "float", v: Number(m[1]) });
    else if (m[2]) out.push({ k: "int", v: Number(m[2]) });
    else if (m[3]) { if (FORBIDDEN.has(m[3])) throw new Error(`"${m[3]}" is not allowed`); out.push({ k: "id", v: m[3] }); }
    else if (m[4]) { if (["<<", ">>", "%", "&", "|", "^", "~", "++", "--", "+=", "-=", "*=", "/="].includes(m[4])) throw new Error(`operator ${m[4]} is not allowed`); out.push({ k: "op", v: m[4] }); }
  }
  return out;
}

const fail = (msg) => { throw new Error(msg); };
const val = (t, v) => ({ t, v });

function binary(op, a, b) {
  if (["<", ">", "<=", ">="].includes(op)) {
    if (a.t !== b.t || (a.t !== "float" && a.t !== "int")) fail(`${a.t} ${op} ${b.t}`);
    return val("bool", op === "<" ? a.v < b.v : op === ">" ? a.v > b.v : op === "<=" ? a.v <= b.v : a.v >= b.v);
  }
  if (op === "==" || op === "!=") { if (a.t !== b.t || SIZE[a.t] !== 1) fail(`${a.t} ${op} ${b.t}`); return val("bool", (a.v === b.v) === (op === "==")); }
  if (op === "&&" || op === "||") { if (a.t !== "bool" || b.t !== "bool") fail(`${a.t} ${op} ${b.t}`); return val("bool", op === "&&" ? a.v && b.v : a.v || b.v); }
  const f = { "+": (x, y) => x + y, "-": (x, y) => x - y, "*": (x, y) => x * y, "/": (x, y) => x / y }[op];
  if (a.t === "mat4" || b.t === "mat4") {
    if (op !== "*" || a.t !== "mat4" || (b.t !== "vec4" && b.t !== "mat4")) fail(`${a.t} ${op} ${b.t}`);
    const col = (v) => [0, 1, 2, 3].map((r) => [0, 1, 2, 3].reduce((s, c) => s + a.v[c * 4 + r] * v[c], 0));
    return b.t === "vec4" ? val("vec4", col(b.v)) : val("mat4", [0, 1, 2, 3].flatMap((c) => col(b.v.slice(c * 4, c * 4 + 4))));
  }
  if (a.t === "int" && b.t === "int") return val("int", Math.trunc(f(a.v, b.v)));
  if (a.t === "int" || b.t === "int" || a.t === "bool" || b.t === "bool") fail(`no implicit conversion: ${a.t} ${op} ${b.t}`);
  if (a.t === b.t) return SIZE[a.t] === 1 ? val("float", f(a.v, b.v)) : val(a.t, a.v.map((x, i) => f(x, b.v[i])));
  if (a.t === "float") return val(b.t, b.v.map((y) => f(a.v, y)));
  if (b.t === "float") return val(a.t, a.v.map((x) => f(x, b.v)));
  return fail(`${a.t} ${op} ${b.t}`);
}

const comps = (x) => (SIZE[x.t] === 1 ? [x.v] : x.t in SIZE ? x.v : fail(`not a float type: ${x.t}`));
const gen = (name, ...a) => {
  const t = a[0].t;
  if (!(t in SIZE)) fail(`${name}(${t})`);
  a.slice(1).forEach((x) => { if (x.t !== t && x.t !== "float") fail(`${name}: ${t} with ${x.t}`); });
  return t;
};
const map = (t, fn, ...a) => { const n = SIZE[t], at = (x, i) => (SIZE[x.t] === 1 ? x.v : x.v[i]); const r = Array.from({ length: n }, (_, i) => fn(...a.map((x) => at(x, i)))); return n === 1 ? val("float", r[0]) : val(t, r); };
const BUILTINS = {
  floor: (x) => map(gen("floor", x), Math.floor, x),
  abs: (x) => map(gen("abs", x), Math.abs, x),
  exp: (x) => map(gen("exp", x), Math.exp, x),
  sqrt: (x) => map(gen("sqrt", x), Math.sqrt, x),
  min: (x, y) => map(gen("min", x, y), Math.min, x, y),
  max: (x, y) => map(gen("max", x, y), Math.max, x, y),
  clamp: (x, lo, hi) => map(gen("clamp", x, lo, hi), (v, l, h) => Math.min(Math.max(v, l), h), x, lo, hi),
  mix: (x, y, a) => { if (x.t !== y.t) fail("mix types"); return map(gen("mix", x, y, a), (p, q, s) => p * (1 - s) + q * s, x, y, a); },
  dot: (x, y) => { if (x.t !== y.t) fail("dot types"); return val("float", comps(x).reduce((s, v, i) => s + v * comps(y)[i], 0)); },
  length: (x) => val("float", Math.hypot(...comps(x))),
  texture2D: (s, uv) => { if (s.t !== "sampler2D" || uv.t !== "vec2") fail(`texture2D(${s.t}, ${uv.t})`); const r = s.v(uv.v); if (r.length !== 4) fail("sampler must return 4 values"); return val("vec4", r); },
};
for (const [n, t] of Object.entries({ vec2: 2, vec3: 3, vec4: 4 })) BUILTINS[n] = (...a) => {
  const flat = a.flatMap((x) => (x.t === "int" ? fail(`${n}(int): write a float literal`) : comps(x)));
  if (flat.length === 1) return val(n, Array(t).fill(flat[0]));
  if (flat.length !== t) fail(`${n} with ${flat.length} components`);
  return val(n, flat);
};
BUILTINS.float = (x) => val("float", Number(x.v));

class Parser {
  constructor(tokens) { this.t = tokens; this.i = 0; }
  peek(o = 0) { return this.t[this.i + o]; }
  is(v, o = 0) { const p = this.peek(o); return !!p && (p.k === "op" || p.k === "id") && p.v === v; }
  next() { return this.t[this.i++] ?? fail("unexpected end"); }
  eat(v) { const n = this.next(); if (n.v !== v) fail(`expected ${v}, got ${n.v}`); return n; }
  ident() { const n = this.next(); if (n.k !== "id") fail(`expected a name, got ${n.v}`); return n.v; }
  type() { const n = this.ident(); if (!TYPES.has(n)) fail(`unknown type ${n}`); return n; }
  program() {
    const globals = [], functions = {};
    while (this.i < this.t.length) {
      if (["uniform", "attribute", "varying"].some((q) => this.is(q))) {
        const q = this.next().v, type = this.type();
        do globals.push({ q, type, name: this.ident() }); while (this.is(",") && this.next());
        if (this.is("[")) fail("arrays are not allowed");
        this.eat(";");
      } else {
        const type = this.type(), name = this.ident(), params = [];
        this.eat("(");
        while (!this.is(")")) { params.push({ type: this.type(), name: this.ident() }); if (this.is(",")) this.next(); }
        this.eat(")");
        if (functions[name]) fail(`function ${name} defined twice`);
        functions[name] = { type, params, body: this.block() };
      }
    }
    return { globals, functions };
  }
  block() {
    this.eat("{");
    const out = [];
    while (!this.is("}")) out.push(this.statement());
    this.eat("}");
    return out;
  }
  statement() {
    if (this.is("return")) { this.next(); const e = this.expr(); this.eat(";"); return { s: "return", e }; }
    if (this.peek().k === "id" && TYPES.has(this.peek().v) && this.peek(1)?.k === "id") {
      const type = this.type(), decls = [];
      do { const name = this.ident(); this.eat("="); decls.push({ name, e: this.ternary() }); } while (this.is(",") && this.next());
      this.eat(";");
      return { s: "decl", type, decls };
    }
    if (this.peek().k === "id" && this.is("=", 1)) { const name = this.ident(); this.eat("="); const e = this.expr(); this.eat(";"); return { s: "assign", name, e }; }
    const e = this.expr(); this.eat(";");
    return { s: "expr", e };
  }
  expr() { return this.ternary(); }
  ternary() {
    const c = this.bin(0);
    if (!this.is("?")) return c;
    this.next(); const a = this.ternary(); this.eat(":"); const b = this.ternary();
    return { e: "?", c, a, b };
  }
  bin(level) {
    const LEVELS = [["||"], ["&&"], ["==", "!="], ["<", ">", "<=", ">="], ["+", "-"], ["*", "/"]];
    if (level === LEVELS.length) return this.unary();
    let l = this.bin(level + 1);
    while (this.peek()?.k === "op" && LEVELS[level].includes(this.peek().v)) { const op = this.next().v; l = { e: "bin", op, l, r: this.bin(level + 1) }; }
    return l;
  }
  unary() {
    if (this.is("-")) { this.next(); return { e: "neg", x: this.unary() }; }
    if (this.is("!")) { this.next(); return { e: "not", x: this.unary() }; }
    return this.postfix(this.primary());
  }
  primary() {
    const n = this.next();
    if (n.k === "float" || n.k === "int") return { e: "lit", t: n.k, v: n.v };
    if (n.k === "op" && n.v === "(") { const x = this.expr(); this.eat(")"); return x; }
    if (n.k === "id") {
      if (this.is("(")) {
        this.next(); const args = [];
        while (!this.is(")")) { args.push(this.expr()); if (this.is(",")) this.next(); }
        this.eat(")");
        return { e: "call", name: n.v, args };
      }
      return { e: "var", name: n.v };
    }
    return fail(`unexpected ${n.v}`);
  }
  postfix(x) {
    while (this.is(".") || this.is("[")) {
      if (this.is("[")) fail("indexing is not allowed");
      this.next(); x = { e: "swz", x, sw: this.ident() };
    }
    return x;
  }
}

export function parseShader(src) { return new Parser(tokenize(src)).program(); }

// Runs main() with `inputs` (name -> number, array or sampler function) for every global; returns the written outputs.
export function runShader(src, inputs, builtinGlobals = {}) {
  const prog = parseShader(src), scope0 = new Map();
  const typed = (type, v, name) => {
    if (type === "sampler2D") { if (typeof v !== "function") fail(`${name}: sampler needs a function`); return val(type, v); }
    const n = type === "mat4" ? 16 : SIZE[type];
    if (n === 1 ? typeof v !== "number" : !Array.isArray(v) || v.length !== n) fail(`${name}: ${type} input has the wrong shape`);
    return val(type, n === 1 ? v : [...v]);
  };
  const decl = { ...builtinGlobals };
  for (const g of prog.globals) { if (decl[g.name] || scope0.has(g.name)) fail(`${g.name} declared twice`); scope0.set(g.name, null); decl[g.name] = g.type; }
  for (const [name, type] of Object.entries(decl)) { if (!(name in inputs)) fail(`no input for ${name}`); scope0.set(name, typed(type, inputs[name], name)); }
  const outputs = {}, OUT = { gl_FragColor: "vec4", gl_Position: "vec4" };
  const call = (name, args) => {
    const fn = prog.functions[name];
    if (!fn) { if (!BUILTINS[name]) fail(`unknown function ${name}`); return BUILTINS[name](...args); }
    if (fn.params.length !== args.length) fail(`${name}: ${args.length} arguments`);
    const scope = new Map(scope0);
    fn.params.forEach((p, i) => { if (args[i].t !== p.type) fail(`${name}(${p.name}): ${args[i].t} for ${p.type}`); scope.set(p.name, args[i]); });
    for (const st of fn.body) {
      if (st.s === "return") { const r = ev(st.e, scope); if (r.t !== fn.type) fail(`${name} returns ${r.t}, declared ${fn.type}`); return r; }
      if (st.s === "decl") for (const d of st.decls) { const r = ev(d.e, scope); if (r.t !== st.type) fail(`${d.name}: ${r.t} for ${st.type}`); scope.set(d.name, r); }
      if (st.s === "assign") {
        const r = ev(st.e, scope);
        if (OUT[st.name]) { if (r.t !== OUT[st.name]) fail(`${st.name} = ${r.t}`); outputs[st.name] = r.v; continue; }
        const was = scope.get(st.name);
        if (!was) fail(`assignment to undeclared ${st.name}`);
        if (was.t !== r.t) fail(`${st.name}: ${r.t} for ${was.t}`);
        if (scope0.has(st.name) && scope0.get(st.name) === was && prog.globals.find((g) => g.name === st.name)?.q !== "varying") fail(`assignment to ${st.name}`);
        if (prog.globals.find((g) => g.name === st.name)?.q === "varying") outputs[st.name] = r.v;
        scope.set(st.name, r);
      }
      if (st.s === "expr") ev(st.e, scope);
    }
    if (fn.type !== "void") fail(`${name} has no return`);
    return null;
  };
  const ev = (x, scope) => {
    switch (x.e) {
      case "lit": return val(x.t, x.v);
      case "var": { const v = scope.get(x.name); if (!v) fail(`undeclared ${x.name}`); return v; }
      case "neg": { const v = ev(x.x, scope); if (!(v.t in SIZE) && v.t !== "int") fail(`-${v.t}`); return Array.isArray(v.v) ? val(v.t, v.v.map((c) => -c)) : val(v.t, -v.v); }
      case "not": { const v = ev(x.x, scope); if (v.t !== "bool") fail(`!${v.t}`); return val("bool", !v.v); }
      case "bin": return binary(x.op, ev(x.l, scope), ev(x.r, scope));
      case "?": { const c = ev(x.c, scope); if (c.t !== "bool") fail("ternary condition must be bool"); const a = ev(x.a, scope), b = ev(x.b, scope); if (a.t !== b.t) fail(`ternary ${a.t} : ${b.t}`); return c.v ? a : b; }
      case "call": return call(x.name, x.args.map((a) => ev(a, scope)));
      case "swz": {
        const v = ev(x.x, scope), n = SIZE[v.t];
        if (!n || n === 1) fail(`.${x.sw} on ${v.t}`);
        const set = SWIZZLE.find((s) => [...x.sw].every((c) => s.includes(c)));
        if (!set || x.sw.length > 4) fail(`bad swizzle .${x.sw}`);
        const idx = [...x.sw].map((c) => set.indexOf(c));
        if (idx.some((i) => i >= n)) fail(`.${x.sw} on ${v.t}`);
        return idx.length === 1 ? val("float", v.v[idx[0]]) : val(VEC[idx.length], idx.map((i) => v.v[i]));
      }
    }
    return fail(`bad node ${x.e}`);
  };
  if (!prog.functions.main || prog.functions.main.type !== "void") fail("no void main()");
  call("main", []);
  return { outputs, globals: prog.globals, functions: Object.keys(prog.functions) };
}
