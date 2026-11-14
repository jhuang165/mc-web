import java.lang.reflect.*;
import java.util.*;

// b72 riders72: three executed checks on the unchanged 1.7.10 classes.
//   fall   Entity.updateRidden (sa.ab) / EntityLivingBase.updateRidden (sv.ab) / EntityPlayer.updateRidden (yz.ab): the rider's fallDistance (sa.R)
//          after one updateRidden call, on a dead mount (sa.ab returns early) and on a live mount (the rider's whole onUpdate runs).
//   jockey EntityZombie.onSpawnWithEgg (yq.a(sy)) child path with a ys group (baby) and a world Random whose first draw is 0.01: which of the
//          chickens in real Chunk lists (World.getEntitiesWithinAABB, selector sj.b) the zombie mounts, as a function of chunk, slice and insertion.
//   ride   Entity.moveEntity (sa.d) of an EntityPlayerSP with ridingEntity (sa.m) set: the step block (func_145780_a) and distanceWalkedModified (sa.P)
//          and distanceWalkedOnStepModified (sa.Q) with and without a mount.
// tools/verify-riders72.mjs writes public/research/riders72-reference.json; src/riders72-b72.test.js replays it.
public class RidersProbe {
  static String num(double v) { return Double.toString(v); }
  static String q(String s) { return "\"" + s + "\""; }
  static Object get(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }

  static class ScriptRandom extends Random {
    boolean first = true;
    ScriptRandom() { super(5); }
    public float nextFloat() { if (first) { first = false; return 0.01f; } return super.nextFloat(); }
  }

  static sv chicken(WitherRound3Probe.W w, double x, double y, double z) throws Exception {
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    sv e = (sv) u.allocateInstance(wg.class);
    MobMoveProbe.set(e, "o", w);
    MobMoveProbe.set(e, "Z", new Random(1));
    MobMoveProbe.set(e, "C", azt.a(0, 0, 0, 0, 0, 0));
    te watcher = new te(e);
    MobMoveProbe.set(e, "af", watcher);
    watcher.a(0, Byte.valueOf((byte) 0));
    watcher.a(1, Short.valueOf((short) 300));
    MobMoveProbe.method(wg.class, "c").invoke(e);
    MobMoveProbe.field(sv.class, "f").set(e, new HashMap());
    MobMoveProbe.set(e, "J", true);
    MobMoveProbe.set(e, "M", 0.3f);
    MobMoveProbe.set(e, "N", 0.7f);
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    MobMoveProbe.method(wg.class, "aD").invoke(e);
    return e;
  }

  static void jockey(String name, double[][] chickens, int[] ridden, double zx, double zy, double zz) throws Exception {
    WitherRound3Probe.W w = WitherRound3Probe.world(7);
    MobMoveProbe.set(w, "r", rd.c);
    MobMoveProbe.set(w, "s", new ScriptRandom());
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    sv z = MobMoveProbe.spawn(u, w, "zombie", zx, zy, zz, 0f);
    for (Class<?> c = z.getClass(); c != sa.class; c = c.getSuperclass()) for (Field f : c.getDeclaredFields()) if (f.getType().isArray() && !Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); if (f.get(z) == null) f.set(z, Array.newInstance(f.getType().getComponentType(), 5)); }
    MobMoveProbe.set(z, "bv", 0.6f); MobMoveProbe.set(z, "bw", 1.8f); // EntityZombie.field_146074_bv/bw: the base size setChildSize scales (the constructor sets them)
    List<sv> cs = new ArrayList<>();
    for (double[] c : chickens) { sv e = chicken(w, c[0], c[1], c[2]); cs.add(e); WitherRound3Probe.addToChunk(w, e); }
    for (int i : ridden) { sv rider = MobMoveProbe.spawn(u, w, "pig", 500, 5, 500, 0f); MobMoveProbe.set(cs.get(i), "l", rider); }
    Constructor<?> k = null; for (Constructor<?> c : ys.class.getDeclaredConstructors()) if (c.getParameterCount() == 4) k = c; k.setAccessible(true);
    String err = null;
    try { MobMoveProbe.method(yq.class, "a", sy.class).invoke(z, k.newInstance(z, true, false, null)); }
    catch (InvocationTargetException ex) { err = ex.getCause().toString(); }
    int picked = -1;
    for (int i = 0; i < cs.size(); i++) if (((wg) cs.get(i)).bv) picked = i;
    Object mount = MobMoveProbe.field(sa.class, "m").get(z);
    int mountedIdx = -1; for (int i = 0; i < cs.size(); i++) if (cs.get(i) == mount) mountedIdx = i; // Entity.equals compares ids (all 0 here)
    StringBuilder cj = new StringBuilder();
    for (int i = 0; i < chickens.length; i++) cj.append(i > 0 ? "," : "").append("[").append(num(chickens[i][0])).append(",").append(num(chickens[i][1])).append(",").append(num(chickens[i][2])).append("]");
    System.out.println("{\"case\":\"jockey\",\"name\":" + q(name) + ",\"zombie\":[" + num(zx) + "," + num(zy) + "," + num(zz) + "],\"chickens\":[" + cj + "],\"ridden\":" + Arrays.toString(ridden)
      + ",\"jockey\":" + picked + ",\"mounted\":" + mountedIdx + (err == null ? "" : ",\"error\":" + q(err.replace('"', '\''))) + "}");
  }

  static void fall(String name, String rider, boolean liveMount, float r0) throws Exception {
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    String err = null; float after = Float.NaN; boolean linked = false;
    try {
      sv e; sv mount;
      if (rider.equals("player")) {
        PlantProbe.unsafe = u;
        PlantProbe.W pw = PlantProbe.world((x, y, z) -> new int[] {y < 0 ? 1 : 0, 0});
        e = PlayerStepProbe.spawn(u, pw, 64.5, 64.5, 0f, false, true, 0f);
        mount = MobMoveProbe.spawn(u, pw, "pig", 64.5, 1, 64.5, 0f);
        MobMoveProbe.set(e, "N", 1.8f);
      } else {
        WitherRound3Probe.W w = WitherRound3Probe.world(7);
        MobMoveProbe.set(w, "r", rd.c);
        e = MobMoveProbe.spawn(u, w, "zombie", 0.5, 70, 0.5, 0f);
        mount = rider.equals("zombie_on_chicken") ? chicken(w, 0.5, 70, 0.5) : MobMoveProbe.spawn(u, w, "pig", 0.5, 70, 0.5, 0f);
      }
      MobMoveProbe.set(e, "m", mount);
      MobMoveProbe.set(mount, "l", e);
      MobMoveProbe.set(mount, "K", !liveMount);
      MobMoveProbe.set(e, "R", r0);
      MobMoveProbe.method(sa.class, "ab").invoke(e);
      after = MobMoveProbe.field(sa.class, "R").getFloat(e);
      linked = MobMoveProbe.field(sa.class, "m").get(e) != null;
    } catch (InvocationTargetException ex) { err = ex.getCause().toString(); }
    System.out.println("{\"case\":\"fall\",\"name\":" + q(name) + ",\"rider\":" + q(rider) + ",\"liveMount\":" + liveMount + ",\"before\":" + Float.toString(r0)
      + ",\"after\":" + (Float.isNaN(after) ? "null" : Float.toString(after)) + ",\"linked\":" + linked + (err == null ? "" : ",\"error\":" + q(err.replace('"', '\''))) + "}");
  }

  static String logged;
  static class Rec extends blk {
    Rec() { super(null, null, null, 0); }
    protected void a(int x, int y, int z, aji b) { logged = "{\"x\":" + x + ",\"y\":" + y + ",\"z\":" + z + ",\"block\":" + aji.b(b) + "}"; }
  }

  static Object[][] BLOCKS = {{"stone", 1, 0}, {"fence", 85, 0}, {"ladder", 65, 2}, {"slab", 44, 0}, {"air", 0, 0}, {"water", 9, 0}, {"vine", 106, 0}};

  static void ride() throws Exception {
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    Method move = PlayerStepProbe.method(sa.class, "d", double.class, double.class, double.class);
    Method place = PlayerStepProbe.method(sa.class, "b", double.class, double.class, double.class);
    for (Object[] up : BLOCKS) for (Object[] lo : new Object[][] {{"stone", 1, 0}, {"air", 0, 0}}) for (boolean riding : new boolean[] {false, true}) for (String kind : new String[] {"step", "dist"}) {
      double feet = 1.0; int cy = (int) Math.floor(feet - 0.2);
      PlantProbe.unsafe = u;
      PlantProbe.W w = PlantProbe.world((x, y, z) -> new int[] {y < -3 ? 1 : 0, 0});
      for (int y = -3; y < cy - 1; y++) w.put(64, y, 64, 1, 0);
      w.put(64, cy - 1, 64, (Integer) lo[1], (Integer) lo[2]);
      w.put(64, cy, 64, (Integer) up[1], (Integer) up[2]);
      Rec e = (Rec) PlayerStepProbe.spawn(u, w, Rec.class, 64.5, 64.5, 0f, false, false, 0f);
      PlayerStepProbe.field(sa.class, "L").setFloat(e, 1.62f);
      place.invoke(e, 64.5, feet + 1.62, 64.5);
      if (riding) PlayerStepProbe.field(sa.class, "m").set(e, MobMoveProbe.spawn(u, w, "pig", 64.5, 5, 64.5, 0f));
      boolean dist = kind.equals("dist");
      PlayerStepProbe.field(sa.class, "Q").setFloat(e, dist ? 0f : 5f);
      PlayerStepProbe.field(sa.class, "P").setFloat(e, 0f);
      PlayerStepProbe.field(sa.class, "d").setInt(e, dist ? 100 : 1);
      logged = null;
      move.invoke(e, 0.001, dist ? 0.25 : -0.01, 0.001);
      System.out.println("{\"case\":\"ride\",\"upper\":" + q((String) up[0]) + ",\"lower\":" + q((String) lo[0]) + ",\"riding\":" + riding + ",\"kind\":" + q(kind)
        + ",\"q\":" + Float.toString(PlayerStepProbe.field(sa.class, "Q").getFloat(e)) + ",\"p\":" + Float.toString(PlayerStepProbe.field(sa.class, "P").getFloat(e))
        + ",\"next\":" + PlayerStepProbe.field(sa.class, "d").getInt(e) + ",\"step\":" + (logged == null ? "null" : logged) + "}");
    }
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    ride();
    for (String r : new String[] {"zombie", "zombie_on_chicken", "player"}) for (boolean live : new boolean[] {false, true}) fall("fall-" + r + (live ? "-live" : "-dead"), r, live, 5f);
    // chickens: [x, y, z]. zombie at (1, 80, 1): box x -4..6 (chunks -1, 0), z -4..6, y 77..85.
    jockey("insertion-order", new double[][] {{2, 79, 2}, {3, 79, 3}}, new int[] {}, 1, 80, 1);
    jockey("chunk-x-before-insertion", new double[][] {{2, 79, 2}, {-3, 79, 2}}, new int[] {}, 1, 80, 1);
    jockey("chunk-z-before-insertion", new double[][] {{2, 79, 2}, {2, 79, -3}}, new int[] {}, 1, 80, 1);
    jockey("chunk-x-outer-z-inner", new double[][] {{2, 79, -3}, {-3, 79, 2}}, new int[] {}, 1, 80, 1);
    jockey("slice-before-insertion", new double[][] {{2, 83, 2}, {3, 78, 3}}, new int[] {}, 1, 80, 1);
    jockey("slice-after-chunk", new double[][] {{2, 78, 2}, {-3, 83, 2}}, new int[] {}, 1, 80, 1);
    jockey("ridden-skipped", new double[][] {{-3, 79, 2}, {2, 79, 2}}, new int[] {0}, 1, 80, 1);
    // the child's box keeps its min corner (Entity.setSize): x 0.7..1.0, z 0.7..1.0, y 80..80.9; the query box is that grown by 5, 3, 5
    jockey("child-box-east", new double[][] {{6.25, 79, 2}}, new int[] {}, 1, 80, 1);
    jockey("child-box-west", new double[][] {{-4.2, 79, 2}}, new int[] {}, 1, 80, 1);
    jockey("child-box-south", new double[][] {{2, 79, 6.25}}, new int[] {}, 1, 80, 1);
    jockey("child-box-north", new double[][] {{2, 79, -4.2}}, new int[] {}, 1, 80, 1);
    jockey("out-of-box", new double[][] {{9, 79, 2}, {2, 90, 2}}, new int[] {}, 1, 80, 1);
  }
}
