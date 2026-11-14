import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.lang.reflect.Proxy;
import java.util.*;
import java.util.zip.ZipFile;
import javax.imageio.ImageIO;

// Runs the unchanged Stitcher (bpv, with Stitcher.Holder bpw and Stitcher.Slot bpx) and TextureAtlasSprite.initSprite (bqd) the way
// TextureMap.loadTextureAtlas (bpz.b(IResourceManager)) drives them, for the sprite sets that TextureMap.registerIcons (bpz.g(), bytecode-read)
// collects: type 0 (blocks) = every Block with a non-air material through Block.registerBlockIcons (aji.a(rg), executed on the bootstrapped
// registry), plus RenderGlobal.registerDestroyStages (destroy_stage_0..9) and RenderItemFrame (itemframe_background) (both bytecode-read: they
// need a live client); type 1 (items) = every Item whose getSpriteNumber() (adb.d()) is 1 through Item.registerIcons (adb.a(rg), executed).
// loadTextureAtlas adds the missingno sprite last, as a 16x16 sprite (mipmap level 0..4: the 16x16 image of bqi.b). Sprite sizes come from the
// jar PNGs as the first square frame (animation strips are width x width frames), the mipmap level drops to the lowest sprite's log2
// (qh.c) as in the bytecode. Prints one JSON line per (type, mipmap level): atlas size, then per sprite name, x, y, w, h and the
// minU/maxU/minV/maxV that getMinU/getMaxU/getMinV/getMaxV return after initSprite (the Stitcher's slot origin, rotation flag false).
// Arguments: -Djar=<client jar>. GL_MAX_TEXTURE_SIZE comes from bao.D() on the real client; 16384 is used here (the layout only depends on
// it when the sprites overflow it).
public class StitcherProbe {
  static class Sprite extends bqd { Sprite(String n) { super(n); } }

  static List<String> collect(int type) {
    LinkedHashSet<String> names = new LinkedHashSet<>();
    rg reg = (rg) Proxy.newProxyInstance(rg.class.getClassLoader(), new Class<?>[] { rg.class }, (p, m, a) -> {
      if (m.getName().equals("a") && a != null && a.length == 1 && a[0] instanceof String) {
        names.add((String) a[0]);
        return Proxy.newProxyInstance(rf.class.getClassLoader(), new Class<?>[] { rf.class }, (p2, m2, a2) -> m2.getReturnType() == float.class ? (Object) 0f : m2.getReturnType() == int.class ? (Object) 0 : null);
      }
      return null;
    });
    if (type == 0) {
      for (Object o : aji.c) { aji b = (aji) o; if (b.o() != awt.a) b.a(reg); }
      for (int i = 0; i < 10; i++) names.add("destroy_stage_" + i);
      names.add("itemframe_background");
    }
    for (Object o : adb.e) { adb it = (adb) o; if (it != null && it.d() == type) it.a(reg); }
    return new ArrayList<>(names);
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    ZipFile zip = new ZipFile(System.getProperty("jar"));
    spriteNumbers();
    for (int type = 0; type < 2; type++) {
      String dir = type == 0 ? "blocks" : "items";
      List<String> names = collect(type);
      Map<String, int[]> dims = new HashMap<>();
      List<String> missing = new ArrayList<>();
      for (String n : names) {
        String path = "assets/minecraft/textures/" + dir + "/" + n + ".png";
        if (zip.getEntry(path) == null) { missing.add(n); continue; }
        try (InputStream in = zip.getInputStream(zip.getEntry(path))) {
          BufferedImage img = ImageIO.read(in);
          dims.put(n, new int[] { img.getWidth(), Math.min(img.getHeight(), img.getWidth()) });
        }
      }
      for (int mip : new int[] { 0, 1, 2, 3, 4 }) {
        bpv st = new bpv(16384, 16384, true, 0, mip);
        int minDim = Integer.MAX_VALUE;
        Map<String, Sprite> sprites = new LinkedHashMap<>();
        for (String n : names) {
          int[] d = dims.get(n);
          if (d == null) continue;
          Sprite s = new Sprite(n); s.b(d[0]); s.c(d[1]);
          minDim = Math.min(minDim, Math.min(d[0], d[1]));
          st.a(s); sprites.put(n, s);
        }
        int level = Math.min(mip, qh.c(minDim));
        Sprite miss = new Sprite("missingno"); miss.b(16); miss.c(16); st.a(miss); sprites.put("missingno", miss);
        st.c();
        StringBuilder sb = new StringBuilder("{\"type\":\"" + dir + "\",\"mip\":" + mip + ",\"levels\":" + level + ",\"width\":" + st.a() + ",\"height\":" + st.b() + ",\"missingFiles\":" + missing.size() + ",\"sprites\":[");
        boolean first = true;
        for (Object o : st.d()) {
          bqd s = (bqd) o;
          sb.append(first ? "" : ",").append("[\"").append(s.g()).append("\",").append(s.h()).append(",").append(s.i()).append(",").append(s.a()).append(",").append(s.b())
            .append(",").append(s.c()).append(",").append(s.d()).append(",").append(s.e()).append(",").append(s.f()).append("]");
          first = false;
        }
        System.out.println(sb.append("]}"));
        if (mip == 0 && type == 0) System.err.println("blocks missing png: " + missing);
        if (mip == 0 && type == 1) System.err.println("items missing png: " + missing);
      }
      hdCases(dir, names, dims);
    }
  }

  // Batch 64 (atlas3): Item.getSpriteNumber() (adb.d()) of every registered item, which decides the TextureMap an item's icon is registered on and drawn from (0 = blocks,
  // 1 = items). One "SN " line: for each item id, the class name and the sprite number.
  static void spriteNumbers() {
    StringBuilder sb = new StringBuilder("SN [");
    boolean first = true;
    for (int id = 0; id < 4096; id++) {
      adb it = adb.d(id);
      if (it == null) continue;
      sb.append(first ? "" : ",").append("[").append(id).append(",\"").append(it.getClass().getName()).append("\",").append(it.d()).append(",\"").append(it.getClass().getSuperclass().getName()).append("\"]");
      first = false;
    }
    System.out.println(sb.append("]"));
  }

  // Batch 64 (atlas3): the same Stitcher driven with resource-pack sprite sizes (HD packs, mixed sizes, a tiny sprite), the way loadTextureAtlas does for the pack's PNGs.
  // Each case gives every sprite a square size (size = rule(index, name)); output lines start with "HD " and carry the input sizes, the atlas size, the mipmap levels
  // limit (min(mip, qh.c(smallest size))) and per sprite x, y, w, h, rotated and (for the first sprites) the initSprite uv.
  static int sizeOf(String rule, int index, String name, int base) {
    switch (rule) {
      case "x2": return base * 2;
      case "x4": return base * 4;
      case "x8": return base * 8;
      case "mixed": return index % 7 == 3 ? base * 4 : index % 11 == 5 ? base * 2 : base;
      case "oneBig": return index == 0 ? 128 : base;
      case "tiny": return index == 2 ? 8 : index % 5 == 1 ? base * 2 : base;
      case "hdTiny": return index == 4 ? 8 : base * 4;
      case "wide": return index % 3 == 0 ? base * 8 : index % 3 == 1 ? base * 2 : base;
      default: return base;
    }
  }

  static void hdCases(String dir, List<String> names, Map<String, int[]> dims) {
    String[] rules = { "x2", "x4", "x8", "mixed", "oneBig", "tiny", "hdTiny", "wide" };
    List<String> present = new ArrayList<>();
    for (String n : names) if (dims.get(n) != null) present.add(n);
    for (String rule : rules) {
      for (int mip : new int[] { 0, 4 }) {
        bpv st = new bpv(16384, 16384, true, 0, mip);
        Map<String, Sprite> sprites = new LinkedHashMap<>();
        StringBuilder in = new StringBuilder();
        int minDim = Integer.MAX_VALUE;
        for (int i = 0; i < present.size(); i++) {
          String n = present.get(i);
          int size = sizeOf(rule, i, n, dims.get(n)[0]);
          Sprite s = new Sprite(n); s.b(size); s.c(size);
          minDim = Math.min(minDim, size);
          st.a(s); sprites.put(n, s);
          in.append(i == 0 ? "" : ",").append("[\"").append(n).append("\",").append(size).append("]");
        }
        int level = Math.min(mip, qh.c(minDim));
        Sprite miss = new Sprite("missingno"); miss.b(16); miss.c(16); st.a(miss);
        minDim = Math.min(minDim, 16);
        level = Math.min(mip, qh.c(minDim));
        in.append(",[\"missingno\",16]");
        st.c();
        StringBuilder sb = new StringBuilder("HD {\"type\":\"" + dir + "\",\"rule\":\"" + rule + "\",\"mip\":" + mip + ",\"levels\":" + level + ",\"width\":" + st.a() + ",\"height\":" + st.b() + ",\"input\":[" + in + "],\"sprites\":[");
        boolean first = true; int k = 0;
        for (Object o : st.d()) {
          bqd s = (bqd) o;
          sb.append(first ? "" : ",").append("[\"").append(s.g()).append("\",").append(s.h()).append(",").append(s.i()).append(",").append(s.a()).append(",").append(s.b());
          if (k < 6) sb.append(",").append(s.c()).append(",").append(s.d()).append(",").append(s.e()).append(",").append(s.f());
          sb.append("]");
          first = false; k++;
        }
        System.out.println(sb.append("]}"));
      }
    }
  }
}
