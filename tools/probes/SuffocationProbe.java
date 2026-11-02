import java.lang.reflect.Field;
import java.util.*;

// Suffocation (DamageSource.inWall) of the unchanged 1.7.10 classes on the DifficultyProbe
// world double with a block map. Prints one JSON object per line:
//   cube      Block.isNormalCube [aji.r()], also for ids this build lacks (slabs, stairs, ...)
//   inside    Entity.isEntityInsideOpaqueBlock [sa.aa()] for each entity type with one block at
//             (64, 5, 64): rows [x, feet y, z, result] around the sample edges
//   sequence  tick sequences with scripted block changes and hits before the tick's update, then
//             the entity's update: for the player (the real EntityPlayerMP, mw) the start of
//             EntityPlayerMP.onUpdateEntity [mw.h] (`--bU; if (hurtResistantTime > 0) --hurtResistantTime`,
//             which sv.C skips for mw), then sv.C (EntityLivingBase.onEntityUpdate, which calls
//             isEntityInsideOpaqueBlock and attackEntityFrom(inWall, 1)); mobs run sv.C alone.
//             Each tick records health, hurtResistantTime, hurtTime, lastDamage and the sounds.
public class SuffocationProbe {
  public static class World extends DifficultyProbe.World {
    static Map<Long, Integer> cells = new HashMap<>();
    static long key(int x, int y, int z) { return ((long) (x + 1000) * 100000L + (y + 1000)) * 100000L + (z + 1000); }
    // World.setEntityState: status 2 is the hurt flash and, on the client, the hurt sound of EntityPlayer.
    public void a(sa entity, byte state) { ChickenProbe.World.sounds.add("status|" + state); }
    public aji a(int x, int y, int z) { Integer id = cells.get(key(x, y, z)); return aji.e(id != null ? id : (y < 0 ? 1 : 0)); }
  }
  public static abstract class Server extends net.minecraft.server.MinecraftServer {
    Server() { super(null, null); }
  }
  // Only isDedicatedServer (X) is reached by EntityPlayerMP.attackEntityFrom.
  public static class Fake extends Server {
    protected boolean e() { return false; }
    public boolean h() { return false; }
    public ahk i() { return null; }
    public rd j() { return null; }
    public boolean k() { return false; }
    public int l() { return 0; }
    public boolean m() { return false; }
    public boolean X() { return false; }
    public boolean ad() { return false; }
    public String a(ahk w, boolean b) { return null; }
  }
  // EntityPlayerMP.addStat reaches the server's statistics file; the stat counts are not recorded.
  public static class Stats extends pg {
    Stats() { super(null, null); }
    public void a(yz player, ph stat, int amount) {}
    public void b(yz player, ph stat, int amount) {}
  }
  // The original EntityPlayerMP; its death (chat broadcast, inventory scatter) is not run.
  public static class Player extends mw {
    Player() { super(null, null, null, null); }
    public void a(ro source) {}
  }

  static World w;
  static sun.misc.Unsafe u;
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static Field fd(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }
  static float fl(Object o, String n) throws Exception { return fd(o.getClass(), n).getFloat(o); }
  static void pos(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static void put(int x, int y, int z, int id) { World.cells.put(World.key(x, y, z), id); }

  static sv make(String type) throws Exception {
    switch (type) {
      case "pig": return new wo(w);
      case "pigChild": { wo e = new wo(w); e.c(-24000); return e; }
      case "cow": return new wh(w);
      case "sheep": return new wp(w);
      case "chicken": return new wg(w);
      case "zombie": return new yq(w);
      case "skeleton": return new yl(w);
      case "spider": return new yn(w);
      case "creeper": return new xz(w);
      case "player": {
        Player p = (Player) u.allocateInstance(Player.class);
        MobMoveProbe.set(p, "o", w); MobMoveProbe.set(p, "Z", new Random(0)); MobMoveProbe.set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
        te watcher = new te(p); MobMoveProbe.set(p, "af", watcher);
        watcher.a(0, Byte.valueOf((byte) 0)); watcher.a(1, Short.valueOf((short) 300));
        MobMoveProbe.method(yz.class, "c").invoke(p);
        fd(sv.class, "f").set(p, new HashMap());
        MobMoveProbe.set(p, "bE", new yw());
        MobMoveProbe.set(p, "bm", new yx(p));
        MobMoveProbe.set(p, "bp", new zr());
        fd(sv.class, "e").set(p, new rn(p));
        fd(sv.class, "aH").setInt(p, 20); // maxHurtResistantTime, set by the constructor
        fd(sa.class, "M").setFloat(p, 0.6f); // EntityPlayer's constructor: setSize(0.6F, 1.8F)
        fd(sa.class, "N").setFloat(p, 1.8f);
        MobMoveProbe.set(p, "b", u.allocateInstance(Fake.class));
        MobMoveProbe.set(p, "bO", u.allocateInstance(Stats.class));
        MobMoveProbe.method(yz.class, "aD").invoke(p);
        p.g(20.0f);
        return p;
      }
      default: throw new IllegalArgumentException(type);
    }
  }

  static String sounds() {
    StringBuilder s = new StringBuilder();
    for (String x : ChickenProbe.World.sounds) s.append(s.length() == 0 ? "" : ",").append("\"").append(x).append("\"");
    return "[" + s + "]";
  }

  // Positions along one axis around the sample edges (half extent width * 0.8 / 2).
  static double[] axis(float width, int n) {
    float hw = ((1 - 0.5f) * width) * 0.8f;
    double e = 1e-9;
    if (n == 6) return new double[] { 64 - hw - e, 64 - hw + e, 64.3, 64.8, 65 + hw - e, 65 + hw + e };
    return new double[] { 64 - hw + e, 64.5, 65 + hw - e, 65 + hw + e };
  }
  // Feet heights around the cell edges 5 and 6 for the eye height and the +-0.05 sample offsets.
  static double[] heights(float height, boolean player, int n) {
    float eye = player ? 1.62f : height * 0.85f;
    double d = 1e-9, o = 0.05000000074505806;
    List<Double> v = new ArrayList<>();
    if (n == 12) {
      for (double edge : new double[] { 5, 6 })
        for (double off : new double[] { -o, 0, o }) { double base = edge - eye - off; v.add(base - d); v.add(base + d); }
    } else {
      for (double edge : new double[] { 5, 6 }) { double base = edge - eye - o; v.add(base - d); v.add(base + d); }
      v.add(5 - eye + 0.5);
      v.add(5 - eye - 1.0);
    }
    double[] out = new double[v.size()];
    for (int i = 0; i < out.length; i++) out[i] = v.get(i);
    return out;
  }

  static void insideCases() throws Exception {
    String[] types = { "player", "zombie", "skeleton", "creeper", "spider", "pig", "pigChild", "cow", "sheep", "chicken" };
    int[] blocks = { 1, 20, 18, 12, 13, 9, 8, 44, 53, 78, 60, 81, 46, 54, 65, 50, 0, 85, 67, 88, 82, 3, 7, 61 };
    for (String t : types) {
      sv e = make(t);
      float width = fl(e, "M"), height = fl(e, "N");
      for (int id : blocks) {
        boolean full = id == 1;
        boolean few = t.equals("player") || t.equals("zombie") || t.equals("pig") || t.equals("chicken");
        if (!full && !few) continue;
        double[] xs = axis(width, full ? 6 : 4), ys = heights(height, t.equals("player"), full ? 12 : 6);
        World.cells.clear();
        put(64, 5, 64, id);
        StringBuilder rows = new StringBuilder();
        for (double x : xs) for (double z : xs) for (double y : ys) {
          pos(e, x, y, z);
          rows.append(rows.length() == 0 ? "" : ",").append("[").append(num(x)).append(",").append(num(y)).append(",").append(num(z)).append(",").append(e.aa()).append("]");
        }
        System.out.println("{\"case\":\"inside\",\"type\":\"" + t + "\",\"block\":" + id + ",\"width\":" + num(width) + ",\"height\":" + num(height) + ",\"rows\":[" + rows + "]}");
      }
    }
    World.cells.clear();
  }

  // Script ops, before the tick's update: "set:x:y:z:id" and "hit:amount:source" (fall, mob).
  static void sequence(String name, String type, double x, double y, double z, int ticks, Map<Integer, List<String>> script, Map<String, Object> setup) throws Exception {
    World.cells.clear();
    sv e = make(type);
    pos(e, x, y, z);
    boolean player = type.equals("player");
    Field bu = player ? fd(mw.class, "bU") : null;
    if (player) bu.setInt(e, setup.containsKey("protection") ? (Integer) setup.get("protection") : 0);
    if (setup.containsKey("creative")) { yw c = (yw) fd(yz.class, "bE").get(e); c.a = true; }
    if (setup.containsKey("sneak")) MobMoveProbe.method(sa.class, "a", int.class, boolean.class).invoke(e, 1, true);
    if (setup.containsKey("armor")) { yx inv = (yx) fd(yz.class, "bm").get(e); for (int i = 0; i < 4; i++) inv.b[i] = new add(adb.d(306 + i), 1, 0); }
    if (setup.containsKey("health")) e.g((Float) setup.get("health"));
    MobMoveProbe.set(e, "Z", new Random(7));
    MobMoveProbe.set(w, "s", new Random(9));
    yq attacker = new yq(w); pos(attacker, x + 2, y, z);
    Field hr = fd(sa.class, "ad"), ht = fd(sv.class, "ax"), ld = fd(sv.class, "bb");
    StringBuilder out = new StringBuilder(), ops = new StringBuilder();
    for (Map.Entry<Integer, List<String>> en : new TreeMap<>(script).entrySet())
      for (String op : en.getValue()) ops.append(ops.length() == 0 ? "" : ",").append("[").append(en.getKey()).append(",\"").append(op).append("\"]");
    int deadAt = -1;
    for (int t = 0; t < ticks; t++) {
      for (String op : script.getOrDefault(t, new ArrayList<>())) {
        String[] s = op.split(":");
        if (s[0].equals("set")) put(Integer.parseInt(s[1]), Integer.parseInt(s[2]), Integer.parseInt(s[3]), Integer.parseInt(s[4]));
        else e.a(s[2].equals("fall") ? ro.h : ro.a((sv) attacker), Float.parseFloat(s[1]));
      }
      ChickenProbe.World.sounds.clear();
      if (player) {
        bu.setInt(e, bu.getInt(e) - 1);
        if (hr.getInt(e) > 0) hr.setInt(e, hr.getInt(e) - 1);
      }
      boolean in = e.Z() && e.aa();
      e.C();
      if (e.aS() <= 0 && deadAt < 0) deadAt = t;
      out.append(out.length() == 0 ? "" : ",").append("{\"inside\":").append(in).append(",\"health\":").append(num(e.aS())).append(",\"resist\":").append(hr.getInt(e)).append(",\"hurtTime\":").append(ht.getInt(e))
        .append(",\"last\":").append(num(ld.getFloat(e))).append(",\"sounds\":").append(sounds()).append("}");
      if (e.aS() <= 0) break;
    }
    StringBuilder su = new StringBuilder();
    for (Map.Entry<String, Object> en : setup.entrySet()) su.append(su.length() == 0 ? "" : ",").append("\"").append(en.getKey()).append("\":").append(en.getValue() instanceof Float ? num((Float) en.getValue()) : en.getValue().toString());
    System.out.println("{\"case\":\"sequence\",\"name\":\"" + name + "\",\"type\":\"" + type + "\",\"pos\":[" + num(x) + "," + num(y) + "," + num(z) + "],\"setup\":{" + su + "},\"ops\":[" + ops + "],\"ticks\":[" + out + "],\"deadAt\":" + deadAt + "}");
  }
  static Map<Integer, List<String>> script(Object... kv) {
    Map<Integer, List<String>> m = new HashMap<>();
    for (int i = 0; i < kv.length; i += 2) m.computeIfAbsent((Integer) kv[i], k -> new ArrayList<>()).add((String) kv[i + 1]);
    return m;
  }
  static Map<String, Object> setup(Object... kv) {
    Map<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
    return m;
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    u = MobMoveProbe.unsafe();
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

    for (int id : new int[] { 0, 1, 2, 3, 5, 8, 9, 10, 11, 12, 13, 17, 18, 20, 24, 44, 46, 50, 53, 54, 58, 60, 65, 67, 78, 79, 81, 82, 85, 88, 108, 109, 126, 134, 156, 159, 164, 170 })
      System.out.println("{\"case\":\"cube\",\"id\":" + id + ",\"normal\":" + aji.e(id).r() + "}");

    insideCases();

    // Standing at feet y 5 in the cell column (64, 64); the stone goes where the eye samples reach.
    String[] who = { "player", "zombie", "skeleton", "spider", "creeper", "pig", "chicken" };
    for (String t : who) {
      int head = (int) Math.floor(5.0 + (t.equals("player") ? 1.62f : t.equals("chicken") ? 0.7f * 0.85f : t.equals("spider") || t.equals("pig") ? 0.9f * 0.85f : 1.8f * 0.85f));
      sequence("stone-" + t, t, 64.5, 5.0, 64.5, 140, script(0, "set:64:" + head + ":64:1"), setup());
      sequence("stone-removed-" + t, t, 64.5, 5.0, 64.5, 80, script(0, "set:64:" + head + ":64:1", 33, "set:64:" + head + ":64:0"), setup());
    }
    for (String t : new String[] { "player", "zombie" }) {
      for (int id : new int[] { 20, 18, 12, 13, 9, 44, 53, 78, 46, 54, 85, 60, 65 })
        sequence("block" + id + "-" + t, t, 64.5, 5.0, 64.5, 45, script(0, "set:64:6:64:" + id), setup());
      // sand lands in the head cell at tick 12 (a falling block is placed without an entity check), dug out at 40
      sequence("sand-lands-" + t, t, 64.5, 5.0, 64.5, 70, script(12, "set:64:6:64:12", 40, "set:64:6:64:0"), setup());
      sequence("gravel-lands-" + t, t, 64.5, 5.0, 64.5, 70, script(12, "set:64:6:64:13", 40, "set:64:6:64:0"), setup());
      // a box corner just inside / outside the wall cell (half extent 0.24)
      sequence("edge-in-" + t, t, 63.76 + 1e-6, 5.0, 64.5, 60, script(0, "set:64:6:64:1"), setup());
      sequence("edge-out-" + t, t, 63.76 - 1e-6, 5.0, 64.5, 60, script(0, "set:64:6:64:1"), setup());
      for (float first : new float[] { 0.5f, 1.0f, 4.0f, 1.5f })
        for (String src : new String[] { "fall", "mob" })
          sequence("first-" + src + "-" + first + "-" + t, t, 64.5, 5.0, 64.5, 50, script(0, "hit:" + first + ":" + src, 3, "set:64:6:64:1"), setup());
      sequence("wall-then-hits-" + t, t, 64.5, 5.0, 64.5, 60, script(0, "set:64:6:64:1", 4, "hit:3.0:mob", 21, "hit:2.0:fall"), setup());
      sequence("death-" + t, t, 64.5, 5.0, 64.5, 80, script(0, "set:64:6:64:1"), setup("health", 3.5f));
      sequence("death-2-" + t, t, 64.5, 5.0, 64.5, 80, script(0, "set:64:6:64:1"), setup("health", 1.0f));
    }
    sequence("armor-player", "player", 64.5, 5.0, 64.5, 60, script(0, "set:64:6:64:1"), setup("armor", true));
    sequence("creative-player", "player", 64.5, 5.0, 64.5, 60, script(0, "set:64:6:64:1"), setup("creative", true));
    sequence("protected-player", "player", 64.5, 5.0, 64.5, 90, script(0, "set:64:6:64:1"), setup("protection", 60));
    sequence("protected-fall-player", "player", 64.5, 5.0, 64.5, 70, script(0, "set:64:6:64:1", 2, "hit:3.0:fall"), setup("protection", 60));
    // The server's eye is feet + 1.62 whether or not the player sneaks.
    sequence("sneak-player", "player", 64.5, 5.0, 64.5, 40, script(0, "set:64:6:64:1"), setup("sneak", true));
    // Feet 4.35: the upper samples at 4.35 + 1.62 + 0.05 reach cell 6; a client-side sneaking eye (1.54) would not.
    sequence("sneak-low-player", "player", 64.5, 4.35, 64.5, 40, script(0, "set:64:6:64:1"), setup("sneak", true));
    sequence("stand-low-player", "player", 64.5, 4.35, 64.5, 40, script(0, "set:64:6:64:1"), setup());
    sequence("zombie-armor-hit", "zombie", 64.5, 5.0, 64.5, 40, script(0, "set:64:6:64:1", 0, "hit:4.0:mob"), setup());
  }
}
