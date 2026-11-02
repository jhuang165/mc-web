// Pure helpers for tools/verify-block-metadata.mjs (no JDK or filesystem access).

// Block methods (obfuscated name:descriptor) whose results the base probe executes for each metadata value.
// An override of one of these is covered by the probed surface (icon registration and placement conversion included).
export const PROBED = new Set([
 'a:(I)I','a:(II)Lrf;','a:(ILjava/util/Random;I)Ladb;','a:(Ljava/util/Random;)I','a:(ILjava/util/Random;)I',
 'b:()I','c:()Z','d:()Z','m:()I','k:()I','f:(I)Lawv;','a:(IZ)Z','f:()Z','a:(Lahl;III)V','a:(Lahb;III)Lazt;',
 'f:(Lahb;III)F','d:(Lahb;III)Ladb;','k:(Lahb;III)I','b:(Lahl;III)Z','b:(Lahl;IIII)I','c:(Lahl;IIII)I',
 'g:(Lahb;IIII)I','a:(Lrg;)V','a:(Lahb;IIIIFFFI)I']);

// Block methods that receive the block's metadata as an argument: name:descriptor -> zero-based parameter index.
// Mirrored by BlockMetadataExtProbe.META_PARAM, which passes the value under test in that position (except c).
export const META_PARAM = {
 'a:(Lahb;IIILaji;I)V': 5, // breakBlock
 'a:(Lahb;IIIIFI)V': 4, // dropBlockAsItemWithChance
 'b:(Lahb;IIIII)V': 4, // dropBlockAsItem
 'a:(Lahb;Lyz;IIII)V': 5, // harvestBlock
 'b:(Lahb;IIII)V': 4, // onBlockDestroyedByPlayer
 'a:(Lahb;IIIILyz;)V': 4, // onBlockHarvested
 'c:(Lahb;IIII)V': 4, // dropXpOnBlockBreak (func_149657_c): an XP amount; kept as a conservative reader
 'e:(Lahb;IIII)V': 4, // onPostBlockPlaced (func_149714_e)
 'f:(Lahb;IIII)V': 4}; // onBlockPreDestroy (func_149725_f)

// Calls that read a block's (or tile entity's) stored metadata.
const SINKS = [/(?:Method|InterfaceMethod) (?:ahb|ahl)\.e:\(III\)I/, /Method aor\.p:\(\)I/];

function slotOf(desc, paramIndex) {
  const params = desc.slice(1, desc.indexOf(')'));
  let slot = 1, index = 0;
  for (let i = 0; i < params.length; index++) {
    if (index === paramIndex) return slot;
    let c = params[i];
    while (c === '[') c = params[++i];
    const wide = c === 'J' || c === 'D';
    if (c === 'L') i = params.indexOf(';', i);
    i++;
    slot += wide ? 2 : 1;
  }
  return -1;
}

export function parseClass(text) {
  const methods = [];
  let cur = null, inCode = false;
  for (const line of text.split('\n')) {
    // Method headers, including array/qualified return types and throws clauses (fields have no parameter list).
    const head = line.match(/^  (?:[\w$.[\]]+ )*([\w$<>]+)\([^()]*\)(?: throws [\w$., ]+)?;$/) || line.match(/^  static \{\};$/);
    if (head) { cur = {name: head[1] || '<clinit>', desc: '', lines: []}; methods.push(cur); inCode = false; continue; }
    if (!cur) continue;
    const d = line.match(/^    descriptor: (.*)$/);
    if (d) { cur.desc = d[1]; continue; }
    if (/^    Code:/.test(line)) { inCode = true; continue; }
    if (inCode && /^\s+\d+: /.test(line)) cur.lines.push(line);
    else if (inCode && /^    \S/.test(line)) inCode = false;
  }
  return methods;
}

export function analyzeBytecode(chain, bytecode) {
  const classes = new Map();
  for (const [name, text] of bytecode) classes.set(name, parseClass(text));
  const key = m => m.name + ':' + m.desc;
  const all = [];
  for (const [cls, methods] of classes) for (const m of methods) all.push({cls, ...m, key: key(m)});
  const byCall = new Map(all.map(m => [m.cls + '.' + m.key, m]));
  // javap omits the owner for calls into the current class ("// Method e:(Lahl;III)V"); those resolve against it.
  const callsOf = m => m.lines.map(l => l.match(/\/\/ (?:Method|InterfaceMethod) (?:([\w$]+)\.)?("?[\w$<>]+"?):(\S+)/)).filter(Boolean)
    .map(x => ({cls: x[1] || m.cls, key: x[2].replace(/"/g, '') + ':' + x[3]}));
  // A call naming a class of the chain resolves to the nearest declaration at or above that class (inherited methods).
  const resolve = c => {
    const i = chain.indexOf(c.cls);
    if (i < 0) return byCall.get(c.cls + '.' + c.key);
    for (let j = i; j < chain.length; j++) { const t = byCall.get(chain[j] + '.' + c.key); if (t) return t; }
    return undefined;
  };
  // Fixpoint: a method reads metadata if it contains a sink, uses its metadata argument, or calls a reader in the analyzed classes.
  const reads = new Map();
  for (const m of all) {
    let r = m.lines.some(l => SINKS.some(s => s.test(l)));
    const p = META_PARAM[m.key];
    if (p !== undefined && m.name !== '<init>') {
      const slot = slotOf(m.desc, p);
      const loads = m.lines.filter(l => new RegExp(`\\biload(?:_${slot}|\\s+${slot})\\b`).test(l)).length;
      // A super call with the same signature forwards the argument; the callee is judged by the call-graph pass below.
      const forwards = m.lines.filter(l => new RegExp(`invokespecial.*// Method (?:[\\w$]+\\.)?${m.name}:${m.desc.replace(/[()[\]$]/g, '\\$&')}`).test(l)).length;
      r ||= loads > forwards;
    }
    reads.set(m, r);
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const m of all) {
      if (reads.get(m)) continue;
      for (const c of callsOf(m)) {
        const t = resolve(c);
        if (t && reads.get(t)) { reads.set(m, true); changed = true; break; }
      }
    }
  }
  // Report overrides of the block's own class chain (inner classes only feed the fixpoint).
  const own = new Set(chain);
  const overrides = all
    .filter(m => own.has(m.cls) && m.name !== '<init>' && m.name !== '<clinit>')
    .map(m => ({cls: m.cls, method: m.key, probed: PROBED.has(m.key), readsMetadata: reads.get(m)}));
  const unique = new Map();
  for (const o of overrides) unique.set(o.cls + '.' + o.method, o);
  const list = [...unique.values()].sort((a, b) => (a.cls + a.method).localeCompare(b.cls + b.method));
  return {
    overrides: list,
    unprobedReaders: [...new Set(list.filter(o => !o.probed && o.readsMetadata).map(o => o.method))].sort(),
    unprobedIndependent: [...new Set(list.filter(o => !o.probed && !o.readsMetadata).map(o => o.method))].sort(),
    probedReaders: [...new Set(list.filter(o => o.probed && o.readsMetadata).map(o => o.method))].sort()
  };
}

// Metadata readers outside the block class chain that are tied to the block itself and are not executed by the probe:
// RenderBlocks (blm) renders world blocks through renderBlockByRenderType (blm.b(Block,x,y,z)), which compares
// Block.getRenderType() with constants and calls one blm method per type. renderDispatch maps each render type to that
// method and whether it (or a blm method it calls) reads world metadata (IBlockAccess.getBlockMetadata).
export function renderDispatch(text) {
  const methods = parseClass(text);
  const disp = methods.find(m => m.desc === '(Laji;III)Z' && m.lines.slice(0, 3).some(l => /Method aji\.b:\(\)I/.test(l)));
  if (!disp) throw new Error('RenderBlocks dispatch method not found');
  const store = disp.lines.find(l => /istore/.test(l)).match(/istore(?:_|\s+)(\d+)/)[1];
  const loadRe = new RegExp(`iload(?:_${store}|\\s+${store})$`);
  const types = new Map();
  let pending = null, last = null;
  for (const line of disp.lines) {
    const ins = line.replace(/^\s+\d+: /, '').replace(/\s+\/\/.*$/, '').trim();
    if (loadRe.test(ins)) { last = 'load'; continue; }
    const k = ins.match(/^(?:iconst_(m1|\d)|bipush\s+(-?\d+)|sipush\s+(-?\d+))$/);
    if (k && last === 'load') { last = k[1] === 'm1' ? -1 : +(k[1] ?? k[2] ?? k[3]); continue; }
    if (/^if_icmpne/.test(ins) && typeof last === 'number') pending = last;
    else if (/^ifne/.test(ins) && last === 'load') pending = 0;
    else if (/return$/.test(ins)) pending = null;
    else if (pending !== null) {
      const call = line.match(/invoke(?:virtual|special) .*\/\/ Method ([\w$]+:\S+)$/);
      if (call) { if (!types.has(pending)) types.set(pending, call[1]); pending = null; }
    }
    last = null;
  }
  // A metadata read whose value only reaches the metadata argument of getBlockIconFromSideAndMetadata
  // (blm.a(Block,side,meta) -> Block.getIcon(side, meta), probed for every side and value) adds nothing beyond the
  // probed icons; any other use, or a call to a blm method with such a use, is a reader. iconOnly follows the value
  // with a small stack simulation through simple loads/conversions/arithmetic into a call: getIcon(side, meta) as its
  // last argument, or a blm method whose corresponding parameter is itself icon-only; anything else is a real read.
  const sink = /\/\/ (?:Method|InterfaceMethod) (?:ahb|ahl)\.e:\(III\)I/;
  const key = m => m.name + ':' + m.desc;
  const byKey = new Map(methods.map(m => [key(m), m]));
  const op = l => l.replace(/^\s+\d+: /, '').split(/\s+/)[0];
  const nArgs = desc => { let n = 0; for (let i = 1; desc[i] !== ')'; i++, n++) { while (desc[i] === '[') i++; if (desc[i] === 'L') i = desc.indexOf(';', i); } return n; };
  const paramMemo = new Map();
  const iconOnlyParam = (m, index) => {
    const id = key(m) + '#' + index;
    if (paramMemo.has(id)) return paramMemo.get(id);
    paramMemo.set(id, false); // cycles count as real reads
    const slot = slotOf(m.desc, index);
    const re = new RegExp(`^(?:iload_${slot}|iload\\s+${slot})$`), st = new RegExp(`^(?:istore_${slot}|istore\\s+${slot}|iinc\\s+${slot},)`);
    const body = m.lines.map(l => l.replace(/^\s+\d+: /, '').replace(/\s+\/\/.*$/, '').trim());
    const ok = !body.some(b => st.test(b)) && body.every((b, i) => !re.test(b) || iconOnly(m, i + 1));
    paramMemo.set(id, ok);
    return ok;
  };
  const push1 = /^(?:[ifadl]load(?:_\d)?|[ifdl]const_\w+|aconst_null|bipush|sipush|ldc(?:_w|2_w)?|getstatic)$/;
  const keep = /^(?:i2d|i2f|f2d|d2f|i2l|l2i|f2i|d2i|checkcast)$/;
  const binop = /^(?:[ifdl](?:add|sub|mul|div))$/;
  function iconOnly(m, from) {
    let depth = 0; // values pushed above the metadata value
    for (let i = from; i < m.lines.length; i++) {
      const l = m.lines[i], o = op(l);
      if (push1.test(o)) depth++;
      else if (keep.test(o) || (o === 'getfield' && depth > 0)) { /* net 0 above the value */ }
      else if (binop.test(o)) { if (depth < 2) return false; depth--; }
      else if (/^invoke/.test(o)) {
        if (/\/\/ Method aji\.a:\(II\)Lrf;$/.test(l) || /\/\/ Method (?:blm\.)?a:\(Laji;II\)Lrf;$/.test(l)) return depth === 0;
        const c = l.match(/\/\/ Method (?:blm\.)?([\w$<>]+:\S+)$/);
        const t = c && byKey.get(c[1]);
        if (!t) return false;
        const n = nArgs(t.desc), index = n - 1 - depth;
        return index >= 0 && iconOnlyParam(t, index);
      } else return false;
    }
    return false;
  }
  const reads = new Map(methods.map(m => [m, m.lines.some((l, i) => sink.test(l) && !iconOnly(m, i + 1))]));
  for (let changed = true; changed;) {
    changed = false;
    for (const m of methods) {
      if (reads.get(m)) continue;
      for (const l of m.lines) {
        const c = l.match(/\/\/ Method (?:blm\.)?([\w$<>]+:\S+)$/);
        const t = c && byKey.get(c[1]);
        if (t && reads.get(t)) { reads.set(m, true); changed = true; break; }
      }
    }
  }
  return new Map([...types].map(([t, method]) => [t, {method, readsMetadata: !!reads.get(byKey.get(method))}]));
}

// External readers for one block: the RenderBlocks method of its render type when it reads metadata, and its tile
// entity (TileEntity.getBlockMetadata is reachable from tile-entity code and tile-entity renderers; no tile entity
// exists in the probe worlds). Returns {key: why}.
export function externalReaders(renderType, an, dispatch) {
  const out = {};
  const d = dispatch.get(+renderType);
  if (d && d.readsMetadata) out[`blm.${d.method} [render type ${renderType}]`] = 'RenderBlocks render method reads world metadata (client rendering not executed)';
  if (an.overrides.some(o => o.cls !== 'aji' && o.method === 'a:(Lahb;I)Laor;'))
    out['tile-entity'] = 'creates a tile entity; tile-entity code and renderers can read block metadata (no tile entity is executed)';
  return out;
}

const INDEX_FAULTS = /^EXC:java\.lang\.(ArrayIndexOutOfBounds|IndexOutOfBounds|StringIndexOutOfBounds|NegativeArraySize|ArrayStore|ClassCast)/;
const CORE = ['icon0', 'icon1', 'icon2', 'icon3', 'icon4', 'icon5', 'damageDropped', 'dropItem', 'bounds'];
// Probe-side frames: an exception raised there is a limitation of the World/player doubles, not native evidence.
const PROBE_FRAME = /@(?:BlockMetadataExtProbe|BlockMetadataProbe|PlantProbe|MobMoveProbe)/;
const bad = o => o.startsWith('EXC:') || o === 'NONDET';
// Index/cast fault raised in original game code (a known first frame outside the probe classes; the probe JVM runs
// with -XX:-OmitStackTraceInFastThrow so frames are kept).
const nativeIndexFault = o => INDEX_FAULTS.test(o) && !/@\?/.test(o) && !PROBE_FRAME.test(o.split('<')[0]);

// Block references in an executed outcome: written cells (x,y,z=id:meta), falling-block entities (e=block:id a=meta)
// and block-break effects (aux 2001, id | meta << 12) carry a block metadata value. It is replaced by that value's class
// in the current partition of that block (classes: id -> Map(meta -> class)), so a value that only carries itself
// along (gravel falling, sapling marking 6 -> 14, an unlit redstone torch relighting with the same metadata) is
// compared by what the carried value does, not by its number: a joint partition refinement over all blocks to the
// coarsest stable partition. Values outside a block's partition (excluded or out of range) stay raw.
// The damage of a stack of the block's own item often echoes the value (silk-touch stacks, pick-up): with stackEcho
// own-item damages are ignored (no distinctness evidence from them, compared symmetrically), otherwise compared raw
// (different damages are different stacks, so no alias across them). m (the value under test) is unused but kept for
// callers' clarity.
export function normalise(o, itemId, m, classes, stackEcho) {
  const c = (id, n) => { const p = classes.get(id); return p && p.has(n) ? 'C' + p.get(n) : 'R' + n; };
  let s = o.replace(/=(\d+):(\d+)/g, (_, id, n) => `=${id}:` + c(+id, +n))
    .replace(/(e=block:(\d+) a=)(\d+)/g, (_, p, id, n) => p + c(+id, +n))
    .replace(/(aux\*? 2001 -?\d+,-?\d+,-?\d+,)(\d+)/g, (_, p, n) => p + 'B' + (+n & 4095) + ':' + c(+n & 4095, +n >> 12));
  if (stackEcho && itemId != null) s = s.replace(new RegExp(`(stack:${itemId}:\\d+:)\\d+`, 'g'), '$1*');
  return s;
}
const truncated = o => o.endsWith('...');

// One refinement round of block `id` against the current joint partition: values with equal previous class, base
// outcomes and normalised executed outcomes stay together. Failing outcomes are compared verbatim; truncated outcomes
// by their full-string code. Returns the new partition of the block.
export function refineOnce(id, values, baseKey, fields, itemId, stackEcho, classes) {
  const cls = classes.get(id);
  const sig = v => JSON.stringify([cls.get(v), baseKey(v), fields.map(f => {
    const o = f.outs[v];
    return truncated(o) ? 'T' + f.codes[v] : bad(o) ? o : normalise(o, itemId, v, classes, stackEcho);
  })]);
  const ids = new Map(), next = new Map();
  for (const v of values) { const s = sig(v); if (!ids.has(s)) ids.set(s, ids.size); next.set(v, ids.get(s)); }
  return next;
}
// Joint coarsest stable partition of all blocks (start: one class per block; refine until no block splits further).
export function refineAll(blocks, stackEcho, pick) {
  const classes = new Map(blocks.map(b => [b.id, new Map(b.nonExcluded.map(v => [v, 0]))]));
  for (let changed = true; changed;) {
    changed = false;
    for (const b of blocks) {
      const next = refineOnce(b.id, b.nonExcluded, b.baseKey, pick(b), b.itemId, stackEcho, classes);
      if (new Set(next.values()).size !== new Set(classes.get(b.id).values()).size) changed = true;
      classes.set(b.id, next);
    }
  }
  return classes;
}

// Executed fields (BlockMetadataExtProbe): {m: owner.name:desc, f: field id, c: 0 | 16 outcome codes, o: outcomes, te?}.
function extFields(r) {
  if (!r.ext || r.ext.error) return [];
  return r.ext.fields.map(f => {
    const codes = f.c === 0 ? Array(16).fill(0) : f.c;
    const outs = codes.map(c => f.o[c]);
    const method = f.m.slice(f.m.indexOf('.') + 1);
    return {...f, codes, outs, method, owner: f.m.slice(0, f.m.indexOf('.')), stable: outs.every(bad), partial: outs.some(bad) && !outs.every(bad)};
  });
}

// Coverage of each unprobed metadata-reading override by executed fields. A reader is covered only when every one of
// its executed fields ran without a stable (all-value) failure in all four world scenarios and never queried a tile
// entity (the World double has none, so tile-entity state is unobserved).
export function coverage(readers, ext, skipped) {
  const out = {};
  for (const key of readers) {
    const fs = ext.filter(f => f.method === key);
    const skip = skipped.find(([m]) => m.endsWith('.' + key));
    if (!fs.length) { out[key] = {covered: false, why: skip ? 'not executable: ' + skip[1] : 'not executed (no World/IBlockAccess parameter)'}; continue; }
    // The four base scenarios (the nb<n>/role<n> matrix of neighbour-reading methods comes on top).
    const scen = new Set(fs.filter(f => !f.stable).map(f => f.f.split('@').pop()).filter(s => ['iso', 'enc', 'same', 'role'].includes(s)));
    const stable = fs.filter(f => f.stable);
    const te = fs.some(f => f.te);
    if (te) out[key] = {covered: false, why: 'reads tile-entity state (World double holds no tile entity)', fields: fs.length};
    else if (stable.length) out[key] = {covered: false, why: 'stable failure in ' + stable.length + '/' + fs.length + ' executed fields: ' + [...new Set(stable.map(f => f.outs[0]))].slice(0, 3).join(', '), fields: fs.length};
    else if (scen.size < 4) out[key] = {covered: false, why: 'executed in ' + scen.size + '/4 scenarios', fields: fs.length};
    else out[key] = {covered: true, fields: fs.length};
  }
  return out;
}

function prepare(r) {
  const fields = Object.keys(r.meta[0]);
  // A base field that throws for every value is unavailable on this stub (not value-specific evidence).
  const stableFail = fields.filter(f => r.meta.every(m => m[f].startsWith('EXC:')));
  const live = fields.filter(f => !stableFail.includes(f));
  const fault = v => live.filter(f => r.meta[v][f].startsWith('EXC:')).map(f => ({field: f, exception: r.meta[v][f].slice(4)}));
  const ext = extFields(r);
  const extLive = ext.filter(f => !f.stable);
  // Value-specific native index/cast faults in executed fields.
  const extFault = v => extLive.filter(f => nativeIndexFault(f.outs[v])).map(f => ({field: f.f, exception: f.outs[v].slice(4)}));
  const excluded = v => fault(v).length > 0 || extFault(v).length > 0;
  const nonExcluded = [...Array(16).keys()].filter(v => !excluded(v));
  const baseKey = v => JSON.stringify(live.map(f => r.meta[v][f]));
  // Fields of the conclusive partition: executed without failure, nondeterminism or truncation for every
  // non-excluded value.
  const concFields = extLive.filter(f => nonExcluded.every(v => !bad(f.outs[v]) && !truncated(f.outs[v])));
  return {id: r.id, itemId: r.itemId, stableFail, live, fault, ext, extLive, extFault, nonExcluded, baseKey, concFields};
}

// dispatch: renderDispatch(javap of RenderBlocks); external readers block alias and single-canonical claims.
export function classify(records, registryBlocks, analysis, deobf, dispatch) {
  const prepared = records.map(prepare);
  // Conclusive partition: base outcomes plus fully conclusive executed fields, own-item stack echoes equal; different
  // classes are distinct states. Exact partition: every executed field, failures and echoes verbatim (alias groups).
  const concAll = refineAll(prepared, true, b => b.concFields);
  const exactAll = refineAll(prepared, false, b => b.extLive);
  return records.map((r, ri) => {
    const reg = registryBlocks.find(b => b.id === r.id);
    const an = analysis.get(r.id);
    const {stableFail, live, fault, ext, extLive, extFault, nonExcluded, baseKey, concFields} = prepared[ri];
    const skipped = r.ext?.skipped || [];
    const conc = concAll.get(r.id), exact = exactAll.get(r.id);
    const norm = (f, v) => normalise(f.outs[v], r.itemId, v, concAll, true);
    // A field whose outcomes failed for some other value can still separate u and v when both ran (visible prefix).
    const pairDiff = (f, u, v) => {
      const a = f.outs[u], b = f.outs[v];
      if (f.codes[u] === f.codes[v] || bad(a) || bad(b)) return false;
      let x = norm(f, u), y = norm(f, v);
      if (truncated(a) || truncated(b)) { const n = Math.min(x.length, y.length) - 12; x = x.slice(0, n); y = y.slice(0, n); }
      return x !== y;
    };
    // differs: name of a conclusive field (no exception/NONDET for either value, not only an echo) separating u and v.
    const diffField = (u, v) => {
      if (baseKey(u) !== baseKey(v)) return live.find(f => r.meta[u][f] !== r.meta[v][f]);
      if (conc.get(u) !== conc.get(v)) return (concFields.find(f => norm(f, u) !== norm(f, v)) || {f: 'joint-partition'}).f;
      const f = extLive.find(f => pairDiff(f, u, v));
      return f ? f.f : null;
    };
    const echoFields = (u, v) => extLive.filter(f => f.codes[u] !== f.codes[v] && !bad(f.outs[u]) && !bad(f.outs[v]) && !pairDiff(f, u, v));
    const failFields = (u, v) => extLive.filter(f => f.codes[u] !== f.codes[v] && (bad(f.outs[u]) || bad(f.outs[v])));
    const groups = [];
    for (const v of nonExcluded) {
      const g = groups.find(x => x.k === exact.get(v));
      if (g) g.values.push(v); else groups.push({k: exact.get(v), values: [v]});
    }
    const groupBad = g => extLive.filter(f => bad(f.outs[g.values[0]]));
    const coreBlind = CORE.filter(f => stableFail.includes(f));
    const readers = an.unprobedReaders;
    const cover = coverage(readers, ext, skipped);
    const external = dispatch ? Object.assign({}, ...[...new Set(r.meta.map(m => m.renderType))].map(t => externalReaders(t, an, dispatch))) : {};
    for (const [k, why] of Object.entries(external)) cover[k] = {covered: false, external: true, why};
    const uncoveredChain = readers.filter(k => !cover[k].covered);
    const uncovered = [...uncoveredChain, ...Object.keys(external)];
    const values = [];
    for (let v = 0; v < 16; v++) {
      const placement = r.creativeDamages.length && r.placedCreative.includes(v) ? 'creative-item' : r.placedAll.includes(v) ? 'item-damage' : 'none';
      const base = {meta: v, placement};
      const faults = fault(v);
      if (faults.length) {
        const index = faults.some(x => INDEX_FAULTS.test('EXC:' + x.exception));
        values.push({...base, category: index ? 'invalid' : 'unclassified',
          evidence: [(index ? 'native:exception ' : 'probe:exception ') + faults.map(x => x.field + '=' + x.exception).join(', ')],
          reason: index ? 'A probed original method throws an index/cast fault for this value (other values do not).' : 'A probed method throws a non-index exception for this value only; cause (native or stub) not established.'});
        continue;
      }
      const xf = extFault(v);
      if (xf.length) {
        values.push({...base, category: 'invalid', evidence: ['native:exception ' + xf.slice(0, 3).map(x => x.field + '=' + x.exception).join(', ')],
          reason: 'An executed original method throws an index/cast fault in game code for this value (other values do not).'});
        continue;
      }
      const g = groups.find(x => x.values.includes(v));
      const first = g.values[0];
      const lower = nonExcluded.filter(u => u < v);
      if (v === first) {
        const undecided = lower.filter(u => !diffField(u, v));
        if (undecided.length) {
          const echo = [...new Set(undecided.flatMap(u => echoFields(u, v).map(f => f.method)))];
          const fail = [...new Set(undecided.flatMap(u => failFields(u, v).map(f => f.method)))];
          const ev = ['native:no-conclusive-difference-from ' + undecided.join(',')];
          if (echo.length) ev.push('native:identity-echo-only ' + echo.slice(0, 4).join(' '));
          if (fail.length) ev.push('native:inconclusive-executed-fields ' + fail.slice(0, 4).join(' '));
          values.push({...base, category: 'unclassified', evidence: ev,
            reason: 'Differs from lower value(s) ' + undecided.join(',') + ' only ' + [echo.length && 'by the raw value in a stack of its own item (or a difference beyond the stored outcome prefix)', fail.length && 'in executed fields where one side threw or was nondeterministic'].filter(Boolean).join(' or ') + '; neither distinct nor alias is established.'});
        } else if (nonExcluded.some(w => w !== v && diffField(v, w))) {
          const ev = [lower.length ? 'native:probed-or-executed-surface-distinct-from-all-lower-values' : 'native:lowest-value-of-a-block-with-distinct-states'];
          const viaExt = lower.filter(u => baseKey(u) === baseKey(v));
          if (viaExt.length) ev.push('native:executed-difference ' + viaExt.slice(0, 4).map(u => u + ':' + diffField(u, v)).join(' '));
          values.push({...base, category: 'semantic', evidence: ev});
        } else if (!uncoveredChain.length && !groupBad(g).length) {
          // The lowest value of a block whose class chain never distinguishes values is its canonical state; external
          // readers (render method, tile entity) can only add states, so they block aliases below, not this value.
          const identical = groups.length === 1 && nonExcluded.length === 16;
          const ext = Object.keys(external);
          values.push({...base, category: 'semantic', evidence: [identical ? 'native:probed-and-executed-surface-identical-for-all-16-values' : 'native:lowest-value; no other value differs conclusively',
            readers.length ? 'native:executed-metadata-readers ' + readers.join(' ') : 'bytecode:no-unprobed-metadata-reading-overrides',
            ...(ext.length ? ['bytecode:unexecuted-external-readers ' + ext.join(' ')] : [])],
            note: 'Single canonical state: no probed or executed original method distinguishes metadata values conclusively.'});
        } else {
          values.push({...base, category: 'unclassified', evidence: ['native:probed-and-executed-surface-identical-for-all-16-values', 'bytecode:unexecuted-metadata-readers ' + uncovered.join(' ')],
            reason: 'Probed and executed surface does not vary, but metadata readers (block overrides, its RenderBlocks render method or tile entity) were not executed conclusively:' + uncovered.map(k => k + ' (' + cover[k].why + ')').join('; ')});
        }
        continue;
      }
      const leader = values[first];
      const gb = groupBad(g);
      if (gb.length) {
        values.push({...base, category: 'unclassified', aliasCandidateOf: first, evidence: ['native:surface-identical-to-' + first, 'native:inconclusive-executed-fields ' + gb.slice(0, 4).map(f => f.f).join(' ')],
          reason: 'Identical outcomes to ' + first + ' including exceptions/NONDET in executed fields, so aliasing is not established.'});
      } else if (uncovered.length) {
        values.push({...base, category: 'unclassified', aliasCandidateOf: first, evidence: ['native:surface-identical-to-' + first, 'bytecode:unexecuted-metadata-readers ' + uncovered.join(' ')],
          reason: 'Identical probed and executed surface to ' + first + ', but metadata readers (block overrides, its RenderBlocks render method or tile entity) were not executed conclusively:' + uncovered.map(k => k + ' (' + cover[k].why + ')').join('; ')});
      } else if (coreBlind.length) {
        values.push({...base, category: 'unclassified', aliasCandidateOf: first, evidence: ['native:surface-identical-to-' + first, 'native:unavailable-core ' + coreBlind.join(' ')],
          reason: 'Core probed methods failed for every value on the stub world, so the identical surface is not conclusive.'});
      } else if (leader.category !== 'semantic') {
        values.push({...base, category: 'unclassified', aliasCandidateOf: first, evidence: ['native:surface-identical-to-' + first],
          reason: 'Identical surface to ' + first + ', which is itself not established.'});
      } else {
        values.push({...base, category: 'alias', aliasOf: first, evidence: ['native:surface-identical-to-' + first,
          readers.length ? 'native:executed-metadata-readers ' + readers.join(' ') : 'bytecode:no-unprobed-metadata-reading-overrides']});
      }
    }
    const leadKey = groups[0]?.values[0] ?? 0;
    return {
      id: r.id, name: reg.name, class: r.class, classDeobf: deobf.get(r.class) || null, chain: r.chain,
      itemId: r.itemId, creativeDamages: r.creativeDamages, itemMetadata: r.itemMetadata,
      placedAll: r.placedAll, placedCreative: r.placedCreative, placeErrors: r.placeErrors,
      unavailableFields: stableFail,
      baseSurface: Object.fromEntries(live.map(f => [f, r.meta[leadKey][f]])),
      groups: groups.map((g, i) => {
        const v = g.values[0];
        const ex = extLive.filter(f => f.codes[v] !== f.codes[leadKey]);
        return {values: g.values,
          differsFromFirstGroup: i ? Object.fromEntries(live.filter(f => r.meta[v][f] !== r.meta[leadKey][f]).map(f => [f, r.meta[v][f]])) : {},
          ...(i && ex.length ? {executedDiffers: ex.length, executedExamples: Object.fromEntries(ex.slice(0, 3).map(f => [f.f, f.outs[v].slice(0, 160)]))} : {})};
      }),
      executed: r.ext?.error ? {error: r.ext.error} : {
        fields: ext.length, live: extLive.length, varying: extLive.filter(f => new Set(f.codes).size > 1).length,
        stableFailures: Object.entries(ext.filter(f => f.stable).reduce((a, f) => (a[f.method] = (a[f.method] || 0) + 1, a), {})).map(([m, n]) => m + ' x' + n).sort(),
        tileEntityQueries: [...new Set(ext.filter(f => f.te).map(f => f.method))].sort(),
        skipped: skipped.map(([m, why]) => m + ' (' + why + ')')},
      bytecode: {overrides: an.overrides.map(o => `${o.cls}.${o.method}${o.probed ? ' probed' : ''}${o.readsMetadata ? ' reads-metadata' : ''}`),
        unprobedMetadataReaders: an.unprobedReaders, unprobedMetadataIndependent: an.unprobedIndependent,
        readerCoverage: cover, unexecutedMetadataReaders: uncovered},
      values
    };
  });
}
