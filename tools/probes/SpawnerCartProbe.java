import java.lang.reflect.Method;
import java.util.*;

// Runs the unchanged EntityMinecartMobSpawner [xt] with its MinecartMobSpawner logic [xu] over MobSpawnerBaseLogic [agq] and
// WeightedRandomMinecart [agr], EntityMinecart [xl].h / killMinecart, on the MinecartProbe map-backed World double with a stone
// floor below SpawnerCartProbe.FLOOR. The spawn queries (counting, aux 2004, entity events, spawned entities, closest player) are
// recorded like MobSpawnerProbe's. Spider and CaveSpider are swapped for subclasses that only seed Entity.rand and log getCanSpawnHere
// (super's result unchanged). The NBT cases read and write real tags through xt.readEntityFromNBT / writeEntityToNBT (reflection on
// the protected methods). tools/verify-spawner-cart.mjs writes public/research/spawner-cart-reference.json.
public class SpawnerCartProbe {
  static final int FLOOR = 19;
  static List<sa> mobs = new ArrayList<>();
  static List<String> attempts = new ArrayList<>(), spawnLog = new ArrayList<>(), auxes = new ArrayList<>(), particles = new ArrayList<>();
  static int events = 0;
  static long seedBase = 0; static int seedIndex = 0;
  static boolean remoteWorld = false;

  public static class SW extends MinecartProbe.MW {
    public aji a(int x, int y, int z) { return y < FLOOR ? aji.e(1) : aji.e(0); }
    public int e(int x, int y, int z) { return 0; }
    public int b(ahn type, int x, int y, int z) { return 0; }
    public int b(int x, int y, int z, boolean neighbours) { return 0; }
    public boolean d(sa e) {
      if (e instanceof xk) { spawned.add(e); return true; }
      mobs.add(e);
      spawnLog.add("{\"x\":" + MinecartProbe.num(e.s) + ",\"y\":" + MinecartProbe.num(e.t) + ",\"z\":" + MinecartProbe.num(e.u) + ",\"yaw\":" + MinecartProbe.num(e.y) + "}");
      return true;
    }
    public void c(int id, int x, int y, int z, int data) { if (id == 2004) auxes.add("[" + x + "," + y + "," + z + "," + data + "]"); }
    public void a(sa e, byte id) { events++; }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) {
      particles.add("[\"" + name + "\"," + MinecartProbe.num(x) + "," + MinecartProbe.num(y) + "," + MinecartProbe.num(z) + "]");
    }
    public List a(Class c, azt box, sj selector) {
      List out = new ArrayList();
      // The query class is the registered class the real game would count (Spider counts its CaveSpider subclass).
      Class q = c == SeededSpider.class ? yn.class : c == SeededCave.class ? xy.class : c;
      for (sa e : mobs) if (q.isAssignableFrom(e.getClass()) && e.C.b(box)) out.add(e);
      return out;
    }
    public List a(sa exclude, azt box, sj selector) { return new ArrayList(); }
    public aor o(int x, int y, int z) { return null; }
  }

  static void seed(sa e) {
    long seed = ((seedBase + seedIndex++) * 0x9E3779B97F4A7C15L) & MobSpawnerProbe.MASK;
    try { MobMoveProbe.set(e, "Z", new Random(seed)); } catch (Exception x) { throw new RuntimeException(x); }
    e.getClass();
  }
  static String attempt(String type, sa e, boolean ok) {
    return "{\"type\":\"" + type + "\",\"x\":" + MinecartProbe.num(e.s) + ",\"y\":" + MinecartProbe.num(e.t) + ",\"z\":" + MinecartProbe.num(e.u) + ",\"yaw\":" + MinecartProbe.num(e.y) + ",\"ok\":" + ok + "}";
  }
  public static class SeededCave extends xy {
    public SeededCave(ahb w) { super(w); seed(this); }
    public boolean by() { boolean ok = super.by(); attempts.add(attempt("CaveSpider", this, ok)); return ok; }
  }
  public static class SeededSpider extends yn {
    public SeededSpider(ahb w) { super(w); seed(this); }
    public boolean by() { boolean ok = super.by(); attempts.add(attempt("Spider", this, ok)); return ok; }
  }

  static SW world() throws Exception {
    SW w = (SW) PlantProbe.unsafe.allocateInstance(SW.class);
    aqq provider = new aqq(); Method gen = aqo.class.getDeclaredMethod("a"); gen.setAccessible(true); gen.invoke(provider);
    MobMoveProbe.set(w, "t", provider);
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.set(w, "r", rd.c);
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, remoteWorld);
    MobMoveProbe.field(ahb.class, "h").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "L").set(w, new ArrayList());
    w.cells = new HashMap<>(); w.entities = new ArrayList<>(); w.spawned = new ArrayList<>();
    return w;
  }
  static Method read, write;
  static void nbtRead(xt c, dh t) throws Exception { read.invoke(c, t); }
  static dh nbtWrite(xt c) throws Exception { dh t = new dh(); write.invoke(c, t); return t; }
  static String q(String s) { return "\"" + s + "\""; }

  static dh compound(Object... kv) {
    dh t = new dh();
    for (int i = 0; i < kv.length; i += 2) {
      String k = (String) kv[i]; Object v = kv[i + 1];
      if (v instanceof Short) t.a(k, (Short) v); else if (v instanceof Integer) t.a(k, (Integer) v); else if (v instanceof Byte) t.a(k, (Byte) v);
      else if (v instanceof String) t.a(k, (String) v); else if (v instanceof dy) t.a(k, (dy) v);
    }
    return t;
  }
  static dq list(dh... items) { dq l = new dq(); for (dh i : items) l.a(i); return l; }

  static void nbtCase(String name, dh input) throws Exception {
    SW w = world();
    xt c = new xt(w, 0.5, 20, 0.5);
    if (input != null) nbtRead(c, input);
    agq logic = c.e();
    String first = NbtProbe.tag(nbtWrite(c));
    xt d = new xt(w, 0.5, 20, 0.5); nbtRead(d, nbtWrite(c));
    System.out.println("{\"case\":\"nbt\",\"name\":" + q(name) + ",\"input\":" + (input == null ? "null" : NbtProbe.tag(input)) + ",\"entityId\":" + q(logic.e()) + ",\"delay\":" + logic.b
      + ",\"output\":" + first + ",\"again\":" + NbtProbe.tag(nbtWrite(d)) + "}");
  }

  static String cartState(xt c) {
    return "[" + MinecartProbe.num(c.s) + "," + MinecartProbe.num(c.t) + "," + MinecartProbe.num(c.u) + "," + MinecartProbe.num(c.v) + "," + MinecartProbe.num(c.w) + "," + MinecartProbe.num(c.x) + "," + c.K + "]";
  }

  interface Setup { void apply(xt c) throws Exception; }
  static void scenario(String name, double[] at, double[] motion, double[] player, long worldSeed, int ticks, Setup setup, int killTick, boolean remote, dh input) throws Exception {
    mobs.clear(); seedBase = worldSeed * 1000; seedIndex = 0; remoteWorld = remote;
    Map<String, Class> map = MobSpawnerProbe.names(); Class oc = map.get("CaveSpider"), os = map.get("Spider");
    map.put("CaveSpider", SeededCave.class); map.put("Spider", SeededSpider.class);
    // Entity.writeToNBTOptional (used by the SpawnData / Properties merge) needs the class registered under its id.
    java.lang.reflect.Field classToName = sg.class.getDeclaredField("d"); classToName.setAccessible(true);
    Map<Class, String> names = (Map<Class, String>) classToName.get(null);
    names.put(SeededCave.class, "CaveSpider"); names.put(SeededSpider.class, "Spider");
    SW w = world();
    MobSpawnerProbe.Lcg rand = new MobSpawnerProbe.Lcg(worldSeed); MobMoveProbe.set(w, "s", rand);
    if (player != null) ((List) MobMoveProbe.field(ahb.class, "h").get(w)).add(MobSpawnerProbe.player(player[0], player[1], player[2]));
    xt cart = new xt(w, at[0], at[1], at[2]);
    MobMoveProbe.set(cart, "Z", new Random(1000)); MobMoveProbe.field(sa.class, "c").setInt(cart, 1);
    cart.v = motion[0]; cart.w = motion[1]; cart.x = motion[2];
    if (input != null) nbtRead(cart, input);
    if (setup != null) setup.apply(cart);
    agq logic = cart.e();
    String start = NbtProbe.tag(nbtWrite(cart));
    StringBuilder rows = new StringBuilder();
    for (int t = 0; t < ticks; t++) {
      attempts.clear(); spawnLog.clear(); auxes.clear(); particles.clear(); events = 0; rand.calls = 0; w.spawned.clear();
      String hit = "";
      if (t == killTick) { cart.a(MinecartProbe.source("generic"), 5f); }
      if (!cart.K) {
        cart.S = cart.s; cart.T = cart.t; cart.U = cart.u; cart.A = cart.y; cart.B = cart.z;
        cart.h();
      }
      StringBuilder items = new StringBuilder();
      for (sa e : w.spawned) if (e instanceof xk) items.append(items.length() > 0 ? "," : "").append(MinecartProbe.item(e));
      rows.append(rows.length() > 0 ? "," : "").append("{\"t\":").append(t).append(",\"cart\":").append(cartState(cart)).append(",\"delay\":").append(logic.b)
        .append(",\"pos\":[").append(logic.b()).append(",").append(logic.c()).append(",").append(logic.d()).append("]");
      if (rand.calls > 0) rows.append(",\"state\":").append(q(Long.toString(rand.state))).append(",\"calls\":").append(rand.calls);
      if (remote) rows.append(",\"rot\":").append(MinecartProbe.num(logic.c)).append(",\"prev\":").append(MinecartProbe.num(logic.d)).append(",\"particles\":").append(particles);
      if (!attempts.isEmpty()) rows.append(",\"attempts\":").append(attempts);
      if (!spawnLog.isEmpty()) rows.append(",\"spawned\":").append(spawnLog);
      if (!auxes.isEmpty()) rows.append(",\"aux\":").append(auxes);
      if (events > 0) rows.append(",\"events\":").append(events);
      if (items.length() > 0) rows.append(",\"drops\":[").append(items).append("]");
      rows.append("}");
    }
    map.put("CaveSpider", oc); map.put("Spider", os);
    names.remove(SeededCave.class); names.remove(SeededSpider.class);
    System.out.println("{\"case\":\"scenario\",\"name\":" + q(name) + ",\"remote\":" + remote + ",\"floor\":" + FLOOR + ",\"cart\":[" + at[0] + "," + at[1] + "," + at[2] + "]"
      + ",\"motion\":[" + motion[0] + "," + motion[1] + "," + motion[2] + "],\"player\":" + (player == null ? "null" : "[" + player[0] + "," + player[1] + "," + player[2] + "]")
      + ",\"worldSeed\":" + worldSeed + ",\"killTick\":" + killTick + ",\"input\":" + (input == null ? "null" : NbtProbe.tag(input)) + ",\"start\":" + start
      + ",\"entityId\":" + q(logic.e()) + ",\"end\":" + NbtProbe.tag(nbtWrite(cart)) + ",\"ticks\":[" + rows + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe(); MobSpawnerProbe.U = PlantProbe.unsafe;
    read = xt.class.getDeclaredMethod("a", dh.class); read.setAccessible(true);
    write = xt.class.getDeclaredMethod("b", dh.class); write.setAccessible(true);
    SW w0 = world(); xt probe = new xt(w0, 0, 0, 0);
    System.out.println("{\"case\":\"facts\",\"type\":" + probe.m() + ",\"displayBlock\":" + aji.b(probe.o()) + ",\"offset\":" + probe.s() + ",\"defaultEntityId\":" + q(probe.e().e())
      + ",\"defaultDelay\":" + probe.e().b + ",\"width\":" + MinecartProbe.num(probe.M) + ",\"height\":" + MinecartProbe.num(probe.N) + "}");

    nbtCase("default", null);
    nbtCase("custom", compound("EntityId", "Zombie", "Delay", (short) 7, "MinSpawnDelay", (short) 10, "MaxSpawnDelay", (short) 30, "SpawnCount", (short) 2,
      "MaxNearbyEntities", (short) 9, "RequiredPlayerRange", (short) 33, "SpawnRange", (short) 3));
    nbtCase("min-gates-max-and-count", compound("MinSpawnDelay", (short) 50, "SpawnRange", (short) 5));
    nbtCase("max-without-min-ignored", compound("MaxSpawnDelay", (short) 90, "SpawnCount", (short) 6));
    nbtCase("nearby-gates-range", compound("RequiredPlayerRange", (short) 40, "SpawnRange", (short) 2));
    nbtCase("nearby-with-range", compound("MaxNearbyEntities", (short) 3, "RequiredPlayerRange", (short) 40));
    nbtCase("delay-int-and-negative", compound("Delay", (short) -1));
    nbtCase("spawn-data", compound("EntityId", "Pig", "SpawnData", compound("id", "Creeper", "powered", (byte) 1)));
    nbtCase("spawn-data-and-potentials", compound("EntityId", "Pig", "SpawnData", compound("id", "Creeper"), "SpawnPotentials", list(
      compound("Type", "Zombie", "Weight", 2, "Properties", compound("IsVillager", (byte) 1)), compound("Type", "Skeleton", "Weight", 5, "Properties", compound("SkeletonType", (byte) 1)))));
    nbtCase("potentials-only", compound("SpawnPotentials", list(compound("Type", "Sheep", "Weight", 4, "Properties", compound("Color", (byte) 3)), compound("Type", "Cow", "Weight", 1, "Properties", new dh()))));
    nbtCase("potential-no-weight-or-properties", compound("SpawnPotentials", list(compound("Type", "Pig"))));
    nbtCase("potential-minecart-quirk", compound("SpawnPotentials", list(compound("Type", "Minecart", "Weight", 1, "Properties", compound("Type", 1)),
      compound("Type", "Minecart", "Weight", 1, "Properties", compound("Type", 2)), compound("Type", "Minecart", "Weight", 1, "Properties", compound("Type", 0)),
      compound("Type", "Minecart", "Weight", 1, "Properties", compound("Type", 9)), compound("Type", "Minecart", "Weight", 1, "Properties", new dh()))));
    nbtCase("spawn-data-minecart", compound("SpawnData", compound("id", "Minecart", "Type", 1)));
    nbtCase("empty-potentials-with-data", compound("SpawnData", compound("id", "Ghast"), "SpawnPotentials", new dq()));

    double[] over = {8.5, 24.5, 8.5}, still = {0, 0, 0};
    double[] player = {11.5, 18, 10.5};
    scenario("falling-default-delays", over, still, player, 1, 700, c -> c.e().a("CaveSpider"), -1, false, null);
    scenario("falling-fast-delays", over, still, player, 2, 160, null, -1, false, full("CaveSpider"));
    scenario("moving-floor-position", new double[] {2.2, 19.4, 2.2}, new double[] {0.4, 0, 0.4}, player, 3, 80, null, -1, false, full("CaveSpider"));
    scenario("spawn-data-spider", over, still, player, 4, 120, null, -1, false, full("Spider", "SpawnData", compound("id", "Spider")));
    scenario("spawn-data-pos", over, still, player, 5, 80, null, -1, false, full("CaveSpider", "SpawnData", compound("id", "CaveSpider", "Pos", list2(10.5, 19, 9.5))));
    scenario("potentials-weighted", over, still, player, 6, 300, null, -1, false, full("CaveSpider",
      "SpawnPotentials", list(compound("Type", "CaveSpider", "Weight", 1, "Properties", new dh()), compound("Type", "Spider", "Weight", 3, "Properties", new dh()))));
    scenario("no-player", over, still, null, 7, 60, null, -1, false, compound("EntityId", "CaveSpider", "Delay", (short) 2));
    scenario("player-out-of-range", over, still, new double[] {8.5 + 16, 24.5, 8.5}, 8, 60, null, -1, false, compound("EntityId", "CaveSpider", "Delay", (short) 2));
    scenario("unknown-id", over, still, player, 9, 40, null, -1, false, compound("EntityId", "NoSuchMob", "Delay", (short) 2));
    scenario("kill-drops-minecart", over, still, player, 10, 6, null, 2, false, compound("EntityId", "CaveSpider", "Delay", (short) 200));
    scenario("client", over, still, player, 11, 60, null, -1, true, compound("EntityId", "CaveSpider", "Delay", (short) 2));
  }
  static dh full(String id, Object... more) {
    List<Object> kv = new ArrayList<>(Arrays.asList("EntityId", id, "Delay", (short) 2, "MinSpawnDelay", (short) 5, "MaxSpawnDelay", (short) 10, "SpawnCount", (short) 3,
      "MaxNearbyEntities", (short) 6, "RequiredPlayerRange", (short) 16, "SpawnRange", (short) 4));
    kv.addAll(Arrays.asList(more));
    return compound(kv.toArray());
  }
  static dq list2(double... v) { dq l = new dq(); for (double d : v) l.a(new dk(d)); return l; }
}
