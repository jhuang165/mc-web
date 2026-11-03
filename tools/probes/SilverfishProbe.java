import java.lang.reflect.Field;
import java.util.*;

// Runs the unchanged EntitySilverfish (yk), BlockSilverfish (amb), EntityMob (yg), EntityCreature (td) and
// EntityLiving (sw) classes of the 1.7.10 JAR on a constructor-less World double. Nothing is patched.
//
// The world double (FishWorld) supplies: a block and metadata map over a stone floor at y < 0, setBlock
// with a log, the original World.func_147480_a (breakBlock), the entity-spawn and sound captures, the real
// PathFinder (ayg) for getPathEntityToEntity / getPathEntityToBlock (every request and its result is logged),
// a real EntityPlayer double (DifficultyProbe.player) and the original getClosestPlayer /
// getClosestVulnerablePlayer / rayTraceBlocks. The World.rand and every Entity.rand are LCG-identical
// java.util.Random objects whose state is read after each tick, so the port can replay the exact draws.
//
// The legacy (non-AI-task) action state `updateEntityActionState` (yk.bq) is the entity method under test.
// Entity physics is not run: after each call a documented kinematic step moves the fish 0.1 block along its
// yaw while moveForward > 0 (the port's test reads the recorded position back; it does not recompute it).
public class SilverfishProbe {
  static final int STONE = 1, DIRT = 3, COBBLE = 4, EGG = 97, BRICK = 98;
  static FishWorld w;
  static sun.misc.Unsafe u;
  static List<String> sets = new ArrayList<>(), pathLog = new ArrayList<>(), hitLog = new ArrayList<>();

  public static class FishWorld extends DifficultyProbe.World {
    static Map<String, Integer> ids = new HashMap<>(), metas = new HashMap<>();
    public aji a(int x, int y, int z) { Integer id = ids.get(x + "," + y + "," + z); return aji.e(id == null ? (y < 0 ? 1 : 0) : id); }
    public int e(int x, int y, int z) { Integer m = metas.get(x + "," + y + "," + z); return m == null ? 0 : m; }
    public boolean d(int x, int y, int z, aji block, int meta, int flags) {
      ids.put(x + "," + y + "," + z, aji.b(block)); metas.put(x + "," + y + "," + z, meta);
      sets.add("[" + x + "," + y + "," + z + "," + aji.b(block) + "," + meta + "," + flags + "]");
      return true;
    }
    public void c(int id, int x, int y, int z, int data) {}
    public ayf a(sa e, sa target, float range, boolean a, boolean b, boolean c, boolean d) {
      ayf p = new ayg(this, a, b, c, d).a(e, target, range);
      pathLog.add("{\"kind\":\"entity\",\"args\":[" + target.s + "," + target.t + "," + target.u + "," + (double) range + "],\"result\":" + path(p) + "}");
      return p;
    }
    public ayf a(sa e, int x, int y, int z, float range, boolean a, boolean b, boolean c, boolean d) {
      ayf p = new ayg(this, a, b, c, d).a(e, x, y, z, range);
      pathLog.add("{\"kind\":\"block\",\"args\":[" + x + "," + y + "," + z + "," + (double) range + "],\"result\":" + path(p) + "}");
      return p;
    }
  }
  static String path(ayf p) {
    if (p == null) return "null";
    StringBuilder s = new StringBuilder();
    for (int i = 0; i < p.d(); i++) { aye n = p.a(i); s.append(i > 0 ? "," : "").append("[").append(n.a).append(",").append(n.b).append(",").append(n.c).append("]"); }
    return "[" + s + "]";
  }

  public static class FishPlayer extends DifficultyProbe.Player { public float g() { return 1.62f; } }
  // A target that records the damage it is hit with.
  public static class Target extends wo {
    public Target(ahb w) { super(w); }
    public boolean a(ro source, float amount) { hitLog.add("[" + (double) amount + ",\"" + source.o + "\"," + (source instanceof rp) + "]"); return true; }
  }
  public static class Fish extends yk {
    int hits;
    Fish(ahb w) { super(w); }
    public boolean n(sa target) { hits++; return true; }
  }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static String q(String s) { return "\"" + s + "\""; }
  static Field fd(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }
  static int summon(yk e) throws Exception { return fd(yk.class, "bp").getInt(e); }
  static ayf path(td e) throws Exception { return (ayf) fd(td.class, "bp").get(e); }

  static void reset() {
    FishWorld.ids.clear(); FishWorld.metas.clear(); sets.clear(); pathLog.clear(); hitLog.clear();
    ChickenProbe.World.spawned.clear(); ChickenProbe.World.sounds.clear();
  }
  static String spawnedJson() {
    StringBuilder s = new StringBuilder();
    for (Object o : ChickenProbe.World.spawned) {
      sa e = (sa) o;
      s.append(s.length() > 0 ? "," : "").append("[").append(q(e instanceof yk ? "silverfish" : e instanceof xk ? "item" : e.getClass().getSimpleName())).append(",").append(e instanceof xk ? "0" : num(e.s)).append(",").append(e instanceof xk ? "0" : num(e.t)).append(",").append(e instanceof xk ? "0" : num(e.u)).append(",").append(e instanceof xk ? "0" : num(e.y)); // item scatter uses Math.random: not recorded
      if (e instanceof xk) { add st = ((xk) e).f(); s.append(",").append(adb.b(st.b())).append(",").append(st.b).append(",").append(st.k()); }
      s.append("]");
    }
    return "[" + s + "]";
  }
  static Fish fish(double x, double y, double z, MobSpawnerProbe.Lcg r) throws Exception {
    Fish e = new Fish(w);
    MobMoveProbe.set(e, "Z", r);
    e.b(x, y, z);
    e.y = 0; e.z = 0; // EntityLivingBase draws a random initial yaw from Math.random(); pin it
    return e;
  }
  static void setBlock(int x, int y, int z, int id, int meta) { FishWorld.ids.put(x + "," + y + "," + z, id); FishWorld.metas.put(x + "," + y + "," + z, meta); }
  static FishPlayer player(double x, double y, double z, boolean creative) throws Exception {
    FishPlayer p = DifficultyProbe.player(u, FishPlayer.class);
    p.M = 0.6f; p.N = 1.8f;
    p.b(x, y, z);
    fd(yz.class, "bm").set(p, new yx(p));
    fd(yz.class, "bp").set(p, new zr());
    MobMoveProbe.field(yw.class, "a").setBoolean(p.bE, creative);
    List players = (List) fd(ahb.class, "h").get(w);
    players.clear(); players.add(p);
    return p;
  }
  static void noPlayers() throws Exception { ((List) fd(ahb.class, "h").get(w)).clear(); }

  // One tick of the unchanged legacy action state followed by the documented kinematic step.
  static String tick(Fish e, int t, MobSpawnerProbe.Lcg r) throws Exception {
    sets.clear(); pathLog.clear(); ChickenProbe.World.spawned.clear(); ChickenProbe.World.sounds.clear(); hitLog.clear();
    int hits0 = e.hits, calls0 = r.calls, wcalls0 = MobSpawnerProbe.rand == null ? 0 : 0;
    e.bq();
    boolean moved = false;
    if (!e.K && e.be > 0) { double yaw = (double) e.y * Math.PI / 180.0; e.b(e.s - Math.sin(yaw) * 0.1, e.t, e.u + Math.cos(yaw) * 0.1); moved = true; }
    ayf p = path(e);
    StringBuilder s = new StringBuilder("{\"t\":" + t);
    s.append(",\"x\":").append(num(e.s)).append(",\"y\":").append(num(e.t)).append(",\"z\":").append(num(e.u));
    s.append(",\"yaw\":").append(num(e.y)).append(",\"pitch\":").append(num(e.z)).append(",\"forward\":").append(num(e.be)).append(",\"jump\":").append(e.bc);
    s.append(",\"target\":").append(e.bm == null ? "null" : q(e.bm instanceof yz ? "player" : "other")).append(",\"hasPath\":").append(p != null);
    if (p != null) s.append(",\"pathIndex\":").append(p.e());
    s.append(",\"summon\":").append(summon(e)).append(",\"attack\":").append(e.aB).append(",\"age\":").append(e.aU).append(",\"dead\":").append(e.K);
    s.append(",\"look\":").append(fd(sw.class, "bu").get(e) != null).append(",\"chase\":").append(fd(sw.class, "g").getInt(e)).append(",\"turn\":").append(num(fd(sw.class, "bf").getFloat(e)));
    s.append(",\"hits\":").append(e.hits - hits0).append(",\"moved\":").append(moved).append(",\"calls\":").append(r.calls - calls0).append(",\"state\":").append(q(Long.toString(r.state)));
    if (!sets.isEmpty()) s.append(",\"sets\":").append(sets);
    if (!pathLog.isEmpty()) s.append(",\"paths\":").append(pathLog);
    if (!ChickenProbe.World.spawned.isEmpty()) s.append(",\"spawned\":").append(spawnedJson());
    return s.append("}").toString();
  }
  static void emit(String kind, String name, String header, List<String> rows) {
    System.out.println("{\"case\":" + q(kind) + ",\"name\":" + q(name) + header + ",\"ticks\":[" + String.join(",", rows) + "]}");
  }

  // ---- facts, sounds, path weight, hurt, attack ---------------------------------------------------------------
  static void facts() throws Exception {
    reset(); noPlayers();
    MobSpawnerProbe.Lcg r = new MobSpawnerProbe.Lcg(1);
    Fish e = fish(0.5, 0, 0.5, r);
    int egg = aji.b(ajn.aU);
    System.out.println("{\"case\":\"facts\",\"width\":" + num(e.M) + ",\"height\":" + num(e.N) + ",\"health\":" + e.a(yj.a).e() + ",\"speed\":" + e.a(yj.d).e()
      + ",\"damage\":" + e.a(yj.e).e() + ",\"followRange\":" + e.a(yj.b).e() + ",\"knockbackResistance\":" + e.a(yj.c).e()
      + ",\"say\":" + q(e.t()) + ",\"hit\":" + q(e.aT()) + ",\"kill\":" + q(e.aU()) + ",\"canTriggerWalking\":" + e.g_() + ",\"validLight\":" + e.j_()
      + ",\"dropItem\":" + adb.b(e.u()) + ",\"arthropod\":" + (e.bd() == sz.c)
      + ",\"health0\":" + num(e.aS()) + ",\"eggBlock\":" + egg + ",\"eggHardness\":" + num(ajn.aU.f(w, 0, 0, 0)) + ",\"eggMaterialToolNotRequired\":" + ajn.aU.o().l()
      + ",\"eggStepSound\":" + q(ajn.aU.H.a()) + "}");
    // The step handler is never reached (canTriggerWalking false) but plays mob.silverfish.step 0.15 / 1.0.
    ChickenProbe.World.sounds.clear(); e.a(0, 0, 0, aji.e(1));
    System.out.println("{\"case\":\"step\",\"sounds\":" + sounds() + "}");
    for (int meta = 0; meta < 6; meta++) System.out.println("{\"case\":\"facing\",\"i\":" + meta + ",\"dx\":" + q.b[meta] + ",\"dy\":" + q.c[meta] + ",\"dz\":" + q.d[meta] + "}");
  }
  static String sounds() {
    StringBuilder s = new StringBuilder();
    for (String x : ChickenProbe.World.sounds) s.append(s.length() > 0 ? "," : "").append(q(x));
    return "[" + s + "]";
  }

  // ModelSilverfish (bia): constructed without OpenGL; the rest pose and setRotationAngles for several ages.
  static void model() throws Exception {
    bia m = new bia();
    Field fa = bia.class.getDeclaredField("a"), fb = bia.class.getDeclaredField("b");
    fa.setAccessible(true); fb.setAccessible(true);
    bix[] a = (bix[]) fa.get(m), b = (bix[]) fb.get(m);
    StringBuilder rest = new StringBuilder();
    for (int i = 0; i < a.length; i++) rest.append(i > 0 ? "," : "").append(ModelProbe.part(a[i]));
    StringBuilder layers = new StringBuilder();
    for (int i = 0; i < b.length; i++) layers.append(i > 0 ? "," : "").append(ModelProbe.part(b[i]));
    System.out.println("{\"case\":\"model\",\"texture\":[" + m.t + "," + m.u + "],\"segments\":[" + rest + "],\"layers\":[" + layers + "]}");
    float[] ages = {0f, 1f, 5.5f, 20f, 100.25f};
    for (float age : ages) {
      m.a(0f, 0f, age, 0f, 0f, 0.0625f, (sa) new Fish(w));
      StringBuilder rows = new StringBuilder();
      for (bix[] set : new bix[][]{a, b}) for (bix r : set) rows.append(rows.length() > 0 ? "," : "").append("[").append(num(r.c)).append(",").append(num(r.d)).append(",").append(num(r.e)).append(",").append(num(r.f)).append(",").append(num(r.g)).append(",").append(num(r.h)).append("]");
      System.out.println("{\"case\":\"pose\",\"age\":" + num(age) + ",\"parts\":[" + rows + "]}");
    }
  }

  static void pathWeights() throws Exception {
    int[] below = {0, STONE, DIRT, COBBLE, BRICK, EGG, 2, 12, 7};
    for (int id : below)
      for (int light : new int[]{0, 4, 8, 15}) {
        reset(); noPlayers();
        DifficultyProbe.World.light = light;
        setBlock(0, -1, 0, id, 0);
        Fish e = fish(0.5, 0, 0.5, new MobSpawnerProbe.Lcg(1));
        System.out.println("{\"case\":\"pathWeight\",\"below\":" + id + ",\"light\":" + light + ",\"weight\":" + num(e.a(0, 0, 0)) + "}");
      }
    DifficultyProbe.World.light = 0;
  }

  static void hurt() throws Exception {
    List<String> names = new ArrayList<>(); List<ro> sources = new ArrayList<>();
    for (Field f : ro.class.getDeclaredFields())
      if (f.getType() == ro.class && java.lang.reflect.Modifier.isStatic(f.getModifiers())) { sources.add((ro) f.get(null)); }
    reset(); noPlayers();
    MobSpawnerProbe.Lcg wr = new MobSpawnerProbe.Lcg(3);
    Target mob = new Target(w); mob.b(2, 0, 0);
    FishPlayer p = player(2, 0, 0, false);
    List<Object[]> all = new ArrayList<>();
    for (ro s : sources) all.add(new Object[]{q(s.o), s});
    all.add(new Object[]{"\"mob\"", ro.a((sv) mob)});
    all.add(new Object[]{"\"player\"", ro.a((yz) p)});
    all.add(new Object[]{"\"thorns\"", ro.a((sa) mob)});
    all.add(new Object[]{"\"indirect\"", ro.a((sa) mob, (sa) p)});
    all.add(new Object[]{"\"indirectMagic\"", ro.b((sa) mob, (sa) p)});
    for (Object[] src : all)
      for (int start : new int[]{0, 7}) {
        reset();
        MobSpawnerProbe.Lcg r = new MobSpawnerProbe.Lcg(11);
        Fish e = fish(0.5, 0, 0.5, r);
        fd(yk.class, "bp").setInt(e, start);
        boolean ret = e.a((ro) src[1], 1.0f);
        System.out.println("{\"case\":\"hurt\",\"source\":" + src[0] + ",\"entitySource\":" + (src[1] instanceof rp) + ",\"startCooldown\":" + start + ",\"returned\":" + ret
          + ",\"cooldown\":" + summon(e) + ",\"health\":" + num(e.aS()) + ",\"target\":" + (e.bm != null) + ",\"calls\":" + r.calls + "}");
      }
  }

  static void attackGrid() throws Exception {
    // attackEntity(target, distance): needs attackTime <= 0, distance < 1.2f and target Y overlap.
    float[] distances = {0f, 1.19f, 1.2f, 1.21f, 2f};
    double[] dys = {-0.9, -0.7, -0.69, 0, 0.69, 0.7, 0.71, 1.7};
    for (float d : distances)
      for (double dy : dys)
        for (int cd : new int[]{0, 1})
          for (boolean player : new boolean[]{false, true}) {
            reset(); noPlayers();
            Fish e = fish(0.5, 0, 0.5, new MobSpawnerProbe.Lcg(5));
            sa target = player ? player(0.5, dy, 0.5, false) : new Target(w);
            if (!player) target.b(0.5, dy, 0.5);
            e.aB = cd;
            e.a(target, d);
            System.out.println("{\"case\":\"attack\",\"distance\":" + num(d) + ",\"targetY\":" + num(dy) + ",\"targetHeight\":" + num(target.N) + ",\"attackTime\":" + cd + ",\"player\":" + player
              + ",\"hits\":" + e.hits + ",\"attackTimeAfter\":" + e.aB + "}");
          }
    // Real attackEntityAsMob on a Target: damage 1.0, source "mob".
    reset(); noPlayers();
    yk real = new yk(w); MobMoveProbe.set(real, "Z", new MobSpawnerProbe.Lcg(5)); real.b(0.5, 0, 0.5);
    Target t = new Target(w); t.b(0.5, 0, 0.5);
    boolean ok = real.n(t);
    System.out.println("{\"case\":\"attackAsMob\",\"returned\":" + ok + ",\"hits\":" + hitLog + "}");
  }

  // findPlayerToAttack: distance 8, no line of sight, creative (disableDamage) players ignored.
  static void findPlayer() throws Exception {
    for (boolean creative : new boolean[]{false, true})
      for (double dist : new double[]{0, 4, 7.99, 8, 8.01, 12}) {
        reset(); noPlayers();
        Fish e = fish(0.5, 0, 0.5, new MobSpawnerProbe.Lcg(5));
        player(0.5 + dist, 0, 0.5, creative);
        sa found = e.bR();
        System.out.println("{\"case\":\"findPlayer\",\"distance\":" + num(dist) + ",\"creative\":" + creative + ",\"found\":" + (found != null) + "}");
      }
    // A wall between the fish and the player does not matter for the search.
    reset(); noPlayers();
    for (int y = 0; y < 3; y++) setBlock(3, y, 0, STONE, 0);
    Fish e = fish(0.5, 0, 0.5, new MobSpawnerProbe.Lcg(5));
    player(6.5, 0, 0.5, false);
    System.out.println("{\"case\":\"findPlayer\",\"distance\":6,\"creative\":false,\"wall\":true,\"found\":" + (e.bR() != null) + ",\"seen\":" + e.p(e.bR()) + "}");
  }

  // ---- tick traces --------------------------------------------------------------------------------------------
  static void chase(String name, long seed, double px, double pz, boolean wall, boolean creative, int ticks) throws Exception {
    reset(); noPlayers();
    if (wall) for (int y = 0; y < 3; y++) for (int z = -1; z <= 1; z++) setBlock(3, y, z, STONE, 0);
    MobSpawnerProbe.Lcg r = new MobSpawnerProbe.Lcg(seed);
    Fish e = fish(0.5, 0, 0.5, r);
    player(px, 0, pz, creative);
    List<String> rows = new ArrayList<>();
    for (int t = 0; t < ticks; t++) rows.add(tick(e, t, r));
    emit("chase", name, ",\"seed\":" + seed + ",\"player\":[" + px + ",0," + pz + "],\"creative\":" + creative + ",\"wall\":" + wall + ",\"start\":[0.5,0,0.5]", rows);
  }
  static void idle(String name, long seed, int floorId, int floorMeta, int ticks) throws Exception {
    reset(); noPlayers();
    if (floorId >= 0) setBlock(0, -1, 0, floorId, floorMeta);
    MobSpawnerProbe.Lcg r = new MobSpawnerProbe.Lcg(seed);
    Fish e = fish(0.5, 0, 0.5, r);
    List<String> rows = new ArrayList<>();
    for (int t = 0; t < ticks && !e.K; t++) rows.add(tick(e, t, r));
    emit("idle", name, ",\"seed\":" + seed + ",\"floor\":[" + floorId + "," + floorMeta + "],\"start\":[0.5,0,0.5]", rows);
  }
  // The hide table: the first tick on which each seed turns into an egg, per floor block.
  static void hideTable() throws Exception {
    int[][] floors = {{STONE, 0}, {COBBLE, 0}, {BRICK, 0}, {BRICK, 1}, {BRICK, 2}, {BRICK, 3}, {DIRT, 0}, {EGG, 0}, {7, 0}};
    for (int[] floor : floors)
      for (long seed = 100; seed < 106; seed++) {
        reset(); noPlayers();
        setBlock(0, -1, 0, floor[0], floor[1]);
        MobSpawnerProbe.Lcg r = new MobSpawnerProbe.Lcg(seed);
        Fish e = fish(0.5, 0, 0.5, r);
        int hidden = -1; String set = "null";
        for (int t = 0; t < 400 && !e.K; t++) {
          sets.clear();
          String row = tick(e, t, r);
          if (e.K) { hidden = t; set = sets.isEmpty() ? "null" : "null"; }
          if (e.K) { set = row.contains("\"sets\":") ? row.substring(row.indexOf("\"sets\":") + 7, row.indexOf("]]", row.indexOf("\"sets\":")) + 2) : "null"; }
        }
        System.out.println("{\"case\":\"hide\",\"floor\":[" + floor[0] + "," + floor[1] + "],\"seed\":" + seed + ",\"tick\":" + hidden + ",\"set\":" + set + ",\"state\":" + q(Long.toString(r.state)) + "}");
      }
  }
  // Waking: the summon cooldown reaches 0 and the scan breaks or converts monster eggs.
  static void wake(String name, long seed, int[][] eggs, boolean griefing, int ticks) throws Exception {
    reset(); noPlayers();
    ((agy) fd(ays.class, "x").get(fd(ahb.class, "x").get(w))).a("mobGriefing", griefing ? "true" : "false");
    for (int[] egg : eggs) setBlock(egg[0], egg[1], egg[2], EGG, egg[3]);
    MobSpawnerProbe.Lcg r = new MobSpawnerProbe.Lcg(seed);
    Fish e = fish(0.5, 0, 0.5, r);
    fd(yk.class, "bp").setInt(e, 1);
    List<String> rows = new ArrayList<>();
    for (int t = 0; t < ticks; t++) rows.add(tick(e, t, r));
    StringBuilder eg = new StringBuilder();
    for (int[] egg : eggs) eg.append(eg.length() > 0 ? "," : "").append("[").append(egg[0]).append(",").append(egg[1]).append(",").append(egg[2]).append(",").append(egg[3]).append("]");
    emit("wake", name, ",\"seed\":" + seed + ",\"griefing\":" + griefing + ",\"eggs\":[" + eg + "]", rows);
    ((agy) fd(ays.class, "x").get(fd(ahb.class, "x").get(w))).a("mobGriefing", "true");
  }

  // ---- BlockSilverfish ------------------------------------------------------------------------------------------
  static void blocks() throws Exception {
    aji[] floorBlocks = {aji.e(0), aji.e(1), aji.e(4), aji.e(98), aji.e(3), ajn.aU, aji.e(20), aji.e(24)};
    int[] ids = {0, 1, 4, 98, 3, 97, 20, 24};
    for (int i = 0; i < ids.length; i++)
      for (int meta = 0; meta < 4; meta++)
        System.out.println("{\"case\":\"canHide\",\"block\":" + ids[i] + ",\"meta\":" + meta + ",\"hides\":" + amb.a(floorBlocks[i]) + ",\"eggMeta\":" + amb.a(floorBlocks[i], meta) + "}");
    for (int meta = 0; meta < 8; meta++) {
      org.apache.commons.lang3.tuple.ImmutablePair pair = amb.b(meta);
      add stack = ((amb) ajn.aU).j(meta);
      System.out.println("{\"case\":\"eggBlock\",\"meta\":" + meta + ",\"block\":" + aji.b((aji) pair.getLeft()) + ",\"blockMeta\":" + pair.getRight()
        + ",\"stack\":[" + adb.b(stack.b()) + "," + stack.b + "," + stack.k() + "]}");
    }
    System.out.println("{\"case\":\"eggBlockFacts\",\"quantityDropped\":" + ajn.aU.a(new Random(1)) + ",\"metaDamage\":[" + ((amb) ajn.aU).k(w, 0, 0, 0) + "]}");
    // Breaking, replaying mx.b(x,y,z) (ItemInWorldManager.tryHarvestBlock): onBlockHarvested, setBlockToAir,
    // onBlockDestroyedByPlayer (removeBlock), then block.harvestBlock(world, player, x, y, z, meta) when the
    // player may harvest. Creative stops after removeBlock. The held tool is none, a pickaxe, or silk touch.
    String[] modes = {"creative", "survival", "survival-pickaxe", "survival-silk"};
    for (int meta = 0; meta < 6; meta++)
      for (String mode : modes) {
        reset(); noPlayers();
        FishPlayer p = player(5.5, 0, 5.5, mode.equals("creative"));
        yx inv = p.bm;
        for (int i = 0; i < inv.a.length; i++) inv.a[i] = null;
        inv.c = 0;
        if (mode.equals("survival-pickaxe")) inv.a[0] = new add(adb.d(257), 1, 0);
        if (mode.equals("survival-silk")) { add pick = new add(adb.d(257), 1, 0); pick.a(aft.b[33], 1); inv.a[0] = pick; }
        MobSpawnerProbe.Lcg wr = new MobSpawnerProbe.Lcg(40 + meta);
        MobMoveProbe.set(w, "s", wr);
        setBlock(0, 0, 0, EGG, meta);
        aji block = w.a(0, 0, 0);
        int m = w.e(0, 0, 0);
        boolean canHarvest = p.a(block);
        // removeBlock
        block.a(w, 0, 0, 0, m, p);
        w.f(0, 0, 0);
        block.b(w, 0, 0, 0, m);
        String afterRemove = spawnedJson(); int removeCalls = wr.calls;
        List<Object> first = new ArrayList<>(ChickenProbe.World.spawned);
        String afterHarvest = afterRemove;
        if (!mode.equals("creative") && canHarvest) { block.a(w, p, 0, 0, 0, m); afterHarvest = spawnedJson(); }
        System.out.println("{\"case\":\"break\",\"meta\":" + meta + ",\"mode\":" + q(mode) + ",\"canHarvest\":" + canHarvest + ",\"afterRemove\":" + afterRemove + ",\"afterHarvest\":" + afterHarvest
          + ",\"removeCalls\":" + removeCalls + ",\"worldCalls\":" + wr.calls + ",\"block\":" + aji.b(w.a(0, 0, 0)) + ",\"sets\":" + sets + "}");
      }
    // dropBlockAsItemWithChance called directly (explosions, harvest): spawns a silverfish when not remote.
    reset(); noPlayers();
    ajn.aU.a(w, 3, 0, 4, 2, 1.0f, 0);
    System.out.println("{\"case\":\"dropWithChance\",\"spawned\":" + spawnedJson() + "}");
    reset(); noPlayers();
    MobMoveProbe.set(w, "E", true);
    ajn.aU.a(w, 3, 0, 4, 2, 1.0f, 0);
    ajn.aU.b(w, 3, 0, 4, 2);
    System.out.println("{\"case\":\"remoteBreak\",\"spawned\":" + spawnedJson() + "}");
    MobMoveProbe.set(w, "E", false);
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    u = MobMoveProbe.unsafe();
    w = (FishWorld) u.allocateInstance(FishWorld.class);
    DifficultyProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    aqq provider = new aqq();
    java.lang.reflect.Method gen = aqo.class.getDeclaredMethod("a"); gen.setAccessible(true); gen.invoke(provider);
    MobMoveProbe.set(w, "t", provider);
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

    facts();
    model();
    pathWeights();
    hurt();
    attackGrid();
    findPlayer();
    chase("open", 21, 6.5, 0.5, false, false, 90);
    chase("open-diagonal", 22, 4.5, 5.5, false, false, 90);
    chase("wall", 23, 6.5, 0.5, true, false, 120);
    chase("creative", 24, 4.5, 0.5, false, true, 60);
    chase("far", 25, 12.5, 0.5, false, false, 120);
    idle("idle-air", 31, -1, 0, 260);
    idle("idle-stone", 32, STONE, 0, 260);
    idle("idle-cobble", 33, COBBLE, 0, 260);
    idle("idle-brick2", 34, BRICK, 2, 260);
    idle("idle-dirt", 35, DIRT, 0, 260);
    hideTable();
    int[][] ring = {{0, 0, 3, 0}, {4, 1, 0, 1}, {-2, 0, 6, 2}, {10, 0, 0, 3}, {-10, -5, 10, 4}, {11, 0, 0, 5}, {0, 6, 0, 0}, {0, -5, 0, 1}, {0, 5, -10, 2}};
    for (long seed = 1; seed <= 24; seed++) {
      wake("ring", seed, ring, true, 3);
      wake("ring-no-griefing", seed, ring, false, 3);
    }
    wake("single", 7, new int[][]{{1, 0, 0, 0}}, true, 3);
    wake("none", 7, new int[][]{{20, 0, 0, 0}}, true, 3);
    blocks();
    // Spawner behaviour: the generic MobSpawnerBaseLogic with entityId "Silverfish" on the real classes.
    u = MobMoveProbe.unsafe();
    MobSpawnerProbe.U = u;
    double cx = MobSpawnerProbe.SX + 0.5, cy = MobSpawnerProbe.SY + 0.5, cz = MobSpawnerProbe.SZ + 0.5;
    double[] near = {cx + 3, MobSpawnerProbe.SY - 1, cz + 2};
    MobSpawnerProbe.scenario("silverfish-spawner", "Silverfish", true, false, 2, "floor", 0, 0, near, null, 41, 1500, -1);
    MobSpawnerProbe.scenario("silverfish-lit", "Silverfish", true, false, 2, "floor", 15, 15, near, null, 42, 900, -1);
    MobSpawnerProbe.scenario("silverfish-player-near", "Silverfish", true, false, 2, "floor", 0, 0, new double[]{cx + 3, MobSpawnerProbe.SY - 1, cz}, null, 43, 400, -1);
    MobSpawnerProbe.scenario("silverfish-peaceful", "Silverfish", true, false, 0, "floor", 0, 0, near, null, 44, 120, -1);
    MobSpawnerProbe.scenario("silverfish-encased", "Silverfish", true, false, 2, "encased", 0, 0, near, null, 45, 120, -1);
  }
}
