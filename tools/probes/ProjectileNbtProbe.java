import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Chunk-save NBT of the in-flight projectiles the browser saves, written and read by the unchanged 1.7.10 classes:
// EntitySnowball (zj), EntityThrowable (zk), EntityEnderPearl (zm), EntityPotion (zo), EntityExpBottle (zn), EntityArrow (zc), plus
// EntityEgg (zl) and the fireballs EntityLargeFireball (zg), EntitySmallFireball (zi) and EntityWitherSkull (zp) for the record.
// Each case builds the entity with its real constructor on the HorseProbe/MobMoveProbe world double, places it with a motion and
// rotation, and writes it with Entity.writeToNBTOptional (sa.c(dh), the call AnvilChunkLoader makes; false when the class has no
// EntityList id). The case then edits named keys of that tag and loads it with EntityList.createEntityFromNBT (sg.a(dh, ahb)).
// One JSON object per line:
//   projectile {kind, id (EntityList string of the entity, null when unregistered), saved (writeToNBTOptional result), loaded,
//               in (the edited tag, hex), nbt (the loaded entity written again, uncompressed hex), x, y, z, mx, my, mz, yaw, pitch, dead}
public class ProjectileNbtProbe {
  static HorseProbe.World W;
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  interface Edit { void apply(dh t) throws Exception; }

  static void place(sa e) throws Exception {
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, 100.5, 64.0, -20.25);
    e.v = 0.25; e.w = -0.5; e.x = 1.0;
    e.y = 37.5f; e.z = -12.25f;
  }

  static void run(String name, sa fresh, Edit edit) throws Exception {
    place(fresh);
    dh t = new dh();
    boolean saved = fresh.c(t);
    StringBuilder s = new StringBuilder("{\"case\":\"projectile\",\"kind\":" + q(name) + ",\"id\":" + q(sg.b(fresh)) + ",\"saved\":" + saved);
    if (!saved) { System.out.println(s.append("}")); return; }
    edit.apply(t);
    sa e = sg.a(t, W);
    if (e == null) { System.out.println(s.append(",\"loaded\":false,\"in\":\"" + MobNbtProbe.hex(t) + "\"}")); return; }
    dh out = new dh();
    e.c(out);
    s.append(",\"loaded\":true,\"in\":\"" + MobNbtProbe.hex(t) + "\",\"nbt\":\"" + MobNbtProbe.hex(out) + "\"");
    s.append(",\"x\":").append(e.s).append(",\"y\":").append(e.t).append(",\"z\":").append(e.u);
    s.append(",\"mx\":").append(e.v).append(",\"my\":").append(e.w).append(",\"mz\":").append(e.x);
    s.append(",\"yaw\":").append(e.y).append(",\"pitch\":").append(e.z).append(",\"dead\":").append(e.K);
    System.out.println(s.append("}"));
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    HorseProbe.World world = (HorseProbe.World) MobNbtProbe.u.allocateInstance(HorseProbe.World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", MobNbtProbe.u.allocateInstance(aqq.class));
    W = world;
    HorseProbe.W = world;
    Edit none = t -> {};
    Edit landed = t -> { t.a("xTile", (short) 101); t.a("yTile", (short) 63); t.a("zTile", (short) -21); t.a("inTile", (byte) 1); t.a("shake", (byte) 3); t.a("inGround", (byte) 1); t.a("ownerName", "Steve"); };

    run("snowball", new zj(W), none);
    run("snowball", new zj(W), landed);
    run("snowball", new zj(W), t -> { t.a("ownerName", ""); t.a("inGround", (byte) 2); t.a("shake", (byte) -5); t.a("inTile", (byte) -1); }); // inGround is (byte == 1)
    run("egg", new zl(W), none);
    run("enderpearl", new zm(W), none);
    run("enderpearl", new zm(W), t -> { t.a("ownerName", "Steve"); });
    run("potion", new zo(W, 100.5, 64.0, -20.25, new add(adb.d(373), 1, 16388)), none);
    run("potion", new zo(W, 100.5, 64.0, -20.25, new add(adb.d(373), 1, 16421)), t -> { t.a("ownerName", "Alex"); t.a("xTile", (short) 5); t.a("inGround", (byte) 1); });
    run("potion", new zo(W, 100.5, 64.0, -20.25, new add(adb.d(373), 1, 16388)), t -> { t.o("Potion"); t.a("potionValue", 16457); }); // the legacy key
    run("potion", new zo(W, 100.5, 64.0, -20.25, new add(adb.d(373), 1, 16388)), t -> { t.o("Potion"); }); // no stack: setDead
    run("expbottle", new zn(W), none);
    run("expbottle", new zn(W), landed);
    run("arrow", new zc(W), none);
    run("arrow", new zc(W), t -> { t.a("xTile", (short) 101); t.a("yTile", (short) 63); t.a("zTile", (short) -21); t.a("life", (short) 400); t.a("inTile", (byte) 1); t.a("inData", (byte) 2); t.a("shake", (byte) 4); t.a("inGround", (byte) 1); t.a("pickup", (byte) 2); t.a("damage", 4.5); });
    run("arrow", new zc(W), t -> { t.a("pickup", (byte) 0); t.a("damage", 2.0); });
    run("arrow", new zc(W), t -> { t.o("pickup"); t.a("player", true); });
    run("arrow", new zc(W), t -> { t.o("pickup"); t.o("damage"); });
    run("fireball", new zg(W, 100.5, 64.0, -20.25, 0.5, -0.25, 1.0), none);
    run("fireball", new zg(W, 100.5, 64.0, -20.25, 0.5, -0.25, 1.0), t -> { t.a("ExplosionPower", 3); t.a("inGround", (byte) 1); t.a("xTile", (short) 9); });
    run("smallfireball", new zi(W, 100.5, 64.0, -20.25, 0.5, -0.25, 1.0), none);
    run("witherskull", new zp(W, 100.5, 64.0, -20.25, 0.5, -0.25, 1.0), none);
  }
}
