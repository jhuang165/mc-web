import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

// Batch 53 leafcolor. Item.getColorFromItemStack (adb.a(add, int)) of the unchanged 1.7.10 client for every registered item id 1..4095 and damage 0..15, passes 0 and 1,
// next to Block.getRenderColor (aji.i(int)) of the block behind a block item, its render type (aji.b()) and RenderBlocks.renderItemIn3d (blm.a(int)),
// with the shipped colormaps fed to ColorizerGrass/Foliage. Only ids answering a non-white colour at some damage are listed (16 values each).
public class LeafColorProbe {
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
    StringBuilder out = new StringBuilder();
    for (int id = 1; id < 4096; id++) {
      adb item = adb.d(id);
      if (item == null) continue;
      swept++;
      aji b = id < 256 ? aji.a(item) : null;
      if (b == ajn.a) b = null;
      StringBuilder p0 = new StringBuilder(), p1 = new StringBuilder(), bt = new StringBuilder();
      boolean any = false;
      for (int m = 0; m < 16; m++) {
        int c0 = 0xFFFFFF, c1 = 0xFFFFFF, ct = 0xFFFFFF;
        try { add s = new add(item, 1, m); c0 = item.a(s, 0) & 0xFFFFFF; c1 = item.a(s, 1) & 0xFFFFFF; } catch (Throwable t) { c0 = c1 = -1; }
        if (b != null) ct = b.i(m) & 0xFFFFFF;
        if (c0 != 0xFFFFFF || c1 != 0xFFFFFF || ct != 0xFFFFFF) any = true;
        String sep = m == 0 ? "" : ",";
        p0.append(sep).append(c0); p1.append(sep).append(c1); bt.append(sep).append(ct);
      }
      if (any) out.append(out.length() == 0 ? "" : ",").append("{\"id\":" + id + ",\"block\":" + (b != null) + ",\"renderType\":" + (b != null ? b.b() : -1) + ",\"in3d\":" + (b != null && blm.a(b.b())) + ",\"pass0\":[" + p0 + "],\"pass1\":[" + p1 + "],\"blockTint\":[" + bt + "]}");
    }
    System.out.println("{\"kind\":\"itemcolor\",\"swept\":" + swept + ",\"grass\":" + (aha.a(0.5, 1.0) & 0xFFFFFF) + ",\"foliage\":" + (agx.a(0.5, 1.0) & 0xFFFFFF) + ",\"pine\":" + agx.a() + ",\"birch\":" + agx.b() + ",\"basic\":" + agx.c() + ",\"items\":[" + out + "]}");
  }
}
