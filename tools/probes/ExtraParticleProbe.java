import java.lang.reflect.Field;
import java.util.*;

// The particle kinds that existing content emits and fx-reference.json does not cover, run on the
// unchanged 1.7.10 client: EntityReddustFX (bku, "reddust"), EntityEnchantmentTableParticleFX (bjz,
// "enchantmenttable") and EntityBreakingFX's 5-argument constructor ("slime", bju with Items.slime_ball),
// each built through RenderGlobal.doSpawnParticle with every onUpdate and renderParticle draw recorded, and
// the emitters' Block.randomDisplayTick: BlockRedstoneWire (ana), BlockRedstoneTorch (anc), BlockRedstoneOre
// (amz, the sparkle through World.rand), BlockRedstoneRepeater (anf) and BlockEnchantmentTable (aks) with a
// seeded Random. Same world double, Tessellator reads and random handling as FxProbe; nothing is patched.
public class ExtraParticleProbe extends FxProbe {
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

    // [name, fixture, x, y, z, a, b, c]: reddust takes (r, g, b) as the velocity arguments.
    Object[][] cases = {
      {"reddust", 0, 10.5, 64.8, 10.5, 0.0, 0.0, 0.0}, {"reddust", 0, 10.5, 64.8, 10.5, 1.0, 0.0, 0.0}, {"reddust", 0, 10.4, 65.0625, 10.6, 0.6, 0.3, 0.1},
      {"reddust", 2, 10.5, 65.5, 10.5, 0.4, 0.0, 0.0}, {"reddust", 0, 10.3, 66.0, 10.7, 0.9, 0.35, 0.0}, {"reddust", 2, 10.5, 65.0, 10.5, 1.0, 0.7, 0.4},
      {"enchantmenttable", 0, 10.5, 72.0, 10.5, -1.4, -1.0, 0.3}, {"enchantmenttable", 0, 10.5, 72.0, 10.5, 1.2, -1.7, -1.1}, {"enchantmenttable", 0, 10.5, 72.0, 10.5, 0.0, -2.0, 1.4},
      {"enchantmenttable", 2, 10.5, 65.0, 10.5, 0.3, -1.2, -0.6},
      {"slime", 0, 10.5, 64.0, 10.5, 0.0, 0.0, 0.0}, {"slime", 0, 10.9, 64.0, 10.2, 0.0, 0.0, 0.0}, {"slime", 2, 10.5, 65.5, 10.5, 0.0, 0.0, 0.0}, {"slime", 1, 10.5, 66.2, 10.5, 0.0, 0.0, 0.0},
    };
    int n = 0;
    for (Object[] c : cases) {
      String kind = (String) c[0];
      int fx = (Integer) c[1];
      fixture(fx);
      setRaw(mathRandom, M + n++);
      long math = raw(mathRandom);
      calls.clear();
      bkm p = render.b(kind, (double) c[2], (double) c[3], (double) c[4], (double) c[5], (double) c[6], (double) c[7]);
      String a = "[" + c[2] + "," + c[3] + "," + c[4] + "," + c[5] + "," + c[6] + "," + c[7] + "]";
      System.out.println(particle(kind, fx, p, math, a));
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
    Object[][] draws = {{"reddust", 0.8, 0.2, 0.3}, {"reddust", 0.0, 0.0, 0.0}, {"enchantmenttable", -1.1, -1.5, 0.4}, {"slime", 0.0, 0.0, 0.0}};
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

    // Block.randomDisplayTick (aji.b) at (10, 70, 10): [seed, World.spawnParticle calls, Random state after,
    // World.rand state after]. The block's Random is seeded `seed`; World.rand (the ore's sparkle) is seeded
    // `seed + 1000`. Cells are [x, y, z, id, meta]; stone (1) below y 64, air elsewhere.
    int[][] none = {};
    int[][] boxed = {{10, 71, 10, 1, 0}, {10, 69, 10, 1, 0}, {10, 70, 11, 1, 0}, {9, 70, 10, 1, 0}};
    int[][] open = {{11, 70, 10, 1, 0}, {10, 70, 9, 1, 0}};
    int[][] shelves = {
      {8, 70, 8, 47, 0}, {8, 70, 9, 47, 0}, {8, 70, 10, 47, 0}, {8, 70, 11, 47, 0}, {8, 70, 12, 47, 0}, {8, 71, 10, 47, 0},
      {12, 70, 8, 47, 0}, {12, 70, 11, 47, 0}, {12, 71, 12, 47, 0}, {11, 70, 11, 1, 0},
      {9, 70, 12, 47, 0}, {10, 70, 12, 47, 0}, {10, 71, 12, 47, 0}, {11, 71, 8, 47, 0}, {10, 70, 8, 47, 0}, {9, 71, 8, 47, 0},
      {8, 70, 7, 47, 0}, {12, 70, 12, 47, 0}};
    Object[][] display = {
      {"lit torch floor", 76, 5, 60, none}, {"lit torch east", 76, 1, 60, none}, {"lit torch west", 76, 2, 60, none},
      {"lit torch south", 76, 3, 60, none}, {"lit torch north", 76, 4, 60, none}, {"unlit torch", 75, 5, 20, none},
      {"wire 0", 55, 0, 20, none}, {"wire 1", 55, 1, 60, none}, {"wire 5", 55, 5, 60, none}, {"wire 9", 55, 9, 60, none}, {"wire 15", 55, 15, 60, none},
      {"lit ore open", 74, 0, 60, none}, {"lit ore boxed", 74, 0, 60, boxed}, {"lit ore two sides open", 74, 0, 60, open}, {"unlit ore", 73, 0, 20, none},
      {"table with shelves", 116, 0, 400, shelves}, {"table alone", 116, 0, 100, none},
    };
    for (Object[] c : display) {
      fixture(0);
      int[][] extra = (int[][]) c[4];
      put(10, 70, 10, (Integer) c[1], (Integer) c[2]);
      for (int[] e : extra) put(e[0], e[1], e[2], e[3], e[4]);
      StringBuilder runs = new StringBuilder();
      for (int seed = 0; seed < (Integer) c[3]; seed++) {
        calls.clear();
        Random r = new Random(seed), wr = new Random(seed + 1000);
        set(world, "s", wr);
        aji.e((Integer) c[1]).b(world, 10, 70, 10, r);
        runs.append(seed > 0 ? "," : "").append("[" + seed + "," + calls + "," + raw(r) + "," + raw(wr) + "]");
      }
      System.out.println("{\"case\":\"display\",\"name\":\"" + c[0] + "\",\"block\":" + c[1] + ",\"meta\":" + c[2] + ",\"cells\":[" + list(extra) + "],\"runs\":[" + runs + "]}");
    }
    // The repeater: lit (94) over every direction and delay; unlit (93) spawns nothing.
    for (int id : new int[] {94, 93}) {
      StringBuilder metas = new StringBuilder();
      for (int meta = 0; meta < 16; meta++) {
        fixture(0);
        put(10, 70, 10, id, meta);
        StringBuilder runs = new StringBuilder();
        for (int seed = 0; seed < 24; seed++) {
          calls.clear();
          Random r = new Random(seed);
          set(world, "s", new Random(seed + 1000));
          aji.e(id).b(world, 10, 70, 10, r);
          runs.append(seed > 0 ? "," : "").append("[" + seed + "," + calls + "," + raw(r) + "]");
        }
        metas.append(meta > 0 ? "," : "").append("{\"meta\":" + meta + ",\"runs\":[" + runs + "]}");
      }
      System.out.println("{\"case\":\"repeater\",\"block\":" + id + ",\"metas\":[" + metas + "]}");
    }
  }
}
