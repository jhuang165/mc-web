import java.lang.reflect.Field;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.TreeMap;

// Records 1.7.10 oak sapling, tree growth and leaf decay behaviour from the unchanged original
// classes, on a fake World (allocated without its constructor, like SnowProbe and WeatherProbe).
// Block ids are the original ones (2 grass, 3 dirt, 6 sapling, 12 sand, 17 log, 18 leaves, 60 farmland).
//   gen       WorldGenTrees.generate (asq.a) with the sapling's settings (minimum height 4, no vines): result,
//             number of setBlock calls, sha256 of the ordered calls "x,y,z,id,meta,flags" and the next Random int.
//   sapling   BlockSapling.updateTick (anj.a) repeated on one sapling: one event character per tick.
//   bonemeal  ItemDye.applyBonemeal's two calls on a sapling: func_149852_a (anj.a(w, rand, x, y, z)) and, when it says yes,
//             func_149853_b (anj.b).
//   decay     BlockLeaves.updateTick (alt.a) over a cube of leaves around a log, over generated trees whose logs were
//             removed (BlockLog.breakBlock marks the leaves), and BlockLeaves/BlockLog.breakBlock marking.
//   drops     BlockLeaves.dropBlockAsItemWithChance (alt.a(w, x, y, z, meta, chance, fortune)).
// Chunk.func_150807_a's call of the old block's breakBlock for leaves and logs when the block changes is transcribed
// into setBlock (bytecode, not a probe); everything else runs the original classes. The original drop method
// (Block.dropBlockAsItem_do) needs GameRules, so it is overridden to log the stack and take its three nextFloat calls.
public class TreeProbe {
  static sun.misc.Unsafe unsafe;
  static final long MASK = (1L << 48) - 1;

  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass())
      try {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
      } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }
  static void set(Object o, String name, Object v) throws Exception { field(o.getClass(), name).set(o, v); }
  static String sha(String s) throws Exception {
    byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes("UTF-8"));
    StringBuilder b = new StringBuilder();
    for (byte x : d) b.append(String.format("%02x", x));
    return b.toString();
  }
  static String q(String s) { return "\"" + s + "\""; }

  // The big-tree draw (WorldGenBigTree is not ported) stops a tick before it changes anything.
  static class Big extends RuntimeException {}

  // java.util.Random with its seed readable, and a trap on the sapling's nextInt(10) == 0.
  public static class Rnd extends Random {
    long s;
    boolean armed;
    Rnd(long seed) { super(0); setSeed(seed); }
    public void setSeed(long seed) { s = (seed ^ 0x5DEECE66DL) & MASK; }
    protected int next(int bits) {
      s = (s * 0x5DEECE66DL + 0xBL) & MASK;
      return (int) (s >>> (48 - bits));
    }
    public int nextInt(int bound) {
      int v = super.nextInt(bound);
      if (armed && bound == 10 && v == 0) throw new Big();
      return v;
    }
  }

  static class Fx {
    String name;
    int ground, top;
    int[][] edits;
    Fx(String name, int ground, int top, int[][] edits) { this.name = name; this.ground = ground; this.top = top; this.edits = edits; }
  }

  // Leaves and sapling blocks that log their dropped stacks instead of spawning them.
  public static class PLeaves extends aml {
    protected void a(ahb world, int x, int y, int z, add stack) { W w = (W) world; w.dropped(x, y, z, stack); }
  }
  public static class PSapling extends anj {
    protected void a(ahb world, int x, int y, int z, add stack) { W w = (W) world; w.dropped(x, y, z, stack); }
    // Block.dropBlockAsItemWithChance (aji.a(w, x, y, z, meta, chance, fortune)) as in its bytecode, except that the
    // item is the registered sapling's: this subclass is not in the block registry, so getItemFromBlock(this) is null.
    public void a(ahb world, int x, int y, int z, int meta, float chance, int fortune) {
      if (world.E) return;
      int n = a(fortune, world.s);
      for (int i = 0; i < n; i++) {
        if (world.s.nextFloat() > chance) continue;
        a(world, x, y, z, new add(adb.a(ajn.g), 1, a(meta)));
      }
    }
  }

  interface Base { int[] at(int x, int y, int z); }

  public static class W extends ahb {
    Map<Long, int[]> cells = new HashMap<>(), fixed = new HashMap<>();
    Base base;
    List<int[]> sets = new ArrayList<>(); // x, y, z, id, meta, flags
    List<int[]> drops = new ArrayList<>(); // tick, id, damage
    int light = 15, tick = 0;
    PLeaves leaves;
    PSapling sapling;
    W() { super((azc) null, null, (aqo) null, (ahj) null, null); } // never run: allocated without a constructor
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    static long key(int x, int y, int z) { return ((long) (x + 1000) * 100000L + (y + 1000)) * 100000L + (z + 1000); }
    int[] original(int x, int y, int z) {
      int[] c = fixed.get(key(x, y, z));
      return c != null ? c : base.at(x, y, z);
    }
    int[] cell(int x, int y, int z) {
      int[] c = cells.get(key(x, y, z));
      return c != null ? c : original(x, y, z);
    }
    void put(int x, int y, int z, int id, int meta) { cells.put(key(x, y, z), new int[] {id, meta}); }
    aji byId(int id) { return id == 18 ? leaves : id == 6 ? sapling : aji.e(id); }
    static int id(aji b) { return b instanceof PLeaves ? 18 : b instanceof PSapling ? 6 : aji.b(b); }
    void dropped(int x, int y, int z, add stack) {
      s.nextFloat(); s.nextFloat(); s.nextFloat(); // Block.dropBlockAsItem_do's position offsets
      drops.add(new int[] {tick, adb.b(stack.b()), stack.k()});
    }
    public aji a(int x, int y, int z) { return y < 0 || y > 255 ? aji.e(0) : byId(cell(x, y, z)[0]); }
    public int e(int x, int y, int z) { return y < 0 || y > 255 ? 0 : cell(x, y, z)[1]; }
    public int k(int x, int y, int z) { return light; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) { return setBlock(x, y, z, b, meta, flags); }
    public boolean f(int x, int y, int z) { return setBlock(x, y, z, aji.e(0), 0, 3); }
    public boolean a(int x, int y, int z, int meta, int flags) {
      if (y < 0 || y > 255) return false;
      put(x, y, z, cell(x, y, z)[0], meta);
      return true;
    }
    boolean setBlock(int x, int y, int z, aji nb, int meta, int flags) {
      if (y < 0 || y > 255) return false;
      int nid = id(nb);
      sets.add(new int[] {x, y, z, nid, meta, flags});
      int[] old = cell(x, y, z);
      if (old[0] != nid) { // Chunk.func_150807_a: the old block's breakBlock runs first
        aji ob = byId(old[0]);
        if (ob instanceof alt) ((alt) ob).a(this, x, y, z, ob, old[1]);
        else if (ob instanceof alx) ((alx) ob).a(this, x, y, z, ob, old[1]);
      }
      put(x, y, z, nid, meta);
      return true;
    }
    // A digest of every cell that differs from the fixture (air is compared without metadata).
    String state() throws Exception {
      TreeMap<Long, String> lines = new TreeMap<>();
      for (Map.Entry<Long, int[]> e : cells.entrySet()) {
        long k = e.getKey();
        int z = (int) (k % 100000L) - 1000, y = (int) ((k / 100000L) % 100000L) - 1000, x = (int) (k / 10000000000L) - 1000;
        int[] v = e.getValue(), o = original(x, y, z);
        int vm = v[0] == 0 ? 0 : v[1], om = o[0] == 0 ? 0 : o[1];
        if (v[0] != o[0] || vm != om) lines.put(k, x + "," + y + "," + z + "," + v[0] + "," + vm);
      }
      return sha(String.join("\n", lines.values()));
    }
    String setsDigest(int from) throws Exception {
      StringBuilder b = new StringBuilder();
      for (int i = from; i < sets.size(); i++) {
        int[] a = sets.get(i);
        b.append(a[0]).append(',').append(a[1]).append(',').append(a[2]).append(',').append(a[3]).append(',').append(a[4]).append(',').append(a[5]).append('\n');
      }
      return sha(b.toString());
    }
  }

  static W world(Fx fx, long seed) throws Exception {
    W w = (W) unsafe.allocateInstance(W.class);
    set(w, "t", unsafe.allocateInstance(aqq.class));
    Rnd r = new Rnd(seed);
    set(w, "s", r);
    set(w, "C", new qi());
    set(w, "E", false);
    w.cells = new HashMap<>();
    w.fixed = new HashMap<>();
    w.sets = new ArrayList<>();
    w.drops = new ArrayList<>();
    w.leaves = new PLeaves();
    w.sapling = new PSapling();
    final int g = fx.ground, top = fx.top;
    w.base = (x, y, z) -> {
      if (y < g - 3) return new int[] {1, 0};
      if (y < g) return new int[] {3, 0};
      if (y == g) return new int[] {top, 0};
      return new int[] {0, 0};
    };
    for (int[] e : fx.edits) w.fixed.put(W.key(e[0], e[1], e[2]), new int[] {e[3], e[4]});
    return w;
  }
  static Rnd rnd(W w) { return (Rnd) w.s; }

  static String edits(int[][] e) {
    StringBuilder b = new StringBuilder("[");
    for (int i = 0; i < e.length; i++) b.append(i > 0 ? "," : "").append("[").append(e[i][0]).append(",").append(e[i][1]).append(",").append(e[i][2]).append(",").append(e[i][3]).append(",").append(e[i][4]).append("]");
    return b.append("]").toString();
  }
  static String dropsJson(List<int[]> d) {
    StringBuilder b = new StringBuilder("[");
    for (int i = 0; i < d.size(); i++) b.append(i > 0 ? "," : "").append("[").append(d.get(i)[0]).append(",").append(d.get(i)[1]).append(",").append(d.get(i)[2]).append("]");
    return b.append("]").toString();
  }

  // ---- fixtures
  static final int G = 64;
  static final int[][] NONE = {};
  static Fx[] fixtures() {
    return new Fx[] {
      new Fx("grass", G, 2, NONE),
      new Fx("dirt", G, 3, NONE),
      new Fx("farmland", G, 60, NONE),
      new Fx("sand", G, 12, NONE),
      new Fx("stone-in-check-area", G, 2, new int[][] {{1, G + 3, 0, 1, 0}}),
      new Fx("tall-grass-in-the-way", G, 2, new int[][] {{1, G + 2, 1, 31, 1}}),
      new Fx("stone-in-unchecked-corner", G, 2, new int[][] {{2, G + 2, 2, 1, 0}, {-2, G + 3, 2, 1, 0}}),
      new Fx("ceiling", G, 2, new int[][] {{0, G + 7, 0, 1, 0}, {1, G + 7, 0, 1, 0}, {-1, G + 7, 0, 1, 0}, {0, G + 7, 1, 1, 0}, {0, G + 7, -1, 1, 0}}),
      new Fx("high-base", 248, 2, NONE),
      new Fx("crowd", G, 2, new int[][] {{0, G + 2, 0, 18, 0}, {1, G + 1, 0, 18, 4}, {-1, G + 1, 0, 18, 0}, {0, G + 1, 1, 18, 0}, {0, G + 2, -1, 18, 0}, {2, G + 5, 0, 18, 0}, {0, G + 3, 0, 17, 0}, {-1, G + 2, -1, 17, 0}}),
    };
  }
  static int[] index(Fx[] all, String... names) {
    int[] out = new int[names.length];
    for (int i = 0; i < names.length; i++)
      for (int j = 0; j < all.length; j++) if (all[j].name.equals(names[i])) out[i] = j;
    return out;
  }

  // One sapling tick (or bone meal application) and what it did: m marked, g grew, f did not fit, d support lost,
  // B the big-tree draw (stops), . nothing.
  static char outcome(W w, int x, int y, int z, int metaBefore, int from) {
    int[] c = w.cell(x, y, z);
    if (c[0] == 6) {
      for (int i = from; i < w.sets.size(); i++) if (w.sets.get(i)[3] == 6) return 'f';
      return c[1] != metaBefore ? 'm' : '.';
    }
    for (int i = from; i < w.sets.size(); i++) if (w.sets.get(i)[3] == 17) return 'g';
    return 'd';
  }

  public static void main(String[] args) throws Exception {
    java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();
    adb.l(); // Item.registerItems: the drops' items
    Fx[] fx = fixtures();
    StringBuilder out = new StringBuilder("{");

    // ---- fixtures
    out.append("\"fixtures\":[");
    for (int i = 0; i < fx.length; i++)
      out.append(i > 0 ? "," : "").append("{\"name\":").append(q(fx[i].name)).append(",\"ground\":").append(fx[i].ground).append(",\"top\":").append(fx[i].top).append(",\"edits\":").append(edits(fx[i].edits)).append("}");
    out.append("]");

    // ---- gen
    out.append(",\"gen\":{\"rows\":[");
    boolean first = true;
    int grown = 0, refused = 0;
    for (int f = 0; f < fx.length; f++)
      for (int notify = 0; notify < (f == 0 ? 2 : 1); notify++)
        for (int seed = 0; seed < 24; seed++) {
          W w = world(fx[f], seed * 7919L + 13);
          boolean ok = new asq(notify == 1).a(w, rnd(w), 0, fx[f].ground + 1, 0);
          if (ok) grown++; else refused++;
          out.append(first ? "" : ",").append("[").append(f).append(",").append(seed * 7919L + 13).append(",").append(notify).append(",").append(ok ? 1 : 0).append(",").append(w.sets.size()).append(",").append(q(w.setsDigest(0))).append(",").append(rnd(w).nextInt(1000000)).append("]");
          first = false;
        }
    out.append("]");
    {
      // One tree written out in full: seed 13 on grass, flags 2 (every setBlock call in order).
      W w = world(fx[0], 13);
      new asq(false).a(w, rnd(w), 0, G + 1, 0);
      out.append(",\"example\":[");
      for (int i = 0; i < w.sets.size(); i++) {
        int[] a = w.sets.get(i);
        out.append(i > 0 ? "," : "").append("[").append(a[0]).append(",").append(a[1]).append(",").append(a[2]).append(",").append(a[3]).append(",").append(a[4]).append(",").append(a[5]).append("]");
      }
      out.append("]");
    }
    out.append(",\"grown\":").append(grown).append(",\"refused\":").append(refused).append("}");

    // ---- sapling: BlockSapling.updateTick over a run of ticks
    out.append(",\"sapling\":{\"ticks\":80,\"rows\":[");
    first = true;
    int[] saps = index(fx, "grass", "dirt", "farmland", "ceiling", "crowd", "sand", "stone-in-check-area");
    int totalTicks = 0, marks = 0, grows = 0, fails = 0, bigs = 0, lost = 0;
    for (int f : saps)
      for (int light : new int[] {8, 9, 15})
        for (int start : new int[] {0, 8})
          for (int seed = 0; seed < (light == 8 ? 2 : 10); seed++) {
            W w = world(fx[f], seed * 104729L + 5);
            w.light = light;
            int sy = fx[f].ground + 1;
            w.put(0, sy, 0, 6, start);
            Rnd r = rnd(w);
            StringBuilder ev = new StringBuilder();
            for (int t = 0; t < 80; t++) {
              w.tick = t;
              int from = w.sets.size(), mb = w.cell(0, sy, 0)[1];
              r.armed = true;
              char c;
              try {
                w.sapling.a(w, 0, sy, 0, r);
                c = outcome(w, 0, sy, 0, mb, from);
              } catch (Big b) { c = 'B'; }
              r.armed = false;
              ev.append(c);
              totalTicks++;
              if (c == 'm') marks++; else if (c == 'g') grows++; else if (c == 'f') fails++; else if (c == 'B') bigs++; else if (c == 'd') lost++;
              if (c == 'g' || c == 'd' || c == 'B') break;
            }
            out.append(first ? "" : ",").append("{\"fixture\":").append(f).append(",\"light\":").append(light).append(",\"start\":").append(start).append(",\"seed\":").append(seed * 104729L + 5)
              .append(",\"events\":").append(q(ev.toString())).append(",\"drops\":").append(dropsJson(w.drops)).append(",\"state\":").append(q(w.state())).append(",\"next\":").append(r.nextInt(1000000)).append("}");
            first = false;
          }
    out.append("],\"marks\":").append(marks).append(",\"grows\":").append(grows).append(",\"fails\":").append(fails).append(",\"bigs\":").append(bigs).append(",\"lost\":").append(lost).append("}");

    // ---- bone meal
    out.append(",\"bonemeal\":{\"bits\":[");
    for (int seed = 0; seed < 200; seed++) {
      Random r = new Random(seed);
      StringBuilder b = new StringBuilder();
      for (int i = 0; i < 40; i++) b.append(((double) r.nextFloat() < 0.45) ? '1' : '0');
      out.append(seed > 0 ? "," : "").append(q(b.toString()));
    }
    out.append("],\"rows\":[");
    first = true;
    int[] bones = index(fx, "grass", "ceiling", "crowd");
    for (int f : bones)
      for (int seed = 0; seed < 40; seed++) {
        W w = world(fx[f], seed * 31L + 7);
        int sy = fx[f].ground + 1;
        w.put(0, sy, 0, 6, 0);
        Rnd r = rnd(w);
        StringBuilder ev = new StringBuilder();
        for (int t = 0; t < 30; t++) {
          w.tick = t;
          int from = w.sets.size(), mb = w.cell(0, sy, 0)[1];
          char c;
          r.armed = true;
          try {
            if (!w.sapling.a(w, r, 0, sy, 0)) c = 'x';
            else {
              w.sapling.b(w, r, 0, sy, 0);
              c = outcome(w, 0, sy, 0, mb, from);
            }
          } catch (Big b) { c = 'B'; }
          r.armed = false;
          ev.append(c);
          if (c == 'g' || c == 'd' || c == 'B') break;
        }
        out.append(first ? "" : ",").append("{\"fixture\":").append(f).append(",\"seed\":").append(seed * 31L + 7).append(",\"events\":").append(q(ev.toString())).append(",\"state\":").append(q(w.state())).append(",\"next\":").append(r.nextInt(1000000)).append("}");
        first = false;
      }
    out.append("]}");

    // ---- decay
    out.append(",\"decay\":{");
    // A cube of leaves with bit 8 set around one log: what updateTick does to each leaf (D decays, k keeps with
    // the check bit cleared, n no change), in x, y, z order over -6..6.
    Fx open = fx[0];
    out.append("\"cube\":[");
    first = true;
    for (int meta : new int[] {8, 12, 9, 8 | 3}) {
      W w = world(open, 99);
      int cy = G + 8;
      w.base = (x, y, z) -> {
        if (x == 0 && y == cy && z == 0) return new int[] {17, 0};
        if (Math.abs(x) <= 8 && Math.abs(y - cy) <= 8 && Math.abs(z) <= 8) return new int[] {18, meta};
        return new int[] {0, 0};
      };
      StringBuilder row = new StringBuilder();
      int decayed = 0, kept = 0, same = 0;
      for (int dx = -6; dx <= 6; dx++)
        for (int dy = -6; dy <= 6; dy++)
          for (int dz = -6; dz <= 6; dz++) {
            if (dx == 0 && dy == 0 && dz == 0) { row.append('L'); continue; }
            w.cells.clear();
            w.sets.clear();
            w.leaves.a(w, dx, cy + dy, dz, rnd(w));
            int[] c = w.cell(dx, cy + dy, dz);
            char ch = c[0] == 0 ? 'D' : c[1] != meta ? 'k' : 'n';
            if (ch == 'D') decayed++; else if (ch == 'k') kept++; else same++;
            row.append(ch);
          }
      out.append(first ? "" : ",").append("{\"meta\":").append(meta).append(",\"cy\":").append(cy).append(",\"cells\":").append(q(row.toString())).append(",\"decayed\":").append(decayed).append(",\"kept\":").append(kept).append(",\"same\":").append(same)
        .append(",\"drops\":").append(dropsJson(w.drops)).append(",\"next\":").append(rnd(w).nextInt(1000000)).append("}");
      first = false;
    }
    out.append("]");

    // Generated trees whose logs are removed (all, or all but the lowest keep), then scan rounds until nothing changes.
    out.append(",\"trees\":[");
    first = true;
    for (int seed = 1; seed <= 8; seed++)
      for (int keep : new int[] {0, 1, 2, 3}) {
        W w = world(open, seed);
        new asq(true).a(w, rnd(w), 0, G + 1, 0);
        // The ground-up scan of the generated tree starts from a clean slate of metadata: the world as it is now.
        w.fixed.putAll(w.cells);
        w.cells.clear();
        w.sets.clear();
        int logs = 0, leavesBefore = 0;
        for (int y = G + 1; y < G + 14; y++) for (int x = -4; x <= 4; x++) for (int z = -4; z <= 4; z++) { int id = w.cell(x, y, z)[0]; if (id == 17) logs++; else if (id == 18) leavesBefore++; }
        int removed = 0;
        for (int y = G + 1; y < G + 14; y++)
          if (w.cell(0, y, 0)[0] == 17) { if (y - (G + 1) >= keep) { w.f(0, y, 0); removed++; } }
        w.drops.clear();
        StringBuilder rounds = new StringBuilder();
        for (int round = 0; round < 40; round++) {
          w.tick = round;
          int changed = 0;
          for (int x = -4; x <= 4; x++) for (int y = G + 1; y < G + 14; y++) for (int z = -4; z <= 4; z++) {
            int[] before = w.cell(x, y, z);
            if (before[0] != 18) continue;
            int bm = before[1];
            w.leaves.a(w, x, y, z, rnd(w));
            int[] a = w.cell(x, y, z);
            if (a[0] != 18 || a[1] != bm) changed++;
          }
          rounds.append(round > 0 ? "," : "").append(changed);
          if (changed == 0) break;
        }
        int leavesAfter = 0;
        for (int y = G + 1; y < G + 14; y++) for (int x = -4; x <= 4; x++) for (int z = -4; z <= 4; z++) if (w.cell(x, y, z)[0] == 18) leavesAfter++;
        out.append(first ? "" : ",").append("{\"seed\":").append(seed).append(",\"keep\":").append(keep).append(",\"logs\":").append(logs).append(",\"removed\":").append(removed).append(",\"leaves\":").append(leavesBefore).append(",\"rounds\":").append(q(rounds.toString())).append(",\"after\":").append(leavesAfter)
          .append(",\"drops\":").append(dropsJson(w.drops)).append(",\"state\":").append(q(w.state())).append(",\"next\":").append(rnd(w).nextInt(1000000)).append("}");
        first = false;
      }
    out.append("]");

    // breakBlock marking: a leaf removed marks leaves within 1, a log within 4 (written with bit 8 whatever the metadata).
    out.append(",\"marks\":[");
    first = true;
    for (int kind = 0; kind < 2; kind++) {
      W w = world(open, 5);
      final int k = kind, cy = G + 10;
      w.base = (x, y, z) -> {
        if (x == 0 && y == cy && z == 0) return new int[] {k == 1 ? 17 : 18, 0};
        if (Math.abs(x) <= 7 && Math.abs(y - cy) <= 7 && Math.abs(z) <= 7) return new int[] {18, ((x + y + z) & 3) == 0 ? 4 : (x * y + z) % 5 == 0 ? 1 : 0};
        return new int[] {0, 0};
      };
      w.f(0, cy, 0);
      out.append(first ? "" : ",").append("{\"kind\":").append(kind).append(",\"cy\":").append(cy).append(",\"state\":").append(q(w.state())).append("}");
      first = false;
    }
    out.append("]}");

    // ---- drops: BlockLeaves.dropBlockAsItemWithChance, fortune 0
    out.append(",\"drops\":[");
    first = true;
    for (int meta : new int[] {0, 1, 2, 3, 8, 12}) {
      W w = world(open, 1234L + meta);
      for (int i = 0; i < 4000; i++) { w.tick = i; w.leaves.a(w, 3, 70, 3, meta, 1.0f, 0); }
      int saplings = 0, apples = 0, other = 0;
      StringBuilder b = new StringBuilder();
      for (int[] d : w.drops) {
        b.append(d[0]).append(',').append(d[1]).append(',').append(d[2]).append('\n');
        if (d[1] == 6) saplings++; else if (d[1] == 260) apples++; else other++;
      }
      List<int[]> head = w.drops.subList(0, Math.min(12, w.drops.size()));
      out.append(first ? "" : ",").append("{\"meta\":").append(meta).append(",\"seed\":").append(1234L + meta).append(",\"calls\":4000,\"saplings\":").append(saplings).append(",\"apples\":").append(apples).append(",\"other\":").append(other)
        .append(",\"digest\":").append(q(sha(b.toString()))).append(",\"head\":").append(dropsJson(head)).append(",\"next\":").append(rnd(w).nextInt(1000000)).append("}");
      first = false;
    }
    out.append("]");

    out.append("}");
    System.out.println(out);
  }
}
