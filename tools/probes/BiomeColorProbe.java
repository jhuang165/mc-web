import java.awt.image.BufferedImage;
import java.io.File;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import javax.imageio.ImageIO;

// Records the unchanged 1.7.10 biome colour functions, one JSON record per line (obfuscated names in comments):
//   colormaps  ColorizerGrass.setGrassBiomeColorizer (aha.a(int[])) and ColorizerFoliage.setFoliageBiomeColorizer
//              (agx.a(int[])) are fed the pixels of the shipped colormap/*.png (args 0 and 1); the pine, birch and basic
//              foliage constants (agx.a/b/c) are read.
//   biome      per BiomeGenBase slot (ahu.n()): water multiplier (aq), and at sample positions BiomeGenBase.getFloatTemperature
//              (a(III)), getBiomeGrassColor (b(III)), getBiomeFoliageColor (c(III)), getSkyColorByTemp (a(F)) of that temperature,
//              plus getFloatRainfall (i()).
//              canSpawnLightningBolt (e()), getEnableSnow (d()), isSnowyBiome (j()) and getIntRainfall (h()), which EntityRenderer.renderRainSnow
//              (blt.e) and World.canLightningStrikeAt read.
//   swamp      BiomeGenSwamp.getBiomeGrassColor on a coarse grid (the static noise ad).
//   block      Block.colorMultiplier (d(IBlockAccess, x, y, z)) of grass, leaves, leaves2, vine, reeds, tallgrass, double plant,
//              water, lava and the lily pad on a synthetic biome map (a java.lang.reflect.Proxy IBlockAccess whose getBiomeGenForCoords
//              (a(II)) and metadata (e(III)) are the map), with the 3x3 biome slots in the order the block reads them, and the item colours
//              (D() and i(meta)).
public class BiomeColorProbe {
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static int[] pixels(String path) throws Exception {
    BufferedImage img = ImageIO.read(new File(path));
    int[] a = new int[65536];
    img.getRGB(0, 0, 256, 256, a, 0, 256);
    return a;
  }
  static java.lang.reflect.Field field(Class<?> c, String name) throws Exception { java.lang.reflect.Field f = c.getDeclaredField(name); f.setAccessible(true); return f; }
  static int mask(int c) { return c & 0xFFFFFF; }
  // The synthetic biome map: a deterministic scatter over the registered slots.
  static int[] slots;
  static int slotAt(int x, int z) {
    long h = (long) x * 341873128712L + (long) z * 132897987541L + (long) x * z * 31L;
    h ^= h >>> 13; h *= 0x9E3779B97F4A7C15L; h ^= h >>> 29;
    return slots[(int) Math.floorMod(h, (long) slots.length)];
  }
  static ahl world(final int meta, final int bottomMeta, final boolean uniform, final int uniformSlot) {
    return (ahl) Proxy.newProxyInstance(BiomeColorProbe.class.getClassLoader(), new Class[] { ahl.class }, new InvocationHandler() {
      public Object invoke(Object p, Method m, Object[] a) {
        Class<?>[] t = m.getParameterTypes();
        if (m.getName().equals("a") && t.length == 2 && t[0] == int.class) return ahu.n()[uniform ? uniformSlot : slotAt((Integer) a[0], (Integer) a[1])];
        if (m.getName().equals("e") && t.length == 3 && t[0] == int.class) return ((Integer) a[1]) < 64 ? bottomMeta : meta;
        if (m.getReturnType() == int.class) return 0;
        if (m.getReturnType() == boolean.class) return false;
        return null;
      }
    });
  }
  static String ints(int[] a) {
    StringBuilder b = new StringBuilder("[");
    for (int i = 0; i < a.length; i++) b.append(i == 0 ? "" : ",").append(a[i]);
    return b.append("]").toString();
  }
  public static void main(String[] args) throws Exception {
    aji.p();
    aha.a(pixels(args[0]));
    agx.a(pixels(args[1]));
    System.out.println("{\"kind\":\"colormaps\",\"pine\":" + agx.a() + ",\"birch\":" + agx.b() + ",\"basic\":" + agx.c() + ",\"grassItem\":" + mask(aha.a(0.5, 1.0)) + ",\"foliageItem\":" + mask(agx.a(0.5, 1.0)) + "}");
    int n = 0;
    for (int i = 0; i < 256; i++) if (ahu.n()[i] != null) n++;
    slots = new int[n];
    n = 0;
    for (int i = 0; i < 256; i++) if (ahu.n()[i] != null) slots[n++] = i;
    // ---- biomes
    int[][] positions = { { 0, 63, 0 }, { 13, 64, -7 }, { 100, 70, 100 }, { -250, 80, 31 }, { 1234, 95, -987 }, { 5, 120, 5 }, { -77, 160, 4096 }, { 640, 200, -640 }, { 31, 255, 17 } };
    for (int i = 0; i < 256; i++) {
      ahu b = ahu.n()[i];
      if (b == null) continue;
      String type = "base";
      int parent = -1;
      if (b instanceof ail) type = "mesa";
      else if (b instanceof aiv) type = "swamp";
      else if (b instanceof ain) { type = "mutated"; ahu pb = (ahu) field(ain.class, "aD").get(b); for (int j = 0; j < 256; j++) if (ahu.n()[j] == pb) parent = j; }
      else if (b instanceof aif) type = ((Integer) field(aif.class, "aF").get(b)) == 3 ? "roofed" : "base";
      StringBuilder s = new StringBuilder("{\"kind\":\"biome\",\"slot\":" + i + ",\"colorType\":" + q(type) + ",\"parent\":" + parent + ",\"id\":" + b.ay + ",\"name\":" + q(String.valueOf(b.af)) + ",\"class\":" + q(b.getClass().getName()) + ",\"water\":" + mask(b.aq) + ",\"canSpawnLightning\":" + b.e() + ",\"enableSnow\":" + b.d() + ",\"snowy\":" + b.j() + ",\"rainfallInt\":" + b.h() + ",\"temperature\":" + b.ao + ",\"rainfall\":" + b.ap + ",\"samples\":[");
      for (int k = 0; k < positions.length; k++) {
        int[] p = positions[k];
        float t = b.a(p[0], p[1], p[2]);
        s.append(k == 0 ? "" : ",").append("[" + p[0] + "," + p[1] + "," + p[2] + "," + Float.toString(t) + "," + mask(b.b(p[0], p[1], p[2])) + "," + mask(b.c(p[0], p[1], p[2])) + "," + (b.a(t) & 0xFFFFFF) + "]");
      }
      System.out.println(s.append("]}"));
    }
    // ---- swamp noise: grass colour on a grid around the origin (6 = swamp, 134 = swamp M when present)
    StringBuilder g = new StringBuilder("{\"kind\":\"swamp\",\"cells\":[");
    boolean first = true;
    for (int x = -400; x <= 400; x += 37) for (int z = -400; z <= 400; z += 41) {
      g.append(first ? "" : ",").append("[" + x + "," + z + "," + mask(ahu.n()[6].b(x, 70, z)) + "]");
      first = false;
    }
    System.out.println(g.append("]}"));
    // ---- blocks on the synthetic map
    int[][] cells = { { 0, 70, 0 }, { 3, 64, 5 }, { -9, 70, 12 }, { 100, 90, -45 }, { -250, 66, 31 }, { 1234, 70, -987 }, { 17, 64, 17 }, { -33, 72, 90 }, { 640, 70, 640 }, { 7, 100, -7 }, { 55, 64, 55 }, { -401, 70, -17 } };
    int[][] blocks = { { 2, 0 }, { 18, 0 }, { 18, 1 }, { 18, 2 }, { 18, 3 }, { 161, 0 }, { 161, 1 }, { 106, 0 }, { 83, 0 }, { 31, 0 }, { 31, 1 }, { 31, 2 }, { 175, 0 }, { 175, 1 }, { 175, 2 }, { 175, 3 }, { 175, 4 }, { 175, 5 }, { 175, 10 }, { 8, 0 }, { 9, 0 }, { 10, 0 }, { 11, 0 }, { 111, 0 } };
    for (int[] bl : blocks) {
      aji block = aji.e(bl[0]);
      int id = bl[0], meta = bl[1];
      // A double plant's upper half (meta bit 8) reads the lower half's metadata one cell below.
      int top = meta == 10 ? 10 : meta;
      for (int[] c : cells) {
        ahl w = world(top, id == 175 && meta >= 8 ? 3 : meta, false, 0);
        int[] biomes = new int[9];
        for (int dz = -1; dz <= 1; dz++) for (int dx = -1; dx <= 1; dx++) biomes[(dz + 1) * 3 + dx + 1] = ahu_slot(slotAt(c[0] + dx, c[2] + dz));
        System.out.println("{\"kind\":\"block\",\"block\":" + id + ",\"meta\":" + meta + ",\"pos\":[" + c[0] + "," + c[1] + "," + c[2] + "],\"biomes\":" + ints(biomes) + ",\"color\":" + mask(block.d(w, c[0], c[1], c[2])) + "}");
      }
      System.out.println("{\"kind\":\"item\",\"block\":" + id + ",\"meta\":" + meta + ",\"D\":" + mask(block.D()) + ",\"i\":" + mask(block.i(meta)) + "}");
    }
  }
  static int ahu_slot(int s) { return s; }
}
