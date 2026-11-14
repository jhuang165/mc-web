import java.lang.reflect.Field;
import java.util.*;

// Batch 73: EntityFishWakeFX (ble, "wake") built through the unchanged RenderGlobal.doSpawnParticle with every onUpdate recorded.
// (Setup copied from SnowCloudParticleProbe; same world double as ExtraParticleProbe.)
public class WakeParticleProbe extends FxProbe {
  static final long M = 0x3A91F27B4C5DL;
  static String list(int[][] cells) {
    StringBuilder b = new StringBuilder();
    for (int[] e : cells) b.append(b.length() > 0 ? "," : "").append(Arrays.toString(e));
    return b.toString();
  }
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    U = (sun.misc.Unsafe) uf.get(null);
    seedField = Random.class.getDeclaredField("seed");
    seedField.setAccessible(true);
    Math.random();
    Field holder = Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
    holder.setAccessible(true);
    mathRandom = (Random) holder.get(null);
    aji.p();
    adb.l();
    rg register = Icon::new;
    for (int id = 256; id < 512; id++) {
      adb item = adb.d(id);
      if (item != null) try { item.a(register); } catch (Throwable t) {}
    }
    world = (FW) U.allocateInstance(FW.class);
    set(world, "s", new Random(5));
    set(world, "t", U.allocateInstance(aqq.class));
    set(world, "C", new qi());
    world.E = true;
    effects = new bkn(world, null);
    render = (bma) U.allocateInstance(bma.class);
    bao mc = (bao) U.allocateInstance(bao.class);
    bbj settings = (bbj) U.allocateInstance(bbj.class);
    mc.u = settings;
    mc.k = effects;
    sv viewer = (sv) U.allocateInstance(wo.class);
    mc.i = viewer;
    set(render, "A", mc);
    set(render, "r", world);
    set(viewer, "s", 10.5); set(viewer, "t", 65.62); set(viewer, "u", 10.5);
    DRAWS.put("enchantmenttable", 6); // Entity.rand: the four EntityFX draws, then brightness and scale

    // [name, fixture, x, y, z, vx, vy, vz]: fishing-hook wakes (count 0 packets: speed * offset) and a gaussian-style spread.
    Object[][] cases = {
      {"wake", 0, 10.5, 65.0, 10.5, 0.0, 0.01, 0.04}, {"wake", 0, 10.9, 65.0, 10.2, -0.04, 0.01, 0.0}, {"wake", 0, 10.5, 66.0, 10.5, 0.0, 0.0, 0.0},
      {"wake", 1, 10.5, 65.0, 10.5, 0.03, 0.01, -0.03}, {"wake", 2, 10.5, 65.5, 10.5, 0.0, 0.2, 0.0}, {"wake", 0, 10.5, 64.2, 10.5, 0.1, -0.3, 0.1},
    };
    int n = 0;
    for (Object[] c : cases) {
      String kind = (String) c[0];
      int fx = (Integer) c[1];
      fixture(fx);
      set(world, "h", new ArrayList<Object>());
      setRaw(mathRandom, M + n++);
      long math = raw(mathRandom);
      calls.clear();
      bkm p = render.b(kind, (double) c[2], (double) c[3], (double) c[4], (double) c[5], (double) c[6], (double) c[7]);
      String a = "[" + c[2] + "," + c[3] + "," + c[4] + "," + c[5] + "," + c[6] + "," + c[7] + "]";
      System.out.println(particle(kind, fx, p, math, a));
    }
  }
}
