import java.lang.reflect.*;
import java.util.*;
import java.util.function.Function;

// PLAN-03b (second pass): executes every World/IBlockAccess-taking method declared in a block's own class chain
// (instance or static, any access, overrides included), plus the inherited Block.dropBlockAsItemWithChance
// (aji.a(Lahb;IIIIFI)V) and Block.createStackedBlock (aji.j(I)Ladd;), for raw metadata 0-15. Each call runs in a
// fresh map-backed World double (R, extending PlantProbe.W) in four scenarios:
//   iso  - the block at (8,64,8) with the metadata under test, air elsewhere;
//   enc  - the same, enclosed by stone on all six sides;
//   same - the same, with all six neighbours holding the same block and metadata;
//   role - the block at (8,64,8) with metadata 0 and all six neighbours holding the metadata under test
//          (how the block's own code reads a neighbouring copy of itself).
// A method whose role outcome varies with the value reads neighbouring copies; it additionally runs the full matrix
// nb<n> (centre = value under test, neighbours = metadata n, n = 0-15) and role<n> (centre = n, neighbours = value
// under test, n = 1-15).
// Arguments are synthesised from the parameter types: coordinates (8,64,8), known metadata parameters (breakBlock,
// dropBlockAsItemWithChance, onPostBlockPlaced, onBlockPreDestroy, ...) get the value under test, free ints take 0-5,
// booleans false/true, Random arguments five variants (seeds 0-2, ModeRandom MIN and MAX: every draw at its lowest or
// highest value) with World.rand set to a matching instance; methods without a Random parameter run under three
// World.rand variants (seed 2, MIN, MAX). Block arguments are self/stone/air, a 3x3x3 AABB, fixed ray pairs for
// collisionRayTrace and the block's own ItemStack. Entity/player arguments are passed as an allocated player double
// (PL) when the type is assignable, otherwise the method is skipped with the reason recorded; the player holds one
// of: nothing, the block's own item, a red flower, a water bucket, a glass bottle or bone meal (HELD). Argument
// combinations are the full product when it has at most 72 entries, otherwise one dimension at a time from the
// all-first base. The outcome of a call is its rendered return value, the written cells of the world (changed or
// rewritten), every recorded World side effect (scheduled ticks, block events, notifications, tile-entity queries,
// particles, sounds, aux effects, spawned entities), mutated list arguments and the held stack. Each call runs
// twice in separate passes; a difference is recorded as NONDET. Block instance fields are restored before every
// call. Exceptions are recorded as EXC:<class>@<first non-JDK frame>; nothing is swallowed silently.
public class BlockMetadataExtProbe {
  static final int X = 8, Y = 64, Z = 8;
  static final int[][] OFF = {{0, -1, 0}, {0, 1, 0}, {0, 0, -1}, {0, 0, 1}, {-1, 0, 0}, {1, 0, 0}};
  static final String[] SCEN = {"iso", "enc", "same", "role"};
  static final Map<String, Integer> META_PARAM = new HashMap<>();
  static {
    META_PARAM.put("a:(Lahb;IIILaji;I)V", 5); // breakBlock
    META_PARAM.put("a:(Lahb;IIIIFI)V", 4); // dropBlockAsItemWithChance
    META_PARAM.put("b:(Lahb;IIIII)V", 4); // dropBlockAsItem
    META_PARAM.put("a:(Lahb;Lyz;IIII)V", 5); // harvestBlock
    META_PARAM.put("b:(Lahb;IIII)V", 4); // onBlockDestroyedByPlayer
    META_PARAM.put("a:(Lahb;IIIILyz;)V", 4); // onBlockHarvested
    META_PARAM.put("e:(Lahb;IIII)V", 4); // onPostBlockPlaced (func_149714_e)
    META_PARAM.put("f:(Lahb;IIII)V", 4); // onBlockPreDestroy (func_149725_f)
  }

  public static class R extends PlantProbe.W {
    List<String> log = new ArrayList<>();
    void rec(String s) { if (log.size() < 400) log.add(s); }
    // Cells written by the call (setBlock/setBlockMetadata), so a write of an unchanged value still shows its final state.
    Set<Long> written = new HashSet<>();
    void put(int x, int y, int z, int id, int meta) { written.add(key(x, y, z)); super.put(x, y, z, id, meta); }
    static String at(int x, int y, int z) { return x + "," + y + "," + z; }
    public void a(int x, int y, int z, aji b, int delay) { rec("tick " + at(x, y, z) + "," + aji.b(b) + "," + delay); }
    public void b(int x, int y, int z, aji b, int delay, int prio) { rec("tickp " + at(x, y, z) + "," + aji.b(b) + "," + delay + "," + prio); }
    public void c(int x, int y, int z, aji b, int e, int d) { rec("event " + at(x, y, z) + "," + aji.b(b) + "," + e + "," + d); }
    public void d(int x, int y, int z, aji b) { rec("notify " + at(x, y, z) + "," + aji.b(b)); }
    public void e(int x, int y, int z, aji b) { rec("notify1 " + at(x, y, z) + "," + aji.b(b)); }
    public void b(int x, int y, int z, aji b, int side) { rec("notifyx " + at(x, y, z) + "," + aji.b(b) + "," + side); }
    public void f(int x, int y, int z, aji b) { rec("cnotify " + at(x, y, z) + "," + aji.b(b)); }
    public void g(int x, int y, int z) { rec("mark " + at(x, y, z)); }
    public void c(int a, int b, int c, int d, int e, int f) { rec("rerender"); }
    public aor o(int x, int y, int z) { rec("te? " + at(x, y, z)); teQueried = true; return null; }
    public void a(int x, int y, int z, aor t) { rec("te= " + at(x, y, z) + " " + (t == null ? "null" : t.getClass().getName())); }
    public void p(int x, int y, int z) { rec("te- " + at(x, y, z)); }
    public void a(String n, double x, double y, double z, double a, double b, double c) { rec("particle " + n + " " + x + "," + y + "," + z + "," + a + "," + b + "," + c); }
    public void a(double x, double y, double z, String s, float v, float pi) { rec("sound " + s + " " + x + "," + y + "," + z + "," + v + "," + pi); }
    public void a(double x, double y, double z, String s, float v, float pi, boolean d) { rec("sound " + s + " " + x + "," + y + "," + z + "," + v + "," + pi + "," + d); }
    public void a(sa e, String s, float v, float pi) { rec("esound " + s + "," + v + "," + pi); }
    public void c(int type, int x, int y, int z, int data) { rec("aux " + type + " " + at(x, y, z) + "," + data); }
    public void a(yz pl, int type, int x, int y, int z, int data) { rec("aux* " + type + " " + at(x, y, z) + "," + data); }
    public boolean d(sa e) { rec("spawn " + entity(e)); return true; }
    public int k(int x, int y, int z) { return 15; } // getBlockLightValue
    public int j(int x, int y, int z) { return 15; } // getFullBlockLightValue
    public int b(ahn t, int x, int y, int z) { return 15; } // getSavedLightValue
    public boolean i(int x, int y, int z) { return true; } // canBlockSeeTheSky
    public ahu a(int x, int z) { return ahu.d(1); } // plains
    public int h(int x, int z) { return 0; } // precipitation height
    public int c(int x, int y, int z, int l) { return 0xF000F0; }
    public float n(int x, int y, int z) { return 1f; }
    public boolean Q() { return false; } // isRaining
    public boolean P() { return false; } // isThundering
    public boolean w() { return true; } // isDaytime
    public boolean d(int x, int y, int z) { return true; } // blockExists
    // isBlockNormalCubeDefault: the loaded-chunk branch of the original (material opaque and renders as a normal block).
    public boolean c(int x, int y, int z, boolean dflt) { aji b = a(x, y, z); return b.o().k() && b.d(); }
    public boolean a(int x, int y, int z, int r) { return true; } // doChunksNearChunkExist
    public yz a(double x, double y, double z, double d) { return null; } // getClosestPlayer
    public yz b(double x, double y, double z, double d) { return null; }
    public yz a(sa e, double d) { return null; }
    public yz b(sa e, double d) { return null; }
  }

  static R world(aji b, int meta, int scen) throws Exception {
    sun.misc.Unsafe u = PlantProbe.unsafe;
    R w = (R) u.allocateInstance(R.class);
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "x").set(w, u.allocateInstance(ays.class)); // WorldInfo with zeroed fields (time 0, no rain)
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, false);
    w.cells = new HashMap<>();
    w.spawned = new ArrayList<>();
    w.scheduled = new ArrayList<>();
    w.sets = new ArrayList<>();
    w.log = new ArrayList<>();
    w.written = new HashSet<>();
    w.base = (x, y, z) -> new int[] {y < 0 ? 1 : 0, 0};
    int id = aji.b(b);
    // Scenario codes: 0-3 as SCEN; 4+n = "nb<n>" (centre = value, neighbours = same block with metadata n);
    // 20+n = "role<n>" (centre = metadata n, neighbours = same block with the value).
    int centre = scen == 3 ? 0 : scen >= 20 ? scen - 20 : meta;
    int nb = scen >= 20 ? meta : scen >= 4 ? scen - 4 : meta;
    w.put(X, Y, Z, id, centre);
    if (scen > 0) for (int[] o : OFF) {
      if (scen == 1) w.put(X + o[0], Y + o[1], Z + o[2], 1, 0);
      else w.put(X + o[0], Y + o[1], Z + o[2], id, nb);
    }
    return w;
  }

  // ---- rendering (deterministic: no identity hashes, no entity ids/UUIDs, no Math.random-driven fields) ----
  static String entity(sa e) {
    try {
      StringBuilder s = new StringBuilder(e.getClass().getName()).append('@')
        .append(MobMoveProbe.d(e, "s")).append(',').append(MobMoveProbe.d(e, "t")).append(',').append(MobMoveProbe.d(e, "u"));
      if (e instanceof xk) { add st = ((xk) e).f(); s.append(" stack:").append(adb.b(st.b())).append(':').append(st.b).append(':').append(st.k()); }
      else for (Field f : e.getClass().getDeclaredFields()) {
        if (Modifier.isStatic(f.getModifiers())) continue;
        Class<?> t = f.getType();
        if (t == int.class || t == boolean.class || t == aji.class) { f.setAccessible(true); s.append(' ').append(f.getName()).append('=').append(render(f.get(e), 0)); }
      }
      return s.toString();
    } catch (Throwable t) { return "entity:" + e.getClass().getName() + ":unrenderable"; }
  }

  static String render(Object o, int depth) {
    if (o == null) return "null";
    if (o instanceof Number || o instanceof Boolean || o instanceof String || o instanceof Character) return String.valueOf(o);
    if (o instanceof Enum) return ((Enum<?>) o).name();
    if (Proxy.isProxyClass(o.getClass())) return o.toString();
    if (o instanceof aji) return "block:" + aji.b((aji) o);
    if (o instanceof adb) return "item:" + adb.b((adb) o);
    if (o instanceof add) { add s = (add) o; return "stack:" + adb.b(s.b()) + ":" + s.b + ":" + s.k(); }
    if (o instanceof azt) { azt b = (azt) o; return "box[" + b.a + "," + b.b + "," + b.c + "," + b.d + "," + b.e + "," + b.f + "]"; }
    if (o instanceof azw) { azw v = (azw) o; return "vec(" + v.a + "," + v.b + "," + v.c + ")"; }
    if (o instanceof sa) return entity((sa) o);
    if (o instanceof Collection) {
      StringBuilder s = new StringBuilder("[");
      for (Object x : (Collection<?>) o) s.append(s.length() > 1 ? "," : "").append(render(x, depth + 1));
      return s.append(']').toString();
    }
    if (o.getClass().isArray()) {
      StringBuilder s = new StringBuilder("[");
      for (int i = 0; i < Array.getLength(o); i++) s.append(i > 0 ? "," : "").append(render(Array.get(o, i), depth + 1));
      return s.append(']').toString();
    }
    if (depth > 2) return o.getClass().getName();
    StringBuilder s = new StringBuilder(o.getClass().getName()).append('{');
    for (Class<?> c = o.getClass(); c != null && c != Object.class; c = c.getSuperclass())
      for (Field f : c.getDeclaredFields()) {
        if (Modifier.isStatic(f.getModifiers())) continue;
        try { f.setAccessible(true); s.append(f.getName()).append('=').append(render(f.get(o), depth + 1)).append(';'); } catch (Throwable t) { s.append(f.getName()).append("=?;"); }
      }
    return s.append('}').toString();
  }

  static String exc(Throwable t) {
    Throwable c = t instanceof InvocationTargetException && t.getCause() != null ? t.getCause() : t;
    // First two non-JDK frames: the faulting method and its caller.
    StringBuilder frame = new StringBuilder();
    for (StackTraceElement e : c.getStackTrace()) {
      String n = e.getClassName();
      if (n.startsWith("java.") || n.startsWith("jdk.") || n.startsWith("sun.")) continue;
      frame.append(frame.length() > 0 ? "<" : "").append(n).append('.').append(e.getMethodName());
      if (frame.indexOf("<") >= 0) break;
    }
    return "EXC:" + c.getClass().getName() + "@" + (frame.length() > 0 ? frame : "?");
  }

  // ---- argument synthesis ----
  static class Ctx { R w; int meta; aji b; adb item; yx inv; List<Object> lists = new ArrayList<>(); }
  static final double[][][] RAYS = {
    {{8.5, 66, 8.5}, {8.5, 63, 8.5}}, {{8.5, 63, 8.5}, {8.5, 66, 8.5}},
    {{6.5, 64.25, 8.5}, {10.5, 64.25, 8.5}}, {{10.5, 64.75, 8.5}, {6.5, 64.75, 8.5}},
    {{8.5, 64.75, 6.5}, {8.5, 64.75, 10.5}}, {{8.5, 64.25, 10.5}, {8.5, 64.25, 6.5}},
    {{7.0, 65.9, 7.0}, {10.0, 63.1, 10.0}}};

  // Extreme random draws: every nextInt(n) returns 0 (MIN) or n-1 (MAX), floats/doubles 0 or just below 1, so branches
  // guarded by rare draws (rand.nextInt(k) == 0, age increments) are reached. Capped so draw loops cannot spin forever.
  static class ModeRandom extends Random {
    final boolean max; int draws;
    ModeRandom(boolean max) { super(0); this.max = max; }
    void draw() { if (++draws > 10000) throw new IllegalStateException("probe: random draw cap"); }
    @Override protected int next(int bits) { draw(); return max ? (int) ((1L << bits) - 1) : 0; }
    @Override public int nextInt(int n) { if (n <= 0) throw new IllegalArgumentException("bound must be positive"); draw(); return max ? n - 1 : 0; }
    @Override public int nextInt() { draw(); return max ? Integer.MAX_VALUE : 0; }
    @Override public long nextLong() { draw(); return max ? Long.MAX_VALUE : 0L; }
    @Override public float nextFloat() { draw(); return max ? 0.99999994f : 0f; }
    @Override public double nextDouble() { draw(); return max ? 0.9999999999999999 : 0d; }
    @Override public boolean nextBoolean() { draw(); return max; }
    @Override public synchronized double nextGaussian() { draw(); return max ? 1.0 : 0.0; }
  }
  // Random variants: seeds 0-2, MIN, MAX. The world's own Random (World.rand) is set to a fresh instance of the same
  // variant, so code drawing from either source sees the same kind of draws.
  static final int RANDOMS = 5;
  static Random random(int k) { return k < 3 ? new Random(k) : new ModeRandom(k == 4); }
  static void worldRandom(Ctx c, int k) {
    try { MobMoveProbe.set(c.w, "s", k == 0 ? new Random(2) : k == 1 ? new ModeRandom(false) : new ModeRandom(true)); }
    catch (Exception e) { throw new RuntimeException(e); }
  }

  static class Spec {
    // params: one list per method argument, then one pseudo-parameter (World.rand variant) that is not passed.
    Method m; String key; int nArgs; List<List<Function<Ctx, Object>>> params = new ArrayList<>(); List<int[]> combos = new ArrayList<>();
    Object[] args(Ctx c, int[] combo) {
      Object[] a = new Object[nArgs];
      for (int i = 0; i < params.size(); i++) { Object v = params.get(i).get(combo[i]).apply(c); if (i < nArgs) a[i] = v; }
      return a;
    }
  }

  static String key(Method m) {
    StringBuilder d = new StringBuilder("(");
    for (Class<?> p : m.getParameterTypes()) d.append(desc(p));
    return m.getName() + ":" + d.append(')').append(desc(m.getReturnType()));
  }
  static String desc(Class<?> c) {
    if (c.isArray()) return "[" + desc(c.getComponentType());
    if (c == int.class) return "I"; if (c == boolean.class) return "Z"; if (c == float.class) return "F"; if (c == double.class) return "D";
    if (c == long.class) return "J"; if (c == byte.class) return "B"; if (c == short.class) return "S"; if (c == char.class) return "C"; if (c == void.class) return "V";
    return "L" + c.getName().replace('.', '/') + ";";
  }

  static Object player;
  static boolean teQueried; // set by R.o (getTileEntity) during the current field
  static List<Function<Ctx, Object>> one(Function<Ctx, Object> f) { List<Function<Ctx, Object>> l = new ArrayList<>(); l.add(f); return l; }

  // Returns null with reason in why[0] when a parameter type is not synthesised.
  static Spec spec(Method m, String[] why) {
    Spec s = new Spec();
    s.m = m;
    s.key = key(m);
    Class<?>[] P = m.getParameterTypes();
    int worldIdx = -1;
    for (int i = 0; i < P.length; i++) if (P[i] == ahb.class || P[i] == ahl.class) { worldIdx = i; break; }
    if (worldIdx < 0) { why[0] = "no World/IBlockAccess parameter"; return null; }
    Integer metaIdx = META_PARAM.get(s.key);
    int coords = 0, vecs = 0, vecIdx = 0;
    boolean freeIntSeen = false, randomSeen = false, blockSeen = false;
    for (int i = 0; i < P.length; i++) if (P[i] == azw.class) vecs++;
    for (int i = 0; i < P.length; i++) {
      Class<?> t = P[i];
      final int idx = i;
      if (t == ahb.class || t == ahl.class) s.params.add(one(c -> c.w));
      else if (t == int.class && i > worldIdx && coords < 3) { final int v = coords == 0 ? X : coords == 1 ? Y : Z; coords++; s.params.add(one(c -> v)); }
      else if (t == int.class && metaIdx != null && metaIdx == i) s.params.add(one(c -> c.meta));
      else if (t == int.class) {
        List<Function<Ctx, Object>> l = new ArrayList<>();
        int n = freeIntSeen ? 1 : 6;
        for (int k = 0; k < n; k++) { final int v = k; l.add(c -> v); }
        freeIntSeen = true;
        s.params.add(l);
      } else if (t == float.class) { final float v = s.key.equals("a:(Lahb;IIIIFI)V") ? 1f : 0.5f; s.params.add(one(c -> v)); }
      else if (t == boolean.class) { List<Function<Ctx, Object>> l = new ArrayList<>(); l.add(c -> false); l.add(c -> true); s.params.add(l); }
      else if (t == Random.class) {
        List<Function<Ctx, Object>> l = new ArrayList<>();
        int n = randomSeen ? 1 : RANDOMS;
        for (int k = 0; k < n; k++) { final int v = k; l.add(c -> { worldRandom(c, v < 3 ? 0 : v - 2); return random(v); }); }
        randomSeen = true;
        s.params.add(l);
      } else if (t == aji.class) {
        List<Function<Ctx, Object>> l = new ArrayList<>();
        l.add(c -> c.b);
        if (!blockSeen) { l.add(c -> aji.e(1)); l.add(c -> aji.e(0)); }
        blockSeen = true;
        s.params.add(l);
      } else if (t == azt.class) s.params.add(one(c -> azt.a(X - 1, Y - 1, Z - 1, X + 2, Y + 2, Z + 2)));
      else if (t == List.class) s.params.add(one(c -> { List<Object> l = new ArrayList<>(); c.lists.add(l); return l; }));
      else if (t == azw.class && vecs == 2) {
        final int which = vecIdx++;
        List<Function<Ctx, Object>> l = new ArrayList<>();
        for (double[][] r : RAYS) l.add(c -> azw.a(r[which][0], r[which][1], r[which][2]));
        s.params.add(l);
      } else if (t == azw.class) s.params.add(one(c -> azw.a(0, 0, 0)));
      else if (t == add.class) s.params.add(one(c -> c.item == null ? null : new add(c.item, 1, 0)));
      else if (player != null && t.isInstance(player)) {
        List<Function<Ctx, Object>> l = new ArrayList<>();
        for (int k = 0; k < HELD.length; k++) { final int v = k; l.add(c -> bindPlayer(c, v)); }
        s.params.add(l);
      }
      else { why[0] = "parameter " + t.getName(); return null; }
    }
    s.nArgs = P.length;
    if (randomSeen) s.params.add(one(c -> null));
    else {
      List<Function<Ctx, Object>> l = new ArrayList<>();
      for (int k = 0; k < 3; k++) { final int v = k; l.add(c -> { worldRandom(c, v); return null; }); }
      s.params.add(l);
    }
    // Combinations: full product when small; otherwise every multi-valued parameter varies one at a time from the
    // first value of all others.
    int prod = 1;
    for (List<Function<Ctx, Object>> l : s.params) prod *= l.size();
    if (prod <= 72) {
      int[] c = new int[s.params.size()];
      while (true) {
        s.combos.add(c.clone());
        int i = 0;
        for (; i < c.length; i++) { if (++c[i] < s.params.get(i).size()) break; c[i] = 0; }
        if (i == c.length) break;
      }
    } else {
      Set<String> have = new HashSet<>();
      s.combos.add(new int[s.params.size()]);
      have.add(Arrays.toString(s.combos.get(0)));
      for (int p = 0; p < s.params.size(); p++)
        for (int k = 1; k < s.params.get(p).size(); k++) {
          int[] c = new int[s.params.size()];
          c[p] = k;
          // ray pairs vary together
          if (p < s.nArgs && P[p] == azw.class && vecs == 2) for (int i = 0; i < s.nArgs; i++) if (P[i] == azw.class) c[i] = k;
          if (have.add(Arrays.toString(c))) s.combos.add(c);
        }
    }
    if (vecs == 2) s.combos.removeIf(c -> { int a = -1; for (int i = 0; i < s.nArgs; i++) if (P[i] == azw.class) { if (a < 0) a = c[i]; else if (a != c[i]) return true; } return false; });
    return s;
  }

  // Held-item variants for player arguments: empty hand, the block's own item, red flower, water bucket, glass bottle,
  // bone meal (item id, damage; id 0 = the block's own item).
  static final int[][] HELD = {{-1, 0}, {0, 0}, {38, 0}, {326, 0}, {374, 0}, {351, 15}};
  // Player double: EntityPlayerSP (blk) allocated without its constructor, re-initialised per call (fresh inventory
  // holding the variant in the selected slot, position, motion and entity Random), bound to the call's world.
  static Object bindPlayer(Ctx c, int held) {
    try {
      yx inv = new yx((yz) player);
      int[] h = HELD[held];
      adb it = h[0] < 0 ? null : h[0] == 0 ? c.item : adb.d(h[0]);
      // A block without an item (fire, liquids, ...) gets an empty hand for the own-item variant.
      inv.a[0] = it == null ? null : new add(it, 1, h[1]);
      inv.c = 0;
      MobMoveProbe.set(player, "bm", inv);
      MobMoveProbe.set(player, "Z", new Random(1));
      MobMoveProbe.set(player, "s", X + 0.5);
      MobMoveProbe.set(player, "t", (double) Y);
      MobMoveProbe.set(player, "u", Z - 1.5);
      MobMoveProbe.set(player, "v", 0.0);
      MobMoveProbe.set(player, "w", 0.0);
      MobMoveProbe.set(player, "x", 0.0);
      MobMoveProbe.set(player, "o", c.w);
      c.inv = inv;
      return player;
    } catch (RuntimeException e) { throw e; } catch (Exception e) { throw new RuntimeException(e); }
  }

  // ---- block instance state ----
  // Non-static fields of the block instance; final arrays and collections are restored in place (contents).
  static List<Field> state(aji b) {
    List<Field> out = new ArrayList<>();
    for (Class<?> c = b.getClass(); c != null && c != Object.class; c = c.getSuperclass())
      for (Field f : c.getDeclaredFields()) {
        if (Modifier.isStatic(f.getModifiers())) continue;
        f.setAccessible(true);
        out.add(f);
      }
    return out;
  }
  @SuppressWarnings("unchecked")
  static void restore(aji b, List<Field> fields, Object[] snapshot) throws Exception {
    for (int i = 0; i < fields.size(); i++) {
      Field f = fields.get(i);
      Object v = snapshot[i], cur = f.get(b);
      boolean fin = Modifier.isFinal(f.getModifiers());
      if (v instanceof Collection && cur instanceof Collection) { ((Collection<Object>) cur).clear(); ((Collection<Object>) cur).addAll((Collection<Object>) v); }
      else if (v instanceof Map && cur instanceof Map) { ((Map<Object, Object>) cur).clear(); ((Map<Object, Object>) cur).putAll((Map<Object, Object>) v); }
      else if (fin && v != null && cur != null && v.getClass().isArray() && cur.getClass() == v.getClass() && Array.getLength(v) == Array.getLength(cur)) System.arraycopy(v, 0, cur, 0, Array.getLength(v));
      else if (!fin && !(v instanceof Collection) && !(v instanceof Map)) f.set(b, copy(v));
    }
  }
  static Object copy(Object v) {
    if (v == null || !v.getClass().isArray()) return v;
    int n = Array.getLength(v);
    Object c = Array.newInstance(v.getClass().getComponentType(), n);
    System.arraycopy(v, 0, c, 0, n);
    return c;
  }

  static String cells(R w, Map<Long, int[]> before) {
    TreeSet<Long> keys = new TreeSet<>(w.cells.keySet());
    keys.addAll(before.keySet());
    StringBuilder s = new StringBuilder();
    for (long k : keys) {
      int[] a = before.get(k), b = w.cells.get(k);
      if (a != null && b != null && a[0] == b[0] && a[1] == b[1] && !w.written.contains(k)) continue;
      long z = k % 100000L - 1000, y = (k / 100000L) % 100000L - 1000, x = k / 10000000000L - 1000;
      s.append(s.length() > 0 ? " " : "").append(x).append(',').append(y).append(',').append(z).append('=').append(b == null ? "base" : b[0] + ":" + b[1]);
    }
    return s.toString();
  }

  static String once(Spec s, int[] combo, aji b, adb item, int meta, int scen, List<Field> fields, Object[] snapshot) {
    try {
      restore(b, fields, snapshot);
      Ctx c = new Ctx();
      c.w = world(b, meta, scen);
      c.meta = meta;
      c.b = b;
      c.item = item;
      Map<Long, int[]> before = new HashMap<>();
      for (Map.Entry<Long, int[]> e : c.w.cells.entrySet()) before.put(e.getKey(), e.getValue().clone());
      c.w.written.clear();
      Object[] args = s.args(c, combo);
      String ret;
      try { ret = render(s.m.invoke(Modifier.isStatic(s.m.getModifiers()) ? null : b, args), 0); }
      catch (Throwable t) { return exc(t); }
      StringBuilder o = new StringBuilder(ret);
      String d = cells(c.w, before);
      if (!d.isEmpty()) o.append(" |cells ").append(d);
      if (!c.w.log.isEmpty()) o.append(" |log ").append(String.join("; ", c.w.log));
      for (Object l : c.lists) o.append(" |list ").append(render(l, 0));
      if (c.inv != null) o.append(" |held ").append(render(c.inv.a[c.inv.c], 0));
      return o.toString();
    } catch (Throwable t) { return exc(t); }
  }

  static String q(String s) { return BlockMetadataProbe.q(s.length() > 240 ? s.substring(0, 240) + "..." : s); }

  public static String run(aji b, adb item) {
    try {
      if (player == null) {
        player = PlantProbe.unsafe.allocateInstance(blk.class);
        MobMoveProbe.set(player, "Z", new Random(1));
        MobMoveProbe.set(player, "C", azt.a(0, 0, 0, 0, 0, 0));
        MobMoveProbe.set(player, "bE", new yw());
        MobMoveProbe.set(player, "bm", new yx((yz) player));
        MobMoveProbe.set(player, "bp", new zr());
        MobMoveProbe.set(player, "s", X + 0.5);
        MobMoveProbe.set(player, "t", (double) Y);
        MobMoveProbe.set(player, "u", Z - 1.5);
      }
      List<Spec> specs = new ArrayList<>();
      List<String> skipped = new ArrayList<>();
      Set<String> seen = new HashSet<>();
      List<Method> methods = new ArrayList<>();
      for (Class<?> c = b.getClass(); c != aji.class && c != null; c = c.getSuperclass()) {
        Method[] ms = c.getDeclaredMethods();
        Arrays.sort(ms, Comparator.comparing(BlockMetadataExtProbe::key));
        for (Method m : ms) methods.add(m);
      }
      // Inherited metadata readers of Block itself (executed through virtual dispatch on every block).
      methods.add(aji.class.getDeclaredMethod("a", ahb.class, int.class, int.class, int.class, int.class, float.class, int.class));
      for (Method m : methods) {
        if (m.isSynthetic() || m.isBridge()) continue;
        String k = key(m), dedupe = Modifier.isPrivate(m.getModifiers()) || Modifier.isStatic(m.getModifiers()) ? m.getDeclaringClass().getName() + "." + k : k;
        if (!seen.add(dedupe)) continue;
        String[] why = new String[1];
        Spec s = spec(m, why);
        if (s == null) { if (!why[0].startsWith("no World")) skipped.add("[" + q(m.getDeclaringClass().getName() + "." + k) + "," + q(why[0]) + "]"); continue; }
        m.setAccessible(true);
        specs.add(s);
      }
      List<Field> fields = state(b);
      Object[] snapshot = new Object[fields.size()];
      for (int i = 0; i < fields.size(); i++) {
        Object v = fields.get(i).get(b);
        snapshot[i] = v instanceof Collection ? new ArrayList<Object>((Collection<?>) v) : v instanceof Map ? new LinkedHashMap<Object, Object>((Map<?, ?>) v) : copy(v);
      }
      StringBuilder out = new StringBuilder("{\"fields\":[");
      int nf = 0;
      // createStackedBlock (silk-touch stack) is a pure function of metadata.
      {
        Method cs = aji.class.getDeclaredMethod("j", int.class);
        cs.setAccessible(true);
        String[] o = new String[16];
        for (int m = 0; m < 16; m++) {
          try { o[m] = render(cs.invoke(b, m), 0); } catch (Throwable t) { o[m] = exc(t); }
        }
        out.append(field("aji.j:(I)Ladd;", "createStackedBlock", o));
        nf++;
      }
      // Methods whose outcome in the role scenario varies with the neighbours' metadata read neighbouring copies of
      // the block; for them the full centre x neighbour matrix is executed (nb0-nb15, role1-role15), so equal
      // outcomes mean equal behaviour as centre and as neighbour against every other value, not only against 0.
      Set<Spec> nbDep = new LinkedHashSet<>();
      List<Integer> scens = new ArrayList<>();
      for (int scen = 0; scen < SCEN.length; scen++) scens.add(scen);
      for (int si = 0; si < scens.size(); si++) {
        int scen = scens.get(si);
        if (scen == 4) {
          if (nbDep.isEmpty()) break;
        }
        for (Spec s : specs) {
          if (scen >= 4 && !nbDep.contains(s)) continue;
          for (int[] combo : s.combos) {
            String[] o = new String[16];
            teQueried = false;
            for (int pass = 0; pass < 2; pass++)
              for (int m = 0; m < 16; m++) {
                String r = once(s, combo, b, item, m, scen, fields, snapshot);
                if (pass == 0) o[m] = r;
                else if (!r.equals(o[m])) o[m] = "NONDET";
              }
            restore(b, fields, snapshot);
            if (scen == 3 && new HashSet<>(Arrays.asList(o)).size() > 1) nbDep.add(s);
            String owner = s.m.getDeclaringClass().getName();
            String label = scen < 4 ? SCEN[scen] : scen < 20 ? "nb" + (scen - 4) : "role" + (scen - 20);
            String f = field(owner + "." + s.key, s.key + "#" + Arrays.toString(combo).replace(" ", "") + "@" + label, o);
            out.append(",").append(teQueried ? f.substring(0, f.length() - 1) + ",\"te\":true}" : f);
            nf++;
          }
        }
        if (scen == 3) {
          for (int n = 0; n < 16; n++) scens.add(4 + n);
          for (int n = 1; n < 16; n++) scens.add(20 + n);
        }
      }
      return out.append("],\"skipped\":[").append(String.join(",", skipped)).append("]}").toString();
    } catch (Throwable t) {
      t.printStackTrace();
      return "{\"error\":" + q(exc(t)) + "}";
    }
  }

  static String field(String method, String name, String[] o) {
    List<String> distinct = new ArrayList<>();
    int[] codes = new int[16];
    for (int m = 0; m < 16; m++) {
      int i = distinct.indexOf(o[m]);
      if (i < 0) { distinct.add(o[m]); i = distinct.size() - 1; }
      codes[m] = i;
    }
    StringBuilder s = new StringBuilder("{\"m\":").append(q(method)).append(",\"f\":").append(q(name)).append(",\"c\":");
    if (distinct.size() == 1) s.append(0);
    else s.append(Arrays.toString(codes).replace(" ", ""));
    s.append(",\"o\":[");
    for (int i = 0; i < distinct.size(); i++) s.append(i > 0 ? "," : "").append(q(distinct.get(i)));
    return s.append("]}").toString();
  }
}
