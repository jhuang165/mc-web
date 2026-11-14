// Batch 68 (projectiles3): firework rockets against blocks. The unchanged EntityFireworkRocket (zf) and Entity.onEntityUpdate/moveEntity on the ParticleProbe world double with blocks put
// in its cell map: a stone ceiling, a half slab, a fence, a cobweb, a wall, and the void (posY < -64). Rows as FireworksProbe's rocket rows
// ([x,y,z,vx,vy,vz,yaw,pitch,prevYaw,prevPitch,life,dead,spark]) plus the start position and the blocks. The constructor seed is recovered as in FireworksProbe.rocketRun.
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

public class FireworkCollideProbe extends FireworksProbe {
  static void run(String name, double sx, double sy, double sz, int flight, boolean remote, int maxTicks, int[][] blocks) throws Exception {
    cells.clear();
    for (int[] bl : blocks) put(bl[0], bl[1], bl[2], bl[3], bl[4]);
    world.E = remote;
    sounds.clear(); states.clear(); makes.clear(); sparkCalls.clear();
    add stack = fromNbt(401, fireworks(flight, explosion(1, new int[] { 11743532 }, null, false, false)));
    zf r = new zf(world, sx, sy, sz, stack);
    Random z = (Random) get(r, "Z");
    long post = raw(z);
    double vx0 = r.v, vz0 = r.x;
    int life0 = i(r, "b");
    long pre = -1;
    int draws = -1;
    for (int k = 1; k <= 80 && pre < 0; k++) {
      long cand = back(post, k);
      Random t2 = (Random) copyAt(cand);
      double ax = t2.nextGaussian() * 0.001, az = t2.nextGaussian() * 0.001;
      int l = t2.nextInt(6) + t2.nextInt(7);
      if (ax == vx0 && az == vz0 && 10 * (1 + flight) + l == life0 && raw(t2) == post) { pre = cand; draws = k; }
    }
    if (pre < 0) throw new IllegalStateException("could not recover the rocket constructor seed for " + name);
    int ticks = 0;
    StringBuilder rows = new StringBuilder();
    boolean dead = false;
    if (remote) maxTicks = Math.min(maxTicks, life0 + 1);
    while (ticks < maxTicks && !dead) {
      sparkCalls.clear();
      r.h();
      ticks++;
      dead = b(r, "K");
      rows.append(ticks > 1 ? "," : "").append("[").append(r.s).append(",").append(r.t).append(",").append(r.u).append(",").append(r.v).append(",")
        .append(r.w).append(",").append(r.x).append(",").append((double) r.y).append(",").append((double) r.z).append(",").append((double) r.A).append(",")
        .append((double) r.B).append(",").append(i(r, "a")).append(",").append(dead ? 1 : 0).append(",").append(sparkCalls.isEmpty() ? "null" : sparkCalls.get(0)).append("]");
    }
    StringBuilder bl = new StringBuilder("[");
    for (int k = 0; k < blocks.length; k++) bl.append(k > 0 ? "," : "").append(Arrays.toString(blocks[k]));
    bl.append("]");
    System.out.println("{\"case\":\"rocket-blocks\",\"name\":" + q(name) + ",\"remote\":" + remote + ",\"seed\":" + pre + ",\"flight\":" + flight + ",\"start\":[" + sx + "," + sy + "," + sz + "],\"blocks\":" + bl
      + ",\"lifetime\":" + life0 + ",\"ticks\":" + ticks + ",\"rows\":[" + rows + "],\"states\":" + states + "}");
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
    world = (PWorld) U.allocateInstance(FW.class);
    set(world, "s", new Random(7));
    set(world, "t", U.allocateInstance(aqq.class));
    set(world, "C", new qi());
    world.E = true;
    effects = new bkn(world, null);
    render = (bma) U.allocateInstance(bma.class);
    bao mc = (bao) U.allocateInstance(bao.class);
    mc.k = effects;
    viewer = (sv) U.allocateInstance(wo.class);
    mc.i = viewer;
    set(render, "A", mc);
    set(render, "r", world);
    Field mcStatic = bao.class.getDeclaredField("M");
    mcStatic.setAccessible(true);
    mcStatic.set(null, mc);

    for (Method m : adb.class.getDeclaredMethods())
      if (java.lang.reflect.Modifier.isStatic(m.getModifiers()) && m.getReturnType() == adb.class && Arrays.equals(m.getParameterTypes(), new Class<?>[] { int.class })) { m.setAccessible(true); itemById = m; }
    for (Method m : add.class.getDeclaredMethods()) if (m.getReturnType() == dh.class && m.getParameterCount() == 0) { m.setAccessible(true); stackTag = m; break; }
    for (Field f : aae.class.getDeclaredFields()) if (f.getType() == add[].class) { f.setAccessible(true); gridStacks = f; }
    if (itemById == null || stackTag == null) throw new IllegalStateException("reflection lookup failed");
    int[][] none = {};
    // a stone ceiling one block above the launch (y 66): the box stops under it, motionY is zeroed each tick, the rocket hangs there until its lifetime ends
    for (int pass = 0; pass < 2; pass++) {
      boolean remote = pass == 1;
      String s = remote ? "-client" : "-server";
      run("ceiling-stone" + s, 10.5, 65.0, 10.5, 1, remote, 120, new int[][] { { 10, 66, 10, 1, 0 } });
      run("ceiling-slab-top" + s, 10.5, 65.0, 10.5, 1, remote, 120, new int[][] { { 10, 66, 10, 44, 8 } });
      run("ceiling-slab-bottom" + s, 10.5, 65.0, 10.5, 1, remote, 120, new int[][] { { 10, 66, 10, 44, 0 } });
      run("fence-column" + s, 10.5, 65.0, 10.5, 1, remote, 120, new int[][] { { 10, 65, 10, 85, 0 } });
      run("fence-above" + s, 10.5, 64.0, 10.5, 1, remote, 120, new int[][] { { 10, 65, 10, 85, 0 } });
      run("cobweb-above" + s, 10.5, 65.0, 10.5, 1, remote, 120, new int[][] { { 10, 66, 10, 30, 0 } });
      run("cobweb-start" + s, 10.5, 65.0, 10.5, 1, remote, 120, new int[][] { { 10, 65, 10, 30, 0 } });
      run("glass-ceiling" + s, 10.5, 65.0, 10.5, 2, remote, 120, new int[][] { { 10, 67, 10, 20, 0 } });
    }
    // a wall one hair beside the rocket: the sideways drift (nextGaussian * 0.001 growing by 1.15 a tick) is clamped to the wall; six seeds, so both signs and both axes occur
    for (int k = 0; k < 6; k++)
      run("wall-x-" + k, 10.8749, 65.0, 10.5, 2, false, 120, new int[][] { { 11, 65, 10, 1, 0 }, { 11, 66, 10, 1, 0 }, { 11, 67, 10, 1, 0 }, { 11, 68, 10, 1, 0 }, { 11, 69, 10, 1, 0 }, { 11, 70, 10, 1, 0 }, { 11, 71, 10, 1, 0 }, { 11, 72, 10, 1, 0 }, { 11, 73, 10, 1, 0 }, { 11, 74, 10, 1, 0 } });
    for (int k = 0; k < 6; k++)
      run("wall-z-" + k, 10.5, 65.0, 10.1251, 2, false, 120, new int[][] { { 10, 65, 9, 1, 0 }, { 10, 66, 9, 1, 0 }, { 10, 67, 9, 1, 0 }, { 10, 68, 9, 1, 0 }, { 10, 69, 9, 1, 0 }, { 10, 70, 9, 1, 0 }, { 10, 71, 9, 1, 0 }, { 10, 72, 9, 1, 0 }, { 10, 73, 9, 1, 0 }, { 10, 74, 9, 1, 0 } });
    // the void: Entity.onEntityUpdate kills anything below y -64 before the rocket's own update (no explosion: the server's isDead is set by kill(), life > lifetime never reached)
    run("void-server", 10.5, -64.5, 10.5, 1, false, 120, none);
    run("void-client", 10.5, -64.5, 10.5, 1, true, 120, none);
    run("void-edge", 10.5, -64.04, 10.5, 1, false, 120, none);
  }
}
