import java.lang.invoke.*;
import java.lang.reflect.Field;
import java.util.HashMap;

// Batch 98 portals98: a REAL mob (EntityPig via EntityList) that touched the Nether portal and is then mounted by a real rider (EntityZombie), or that rides / is ridden
// while counting down, run through the real sa.C (Entity.onEntityUpdate, non-virtual) and the real Entity.travelToDimension (sa.b(I)V) on the Portals97Probe world doubles.
// World.removeEntity (ahb.e) is the Portals97Probe replay of its bytecode: riddenBy.mountEntity(null), then the entity's own mountEntity(null). Real mountEntity (sa.a(sa)) runs.
// Records: {kind:"mount", mode, traveled, removed, copy:{...}, rider:{ridingAfter, y, sameWorld}, mount:{riddenByAfter}, cooldown, counter, inPortal}
public class Portals98Probe {
  static MethodHandle base(Class<?> c) throws Throwable { return MethodHandles.privateLookupIn(c, MethodHandles.lookup()).findSpecial(sa.class, "C", MethodType.methodType(void.class), c); }
  static String q(String s) { return "\"" + s + "\""; }
  static void run(String mode, boolean touchFirst, boolean mountBefore, boolean ridingOther, int cooldown, boolean zombieRider) throws Throwable {
    Portals97Probe.TW2 over = Portals97Probe.world(0, 21, 60), nether = Portals97Probe.world(-1, 21, 31), end = Portals97Probe.world(1, 21, 40);
    Portals97Probe.bind(over, nether, end);
    over.cells.put("40,61,-13", 90); over.cells.put("40,62,-13", 90);
    sa pig = sg.a("Pig", over);
    pig.b(40.5, 61.0, -12.5, 71f, 0f);
    pig.am = cooldown; pig.ap = 0;
    sa rider = sg.a(zombieRider ? "Zombie" : "Pig", over);
    rider.b(40.5, 61.0, -12.5, 71f, 0f);
    sa other = null;
    aji portal = aji.e(90);
    boolean blocked;
    if (ridingOther) { other = sg.a("Pig", over); other.b(40.5, 61.0, -12.5, 0f, 0f); pig.a(other); }
    if (mountBefore) rider.a(pig);
    portal.a(over, 40, 61, -13, pig); // BlockPortal.onEntityCollidedWithBlock
    boolean inAfterCollide = pig.an;
    if (!mountBefore && touchFirst) rider.a(pig); // the rider mounts after the collision, before the pig's next update
    MethodHandle upd = base(pig.getClass());
    Portals97Probe.lastSpawn = null; Portals97Probe.removed = 0;
    int counterBefore = pig.ao;
    upd.invoke(pig);
    sa copy = Portals97Probe.lastSpawn;
    System.out.println("{\"kind\":\"mount\",\"mode\":" + q(mode) + ",\"inPortalAfterCollide\":" + inAfterCollide + ",\"traveled\":" + (copy != null) + ",\"removed\":" + Portals97Probe.removed
      + (copy != null ? ",\"copyRiddenByNull\":" + (copy.l == null) + ",\"copyRidingNull\":" + (copy.m == null) + ",\"copyCooldown\":" + copy.am + ",\"copyDim\":" + Portals97Probe.spawnDim : "")
      + ",\"riderRidingAfter\":" + (rider.m != null) + ",\"riderY\":" + rider.t + ",\"riderStillInSource\":" + (rider.o == over) + ",\"mountRiddenByAfter\":" + (pig.l != null)
      + ",\"cooldown\":" + pig.am + ",\"counterBefore\":" + counterBefore + ",\"counter\":" + pig.ao + ",\"inPortal\":" + pig.an + ",\"pigDead\":" + pig.K + "}");
  }
  public static void main(String[] args) throws Throwable {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); Portals97Probe.U = (sun.misc.Unsafe) uf.get(null);
    EntityPortalProbe.U = Portals97Probe.U;
    aji.p(); adb.l();
    EntityPortalProbe.INFO = (ays) Portals97Probe.U.allocateInstance(ays.class);
    run("touch-then-mount", true, false, false, 0, true);
    run("mount-then-touch", true, true, false, 0, true);
    run("touch-then-mount-cooldown", true, false, false, 40, true);
    run("riding-other", true, false, true, 0, true);
    run("riding-other-cooldown", true, false, true, 5, true);
    run("touch-then-mount-pig-rider", true, false, false, 0, false);
  }
}
