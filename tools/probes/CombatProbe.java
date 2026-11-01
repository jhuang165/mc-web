import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Mob hurt, death and pushing of the unchanged 1.7.10 classes on the DifficultyProbe world
// double: EntityLivingBase.attackEntityFrom (hurt resistance, setBeenAttacked, knockBack,
// hurt/death sound pitch), onDeath (dropFewItems per mob, dropEquipment, the rare-drop
// roll), onDeathUpdate (experience at deathTime 20) and collideWithNearbyEntities /
// Entity.applyEntityCollision. The double lists entities whose boxes meet the query box.
// No game class is patched or shipped.
public class CombatProbe {
  public static class World extends DifficultyProbe.World {
    static List<sa> near = new ArrayList<>();
    public List b(sa entity, azt box) {
      List<sa> out = new ArrayList<>();
      for (sa e : near) if (e != entity && e.C.b(box)) out.add(e);
      return out;
    }
  }
  static World w;
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static Field fd(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }
  static void pos(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static String motion(sa e) { return "[" + num(e.v) + "," + num(e.w) + "," + num(e.x) + "]"; }
  static int nextOf(sa e) throws Exception { return ((Random) fd(sa.class, "Z").get(e)).nextInt(); }

  static sv make(String type) {
    switch (type) {
      case "pig": return new wo(w);
      case "cow": return new wh(w);
      case "sheep": return new wp(w);
      case "chicken": return new wg(w);
      case "zombie": return new yq(w);
      case "skeleton": return new yl(w);
      case "spider": return new yn(w);
      default: return new xz(w);
    }
  }
  static String drops() {
    StringBuilder s = new StringBuilder();
    for (Object o : World.spawned)
      if (o instanceof xk) {
        add stack = ((xk) o).f();
        s.append(s.length() == 0 ? "" : ",").append("[").append(adb.b(stack.b())).append(",").append(stack.b).append(",").append(stack.k()).append("]");
      }
    return "[" + s + "]";
  }
  static String xp() throws Exception {
    StringBuilder s = new StringBuilder();
    for (Object o : World.spawned) if (o instanceof sq) s.append(s.length() == 0 ? "" : ",").append(fd(sq.class, "e").getInt(o));
    return "[" + s + "]";
  }
  static String sounds() {
    StringBuilder s = new StringBuilder();
    for (String x : ChickenProbe.World.sounds) s.append(s.length() == 0 ? "" : ",").append("\"").append(x).append("\"");
    return "[" + s + "]";
  }
  // The counters EntityLivingBase.onEntityUpdate runs down between two hits.
  static void age(sv e, int ticks) throws Exception {
    Field hr = fd(sa.class, "ad"), ht = fd(sv.class, "ax"), rh = fd(sv.class, "aS"), ap = fd(sv.class, "aR");
    for (int t = 0; t < ticks; t++) {
      if (ht.getInt(e) > 0) ht.setInt(e, ht.getInt(e) - 1);
      if (hr.getInt(e) > 0) hr.setInt(e, hr.getInt(e) - 1);
      if (ap.get(e) != null) { if (rh.getInt(e) > 0) rh.setInt(e, rh.getInt(e) - 1); else ap.set(e, null); }
    }
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    w = (World) u.allocateInstance(World.class);
    DifficultyProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    fd(ahb.class, "t").set(w, u.allocateInstance(aqq.class));
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    fd(ays.class, "g").setLong(info, 1);
    fd(ays.class, "x").set(info, new agy());
    fd(ahb.class, "x").set(w, info);
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    fd(ahb.class, "J").set(w, date);
    fd(ahb.class, "r").set(w, rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class) { f.setAccessible(true); f.set(w, new bac()); }
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    Method deathUpdate = MobMoveProbe.method(sv.class, "aF"), push = MobMoveProbe.method(sv.class, "bo");

    // Entity.canBePushed for the entity kinds of this build.
    yz player = DifficultyProbe.player(u, DifficultyProbe.Player.class);
    fd(yz.class, "bm").set(player, new yx(player));
    yq dead = new yq(w); dead.B();
    Object[][] kinds = { { "zombie", new yq(w) }, { "deadZombie", dead }, { "player", player }, { "item", new xk(w) }, { "xpOrb", new sq(w) }, { "arrow", new zc(w) }, { "tnt", new xw(w) }, { "falling", new xj(w) } };
    for (Object[] k : kinds) System.out.println("{\"case\":\"pushable\",\"kind\":\"" + k[0] + "\",\"value\":" + ((sa) k[1]).S() + "}");

    // collideWithNearbyEntities of `a` with `b` beside it.
    String[][] pairs = { { "zombie", "zombie" }, { "pig", "zombie" }, { "spider", "chicken" }, { "cow", "sheep" } };
    double[][] offsets = { { 0, 0, 0 }, { 0.005, 0, 0.004 }, { 0.3, 0, 0 }, { 0.25, 0, -0.4 }, { -0.7, 0, 0.1 }, { 0.79, 0, 0 }, { 0.81, 0, 0 }, { 0.5, 1.79, 0.5 }, { 0.5, 1.81, 0.5 }, { -1.1, 0, -0.2 }, { 0.02, 0, -0.01 }, { 0.9, 0, 0.9 } };
    for (String[] p : pairs)
      for (double[] o : offsets)
        for (boolean bDead : new boolean[] { false, true }) {
          sv a = make(p[0]), b = make(p[1]);
          pos(a, 3.5, 0, -2.25); pos(b, 3.5 + o[0], o[1], -2.25 + o[2]);
          a.v = 0.01; a.x = -0.02; b.v = 0; b.w = -0.0784; b.x = 0;
          if (bDead) b.B();
          World.near = Arrays.asList(a, b);
          push.invoke(a);
          System.out.println("{\"case\":\"push\",\"a\":\"" + p[0] + "\",\"b\":\"" + p[1] + "\",\"offset\":[" + num(o[0]) + "," + num(o[1]) + "," + num(o[2]) + "],\"bDead\":" + bDead
            + ",\"aBox\":[" + num(a.C.a) + "," + num(a.C.d) + "],\"bBox\":[" + num(b.C.a) + "," + num(b.C.d) + "],\"aMotion\":" + motion(a) + ",\"bMotion\":" + motion(b) + "}");
        }
    World.near = new ArrayList<>();

    // attackEntityFrom sequences, then onDeathUpdate to deathTime 20. Steps are
    // source:amount:ticks-before; the attacker stands at (x + 2, z + 0.5).
    String[][] scenarios = {
      { "player:4:0", "player:6:5", "player:3:3", "player:30:11" },
      { "fall:3:0", "drown:2:11", "fire:1:11", "player:100:11" },
      { "player:1:0", "lava:4:150", "fire:100:11" },
      { "mob:100:0" },
      { "player:5:0", "player:100:2" },
      { "player:100:0" },
      { "skelArrow:100:0" },
    };
    String[] types = { "pig", "cow", "sheep", "chicken", "zombie", "skeleton", "spider", "creeper" };
    yq attacker = new yq(w);
    yl shooter = new yl(w);
    zc arrow = new zc(w);
    for (String type : types)
      for (int child = 0; child < (type.equals("pig") || type.equals("cow") || type.equals("sheep") || type.equals("chicken") ? 2 : 1); child++)
        for (int sc = 0; sc < scenarios.length; sc++)
          for (int seed = 0; seed < 12; seed++) {
            boolean burning = sc == 5 && seed % 2 == 1;
            sv e = make(type);
            pos(e, 8.5, 0, -4.5);
            if (child == 1) ((rx) e).c(-24000);
            if (type.equals("sheep")) { ((wp) e).s(seed % 16); ((wp) e).i(sc == 4 && seed % 3 == 0); }
            if (type.equals("skeleton")) e.c(0, new add(ade.f));
            if (type.equals("zombie") && sc == 4) e.a(yj.c).a(0.5);
            if (burning) e.e(8);
            Random rand = new Random(seed * 31 + sc);
            MobMoveProbe.set(e, "Z", rand);
            MobMoveProbe.set(w, "s", new Random(seed + 500));
            pos(player, 10.5, 0, -4.0); pos(attacker, 10.5, 0, -4.0); pos(shooter, 10.5, 0, -4.0);
            StringBuilder steps = new StringBuilder();
            World.spawned.clear();
            for (String step : scenarios[sc]) {
              String[] s = step.split(":");
              age(e, Integer.parseInt(s[2]));
              ro source;
              switch (s[0]) {
                case "player": source = ro.a(player); break;
                case "mob": source = ro.a((sv) attacker); break;
                case "skelArrow": source = ro.a(arrow, shooter); break;
                case "fall": source = ro.h; break;
                case "fire": source = ro.b; break;
                case "lava": source = ro.c; break;
                default: source = ro.e;
              }
              ChickenProbe.World.sounds.clear();
              e.v = 0; e.w = 0; e.x = 0;
              boolean hit = e.a(source, Float.parseFloat(s[1]));
              steps.append(steps.length() == 0 ? "" : ",").append("{\"step\":\"").append(step).append("\",\"hit\":").append(hit).append(",\"health\":").append(num(e.aS()))
                .append(",\"motion\":").append(motion(e)).append(",\"limb\":").append(num(fd(sv.class, "aF").getFloat(e))).append(",\"resist\":").append(fd(sa.class, "ad").getInt(e))
                .append(",\"hurtTime\":").append(fd(sv.class, "ax").getInt(e)).append(",\"lastDamage\":").append(num(fd(sv.class, "bb").getFloat(e))).append(",\"recentlyHit\":").append(fd(sv.class, "aS").getInt(e))
                .append(",\"sounds\":").append(sounds()).append(",\"drops\":").append(drops()).append("}");
              World.spawned.clear();
              if (e.aS() <= 0) break;
            }
            String death = "null";
            if (e.aS() <= 0) {
              int worldBefore = 0;
              for (int t = 0; t < 20; t++) { deathUpdate.invoke(e); age(e, 1); }
              death = "{\"xp\":" + xp() + ",\"dead\":" + fd(sa.class, "K").getBoolean(e) + "}";
            }
            System.out.println("{\"case\":\"hurt\",\"type\":\"" + type + "\",\"child\":" + (child == 1) + ",\"scenario\":" + sc + ",\"seed\":" + (seed * 31 + sc) + ",\"worldSeed\":" + (seed + 500)
              + ",\"burning\":" + burning + ",\"color\":" + (type.equals("sheep") ? ((wp) e).bZ() : 0) + ",\"sheared\":" + (type.equals("sheep") && ((wp) e).ca())
              + ",\"steps\":[" + steps + "],\"death\":" + death + ",\"randNext\":" + rand.nextInt() + ",\"worldNext\":" + w.s.nextInt() + "}");
          }

    // EntityXPOrb.getXPSplit as onDeathUpdate uses it.
    StringBuilder split = new StringBuilder();
    for (int v : new int[] { 1, 2, 3, 5, 6, 7, 8, 10, 17, 20 }) split.append(split.length() == 0 ? "" : ",").append("[").append(v).append(",").append(sq.a(v)).append("]");
    System.out.println("{\"case\":\"split\",\"values\":[" + split + "]}");
  }
}
