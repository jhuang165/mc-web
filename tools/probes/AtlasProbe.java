import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.util.zip.ZipFile;
import java.security.MessageDigest;
import javax.imageio.ImageIO;

// Runs the unchanged TextureUtil.generateMipmapData (bqi.a(int, int, int[][])) and TextureUtil.anaglyphColor (bqi.a(int[])) over block
// and item textures from the original jar (both TextureMaps upload through the same TextureUtil path), read as TextureMap/TextureUtil.func_110986_a do (ImageIO.read, BufferedImage.getRGB, ARGB ints; the
// first frame of an animation strip). Per texture and mip setting (levels 0, 1, 4) it prints the SHA-1 of each level's ARGB ints and of
// each level after anaglyphColor (what the upload funnel sends to GL when 3D Anaglyph is on), as one JSON line.
// Arguments: texture names relative to assets/minecraft/textures/. -Djar=<client jar>.
public class AtlasProbe {
  static String sha1(int[] a) throws Exception {
    MessageDigest md = MessageDigest.getInstance("SHA-1");
    byte[] b = new byte[a.length * 4];
    for (int i = 0; i < a.length; i++) { b[i * 4] = (byte) (a[i] >>> 24); b[i * 4 + 1] = (byte) (a[i] >>> 16); b[i * 4 + 2] = (byte) (a[i] >>> 8); b[i * 4 + 3] = (byte) a[i]; }
    StringBuilder sb = new StringBuilder();
    for (byte x : md.digest(b)) sb.append(String.format("%02x", x));
    return sb.toString();
  }
  public static void main(String[] names) throws Exception {
    bbj settings = new bbj(); bao.M = new bao(); bao.M.u = settings; settings.e = true;
    ZipFile zip = new ZipFile(System.getProperty("jar"));
    int[] settingsLevels = { 0, 1, 4 };
    for (String n : names) {
      try (InputStream in = zip.getInputStream(zip.getEntry("assets/minecraft/textures/" + n))) {
        BufferedImage img = ImageIO.read(in);
        int w = img.getWidth(), h = Math.min(img.getHeight(), w);
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        int translucent = 0;
        for (int p : px) { int al = p >>> 24; if (al > 0 && al < 255) translucent++; }
        StringBuilder sb = new StringBuilder(String.format("{\"name\":\"%s\",\"w\":%d,\"translucent\":%d,\"levels\":{", n, w, translucent));
        for (int s = 0; s < settingsLevels.length; s++) {
          int lv = settingsLevels[s];
          int[][] data = new int[lv + 1][];
          data[0] = px;
          int[][] out = bqi.a(lv, w, data);
          sb.append(s > 0 ? "," : "").append("\"").append(lv).append("\":{\"raw\":[");
          for (int l = 0; l < out.length; l++) sb.append(l > 0 ? "," : "").append("\"").append(sha1(out[l])).append("\"");
          sb.append("],\"conv\":[");
          for (int l = 0; l < out.length; l++) sb.append(l > 0 ? "," : "").append("\"").append(sha1(bqi.a(out[l].clone()))).append("\"");
          sb.append("]}");
        }
        System.out.println(sb.append("}}"));
      }
    }
  }
}

class bbj { public boolean e; }
class bao { static bao M; public bbj u; public static bao B() { return M; } }
