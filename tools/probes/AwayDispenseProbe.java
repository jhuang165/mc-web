import java.lang.reflect.*;
import java.util.*;

// Batch 51 (tag b51ad): runs the unchanged 1.7.10 dispenser behaviours the earlier DispenseProbe did not cover, through
// DispenseProbe's constructor-less World double. BehaviorDispenseSpawnEgg (kx): ItemMonsterPlacer.spawnCreature at
// (cx + facing x, int y + 0.2F, cz + facing z) with a world-Random yaw, the stack's custom name and one egg used up, for every
// registered egg damage, an unregistered one and a named stack. BehaviorDispenseExpBottle (ku): the dispensed entity's class,
// position, velocity (b()) and inaccuracy (a()), the stack shrink and the aux sounds, plus its heading with a reseeded
// Entity.rand exactly as BehaviorProjectileDispense.dispenseStack calls it. One JSON per line.
public class AwayDispenseProbe {
  static final int X = DispenseProbe.X, Y = DispenseProbe.Y, Z = DispenseProbe.Z;
  static String q(String s) { return DispenseProbe.q(s); }
  static String num(double d) { return DispenseProbe.num(d); }

  static String entity(sa e) throws Exception {
    StringBuilder o = new StringBuilder("{\"class\":" + q(e.getClass().getName()) + ",\"x\":" + num(e.s) + ",\"y\":" + num(e.t) + ",\"z\":" + num(e.u)
      + ",\"mx\":" + num(e.v) + ",\"my\":" + num(e.w) + ",\"mz\":" + num(e.x) + ",\"yaw\":" + e.y + ",\"pitch\":" + e.z);
    if (e instanceof sw) {
      sw m = (sw) e;
      o.append(",\"bodyYaw\":").append(m.aM).append(",\"headYaw\":").append(m.aO).append(",\"name\":").append(q(m.bG() == null ? "" : m.bG()));
    }
    return o.append('}').toString();
  }

  static void dispense(String name, int facing, long seed, String item, String customName) throws Exception {
    DispenseProbe.W w = DispenseProbe.world(seed);
    w.put(X, Y, Z, 23, facing);
    add s = DispenseProbe.stack(item);
    if (customName != null) s.c(customName);
    apb t = new apb();
    t.a(0, s);
    DispenseProbe.field(apb.class, "j").set(t, new Random(555));
    w.tiles.put(DispenseProbe.W.key(X, Y, Z), t);
    StringBuilder o = new StringBuilder("{\"kind\":\"dispense\",\"name\":" + q(name) + ",\"facing\":" + facing + ",\"seed\":\"" + seed + "\",\"item\":" + q(item)
      + ",\"customName\":" + (customName == null ? "null" : q(customName)));
    try {
      aji.e(23).a(w, X, Y, Z, new Random(1));
    } catch (Throwable e) {
      if (System.getenv("TRACE") != null) e.printStackTrace();
      System.out.println(o + ",\"error\":" + q(e.toString()) + "}");
      return;
    }
    add r = t.a(0);
    o.append(",\"after\":").append(DispenseProbe.enc(r)).append(",\"log\":[");
    for (int i = 0; i < w.log.size(); i++) { if (i > 0) o.append(','); o.append(q(w.log.get(i))); }
    o.append("],\"spawned\":[");
    for (int i = 0; i < w.spawned.size(); i++) { if (i > 0) o.append(','); o.append(entity(w.spawned.get(i))); }
    o.append("],\"worldNext\":").append(w.s.nextInt(1000000)).append('}');
    System.out.println(o);
  }

  static void bottleHeading() throws Exception {
    for (int facing = 0; facing < 6; facing++) for (long seed : new long[]{1, 2, 3}) {
      DispenseProbe.W w = DispenseProbe.world(7);
      w.put(X, Y, Z, 23, facing);
      add s = DispenseProbe.stack("384:1:0");
      Object beh = akm.a.a(s.b());
      Class<?> pd = Class.forName("kk");
      cl src = new cl(w, X, Y, Z);
      cr f = cr.a(w.e(X, Y, Z) & 7);
      cx pos = akm.a(src);
      Method make = pd.getDeclaredMethod("a", ahb.class, cx.class); make.setAccessible(true);
      Method vel = pd.getDeclaredMethod("b"); vel.setAccessible(true);
      Method inacc = pd.getDeclaredMethod("a"); inacc.setAccessible(true);
      zh e = (zh) make.invoke(beh, w, pos);
      DispenseProbe.field(sa.class, "Z").set(e, new Random(seed));
      e.c((double) f.c(), (double) ((float) f.d() + 0.1F), (double) f.e(), (Float) vel.invoke(beh), (Float) inacc.invoke(beh));
      System.out.println("{\"kind\":\"heading\",\"item\":\"384:1:0\",\"facing\":" + facing + ",\"seed\":\"" + seed + "\",\"velocity\":" + vel.invoke(beh)
        + ",\"inaccuracy\":" + inacc.invoke(beh) + ",\"entity\":" + entity((sa) e) + "}");
    }
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); DispenseProbe.U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    kl.a();
    int[] eggs = {50, 51, 52, 54, 55, 56, 57, 58, 59, 60, 61, 62, 65, 66, 90, 91, 92, 93, 94, 95, 96, 98, 100, 120};
    for (int f = 0; f < 6; f++) for (long seed : new long[]{3, 4}) for (int dmg : new int[]{50, 90, 120}) dispense("egg", f, seed, "383:3:" + dmg, null);
    for (int dmg : eggs) dispense("eggKind", 3, 5, "383:2:" + dmg, null);
    for (int dmg : new int[]{0, 1, 53, 63, 97, 999}) dispense("eggUnregistered", 2, 5, "383:2:" + dmg, null);
    for (int f = 0; f < 6; f++) { dispense("eggNamed", f, 6, "383:1:90", "Bessie"); dispense("eggLast", f, 6, "383:1:92", null); }
    for (int f = 0; f < 6; f++) for (long seed : new long[]{21, 22}) dispense("expBottle", f, seed, "384:5:0", null);
    bottleHeading();
  }
}
