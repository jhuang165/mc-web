import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.util.zip.ZipFile;
import java.security.MessageDigest;
import javax.imageio.ImageIO;

// Runs the unchanged TextureUtil.anaglyphColor (bqi.a(int[])) over textures read from the original jar exactly as
// TextureUtil.func_110986_a does (ImageIO.read, BufferedImage.getRGB, ARGB ints), and prints one JSON line per texture with
// the SHA-1 of the raw and the converted ARGB array (big-endian ints) plus the first non-transparent pixel before/after.
// Arguments: texture names relative to assets/minecraft/textures/. The unzipped classes are the classpath; -Djar=<client jar> supplies the textures.
public class Anaglyph3Probe {
  static String sha1(int[] a) throws Exception {
    MessageDigest md = MessageDigest.getInstance("SHA-1");
    byte[] b = new byte[a.length * 4];
    for (int i = 0; i < a.length; i++) { b[i * 4] = (byte) (a[i] >>> 24); b[i * 4 + 1] = (byte) (a[i] >>> 16); b[i * 4 + 2] = (byte) (a[i] >>> 8); b[i * 4 + 3] = (byte) a[i]; }
    StringBuilder sb = new StringBuilder();
    for (byte x : md.digest(b)) sb.append(String.format("%02x", x));
    return sb.toString();
  }
  public static void main(String[] names) throws Exception {
    // bqi.<clinit> uploads the missing texture, which reads Minecraft.getMinecraft().gameSettings.anaglyph (bqi.b). The stub bao/bbj below
    // (declared after this class; the probe directory comes first on the classpath) only supply that one field, so no launcher
    // libraries are needed. bqi.a(int[]) is the unchanged class.
    bbj settings = new bbj(); bao.M = new bao(); bao.M.u = settings; settings.e = true;
    ZipFile zip = new ZipFile(System.getProperty("jar"));
    for (String n : names) {
      try (InputStream in = zip.getInputStream(zip.getEntry("assets/minecraft/textures/" + n))) {
        BufferedImage img = ImageIO.read(in);
        int w = img.getWidth(), h = img.getHeight();
        int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        int[] out = bqi.a(px); // bqi.a(int[]) is TextureUtil.anaglyphColor: it does not read the flag, which only gates the upload (bqi.b)
        int first = -1, translucent = 0;
        for (int i = 0; i < px.length; i++) { int al = px[i] >>> 24; if (al > 0 && al < 255) translucent++; if (first < 0 && al > 0) first = i; }
        System.out.println(String.format("{\"name\":\"%s\",\"w\":%d,\"h\":%d,\"type\":%d,\"translucent\":%d,\"raw\":\"%s\",\"conv\":\"%s\",\"first\":[%d,%d,%d]}",
          n, w, h, img.getType(), translucent, sha1(px), sha1(out), first, first < 0 ? 0 : px[first], first < 0 ? 0 : out[first]));
      }
    }
  }
}

class bbj { public boolean e; }
class bao { static bao M; public bbj u; public static bao B() { return M; } }
