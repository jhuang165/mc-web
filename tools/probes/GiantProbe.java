import java.lang.reflect.Field;
import java.util.*;

// Runs the unchanged EntityGiantZombie (ye) on SilverfishProbe's constructor-less World double: the constructor's
// 6x size, the attributes, sounds, getBlockPathWeight at each light level, EntityMob.attackEntity (yg.a(sa, F)) over
// a grid of distances, attack timers and target heights, the experience value and the drop item. Also reads the
// RenderManager registration (bnu: ModelZombie bip, shadowSize 0.5, scale 6.0) from the class files via javap in
// tools/verify-giant.mjs. Nothing is patched.
public class GiantProbe {
  public static class G extends ye {
    int hits;
    G(ahb w) { super(w); }
    public boolean n(sa target) { hits++; return true; }
    void attack(sa t, float d) { a(t, d); }
  }
  static String q(String s) { return s == null ? "null" : "\"" + s + "\""; }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    SilverfishProbe.u = u;
    SilverfishProbe.FishWorld w = (SilverfishProbe.FishWorld) u.allocateInstance(SilverfishProbe.FishWorld.class);
    SilverfishProbe.w = w; DifficultyProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    aqq provider = new aqq();
    java.lang.reflect.Method gen = aqo.class.getDeclaredMethod("a"); gen.setAccessible(true); gen.invoke(provider);
    MobMoveProbe.set(w, "t", provider);
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    SilverfishProbe.fd(ays.class, "g").setLong(info, 1);
    SilverfishProbe.fd(ays.class, "x").set(info, new agy());
    SilverfishProbe.fd(ahb.class, "x").set(w, info);
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    SilverfishProbe.fd(ahb.class, "J").set(w, date);
    SilverfishProbe.fd(ahb.class, "r").set(w, rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class) { f.setAccessible(true); f.set(w, new bac()); }
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);

    MobMoveProbe.set(w, "E", false);
    SilverfishProbe.reset();
    G e = new G(w);
    MobMoveProbe.set(e, "Z", new MobSpawnerProbe.Lcg(1));
    e.b(0.5, 0, 0.5);
    System.out.println("{\"case\":\"facts\",\"width\":" + e.M + ",\"height\":" + e.N + ",\"yOffset\":" + e.L + ",\"health\":" + e.a(yj.a).e() + ",\"speed\":" + e.a(yj.d).e()
      + ",\"damage\":" + e.a(yj.e).e() + ",\"followRange\":" + e.a(yj.b).e() + ",\"knockbackResistance\":" + e.a(yj.c).e()
      + ",\"say\":" + q(e.t()) + ",\"hit\":" + q(e.aT()) + ",\"kill\":" + q(e.aU()) + ",\"canTriggerWalking\":" + e.g_()
      + ",\"dropItem\":" + adb.b(e.u()) + ",\"experience\":" + SilverfishProbe.fd(sw.class, "b").getInt(e) + ",\"aiEnabled\":" + e.bk()
      + ",\"fallSmall\":" + q(e.o(3)) + ",\"fallBig\":" + q(e.o(5)) + ",\"creature\":" + ((Object) e instanceof td) + ",\"zombie\":" + ((Object) e instanceof yq) + "}");
    for (int light = 0; light <= 15; light += 5) {
      DifficultyProbe.World.light = light;
      System.out.println("{\"case\":\"pathWeight\",\"light\":" + light + ",\"weight\":" + e.a(0, 0, 0) + "}");
    }
    // EntityMob.attackEntity over distance, attack timer and the target's vertical box.
    for (int aB : new int[] { 0, 1 }) for (float d : new float[] { 1.9f, 1.999f, 2.0f, 2.1f }) for (double ty : new double[] { -2, -0.8, -0.9, 0, 10.7, 10.8, 11 }) {
      G g = new G(w);
      MobMoveProbe.set(g, "Z", new MobSpawnerProbe.Lcg(1));
      g.b(0.5, 0, 0.5);
      g.aB = aB;
      SilverfishProbe.Target t = new SilverfishProbe.Target(w);
      t.b(0.5, ty, 0.5);
      g.attack(t, d);
      System.out.println("{\"case\":\"attack\",\"attackTime\":" + aB + ",\"distance\":" + d + ",\"targetMinY\":" + t.C.b + ",\"targetMaxY\":" + t.C.e + ",\"hit\":" + (g.hits > 0) + ",\"after\":" + g.aB + "}");
    }
  }
}
