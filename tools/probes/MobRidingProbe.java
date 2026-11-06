import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.util.*;

// Mob riding and the zombie's door breaking on the unchanged 1.7.10 classes (the MobMoveProbe /
// ChickenProbe / DifficultyProbe world double). Entity.mountEntity (sa.a(sa)), updateRiderPosition (sa.ac),
// getMountedYOffset (sa.ae), getYOffset (sa.ad), EntityChicken's own updateRiderPosition and jockey flag (wg),
// EntitySpider.onSpawnWithEgg's skeleton rider (yn.a(sy)), EntityZombie.onSpawnWithEgg's chicken jockeys (yq.a(sy)
// with a child GroupData) and EntityAIBreakDoor (tz) driven over a closed wooden door in each difficulty.
public class MobRidingProbe {
  public static class World extends DifficultyProbe.World {
    static List<wg> chickens = new ArrayList<>();
    static boolean doors = false;
    static List<String> log = new ArrayList<>();
    public List a(Class c, azt box, sj selector) { List out = new ArrayList(); if (c == wg.class) for (wg e : chickens) if (selector == null || selector.a(e)) out.add(e); return out; }
    // BlockDoor (ajn.ao) wherever the double says so: the lower half at y 1, the upper at y 2, metadata 0 (closed).
    public aji a(int x, int y, int z) { return doors && x == 6 && z == 5 && (y == 1 || y == 2) ? ajn.ao : super.a(x, y, z); }
    public int e(int x, int y, int z) { return doors && x == 6 && z == 5 && y == 2 ? 8 : 0; }
    static int tick = -1;
    public void c(int id, int x, int y, int z, int data) { log.add("[" + tick + ",\"sfx\"," + id + "," + x + "," + y + "," + z + "," + data + "]"); }
    public void d(int id, int x, int y, int z, int stage) { log.add("[" + tick + ",\"crack\"," + stage + "," + x + "," + y + "," + z + "]"); }
    public boolean f(int x, int y, int z) { log.add("[" + tick + ",\"air\"," + x + "," + y + "," + z + "]"); return true; }
  }
  static World w;
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static void set(Object o, String name, Object v) throws Exception { MobMoveProbe.set(o, name, v); }
  static void place(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static void setDifficulty(int id) throws Exception { MobMoveProbe.field(ahb.class, "r").set(w, rd.values()[id]); }
  static String vec(sa e) { return "[" + num(e.s) + "," + num(e.t) + "," + num(e.u) + "]"; }
  static String name(sa e) { return e instanceof yl ? "skeleton" : e instanceof yq ? "zombie" : e instanceof wg ? "chicken" : e instanceof xy ? "cave_spider" : e instanceof yn ? "spider" : "other"; }
  static sw make(String type) {
    switch (type) {
      case "spider": return new yn(w);
      case "cave_spider": return new xy(w);
      case "chicken": return new wg(w);
      case "skeleton": return new yl(w);
      default: return new yq(w);
    }
  }
  static String slots(sw e) { StringBuilder s = new StringBuilder(); for (int i = 0; i < 5; i++) if (e.q(i) != null) s.append(s.length() == 0 ? "" : ",").append(i); return s.toString(); }

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
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(w, info);
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    MobMoveProbe.field(ahb.class, "J").set(w, date);
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    DifficultyProbe.w = w;
    setDifficulty(2);

    // Entity.mountEntity then updateRiderPosition: where the rider ends up, per pair, child state and body yaw.
    String[][] pairs = { { "spider", "skeleton" }, { "cave_spider", "skeleton" }, { "chicken", "zombie" }, { "chicken", "skeleton" }, { "spider", "zombie" }, { "zombie", "skeleton" } };
    for (String[] pair : pairs)
      for (boolean child : new boolean[] { false, true })
        for (float bodyYaw : new float[] { 0, 45, 90, 180, 270, -135 }) {
          sw mount = make(pair[0]), rider = make(pair[1]);
          if (child && rider instanceof yq) ((yq) rider).i(true);
          place(mount, 10.5, 64.0, -3.25);
          mount.aM = bodyYaw; mount.y = bodyYaw;
          place(rider, 0, 0, 0);
          rider.a((sa) mount);
          boolean linked = rider.m == mount && mount.l == rider;
          mount.ac();
          System.out.println("{\"case\":\"seat\",\"mount\":\"" + pair[0] + "\",\"riderType\":\"" + pair[1] + "\",\"child\":" + child + ",\"bodyYaw\":" + num(bodyYaw)
            + ",\"mountWidth\":" + num(mount.M) + ",\"mountHeight\":" + num(mount.N) + ",\"mountedOffset\":" + num(mount.ae()) + ",\"riderHeight\":" + num(rider.N) + ",\"riderYOffset\":" + num(rider.ad())
            + ",\"linked\":" + linked + ",\"pos\":" + vec(rider) + ",\"riderBodyYaw\":" + num(rider.aM) + "}");
          rider.a((sa) null);
          System.out.println("{\"case\":\"dismount\",\"mount\":\"" + pair[0] + "\",\"riderType\":\"" + pair[1] + "\",\"child\":" + child + ",\"bodyYaw\":" + num(bodyYaw)
            + ",\"cleared\":" + (rider.m == null && mount.l == null) + ",\"pos\":" + vec(rider) + ",\"mountTop\":" + num(mount.C.b + mount.N) + "}");
        }
    // Mount cycles: a mount cannot be ridden by something it rides (the loop check in mountEntity).
    { sw a = new yn(w), b = new yl(w); b.a((sa) a); a.a((sa) b); System.out.println("{\"case\":\"cycle\",\"refused\":" + (a.m == null && b.m == a) + "}"); }
    // Mounting while on another mount: the first mount lets go.
    { sw a = new yn(w), c = new yn(w), b = new yl(w); b.a((sa) a); b.a((sa) c); System.out.println("{\"case\":\"remount\",\"firstFree\":" + (a.l == null) + ",\"second\":" + (c.l == b && b.m == c) + "}"); }

    // Chicken facts: the jockey flag, canDespawn, experience, egg laying, NBT.
    java.lang.reflect.Method xp = MobMoveProbe.method(wg.class, "e", yz.class), despawn = MobMoveProbe.method(wg.class, "v");
    for (boolean jockey : new boolean[] { false, true })
      for (boolean ridden : new boolean[] { false, true })
        for (boolean child : new boolean[] { false, true }) {
          wg c = new wg(w);
          ChickenProbe.clearTasks(c);
          c.i(jockey);
          if (child) c.c(-24000);
          if (ridden) { yq z = new yq(w); z.a((sa) c); }
          dh tag = new dh(); c.b(tag);
          int laid = 0, plops = 0;
          for (int seed = 0; seed < 3; seed++) {
            World.spawned.clear(); World.sounds.clear();
            c.bu = 1; set(c, "Z", new Random(seed));
            c.e();
            for (Object o : World.spawned) if (o instanceof xk) laid++;
            for (String s : World.sounds) if (s.startsWith("mob.chickenplop")) plops++;
          }
          int points = (Integer) xp.invoke(c, (Object) null);
          System.out.println("{\"case\":\"chicken\",\"jockey\":" + jockey + ",\"ridden\":" + ridden + ",\"child\":" + child + ",\"experience\":" + points + ",\"canDespawn\":" + despawn.invoke(c)
            + ",\"nbtJockey\":" + tag.n("IsChickenJockey") + ",\"eggsOver3\":" + laid + ",\"plops\":" + plops + "}");
        }
    { wg c = new wg(w); dh tag = new dh(); tag.a("IsChickenJockey", true); c.a(tag); System.out.println("{\"case\":\"chickenRead\",\"jockey\":" + c.bZ() + "}"); }

    // EntitySpider.onSpawnWithEgg(null): the rider skeleton (mounted, positioned at the spider with the spider's yaw, its own spawn rolls).
    for (int d : new int[] { 1, 2, 3 })
      { int plain = 0, riders = 0; for (int seed = 0; seed < 6000; seed++) {
        setDifficulty(d); DifficultyProbe.World.inhabited = 3600000; DifficultyProbe.setTime(0);
        set(w, "s", new Random(seed * 2654435761L + 11));
        yn spider = new yn(w);
        place(spider, 3.5, 64.0, 7.5); spider.y = 90;
        Random sr = new Random(seed + 1000);
        set(spider, "Z", sr);
        World.spawned.clear();
        spider.a((sy) null);
        String rider = "null";
        for (Object o : World.spawned) if (o instanceof yl) {
          yl sk = (yl) o;
          rider = "{\"mounted\":" + (sk.m == spider && spider.l == sk) + ",\"wither\":" + (sk.cb() == 1) + ",\"pos\":" + vec(sk) + ",\"yaw\":" + num(sk.y) + ",\"pitch\":" + num(sk.z)
            + ",\"armed\":" + (sk.q(0) != null) + "}";
        }
        if (rider.equals("null")) { if (plain++ >= 40) continue; } else riders++;
        System.out.println("{\"case\":\"spiderJockey\",\"difficulty\":" + d + ",\"seed\":" + seed + ",\"worldSeed\":" + (seed * 2654435761L + 11) + ",\"rider\":" + rider + ",\"worldNext\":" + w.s.nextInt() + "}");
      }
      System.out.println("{\"case\":\"spiderJockeyCount\",\"difficulty\":" + d + ",\"seeds\":6000,\"riders\":" + riders + "}"); }

    // EntityZombie.onSpawnWithEgg with a child GroupData (the 5% x 5% roll sequence): a chicken in the 5 x 3 x 5 box
    // (the selector skips ridden ones), else a new chicken jockey at the zombie.
    Constructor<?> groupCtor = null; for (Constructor<?> k : ys.class.getDeclaredConstructors()) if (groupCtor == null || k.getParameterCount() < groupCtor.getParameterCount()) groupCtor = k; groupCtor.setAccessible(true);
    for (int nearby : new int[] { 0, 1, 2 })
      for (int seed = 0; seed < 400; seed++) {
        setDifficulty(2); DifficultyProbe.World.inhabited = 0; DifficultyProbe.setTime(0);
        set(w, "s", new Random(seed * 40503L + 5));
        World.chickens.clear();
        wg near = null;
        if (nearby > 0) {
          near = new wg(w); place(near, 6.0, 64.0, 5.0);
          if (nearby == 2) { yq other = new yq(w); other.a((sa) near); }
          World.chickens.add(near);
        }
        yq zombie = new yq(w);
        place(zombie, 4.5, 64.0, 5.5); zombie.y = 30;
        Random zr = new Random(seed);
        set(zombie, "Z", zr);
        World.spawned.clear();
        boolean selected = near != null && sj.b.a(near);
        zombie.a((sy) (groupCtor.getParameterCount() == 4 ? groupCtor.newInstance(zombie, true, false, null) : groupCtor.newInstance(zombie, true, false)));
        String chicken = "null";
        for (Object o : World.spawned) if (o instanceof wg) { wg c = (wg) o; chicken = "{\"jockey\":" + c.bZ() + ",\"mounted\":" + (zombie.m == c) + ",\"pos\":" + vec(c) + ",\"yaw\":" + num(c.y) + ",\"age\":" + c.d() + "}"; }
        System.out.println("{\"case\":\"chickenJockey\",\"nearby\":" + nearby + ",\"seed\":" + seed + ",\"worldSeed\":" + (seed * 40503L + 5) + ",\"selected\":" + selected
          + ",\"child\":" + zombie.f() + ",\"zombieMounted\":" + (zombie.m != null) + ",\"nearMounted\":" + (near != null && zombie.m == near) + ",\"nearJockey\":" + (near != null && near.bZ())
          + ",\"spawned\":" + chicken + ",\"worldNext\":" + w.s.nextInt() + ",\"randNext\":" + zr.nextInt() + "}");
      }

    // EntityZombie.setBreakDoorsAItask via the CanBreakDoors tag.
    { yq z = new yq(w); dh t = new dh(); t.a("CanBreakDoors", true); z.a(t); dh out = new dh(); z.b(out);
      System.out.println("{\"case\":\"canBreakDoors\",\"read\":" + z.bZ() + ",\"written\":" + out.n("CanBreakDoors") + "}"); }

    // EntityAIBreakDoor (tz) over a closed wooden door at (6, 1..2, 5): shouldExecute, then each tick b() and e() for up to 260
    // ticks, with the world calls it makes. The zombie stands at (5.5, 0, 5.5) collided horizontally with a path point at (6, 0, 5).
    World.doors = true;
    Constructor<?> pointCtor = aye.class.getDeclaredConstructor(int.class, int.class, int.class); pointCtor.setAccessible(true);
    for (int d = 0; d < 4; d++)
      for (int seed = 0; seed < 6; seed++)
        for (int variant = 0; variant < 3; variant++) {
          if (variant > 0 && seed > 0) continue;
          setDifficulty(d);
          yq z = new yq(w);
          place(z, 5.5, 0.0, 5.5);
          Random r = new Random(seed); set(z, "Z", r);
          if (variant == 1) z.E = false; else z.E = true;
          aye[] points = { (aye) pointCtor.newInstance(5, 0, 5), (aye) pointCtor.newInstance(6, 0, 5), (aye) pointCtor.newInstance(7, 0, 5) };
          if (variant != 2) z.m().a(new ayf(points), 1.0);
          tz task = new tz(z);
          World.log.clear(); World.tick = -1;
          boolean start = task.a();
          StringBuilder trace = new StringBuilder();
          int ticks = 0; boolean ended = false;
          if (start) {
            task.c();
            for (int t = 0; t < 300; t++) {
              boolean keep = task.b();
              if (!keep) { ended = true; World.tick = t; task.d(); break; }
              World.tick = t;
              task.e(); ticks++;
            }
          }
          System.out.println("{\"case\":\"breakDoor\",\"difficulty\":" + d + ",\"seed\":" + seed + ",\"variant\":" + variant + ",\"start\":" + start + ",\"ticks\":" + ticks + ",\"ended\":" + ended
            + ",\"counter\":" + (start ? num(MobMoveProbe.field(tz.class, "i").getInt(task)) : "0") + ",\"log\":[" + String.join(",", World.log) + "],\"randNext\":" + r.nextInt() + "}");
        }
    // mobGriefing false: shouldExecute declines.
    { setDifficulty(3); yq z = new yq(w); place(z, 5.5, 0.0, 5.5); z.E = true; aye[] points = { (aye) pointCtor.newInstance(6, 0, 5) }; z.m().a(new ayf(points), 1.0);
      agy rules = (agy) MobMoveProbe.field(ays.class, "x").get(info); rules.a("mobGriefing", "false");
      System.out.println("{\"case\":\"griefing\",\"start\":" + new tz(z).a() + "}"); rules.a("mobGriefing", "true"); }
  }
}
