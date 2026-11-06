import java.lang.reflect.*;
import java.util.*;

// Runs the unchanged 1.7.10 TileEntityEnchantmentTable (apd), ModelBook (bhf), EnchantmentNameParts (bfp)
// and the book animation of GuiEnchantment (bfq.a, driven on an allocated instance). The tile entity's static
// Random (apd.r, unseeded in the original) is replaced through reflection by a seeded one; the World double has
// the real playerEntities list, so the unchanged World.getClosestPlayer decides when the book opens.
public class EnchantingBookProbe {
  static sun.misc.Unsafe U;

  static Field field(Class<?> c, String n) throws Exception {
    for (; c != null; c = c.getSuperclass()) try { Field f = c.getDeclaredField(n); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(n);
  }
  static String ql(long v) { return "\"" + v + "\""; }
  static String f(float v) { return Float.toString(v); }

  public static class ProbePlayer extends yz {
    ProbePlayer() { super(null, null); }
    public r f_() { return null; }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
  }
  public static class BookWorld extends ahb {
    BookWorld() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
  }

  // ModelBook parts in field order: a coverRight, b coverLeft, c pagesRight, d pagesLeft, e flippingPageRight, f flippingPageLeft, g bookSpine.
  static final String[] PART_FIELDS = {"a", "b", "g", "c", "d", "e", "f"};
  static final String[] PART_NAMES = {"coverRight", "coverLeft", "bookSpine", "pagesRight", "pagesLeft", "flippingPageRight", "flippingPageLeft"};

  static String part(bix p, int w, int h) throws Exception {
    StringBuilder o = new StringBuilder("{\"point\":[" + f(p.c) + "," + f(p.d) + "," + f(p.e) + "],\"angle\":[" + f(p.f) + "," + f(p.g) + "," + f(p.h) + "],\"boxes\":[");
    List<?> cubes = p.l;
    for (int i = 0; i < cubes.size(); i++) {
      bis b = (bis) cubes.get(i);
      if (i > 0) o.append(',');
      o.append("{\"min\":[" + f(b.a) + "," + f(b.b) + "," + f(b.c) + "],\"max\":[" + f(b.d) + "," + f(b.e) + "," + f(b.f) + "],\"quads\":[");
      bhv[] quads = (bhv[]) field(bis.class, "i").get(b);
      for (int q = 0; q < quads.length; q++) {
        if (q > 0) o.append(',');
        o.append('[');
        for (int v = 0; v < quads[q].a.length; v++) {
          bii vx = quads[q].a[v];
          if (v > 0) o.append(',');
          o.append("[" + f((float) vx.a.a) + "," + f((float) vx.a.b) + "," + f((float) vx.a.c) + "," + f(vx.b) + "," + f(vx.c) + "]");
        }
        o.append(']');
      }
      o.append("]}");
    }
    return o.append("]}").toString();
  }
  static String angles(bhf m) throws Exception {
    StringBuilder o = new StringBuilder("[");
    for (int i = 0; i < PART_FIELDS.length; i++) {
      bix p = (bix) field(bhf.class, PART_FIELDS[i]).get(m);
      if (i > 0) o.append(',');
      o.append("[" + f(p.c) + "," + f(p.d) + "," + f(p.e) + "," + f(p.f) + "," + f(p.g) + "," + f(p.h) + "]");
    }
    return o.append(']').toString();
  }

  static void model() throws Exception {
    bhf m = new bhf();
    StringBuilder o = new StringBuilder("{\"kind\":\"model\",\"textureWidth\":" + field(bhr.class, "t").get(m) + ",\"textureHeight\":" + field(bhr.class, "u").get(m) + ",\"parts\":{");
    for (int i = 0; i < PART_FIELDS.length; i++) {
      if (i > 0) o.append(',');
      o.append("\"" + PART_NAMES[i] + "\":" + part((bix) field(bhf.class, PART_FIELDS[i]).get(m), 64, 32));
    }
    System.out.println(o.append("}}"));
    // setRotationAngles(tick, flipRight, flipLeft, spread, 0, 0.0625, null) for a grid of inputs.
    Random r = new Random(88810L);
    for (int c = 0; c < 60; c++) {
      float tick = c < 40 ? r.nextInt(2000) + r.nextFloat() : c * 1000.5f, f1 = r.nextFloat(), f2 = r.nextFloat(), spread = c % 6 == 0 ? 0f : c % 6 == 1 ? 1f : r.nextFloat();
      bhf book = new bhf();
      book.a(tick, f1, f2, spread, 0f, 0.0625f, (sa) null);
      System.out.println("{\"kind\":\"pose\",\"in\":[" + f(tick) + "," + f(f1) + "," + f(f2) + "," + f(spread) + "],\"angles\":" + angles(book) + "}");
    }
  }

  // [a, i, j, k, l, m, n, o, p, q] of the tile entity.
  static String tile(apd t) throws Exception {
    return "[" + t.a + "," + f(t.i) + "," + f(t.j) + "," + f(t.k) + "," + f(t.l) + "," + f(t.m) + "," + f(t.n) + "," + f(t.o) + "," + f(t.p) + "," + f(t.q) + "]";
  }

  // path: 0 approach, circle, leave; 1 hover at the 3.0 edge; 2 walk straight through; 3 vertical (jump above); 4 far away; 5 leave and come back twice.
  static double[] pos(int path, int t) {
    double cx = 4.5, cy = 64.5, cz = 4.5;
    switch (path) {
      case 0: {
        double d = t < 40 ? 9 : t < 80 ? 9 - 7 * (t - 40) / 40.0 : t < 160 ? 2 : t < 200 ? 2 + 7 * (t - 160) / 40.0 : 9;
        double ang = t < 80 ? 0.6 : 0.6 + (t - 80) * 0.11;
        return new double[]{cx + d * Math.cos(ang), 64.0, cz + d * Math.sin(ang)};
      }
      case 1: { double d = (t / 20) % 2 == 0 ? 2.99 : 3.01; return new double[]{cx + d, cy, cz}; }
      case 2: return new double[]{cx - 8 + t * 0.07, 64.0, cz + 1.5};
      case 3: return new double[]{cx + 1, 62.0 + Math.abs(((t % 80) - 40) / 40.0) * 5.0, cz};
      case 4: return new double[]{cx + 40, 64.0, cz};
      default: { double d = ((t / 50) % 2 == 0) ? 1.0 : 7.0; return new double[]{cx, 64.0, cz - d}; }
    }
  }

  static void scenarios() throws Exception {
    Field rf = field(apd.class, "r");
    for (int sc = 0; sc < 12; sc++) {
      long seed = 424200L + sc * 977L;
      int path = sc % 6, ticks = 260;
      rf.set(null, new Random(seed));
      BookWorld w = (BookWorld) U.allocateInstance(BookWorld.class);
      ProbePlayer p = (ProbePlayer) U.allocateInstance(ProbePlayer.class); p.o = w;
      field(ahb.class, "h").set(w, new ArrayList<Object>(Arrays.asList(p)));
      apd t = new apd();
      field(aor.class, "b").set(t, w);
      field(aor.class, "c").set(t, 4); field(aor.class, "d").set(t, 64); field(aor.class, "e").set(t, 4);
      // The first scenarios start the book mid-state so rotation wrap-around and clamps are visited.
      if (sc >= 6) { t.o = 3.0f + sc * 0.1f; t.p = t.o; t.q = -3.0f; t.k = 5f; t.i = 2.5f; }
      StringBuilder steps = new StringBuilder("["), where = new StringBuilder("[");
      for (int k = 0; k < ticks; k++) {
        double[] at = pos(path, k);
        p.s = at[0]; p.t = at[1]; p.u = at[2];
        t.h();
        if (k > 0) { steps.append(','); where.append(','); }
        steps.append(tile(t));
        where.append("[" + at[0] + "," + at[1] + "," + at[2] + "]");
      }
      Random after = (Random) rf.get(null);
      System.out.println("{\"kind\":\"tile\",\"scenario\":" + sc + ",\"path\":" + path + ",\"seed\":" + ql(seed)
        + ",\"start\":" + (sc >= 6 ? "[" + f(3.0f + sc * 0.1f) + ",-3.0,5.0,2.5]" : "null") + ",\"player\":" + where + "],\"ticks\":" + steps + "],\"next\":" + after.nextInt(1000000) + "}");
    }
  }

  static void names() throws Exception {
    long[] seeds = {0L, 1L, -1L, 42L, 123456789L, Long.MAX_VALUE, Long.MIN_VALUE, 0x5DEECE66DL, 1700000000000L, -987654321012345L};
    Random r = new Random(7117L);
    for (int i = 0; i < 40; i++) {
      long seed = i < seeds.length ? seeds[i] : r.nextLong();
      bfp.a.a(seed);
      System.out.println("{\"kind\":\"names\",\"seed\":" + ql(seed) + ",\"names\":[\"" + bfp.a.a() + "\",\"" + bfp.a.a() + "\",\"" + bfp.a.a() + "\"]}");
    }
    // The word list as the class builds it (private field c).
    String[] words = (String[]) field(bfp.class, "c").get(bfp.a);
    StringBuilder o = new StringBuilder("{\"kind\":\"words\",\"words\":[");
    for (int i = 0; i < words.length; i++) o.append(i > 0 ? "," : "").append('"').append(words[i]).append('"');
    System.out.println(o.append("]}"));
  }

  // GuiEnchantment.updateScreen's book step (bfq.a) on an allocated GUI with a seeded Random.
  static void gui() throws Exception {
    for (int sc = 0; sc < 6; sc++) {
      long seed = 9090L + sc * 31L;
      BookWorld w = (BookWorld) U.allocateInstance(BookWorld.class);
      w.E = true; /* client world: the container leaves the level roll to the server */ ProbePlayer pl = (ProbePlayer) U.allocateInstance(ProbePlayer.class); pl.o = w; pl.bE = new yw();
      yx inv = new yx(pl); pl.bm = inv;
      aag con = new aag(inv, w, 0, 64, 0);
      bfq g = (bfq) U.allocateInstance(bfq.class);
      field(bex.class, "h").set(g, con);
      field(bfq.class, "G").set(g, con);
      field(bfq.class, "F").set(g, new Random(seed));
      StringBuilder steps = new StringBuilder("["), events = new StringBuilder("[");
      Random script = new Random(seed + 5);
      boolean has = false; int[] lv = {0, 0, 0};
      for (int k = 0; k < 220; k++) {
        // Scripted container events: put or take the item, change the three levels.
        if (k == 10 || (k > 10 && script.nextInt(40) == 0)) {
          has = script.nextInt(3) != 0;
          con.a.a(0, has ? new add(adb.d(276), 1, 0) : null);
          lv = has ? new int[]{script.nextInt(3) + 1, script.nextInt(10) + 5, script.nextInt(20) + 10} : new int[]{0, 0, 0};
          if (sc % 2 == 1 && has && script.nextBoolean()) lv = new int[]{0, 0, 0};
          System.arraycopy(lv, 0, con.g, 0, 3);
          if (events.length() > 1) events.append(',');
          events.append("[" + k + "," + has + "," + lv[0] + "," + lv[1] + "," + lv[2] + "]");
        }
        g.a();
        if (k > 0) steps.append(',');
        // u tickCount, v pageFlip, w pageFlipPrev, x flipT, y flipA, z bookSpread, A bookSpreadPrev
        steps.append("[" + g.u + "," + f(g.v) + "," + f(g.w) + "," + f(g.x) + "," + f(g.y) + "," + f(g.z) + "," + f(g.A) + "]");
      }
      System.out.println("{\"kind\":\"gui\",\"scenario\":" + sc + ",\"seed\":" + ql(seed) + ",\"events\":" + events + "],\"ticks\":" + steps + "]}");
    }
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    model(); scenarios(); names(); gui();
  }
}
