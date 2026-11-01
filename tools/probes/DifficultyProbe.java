import java.lang.reflect.Field;
import java.util.*;

// Difficulty rules of the unchanged 1.7.10 classes on the MobMoveProbe/ChickenProbe
// world double: World.func_147462_b (local difficulty), EntitySpider.onSpawnWithEgg and
// its GroupData effect, PotionEffect ticks on a mob (attributes, regeneration, swirls),
// EntityPlayer.attackEntityFrom scaling, EntityZombie.attackEntityAsMob fire,
// EntityZombie.onSpawnWithEgg rolls and the Hard reinforcement search.
// The double supplies the chunk (inhabited time), WorldInfo (world time), light,
// metadata and an intersecting collision list. No game class is patched or shipped.
public class DifficultyProbe {
  public static class World extends ChickenProbe.World {
    static boolean exists = true;
    static long inhabited = 0;
    static int light = 0;
    static List<double[]> swirls = new ArrayList<>();
    static List<String> swirlNames = new ArrayList<>();
    static apx chunk;
    public boolean d(int x, int y, int z) { return exists; }
    public apx d(int x, int z) { try { MobMoveProbe.field(apx.class, "s").setLong(chunk, inhabited); } catch (Exception e) { throw new RuntimeException(e); } return chunk; }
    public int k(int x, int y, int z) { return light; }
    public int e(int x, int y, int z) { return 0; }
    public void a(sa entity, byte state) {}
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) { swirlNames.add(name); swirls.add(new double[] { x, y, z, vx, vy, vz }); }
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>();
      for (int x = (int) Math.floor(box.a) - 1; x <= (int) Math.floor(box.d) + 1; x++)
        for (int y = (int) Math.floor(box.b) - 1; y <= (int) Math.floor(box.e) + 1; y++)
          for (int z = (int) Math.floor(box.c) - 1; z <= (int) Math.floor(box.f) + 1; z++)
            if (y < 0) { azt cell = azt.a(x, y, z, x + 1, y + 1, z + 1); if (cell.b(box)) out.add(cell); }
      return out;
    }
  }
  // An attack target that always takes the hit.
  static class Target extends yn {
    Target(ahb w) { super(w); }
    public boolean a(ro source, float amount) { return true; }
  }
  static class Stop extends RuntimeException { final float amount; Stop(float amount) { this.amount = amount; } }
  // EntityPlayer with the three ICommandSender methods it leaves abstract. damageEntity
  // (d(ro, F)) reports the amount EntityLivingBase.attackEntityFrom passes on and stops.
  public static class Player extends yz {
    Player() { super(null, null); }
    protected void d(ro source, float amount) { throw new Stop(amount); }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
  }
  // FoodStats.onUpdate's starvation damage, applied directly (EntityPlayer.attackEntityFrom
  // is covered by the "player" cases).
  public static class Eater extends Player {
    public boolean a(ro source, float amount) { g(aS() - amount); return true; }
  }
  static <T extends yz> T player(sun.misc.Unsafe u, Class<T> c) throws Exception {
    T p = c.cast(u.allocateInstance(c));
    set(p, "o", w); set(p, "Z", new Random(0)); set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    te watcher = new te(p); set(p, "af", watcher);
    watcher.a(0, Byte.valueOf((byte) 0)); watcher.a(1, Short.valueOf((short) 300));
    MobMoveProbe.method(yz.class, "c").invoke(p);
    MobMoveProbe.field(sv.class, "f").set(p, new HashMap());
    set(p, "bE", new yw());
    MobMoveProbe.method(yz.class, "aD").invoke(p);
    p.g(20.0f);
    return p;
  }

  static World w;
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static void set(Object o, String name, Object v) throws Exception { MobMoveProbe.set(o, name, v); }
  static void setDifficulty(int id) throws Exception { MobMoveProbe.field(ahb.class, "r").set(w, rd.values()[id]); }
  static void setTime(long worldTime) throws Exception { Object info = MobMoveProbe.field(ahb.class, "x").get(w); MobMoveProbe.field(ays.class, "h").setLong(info, worldTime); }
  static double attr(sv e, th a) { return e.a(a).e(); }
  static th reinforcement() throws Exception { return (th) MobMoveProbe.field(yq.class, "bp").get(null); }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    w = (World) u.allocateInstance(World.class);
    set(w, "s", new Random(2));
    set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "t").set(w, u.allocateInstance(aqq.class));
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1); // total time: getCurrentDate never re-reads the clock
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(w, info);
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    MobMoveProbe.field(ahb.class, "J").set(w, date);
    World.chunk = (apx) u.allocateInstance(apx.class);

    // World.func_147462_b at a block for each difficulty, moon phase and inhabited time.
    long[] inhabitedTimes = { 0, 1, 360000, 1800000, 3599999, 3600000, 9000000 };
    for (int d = 0; d < 4; d++) {
      setDifficulty(d);
      for (int day = 0; day < 9; day++)
        for (long inhabited : inhabitedTimes) {
          World.exists = true; World.inhabited = inhabited; setTime(day * 24000L + 18000);
          System.out.println("{\"case\":\"local\",\"difficulty\":" + d + ",\"worldTime\":" + (day * 24000L + 18000) + ",\"inhabited\":" + inhabited + ",\"value\":" + num(w.B(3, 64, -5)) + "}");
        }
      World.exists = false; setTime(0);
      System.out.println("{\"case\":\"local\",\"difficulty\":" + d + ",\"worldTime\":0,\"inhabited\":0,\"exists\":false,\"value\":" + num(w.B(3, 64, -5)) + "}");
      World.exists = true;
    }

    // EntitySpider.onSpawnWithEgg(null): EntityLiving's spawn bonus (Entity.rand), the
    // jockey roll and, on Hard, the GroupData effect (World.rand).
    for (int d : new int[] { 2, 3 })
      for (long[] lc : new long[][] { { 0, 3600000 }, { 4, 0 }, { 2, 1800000 } })
        for (int seed = 0; seed < 300; seed++) {
          setDifficulty(d); World.inhabited = lc[1]; setTime(lc[0] * 24000L);
          set(w, "s", new Random(seed * 2654435761L + 11));
          yn spider = new yn(w);
          set(spider, "Z", new Random(seed + 1000));
          World.spawned.clear();
          float local = w.b(0.0, 0.0, 0.0);
          String effect = "0";
          try { spider.a((sy) null); } catch (RuntimeException e) { effect = "\"error\""; }
          for (Object o : spider.aQ()) { rw r = (rw) o; effect = r.a() + ",\"amplifier\":" + r.c() + ",\"duration\":" + r.b(); }
          System.out.println("{\"case\":\"spider\",\"difficulty\":" + d + ",\"seed\":" + seed + ",\"worldSeed\":" + (seed * 2654435761L + 11) + ",\"local\":" + num(local) + ",\"jockey\":" + !World.spawned.isEmpty()
            + ",\"effect\":" + effect + ",\"worldNext\":" + w.s.nextInt() + "}");
        }

    // PotionEffect on a spider: attributes, colour/ambient/invisible metadata, the
    // regeneration heal and the swirl particles of updatePotionEffects for 120 ticks.
    setDifficulty(2);
    java.lang.reflect.Method update = MobMoveProbe.method(sv.class, "aO");
    for (int id : new int[] { 1, 5, 10, 14 })
      for (int amp : new int[] { 0, 1 }) {
        yn spider = new yn(w);
        MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(spider, 10.5, 64.0, -3.25);
        spider.g(8.0f);
        spider.c(new rw(id, Integer.MAX_VALUE, amp));
        set(spider, "Z", new Random(id * 10 + amp));
        StringBuilder ticks = new StringBuilder();
        String facts = "";
        for (int t = 0; t < 120; t++) {
          World.swirls.clear(); World.swirlNames.clear();
          update.invoke(spider);
          if (t == 0) facts = ",\"speed\":" + num(attr(spider, yj.d)) + ",\"damage\":" + num(attr(spider, yj.e)) + ",\"color\":" + spider.z().c(7) + ",\"ambient\":" + spider.z().a(8) + ",\"invisible\":" + spider.ap();
          ticks.append(t == 0 ? "" : ",").append("[").append(num(spider.aS()));
          for (int i = 0; i < World.swirls.size(); i++) {
            double[] p = World.swirls.get(i);
            ticks.append(",[\"").append(World.swirlNames.get(i)).append("\"");
            for (double v : p) ticks.append(",").append(num(v));
            ticks.append("]");
          }
          ticks.append("]");
        }
        rw left = spider.b(rv.a[id]);
        System.out.println("{\"case\":\"potion\",\"id\":" + id + ",\"amplifier\":" + amp + ",\"seed\":" + (id * 10 + amp) + ",\"x\":10.5,\"y\":64.0,\"z\":-3.25,\"width\":" + num(spider.M) + ",\"height\":" + num(spider.N) + ",\"yOffset\":" + num(spider.L)
          + facts + ",\"durationLeft\":" + left.b() + ",\"ticks\":[" + ticks + "]}");
      }

    // EntityPlayer.attackEntityFrom: the amount handed to damageEntity per difficulty and source.
    yn mob = new yn(w);
    xz creeper = new xz(w);
    zc arrow = new zc(w);
    Object[][] sources = { { "mob", ro.a((sv) mob) }, { "explosion", ro.a(new agw(w, null, 0, 0, 0, 3)) }, { "creeperExplosion", ro.a(new agw(w, creeper, 0, 0, 0, 3)) },
      { "arrow", ro.a(arrow, mob) }, { "fall", ro.h }, { "lava", ro.c }, { "starve", ro.f } };
    float[] amounts = { 0.5f, 1, 1.5f, 2, 3, 4.5f, 7, 49.5f };
    for (int d = 0; d < 4; d++) {
      setDifficulty(d);
      for (Object[] s : sources)
        for (float amount : amounts) {
          Player p = player(u, Player.class);
          String out;
          try { out = "{\"applied\":" + p.a((ro) s[1], amount) + "}"; } catch (Stop stop) { out = "{\"applied\":true,\"amount\":" + num(stop.amount) + "}"; }
          System.out.println("{\"case\":\"player\",\"difficulty\":" + d + ",\"source\":\"" + s[0] + "\",\"input\":" + num(amount) + ",\"result\":" + out + "}");
        }
    }

    // FoodStats.onUpdate per difficulty: starvation thresholds and Peaceful's kept food level.
    for (int d = 0; d < 4; d++) {
      setDifficulty(d);
      for (float health : new float[] { 1, 1.5f, 2, 10, 10.5f, 11, 20 }) {
        Eater p = player(u, Eater.class);
        p.g(health);
        zr food = new zr(); food.a(0); food.b(0.0f);
        StringBuilder trace = new StringBuilder();
        for (int t = 0; t < 400; t++) { food.a(p); if (t % 80 == 79) trace.append(trace.length() == 0 ? "" : ",").append(num(p.aS())); }
        System.out.println("{\"case\":\"starve\",\"difficulty\":" + d + ",\"health\":" + num(health) + ",\"trace\":[" + trace + "]}");
      }
      for (float saturation : new float[] { 0, 0.5f, 2 }) {
        Eater p = player(u, Eater.class);
        zr food = new zr(); food.a(10); food.b(saturation); food.a(4.5f);
        food.a(p);
        java.lang.reflect.Field ex = zr.class.getDeclaredField("c"); ex.setAccessible(true);
        System.out.println("{\"case\":\"exhaust\",\"difficulty\":" + d + ",\"saturationIn\":" + num(saturation) + ",\"food\":" + food.a() + ",\"saturation\":" + num(food.e()) + ",\"exhaustion\":" + num(ex.getFloat(food)) + "}");
      }
    }

    // EntityZombie.attackEntityAsMob: a burning zombie with no held item sets its target on fire.
    for (int d = 0; d < 4; d++)
      for (boolean burning : new boolean[] { false, true })
        for (int seed = 0; seed < 60; seed++) {
          setDifficulty(d);
          yq zombie = new yq(w);
          if (burning) zombie.e(8);
          Target target = new Target(w);
          set(zombie, "Z", new Random(seed));
          boolean hit = zombie.n(target);
          System.out.println("{\"case\":\"zombieHit\",\"difficulty\":" + d + ",\"burning\":" + burning + ",\"seed\":" + seed + ",\"hit\":" + hit + ",\"targetFire\":" + MobMoveProbe.field(sa.class, "e").getInt(target) + ",\"randNext\":" + ((Random) MobMoveProbe.field(sa.class, "Z").get(zombie)).nextInt() + "}");
        }

    // EntityZombie.onSpawnWithEgg(null), with the reinforcement base set to 0 so the
    // attribute shows the leader bonus alone.
    th reinforcements = reinforcement();
    for (int d = 0; d < 4; d++)
      for (long[] lc : new long[][] { { 0, 3600000 }, { 4, 0 }, { 2, 1800000 }, { 1, 360000 } })
        for (int seed = 0; seed < 150; seed++) {
          setDifficulty(d); World.inhabited = lc[1]; setTime(lc[0] * 24000L);
          set(w, "s", new Random(seed * 2654435761L + 7));
          yq zombie = new yq(w);
          zombie.a(reinforcements).a(0.0);
          Random rand = new Random(seed);
          set(zombie, "Z", rand);
          World.spawned.clear();
          float local = w.b(0.0, 0.0, 0.0);
          zombie.a((sy) null);
          StringBuilder slots = new StringBuilder();
          boolean enchanted = false;
          for (int i = 0; i < 5; i++) { add s = zombie.q(i); if (s != null) { slots.append(slots.length() == 0 ? "" : ",").append(i); enchanted |= s.y(); } }
          System.out.println("{\"case\":\"zombieSpawn\",\"difficulty\":" + d + ",\"seed\":" + seed + ",\"worldSeed\":" + (seed * 2654435761L + 7) + ",\"local\":" + num(local)
            + ",\"loot\":" + zombie.bJ() + ",\"doors\":" + zombie.bZ() + ",\"child\":" + zombie.f() + ",\"villager\":" + zombie.cb() + ",\"equipment\":[" + slots + "],\"enchanted\":" + enchanted
            + ",\"knockback\":" + num(attr(zombie, yj.c)) + ",\"followRange\":" + num(attr(zombie, yj.b)) + ",\"reinforcement\":" + num(attr(zombie, reinforcements)) + ",\"maxHealth\":" + num(attr(zombie, yj.a))
            + ",\"spawned\":" + World.spawned.size() + ",\"worldNext\":" + w.s.nextInt() + ",\"randNext\":" + rand.nextInt() + "}");
        }

    // EntityZombie.attackEntityFrom with an attacker: on Hard, the reinforcement roll and
    // up to 50 placement tries around the zombie (floor at y < 0, uniform light).
    setDifficulty(2); World.inhabited = 0; setTime(0);
    for (int d : new int[] { 2, 3 })
      for (int light : new int[] { 0, 9, 10 })
        for (double chance : new double[] { 0.0, 0.3, 1.0 })
          for (int seed = 0; seed < 40; seed++) {
            setDifficulty(d); World.light = light;
            yq zombie = new yq(w);
            MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(zombie, 4.5, 0.0, -7.5);
            zombie.a(reinforcements).a(chance);
            yn attacker = new yn(w);
            MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(attacker, 6.5, 0.0, -7.5);
            Random rand = new Random(seed);
            set(zombie, "Z", rand);
            World.spawned.clear();
            boolean hurt = zombie.a(ro.a((sv) attacker), 1.0f);
            String spawned = "null";
            for (Object o : World.spawned) if (o instanceof yq) { yq z = (yq) o; spawned = "[" + num(z.s) + "," + num(z.t) + "," + num(z.u) + "," + (z.o() == attacker) + "]"; }
            System.out.println("{\"case\":\"reinforce\",\"difficulty\":" + d + ",\"light\":" + light + ",\"chance\":" + num(chance) + ",\"seed\":" + seed + ",\"hurt\":" + hurt
              + ",\"spawned\":" + spawned + ",\"callerChance\":" + num(attr(zombie, reinforcements)) + ",\"randNext\":" + rand.nextInt() + "}");
          }
  }
}
