import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

// Batch 42 zombie wander. A bare EntityZombie (yq) ticked whole (Entity.onUpdate = h, Entity.ticksExisted++ first) on the unchanged classes in the FireballProbe /
// VillageLiveProbe double (real block shapes from the cell map, real water when asked, an EntityPlayer double far away in closePlayers). Entity.rand is a Log
// (java.util.Random seeded with `zseed`, every call logged). Per tick the row holds what the unchanged AI classes did:
// [x, y, z, vx, vy, vz, rotationYaw, rotationPitch, rotationYawHead, renderYawOffset, onGround, fire ticks, health,
//  draws [i<bound> | f | g | b ...], path [index, [x,y,z]...] or null, moveHelper [x, y, z, speed, update], lookHelper [looking, x, y, z, yawSpeed, pitchSpeed],
//  executing tasks [obfuscated class names], navigator [noPath, speed], bodyHelper [counter, yaw]].
// Script ops "t op ...", applied before the tick: fire seconds, move x z [y], air x y z [id], day 0|1.
public class ZombieWanderProbe {
  static String num(double v) { return Double.toString(v); }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static Object fv(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static Object fvc(Class<?> c, Object o, String n) throws Exception { return MobMoveProbe.field(c, n).get(o); }
  static int iv(Class<?> c, Object o, String n) throws Exception { return MobMoveProbe.field(c, n).getInt(o); }
  static float flv(Class<?> c, Object o, String n) throws Exception { return MobMoveProbe.field(c, n).getFloat(o); }
  static double dv(Class<?> c, Object o, String n) throws Exception { return MobMoveProbe.field(c, n).getDouble(o); }
  static boolean bv(Class<?> c, Object o, String n) throws Exception { return MobMoveProbe.field(c, n).getBoolean(o); }
  static void at(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }

  static int[][] blocks = {};
  static boolean water = false, day = false;

  static int scenario(String name, long zseed, int ticks, double[] zpos, double[] ppos, String[] script, int needBy) throws Exception {
    if (System.getenv("ZW_PREFIX") != null && !name.startsWith(System.getenv("ZW_PREFIX"))) return -2;
    MobMoveProbe.set(VillageLiveProbe.world, "r", rd.values()[2]);
    wc c = VillageLiveProbe.newCollection(zseed);
    VillageLiveProbe.W.players.clear();
    VillageLiveProbe.W.day = day;
    for (int[] b : blocks) for (int x = b[0]; x <= b[3]; x++) for (int y = b[1]; y <= b[4]; y++) for (int z = b[2]; z <= b[5]; z++) VillageLiveProbe.put(x, y, z, b[6], b[7]);
    VillagerProbe.World.light = 15; MobMoveProbe.ProbeWorld.water = water;
    VillagerProbe.World.brightLevel = 15; VillagerProbe.World.brightPatches = new int[][] {}; VillagerProbe.World.vulnerable = true;
    VillagerProbe.World.immediateSlimes = false; VillagerProbe.World.chunkCache = false; VillagerProbe.World.unloaded.clear(); VillagerProbe.World.localDiff = 0;
    ahb w = VillageLiveProbe.world;
    VillageFightProbe.P player = new VillageFightProbe.P(w, "probe");
    SeedRandom.next = 4000000L + zseed * 1000;
    yq z = new yq(w);
    VillageFightProbe.Log log = new VillageFightProbe.Log(zseed);
    VillagerProbe.World.entities.clear();
    for (String fn : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(z, fn, 0f);
    MobMoveProbe.set(z, "Z", log);
    at(z, zpos[0], zpos.length > 2 ? zpos[2] : 0, zpos[1]);
    MobMoveProbe.set(z, "D", true);
    VillagerProbe.World.entities.add(z);
    player.a(yj.a).a(1000.0);
    player.g(1000.0f);
    MobMoveProbe.set(player, "L", 0f);
    at(player, ppos[0], ppos.length > 2 ? ppos[2] : 0, ppos[1]);
    VillageLiveProbe.W.players.put("probe", player);
    VillagerProbe.World.closePlayers = new ArrayList<yz>(Arrays.asList(player));
    VillagerProbe.World.spawned.clear();
    List<String> rows = new ArrayList<>();
    int firstPath = -1;
    String lastPath = "";
    for (int t = 0; t < ticks; t++) {
      for (String op : script) {
        String[] p = op.split(" ");
        if (Integer.parseInt(p[0]) != t) continue;
        switch (p[1]) {
          case "fire": z.e(Integer.parseInt(p[2])); break;
          case "move": at(z, Double.parseDouble(p[2]), p.length > 4 ? Double.parseDouble(p[4]) : z.t, Double.parseDouble(p[3])); break;
          case "air": VillageLiveProbe.put(Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4]), p.length > 5 ? Integer.parseInt(p[5]) : 0, 0); break;
          case "day": VillageLiveProbe.W.day = p[2].equals("1"); break;
          default: throw new RuntimeException(op);
        }
      }
      int before = log.log.size();
      if (!z.K) { z.aa++; z.h(); }
      VillagerProbe.World.entities.removeIf(e -> e.K);
      StringBuilder row = new StringBuilder("[");
      row.append(num(z.s)).append(",").append(num(z.t)).append(",").append(num(z.u)).append(",").append(num(z.v)).append(",").append(num(z.w)).append(",").append(num(z.x)).append(",")
        .append(num(z.y)).append(",").append(num(z.z)).append(",").append(num(flv(sv.class, z, "aO"))).append(",").append(num(flv(sv.class, z, "aM"))).append(",")
        .append(z.D ? 1 : 0).append(",").append(iv(sa.class, z, "e")).append(",").append(num(z.aS())).append(",[");
      for (int k = before; k < log.log.size(); k++) row.append(k > before ? "," : "").append(q(log.log.get(k)));
      row.append("],");
      vv nav = z.m();
      Object path = fvc(vv.class, nav, "c");
      if (path == null) { row.append("null"); lastPath = ""; }
      else {
        ayf pf = (ayf) path;
        if (firstPath < 0) firstPath = t;
        StringBuilder pts = new StringBuilder();
        for (int k = 0; k < pf.d(); k++) { aye a = pf.a(k); pts.append(",[").append(a.a).append(",").append(a.b).append(",").append(a.c).append("]"); }
        row.append("[").append(iv(ayf.class, pf, "b"));
        if (!pts.toString().equals(lastPath)) row.append(pts); // the points only when they differ from the previous tick's path
        lastPath = pts.toString();
        row.append("]");
      }
      tv mh = z.k();
      row.append(",[").append(num(dv(tv.class, mh, "b"))).append(",").append(num(dv(tv.class, mh, "c"))).append(",").append(num(dv(tv.class, mh, "d"))).append(",").append(num(dv(tv.class, mh, "e"))).append(",").append(bv(tv.class, mh, "f") ? 1 : 0).append("]");
      tu lh = z.j();
      row.append(",[").append(bv(tu.class, lh, "d") ? 1 : 0).append(",").append(num(dv(tu.class, lh, "e"))).append(",").append(num(dv(tu.class, lh, "f"))).append(",").append(num(dv(tu.class, lh, "g"))).append(",").append(num(flv(tu.class, lh, "b"))).append(",").append(num(flv(tu.class, lh, "c"))).append("],[");
      List<?> ex = (List<?>) fvc(uj.class, fv(z, "c"), "c");
      boolean first = true;
      for (Object te : ex) { Object a = MobMoveProbe.field(te.getClass(), "a").get(te); row.append(first ? "" : ",").append(q(a.getClass().getName())); first = false; }
      row.append("],[").append(nav.g() ? 1 : 0).append(",").append(num(dv(vv.class, nav, "d"))).append("],[")
        .append(iv(tr.class, fvc(sw.class, z, "bn"), "b")).append(",").append(num(flv(tr.class, fvc(sw.class, z, "bn"), "c"))).append("]]");
      rows.add(row.toString());
    }
    if (needBy >= 0 && (firstPath < 0 || firstPath > needBy)) { VillagerProbe.reset(); return -1; }
    StringBuilder sc = new StringBuilder();
    for (String s : script) sc.append(sc.length() > 0 ? "," : "").append(q(s));
    System.out.println("{\"name\":" + q(name) + ",\"zseed\":" + zseed + ",\"ticks\":" + ticks + ",\"day\":" + day + ",\"water\":" + water + (blocks.length > 0 ? ",\"blocks\":" + Arrays.deepToString(blocks) : "")
      + ",\"zombie\":" + Arrays.toString(zpos) + ",\"player\":" + Arrays.toString(ppos) + ",\"script\":[" + sc + "],\"rows\":[" + String.join(",", rows) + "]}");
    VillagerProbe.reset();
    return firstPath;
  }

  // Seeds from `from` upward until `want` of them wander (first path built by tick 60); each kept record has 120 ticks.
  static void family(String prefix, long from, int want, double[] zpos, double[] ppos, String[] script) throws Exception {
    for (long s = from; want > 0 && s < from + 400; s++) { int fp = scenario(prefix + "-" + s, s, 120, zpos, ppos, script, 60); if (System.getenv("ZW_DEBUG") != null) System.err.println(prefix + " " + s + " " + fp); if (fp >= 0) want--; }
  }

  static final double[] FAR = {150.5, 150.5};

  static void scenarios() throws Exception {
    String[] none = {};
    // flat stone floor (the probe's floor is below y 0). Batch 41's seed 4109 volley put the idle zombie at index 1: Entity.rand seed 4109 * 10 + 1 = 41091, at (72.5, 64.5).
    scenario("zw-flat-41091", 41091, 120, new double[] {72.5, 64.5}, new double[] {60.5, 105.5}, none, 60);
    family("zw-flat", 41092, 4, new double[] {72.5, 64.5}, FAR, none);
    // a slope: stone steps rising along +z
    blocks = new int[][] {{66, 0, 66, 80, 0, 80, 1, 0}, {66, 1, 70, 80, 1, 80, 1, 0}, {66, 2, 74, 80, 2, 80, 1, 0}, {66, 3, 78, 80, 3, 80, 1, 0}};
    family("zw-slope", 42001, 4, new double[] {72.5, 68.5}, FAR, none);
    // a pool (water at y 0 and 1) with a stone rim below: the zombie stands beside it
    water = true; blocks = new int[][] {{66, -1, 60, 80, -1, 80, 1, 0}, {70, 0, 62, 76, 1, 68, 9, 0}};
    family("zw-water", 42101, 4, new double[] {72.5, 70.5}, FAR, none);
    water = false; blocks = new int[][] {};
    // daylight (the zombie burns); and a zombie set on fire at tick 20 at night
    day = true;
    family("zw-sun", 42201, 3, new double[] {72.5, 64.5}, FAR, none);
    day = false;
    family("zw-fire", 42301, 2, new double[] {72.5, 64.5}, FAR, new String[] {"20 fire 5"});
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    VillagerProbe.World.pickEntities = true;
    MobMoveProbe.ProbeWorld.exact = true;
    VillagerProbe.World.realRays = true;
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    ArmorEnchantmentProbe.U = u;
    FireballProbe.FW w = (FireballProbe.FW) u.allocateInstance(FireballProbe.FW.class);
    VillageLiveProbe.world = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    MobMoveProbe.set(info, "x", new agy());
    MobMoveProbe.set(w, "x", info);
    MobMoveProbe.set(w, "r", rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new bac()); }
    scenarios();
  }
}
