import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Batch 81 exhaust81: EntityPlayer.addMovementStat (yz.k) and addMountedMovementStat (yz.l) on a real EntityPlayerMP (mw, ServerPlayerProbe's unchanged
// constructor), Minecraft Java 1.7.10. The player's StatisticsFile is a recording pg (every EntityPlayerMP.addStat -> pg.b(yz, ph, n) is kept) and the
// exhaustion is FoodStats.foodExhaustionLevel (zr.c) read before and after.
//
// The world double: stone below y 0; a still-water pool (id 9, meta 0) at x 100..119, y 0..3, z -10..9; a ladder column (id 65, meta 3, facing +z) at
// x 200, z 0, y 0..9 against a stone wall at z -1 (y 0..10). Collisions are the real Block.addCollisionBoxesToList; World.handleMaterialAcceleration and
// isMaterialInBB are the real ahb methods (MobMoveProbe.ProbeWorld.water).
//
// One JSON object per line:
//   move   {name, tick, x, y, z, dx, dy, dz, eye, inWater, ladder, onGround, sprint, creative, exBefore, exJump, exAfter, jump: [[stat, n]], stats: [[stat, n]]}
//          a tick of the EntityPlayer movement path: Entity.handleWaterMovement (sa.N, as onEntityUpdate), the jump (sv.bj when on the ground and not in
//          water; in water EntityLivingBase.onLivingUpdate's motionY += 0.04 instead), the jumpMovementFactor EntityPlayer.onLivingUpdate sets (0.02, + 0.006
//          sprinting; port-read), then the unchanged moveEntityWithHeading (yz.e(FF)) whose last call is yz.k with the move's delta. The state is read after
//          the move (what k sees: eye in water sa.a(awt.h), inWater sa.ac, isOnLadder sv.h_, onGround sa.D, sprinting sa.ao).
//   direct {name, x, y, z, dx, dy, dz, eye, inWater, ladder, onGround, sprint, creative, riding, exBefore, exAfter, stats}
//          yz.k called with a chosen delta and state (rounding edges, branch order, Creative, riding).
//   mounted {name, vehicle, dx, dy, dz, exBefore, exAfter, stats}   yz.l (private, by reflection) with p.m set to an instance of each vehicle class.
public class MovementStatProbe {
  static final List<String> rec = new ArrayList<>();
  public static class RecStats extends pg {
    RecStats() { super(null, null); }
    public void b(yz p, ph stat, int amount) { rec.add("[\"" + stat.e + "\"," + amount + "]"); }
    public void a(yz p, ph stat, int amount) {}
    public boolean e() { return false; }
  }
  public static class RecOi extends ServerPlayerProbe.Oi {
    RecOi() { super(); }
    public pg a(yz p) { try { return (pg) MobMoveProbe.unsafe().allocateInstance(RecStats.class); } catch (Exception e) { throw new RuntimeException(e); } }
  }

  static boolean stone(int x, int y, int z) { return y < 0 || (x == 200 && z == -1 && y <= 10); }
  static boolean water(int x, int y, int z) { return x >= 100 && x < 120 && z >= -10 && z < 10 && y >= 0 && y < 4; }
  static boolean ladder(int x, int y, int z) { return x == 200 && z == 0 && y >= 0 && y <= 9; }

  public static class World extends MobMoveProbe.ProbeWorld {
    public aji a(int x, int y, int z) { return stone(x, y, z) ? aji.e(1) : water(x, y, z) ? aji.e(9) : ladder(x, y, z) ? aji.e(65) : aji.e(0); }
    public int e(int x, int y, int z) { return ladder(x, y, z) ? 3 : 0; }
    public void a(double x, double y, double z, String sound, float volume, float pitch, boolean delay) {}
    public void a(sa entity, String sound, float volume, float pitch) {}
    public void a(String particle, double x, double y, double z, double mx, double my, double mz) {}
    public List b(sa entity, azt box) { return new ArrayList(); }
    public List a(Class c, azt box) { return new ArrayList(); }
    public List a(sa entity, azt box, sj selector) { return new ArrayList(); }
    public List a(Class c, azt box, sj selector) { return new ArrayList(); }
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>();
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b) - 1; y < (int) Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++)
            a(x, y, z).a(this, x, y, z, box, out, entity);
      return out;
    }
  }

  static World w;
  static Field exhaustion, inWaterField;
  static Method setPosition, mounted;
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static float ex(mw p) throws Exception { return exhaustion.getFloat(p.bQ()); }
  static String drain() { String s = "[" + String.join(",", rec) + "]"; rec.clear(); return s; }

  static ServerPlayerProbe.PM player(double x, double y, double z, float yaw, boolean creative) throws Exception {
    ServerPlayerProbe.PM p = ServerPlayerProbe.make(w, "Player");
    if (creative) ServerPlayerProbe.gameType(p, ahk.c);
    setPosition.invoke(p, x, y, z);
    p.y = yaw;
    p.D = y == 0;
    rec.clear();
    return p;
  }
  static String state(mw p) throws Exception {
    return "\"eye\":" + p.a(awt.h) + ",\"inWater\":" + inWaterField.getBoolean(p) + ",\"ladder\":" + p.h_() + ",\"onGround\":" + p.D + ",\"sprint\":" + p.ao() + ",\"creative\":" + p.bE.a;
  }

  // name, x, y, z, yaw, forward, sprint, jump, ticks
  static void run(String name, double x, double y, double z, float yaw, float forward, boolean sprint, boolean jump, int ticks) throws Exception {
    ServerPlayerProbe.PM p = player(x, y, z, yaw, false);
    p.c(sprint);
    for (int t = 0; t < ticks; t++) {
      double x0 = p.s, y0 = p.t, z0 = p.u;
      p.p = x0; p.q = y0; p.r = z0;
      p.N(); // Entity.handleWaterMovement (onEntityUpdate)
      float before = ex(p);
      if (jump) {
        if (p.M()) p.w += 0.03999999910593033D; // EntityLivingBase.onLivingUpdate: isJumping in water
        else if (p.D) p.bj();
      }
      String jumpStats = drain();
      float afterJump = ex(p);
      MobMoveProbe.set(p, "aQ", p.ao() ? (float) (0.02f + 0.02f * 0.3D) : 0.02f); // EntityPlayer.onLivingUpdate: jumpMovementFactor = speedInAir (+30% sprinting)
      p.e(0f, forward);
      System.out.println("{\"case\":\"move\",\"name\":\"" + name + "\",\"tick\":" + t + ",\"x\":" + num(p.s) + ",\"y\":" + num(p.t) + ",\"z\":" + num(p.u)
        + ",\"dx\":" + num(p.s - x0) + ",\"dy\":" + num(p.t - y0) + ",\"dz\":" + num(p.u - z0) + "," + state(p)
        + ",\"exBefore\":" + num(before) + ",\"exJump\":" + num(afterJump) + ",\"exAfter\":" + num(ex(p)) + ",\"jump\":" + jumpStats + ",\"stats\":" + drain() + "}");
    }
  }

  // name, x, y, z, inWater, onGround, sprint, creative, riding, dx, dy, dz
  static void direct(String name, double x, double y, double z, boolean inWater, boolean onGround, boolean sprint, boolean creative, boolean riding, double dx, double dy, double dz) throws Exception {
    ServerPlayerProbe.PM p = player(x, y, z, 0f, creative);
    inWaterField.setBoolean(p, inWater);
    p.D = onGround;
    p.c(sprint);
    if (riding) p.m = (sa) MobMoveProbe.unsafe().allocateInstance(wo.class);
    rec.clear();
    float before = ex(p);
    p.k(dx, dy, dz);
    System.out.println("{\"case\":\"direct\",\"name\":\"" + name + "\",\"x\":" + num(x) + ",\"y\":" + num(y) + ",\"z\":" + num(z) + ",\"dx\":" + num(dx) + ",\"dy\":" + num(dy) + ",\"dz\":" + num(dz)
      + "," + state(p) + ",\"riding\":" + riding + ",\"exBefore\":" + num(before) + ",\"exAfter\":" + num(ex(p)) + ",\"stats\":" + drain() + "}");
  }

  static void mount(String name, Class<?> vehicle, double dx, double dy, double dz) throws Exception {
    ServerPlayerProbe.PM p = player(0.5, 0, 0.5, 0f, false);
    p.m = (sa) MobMoveProbe.unsafe().allocateInstance(vehicle);
    rec.clear();
    float before = ex(p);
    mounted.invoke(p, dx, dy, dz);
    System.out.println("{\"case\":\"mounted\",\"name\":\"" + name + "\",\"vehicle\":\"" + vehicle.getName() + "\",\"dx\":" + num(dx) + ",\"dy\":" + num(dy) + ",\"dz\":" + num(dz)
      + ",\"exBefore\":" + num(before) + ",\"exAfter\":" + num(ex(p)) + ",\"stats\":" + drain() + "}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    pp.a(); // StatList.init
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    ServerPlayerProbe.Server.OI = (oi) u.allocateInstance(RecOi.class);
    w = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.field(ahb.class, "D").set(w, new bac()); // the scoreboard EntityPlayerMP.addStat asks for the stat's criteria
    MobMoveProbe.ProbeWorld.water = true;
    exhaustion = zr.class.getDeclaredField("c"); exhaustion.setAccessible(true);
    inWaterField = MobMoveProbe.field(sa.class, "ac");
    setPosition = MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class);
    mounted = yz.class.getDeclaredMethod("l", double.class, double.class, double.class); mounted.setAccessible(true);

    // Executed movement (yaw 0 faces +z; yaw 180 faces -z, the wall behind the ladder).
    run("walk", 0.5, 0, 0.5, 0f, 0.98f, false, false, 20);
    run("sprint", 0.5, 0, 0.5, 0f, 0.98f, true, false, 20);
    run("jump", 0.5, 0, 0.5, 0f, 0.98f, false, true, 30);
    run("sprint-jump", 0.5, 0, 0.5, 0f, 0.98f, true, true, 30);
    run("standing-jump", 0.5, 0, 0.5, 0f, 0f, false, true, 14);
    run("swim", 110.5, 3.0, -9.5, 0f, 0.98f, false, true, 40);
    run("dive", 110.5, 1.0, -9.5, 0f, 0.98f, false, false, 30);
    run("dive-sprint", 110.5, 1.0, -9.5, 0f, 0.98f, true, false, 20);
    run("ladder", 200.5, 0, 0.5, 180f, 0.98f, false, false, 60);
    run("ladder-slide", 200.5, 8, 0.5, 180f, 0f, false, false, 30);
    run("wade-out", 118.5, 0, 0.5, 270f, 0.98f, false, false, 30);

    // Direct yz.k calls: name, x, y, z, inWater, onGround, sprint, creative, riding, dx, dy, dz
    direct("walk-0.004", 0.5, 0, 0.5, false, true, false, false, false, 0.004, 0, 0);
    direct("walk-0.005", 0.5, 0, 0.5, false, true, false, false, false, 0.005, 0, 0);
    direct("walk-0.0049", 0.5, 0, 0.5, false, true, false, false, false, 0.0049, 0, 0);
    direct("walk-diagonal", 0.5, 0, 0.5, false, true, false, false, false, 0.15, 0.4, -0.15);
    direct("walk-1", 0.5, 0, 0.5, false, true, false, false, false, 1.0, 0, 0);
    direct("sprint-0.2806", 0.5, 0, 0.5, false, true, true, false, false, 0.2806, 0, 0);
    direct("sprint-1", 0.5, 0, 0.5, false, true, true, false, false, 0, 0, 1.0);
    direct("sprint-0.004", 0.5, 0, 0.5, false, true, true, false, false, 0.004, 0, 0);
    direct("air-0.25", 0.5, 5, 0.5, false, false, false, false, false, 0.25, 0.1, 0);
    direct("air-0.2551", 0.5, 5, 0.5, false, false, false, false, false, 0.2551, -0.1, 0);
    direct("air-sprint", 0.5, 5, 0.5, false, false, true, false, false, 0.36, 0.42, 0.1);
    direct("swim", 110.5, 3.0, 0.5, true, false, false, false, false, 0.1, -0.2, 0.05);
    direct("swim-ground", 110.5, 3.0, 0.5, true, true, true, false, false, 0.1, 0, 0);
    direct("swim-vertical", 110.5, 3.0, 0.5, true, false, false, false, false, 0, -0.3, 0);
    direct("dive", 110.5, 1.0, 0.5, true, false, false, false, false, 0.05, -0.1, 0.02);
    direct("dive-not-inwater", 110.5, 1.0, 0.5, false, true, true, false, false, 0.05, -0.1, 0.02);
    direct("dive-vertical", 110.5, 1.0, 0.5, true, false, false, false, false, 0, -0.3, 0);
    direct("ladder-up", 200.5, 2, 0.5, false, false, false, false, false, 0, 0.1176, 0);
    direct("ladder-0.115", 200.5, 2, 0.5, false, false, false, false, false, 0, 0.115, 0);
    direct("ladder-0.125", 200.5, 2, 0.5, false, false, false, false, false, 0.1, 0.125, 0);
    direct("ladder-down", 200.5, 2, 0.5, false, false, false, false, false, 0, -0.15, 0);
    direct("ladder-ground", 200.5, 0, 0.5, false, true, true, false, false, 0.2, 0, 0);
    direct("creative-walk", 0.5, 0, 0.5, false, true, false, true, false, 0.5, 0, 0);
    direct("creative-swim", 110.5, 3.0, 0.5, true, false, false, true, false, 0.5, 0, 0);
    direct("riding", 0.5, 0, 0.5, false, true, true, false, true, 0.5, 0, 0);
    direct("riding-water", 110.5, 1.0, 0.5, true, false, false, false, true, 0.5, 0.2, 0);

    // yz.l: the vehicle classes it tests (EntityMinecart xl via the empty cart, EntityBoat xi, EntityPig wo, EntityHorse wi) and one it does not (a zombie).
    for (Class<?> v : new Class<?>[] { xs.class, xi.class, wo.class, wi.class, yq.class }) {
      mount("mounted", v, 0.3, 0.1, -0.2);
      mount("mounted-0.004", v, 0.004, 0, 0);
    }
  }
}
