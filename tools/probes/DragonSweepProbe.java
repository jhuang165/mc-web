import java.lang.reflect.*;
import java.util.*;

// Unchanged World.getEntitiesWithinAABBExcludingEntity -> Chunk.getEntitiesWithinAABBForEntity (apx.a(sa, azt, List, sj)) with the dragon in real chunk entity lists,
// plus real EntityArrow (zc) and EntitySnowball (zj) sweeps against the dragon's parts. EntityDragon is subclassed only to log attackEntityFromPart (xa.a(wy, ro, float)).
//   sweepList  the list a query box returns: the dragon (7) and its parts in list order (parts are listed only when the dragon's own box meets the query, and the dragon only
//              if its chunk/slice is inside the query's chunk range +/- 2)
//   sweepShot  an arrow or snowball aimed through a point of one part (and through overlaps of two parts): the part it strikes first, per tick, with the start and motion
// Prints one JSON object per line with a "case" key.
public class DragonSweepProbe {
  static String q(String s) { return TerrainProbe.q(s); }
  static Field fd(Class<?> c, String n) throws Exception { return TerrainProbe.field(c, n); }
  static String num(double v) { return Double.toString(v); }
  static String box(azt b) { return "[" + num(b.a) + "," + num(b.b) + "," + num(b.c) + "," + num(b.d) + "," + num(b.e) + "," + num(b.f) + "]"; }

  public static class CW extends EndProbe.W {
    // the entity list methods are deliberately NOT overridden: World.getEntitiesWithinAABBExcludingEntity runs for real
    public void a(String name, double x, double y, double z, double a, double b, double c) {}
    public void b(int type, int x, int y, int z, int data) {}
    public void a(sa e, String name, float volume, float pitch) {}
    public void a(double x, double y, double z, String name, float volume, float pitch) {}
    public boolean d(sa e) { return true; }
  }
  public static class XD extends xa {
    List<Integer> hits = new ArrayList<>();
    XD(ahb w) { super(w); }
    public boolean a(wy part, ro src, float f) { hits.add(Arrays.asList(bp).indexOf(part)); return false; }
  }

  static CW world() throws Exception {
    CW w = SpringProbe.world(CW.class, 0, 1);
    w.manager = new aie(ahu.x, 0.0F);
    w.spawned = new ArrayList<>(); w.explosions = new ArrayList<>(); w.blockLog = new StringBuilder();
    w.partDigest = java.security.MessageDigest.getInstance("SHA-1");
    aji[] air = new aji[65536]; byte[] meta = new byte[65536];
    for (int cx = -5; cx <= 5; cx++) for (int cz = -5; cz <= 5; cz++) SpringProbe.chunk(w, cx, cz, air.clone(), meta.clone());
    return w;
  }
  static XD dragon(CW w, double x, double y, double z, float yaw, long seed, int ticks) throws Exception {
    XD d = new XD(w);
    fd(sa.class, "Z").set(d, new Random(seed));
    d.b(x, y, z, yaw, 0f);
    for (int t = 0; t < ticks; t++) { d.aa++; d.e(); }
    int cx = (int) Math.floor(d.s / 16.0), cz = (int) Math.floor(d.u / 16.0);
    w.e(cx, cz).a(d);
    return d;
  }
  static String names(CW w, XD d, List l) {
    StringBuilder s = new StringBuilder("[");
    for (Object o : l) { if (s.length() > 1) s.append(','); s.append(o == d ? 7 : Arrays.asList(d.bp).indexOf(o)); }
    return s.append(']').toString();
  }
  static String boxes(XD d) { StringBuilder s = new StringBuilder("["); for (int i = 0; i < 7; i++) { if (i > 0) s.append(','); s.append(box(d.bp[i].C)); } return s.append(']').toString(); }

  static final double[][] SCENES = {{15.9, 100.3, 7.7, 33, 3}, {-0.4, 15.8, 31.9, 190, 5}, {47.9, 70, -16.1, 270, 4}, {8, 40, 8, 10, 6}, {0.2, 100.5, 0.2, 77, 2}};

  static void sweepList() throws Exception {
    for (int sc = 0; sc < SCENES.length; sc++) {
      double[] p = SCENES[sc];
      CW w = world();
      XD d = dragon(w, p[0], p[1], p[2], (float) p[3], 500 + sc, (int) p[4]);
      Random r = new Random(900 + sc);
      StringBuilder qs = new StringBuilder();
      for (int i = 0; i < 250; i++) {
        double sx = 0.3 + r.nextDouble() * 5, sy = 0.3 + r.nextDouble() * 4, sz = 0.3 + r.nextDouble() * 5;
        double cx = d.s + (r.nextDouble() - 0.5) * 28, cy = d.t + (r.nextDouble() - 0.5) * 12, cz = d.u + (r.nextDouble() - 0.5) * 28;
        azt b = azt.a(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2);
        List l = w.b((sa) null, b);
        if (qs.length() > 0) qs.append(',');
        qs.append("{\"box\":" + box(b) + ",\"list\":" + names(w, d, l) + "}");
      }
      System.out.println("{\"case\":\"sweepList\",\"scene\":" + sc + ",\"dragon\":[" + num(d.s) + "," + num(d.t) + "," + num(d.u) + "],\"parent\":" + box(d.C) + ",\"boxes\":" + boxes(d) + ",\"queries\":[" + qs + "]}");
    }
  }

  static void shots() throws Exception {
    double[][] dirs = {{1, 0, 0}, {0, 0, -1}, {0.6, -0.5, 0.62}, {-0.4, 0.7, -0.59}, {0, -1, 0}, {-0.8, 0.1, 0.59}};
    for (int sc = 0; sc < SCENES.length; sc++) for (String kind : new String[] {"arrow", "snowball"}) {
      if (kind.equals("snowball") && sc > 1) continue;
      double[] p = SCENES[sc];
      StringBuilder shots = new StringBuilder();
      String boxes0 = null; String pos0 = null;
      int n = 0;
      // aim points: each part's centre and the centre of every pair of adjacent parts' overlap region
      for (int target = 0; target < 7 + 6; target++) for (int di = 0; di < dirs.length; di++) {
        CW w = world();
        XD d = dragon(w, p[0], p[1], p[2], (float) p[3], 500 + sc, (int) p[4]);
        if (boxes0 == null) { boxes0 = boxes(d); pos0 = "[" + num(d.s) + "," + num(d.t) + "," + num(d.u) + "]"; }
        azt a = d.bp[target < 7 ? target : target - 7].C, b = d.bp[target < 7 ? target : target - 6].C;
        double px = target < 7 ? (a.a + a.d) / 2 : (Math.max(a.a, b.a) + Math.min(a.d, b.d)) / 2, py = target < 7 ? (a.b + a.e) / 2 : (Math.max(a.b, b.b) + Math.min(a.e, b.e)) / 2, pz = target < 7 ? (a.c + a.f) / 2 : (Math.max(a.c, b.c) + Math.min(a.f, b.f)) / 2;
        double len = Math.sqrt(dirs[di][0] * dirs[di][0] + dirs[di][1] * dirs[di][1] + dirs[di][2] * dirs[di][2]);
        double back = 1.4 + (di % 3);
        double sx = px - dirs[di][0] / len * back, sy = py - dirs[di][1] / len * back, sz = pz - dirs[di][2] / len * back;
        sa e;
        float speed = kind.equals("arrow") ? 1.6f : 1.5f;
        if (kind.equals("arrow")) { zc ar = new zc(w, sx, sy, sz); fd(sa.class, "Z").set(ar, new Random(77 + target * 13 + di)); ar.c(dirs[di][0], dirs[di][1], dirs[di][2], speed * 2f, 0f); e = ar; }
        else { zj sb = new zj(w, sx, sy, sz); fd(sa.class, "Z").set(sb, new Random(77 + target * 13 + di)); sb.c(dirs[di][0], dirs[di][1], dirs[di][2], speed * 2f, 0f); e = sb; }
        String start = "[" + num(e.s) + "," + num(e.t) + "," + num(e.u) + "]", motion = "[" + num(e.v) + "," + num(e.w) + "," + num(e.x) + "]";
        int hitTick = -1;
        StringBuilder path = new StringBuilder();
        for (int t = 1; t <= 4 && hitTick < 0; t++) {
          e.h();
          if (path.length() > 0) path.append(',');
          path.append("[" + num(e.s) + "," + num(e.t) + "," + num(e.u) + "]");
          if (!d.hits.isEmpty()) hitTick = t;
        }
        if (shots.length() > 0) shots.append(',');
        shots.append("{\"target\":" + target + ",\"dir\":" + di + ",\"start\":" + start + ",\"motion\":" + motion + ",\"hitTick\":" + hitTick + ",\"hit\":" + (d.hits.isEmpty() ? -1 : d.hits.get(0)) + ",\"hits\":" + d.hits + ",\"path\":[" + path + "],\"dead\":" + e.K + "}");
        n++;
      }
      System.out.println("{\"case\":\"sweepShot\",\"scene\":" + sc + ",\"kind\":" + q(kind) + ",\"dragon\":" + pos0 + ",\"boxes\":" + boxes0 + ",\"shots\":[" + shots + "]}");
    }
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    TerrainProbe.unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();
    adb.l();
    sweepList();
    shots();
  }
}
