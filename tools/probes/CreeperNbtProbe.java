import java.util.*;

// EntityCreeper (xz) Fuse / ExplosionRadius, read from chunk NBT by EntityList.createEntityFromNBT (sg.a(dh, ahb)) and then
// run through EntityCreeper.onUpdate (xz.h), getCreeperFlashIntensity (xz.a(F)), fall (xz.b(F)) and the explosion (xz.ce) on the
// CreeperProbe world double. Each case builds a creeper, saves it with Entity.writeToNBTOptional (sa.c), edits named keys, loads it,
// and records the loaded creeper's own NBT plus its behaviour with the swell state held at 1 (what EntityAICreeperSwell does).
// One JSON object per line: {case:"creeperNbt", name, fuse (br), radius (bs), powered, ignited, nbt, explodedAt, explosion
// [x,y,z,size,smoking] or null, ticks [[t, flash0, flash5]...], falls [[start, distance, t]...]}.
public class CreeperNbtProbe {
  interface Edit { void apply(dh t) throws Exception; }
  static CreeperProbe.World w;
  static int geti(xz e, String f) throws Exception { return MobMoveProbe.field(xz.class, f).getInt(e); }
  static xz load(Edit edit) throws Exception {
    xz fresh = new xz(w);
    fresh.b(0.5, 0.0, 0.5);
    dh t = new dh();
    if (!fresh.c(t)) throw new IllegalStateException("not saved");
    edit.apply(t);
    sa e = sg.a(t, w);
    if (!(e instanceof xz)) throw new IllegalStateException("not loaded");
    ChickenProbe.clearTasks((xz) e);
    MobMoveProbe.set(e, "Z", new Random(5));
    return (xz) e;
  }
  static void run(String name, Edit edit) throws Exception {
    CreeperProbe.World.sounds.clear(); CreeperProbe.World.spawned.clear(); CreeperProbe.World.entities.clear(); CreeperProbe.World.explosions.clear();
    CreeperProbe.World.blocks.clear(); CreeperProbe.World.runExplosions = false; MobMoveProbe.step = 0;
    xz e = load(edit);
    dh out = new dh();
    e.c(out);
    StringBuilder s = new StringBuilder("{\"case\":\"creeperNbt\",\"name\":\"" + name + "\",\"fuse\":" + geti(e, "br") + ",\"radius\":" + geti(e, "bs")
      + ",\"powered\":" + e.bZ() + ",\"ignited\":" + e.cc() + ",\"nbt\":\"" + MobNbtProbe.hex(out) + "\"");
    StringBuilder ticks = new StringBuilder();
    int explodedAt = -1;
    for (int i = 0; i < 80 && explodedAt < 0; i++) {
      e.a(1);
      e.h();
      if (!CreeperProbe.World.explosions.isEmpty()) explodedAt = i;
      if (ticks.length() > 0) ticks.append(',');
      ticks.append("[" + geti(e, "bq") + "," + e.a(0f) + "," + e.a(0.5f) + "]");
    }
    double[] x = CreeperProbe.World.explosions.isEmpty() ? null : CreeperProbe.World.explosions.get(0);
    s.append(",\"explodedAt\":").append(explodedAt).append(",\"explosion\":")
      .append(x == null ? "null" : "[" + x[0] + "," + x[1] + "," + x[2] + "," + (float) x[3] + "," + (x[5] > 0) + "]").append(",\"ticks\":[").append(ticks).append("]");
    StringBuilder falls = new StringBuilder();
    for (int start : new int[] {0, 10, 20, 28}) for (float dist : new float[] {0f, 3.4f, 20f}) {
      xz f = load(edit);
      MobMoveProbe.field(xz.class, "bq").setInt(f, start);
      MobMoveProbe.method(xz.class, "b", float.class).invoke(f, dist);
      if (falls.length() > 0) falls.append(',');
      falls.append("[" + start + "," + dist + "," + geti(f, "bq") + "]");
    }
    System.out.println(s.append(",\"falls\":[").append(falls).append("]}"));
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    w = (CreeperProbe.World) u.allocateInstance(CreeperProbe.World.class);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    run("default", t -> {});
    run("fuse20-radius5", t -> { t.a("Fuse", (short) 20); t.a("ExplosionRadius", (byte) 5); });
    run("powered-fuse10-radius4", t -> { t.a("powered", true); t.a("Fuse", (short) 10); t.a("ExplosionRadius", (byte) 4); });
    run("ignited-fuse5", t -> { t.a("ignited", true); t.a("Fuse", (short) 5); });
    run("int-typed", t -> { t.a("Fuse", 40); t.a("ExplosionRadius", 2); });
    run("string-ignored", t -> { t.a("Fuse", "7"); t.a("ExplosionRadius", "9"); });
    run("fuse0", t -> { t.a("Fuse", (short) 0); });
    run("negative-radius", t -> { t.a("ExplosionRadius", (byte) -3); t.a("powered", true); });
    run("wide-radius", t -> { t.a("Fuse", 70000); t.a("ExplosionRadius", 200); t.a("powered", true); });
  }
}
