import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 39. EntityLivingBase (sv.class) calls java.lang.Math.random() from its constructor (the start yaw) and from attackEntityFrom (the knockback
// direction, only when attacker and victim are within 0.01 blocks of each other, as an arrow hitting its own mount's rider). tools/verify-village-fight.mjs
// points the one Methodref `java/lang/Math.random()D` of sv.class at this class (a constant-pool edit, the instructions stay): a call from a
// constructor takes an unrecorded stream, every other call takes a seeded stream and is recorded as [tick, value], so a replay can feed the same
// values to the port's knockBack.
public class SeedMath {
  static Random stream = new Random(1), ctor = new Random(2);
  static List<String> log = new ArrayList<>();
  static void reset(long seed) { stream = new Random(seed); log.clear(); }
  static String json() { return "[" + String.join(",", log) + "]"; }
  public static double random() {
    StackTraceElement[] st = new Throwable().getStackTrace();
    if (st.length > 1 && st[1].getMethodName().equals("<init>")) return ctor.nextDouble();
    double v = stream.nextDouble();
    log.add("[" + VillagerProbe.World.tick + "," + v + "," + (st.length > 1 ? "\"" + st[1].getClassName() + "." + st[1].getMethodName() + "\"" : "null") + "]");
    return v;
  }
}
