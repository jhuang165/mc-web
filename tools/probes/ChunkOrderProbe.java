import java.lang.reflect.Field;
import java.util.*;

// World.getEntitiesWithinAABBExcludingEntity (ahb.b, executed unchanged) over REAL chunks (apx, with their 16 vertical entity lists, filled and emptied by the real
// apx.a(sa) addEntity and apx.a(sa, int) removeEntityAtIndex). Only the loaded-chunk test (ahb.c) and the chunk lookup (ahb.e) are answered by a map.
// The re-slice after an entity's update is World.updateEntityWithOptionalForce's tail (ahb.a(sa, boolean), bytecode-read, composed here): compare floor(pos / 16)
// with the stored chunk cell (ah, ai, aj) and, when they differ, remove from the old chunk and addEntity to the new one (which appends).
// Case "order": 2-6 large fireballs (zg) that meet one ray at the same distance, over chunk and slice borders (and above y 256), with adds, moves and updates in
// between; recorded are the candidate list order of the player's pick box and the ball EntityRenderer.getMouseOver's loop picks (as in FireballPickProbe).
// Case "trigger": EntityPlayer.onLivingUpdate's arrow pickup (yz.e, bytecode-read: box = riding entity alive ? box.union(riding box).expand(1, 0, 1) :
// box.expand(1, 0.5, 1); every listed entity that is not dead gets onCollideWithPlayer, run here on the real EntityArrow zc.b_) with stuck arrows over chunk borders.
public class ChunkOrderProbe {
  public static class CW extends EquipmentProbe.World {
    static Map<Long, apx> chunks = new HashMap<>();
    static List<String> sounds = new ArrayList<>();
    static long key(int x, int z) { return ((long) x << 32) ^ (z & 0xffffffffL); }
    public boolean c(int x, int z) { return chunks.containsKey(key(x, z)); }
    public apx e(int x, int z) { return chunks.get(key(x, z)); }
    public void a(sa e, String name, float v, float p) { sounds.add(name); }
    // ChickenProbe.World stubs both entity queries; the real ahb.a(sa, azt, sj) is reached through invokespecial from ProbeWorld's lookup (ahb is its direct superclass).
    static final java.lang.invoke.MethodHandle REAL;
    static {
      try { REAL = java.lang.invoke.MethodHandles.privateLookupIn(MobMoveProbe.ProbeWorld.class, java.lang.invoke.MethodHandles.lookup()).findSpecial(ahb.class, "a", java.lang.invoke.MethodType.methodType(List.class, sa.class, azt.class, sj.class), MobMoveProbe.ProbeWorld.class); }
      catch (Exception x) { throw new RuntimeException(x); }
    }
    public List a(sa e, azt box, sj selector) { try { List r = (List) REAL.invoke(this, e, box, selector); return r; } catch (Throwable x) { throw new RuntimeException(x); } }
    public List b(sa e, azt box) { return a(e, box, null); }
  }
  public static class Pl extends PlayerKnockbackProbe.P {
    static List<sa> taken = new ArrayList<>();
    Pl(ahb world) { super(world); }
    public void a(sa e, int n) { taken.add(e); }
  }
  static sun.misc.Unsafe u;
  static String num(double v) { return Double.toString(v); }
  static void set(Object o, String n, Object v) throws Exception { MobMoveProbe.set(o, n, v); }
  static void place(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static int fl16(double v) { return (int) Math.floor(v / 16.0); }

  static void load(int lo, int hi) throws Exception {
    CW.chunks.clear();
    for (int x = lo; x <= hi; x++) for (int z = lo; z <= hi; z++) {
      apx c = (apx) u.allocateInstance(apx.class);
      u.putInt(c, u.objectFieldOffset(apx.class.getDeclaredField("g")), x);
      u.putInt(c, u.objectFieldOffset(apx.class.getDeclaredField("h")), z);
      List[] lists = new List[16];
      for (int i = 0; i < 16; i++) lists[i] = new ArrayList();
      c.j = lists;
      CW.chunks.put(CW.key(x, z), c);
    }
  }
  // World.spawnEntityInWorld for a non-player in a loaded chunk: chunk.addEntity (apx.a(sa)) at the entity's position.
  static void spawn(CW w, sa e) { w.e(fl16(e.s), fl16(e.u)).a(e); }
  // updateEntityWithOptionalForce's chunk check, after the entity's update.
  static void reslice(CW w, sa e) {
    int cx = fl16(e.s), cy = fl16(e.t), cz = fl16(e.u);
    if (!e.ag || e.ah != cx || e.ai != cy || e.aj != cz) {
      if (e.ag && w.c(e.ah, e.aj)) w.e(e.ah, e.aj).a(e, e.ai);
      if (w.c(cx, cz)) w.e(cx, cz).a(e); else e.ag = false;
    }
  }
  static CW world() throws Exception {
    aji.p(); adb.l();
    u = MobMoveProbe.unsafe();
    CW w = (CW) u.allocateInstance(CW.class);
    PlayerKnockbackProbe.w = null; PlayerKnockbackProbe.u = u; DifficultyProbe.w = w; EquipmentProbe.u = u;
    set(w, "s", new Random(2)); set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(w, info);
    MobMoveProbe.field(ahb.class, "A").set(w, new wc(w));
    MobMoveProbe.field(ahb.class, "t").set(w, u.allocateInstance(aqq.class));
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    MobMoveProbe.field(ahb.class, "J").set(w, date);
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    DifficultyProbe.setDifficulty(2);
    return w;
  }
  static Pl player(CW w, double x, double y, double z) throws Exception {
    Pl p = new Pl(w);
    set(p, "Z", new Random(0));
    p.a(yj.a).a(1000.0); p.g(1000.0f);
    place(p, x, y, z);
    return p;
  }
  static String arr(double... v) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < v.length; i++) { if (i > 0) b.append(','); b.append(num(v[i])); } return b.append(']').toString(); }
  static String ints(List<Integer> l) { return l.toString().replace(" ", ""); }

  public static void main(String[] args) throws Exception {
    CW w = world();
    Random rnd = new Random(72);
    double[] edge = { -0.5, -0.2, 0.0, 0.3, 0.5, 15.8, 15.5 };
    double[] lateral = { -0.9, -0.6, -0.3, 0.0, 0.3, 0.6, 0.9 };
    double[][] dirs = { { 1, 0, 0 }, { -1, 0, 0 }, { 0, 0, 1 }, { 0, 0, -1 }, { 0, 1, 0 }, { 0, -1, 0 } };
    List<String> out = new ArrayList<>();
    for (int n = 0; n < 700; n++) {
      load(-3, 8);
      int axis = rnd.nextInt(6);
      double[] o = new double[3];
      for (int c = 0; c < 3; c++) o[c] = 16.0 * (1 + rnd.nextInt(2)) + edge[rnd.nextInt(edge.length)];
      int band = rnd.nextInt(10);
      if (band == 0) o[1] = 255.5 + rnd.nextInt(3) * 0.4; // above the top slice
      if (band == 1) o[1] = 0.3 + rnd.nextInt(3) * 0.3; // the lowest slice and below
      double[] d = dirs[axis];
      double dist = 1.6 + rnd.nextInt(4) * 0.4;
      int nb = 2 + rnd.nextInt(5);
      boolean creative = rnd.nextInt(3) == 0;
      double reach = creative ? 6.0 : 3.0;
      List<sa> balls = new ArrayList<>();
      List<String> ops = new ArrayList<>();
      int along = new int[] { 0, 2, 1 }[axis / 2];
      // ball box minY = y, so the ball's centre is y + 0.5; the lateral axes are the two that are not `along`
      for (int i = 0; i < nb; i++) {
        double[] p = new double[3];
        for (int c = 0; c < 3; c++) p[c] = c == along ? o[c] + d[c] * dist : o[c] + lateral[rnd.nextInt(lateral.length)];
        p[1] -= 0.5;
        if (along == 1) p[1] = o[1] + d[1] * dist - 0.5;
        sa b = new zg(w, p[0], p[1], p[2], 0, 0, 0.1);
        place(b, p[0], p[1], p[2]);
        spawn(w, b);
        balls.add(b);
        ops.add("[\"add\"," + i + "," + arr(p) + "]");
        if (rnd.nextInt(4) == 0) { // move an existing ball sideways (it keeps the distance along the ray)
          int j = rnd.nextInt(balls.size());
          double[] q = new double[3];
          for (int c = 0; c < 3; c++) q[c] = c == along ? o[c] + d[c] * dist : o[c] + lateral[rnd.nextInt(lateral.length)];
          q[1] -= 0.5; if (along == 1) q[1] = o[1] + d[1] * dist - 0.5;
          place(balls.get(j), q[0], q[1], q[2]); reslice(w, balls.get(j));
          ops.add("[\"move\"," + j + "," + arr(q) + "]");
        }
      }
      for (int t = rnd.nextInt(3); t > 0; t--) { for (sa b : balls) reslice(w, b); ops.add("[\"tick\"]"); }
      Pl p = player(w, o[0], o[1], o[2]);
      azt vb = (azt) MobMoveProbe.field(sa.class, "C").get(p);
      List list = w.b(p, vb.a(d[0] * reach, d[1] * reach, d[2] * reach).b(1.0, 1.0, 1.0));
      azw start = azw.a(o[0], o[1], o[2]), end = start.c(d[0] * reach, d[1] * reach, d[2] * reach);
      double d2 = reach; sa pointed = null; double pickDist = -1;
      for (Object oo : list) {
        sa e = (sa) oo;
        if (!e.R()) continue;
        float f = e.af();
        azt grown = ((azt) MobMoveProbe.field(sa.class, "C").get(e)).b(f, f, f);
        azu mop = grown.a(start, end);
        if (grown.a(start)) { pointed = e; pickDist = mop == null ? 0.0 : start.d(mop.f); d2 = 0.0; }
        else if (mop != null) { double d3 = start.d(mop.f); if (d3 < d2 || d2 == 0.0D) { pointed = e; pickDist = d3; d2 = d3; } }
      }
      List<Integer> order = new ArrayList<>();
      for (Object oo : list) order.add(balls.indexOf(oo));
      out.add("{\"case\":\"order\",\"eye\":" + arr(o) + ",\"look\":" + arr(d) + ",\"creative\":" + creative + ",\"ops\":[" + String.join(",", ops) + "],\"candidates\":" + ints(order)
        + ",\"picked\":" + (pointed == null ? -1 : balls.indexOf(pointed)) + ",\"distance\":" + num(pointed == null ? -1 : pickDist) + "}");
    }
    // the arrow trigger
    String[] invs = { "empty", "full63", "full" };
    double[] offs = { -1.55, -1.3, -0.9, -0.3, 0.0, 0.3, 0.9, 1.3, 1.55 };
    double[] ys = { -0.75, -0.5, -0.4, 0.0, 0.9, 1.8, 2.2, 2.3, 2.55 };
    for (int n = 0; n < 700; n++) {
      load(-3, 8);
      CW.sounds.clear(); Pl.taken.clear();
      double px = 16.0 * (1 + rnd.nextInt(2)) + edge[rnd.nextInt(edge.length)], pz = 16.0 * (1 + rnd.nextInt(2)) + edge[rnd.nextInt(edge.length)];
      double py = 16.0 * (1 + rnd.nextInt(2)) + (rnd.nextInt(2) == 0 ? -0.5 : 0.0) + rnd.nextInt(3) * 0.2; // the feet
      Pl p = player(w, px, py + 1.62, pz); // setPosition: posY is the eye, the box starts 1.62 below
      String inv = invs[rnd.nextInt(invs.length)];
      ArrowPickupProbe.fill(p, inv);
      int na = 2 + rnd.nextInt(4);
      List<sa> arrows = new ArrayList<>(); StringBuilder as = new StringBuilder();
      for (int i = 0; i < na; i++) {
        double ax = px + offs[rnd.nextInt(offs.length)], az = pz + offs[rnd.nextInt(offs.length)], ay = py + ys[rnd.nextInt(ys.length)];
        int shake = rnd.nextInt(6) == 0 ? 3 : 0;
        zc a = new zc(w, ax, ay, az);
        set(a, "i", true); set(a, "b", shake); set(a, "a", 1); set(a, "Z", new Random(7));
        spawn(w, a); arrows.add(a);
        as.append(i > 0 ? "," : "").append("[").append(num(ax)).append(",").append(num(ay)).append(",").append(num(az)).append(",").append(shake).append("]");
      }
      sa veh = null; String vs = "null";
      int mode = rnd.nextInt(4); // 0, 1: no vehicle; 2: living vehicle; 3: dead vehicle
      if (mode >= 2) {
        double vx = px + offs[rnd.nextInt(offs.length)], vz = pz + offs[rnd.nextInt(offs.length)], vy = py - 0.2 + rnd.nextInt(3) * 0.4;
        veh = new zg(w, vx, vy, vz, 0, 0, 0.1); place(veh, vx, vy, vz);
        if (mode == 3) set(veh, "K", true);
        set(p, "m", veh);
        vs = "[" + num(vx) + "," + num(vy) + "," + num(vz) + "," + (mode == 3) + "]";
      }
      int before = ArrowPickupProbe.arrows(p);
      azt pb = (azt) MobMoveProbe.field(sa.class, "C").get(p);
      sa riding = (sa) MobMoveProbe.field(sa.class, "m").get(p);
      azt box = riding != null && !riding.K ? pb.a((azt) MobMoveProbe.field(sa.class, "C").get(riding)).b(1.0, 0.0, 1.0) : pb.b(1.0, 0.5, 1.0);
      List list = w.b(p, box);
      List<Integer> order = new ArrayList<>();
      for (Object oo : list) order.add(arrows.indexOf(oo));
      for (Object oo : list) { sa e = (sa) oo; if (!e.K) e.b_(p); }
      List<Integer> taken = new ArrayList<>();
      for (sa e : Pl.taken) taken.add(arrows.indexOf(e));
      out.add("{\"case\":\"trigger\",\"feet\":" + arr(px, py, pz) + ",\"arrows\":[" + as + "],\"vehicle\":" + vs + ",\"inventory\":\"" + inv + "\",\"candidates\":" + ints(order) + ",\"taken\":" + ints(taken)
        + ",\"arrowsBefore\":" + before + ",\"arrowsAfter\":" + ArrowPickupProbe.arrows(p) + ",\"sounds\":" + CW.sounds.size() + "}");
    }
    for (String s : out) System.out.println(s);
  }
}
