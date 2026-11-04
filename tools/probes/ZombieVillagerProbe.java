import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Runs the unchanged EntityZombie (yq) against villagers on the VillagerProbe / VillageLiveProbe flat world:
//   facts      task and target lists with priorities, classes and constructor numbers; attributes
//   target     the villager NearestAttackableTarget (vo) over positions, ranges, health and a wall
//   kill       onKillEntity (yq.a(sv)) per difficulty and seed, adult and child villagers
//   interact   yq.a(yz): golden apple on a zombie villager with Weakness (timer, effects, stack, creative)
//   boost      getConversionTimeBoost (ce) over block configurations and seeds
//   convert    convertToVillager (cd), per seed
//   villages   VillageCollection NBT (villages.dat) written by the native class, with an in-JVM round trip
//   entityNbt  EntityZombie / EntityIronGolem NBT written by the native classes
// One JSON object per line.
public class ZombieVillagerProbe {
  public static class Player extends yz {
    Player() { super(null, null); }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
  }

  // World.removeEntity needs the chunk provider; here it only marks the entity dead.
  public static class Z extends VillageLiveProbe.W {
    public void e(sa entity) { entity.B(); }
    public void b(sa entity) { entity.B(); }
    static apx chunk;
    public apx d(int x, int z) { return chunk; }
    public int k(int x, int y, int z) { return 0; }
  }

  static VillageLiveProbe.W world;
  static sun.misc.Unsafe u;

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static String q(String s) { return "\"" + s + "\""; }
  static Object get(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static void difficulty(int id) throws Exception { MobMoveProbe.field(ahb.class, "r").set(world, rd.values()[id]); }
  static void move(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static void reset() { VillagerProbe.reset(); VillageLiveProbe.W.events.clear(); VillageLiveProbe.W.roofs.clear(); }
  static int nextInt(Object e) throws Exception { return ((Random) get(e, "Z")).nextInt(1000000); }

  static yq zombie(long seed, double x, double y, double z) throws Exception {
    yq e = new yq(world);
    MobMoveProbe.set(e, "Z", new Random(seed));
    for (String n : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(e, n, 0f);
    move(e, x, y, z);
    return e;
  }

  static Player player(long seed) throws Exception {
    Player p = (Player) u.allocateInstance(Player.class);
    MobMoveProbe.set(p, "o", world); MobMoveProbe.set(p, "Z", new Random(seed)); MobMoveProbe.set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    te watcher = new te(p); MobMoveProbe.set(p, "af", watcher);
    watcher.a(0, Byte.valueOf((byte) 0)); watcher.a(1, Short.valueOf((short) 300));
    MobMoveProbe.method(yz.class, "c").invoke(p);
    MobMoveProbe.field(sv.class, "f").set(p, new java.util.HashMap());
    MobMoveProbe.set(p, "bE", new yw());
    MobMoveProbe.method(yz.class, "aD").invoke(p);
    p.g(20.0f);
    MobMoveProbe.set(p, "bm", new yx(p));
    return p;
  }

  static List<uk> entries(sw e, String list) throws Exception {
    Field c = sw.class.getDeclaredField(list); c.setAccessible(true);
    Field b = uj.class.getDeclaredField("b"); b.setAccessible(true);
    return (List<uk>) b.get(c.get(e));
  }

  static String tasks(sw e) throws Exception {
    StringBuilder tl = new StringBuilder();
    for (String which : new String[] {"c", "d"})
      for (uk k : entries(e, which)) {
        String target = "null";
        for (String f : new String[] {"g", "a"}) {
          try { Field fl = k.a.getClass().getDeclaredField(f); fl.setAccessible(true); if (fl.getType() == Class.class) target = q(((Class) fl.get(k.a)).getName()); } catch (NoSuchFieldException x) {}
        }
        tl.append(tl.length() > 0 ? "," : "").append("{\"list\":").append(q(which.equals("c") ? "tasks" : "targets")).append(",\"priority\":").append(k.b)
          .append(",\"class\":").append(q(k.a.getClass().getName())).append(",\"mutex\":").append(VillagerProbe.mutex(k.a)).append(",\"params\":").append(VillagerProbe.params(k.a))
          .append(",\"filter\":").append(target).append("}");
      }
    return tl.toString();
  }

  static String hex(dh tag) throws Exception {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    du.a(tag, (java.io.DataOutput) new DataOutputStream(bytes));
    StringBuilder s = new StringBuilder();
    for (byte b : bytes.toByteArray()) s.append(String.format("%02x", b & 0xff));
    return s.toString();
  }

  static String events() { return VillagerProbe.strings(VillageLiveProbe.W.events); }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    u = MobMoveProbe.unsafe();
    VillageLiveProbe.W w = (VillageLiveProbe.W) u.allocateInstance(Z.class);
    world = w;
    VillageLiveProbe.world = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.set(info, "x", new agy());
    MobMoveProbe.set(w, "x", info);
    java.util.Calendar date = java.util.Calendar.getInstance(); date.clear(); date.set(2014, java.util.Calendar.JUNE, 1);
    MobMoveProbe.set(w, "J", date);
    Z.chunk = (apx) u.allocateInstance(apx.class);
    MobMoveProbe.field(apx.class, "s").setLong(Z.chunk, 0);
    MobMoveProbe.set(w, "A", new wc(w));
    difficulty(2);

    // facts
    {
      reset();
      yq z = zombie(1, 64.5, 0, 64.5);
      System.out.println("{\"case\":\"facts\",\"width\":" + num(MobMoveProbe.fl(z, "M")) + ",\"height\":" + num(MobMoveProbe.fl(z, "N")) + ",\"maxHealth\":" + num(((ti) z.a(yj.a)).e())
        + ",\"followRange\":" + num(((ti) z.a(yj.b)).e()) + ",\"knockbackResistance\":" + num(((ti) z.a(yj.c)).e()) + ",\"speed\":" + num(((ti) z.a(yj.d)).e())
        + ",\"attackDamage\":" + num(((ti) z.a(yj.e)).e()) + ",\"health\":" + num(z.aS()) + ",\"child\":" + z.f() + ",\"villager\":" + z.cb() + ",\"breakDoors\":" + z.bZ()
        + ",\"converting\":" + z.cc() + ",\"tasks\":[" + tasks(z) + "]}");
      z.a(true);
      System.out.println("{\"case\":\"breakDoors\",\"tasks\":[" + tasks(z) + "]}");
    }

    // target: the villager NearestAttackableTarget at positions. Entry: [label, [[x, y, z, health, age]...]], chosen index or -1
    {
      Object[][] scenes = {
        {"single-5", new double[][] {{69.5, 0, 64.5, 20, 0}}},
        {"single-20", new double[][] {{84.5, 0, 64.5, 20, 0}}},
        {"single-39", new double[][] {{103.5, 0, 64.5, 20, 0}}},
        {"single-41", new double[][] {{105.5, 0, 64.5, 20, 0}}},
        {"above-3", new double[][] {{66.5, 3, 64.5, 20, 0}}},
        {"above-5", new double[][] {{66.5, 5, 64.5, 20, 0}}},
        {"below-3", new double[][] {{66.5, -3, 64.5, 20, 0}}},
        {"two-far-first", new double[][] {{80.5, 0, 64.5, 20, 0}, {70.5, 0, 64.5, 20, 0}}},
        {"two-near-first", new double[][] {{66.5, 0, 64.5, 20, 0}, {74.5, 0, 64.5, 20, 0}}},
        {"dead-near", new double[][] {{66.5, 0, 64.5, 0, 0}, {74.5, 0, 64.5, 20, 0}}},
        {"child", new double[][] {{66.5, 0, 64.5, 20, -24000}}},
        {"wall", new double[][] {{68.5, 0, 64.5, 20, 0}}},
        {"diagonal-box-corner", new double[][] {{103.5, 0, 103.5, 20, 0}}},
      };
      for (Object[] scene : scenes) {
        reset();
        if (scene[0].equals("wall")) for (int y = 0; y <= 3; y++) for (int zz = 60; zz <= 68; zz++) VillagerProbe.World.cells.put(VillagerProbe.key(66, y, zz), new int[] {1, 0});
        yq z = zombie(3, 64.5, 0, 64.5);
        VillagerProbe.World.entities.add(z);
        List<yv> vs = new ArrayList<>();
        for (double[] p : (double[][]) scene[1]) {
          yv v = VillagerProbe.villager(w, 0, p[0], p[2], 9 + vs.size());
          move(v, p[0], p[1], p[2]);
          v.g((float) p[3]);
          v.c((int) p[4]);
          VillagerProbe.World.entities.add(v);
          vs.add(v);
        }
        vo task = null;
        for (uk k : entries(z, "d")) if (k.a instanceof vo && get(k.a, "a") == yv.class) task = (vo) k.a;
        boolean run = task.a();
        if (run) task.c();
        sv chosen = z.o();
        int index = -1;
        for (int i = 0; i < vs.size(); i++) if (vs.get(i) == chosen) index = i;
        System.out.println("{\"case\":\"target\",\"label\":" + q((String) scene[0]) + ",\"villagers\":" + java.util.Arrays.deepToString((double[][]) scene[1]).replace("], [", "],[") + ",\"run\":" + run + ",\"chosen\":" + index + ",\"next\":" + nextInt(z) + "}");
      }
    }

    // kill: onKillEntity per difficulty and seed; child 0 = adult villager, 1 = child villager, 2 = a zombie as the victim
    {
      StringBuilder rows = new StringBuilder();
      for (int d = 0; d < 4; d++) for (int child = 0; child < 3; child++) for (long index = 0; index < 80; index++) {
        long seed = index * 2654435761L + 7; // consecutive small Random seeds share their first nextBoolean
        reset();
        difficulty(d);
        yq z = zombie(seed, 64.5, 0, 64.5);
        sv victim;
        if (child == 2) victim = zombie(seed + 1000, 65.5, 0, 64.5);
        else { yv v = VillagerProbe.villager(w, 0, 65.5, 64.5, seed + 1000); v.c(child == 1 ? -24000 : 0); victim = v; }
        VillagerProbe.World.entities.add(z); VillagerProbe.World.entities.add(victim);
        z.a(victim);
        // a baby zombie can also spawn a chicken jockey (wg): count only the zombies
        yq made = null;
        int zombies = 0;
        for (Object o : VillagerProbe.World.spawned) if (o instanceof yq) { if (made == null) made = (yq) o; zombies++; }
        rows.append(rows.length() > 0 ? "," : "").append("[").append(d).append(",").append(child).append(",").append(seed).append(",").append(zombies).append(",")
          .append(made != null && made.cb()).append(",").append(made != null && made.f()).append(",").append(MobMoveProbe.b(victim, "K")).append(",").append(VillagerProbe.strings(VillagerProbe.World.aux)).append(",").append(nextInt(z)).append("]");
      }
      difficulty(2);
      System.out.println("{\"case\":\"kill\",\"rows\":[" + rows + "]}");
    }

    // interact: golden apple (ade.ao) on a zombie. variant: 0 weakened villager, 1 creative player, 2 no weakness, 3 damage 1,
    // 4 not a villager, 5 second apple while converting, 6 other item (stick id 280), 7 empty hand
    {
      StringBuilder rows = new StringBuilder();
      for (int variant = 0; variant < 8; variant++) for (long seed = 0; seed < (variant == 0 ? 120 : 3); seed++) {
        reset();
        yq z = zombie(seed, 64.5, 0, 64.5);
        VillagerProbe.World.entities.add(z);
        if (variant != 4) z.j(true);
        if (variant != 2) z.c(new rw(rv.t.H, 600, 0));
        Player p = player(seed + 5);
        if (variant == 1) ((yw) get(p, "bE")).d = true;
        if (variant != 7) p.bm.a(0, new add(variant == 6 ? adb.d(280) : ade.ao, 3, variant == 3 ? 1 : 0));
        boolean ret = z.a((yz) p);
        VillageLiveProbe.W.events.size();
        boolean second = false;
        int sizeAfterFirst = p.bm.h() == null ? -1 : p.bm.h().b;
        if (variant == 5) second = z.a((yz) p);
        rw strength = z.b(rv.g);
        rows.append(rows.length() > 0 ? "," : "").append("[").append(variant).append(",").append(seed).append(",").append(ret).append(",").append(sizeAfterFirst).append(",").append(second).append(",")
          .append(MobMoveProbe.field(yq.class, "bt").getInt(z)).append(",").append(z.cc()).append(",").append(z.a(rv.t)).append(",").append(strength == null ? "null" : "[" + strength.b() + "," + strength.c() + "]").append(",")
          .append(events()).append(",").append(nextInt(z)).append("]");
      }
      System.out.println("{\"case\":\"interact\",\"rows\":[" + rows + "]}");
    }

    // boost: getConversionTimeBoost. The zombie stands at (10.5, 5.0, 10.5): block (10, 5, 10). Seeds are the first 40 whose first nextFloat < 0.01
    // (the scan) and 10 that do not. Rows: [config, seed, boost, next int]
    {
      Method ce = MobMoveProbe.method(yq.class, "ce");
      List<Long> seeds = new ArrayList<>();
      int found = 0, idle = 0;
      for (long s = 0; found < 40 || idle < 10; s++) {
        boolean scan = new Random(s).nextFloat() < 0.01f;
        if (scan && found < 40) { seeds.add(s); found++; } else if (!scan && idle < 10) { seeds.add(s); idle++; }
      }
      String[] names = {"empty", "bars-plane", "bars-one", "bars-low-edge", "bars-high-edge", "bars-vertical-edge", "beds", "bars-many", "mixed"};
      StringBuilder rows = new StringBuilder();
      for (int cfg = 0; cfg < names.length; cfg++) {
        for (long seed : seeds) {
          reset();
          int bars = 101, bed = 26;
          switch (cfg) {
            case 1: for (int x = 8; x <= 12; x++) for (int zz = 8; zz <= 12; zz++) VillagerProbe.World.cells.put(VillagerProbe.key(x, 5, zz), new int[] {bars, 0}); break;
            case 2: VillagerProbe.World.cells.put(VillagerProbe.key(10, 5, 10), new int[] {bars, 0}); break;
            case 3: VillagerProbe.World.cells.put(VillagerProbe.key(6, 5, 10), new int[] {bars, 0}); break;
            case 4: VillagerProbe.World.cells.put(VillagerProbe.key(14, 5, 10), new int[] {bars, 0}); break;
            case 5: VillagerProbe.World.cells.put(VillagerProbe.key(10, 9, 10), new int[] {bars, 0}); VillagerProbe.World.cells.put(VillagerProbe.key(10, 1, 10), new int[] {bars, 0}); break;
            case 6: for (int x = 9; x <= 11; x++) VillagerProbe.World.cells.put(VillagerProbe.key(x, 5, 10), new int[] {bed, 0}); break;
            case 7: for (int x = 6; x <= 13; x++) for (int zz = 6; zz <= 13; zz++) VillagerProbe.World.cells.put(VillagerProbe.key(x, 5, zz), new int[] {bars, 0}); break;
            case 8: VillagerProbe.World.cells.put(VillagerProbe.key(9, 4, 9), new int[] {bars, 0}); VillagerProbe.World.cells.put(VillagerProbe.key(11, 6, 11), new int[] {bed, 0}); VillagerProbe.World.cells.put(VillagerProbe.key(10, 5, 10), new int[] {1, 0}); break;
            default: break;
          }
          yq z = zombie(seed, 10.5, 5.0, 10.5);
          int boost = (Integer) ce.invoke(z);
          rows.append(rows.length() > 0 ? "," : "").append("[").append(cfg).append(",").append(seed).append(",").append(boost).append(",").append(nextInt(z)).append("]");
        }
      }
      StringBuilder n = new StringBuilder();
      for (String s : names) n.append(n.length() > 0 ? "," : "").append(q(s));
      System.out.println("{\"case\":\"boost\",\"configs\":[" + n + "],\"rows\":[" + rows + "]}");
    }

    // convert: cd(). Rows: [seed, child, profession, age, followRange, nausea [duration, amplifier] or null, defaultReputation flag, spawned count,
    // zombie dead, aux, nextInt of the zombie, world Random after (next int)]
    {
      StringBuilder rows = new StringBuilder();
      Method cd = MobMoveProbe.method(yq.class, "cd");
      Field flag = MobMoveProbe.field(yv.class, "bz");
      for (int child = 0; child < 2; child++) for (long seed = 0; seed < 150; seed++) {
        reset();
        MobMoveProbe.set(w, "s", new Random(seed));
        yq z = zombie(seed, 64.5, 0, 64.5);
        z.j(true);
        z.i(child == 1);
        VillagerProbe.World.entities.add(z);
        cd.invoke(z);
        yv v = VillagerProbe.World.spawned.isEmpty() ? null : (yv) VillagerProbe.World.spawned.get(0);
        rw nausea = v == null ? null : v.b(rv.k);
        rows.append(rows.length() > 0 ? "," : "").append("[").append(seed).append(",").append(child).append(",").append(v == null ? -1 : v.bZ()).append(",").append(v == null ? 0 : v.d()).append(",")
          .append(v == null ? "0" : num(((ti) v.a(yj.b)).e())).append(",").append(nausea == null ? "null" : "[" + nausea.b() + "," + nausea.c() + "]").append(",").append(v != null && flag.getBoolean(v)).append(",")
          .append(VillagerProbe.World.spawned.size()).append(",").append(MobMoveProbe.b(z, "K")).append(",").append(VillagerProbe.strings(VillagerProbe.World.aux)).append(",").append(nextInt(z)).append(",")
          .append(((Random) get(w, "s")).nextInt(1000000)).append("]");
      }
      MobMoveProbe.set(w, "s", new Random(2));
      System.out.println("{\"case\":\"convert\",\"rows\":[" + rows + "]}");
    }

    // villages.dat: a native VillageCollection with a village, reputation and a mating season, written to NBT, read back, written again
    {
      wc c = VillageLiveProbe.built(3, 3, 5);
      for (int i = 0; i < 2; i++) VillageLiveProbe.vill(52.5 + i, 52.5, 400 + i, 0);
      for (int t = 0; t < 70; t++) { if (t % 60 == 0) c.a(52, 0, 52); c.a(); }
      vz v = (vz) c.b().get(0);
      v.a("Steve", -4); v.a("Alex", 7);
      dh tag = new dh();
      c.b(tag);
      String first = hex(tag);
      wc back = new wc(w);
      back.a(tag);
      dh again = new dh();
      back.b(again);
      System.out.println("{\"case\":\"villages\",\"digest\":" + VillageLiveProbe.villages(c) + ",\"doors\":" + VillageLiveProbe.doors(c) + ",\"nbt\":\"" + first + "\",\"reread\":\"" + hex(again) + "\",\"rereadDigest\":" + VillageLiveProbe.villages(back)
        + ",\"steve\":" + v.a("Steve") + ",\"alex\":" + v.a("Alex") + "}");
    }

    // entityNbt: the native NBT of a zombie villager (child, converting), a plain zombie and a player-built golem
    {
      reset();
      for (int variant = 0; variant < 4; variant++) {
        yq z = zombie(variant, 64.5, 0, 64.5);
        if (variant >= 1) z.j(true);
        if (variant == 2) z.i(true);
        if (variant == 3) MobMoveProbe.method(yq.class, "a", int.class).invoke(z, 3777);
        dh tag = new dh();
        z.c(tag);
        System.out.println("{\"case\":\"entityNbt\",\"kind\":\"zombie\",\"variant\":" + variant + ",\"nbt\":\"" + hex(tag) + "\"}");
      }
      for (int made = 0; made < 2; made++) {
        wt g = new wt(w);
        g.i(made == 1);
        dh tag = new dh();
        g.c(tag);
        System.out.println("{\"case\":\"entityNbt\",\"kind\":\"golem\",\"variant\":" + made + ",\"nbt\":\"" + hex(tag) + "\"}");
      }
    }
  }
}
