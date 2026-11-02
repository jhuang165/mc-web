// Pure helpers for tools/verify-block-metadata.mjs (no JDK or filesystem access).

// Block methods (obfuscated name:descriptor) whose results the probe executes for each metadata value.
// An override of one of these is covered by the probed surface (icon registration and placement conversion included).
export const PROBED = new Set([
 'a:(I)I','a:(II)Lrf;','a:(ILjava/util/Random;I)Ladb;','a:(Ljava/util/Random;)I','a:(ILjava/util/Random;)I',
 'b:()I','c:()Z','d:()Z','m:()I','k:()I','f:(I)Lawv;','a:(IZ)Z','f:()Z','a:(Lahl;III)V','a:(Lahb;III)Lazt;',
 'f:(Lahb;III)F','d:(Lahb;III)Ladb;','k:(Lahb;III)I','b:(Lahl;III)Z','b:(Lahl;IIII)I','c:(Lahl;IIII)I',
 'g:(Lahb;IIII)I','a:(Lrg;)V','a:(Lahb;IIIIFFFI)I']);

// Block methods that receive the block's metadata as an argument: name:descriptor -> zero-based parameter index.
export const META_PARAM = {
 'a:(Lahb;IIILaji;I)V': 5, // breakBlock
 'a:(Lahb;IIIIFI)V': 4, // dropBlockAsItemWithChance
 'b:(Lahb;IIIII)V': 4, // dropBlockAsItem
 'a:(Lahb;Lyz;IIII)V': 5, // harvestBlock
 'b:(Lahb;IIII)V': 4, // onBlockDestroyedByPlayer
 'c:(Lahb;IIII)V': 4,
 'e:(Lahb;IIII)V': 4,
 'f:(Lahb;IIII)V': 4};

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

function parseClass(text) {
  const methods = [];
  let cur = null, inCode = false;
  for (const line of text.split('\n')) {
    const head = line.match(/^  (?:[a-z]+ )*([\w$<>]+)\(.*\);$/) || line.match(/^  static \{\};$/);
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
  const callsOf = m => m.lines.map(l => l.match(/\/\/ (?:Method|InterfaceMethod) ([\w$]+)\.([\w$<>]+):(\S+)/)).filter(Boolean).map(x => ({cls: x[1], key: x[2] + ':' + x[3]}));
  // Fixpoint: a method reads metadata if it contains a sink, uses its metadata argument, or calls a reader in the analyzed classes.
  const reads = new Map();
  for (const m of all) {
    let r = m.lines.some(l => SINKS.some(s => s.test(l)));
    const p = META_PARAM[m.key];
    if (p !== undefined && m.name !== '<init>') {
      const slot = slotOf(m.desc, p);
      const loads = m.lines.filter(l => new RegExp(`\\biload(?:_${slot}|\\s+${slot})\\b`).test(l)).length;
      // A super call with the same signature forwards the argument; the callee is judged by the call-graph pass below.
      const forwards = m.lines.filter(l => new RegExp(`invokespecial.*// Method [\\w$]+\\.${m.name}:${m.desc.replace(/[()[\]$]/g, '\\$&')}`).test(l)).length;
      r ||= loads > forwards;
    }
    reads.set(m, r);
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const m of all) {
      if (reads.get(m)) continue;
      for (const c of callsOf(m)) {
        const t = byCall.get(c.cls + '.' + c.key) || all.find(x => x.key === c.key && c.cls === x.cls);
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
  for (const o of overrides) {
    const k = o.cls + '.' + o.method;
    unique.set(k, o);
  }
  const list = [...unique.values()].sort((a, b) => (a.cls + a.method).localeCompare(b.cls + b.method));
  return {
    overrides: list,
    unprobedReaders: [...new Set(list.filter(o => !o.probed && o.readsMetadata).map(o => o.method))].sort(),
    unprobedIndependent: [...new Set(list.filter(o => !o.probed && !o.readsMetadata).map(o => o.method))].sort(),
    probedReaders: [...new Set(list.filter(o => o.probed && o.readsMetadata).map(o => o.method))].sort()
  };
}

const INDEX_FAULTS = /^EXC:java\.lang\.(ArrayIndexOutOfBounds|IndexOutOfBounds|StringIndexOutOfBounds|NegativeArraySize|ArrayStore|ClassCast)/;
const CORE = ['icon0', 'icon1', 'icon2', 'icon3', 'icon4', 'icon5', 'damageDropped', 'dropItem', 'bounds'];

export function classify(records, registryBlocks, analysis, deobf) {
  return records.map(r => {
    const reg = registryBlocks.find(b => b.id === r.id);
    const fields = Object.keys(r.meta[0]);
    const an = analysis.get(r.id);
    // A field that throws for every value is unavailable on this stub (not value-specific evidence).
    const stableFail = fields.filter(f => r.meta.every(m => m[f].startsWith('EXC:')));
    const live = fields.filter(f => !stableFail.includes(f));
    const fault = v => live.filter(f => r.meta[v][f].startsWith('EXC:')).map(f => ({field: f, exception: r.meta[v][f].slice(4)}));
    const key = v => JSON.stringify(live.map(f => r.meta[v][f]));
    const groups = [];
    for (let v = 0; v < 16; v++) {
      if (fault(v).length) continue;
      const g = groups.find(x => x.k === key(v));
      if (g) g.values.push(v); else groups.push({k: key(v), values: [v]});
    }
    const coreBlind = CORE.filter(f => stableFail.includes(f));
    const reads = an.unprobedReaders;
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
      const g = groups.find(x => x.values.includes(v));
      const first = g.values[0];
      const ev = [];
      if (v === first) {
        if (groups.length > 1) {
          ev.push('native:probed-surface-distinct-from-all-lower-values');
          values.push({...base, category: 'semantic', evidence: ev});
        } else if (!reads.length) {
          ev.push('native:probed-surface-identical-for-all-16-values', 'bytecode:no-unprobed-metadata-reading-overrides');
          values.push({...base, category: 'semantic', evidence: ev, note: 'Single canonical state: no probed or unprobed original method distinguishes metadata values.'});
        } else {
          values.push({...base, category: 'unclassified', evidence: ['native:probed-surface-identical-for-all-16-values', 'bytecode:metadata-readers ' + reads.join(' ')],
            reason: 'Probed surface does not vary but unprobed overrides read metadata (tick/update/activation state not executed).'});
        }
      } else if (reads.length) {
        values.push({...base, category: 'unclassified', aliasCandidateOf: first, evidence: ['native:probed-surface-identical-to-' + first, 'bytecode:metadata-readers ' + reads.join(' ')],
          reason: 'Identical probed surface to ' + first + ' but unprobed overrides read metadata, so aliasing is not established.'});
      } else if (coreBlind.length) {
        values.push({...base, category: 'unclassified', aliasCandidateOf: first, evidence: ['native:probed-surface-identical-to-' + first, 'native:unavailable-core ' + coreBlind.join(' ')],
          reason: 'Core probed methods failed for every value on the stub world, so the identical surface is not conclusive.'});
      } else {
        values.push({...base, category: 'alias', aliasOf: first, evidence: ['native:probed-surface-identical-to-' + first, 'bytecode:no-unprobed-metadata-reading-overrides']});
      }
    }
    return {
      id: r.id, name: reg.name, class: r.class, classDeobf: deobf.get(r.class) || null, chain: r.chain,
      itemId: r.itemId, creativeDamages: r.creativeDamages, itemMetadata: r.itemMetadata,
      placedAll: r.placedAll, placedCreative: r.placedCreative, placeErrors: r.placeErrors,
      unavailableFields: stableFail,
      baseSurface: Object.fromEntries(live.map(f => [f, r.meta[groups[0]?.values[0] ?? 0][f]])),
      groups: groups.map((g, i) => ({values: g.values, differsFromFirstGroup: i ? Object.fromEntries(live.filter(f => r.meta[g.values[0]][f] !== r.meta[groups[0]?.values[0] ?? 0][f]).map(f => [f, r.meta[g.values[0]][f]])) : {}})),
      bytecode: {overrides: an.overrides.map(o => `${o.cls}.${o.method}${o.probed ? ' probed' : ''}${o.readsMetadata ? ' reads-metadata' : ''}`), unprobedMetadataReaders: an.unprobedReaders, unprobedMetadataIndependent: an.unprobedIndependent},
      values
    };
  });
}
