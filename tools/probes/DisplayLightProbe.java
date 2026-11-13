import java.awt.image.BufferedImage;
import java.io.File;
import java.lang.reflect.Field;
import java.nio.ByteBuffer;
import java.util.*;
import javax.imageio.ImageIO;
import org.lwjgl.opengl.GL11;

// Batch 56 displaylight (tag b56dl). Two executed parts on the unchanged 1.7.10 client classes.
// 1. Render-type sweep: for every block id 1..255 the render type (Block.getRenderType, aji.b()), RenderBlocks.renderItemIn3d(type) (blm.a(int)) and what
//    RenderBlocks.renderBlockAsItem (blm.a(aji, int, float), a fresh RenderBlocks, recording GL11 stub, as DisplayQuadsProbe) draws at every metadata 0..15: the
//    quad count (summed over the draw calls) and the first glColor4f it issues at brightness 0.37 (the brightness multiplier).
// 2. Entity brightness: Entity.getBrightness(partial) (sa.d(F), the float RenderMinecart passes to renderBlockAsItem), Entity.getBrightnessForRender (sa.c(F), the packed lightmap
//    coordinates RenderManager.renderEntityStatic splits into OpenGlHelper.setLightmapTextureCoords) and Entity.isBurning (sa.al()) of a real EntityMinecartEmpty (xs) in a World
//    stand-in with a real Chunk (apx) over a real ExtendedBlockStorage (apz); the real ahb.c(IIII), ahb.n, ahb.k, ahb.b(IIIZ), ahb.a(ahn,III) and the provider's lightBrightnessTable run.
public class DisplayLightProbe extends MinecartProbe {
  public static class LW extends MinecartProbe.MW {
    apx chunk; boolean loaded = true;
    LW() { super(); }
    public apx e(int cx, int cz) { return chunk; }
    protected boolean c(int cx, int cz) { return loaded; }
    public boolean d(int x, int y, int z) { return loaded; }
  }
  static final Field U = field(apx.class, "u"), E = field(apx.class, "e");
  static Field field(Class<?> c, String n) { try { return MobMoveProbe.field(c, n); } catch (Exception e) { throw new RuntimeException(e); } }
  static String num(double v) { return Double.toString(v); }
  static String fl(float v) { return Float.toString(v); }
  // cell light by (x, y, z) in the section y 64..79 of chunk (0, 0): sky and block values from f
  interface Light { int[] at(int x, int y, int z); }
  static LW world(Light f, int sub, int dimension, int[][] cells, boolean loaded) throws Exception {
    MW base = MinecartProbe.world(cells);
    LW w = (LW) PlantProbe.unsafe.allocateInstance(LW.class);
    for (Field fd : ahb.class.getDeclaredFields()) if (!java.lang.reflect.Modifier.isStatic(fd.getModifiers())) { fd.setAccessible(true); fd.set(w, fd.get(base)); }
    w.cells = base.cells; w.entities = base.entities; w.spawned = base.spawned; w.loaded = loaded;
    aqo p = (aqo) PlantProbe.unsafe.allocateInstance(dimension == 0 ? aqq.class : aqo.a(dimension).getClass());
    float[] t = new float[16];
    MobMoveProbe.field(aqo.class, "h").set(p, t);
    MobMoveProbe.field(aqo.class, "b").set(p, w);
    if (dimension != 0) MobMoveProbe.field(aqo.class, "g").setBoolean(p, true); // WorldProvider.hasNoSky (the Nether provider sets it in its constructor, which allocateInstance skips)
    java.lang.reflect.Method gen = aqo.class.getDeclaredMethod("a"); // generateLightBrightnessTable (a(); the Nether provider overrides it)
    gen.setAccessible(true);
    try { MobMoveProbe.set(w, "t", p); gen.invoke(p); } catch (Exception e) { throw new RuntimeException(e); }
    MobMoveProbe.field(ahb.class, "j").setInt(w, sub); // skylightSubtracted
    apx c = (apx) PlantProbe.unsafe.allocateInstance(apx.class);
    apz[] sections = new apz[16];
    apz s = new apz(64, true);
    for (int x = 0; x < 16; x++) for (int y = 0; y < 16; y++) for (int z = 0; z < 16; z++) { int[] l = f.at(x, 64 + y, z); s.b(x, y, z, l[0]); s.c(x, y, z, l[1]); }
    sections[4] = s;
    U.set(c, sections); E.set(c, w);
    w.chunk = c;
    return w;
  }
  // ---- block sweep
  static final List<String> names = new ArrayList<>(), allNames = new ArrayList<>();
  static class Icon implements rf {
    int k; final String name;
    Icon(String name, int k) { this.name = name; this.k = k; }
    public int a() { return 16; } public int b() { return 16; }
    public float c() { return 2f * k; } public float d() { return 2f * k + 1f; }
    public float a(double d) { float w = d() - c(); return c() + w * (float) d / 16.0f; }
    public float e() { return 2f * k; } public float f() { return 2f * k + 1f; }
    public float b(double d) { float h = f() - e(); return e() + h * (float) d / 16.0f; }
    public String g() { return name; }
  }
  static class Reg implements rg {
    final Map<String, Icon> icons = new LinkedHashMap<>();
    public rf a(String name) { return icons.computeIfAbsent(String.valueOf(name), n -> new Icon(n, icons.size())); }
  }
  static int drawn; static final List<Integer> counts = new ArrayList<>();
  static int[] pixels(String path) throws Exception {
    BufferedImage img = ImageIO.read(new File(path));
    int[] a = new int[65536];
    img.getRGB(0, 0, 256, 256, a, 0, 256);
    return a;
  }
  static void sweep(Reg all) {
    for (int id = 1; id < 256; id++) {
      aji b = aji.e(id);
      if (b == null || b == ajn.a) continue;
      int type = b.b();
      StringBuilder metas = new StringBuilder(), draws = new StringBuilder(), turns = new StringBuilder();
      for (int meta = 0; meta < 16; meta++) {
        for (int i = 1; i < 256; i++) { aji o = aji.e(i); if (o != null && o != ajn.a) o.a(all); }
        Reg reg = new Reg(); b.a(reg); if (id == 2) aji.e(3).a(reg);
        GL11.log.clear(); drawn = 0;
        String err = null;
        try { new blm().a(b, meta, 0.37f); } catch (Throwable t) { err = t.getClass().getSimpleName(); }
        String col = "null";
        for (String c : GL11.log) if (c.startsWith("color ")) { col = "\"" + c + "\""; break; }
        turns.append(meta == 0 ? "" : ",").append(GL11.log.contains("rotate 90.0 0.0 1.0 0.0"));
        metas.append(meta == 0 ? "" : ",").append(err != null ? "-1" : String.valueOf(drawn));
        draws.append(meta == 0 ? "" : ",").append(err != null ? "\"" + err + "\"" : col);
      }
      System.out.println("{\"kind\":\"sweep\",\"id\":" + id + ",\"renderType\":" + type + ",\"in3d\":" + blm.a(type) + ",\"quads\":[" + metas + "],\"firstColor\":[" + draws + "],\"turned\":[" + turns + "]}");
    }
  }
  // ---- entity light
  static void entity(String name, Light f, int sub, int dimension, double x, double y, double z, int[][] cells, boolean loaded, int fire) throws Exception {
    LW w = world(f, sub, dimension, cells, loaded);
    xs c = new xs(w, x, y, z);
    MobMoveProbe.field(sa.class, "e").setInt(c, fire);
    float[] t = (float[]) MobMoveProbe.field(aqo.class, "h").get(MobMoveProbe.field(ahb.class, "t").get(w));
    StringBuilder tb = new StringBuilder();
    for (int i = 0; i < 16; i++) tb.append(i == 0 ? "" : ",").append(fl(t[i]));
    float br = c.d(0.5f); int packed = c.c(0.5f);
    double minY = c.C.b, maxY = c.C.e;
    System.out.println("{\"kind\":\"entity\",\"name\":\"" + name + "\",\"sub\":" + sub + ",\"dimension\":" + dimension + ",\"pos\":[" + x + "," + y + "," + z + "],\"minY\":" + minY + ",\"maxY\":" + maxY + ",\"yOffset\":" + fl(c.L) + ",\"loaded\":" + loaded + ",\"fire\":" + fire
      + ",\"burning\":" + c.al() + ",\"brightness\":" + fl(br) + ",\"packed\":" + packed + ",\"table\":[" + tb + "]}");
  }
  // a Chunk-lit world whose sky and block light identify the cell (so the sampled cell can be read back from the packed value)
  static final Light CELL = (x, y, z) -> new int[] {(x * 5 + y * 3 + z * 7) % 16, (x * 11 + y + z * 13 + 3) % 16};
  static void other(String kind, String name, sa e, LW w) throws Exception {
    float br = e.d(0.5f); int packed = e.c(0.5f);
    System.out.println("{\"kind\":\"" + kind + "\",\"name\":\"" + name + "\",\"pos\":[" + num(e.s) + "," + num(e.t) + "," + num(e.u) + "],\"box\":[" + num(e.C.a) + "," + num(e.C.b) + "," + num(e.C.c) + "," + num(e.C.d) + "," + num(e.C.e) + "," + num(e.C.f) + "],\"yOffset\":" + fl(e.L) + ",\"brightness\":" + fl(br) + ",\"packed\":" + packed + "}");
  }
  public static void main(String[] args) throws Exception {
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    GL11.drawHook = () -> { drawn += GL11.drawCount / 4; };
    aji.p(); adb.l();
    Reg all = new Reg();
    for (int id = 1; id < 256; id++) { aji b = aji.e(id); if (b != null && b != ajn.a) b.a(all); }
    for (Icon i : all.icons.values()) { i.k += 1000; allNames.add(i.name); }
    aha.a(pixels(args[0]));
    agx.a(pixels(args[1]));
    sweep(all);
    // item icons and colours: Item.getIconFromDamageForRenderPass (adb.a(int, int)) and Item.getColorFromItemStack (adb.a(add, int)) of the sugar cane item and the tall grass block item
    for (int id : new int[] {338, 31, 83, 6, 18, 2, 106, 111}) {
      adb item = adb.d(id);
      if (item == null) continue;
      Reg reg = new Reg();
      for (int i = 1; i < 256; i++) { aji o = aji.e(i); if (o != null && o != ajn.a) o.a(reg); }
      item.a(reg);
      List<String> regNames = new ArrayList<>(reg.icons.keySet());
      for (int dmg = 0; dmg < (id == 338 ? 1 : 4); dmg++) {
        add st = new add(item, 1, dmg);
        String icon; try { rf ic = item.a(dmg, 0); icon = ic == null ? "null" : ic.g(); } catch (Throwable t) { icon = "threw " + t.getClass().getSimpleName(); }
        System.out.println("{\"kind\":\"itemIcon\",\"id\":" + id + ",\"damage\":" + dmg + ",\"class\":\"" + item.getClass().getSuperclass().getSimpleName() + "/" + item.getClass().getSimpleName() + "\",\"icon\":\"" + icon + "\",\"pass0\":" + (item.a(st, 0) & 0xFFFFFF) + ",\"pass1\":" + (item.a(st, 1) & 0xFFFFFF) + "}");
      }
    }
    int[][] none = {};
    for (int dim : new int[] {0, -1})
      for (int sub : new int[] {0, 4, 11})
        for (int sky : new int[] {0, 5, 10, 15})
          for (int blk : new int[] {0, 3, 8, 15}) {
            final int s = sky, bl = blk;
            entity("flat s" + sky + " b" + blk, (x, y, z) -> new int[] {s, bl}, sub, dim, 8.5, 65.0 + 0.35, 8.5, none, true, 0);
          }
    // y cell choice: the light changes with the row, the cart's box (0.98 x 0.7) and its yOffset 0.35 put the sample at floor(minY + 0.462)
    for (double fy : new double[] {65.0, 65.4, 65.538, 65.539, 65.99, 66.0})
      entity("rows y" + fy, (x, y, z) -> new int[] {Math.min(15, y - 60), Math.min(15, (y - 60) / 2)}, 0, 0, 8.5, fy + 0.35, 8.5, none, true, 0);
    // neighbour brightness: a slab (Block.getUseNeighborBrightness) at the cart's cell, brighter light on one side
    entity("slab neighbours", (x, y, z) -> x == 9 && y == 65 && z == 8 ? new int[] {12, 2} : new int[] {3, 1}, 0, 0, 8.5, 65.35, 8.5, new int[][] {{8, 65, 8, 44}}, true, 0);
    entity("slab neighbours above", (x, y, z) -> y == 66 ? new int[] {14, 0} : new int[] {2, 6}, 0, 0, 8.5, 65.35, 8.5, new int[][] {{8, 65, 8, 44}}, true, 0);
    entity("stairs neighbours", (x, y, z) -> x == 7 ? new int[] {9, 9} : new int[] {1, 1}, 0, 0, 8.5, 65.35, 8.5, new int[][] {{8, 65, 8, 53}}, true, 0);
    // Block.getMixedBrightnessForBlock's zero-brightness slab rule belongs to the block mesher; an entity reads World.getLightBrightnessForSkyBlocks(x, y, z, 0) directly
    entity("dark slab over light", (x, y, z) -> y < 65 ? new int[] {15, 15} : new int[] {0, 0}, 0, 0, 8.5, 65.35, 8.5, new int[][] {{8, 65, 8, 44}}, true, 0);
    entity("dark air over light", (x, y, z) -> y < 65 ? new int[] {15, 15} : new int[] {0, 0}, 0, 0, 8.5, 65.35, 8.5, none, true, 0);
    // a torch cell: block light 14 stored in the cell, the block's own lightValue is not added by getBrightnessForRender (min 0)
    entity("lit furnace cell", (x, y, z) -> x == 8 && y == 65 && z == 8 ? new int[] {0, 13} : new int[] {0, 0}, 0, 0, 8.5, 65.35, 8.5, new int[][] {{8, 65, 8, 62}}, true, 0);
    entity("opaque cell", (x, y, z) -> new int[] {0, 0}, 0, 0, 8.5, 65.35, 8.5, new int[][] {{8, 65, 8, 1}}, true, 0);
    entity("unloaded", (x, y, z) -> new int[] {15, 15}, 0, 0, 8.5, 65.35, 8.5, none, false, 0);
    int[][] none2 = {};
    for (int dir = 0; dir < 4; dir++) {
      LW w = world(CELL, 0, 0, none2, true);
      other("frame", "frame dir" + dir, new st(w, 8, 66, 8, dir), w);
    }
    for (double fy : new double[] {65.0, 65.5, 65.8, 65.83, 65.834, 65.835, 65.9, 65.99}) {
      LW w = world(CELL, 0, 0, none2, true);
      xk it = new xk(w, 8.5, fy + 0.125, 8.5);
      other("item", "item y" + fy, it, w);
    }
    entity("burning", (x, y, z) -> new int[] {2, 0}, 0, 0, 8.5, 65.35, 8.5, none, true, 40);
  }
}
