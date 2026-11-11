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
    }
  }
}
