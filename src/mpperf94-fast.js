// Batch 94 mpperf94: server tick speed (results unchanged). MC_MPPERF94=on (default) | off (reference path) | verify (both, throws on the first difference); tests set `fast94.mode`.
//   1. legacy-creature.js legacyThink: the spider / pigman action-state environment was 14 fresh closures per mob per tick. One shared environment object whose functions read the
//      current mob's context from module variables (set by bind for the duration of the call; a nested legacyThink, if any, finds it taken and builds closures as before).
//   2. entities.js scratchBox: the second keptBox (a fresh array) existed only for the verify comparison of mpperf81 but was built on every call.

export const fast94 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF94) || "on", binds: 0 }; // binds: how often the shared legacyThink environment was used (tests)
export const fail94 = (what) => { throw new Error(`mpperf94 ${what} mismatch`); };

// ---- 1. shared legacyThink environment ----
// `attack(ctx, me, target, d)` and `pathWeight(x, y, z, light)` come from legacy-creature.js (they need its attack helpers); the other bodies are the closures' bodies.
// Context (the closures' captures): ew, e, t, p, s, m, st, spider, pigman, light, hooks, rand.
export function createLegacyEnv94(attack, weight) {
  let ew, e, t, p, s, m, st, spider, pigman, light, hooks, rand, busy = false;
  const f = Math.fround, ctx = { get ew() { return ew; }, get e() { return e; }, get st() { return st; }, get p() { return p; }, get s() { return s; }, get t() { return t; }, get spider() { return spider; }, get light() { return light; }, get rand() { return rand; } };
  const path = (make) => (m.navigator.spend() ? make(m.navigator.finder()) : null);
  const env = {
    rand: null, remote: false,
    closestPlayer: (me, range) => (p && !p.left && (range < 0 || m.distSq(p) < range * range) ? p : null),
    lookGone: (x) => (x === p ? !p || !!p.left || (p.deadTicks ?? 0) > 20 : x.alive === false),
    findPlayerToAttack: (me) => {
      if (hooks?.findPlayerToAttack) return hooks.findPlayerToAttack(me);
      if (spider) return light < 0.5 ? ew.ai.closestVulnerablePlayer(me, 16) : null;
      if (pigman && !((e.angerLevel | 0) > 0)) return null;
      const c = ew.ai.closestVulnerablePlayer(me, 16);
      return c && m.canSee(c) ? c : null;
    },
    isAlive: (x) => (x === p ? !!p.alive : x.alive !== false),
    isCreative: (x) => x === p && !!s.creative,
    eyeHeight: (x) => (x === st ? f(f(t.height) * f(0.85)) : x === p || x.isPlayer ? f(1.62) : x.eyeHeight),
    boxMidY: (x) => x.y,
    canSee: (me, target) => m.canSee(target),
    attackEntity: (me, target, d) => attack(ctx, target, d),
    pathToEntity: (me, target, range) => path((fn) => fn.createEntityPathToEntity(m, target, range)),
    pathToBlock: (me, x, y, z, range) => path((fn) => fn.createEntityPathToBlock(m, x, y, z, range)),
    pathWeight: (me, x, y, z) => weight(ew, x, y, z),
    setDead: () => ew.ai.despawn(e),
  };
  return {
    env,
    // The shared environment bound to this mob, or null (off, or taken by an outer call): the caller then builds its closures. Pair with release in a finally.
    bind(ew_, e_, t_, p_, s_, m_, st_, spider_, pigman_, light_, hooks_, rand_) {
      if (busy || fast94.mode === "off") return null;
      busy = true; fast94.binds++;
      ew = ew_; e = e_; t = t_; p = p_; s = s_; m = m_; st = st_; spider = spider_; pigman = pigman_; light = light_; hooks = hooks_; rand = rand_;
      env.rand = rand_;
      return env;
    },
    release() { busy = false; ew = e = t = p = s = m = st = hooks = rand = undefined; env.rand = null; },
  };
}
// verify: both environments (closures and shared) answer the pure probes alike.
export function sameEnv94(a, b, e, p, other) {
  const same = (what, x, y) => { if (!Object.is(x, y)) fail94(`legacy env ${what}`); };
  same("closestPlayer", a.closestPlayer(e, 16), b.closestPlayer(e, 16));
  same("closestPlayer all", a.closestPlayer(e, -1), b.closestPlayer(e, -1));
  for (const x of [p, e, other]) {
    if (x === undefined || x === null) continue;
    same("lookGone", a.lookGone(x), b.lookGone(x));
    same("isAlive", a.isAlive(x), b.isAlive(x));
    same("isCreative", a.isCreative(x), b.isCreative(x));
    same("eyeHeight", a.eyeHeight(x), b.eyeHeight(x));
    same("boxMidY", a.boxMidY(x), b.boxMidY(x));
  }
  same("pathWeight", a.pathWeight(e, Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)), b.pathWeight(e, Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)));
  same("remote", a.remote, b.remote);
}
// ---- 2. scratchBox ----
// (entities.js calls checkSameBox only in verify mode of mpperf81; this flag skips building the comparison copy otherwise)
export const keptCopy94 = (mode81) => mode81 === "verify" || fast94.mode === "off";
