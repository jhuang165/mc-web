import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Invokes unchanged EntityEnderPearl.onImpact through its actual EntityThrowable
// world/target path. Scenarios intentionally cover server no-owner setDead,
// client hit/particle behavior, and server hit-zero-damage before particles.
public class EnderPearlImpactProbe {
  static class W extends MobMoveProbe.ProbeWorld {
    List<String> events = new ArrayList<>();
    W(boolean remote) { super(); E = remote; }
    public void a(String kind, double x, double y, double z, double mx, double my, double mz) {
      events.add("particle|" + kind + "|" + x + "|" + y + "|" + z + "|" + mx + "|" + my + "|" + mz);
    }
  }
  static class Target extends yq {
    boolean attacked; float amount = -1;
    final W world;
    Target(W world) { super(world); this.world = world; }
    public boolean a(ro source, float damage) { attacked = true; amount = damage; world.events.add("hit|" + damage + "|" + source); return true; }
  }
  static void impact(zm pearl, sa hit) throws Exception {
    Method m = zm.class.getDeclaredMethod("a", azu.class); m.setAccessible(true);
    azu result = hit == null ? new azu(0, 0, 0, 0, azw.a(10, 20, 30)) : new azu(hit);
    m.invoke(pearl, result);
  }
  static String run(String name, boolean remote, boolean withHit, long seed) throws Exception {
    sun.misc.Unsafe unsafe = MobMoveProbe.unsafe();
    W world = (W) unsafe.allocateInstance(W.class); world.E = remote; world.events = new ArrayList<>();
    MobMoveProbe.set(world, "t", unsafe.allocateInstance(aqq.class));
    zm pearl = new zm(world);
    pearl.Z = new Random(seed);
    MobMoveProbe.set(pearl, "s", 10.0); MobMoveProbe.set(pearl, "t", 20.0); MobMoveProbe.set(pearl, "u", 30.0);
    Target target = withHit ? (Target) unsafe.allocateInstance(Target.class) : null;
    if (target != null) MobMoveProbe.set(target, "world", world);
    impact(pearl, target);
    return "{\"case\":\"" + name + "\",\"seed\":" + seed + ",\"remote\":" + remote + ",\"hit\":" + withHit + ",\"dead\":" + pearl.K
      + ",\"attacked\":" + (withHit && target.attacked) + ",\"damage\":" + (withHit ? target.amount : -1) + ",\"events\":" + strings(world.events) + "}";
  }
  static String strings(List<String> values) {
    StringBuilder b = new StringBuilder("[");
    for (String s : values) { if (b.length() > 1) b.append(','); b.append('"').append(s).append('"'); }
    return b.append(']').toString();
  }
  public static void main(String[] args) throws Exception {
    System.out.println(run("server-no-owner", false, false, 11));
    System.out.println(run("client-hit", true, true, 12));
    System.out.println(run("server-hit", false, true, 13));
  }
}
