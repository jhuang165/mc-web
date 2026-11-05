import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Runs the unchanged 1.7.10 firework classes: RecipeFireworks (aey), ItemFireworkCharge (acr), ItemFirework (acs),
// EntityFireworkRocket (zf), EntityFireworkStarterFX (bke), EntityFireworkSparkFX (bkd), EntityFireworkOverlayFX (bkc),
// ItemDye colours (acj.c), EffectRenderer (bkn) and Bootstrap on the ParticleProbe world double (a WorldClient subclass
// allocated without its constructor; stone below y 64). Nothing is patched. The world double logs sounds, entity
// states and makeFireworks calls. Random streams: Math.random and the starter's Entity.rand are rewound to their
// pre-constructor state (the 4/5 float draws of EntityFX), the rocket's Entity.rand is recovered by rewinding the LCG
// until a forward replay of the zf constructor reproduces the observed motion, lifetime and post-state.
// Prints one JSON object per line: facts, recipe, tooltip, rocket, rocketNbt, starter, lifecycle.
public class FireworksProbe extends ParticleProbe {
  static List<String> sounds = new ArrayList<>();
  static List<String> states = new ArrayList<>();
  static List<String> makes = new ArrayList<>();
  static List<String> sparkCalls = new ArrayList<>();
  static class FW extends PWorld {
    FW() { super(); }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) {
      sparkCalls.add("[\"" + name + "\"," + x + "," + y + "," + z + "," + vx + "," + vy + "," + vz + "]");
    }
    public void a(sa e, String name, float vol, float pitch) { sounds.add("[\"" + name + "\"," + vol + "," + pitch + ",0]"); }
    public void a(double x, double y, double z, String name, float vol, float pitch, boolean delay) {
      sounds.add("[\"" + name + "\"," + vol + "," + pitch + "," + (delay ? 1 : 0) + "," + x + "," + y + "," + z + "]");
    }
    public void a(sa e, byte state) { states.add(Byte.toString(state)); }
    public void a(double x, double y, double z, double vx, double vy, double vz, dh tag) { makes.add("[" + x + "," + y + "," + z + "," + vx + "," + vy + "," + vz + "," + (tag == null ? "null" : nbt(tag)) + "]"); }
  }

  public static class Box extends zs { public boolean a(yz p) { return true; } }

  static Method itemById, stackTag;
  static Field gridStacks;

  static String q(String s) { return "\"" + s + "\""; }
  static String nbt(dy tag) {
    if (tag instanceof dh) {
      dh c = (dh) tag;
      List<String> keys = new ArrayList<>(c.c());
      Collections.sort(keys);
      StringBuilder s = new StringBuilder("{");
      for (int k = 0; k < keys.size(); k++) s.append(k > 0 ? "," : "").append(q(keys.get(k))).append(":").append(nbt(c.a(keys.get(k))));
      return s.append("}").toString();
    }
    if (tag instanceof dq) {
      dq l = (dq) tag;
      StringBuilder s = new StringBuilder("[");
      for (int k = 0; k < l.c(); k++) s.append(k > 0 ? "," : "").append(l.d() == 10 ? nbt(l.b(k)) : l.d() == 11 ? nbt(l.a(k)) : "null");
      return s.append("]").toString();
    }
    if (tag.a() == 11) {
      StringBuilder s = new StringBuilder("[");
      try {
        Field f = tag.getClass().getDeclaredField("b");
        f.setAccessible(true);
        int[] v = (int[]) f.get(tag);
        for (int k = 0; k < v.length; k++) s.append(k > 0 ? "," : "").append(v[k]);
      } catch (Exception e) { throw new RuntimeException(e); }
      return s.append("]").toString();
    }
    // Byte/short/int/long/float/double/string tags print their value via toString(): "1b", "5", "2.0f" ...
    String t = tag.toString();
    return t.replaceAll("[bslfd]$", "").replaceAll("^(.*[^0-9.\\-].*)$", "\"$1\"");
  }

  static adb item(int id) throws Exception { return (adb) itemById.invoke(null, id); }
  static add stack(int id, int damage) throws Exception { return new add(item(id), 1, damage); }
  static add fromNbt(int id, dh tag) throws Exception { add s = new add(item(id), 1, 0); s.d = tag; return s; }
  static dh compound(Object... kv) {
    dh c = new dh();
    for (int k = 0; k < kv.length; k += 2) {
      String key = (String) kv[k];
      Object v = kv[k + 1];
      if (v instanceof Byte) c.a(key, (byte) (Byte) v);
      else if (v instanceof Integer) c.a(key, (int) (Integer) v);
      else if (v instanceof int[]) c.a(key, (int[]) v);
      else if (v instanceof dy) c.a(key, (dy) v);
    }
    return c;
  }
  static dh explosion(int type, int[] colors, int[] fade, boolean flicker, boolean trail) {
    dh e = new dh();
    e.a("Type", (byte) type);
    e.a("Colors", colors);
    if (fade != null) e.a("FadeColors", fade);
    if (flicker) e.a("Flicker", (byte) 1);
    if (trail) e.a("Trail", (byte) 1);
    return e;
  }
  static dh fireworks(int flight, dh... explosions) {
    dh f = new dh();
    if (flight >= 0) f.a("Flight", (byte) flight);
    dq list = new dq();
    for (dh e : explosions) list.a(e);
    f.a("Explosions", list);
    dh root = new dh();
    root.a("Fireworks", f);
    return root;
  }

  // ---- recipe ----
  static final Map<String, add> named = new HashMap<>();
  static add token(String t) throws Exception {
    if (t.startsWith("dye:")) return stack(351, Integer.parseInt(t.substring(4)));
    switch (t) {
      case "gp": return stack(289, 0);
      case "paper": return stack(339, 0);
      case "glow": return stack(348, 0);
      case "diamond": return stack(264, 0);
      case "fire": return stack(385, 0);
      case "feather": return stack(288, 0);
      case "nugget": return stack(371, 0);
      case "skull": return stack(397, 0);
      case "stick": return stack(280, 0);
      case "bareStar": return stack(402, 0);
      default: return named.get(t);
    }
  }
  static String stackJson(add s) throws Exception {
    if (s == null) return "null";
    Object tag = stackTag.invoke(s);
    return "{\"id\":" + adb.b(s.b()) + ",\"count\":" + s.b + ",\"damage\":" + s.k() + ",\"tag\":" + (tag == null ? "null" : nbt((dy) tag)) + "}";
  }
  static aey recipe = new aey();
  static void recipe(String name, int size, int[] slots, String... tokens) throws Exception {
    Box container = (Box) U.allocateInstance(Box.class);
    aae grid = new aae(container, size, size);
    add[] cells = (add[]) gridStacks.get(grid);
    StringBuilder in = new StringBuilder("[");
    for (int k = 0; k < tokens.length; k++) {
      cells[slots == null ? k : slots[k]] = token(tokens[k]);
      in.append(k > 0 ? "," : "").append("{\"slot\":" + (slots == null ? k : slots[k]) + ",\"item\":" + stackJson(token(tokens[k])) + "}");
    }
    in.append("]");
    boolean matched = recipe.a(grid, (ahb) null);
    add result = matched ? recipe.a(grid) : null;
    if (result != null && name.startsWith("keep-")) named.put(name, result.m());
    System.out.println("{\"case\":\"recipe\",\"name\":" + q(name) + ",\"size\":" + size + ",\"input\":" + in + ",\"matched\":" + matched + ",\"result\":" + stackJson(result) + "}");
  }

  static void tooltip(String name, add s) throws Exception {
    List<String> lines = new ArrayList<>();
    ((adb) s.b()).a(s, null, lines, false);
    StringBuilder out = new StringBuilder("[");
    for (int k = 0; k < lines.size(); k++) out.append(k > 0 ? "," : "").append(q(lines.get(k).replace("§", "&")));
    out.append("]");
    String tint = "null";
    if (s.b() instanceof acr) tint = "[" + s.b().a(s, 0) + "," + s.b().a(s, 1) + "]";
    System.out.println("{\"case\":\"tooltip\",\"name\":" + q(name) + ",\"item\":" + stackJson(s) + ",\"lines\":" + out + ",\"tint\":" + tint
      + "}");
  }

  // ---- rocket ----
  static final long LCG_A = 0x5DEECE66DL;
  static void rocketRun(String name, add stack, boolean remote, int maxTicks) throws Exception {
    world.E = remote;
    sounds.clear(); states.clear(); makes.clear(); sparkCalls.clear();
    zf r = new zf(world, 10.5, 65.0, 10.5, stack);
    Random z = (Random) get(r, "Z");
    long post = raw(z);
    double vx0 = r.v, vy0 = r.w, vz0 = r.x;
    int life0 = i(r, "b");
    // Recover the pre-constructor state: replay gaussian, gaussian, nextInt(6), nextInt(7) from each candidate.
    long pre = -1;
    int draws = -1;
    for (int k = 1; k <= 80 && pre < 0; k++) {
      long cand = back(post, k);
      Random t = new Random(0);
      setRaw(t, cand);
      t.nextGaussian(); // consumed by the zf constructor in this order
      double gx = ((Random) copyAt(cand)).nextGaussian() * 0.001;
      Random t2 = (Random) copyAt(cand);
      double ax = t2.nextGaussian() * 0.001, az = t2.nextGaussian() * 0.001;
      int l = t2.nextInt(6) + t2.nextInt(7);
      int flight = 1;
      Object tag = stackTag.invoke(stack);
      if (tag != null && ((dh) tag).c("Fireworks")) { dh f = ((dh) tag).m("Fireworks"); if (f != null && f.c("Flight")) flight += f.d("Flight"); }
      if (ax == vx0 && az == vz0 && 10 * flight + l == life0 && raw(t2) == post) { pre = cand; draws = k; }
    }
    if (pre < 0) throw new IllegalStateException("could not recover the rocket constructor seed for " + name);
    int flightTicks = 0;
    StringBuilder rows = new StringBuilder();
    boolean dead = false;
    if (remote) maxTicks = Math.min(maxTicks, life0 + 1);
    while (flightTicks < maxTicks && !dead) {
      sparkCalls.clear();
      r.h();
      flightTicks++;
      dead = b(r, "K");
      rows.append(flightTicks > 1 ? "," : "").append("[").append(r.s).append(",").append(r.t).append(",").append(r.u).append(",").append(r.v).append(",")
        .append(r.w).append(",").append(r.x).append(",").append((double) r.y).append(",").append((double) r.z).append(",").append((double) r.A).append(",")
        .append((double) r.B).append(",").append(i(r, "a")).append(",").append(dead ? 1 : 0).append(",").append(sparkCalls.isEmpty() ? "null" : sparkCalls.get(0)).append("]");
    }
    // Entity.writeEntityToNBT
    dh out = new dh();
    r.b(out);
    System.out.println("{\"case\":\"rocket\",\"name\":" + q(name) + ",\"remote\":" + remote + ",\"seed\":" + pre + ",\"draws\":" + draws + ",\"stack\":" + stackJson(stack)
      + ",\"motion\":[" + vx0 + "," + vy0 + "," + vz0 + "],\"lifetime\":" + life0 + ",\"ticks\":" + flightTicks + ",\"rows\":[" + rows + "],\"sounds\":" + sounds
      + ",\"states\":" + states + ",\"nbt\":" + nbt(out) + "}");
  }
  static Object copyAt(long raw) throws Exception { Random t = new Random(0); setRaw(t, raw); return t; }

  // ---- starter ----
  static void viewerAt(sv viewer, double x, double y, double z) throws Exception { set(viewer, "s", x); set(viewer, "t", y); set(viewer, "u", z); }
  static String spark(bkm p) throws Exception {
    boolean isSpark = p instanceof bkd;
    long seed = back(raw((Random) get(p, "Z")), isSpark ? 5 : 4);
    StringBuilder s = new StringBuilder("{\"kind\":" + q(isSpark ? "spark" : "overlay") + ",\"seed\":" + seed
      + ",\"pos\":[" + p.s + "," + p.t + "," + p.u + "],\"motion\":[" + p.v + "," + p.w + "," + p.x + "]"
      + ",\"rgb\":[" + (double) fl(p, "at") + "," + (double) fl(p, "au") + "," + (double) fl(p, "av") + "],\"alpha\":" + (double) fl(p, "aw")
      + ",\"scale\":" + (double) fl(p, "h") + ",\"maxAge\":" + i(p, "g") + ",\"layer\":" + p.a());
    if (isSpark) s.append(",\"trail\":" + b(p, "aB") + ",\"twinkle\":" + b(p, "aC") + ",\"hasFade\":" + b(p, "aH")
      + ",\"fade\":[" + (double) fl(p, "aE") + "," + (double) fl(p, "aF") + "," + (double) fl(p, "aG") + "]");
    return s.append("}").toString();
  }
  @SuppressWarnings("unchecked")
  static List<bkm>[] layers() throws Exception { return (List<bkm>[]) get(effects, "c"); }
  static List<bkm> all() throws Exception { List<bkm> out = new ArrayList<>(); for (List<bkm> l : layers()) out.addAll(l); return out; }
  static void clearEffects() throws Exception { for (List<bkm> l : layers()) l.clear(); }
  static final long M = 0x2545F4914F6CL;

  static void starter(String name, dh root, double viewerDistance, int seedBase) throws Exception {
    dh tag = root == null ? null : root.m("Fireworks");
    clearEffects();
    cells.clear();
    world.E = true;
    sounds.clear();
    setRaw(mathRandom, M + seedBase);
    viewerAt(viewer, 10.5 + viewerDistance, 70.0, 10.5);
    long math = raw(mathRandom);
    bke s = new bke(world, 10.5, 70.0, 10.5, 0.01, 0.2, -0.02, effects, tag);
    long seed = back(raw((Random) get(s, "Z")), 4);
    int life = i(s, "g");
    boolean twinkleFlag = b(s, "a");
    StringBuilder created = new StringBuilder();
    List<String> starterSounds = new ArrayList<>();
    int tick = 0, total = 0;
    // Phase A: starter.h() alone; every particle it creates is reported at creation.
    StringBuilder perTick = new StringBuilder();
    while (!s.K && tick < 60) {
      List<bkm> before = all();
      sounds.clear();
      s.h();
      List<bkm> after = all();
      StringBuilder row = new StringBuilder();
      int n = 0;
      for (bkm p : after) if (!before.contains(p)) { row.append(n++ > 0 ? "," : "").append(spark(p)); }
      total += n;
      perTick.append(tick > 0 ? "," : "").append("{\"tick\":" + tick + ",\"age\":" + i(s, "aB") + ",\"sounds\":" + sounds + ",\"made\":[" + row + "]}");
      tick++;
    }
    System.out.println("{\"case\":\"starter\",\"name\":" + q(name) + ",\"tag\":" + (tag == null ? "null" : nbt(tag)) + ",\"viewer\":" + viewerDistance
      + ",\"math\":" + math + ",\"seed\":" + seed + ",\"lifetime\":" + life + ",\"twinkle\":" + twinkleFlag + ",\"ticks\":" + tick + ",\"total\":" + total + ",\"events\":[" + perTick + "]}");
    clearEffects();
  }

  // Full lifecycle through the real EffectRenderer: counts and a position checksum per tick, plus tracks of a few sparks.
  static void lifecycle(String name, dh root, int seedBase) throws Exception {
    dh tag = root == null ? null : root.m("Fireworks");
    clearEffects();
    cells.clear();
    world.E = true;
    setRaw(mathRandom, M + seedBase);
    viewerAt(viewer, 15.5, 70.0, 10.5);
    long math = raw(mathRandom);
    bke s = new bke(world, 10.5, 70.0, 10.5, 0.01, 0.2, -0.02, effects, tag);
    long seed = back(raw((Random) get(s, "Z")), 4);
    effects.a(s);
    StringBuilder rows = new StringBuilder(), seeds = new StringBuilder();
    Set<bkm> seen = Collections.newSetFromMap(new IdentityHashMap<>());
    seen.add(s);
    List<bkm> tracked = new ArrayList<>();
    List<StringBuilder> tracks = new ArrayList<>();
    for (int t = 0; t < 140; t++) {
      effects.a();
      List<bkm> live = all();
      if (live.isEmpty()) break;
      for (bkm p : live) if (seen.add(p)) seeds.append(seeds.length() > 0 ? "," : "").append(back(raw((Random) get(p, "Z")), p instanceof bkd ? 5 : 4));
      int sparks = 0, overlays = 0;
      double sx = 0, sy = 0, sz = 0, alpha = 0;
      for (bkm p : live) {
        if (p instanceof bkd) {
          sparks++; sx += p.s; sy += p.t; sz += p.u; alpha += fl(p, "aw");
          if (tracked.size() < 4 && !tracked.contains(p) && (tracked.size() < 2 || (p instanceof bkd && b(p, "aB") && tracked.size() < 4) || tracked.size() >= 2)) { tracked.add(p); tracks.add(new StringBuilder()); }
        } else if (p instanceof bkc) overlays++;
      }
      rows.append(t > 0 ? "," : "").append("[" + sparks + "," + overlays + "," + sx + "," + sy + "," + sz + "," + alpha + "]");
      for (int k = 0; k < tracked.size(); k++) {
        bkm p = tracked.get(k);
        StringBuilder tr = tracks.get(k);
        tr.append(tr.length() > 0 ? "," : "").append("[" + t + "," + p.s + "," + p.t + "," + p.u + "," + p.v + "," + p.w + "," + p.x + "," + i(p, "f") + "," + (double) fl(p, "aw")
          + "," + (double) fl(p, "at") + "," + (double) fl(p, "au") + "," + (double) fl(p, "av") + "," + (i(p, "b") + i(p, "c") * 16) + "," + (b(p, "K") ? 1 : 0) + "]");
      }
    }
    StringBuilder tk = new StringBuilder();
    for (int k = 0; k < tracks.size(); k++) tk.append(k > 0 ? "," : "").append("[").append(tracks.get(k)).append("]");
    System.out.println("{\"case\":\"lifecycle\",\"name\":" + q(name) + ",\"tag\":" + nbt(tag) + ",\"math\":" + math + ",\"seed\":" + seed + ",\"seeds\":[" + seeds + "],\"rows\":[" + rows + "],\"tracks\":[" + tk + "]}");
    clearEffects();
  }

  static sv viewer;

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    U = (sun.misc.Unsafe) uf.get(null);
    seedField = Random.class.getDeclaredField("seed");
    seedField.setAccessible(true);
    Math.random();
    Field holder = Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
    holder.setAccessible(true);
    mathRandom = (Random) holder.get(null);
    aji.p();
    adb.l();
    world = (PWorld) U.allocateInstance(FW.class);
    set(world, "s", new Random(7));
    set(world, "t", U.allocateInstance(aqq.class));
    set(world, "C", new qi());
    world.E = true;
    effects = new bkn(world, null);
    render = (bma) U.allocateInstance(bma.class);
    bao mc = (bao) U.allocateInstance(bao.class);
    mc.k = effects;
    viewer = (sv) U.allocateInstance(wo.class);
    mc.i = viewer;
    set(render, "A", mc);
    set(render, "r", world);
    Field mcStatic = bao.class.getDeclaredField("M");
    mcStatic.setAccessible(true);
    mcStatic.set(null, mc);

    for (Method m : adb.class.getDeclaredMethods())
      if (java.lang.reflect.Modifier.isStatic(m.getModifiers()) && m.getReturnType() == adb.class && Arrays.equals(m.getParameterTypes(), new Class<?>[] { int.class })) { m.setAccessible(true); itemById = m; }
    for (Method m : add.class.getDeclaredMethods()) if (m.getReturnType() == dh.class && m.getParameterCount() == 0) { m.setAccessible(true); stackTag = m; break; }
    for (Field f : aae.class.getDeclaredFields()) if (f.getType() == add[].class) { f.setAccessible(true); gridStacks = f; }
    if (itemById == null || stackTag == null || gridStacks == null) throw new IllegalStateException("reflection lookup failed");

    // Facts: item ids, ItemDye colours (acj.c), item registry names.
    int[] dye = null;
    for (Field f : acj.class.getDeclaredFields()) if (f.getType() == int[].class && java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); dye = (int[]) f.get(null); }
    StringBuilder dyes = new StringBuilder("[");
    for (int k = 0; k < dye.length; k++) dyes.append(k > 0 ? "," : "").append(dye[k]);
    System.out.println("{\"case\":\"facts\",\"dyeColors\":" + dyes + "],\"rocketId\":" + adb.b(item(401)) + ",\"starId\":" + adb.b(item(402))
      + ",\"rocketClass\":" + q(item(401).getClass().getName()) + ",\"starClass\":" + q(item(402).getClass().getName()) + "}");

    // Recipes. Star: gunpowder + dyes (+ effects, + one shape).
    for (int d = 0; d < 16; d++) recipe("star-dye-" + d, 3, null, "gp", "dye:" + d);
    for (int a : new int[] { 1, 4, 15 }) for (int c : new int[] { 0, 2, 11 }) recipe("star-pair-" + a + "-" + c, 3, null, "gp", "dye:" + a, "dye:" + c);
    recipe("star-scatter", 3, new int[] { 8, 2, 4 }, "dye:6", "gp", "dye:14");
    recipe("star-three-dyes-2x2", 2, null, "gp", "dye:1", "dye:2", "dye:4");
    recipe("star-2x2", 2, null, "gp", "dye:5");
    recipe("star-glow", 3, null, "gp", "dye:1", "glow");
    recipe("star-diamond", 3, null, "gp", "dye:1", "diamond");
    recipe("star-glow-diamond", 3, null, "gp", "dye:1", "glow", "diamond");
    for (String shape : new String[] { "fire", "feather", "nugget", "skull" }) {
      recipe("star-" + shape, 3, null, "gp", "dye:1", shape);
      recipe("star-" + shape + "-glow-diamond", 3, null, "gp", "dye:11", "dye:4", shape, "glow", "diamond");
    }
    recipe("star-two-shapes", 3, null, "gp", "dye:1", "fire", "feather");
    recipe("star-no-dye", 3, null, "gp");
    recipe("star-no-dye-glow", 3, null, "gp", "glow");
    recipe("star-two-gp", 3, null, "gp", "gp", "dye:1");
    recipe("star-with-paper", 3, null, "gp", "paper", "dye:1");
    recipe("star-with-stick", 3, null, "gp", "dye:1", "stick");
    recipe("keep-star-red", 3, null, "gp", "dye:1");
    recipe("keep-star-blue-fire", 3, null, "gp", "dye:4", "fire", "glow");
    recipe("keep-star-multi", 3, null, "gp", "dye:11", "dye:5", "dye:2", "feather", "diamond", "glow");
    recipe("keep-star-creeper", 3, null, "gp", "dye:2", "skull");
    recipe("keep-star-burst", 3, null, "gp", "dye:15", "feather");
    recipe("keep-star-star", 3, null, "gp", "dye:14", "nugget", "glow");
    // Rocket: paper + 1-3 gunpowder + stars.
    for (int g = 0; g <= 4; g++) {
      String[] t = new String[1 + g];
      t[0] = "paper";
      for (int k = 0; k < g; k++) t[1 + k] = "gp";
      recipe("rocket-gp-" + g, 3, null, t);
    }
    recipe("rocket-1-star", 3, null, "paper", "gp", "keep-star-red");
    recipe("rocket-2-stars", 3, null, "paper", "gp", "gp", "keep-star-red", "keep-star-blue-fire");
    recipe("rocket-3-stars-2x2", 3, new int[] { 0, 3, 4, 8 }, "paper", "gp", "keep-star-red", "keep-star-multi");
    recipe("rocket-7-stars", 3, null, "paper", "gp", "gp", "gp", "keep-star-red", "keep-star-blue-fire", "keep-star-multi", "keep-star-creeper", "keep-star-burst");
    recipe("rocket-bare-star", 3, null, "paper", "gp", "bareStar", "keep-star-red");
    recipe("rocket-two-paper", 3, null, "paper", "paper", "gp");
    recipe("rocket-with-dye", 3, null, "paper", "gp", "dye:1");
    recipe("rocket-with-glow", 3, null, "paper", "gp", "glow");
    recipe("rocket-with-stick", 3, null, "paper", "gp", "stick");
    recipe("rocket-no-paper-stars", 3, null, "gp", "keep-star-red", "keep-star-blue-fire");
    recipe("rocket-2x2", 2, null, "paper", "gp", "keep-star-red");
    // Fade: one star + dyes.
    recipe("fade-1", 3, null, "keep-star-red", "dye:4");
    recipe("fade-2", 3, null, "keep-star-blue-fire", "dye:1", "dye:11");
    recipe("fade-multi", 3, null, "dye:2", "keep-star-multi", "dye:6", "dye:15", "dye:0");
    recipe("fade-bare-star", 3, null, "bareStar", "dye:4");
    recipe("fade-no-dye", 3, null, "keep-star-red");
    recipe("fade-two-stars", 3, null, "keep-star-red", "keep-star-blue-fire", "dye:4");
    recipe("fade-with-gp", 3, null, "keep-star-red", "gp", "dye:4");
    recipe("fade-with-glow", 3, null, "keep-star-red", "dye:4", "glow");
    recipe("fade-with-shape", 3, null, "keep-star-red", "dye:4", "fire");
    recipe("fade-with-paper", 3, null, "keep-star-red", "dye:4", "paper");
    recipe("empty", 3, null);

    // Tooltips and tints (acr/acs with the English language table).
    int[] red = { 0xB3312C }, blue = { 3949738 }, three = { 0xB3312C, 0x3B511A, 0x253192 }, custom = { 0x123456 };
    tooltip("star-small", fromNbt(402, compound("Explosion", explosion(0, red, null, false, false))));
    tooltip("star-large-fade", fromNbt(402, compound("Explosion", explosion(1, blue, new int[] { 0xB3312C, 0x123456 }, true, true))));
    tooltip("star-star-multi", fromNbt(402, compound("Explosion", explosion(2, three, null, true, false))));
    tooltip("star-creeper-trail", fromNbt(402, compound("Explosion", explosion(3, custom, null, false, true))));
    tooltip("star-burst", fromNbt(402, compound("Explosion", explosion(4, red, null, false, false))));
    tooltip("star-unknown-type", fromNbt(402, compound("Explosion", explosion(9, red, null, false, false))));
    tooltip("star-no-colors", fromNbt(402, compound("Explosion", compound("Type", (byte) 1))));
    tooltip("star-bare", stack(402, 0));
    tooltip("rocket-bare", stack(401, 0));
    tooltip("rocket-flight-2", fromNbt(401, fireworks(2)));
    tooltip("rocket-one", fromNbt(401, fireworks(1, explosion(1, red, null, false, false))));
    tooltip("rocket-two", fromNbt(401, fireworks(3, explosion(0, red, new int[] { 3949738 }, false, true), explosion(4, three, null, true, false))));

    // Rockets: lifetime and flight (server: death, state 17; client: spark trail).
    for (int pass = 0; pass < 2; pass++) {
      for (int flight : new int[] { -1, 0, 1, 2, 3 }) {
        dh tag = flight < 0 ? null : fireworks(flight, explosion(1, red, null, false, false));
        add s = tag == null ? stack(401, 0) : fromNbt(401, tag);
        rocketRun("flight-" + flight + (pass == 0 ? "-server" : "-client"), s, pass == 1, 120);
      }
    }
    rocketRun("flight-1-server-b", fromNbt(401, fireworks(1, explosion(2, three, null, true, true))), false, 120);
    rocketRun("flight-2-server-b", fromNbt(401, fireworks(2, explosion(2, three, null, true, true))), false, 120);

    // Starter shapes (viewer inside 16 blocks unless noted).
    dh small = fireworks(1, explosion(0, red, null, false, false));
    starter("small-ball", small, 5, 1);
    starter("large-ball-fade-trail-twinkle", fireworks(1, explosion(1, blue, new int[] { 0xB3312C }, true, true)), 5, 2);
    starter("star", fireworks(1, explosion(2, three, null, false, false)), 5, 3);
    starter("star-trail", fireworks(1, explosion(2, red, new int[] { 3949738, 0x123456 }, false, true)), 5, 4);
    starter("creeper", fireworks(1, explosion(3, red, null, false, false)), 5, 5);
    starter("creeper-trail", fireworks(1, explosion(3, three, null, true, true)), 5, 6);
    starter("burst", fireworks(1, explosion(4, three, new int[] { 3949738 }, false, false)), 5, 7);
    starter("two-explosions", fireworks(2, explosion(0, red, null, false, false), explosion(4, blue, null, true, false)), 5, 8);
    starter("three-small", fireworks(3, explosion(0, red, null, false, false), explosion(0, blue, null, false, false), explosion(0, three, null, false, false)), 5, 9);
    starter("large-in-three", fireworks(3, explosion(0, red, null, false, false), explosion(0, blue, null, false, false), explosion(1, three, null, false, false)), 5, 10);
    starter("small-far", small, 100, 11);
    starter("large-twinkle-far", fireworks(1, explosion(1, red, null, true, false)), 100, 12);
    starter("twinkle-edge", fireworks(1, explosion(0, red, null, true, false)), 16, 13);
    starter("empty-list", fireworks(1), 5, 14);
    starter("null-tag", null, 5, 15);
    // An explosion without Colors makes createParticle call Random.nextInt(0): the original throws (recorded, not replayed).
    try { starter("no-colors", fireworks(1, compound("Type", (byte) 0)), 5, 16); } catch (IllegalArgumentException e) { System.out.println("{\"case\":\"starterThrows\",\"name\":\"no-colors\",\"message\":" + q(e.getMessage()) + "}"); }

    // Lifecycles through EffectRenderer.updateEffects.
    lifecycle("small-ball", small, 21);
    lifecycle("large-ball-fade-trail-twinkle", fireworks(1, explosion(1, blue, new int[] { 0xB3312C }, true, true)), 22);
    lifecycle("star-trail", fireworks(1, explosion(2, red, new int[] { 3949738, 0x123456 }, false, true)), 23);
    lifecycle("creeper-twinkle", fireworks(1, explosion(3, three, null, true, false)), 24);
    lifecycle("burst-fade", fireworks(1, explosion(4, three, new int[] { 3949738 }, false, false)), 25);
    lifecycle("two-explosions", fireworks(2, explosion(0, red, null, false, false), explosion(4, blue, null, true, false)), 26);
  }
}
