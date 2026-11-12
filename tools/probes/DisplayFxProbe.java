import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

// Batch 52 displayfx. Two record sets from the unchanged 1.7.10 client, written by tools/verify-displayfx.mjs to public/research/displayfx-reference.json:
//   tint    Block.getRenderColor (aji.i(int)), the colour RenderBlocks.renderBlockAsItem (blm.a(aji, int, float)) multiplies a display block by, of every registered block id 1..255
//           and metadata 0..15, after ColorizerGrass.setGrassBiomeColorizer (aha.a(int[])) and ColorizerFoliage.setFoliageBiomeColorizer (agx.a(int[])) are fed the shipped
//           colormap PNGs. Colours are masked to 0xFFFFFF; only ids that answer something other than white at any meta are listed (16 values each), with the block's render
//           type (aji.b()) and the count of registered ids swept.
//   splash  EntityBoat.onUpdate's client splash block (xi.h, before the isRemote branch) on boats set to speeds around 0.2625 (the BoatProbe map-backed world, Boat.rand = Random(7));
//           the records are BoatProbe "travel" records, whose ticks carry the state at the end of each tick and the spawnParticle calls of that tick.
public class DisplayFxProbe extends BoatProbe {
  static int[] pixels(String path) throws Exception {
    BufferedImage img = ImageIO.read(new File(path));
    int[] a = new int[65536];
    img.getRGB(0, 0, 256, 256, a, 0, 256);
    return a;
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); PlantProbe.unsafe = MobMoveProbe.unsafe();
    aha.a(pixels(args[0]));
    agx.a(pixels(args[1]));
    int swept = 0;
    StringBuilder tint = new StringBuilder();
    for (int id = 1; id < 256; id++) {
      aji b = aji.e(id);
      if (b == null || b == ajn.a) continue;
      swept++;
      StringBuilder v = new StringBuilder(); boolean any = false;
      for (int m = 0; m < 16; m++) { int c = b.i(m) & 0xFFFFFF; if (c != 0xFFFFFF) any = true; v.append(m == 0 ? "" : ",").append(c); }
      if (any) tint.append(tint.length() == 0 ? "" : ",").append("{\"id\":" + id + ",\"renderType\":" + b.b() + ",\"colors\":[" + v + "]}");
    }
    System.out.println("{\"kind\":\"tint\",\"swept\":" + swept + ",\"grass\":" + (aha.a(0.5, 1.0) & 0xFFFFFF) + ",\"foliage\":" + (agx.a(0.5, 1.0) & 0xFFFFFF) + ",\"pine\":" + agx.a() + ",\"birch\":" + agx.b() + ",\"basic\":" + agx.c() + ",\"blocks\":[" + tint + "]}");
    int[][] pool = water(-4, 44, -4, 4);
    double up = Math.nextUp(0.26249999999999996);
    // pool cases: the boat is already in the water on its first tick, so no water-entry particles interleave with the splash draws.
    splash("at-threshold", pool, new double[] {0.5, 1.0, 0.5, 0.26249999999999996, 0, 0}, -90, 12);
    splash("just-above", pool, new double[] {0.5, 1.0, 0.5, up, 0, 0}, -90, 12);
    splash("fast-x", pool, new double[] {0.5, 1.0, 0.5, 0.4, 0, 0}, -90, 40);
    splash("fast-z-yaw0", pool, new double[] {0.5, 1.0, 0.5, 0, 0, 0.35}, 0, 30);
    splash("diagonal", pool, new double[] {0.5, 1.0, 0.5, 0.2, 0, 0.2}, 45, 30);
    splash("negative-x-yaw-213", pool, new double[] {20.5, 1.0, 0.5, -0.3, 0, 0.1}, 213.5f, 30);
    splash("max-ridden-speed", pool, new double[] {0.5, 1.0, 0.5, 0.35, 0, 0}, -90, 20);
    splash("slow-no-splash", pool, new double[] {0.5, 1.0, 0.5, 0.2, 0, 0}, -90, 20);
    // no water test: a boat in the air with the same motion draws the same splash on its first tick.
    splash("dry-air", new int[][] {}, new double[] {0.5, 4.0, 0.5, 0.4, 0, 0}, -90, 3);
  }
  static void splash(String name, int[][] cells, double[] spawn, float yaw, int count) throws Exception {
    travel(name, cells, spawn, yaw, yaw, 0, 0, false, count);
  }
}
