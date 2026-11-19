import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 82 mpball82. A large fireball (zg), a small one (zi) and a wither skull (zp), dispenser form (no shooter), ticked whole by Entity.onUpdate
// (ze.h) on the unchanged 1.7.10 classes in FireballProbe's world double, flying through a water pool and then a stone wall. Run once on a
// server world (World.isRemote false) and once on a remote one (isRemote true, as the client's copy). Per tick after the update: posX, posY,
// posZ, motion, rotationYaw, rotationPitch, the fire counter, the watched flag 0 (burning), velocityChanged (then cleared, as the tracker's tail
// does), isInWater, isBurning, isDead. Prints one JSON line per run.
public class BallFlagProbe {
  static String num(double v) { return Double.toString(v); }
  static Field fld(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }

  static void run(String name, boolean remote, int kind) throws Exception {
    ahb w = VillageLiveProbe.world;
    MobMoveProbe.ProbeWorld.water = true;
    // pool x 30..40 (y 0..6), stone wall at x 50..51
    for (int x = 30; x <= 40; x++) for (int y = 0; y <= 6; y++) for (int z = 0; z <= 6; z++) VillageLiveProbe.put(x, y, z, 9, 0);
    for (int x = 50; x <= 51; x++) for (int y = 0; y <= 6; y++) for (int z = 0; z <= 6; z++) VillageLiveProbe.put(x, y, z, 1, 0);
    fld(ahb.class, "E").setBoolean(w, remote);
    SeedRandom.next = 7000000L;
    sa f = kind == 0 ? new zg(w, 26.5, 2.5, 3.5, 0.1, 0, 0) : kind == 1 ? new zi(w, 26.5, 2.5, 3.5, 0.1, 0, 0) : new zp(w, 26.5, 2.5, 3.5, 0.1, 0, 0);
    VillagerProbe.World.entities.add(f);
    Method flag = MobMoveProbe.method(sa.class, "g", int.class);
    Field fire = fld(sa.class, "e"), changed = fld(sa.class, "H");
    List<String> rows = new ArrayList<>();
    for (int t = 0; t < 60; t++) {
      f.aa++;
      f.h();
      boolean vc = changed.getBoolean(f);
      changed.setBoolean(f, false);
      rows.add("[" + num(f.s) + "," + num(f.t) + "," + num(f.u) + "," + num(f.v) + "," + num(f.w) + "," + num(f.x) + "," + num(f.y) + "," + num(f.z) + "," + fire.getInt(f) + ","
        + ((Boolean) flag.invoke(f, 0) ? 1 : 0) + "," + (vc ? 1 : 0) + "," + (f.M() ? 1 : 0) + "," + (f.al() ? 1 : 0) + "," + (f.K ? 1 : 0) + "]");
      if (f.K) break;
    }
    fld(ahb.class, "E").setBoolean(w, false);
    System.out.println("{\"name\":\"" + name + "\",\"remote\":" + remote + ",\"kind\":" + kind + ",\"rows\":[" + String.join(",", rows) + "]}");
    VillagerProbe.reset();
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    VillagerProbe.World.pickEntities = true;
    MobMoveProbe.ProbeWorld.exact = true;
    VillagerProbe.World.realRays = true;
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    ArmorEnchantmentProbe.U = u;
    FireballProbe.FW w = (FireballProbe.FW) u.allocateInstance(FireballProbe.FW.class);
    VillageLiveProbe.world = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    MobMoveProbe.set(info, "x", new agy());
    MobMoveProbe.set(w, "x", info);
    MobMoveProbe.set(w, "r", rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new bac()); }
    VillagerProbe.World.light = 15;
    for (int kind = 0; kind < 3; kind++) for (int r = 0; r < 2; r++) run(new String[] {"large", "small", "skull"}[kind] + (r == 1 ? "-remote" : "-server"), r == 1, kind);
  }
}
