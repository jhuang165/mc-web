import java.awt.image.BufferedImage;
import java.util.*;

// b73 skins73: feed test images through the unchanged 1.7.10 ImageBufferDownload (bmc).a(BufferedImage), i.e. parseUserSkin,
// and print the input and output ARGB pixels (big-endian ints, base64) one JSON record per case.
public class SkinParseProbe {
  static long seed = 12345;
  static int rnd() { seed = (seed * 6364136223846793005L + 1442695040888963407L); return (int) (seed >>> 33); }
  interface Gen { int px(int x, int y, int r); }
  static BufferedImage image(int w, int h, Gen g) {
    BufferedImage im = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) im.setRGB(x, y, g.px(x, y, rnd()));
    return im;
  }
  static String b64(int[] a) {
    byte[] b = new byte[a.length * 4];
    for (int i = 0; i < a.length; i++) { b[i*4] = (byte)(a[i] >>> 24); b[i*4+1] = (byte)(a[i] >>> 16); b[i*4+2] = (byte)(a[i] >>> 8); b[i*4+3] = (byte) a[i]; }
    return Base64.getEncoder().encodeToString(b);
  }
  static int[] pixels(BufferedImage im) { return im.getRGB(0, 0, im.getWidth(), im.getHeight(), null, 0, im.getWidth()); }
  static boolean inHat(int x, int y) { return x >= 32 && y < 32; }
  static boolean inHeadBase(int x, int y) { return x < 32 && y < 16; }
  static void run(String name, BufferedImage in) throws Exception {
    BufferedImage out = in == null ? null : new bmc().a(in);
    StringBuilder sb = new StringBuilder("{\"case\":\"" + name + "\"");
    if (in != null) sb.append(",\"width\":" + in.getWidth() + ",\"height\":" + in.getHeight() + ",\"input\":\"" + b64(pixels(in)) + "\"");
    if (out == null) sb.append(",\"output\":null");
    else sb.append(",\"outWidth\":" + out.getWidth() + ",\"outHeight\":" + out.getHeight() + ",\"outType\":" + out.getType() + ",\"output\":\"" + b64(pixels(out)) + "\"");
    System.out.println(sb + "}");
  }
  public static void main(String[] args) throws Exception {
    int[] alphas = {0, 1, 127, 128, 200, 255};
    // opaque random colours everywhere
    run("opaque", image(64, 32, (x, y, r) -> 0xff000000 | (r & 0xffffff)));
    // random alpha from a set, random colours: head/body/limbs are forced opaque, hat cleared only when no pixel is below 128
    run("random-alpha", image(64, 32, (x, y, r) -> (alphas[(r >>> 24 & 0x7f) % alphas.length] << 24) | (r & 0xffffff)));
    // hat area (32..63 x 0..31) all alpha 255 => cleared; every other area untouched except forced opaque
    run("hat-all-opaque", image(64, 32, (x, y, r) -> 0xff000000 | (r & 0xffffff)));
    // hat area: one pixel at alpha 127 => whole hat area kept as drawn
    run("hat-one-127", image(64, 32, (x, y, r) -> (inHat(x, y) && x == 40 && y == 5 ? 127 : 255) << 24 | (r & 0xffffff)));
    // hat area: one pixel at alpha 128 => counts as opaque => cleared
    run("hat-one-128", image(64, 32, (x, y, r) -> (inHat(x, y) && x == 40 && y == 5 ? 128 : 255) << 24 | (r & 0xffffff)));
    // hat area: one pixel alpha 0 with colour
    run("hat-one-0", image(64, 32, (x, y, r) -> (inHat(x, y) && x == 63 && y == 31 ? 0 : 255) << 24 | (r & 0xffffff)));
    // fully transparent skin: head and body come out opaque black; the hat area stays transparent (all below 128)
    run("transparent", image(64, 32, (x, y, r) -> 0x00000000));
    // transparent with colour bits set (alpha 0, rgb nonzero)
    run("transparent-rgb", image(64, 32, (x, y, r) -> r & 0xffffff));
    // head base (0..31 x 0..15) with alpha 0, rest opaque
    run("head-transparent", image(64, 32, (x, y, r) -> (inHeadBase(x, y) ? 0 : 255) << 24 | (r & 0xffffff)));
    // alpha ramp x, to see how partial alpha is composited into the buffer
    run("alpha-ramp", image(64, 32, (x, y, r) -> ((x * 4 + (y & 3)) & 255) << 24 | (r & 0xffffff)));
    // modern 64 x 64: only the top 64 x 32 survives
    run("modern-64x64", image(64, 64, (x, y, r) -> (alphas[(r >>> 24 & 0x7f) % alphas.length] << 24) | (r & 0xffffff)));
    // sizes the port does not accept: drawn at 0,0, padded or clipped
    run("small-32x32", image(32, 32, (x, y, r) -> 0xff000000 | (r & 0xffffff)));
    run("large-96x48", image(96, 48, (x, y, r) -> (alphas[(r >>> 24 & 0x7f) % alphas.length] << 24) | (r & 0xffffff)));
    run("null", null);
  }
}
