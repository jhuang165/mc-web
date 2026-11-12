import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 51 `b51ft`: the full onUpdate (h()) of the unchanged EntityGhast (yd) and EntityDragon (xa) of the 1.7.10 JAR, so the legacy body turn
// (EntityLivingBase.func_110146_f, sv.f(FF)) runs after the action state exactly as in the game. One JSON object per line:
//   ghastTurn   yd.h() per tick on the BlazeGhastProbe world double: position, motion, rotationYaw, pitch, renderYawOffset, rotationYawHead (+ prev values)
//   dragonTurn  xa.h() per tick on the DragonProbe End world double: same fields
// Motion for the ghast is the real sr.e(FF) (EntityFlying.moveEntityWithHeading), over the probe floor (stone below y 0).
public class FlyTurnProbe {
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static float fl(Object o, String n) throws Exception { return MobMoveProbe.fl(o, n); }
  static double d(Object o, String n) throws Exception { return MobMoveProbe.d(o, n); }

  // [x, y, z, vx, vy, vz, rotationYaw, pitch, prevYaw, prevPitch, renderYawOffset, prevRenderYawOffset, rotationYawHead, prevRotationYawHead]
  static String row(sa e) throws Exception {
    return "[" + num(d(e, "s")) + "," + num(d(e, "t")) + "," + num(d(e, "u")) + "," + num(d(e, "v")) + "," + num(d(e, "w")) + "," + num(d(e, "x"))
      + "," + num(fl(e, "y")) + "," + num(fl(e, "z")) + "," + num(fl(e, "A")) + "," + num(fl(e, "B"))
      + "," + num(fl(e, "aM")) + "," + num(fl(e, "aN")) + "," + num(fl(e, "aO")) + "," + num(fl(e, "aP")) + "]";
  }
  static void head(String kind, String name, long seed, float yaw, double[] rel) {
    System.out.println("{\"case\":\"" + kind + "Start\",\"name\":\"" + name + "\",\"seed\":" + seed + ",\"yaw\":" + num(yaw) + ",\"rel\":" + java.util.Arrays.toString(rel) + "}");
  }

  static BlazeGhastProbe.World ghastWorld() throws Exception {
    BlazeGhastProbe.World w = (BlazeGhastProbe.World) BlazeGhastProbe.u.allocateInstance(BlazeGhastProbe.World.class);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", BlazeGhastProbe.u.allocateInstance(aqq.class));
    Object info = BlazeGhastProbe.u.allocateInstance(ays.class);
    for (java.lang.reflect.Field f : ays.class.getDeclaredFields())
      if (f.getType() == agy.class) { f.setAccessible(true); f.set(info, new agy()); }
    MobMoveProbe.set(w, "x", info);
    MobMoveProbe.set(w, "r", rd.c);
    WolfProbe.W = null;
    return w;
  }

  public static void main(String[] args) throws Exception {
    java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    TerrainProbe.unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();
    adb.l();
    BlazeGhastProbe.World w = ghastWorld();
    // name, seed, player at (x, y, z) relative to the ghast at (64.5, 40, 64.5), -1 = none; the player is dropped at tick 150 and returns at 200
    Object[][] ghasts = {
      {"wander", 11L, null}, {"wander-b", 2024L, null}, {"wander-c", 77L, null},
      {"player-east", 11L, new double[] { 20, 0, 0 }}, {"player-north", 5L, new double[] { 0, 3, -18 }}, {"player-near", 2024L, new double[] { 4, 10, 6 }},
    };
    for (Object[] g : ghasts) {
      long seed = (Long) g[1];
      double[] rel = (double[]) g[2];
      BlazeGhastProbe.World.spawned.clear(); BlazeGhastProbe.World.aux.clear();
      yd e = BlazeGhastProbe.ghast(w, seed, 64.5, 40, 64.5);
      yz pl = rel == null ? null : BlazeGhastProbe.player(w, 64.5 + rel[0], 40 + rel[1], 64.5 + rel[2], 0, 0);
      if (pl != null) MobMoveProbe.set(pl, "C", azt.a(64.5 + rel[0] - 0.3, 40 + rel[1], 64.5 + rel[2] - 0.3, 64.5 + rel[0] + 0.3, 40 + rel[1] + 1.8, 64.5 + rel[2] + 0.3));
      head("ghastTurn", (String) g[0], seed, 0f, rel == null ? new double[0] : rel);
      BlazeGhastProbe.World.player = pl;
      for (int tick = 1; tick <= 240; tick++) {
        BlazeGhastProbe.World.spawned.clear(); BlazeGhastProbe.World.aux.clear();
        if (pl != null) { boolean gone = tick > 150 && tick <= 200; pl.K = gone; BlazeGhastProbe.World.player = gone ? null : pl; } // dead: the ghast drops its target at once (yd.bq)
        e.aa++;
        e.h();
        System.out.println("{\"case\":\"ghastTurn\",\"name\":\"" + g[0] + "\",\"tick\":" + tick + ",\"row\":" + row(e) + ",\"charging\":" + e.bP() + ",\"fireballs\":" + BlazeGhastProbe.World.spawned.size() + "}");
      }
    }
    BlazeGhastProbe.World.player = null;

    Object[][] dragons = {
      {"circle-a", 1L, 0f, null}, {"circle-b", 20260101L, 123.5f, null}, {"circle-c", -7L, -90f, null},
      {"player-near", 5L, 40f, new double[] { 12, 70, 8 }}, {"player-far", 8L, 200f, new double[] { -40, 64, 35 }},
    };
    for (Object[] g : dragons) {
      DragonProbe.DW dw = DragonProbe.world();
      xa dr = DragonProbe.dragon(dw, 0, 128, 0, (Float) g[2], (Long) g[1]);
      for (String n : new String[] { "aM", "aN", "aO", "aP" }) MobMoveProbe.set(dr, n, 0.0F); // the constructor rolls Math.random() angles; start from zero
      head("dragonTurn", (String) g[0], (Long) g[1], (Float) g[2], g[3] == null ? new double[0] : (double[]) g[3]);
      if (g[3] != null) {
        double[] p = (double[]) g[3];
        yz pl = DragonProbe.player(dw, p[0], p[1], p[2]);
        ((List) DragonProbe.fd(ahb.class, "h").get(dw)).add(pl);
      }
      dw.clear();
      for (int tick = 1; tick <= 240; tick++) {
        dr.aa++;
        dr.h();
        System.out.println("{\"case\":\"dragonTurn\",\"name\":\"" + g[0] + "\",\"tick\":" + tick + ",\"row\":" + row(dr) + "}");
      }
    }
  }
}
