import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// EntityPlayer.updateItemUse(ItemStack, int) (yz.c(add, int)) of the unchanged 1.7.10 client, run on a constructor-less
// EntityOtherPlayerMP (bll, the class a remote player is on the client) in the FxProbe world double. It records the
// World.spawnParticle calls ("iconcrack_<id>[_<meta>]") and the entity sounds, with the entity's own Random and Math.random
// states taken before the call so the browser replay can rewind to them. Items: eat actions (apple, bread, golden apple meta 0
// and 1, raw and cooked fish metas, cookie), the drink actions (milk bucket, potion) and non-eat actions (sword, bow) for n 5 and 16.
// No classes patched.
public class MpEatingProbe extends FxProbe {
  // Entity.playSound for a player is World.playSoundToNearExcept (ahb.a(yz, name, volume, pitch)), recorded with the position the sound is sent from (posY - yOffset).
  public static class EW extends FW {
    public void a(yz p, String name, float volume, float pitch) {
      sounds.add("[\"" + name + "\"," + p.s + "," + (p.t - (double) p.L) + "," + p.u + "," + (double) volume + "," + (double) pitch + "]");
    }
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
    world = (FW) U.allocateInstance(EW.class);
    set(world, "s", new Random(5));
    set(world, "t", U.allocateInstance(aqq.class));
    set(world, "C", new qi());
    world.E = true;
    rg register = Icon::new;
    for (int id = 256; id < 512; id++) {
      adb item = adb.d(id);
      if (item != null) try { item.a(register); } catch (Throwable t) {}
    }
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
    Method use = yz.class.getDeclaredMethod("c", add.class, int.class);
    use.setAccessible(true);
    // [item id, meta, n]
    int[][] cases = {{260, 0, 5}, {297, 0, 5}, {322, 0, 5}, {322, 1, 5}, {349, 0, 5}, {349, 2, 5}, {350, 1, 5}, {357, 0, 5}, {260, 0, 16}, {322, 1, 16}, {350, 0, 16},
      {335, 0, 5}, {373, 0, 5}, {373, 16, 5}, {267, 0, 5}, {261, 0, 5}, {267, 0, 16}, {364, 0, 5}};
    float[][] looks = {{0, 0}, {37.5f, -20}, {-160, 65}, {90, -90}};
    long M = 0x3545F4914F6DL;
    int k = 0;
    for (int[] c : cases) {
      float[] look = looks[k % looks.length];
      calls.clear(); sounds.clear();
      sv e = (sv) U.allocateInstance(bll.class);
      set(e, "o", world);
      long seed = 311 + k;
      set(e, "Z", new Random(seed));
      te watcher = new te(e);
      set(e, "af", watcher);
      watcher.a(0, Byte.valueOf((byte) 0));
      watcher.a(1, Short.valueOf((short) 300));
      watcher.a(7, Integer.valueOf(0));
      watcher.a(8, Byte.valueOf((byte) 0));
      Field effects = sv.class.getDeclaredField("f");
      effects.setAccessible(true);
      effects.set(e, new HashMap<>());
      set(e, "M", 0.6f); set(e, "N", 1.8f); set(e, "C", azt.a(0, 0, 0, 0, 0, 0));
      Method pos = sa.class.getDeclaredMethod("b", double.class, double.class, double.class);
      pos.setAccessible(true);
      pos.invoke(e, 10.5, 64.0, 10.5);
      e.y = look[0]; e.z = look[1];
      setRaw(world.s, 5000 + k);
      long worldSeed = raw(world.s);
      setRaw(mathRandom, M + k);
      long math = raw(mathRandom);
      use.invoke(e, new add(adb.d(c[0]), 1, c[1]), c[2]);
      System.out.println("{\"case\":\"use\",\"item\":" + c[0] + ",\"meta\":" + c[1] + ",\"n\":" + c[2] + ",\"seed\":" + seed + ",\"worldSeed\":" + worldSeed + ",\"math\":" + math
        + ",\"yaw\":" + (double) look[0] + ",\"pitch\":" + (double) look[1] + ",\"eye\":" + (e.t + (double) e.g()) + ",\"x\":" + e.s + ",\"z\":" + e.u + ",\"calls\":" + calls + ",\"sounds\":" + sounds + "}");
      k++;
    }
  }
}
