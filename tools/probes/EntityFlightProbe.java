import java.util.*;

// Batch 64 (entityprobes): spawned items in flight. The real, unchanged EntityPlayer.func_146097_a (yz.a(add, boolean, boolean): dropPlayerItemWithRandomChoice's body)
// runs on an EntityPlayerSP shell (EntityListProbe.Th, eye height 1.62F) whose Entity.rand is a Random(seed). The item it creates is spawned through a World double that keeps the
// motion the method set (EntityListProbe.EW fixes an item's motion to 0, 0.2, 0; here it must not), then the entity list is walked for `ticks` ticks (EntityItem.onUpdate: gravity, drag,
// the push out of blocks, ground friction, the merge search). Records: the spawn state, then one row per tick. Item state: [x, y, z, vx, vy, vz, isDead, count, age, delayBeforeCanPickup].
public class EntityFlightProbe {
  public static class FW extends EntityListProbe.EW {
    FW() { super(); }
    public boolean d(sa e) { // World.spawnEntityInWorld: the end of loadedEntityList, the motion left as the spawner set it
      if (e instanceof xk) { try { PlayerStepProbe.field(sa.class, "Z").set(e, new Random(7)); } catch (Exception x) { throw new RuntimeException(x); } }
      entities.add(e); return true;
    }
  }
  public static class Pl extends EntityListProbe.Th { Pl() { super(); } public void a(ph stat, int n) {} } // addStat: nothing to count
  static String num(double v) { return Double.toString(v); }
  static String item(xk e) {
    return "[" + num(e.s) + "," + num(e.t) + "," + num(e.u) + "," + num(e.v) + "," + num(e.w) + "," + num(e.x) + "," + (e.K ? 1 : 0) + "," + e.f().b + "," + e.a + "," + e.b + "]";
  }
  static FW newWorld() throws Exception {
    FW w = (FW) PlantProbe.unsafe.allocateInstance(FW.class);
    MobMoveProbe.set(w, "t", PlantProbe.unsafe.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, false);
    MobMoveProbe.field(ahb.class, "h").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "L").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "u").set(w, new ArrayList());
    w.cells = new HashMap<>();
    w.entities = new ArrayList<>();
    return w;
  }
  // wall: x1 means an extra stone column at (wx, 0..3, wz) so the item hits it in flight
  static void scenario(String name, double px, double py, double pz, float yaw, float pitch, long seed, boolean scatter, boolean named, int count, int ticks, int wx, int wz) throws Exception {
    FW w = newWorld();
    if (wx != Integer.MIN_VALUE) for (int y = 0; y < 4; y++) w.put(wx, y, wz, 1, 0);
    Pl p = (Pl) PlantProbe.unsafe.allocateInstance(Pl.class);
    p.o = w; p.s = px; p.t = py; p.u = pz; p.y = yaw; p.z = pitch;
    p.bE = new yw();
    PlayerStepProbe.field(sa.class, "Z").set(p, new Random(seed));
    xk it = p.a(new add(aji.e(1), count, 0), scatter, false);
    List<String> rows = new ArrayList<>();
    String spawn = item(it);
    for (int t = 0; t < ticks; t++) {
      for (int i = 0; i < w.entities.size(); i++) { sa e = w.entities.get(i); if (!e.K) EntityListProbe.update(e); }
      w.entities.removeIf(e -> e.K);
      rows.add(item(it));
    }
    System.out.println("{\"case\":\"drop-flight\",\"name\":\"" + name + "\",\"from\":[" + num(px) + "," + num(py) + "," + num(pz) + "," + yaw + "," + pitch + "],\"seed\":" + seed + ",\"scatter\":" + scatter + ",\"count\":" + count + ",\"wall\":" + (wx == Integer.MIN_VALUE ? "null" : "[" + wx + "," + wz + "]") + ",\"spawn\":" + spawn + ",\"rows\":[" + String.join(",", rows) + "]}");
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    float[][] views = {{0f, 0f}, {37.5f, -12.25f}, {-123.75f, 45.5f}, {200.125f, -80f}, {90f, 10f}, {-0.5f, 89.9f}, {359.99f, -89.9f}};
    int n = 0;
    for (float[] v : views) {
      scenario("throw-" + n, 10.5 + n, 2.0 + 0.25 * n, -3.75 - n, v[0], v[1], 11 + n, false, false, 3 + n, 30, Integer.MIN_VALUE, 0);
      scenario("scatter-" + n, 10.5 + n, 2.0 + 0.25 * n, -3.75 - n, v[0], v[1], 31 + n, true, false, 3 + n, 30, Integer.MIN_VALUE, 0);
      n++;
    }
    // a wall in the line of a level throw (yaw 0 looks along +z): the item hits the column at z = -3 + 1 and stops
    scenario("throw-wall-z", 0.5, 2.0, -9.5, 0f, -5f, 3, false, false, 1, 40, 0, -3);
    scenario("throw-wall-x", 0.5, 2.0, 0.5, -90f, 0f, 5, false, false, 1, 40, 4, 0);
    // a drop at floor level: the item starts inside the ground cell column (the push out of blocks draws on its own Random(7))
    scenario("throw-floor", 0.5, 0.0, 0.5, 45f, 30f, 9, false, false, 2, 30, Integer.MIN_VALUE, 0);
  }
}
