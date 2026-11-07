import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

// Runs the unchanged VillageCollection (wc), Village (vz), VillageDoorInfo (vy), EntityIronGolem (wt),
// EntityAIVillagerMate (up), EntityAIMoveIndoors (ur), EntityAIRestrictOpenDoor (ve), EntityAIFollowGolem (vj),
// EntityAIPlay (va) and EntityAILookAtVillager (ux) from the 1.7.10 JAR on the VillagerProbe flat world
// (stone below y 0; block 64 wooden doors; a rectangle list that hides the sky). World.A is the real wc.
// Output, one JSON object per line: scenario (door layouts + villager positions, village digests on change),
// golemSpawn, reputation, doorMath, golemFacts, golemAttack, golemDrops, gate rows, mating rows.
public class VillageLiveProbe {
  public static class W extends VillagerProbe.World {
    static List<int[]> roofs = new ArrayList<>();
    static boolean day = true, rain = false;
    static List<String> events = new ArrayList<>();
    public boolean i(int x, int y, int z) { for (int[] r : roofs) if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return false; return true; }
    // setBlockToAir (batch 19 door walk): the door cell goes, and BlockDoor.onNeighborBlockChange takes the other half with it.
    public boolean f(int x, int y, int z) { VillagerProbe.World.cells.remove(VillagerProbe.key(x, y, z)); VillagerProbe.World.cells.remove(VillagerProbe.key(x, y + 1, z)); VillagerProbe.World.cells.remove(VillagerProbe.key(x, y - 1, z)); return true; }
    public boolean w() { return day; }
    public boolean Q() { return rain; }
    public void a(sa e, byte b) { events.add(e.getClass().getSimpleName() + "|" + b); }
    static List<String> particles = new ArrayList<>();
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) { particles.add(name + "|" + x + "|" + y + "|" + z + "|" + vx + "|" + vy + "|" + vz); }
  }

  // A Random that logs every nextInt(bound) and nextFloat so the replay can reuse the draws made at the end of a tick.
  public static class LogRandom extends Random {
    static List<String> log = new ArrayList<>();
    LogRandom(long seed) { super(seed); }
    public int nextInt(int bound) { int r = super.nextInt(bound); log.add("i" + bound + ":" + r); return r; }
    public float nextFloat() { float r = super.nextFloat(); log.add("f:" + r); return r; }
  }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static Object get(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static int gi(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).getInt(o); }
  static void put(int x, int y, int z, int id, int meta) { VillagerProbe.World.cells.put(VillagerProbe.key(x, y, z), new int[] {id, meta}); }
  static void door(int x, int y, int z, int meta) { put(x, y, z, 64, meta); put(x, y + 1, z, 64, 8); }
  static void rmdoor(int x, int y, int z) { VillagerProbe.World.cells.remove(VillagerProbe.key(x, y, z)); VillagerProbe.World.cells.remove(VillagerProbe.key(x, y + 1, z)); }

  static ahb world;
  static wc newCollection(long seed) throws Exception {
    VillagerProbe.reset(); W.roofs.clear(); W.events.clear(); W.day = true; W.rain = false;
    MobMoveProbe.set(world, "s", new Random(seed));
    wc c = new wc(world);
    MobMoveProbe.set(world, "A", c);
    return c;
  }

  static String villages(wc c) throws Exception {
    StringBuilder s = new StringBuilder("[");
    List l = c.b();
    for (int i = 0; i < l.size(); i++) {
      vz v = (vz) l.get(i);
      r ce = (r) get(v, "d");
      s.append(i > 0 ? "," : "").append("[").append(ce.a).append(",").append(ce.b).append(",").append(ce.c).append(",").append(gi(v, "e")).append(",")
        .append(((List) get(v, "b")).size()).append(",").append(gi(v, "h")).append(",").append(gi(v, "l")).append("]");
    }
    return s.append("]").toString();
  }

  static String doors(wc c) throws Exception {
    StringBuilder s = new StringBuilder("[");
    boolean first = true;
    for (Object o : c.b()) for (Object d : (List) get(o, "b")) {
      vy v = (vy) d;
      s.append(first ? "" : ",").append("[").append(gi(v, "a")).append(",").append(gi(v, "b")).append(",").append(gi(v, "c")).append(",").append(gi(v, "d")).append(",")
        .append(gi(v, "e")).append(",").append(gi(v, "f")).append(",").append(MobMoveProbe.b(v, "g")).append(",").append(gi(v, "h")).append("]");
      first = false;
    }
    return s.append("]").toString();
  }

  static String q(String s) { return "\"" + s + "\""; }

  // Scripted scenario. Ops (tick-ordered, applied before the tick runs): reg x y z; door x y z meta; rmdoor x y z;
  // roof x0 z0 x1 z1; vill x y z (a villager entity); rep name delta. `every n x y z` re-registers each n ticks.
  static void scenario(String name, long seed, int ticks, String[] script, String[] every) throws Exception {
    wc c = newCollection(seed);
    StringBuilder changes = new StringBuilder(), snaps = new StringBuilder(), reps = new StringBuilder();
    String last = null;
    int vi = 0;
    for (int t = 0; t <= ticks; t++) {
      for (String op : script) {
        String[] p = op.split(" ");
        if (Integer.parseInt(p[0]) != t) continue;
        switch (p[1]) {
          case "reg": c.a(Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4])); break;
          case "door": door(Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4]), Integer.parseInt(p[5])); break;
          case "rmdoor": rmdoor(Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4])); break;
          case "roof": W.roofs.add(new int[] {Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4]), Integer.parseInt(p[5])}); break;
          case "vill": { yv v = VillagerProbe.villager((W) world, 0, Double.parseDouble(p[2]), Double.parseDouble(p[4]), 100 + vi++); MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(v, Double.parseDouble(p[2]), Double.parseDouble(p[3]), Double.parseDouble(p[4])); VillagerProbe.World.entities.add(v); break; }
          case "rep": { vz v = (vz) c.b().get(0); reps.append(reps.length() > 0 ? "," : "").append("[").append(t).append(",").append(v.a(p[2], Integer.parseInt(p[3]))).append("]"); break; }
        }
      }
      for (String ev : every) {
        String[] p = ev.split(" ");
        if (t % Integer.parseInt(p[0]) == 0) c.a(Integer.parseInt(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3]));
      }
      c.a();
      String cur = villages(c);
      if (!cur.equals(last)) { changes.append(changes.length() > 0 ? "," : "").append("[").append(t).append(",").append(cur).append("]"); last = cur; }
      if (t % 200 == 0) snaps.append(snaps.length() > 0 ? "," : "").append("[").append(t).append(",").append(doors(c)).append("]");
    }
    StringBuilder sc = new StringBuilder();
    for (String s : script) sc.append(sc.length() > 0 ? "," : "").append(q(s));
    StringBuilder ev = new StringBuilder();
    for (String s : every) ev.append(ev.length() > 0 ? "," : "").append(q(s));
    System.out.println("{\"case\":\"scenario\",\"name\":" + q(name) + ",\"seed\":" + seed + ",\"ticks\":" + ticks + ",\"script\":[" + sc + "],\"every\":[" + ev + "],\"changes\":[" + changes + "],\"snaps\":[" + snaps + "],\"reps\":[" + reps + "]}");
  }

  static String[] concat(String[] a, String... b) { String[] o = new String[a.length + b.length]; System.arraycopy(a, 0, o, 0, a.length); System.arraycopy(b, 0, o, a.length, b.length); return o; }

  static String[] grid(int count, int meta) {
    List<String> l = new ArrayList<>();
    for (int i = 0; i < count; i++) l.add("0 door " + (50 + (i % 5)) + " 0 " + (50 + (i / 5) * 3) + " " + meta);
    return l.toArray(new String[0]);
  }

  static yv vill(double x, double z, long seed, int age) throws Exception {
    yv v = VillagerProbe.villager((W) world, 0, x, z, seed);
    v.c(age);
    VillagerProbe.World.entities.add(v);
    return v;
  }

  // Builds a village of `n` doors at (50.., 0, 50..) with pop villagers (registered each tick), then ticks `ticks`.
  static wc built(long seed, int n, int ticks) throws Exception {
    wc c = newCollection(seed);
    for (String s : grid(n, 0)) { String[] p = s.split(" "); door(Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4]), Integer.parseInt(p[5])); }
    W.roofs.add(new int[] {40, 0, 49, 100});
    for (int t = 0; t < ticks; t++) { if (t % 60 == 0) c.a(52, 0, 52); c.a(); }
    return c;
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    W w = (W) u.allocateInstance(W.class);
    world = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    MobMoveProbe.set(info, "x", new agy());
    MobMoveProbe.set(w, "x", info);

    // door layouts: indoor/outdoor sides along both axes, a 5-cell scan, merge, a second village 70 blocks away, removal
    String[] base = {"0 roof 40 40 47 70", "0 roof 55 30 70 44", "0 door 50 0 50 0", "0 door 44 0 55 0", "0 door 60 0 45 1", "0 door 46 0 52 3", "0 door 60 0 50 2"};
    scenario("two-doors", 7, 1500, concat(base, "0 reg 46 0 52", "700 rmdoor 44 0 55"), new String[] {"60 46 0 52"});
    scenario("far-village", 8, 700, concat(base, "0 roof 100 100 119 140", "0 door 120 0 120 0", "0 reg 46 0 52", "0 reg 121 0 121", "0 vill 46 0 52", "0 vill 121 0 120"), new String[] {"90 46 0 52", "90 121 0 121"});
    scenario("overflow", 9, 200, new String[] {"0 roof 0 0 9 100", "0 door 10 0 10 0", "0 door 20 0 10 0", "5 reg 10 0 10", "5 reg 10 0 10", "5 reg 10 0 11", "9 reg 20 0 10", "12 rep Steve -5", "13 rep Steve -12", "14 rep Steve 20", "15 rep Alex 3"}, new String[] {});
    // a village that keeps its doors can age out: no re-registration
    scenario("decay", 10, 1500, new String[] {"0 roof 40 40 47 70", "0 door 50 0 50 0", "0 reg 46 0 52"}, new String[] {});

    // golem spawn: 21 doors, 10 villagers
    for (long seed = 1; seed <= 3; seed++) {
      wc c = built(seed + 40, 21, 0);
      for (int i = 0; i < 10; i++) vill(52.5, 52.5, 200 + i, 0);
      int tick = -1; double[] pos = null; int golemsAfter = 0;
      for (int t = 0; t < 40000; t++) {
        if (t % 60 == 0) c.a(52, 0, 52);
        c.a();
        if (!VillagerProbe.World.spawned.isEmpty()) {
          sa g = (sa) VillagerProbe.World.spawned.get(0);
          tick = t; pos = new double[] {MobMoveProbe.d(g, "s"), MobMoveProbe.d(g, "t"), MobMoveProbe.d(g, "u")};
          golemsAfter = gi(c.b().get(0), "l");
          break;
        }
      }
      System.out.println("{\"case\":\"golemSpawn\",\"seed\":" + (seed + 40) + ",\"doors\":21,\"villagers\":10,\"tick\":" + tick + ",\"pos\":" + (pos == null ? "null" : "[" + num(pos[0]) + "," + num(pos[1]) + "," + num(pos[2]) + "]") + ",\"golems\":" + golemsAfter + ",\"village\":" + villages(c) + "}");
    }

    // reputation + mating season on a plain Village
    {
      wc c = built(3, 3, 5);
      vz v = (vz) c.b().get(0);
      StringBuilder s = new StringBuilder();
      int[] deltas = {-1, -1, -5, -5, -5, -30, 3, 40, 5};
      for (int d : deltas) s.append(s.length() > 0 ? "," : "").append("[").append(d).append(",").append(v.a("P", d)).append(",").append(v.d("P")).append("]");
      v.b(5);
      System.out.println("{\"case\":\"reputation\",\"steps\":[" + s + "],\"afterAll\":" + v.a("P") + ",\"unknown\":" + v.a("Q") + "}");
      StringBuilder m = new StringBuilder();
      vz v2 = (vz) built(4, 3, 5).b().get(0);
      m.append("[").append(v2.i()).append(",");
      v2.a(100); v2.h(); m.append(v2.i()).append(","); v2.a(3699); m.append(v2.i()).append(","); v2.a(3700); m.append(v2.i()).append("]");
      System.out.println("{\"case\":\"matingSeason\",\"steps\":" + m + "}");
    }

    // door math over a village: nearest door, unrestricted nearest, restriction counters, isInside
    {
      wc c = built(5, 3, 5);
      vz v = (vz) c.b().get(0);
      StringBuilder rows = new StringBuilder();
      int[][] pts = {{50, 0, 50}, {48, 0, 49}, {53, 0, 50}, {52, 0, 56}, {80, 0, 80}, {50, 0, 64}};
      for (int round = 0; round < 3; round++) {
        for (int[] p : pts) {
          vy n = v.b(p[0], p[1], p[2]), un = v.c(p[0], p[1], p[2]);
          rows.append(rows.length() > 0 ? "," : "").append("[").append(round).append(",").append(p[0]).append(",").append(p[1]).append(",").append(p[2]).append(",")
            .append(n == null ? "null" : "[" + n.a + "," + n.c + "," + n.b(p[0], p[1], p[2]) + "," + n.c(p[0], p[1], p[2]) + "," + n.a(p[0], p[2]) + "]").append(",")
            .append(un == null ? "null" : "[" + un.a + "," + un.c + "," + un.f() + "]").append("]");
          if (un != null) un.e();
        }
      }
      System.out.println("{\"case\":\"doorMath\",\"rows\":[" + rows + "],\"found\":" + (c.a(52, 0, 52, 0) != null) + ",\"nearest32\":" + (c.a(52 + 40, 0, 52, 32) != null) + ",\"nearest33\":" + (c.a(52 + 80, 0, 52, 32) != null) + "}");
    }

    // golem facts
    {
      newCollection(1);
      wt g = new wt(world);
      StringBuilder tl = new StringBuilder();
      for (String which : new String[] {"c", "d"}) {
        Field f = sw.class.getDeclaredField(which); f.setAccessible(true);
        Field b = uj.class.getDeclaredField("b"); b.setAccessible(true);
        for (Object o : (List) b.get(f.get(g))) { uk k = (uk) o; tl.append(tl.length() > 0 ? "," : "").append("{\"list\":").append(q(which.equals("c") ? "tasks" : "targets")).append(",\"priority\":").append(k.b).append(",\"class\":").append(q(k.a.getClass().getName())).append(",\"mutex\":").append(VillagerProbe.mutex(k.a)).append(",\"params\":").append(VillagerProbe.params(k.a)).append("}"); }
      }
      Method snd = null;
      System.out.println("{\"case\":\"golemFacts\",\"width\":" + num(MobMoveProbe.fl(g, "M")) + ",\"height\":" + num(MobMoveProbe.fl(g, "N")) + ",\"maxHealth\":" + num(((ti) g.a(yj.a)).e())
        + ",\"speed\":" + num(((ti) g.a(yj.d)).e()) + ",\"followRange\":" + num(((ti) g.a(yj.b)).e()) + ",\"knockbackResistance\":" + num(((ti) g.a(yj.c)).e())
        + ",\"health\":" + num(g.aS()) + ",\"playerCreated\":" + g.cc() + ",\"aiEnabled\":" + MobMoveProbe.method(wt.class, "bk").invoke(g)
        + ",\"avoidsWater\":" + MobMoveProbe.b(g.m(), "m") + ",\"hit\":" + q((String) MobMoveProbe.method(wt.class, "aT").invoke(g)) + ",\"death\":" + q((String) MobMoveProbe.method(wt.class, "aU").invoke(g))
        + ",\"decreaseAir\":" + MobMoveProbe.method(wt.class, "j", int.class).invoke(g, 123) + ",\"canAttackPlayer\":" + g.a(yz.class) + ",\"tasks\":[" + tl + "]}");
      g.i(true);
      System.out.println("{\"case\":\"golemFlags\",\"playerCreated\":" + g.cc() + ",\"canAttackPlayer\":" + g.a(yz.class) + ",\"canAttackZombie\":" + g.a(yq.class) + "}");
    }

    // golem attack over seeds against a villager target at the golem's side
    {
      StringBuilder rows = new StringBuilder();
      for (long seed = 0; seed < 40; seed++) {
        newCollection(1);
        wt g = new wt(world);
        MobMoveProbe.set(g, "Z", new Random(seed));
        yv v = VillagerProbe.villager((W) world, 0, 64.5, 64.5, 1);
        MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(g, 63.5, 0.0, 64.5);
        double my0 = MobMoveProbe.d(v, "w"), mx0 = MobMoveProbe.d(v, "v");
        float h0 = v.aS();
        boolean hit = g.n(v);
        rows.append(rows.length() > 0 ? "," : "").append("[").append(seed).append(",").append(hit).append(",").append(num(h0 - v.aS())).append(",").append(num(MobMoveProbe.d(v, "w") - my0))
          .append(",").append(num(MobMoveProbe.d(v, "v") - mx0)).append(",").append(num(MobMoveProbe.d(v, "x"))).append(",").append(gi(g, "br")).append(",")
          .append(VillagerProbe.strings(VillagerProbe.World.sounds)).append(",").append(VillagerProbe.strings(W.events)).append("]");
        VillagerProbe.World.sounds.clear(); W.events.clear();
      }
      System.out.println("{\"case\":\"golemAttack\",\"rows\":[" + rows + "]}");
    }

    // golem drops, 300 seeds: [poppy count, iron count]
    {
      StringBuilder rows = new StringBuilder();
      Method drop = MobMoveProbe.method(wt.class, "b", boolean.class, int.class);
      for (long seed = 0; seed < 300; seed++) {
        newCollection(1);
        wt g = new wt(world);
        MobMoveProbe.set(g, "Z", new Random(seed));
        drop.invoke(g, true, seed % 4 == 3 ? 3 : 0);
        StringBuilder it = new StringBuilder();
        for (Object o : VillagerProbe.World.spawned) { add st = ((xk) o).f(); it.append(it.length() > 0 ? "," : "").append("[").append(adb.b(st.b())).append(",").append(st.b).append(",").append(st.k()).append("]"); }
        rows.append(rows.length() > 0 ? "," : "").append("[").append(it).append("]");
      }
      System.out.println("{\"case\":\"golemDrops\",\"rows\":[" + rows + "]}");
    }

    // IMob membership of every registered entity (EntityList name map), collideWithEntity retargeting over seeds,
    // the step sound hook and the onLivingUpdate timers/walking particles
    {
      Field mapF = sg.class.getDeclaredField("c"); mapF.setAccessible(true);
      Map<String, Class<?>> reg = (Map<String, Class<?>>) mapF.get(null);
      List<String> names = new ArrayList<>(reg.keySet()); java.util.Collections.sort(names);
      StringBuilder im = new StringBuilder();
      for (String n : names) im.append(im.length() > 0 ? "," : "").append("[").append(q(n)).append(",").append(yb.class.isAssignableFrom(reg.get(n))).append("]");
      System.out.println("{\"case\":\"imob\",\"rows\":[" + im + "]}");
      Method collide = MobMoveProbe.method(wt.class, "o", sa.class);
      StringBuilder rows = new StringBuilder();
      for (String kind : new String[] {"Zombie", "Creeper", "Skeleton", "Spider", "Slime", "Villager", "Pig", "Enderman"}) {
        for (long seed = 0; seed < 60; seed++) {
          newCollection(1);
          wt g = new wt(world);
          MobMoveProbe.set(g, "Z", new Random(seed));
          sa other = (sa) reg.get(kind).getConstructor(ahb.class).newInstance(world);
          collide.invoke(g, other);
          Random r = (Random) MobMoveProbe.field(g.getClass(), "Z").get(g);
          rows.append(rows.length() > 0 ? "," : "").append("[").append(q(kind)).append(",").append(seed).append(",").append(g.o() == other).append(",").append(r.nextInt(1000000)).append("]");
        }
      }
      System.out.println("{\"case\":\"golemCollide\",\"rows\":[" + rows + "]}");
      // func_145780_a: the step sound ignores the block
      newCollection(1);
      wt g = new wt(world);
      MobMoveProbe.method(wt.class, "a", int.class, int.class, int.class, aji.class).invoke(g, 0, -1, 0, ajn.b);
      System.out.println("{\"case\":\"golemStep\",\"sounds\":" + VillagerProbe.strings(VillagerProbe.World.sounds) + "}");
      VillagerProbe.World.sounds.clear();
      // onLivingUpdate: attackTimer and holdRoseTick count down after the attack/rose, walking particles from the entity Random
      StringBuilder tm = new StringBuilder();
      for (long seed = 0; seed < 12; seed++) {
        newCollection(1);
        W.particles.clear();
        wt h = new wt(world);
        MobMoveProbe.set(h, "Z", new LogRandom(seed));
        for (String n : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(h, n, 0f);
        MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(h, 64.5, 0.0, 64.5);
        h.a(true);
        yv v = VillagerProbe.villager((W) world, 0, 65.5, 64.5, 1);
        h.n(v);
        StringBuilder row = new StringBuilder();
        for (int t = 0; t < 14; t++) {
          if (seed % 2 == 0 || t == 0) { MobMoveProbe.set(h, "v", 0.1); MobMoveProbe.set(h, "x", 0.1); }
          LogRandom.log.clear();
          h.e();
          int last = -1;
          for (int i = 0; i < LogRandom.log.size(); i++) if (LogRandom.log.get(i).startsWith("i5:")) last = i;
          row.append(row.length() > 0 ? "," : "").append("[").append(gi(h, "br")).append(",").append(gi(h, "bs")).append(",").append(num(MobMoveProbe.d(h, "v"))).append(",").append(num(MobMoveProbe.d(h, "x"))).append(",")
            .append(VillagerProbe.strings(last < 0 ? new ArrayList<String>() : LogRandom.log.subList(last, LogRandom.log.size()))).append("]");
        }
        tm.append(tm.length() > 0 ? "," : "").append("{\"seed\":").append(seed).append(",\"timers\":[").append(row).append("],\"particles\":").append(VillagerProbe.strings(W.particles)).append(",\"next\":").append(((Random) MobMoveProbe.field(h.getClass(), "Z").get(h)).nextInt(1000000)).append("}");
        VillagerProbe.World.sounds.clear(); W.events.clear();
      }
      System.out.println("{\"case\":\"golemTimers\",\"rows\":[" + tm + "]}");
    }

    // model: ModelIronGolem (bij) boxes
    {
      System.out.print("{\"case\":\"model\",\"parts\":");
      ModelProbe.dump("irongolem", new bij());
    }

    // AI gates on a built village: 12 doors, so int(12 * 0.35) = 4 villagers allowed
    Constructor<?> upC = up.class.getConstructor(yv.class);
    for (int variant = 0; variant < 5; variant++) {
      int doorCount = variant == 3 ? 5 : 12;
      wc c = built(60 + variant, doorCount, 5);
      vz v = (vz) c.b().get(0);
      if (variant == 2) { v.a(1000); v.h(); v.a(1001); } // mating season ended 1 tick ago
      yv a = vill(52.5, 52.5, 300, variant == 1 ? -24000 : 0);
      yv b = vill(53.5, 52.5, 301, 0);
      if (variant == 4) for (int i = 0; i < 5; i++) vill(52.5, 53.5, 310 + i, 0); // pop >= int(12 * 0.35)
      // refresh the village's villager count (tick % 20 == 0)
      for (int t = 0; t < 40; t++) { if (t % 10 == 0) c.a(52, 0, 52); c.a(); }
      int pop = gi(c.b().get(0), "h");
      up task = new up(a);
      int firstTrue = -1;
      for (int t = 0; t < 30000 && firstTrue < 0; t++) if (task.a()) firstTrue = t;
      StringBuilder out = new StringBuilder();
      if (firstTrue >= 0) {
        Field br = yv.class.getDeclaredField("br"); br.setAccessible(true);
        br.setBoolean(b, true);
        VillagerProbe.World.spawned.clear(); W.events.clear();
        task.c();
        int birth = -1;
        List<Integer> hearts = new ArrayList<>();
        for (int t = 0; t < 400; t++) {
          boolean cont = task.b();
          if (!cont) break;
          int before = W.events.size();
          task.e();
          if (W.events.size() > before && W.events.get(W.events.size() - 1).endsWith("|12")) hearts.add(t);
          if (!VillagerProbe.World.spawned.isEmpty() && birth < 0) birth = t;
        }
        yv child = VillagerProbe.World.spawned.isEmpty() ? null : (yv) VillagerProbe.World.spawned.get(0);
        out.append(",\"birth\":").append(birth).append(",\"hearts\":").append(hearts).append(",\"spawned\":").append(VillagerProbe.World.spawned.size());
        if (child != null) out.append(",\"child\":{\"profession\":").append(child.bZ()).append(",\"age\":").append(child.d()).append(",\"pos\":[").append(num(MobMoveProbe.d(child, "s"))).append(",").append(num(MobMoveProbe.d(child, "t"))).append(",").append(num(MobMoveProbe.d(child, "u"))).append("]}");
        out.append(",\"parentAges\":[").append(a.d()).append(",").append(b.d()).append("],\"matingAfter\":[").append(MobMoveProbe.b(a, "br")).append(",").append(MobMoveProbe.b(b, "br")).append("]");
      }
      System.out.println("{\"case\":\"mating\",\"variant\":" + variant + ",\"doors\":" + doorCount + ",\"pop\":" + pop + ",\"seed\":" + (60 + variant) + ",\"firstTrue\":" + firstTrue + out + "}");
    }

    // gates: [task, config, seed, return, next int draw]
    {
      StringBuilder rows = new StringBuilder();
      for (int day = 0; day < 2; day++) for (int rain = 0; rain < 2; rain++) for (int kind = 0; kind < 6; kind++) for (long seed = 0; seed < 60; seed++) {
        wc c = built(70, 12, 5);
        W.day = day == 1; W.rain = rain == 1;
        yv a = vill(kind == 5 ? 52.5 : 51.5, 52.5, seed, kind == 3 || kind == 4 ? -24000 : 0);
        yv other = vill(54.5, 52.5, 900, kind == 4 ? -24000 : 0);
        wt g = new wt(world);
        MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(g, 53.5, 0.0, 53.5);
        VillagerProbe.World.entities.add(g);
        if (kind == 2 || kind == 3) g.a(true);
        ui task;
        switch (kind) {
          case 0: task = new ur(a); break;
          case 1: task = new ve(a); break;
          case 2: task = new ux(g); break;
          case 3: task = new vj(a); break;
          case 4: task = new va(a, 0.32); break;
          default: task = new ve(a); break;
        }
        Object useRand = kind == 2 ? g : a;
        MobMoveProbe.set(useRand, "Z", new Random(seed));
        boolean ret = task.a();
        int next = ((Random) get(useRand, "Z")).nextInt(1000000);
        rows.append(rows.length() > 0 ? "," : "").append("[").append(kind).append(",").append(day).append(",").append(rain).append(",").append(seed).append(",").append(ret).append(",").append(next).append("]");
        if (rows.length() > 4_000_000) break;
      }
      System.out.println("{\"case\":\"gates\",\"rows\":[" + rows + "]}");
    }
  }
}
