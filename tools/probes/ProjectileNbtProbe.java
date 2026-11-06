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

  // Private fields read by reflection, as a JSON object: {"name": value}. `names` are obfuscated field names of the entity or a superclass;
  // "ze.e" reads field e declared in EntityFireball itself (EntityLargeFireball hides it with its own public e).
  static String fields(sa e, String... names) throws Exception {
    StringBuilder s = new StringBuilder("{");
    for (int i = 0; i < names.length; i++) {
      boolean base = names[i].startsWith("ze.");
      String n = base ? names[i].substring(3) : names[i];
      Object v = MobMoveProbe.field(base ? ze.class : e.getClass(), n).get(e);
      s.append(i > 0 ? "," : "").append(q(names[i])).append(":").append(v instanceof String ? q((String) v) : String.valueOf(v));
    }
    return s.append("}").toString();
  }
  interface Fields { String of(sa e) throws Exception; }
  static final Fields NO_FIELDS = e -> null;
  // EntityFireball: acceleration (b, c, d), xTile/yTile/zTile (ze.e, ze.f, ze.g) and inGround (i); EntityLargeFireball adds ExplosionPower (zg.e).
  static final Fields FIREBALL_FIELDS = e -> e instanceof zg ? fields(e, "b", "c", "d", "ze.e", "ze.f", "ze.g", "i", "e") : fields(e, "b", "c", "d", "ze.e", "ze.f", "ze.g", "i");

  static void run(String name, sa fresh, Edit edit) throws Exception { run(name, fresh, edit, NO_FIELDS); }
  // `fields` is also written for the entity before it is saved ("srcFields") and for the loaded copy ("fields").
  static void run(String name, sa fresh, Edit edit, Fields fields) throws Exception {
    place(fresh);
    dh t = new dh();
    boolean saved = fresh.c(t);
    StringBuilder s = new StringBuilder("{\"case\":\"projectile\",\"kind\":" + q(name) + ",\"id\":" + q(sg.b(fresh)) + ",\"saved\":" + saved);
    if (!saved) { System.out.println(s.append("}")); return; }
    String before = fields.of(fresh);
    if (before != null) s.append(",\"srcFields\":").append(before);
    edit.apply(t);
    sa e = sg.a(t, W);
    if (e == null) { System.out.println(s.append(",\"loaded\":false,\"in\":\"" + MobNbtProbe.hex(t) + "\"}")); return; }
    dh out = new dh();
    e.c(out);
    s.append(",\"loaded\":true,\"in\":\"" + MobNbtProbe.hex(t) + "\",\"nbt\":\"" + MobNbtProbe.hex(out) + "\"");
    s.append(",\"x\":").append(e.s).append(",\"y\":").append(e.t).append(",\"z\":").append(e.u);
    s.append(",\"mx\":").append(e.v).append(",\"my\":").append(e.w).append(",\"mz\":").append(e.x);
    s.append(",\"yaw\":").append(e.y).append(",\"pitch\":").append(e.z).append(",\"dead\":").append(e.K);
    String after = fields.of(e);
    if (after != null) s.append(",\"fields\":").append(after);
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
    run("fireball", new zg(W, 100.5, 64.0, -20.25, 0.5, -0.25, 1.0), none, FIREBALL_FIELDS);
    run("fireball", new zg(W, 100.5, 64.0, -20.25, 0.5, -0.25, 1.0), t -> { t.a("ExplosionPower", 3); t.a("inGround", (byte) 1); t.a("xTile", (short) 9); }, FIREBALL_FIELDS);
    run("fireball", new zg(W, 100.5, 64.0, -20.25, 0.5, -0.25, 1.0), t -> { t.o("direction"); }, FIREBALL_FIELDS); // no direction list: setDead
    run("fireball", new zg(W, 100.5, 64.0, -20.25, 0.5, -0.25, 1.0), t -> { t.a("ExplosionPower", "x"); }, FIREBALL_FIELDS); // a non-numeric power keeps 1
    run("smallfireball", new zi(W, 100.5, 64.0, -20.25, 0.5, -0.25, 1.0), none, FIREBALL_FIELDS);
    run("witherskull", new zp(W, 100.5, 64.0, -20.25, 0.5, -0.25, 1.0), none, FIREBALL_FIELDS);
    zp blue = new zp(W, 100.5, 64.0, -20.25, 0.5, -0.25, 1.0);
    blue.a(true);
    run("witherskull-dangerous", blue, none, e -> "{\"dangerous\":" + ((zp) e).f() + "}"); // the data watcher flag is not saved
    // EntityEnderEye: constructor (world, x, y, z); moveTowards (a(x, int y, z)) sets the target and the shatter/drop flag. Neither is saved.
    Fields eye = e -> fields(e, "a", "b", "c", "d", "e");
    zd moved = new zd(W, 100.5, 64.0, -20.25);
    moved.a(500.0, 70, 700.0);
    run("eye", moved, none, eye);
    run("eye", new zd(W), none, eye);
    // EntityFireworkRocket: Life (a), LifeTime (b) and the FireworksItem stack of the data watcher (index 8).
    dh explosion = new dh();
    explosion.a("Type", (byte) 1); explosion.a("Colors", new int[] { 11743532, 2437522 }); explosion.a("FadeColors", new int[] { 3949738 }); explosion.a("Flicker", (byte) 1); explosion.a("Trail", (byte) 0);
    dq explosions = new dq();
    explosions.a(explosion);
    dh fw = new dh();
    fw.a("Flight", (byte) 2); fw.a("Explosions", explosions);
    dh rootTag = new dh();
    rootTag.a("Fireworks", fw);
    add rocket = new add(adb.d(401), 1, 0);
    rocket.d(rootTag);
    Fields life = e -> fields(e, "a", "b");
    run("rocket", new zf(W, 100.5, 64.0, -20.25, rocket), none, life);
    run("rocket", new zf(W, 100.5, 64.0, -20.25, rocket), t -> { t.a("Life", 7); t.a("LifeTime", 25); }, life);
    run("rocket", new zf(W, 100.5, 64.0, -20.25, rocket), t -> { t.o("FireworksItem"); }, life);
    run("rocket", new zf(W, 100.5, 64.0, -20.25, new add(adb.d(401), 1, 0)), none, life); // a bare rocket (no Fireworks tag)
    run("rocket", new zf(W), none, life); // the world-only constructor: no FireworksItem is written
  }
}
