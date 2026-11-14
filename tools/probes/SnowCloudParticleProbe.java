import java.lang.reflect.Field;
import java.util.*;

// Batch 70: EntitySnowShovelFX (bkw, "snowshovel"), EntityCloudFX (bks, "cloud") and EntityFootStepFX
// (bkg, "footstep") built through the unchanged RenderGlobal.doSpawnParticle, with every onUpdate recorded
// (the cloud twice: with no player and with a player inside 2 blocks, through the real
// World.getClosestPlayerToEntity over World.playerEntities) and the renderParticle draws of the first two.
// The footstep's renderParticle needs GL and is bytecode-read only. Same world double as ExtraParticleProbe.
public class SnowCloudParticleProbe extends FxProbe {
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

    // [name, fixture, x, y, z, a, b, c]; fixture 5 puts the viewer (a player at 10.5, 65.62, 10.5, box minY 64.0, motionY 0.1) in World.playerEntities.
    yz player = (yz) U.allocateInstance(bll.class);
    set(player, "s", 10.5); set(player, "t", 65.62); set(player, "u", 10.5);
    set(player, "w", 0.1);
    set(player, "C", azt.a(10.2, 64.0, 10.2, 10.8, 65.8, 10.8));
    Object[][] cases = {
      {"snowshovel", 0, 10.5, 64.8, 10.5, 0.0, 0.0, 0.0}, {"snowshovel", 0, 10.9, 66.3, 10.2, 0.0, 0.0, 0.0}, {"snowshovel", 0, 10.4, 65.0625, 10.6, 0.3, 0.1, -0.2},
      {"snowshovel", 2, 10.5, 65.5, 10.5, 0.0, 0.0, 0.0},
      {"cloud", 0, 10.5, 65.0, 10.5, 0.0, 0.0, 0.0}, {"cloud", 0, 10.5, 70.0, 10.5, 0.2, 0.1, -0.1}, {"cloud", 2, 10.5, 65.0, 10.5, 0.0, 0.0, 0.0},
      {"cloud", 5, 10.5, 66.2, 10.5, 0.0, 0.0, 0.0}, {"cloud", 5, 11.2, 65.4, 10.9, 0.05, 0.0, 0.0}, {"cloud", 5, 10.5, 63.5, 10.5, 0.0, 0.0, 0.0},
      {"footstep", 0, 10.5, 64.0, 10.5, 0.0, 0.0, 0.0}, {"footstep", 0, 10.9, 64.01, 10.1, 0.0, 0.0, 0.0},
    };
    int n = 0;
    for (Object[] c : cases) {
      String kind = (String) c[0];
      int fx = (Integer) c[1];
      fixture(fx);
      ArrayList<Object> players = new ArrayList<>();
      if (fx == 5) players.add(player);
      set(world, "h", players);
      setRaw(mathRandom, M + n++);
      long math = raw(mathRandom);
      calls.clear();
      bkm p = render.b(kind, (double) c[2], (double) c[3], (double) c[4], (double) c[5], (double) c[6], (double) c[7]);
      String a = "[" + c[2] + "," + c[3] + "," + c[4] + "," + c[5] + "," + c[6] + "," + c[7] + "]";
      System.out.println(particle(kind, fx, p, math, a));
    }
    set(world, "h", new ArrayList<Object>());

    // EntityFootStepFX keeps its own tick counter (aB against aC = 200) and ignores EntityFX.particleAge:
    // the update count at which setDead runs, and the particle's position and motion at the end.
    {
      fixture(0);
      set(world, "h", new ArrayList<Object>());
      setRaw(mathRandom, M + 900);
      bkm p = render.b("footstep", 10.5, 64.0, 10.5, 0.0, 0.0, 0.0);
      int ticks = 0;
      while (!p.K && ticks < 1000) { p.h(); ticks++; }
      System.out.println("{\"case\":\"footlife\",\"ticks\":" + ticks + ",\"dead\":" + p.K + ",\"pos\":[" + p.s + "," + p.t + "," + p.u + "],\"motion\":[" + p.v + "," + p.w + "," + p.x + "],\"layer\":" + p.a() + "}");
    }

    // renderParticle / getBrightnessForRender at construction and two ticks later: three partial ticks and two
    // camera bases (yaw 30 / pitch -20, and yaw 200 / pitch 65 mirrored), world light sky 13, block 7.
    drawLight = 13 << 20 | 7 << 4;
    float[][] bases = new float[2][];
    for (int b = 0; b < 2; b++) {
      float yaw = (b == 0 ? 30f : 200f) * (float) Math.PI / 180f, pitch = (b == 0 ? -20f : 65f) * (float) Math.PI / 180f, k = b == 0 ? 1 : -1;
      float rx = qh.b(yaw) * k, rz = qh.a(yaw) * k;
      bases[b] = new float[] {rx, qh.b(pitch), rz, -rz * qh.a(pitch) * k, rx * qh.a(pitch) * k};
    }
    Object[][] draws = {{"snowshovel", 0.0, 0.0, 0.0}, {"snowshovel", 0.3, 0.1, -0.2}, {"cloud", 0.0, 0.0, 0.0}, {"cloud", 0.2, 0.1, -0.1}};
    for (Object[] c : draws) {
      String kind = (String) c[0];
      fixture(0);
      setRaw(mathRandom, M + n++);
      bkm p = render.b(kind, 10.45, 64.6, 10.55, (double) c[1], (double) c[2], (double) c[3]);
      StringBuilder out = new StringBuilder();
      for (int tick = 0; tick <= 2; tick += 2) {
        if (tick > 0) { p.h(); p.h(); }
        String state = drawState(p);
        StringBuilder each = new StringBuilder();
        for (float partial : new float[] {0f, 0.37f, 1f}) for (float[] basis : bases) each.append(each.length() > 0 ? "," : "").append(draw(p, partial, basis));
        out.append(tick > 0 ? "," : "").append("{\"tick\":" + tick + ",\"state\":" + state + ",\"draws\":[" + each + "]}");
      }
      System.out.println("{\"case\":\"draw\",\"kind\":\"" + kind + "\",\"class\":\"" + p.getClass().getName() + "\",\"light\":" + drawLight + ",\"frames\":[" + out + "]}");
    }
    drawLight = -1;
  }
}
