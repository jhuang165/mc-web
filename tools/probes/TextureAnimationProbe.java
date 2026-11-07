import java.awt.image.BufferedImage;
import java.util.*;
import com.google.gson.*;
// Unchanged AnimationMetadataSectionSerializer [bsb], AnimationMetadataSection [bsa] and TextureAtlasSprite [bqd]
// from the 1.7.10 client. Each case parses a ".png.mcmeta" text through bsb, loads a blank image strip into the sprite
// with bqd.a(BufferedImage[], bsa, boolean) (loadSprite) and runs TextureAtlasSprite.updateAnimation [bqd.j] for N ticks,
// recording the frame index that is displayed after every tick (bsa.c(frameCounter)). The upload of a changed frame
// reaches LWJGL and fails with no GL context; the counters are advanced before it, so the exception is swallowed.
// tools/verify-texture-animation.mjs writes public/research/texture-animation-reference.json; src/texture-animation.test.js replays it.
public class TextureAnimationProbe {
  static class Sprite extends bqd {
    Sprite() { super("probe"); }
    int frameCounter() { return g; }
    int tickCounter() { return h; }
  }
  static String esc(String s) { return s == null ? "null" : new JsonPrimitive(s).toString(); }
  public static void main(String[] args) throws Exception {
    // name \t image width \t image height \t ticks \t mcmeta (or "-" for none)
    for (String line : new String(System.in.readAllBytes(), "UTF-8").split("\n")) {
      if (line.isBlank()) continue;
      String[] p = line.split("\t", 5);
      String name = p[0]; int w = Integer.parseInt(p[1]), h = Integer.parseInt(p[2]), ticks = Integer.parseInt(p[3]);
      String mcmeta = p[4].equals("-") ? null : p[4];
      StringBuilder out = new StringBuilder("{\"name\":" + esc(name) + ",\"mcmeta\":" + esc(mcmeta) + ",\"width\":" + w + ",\"height\":" + h + ",\"ticks\":" + ticks);
      bsa meta = null;
      try {
        if (mcmeta != null) {
          JsonObject root = new JsonParser().parse(mcmeta).getAsJsonObject();
          JsonElement sec = root.get("animation");
          if (sec != null) meta = new bsb().a(sec, null, null);
        }
      } catch (Throwable t) { out.append(",\"parseError\":" + esc(t.getClass().getSimpleName() + ": " + t.getMessage())); }
      if (meta != null) {
        out.append(",\"meta\":{\"frametime\":" + meta.d() + ",\"width\":" + meta.b() + ",\"height\":" + meta.a() + ",\"frames\":[");
        for (int i = 0; i < meta.c(); i++) out.append((i > 0 ? "," : "") + "[" + meta.c(i) + "," + (meta.b(i) ? meta.a(i) : -1) + "]");
        out.append("]}");
      }
      if (!out.toString().contains("parseError")) {
        Sprite s = new Sprite();
        try {
          s.a(new BufferedImage[] { new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB) }, meta, false);
          // After loadSprite: meta stays null for non-animations (the sprite then has a single frame).
          out.append(",\"frames\":[");
          if (meta == null) out.append("0"); else {
            // bqd.j() reads bsa through its private field, which loadSprite set; run the real tick.
            for (int t = 0; t < ticks; t++) {
              int shown = frameIndex(s, t);
              out.append((t > 0 ? "," : "") + shown);
              try { s.j(); } catch (Throwable ignore) { }
            }
          }
          out.append("]");
        } catch (Throwable t) { out.append(",\"loadError\":" + esc(t.getClass().getSimpleName() + ": " + t.getMessage())); }
      }
      System.out.println(out + "}");
    }
  }
  static bsa spriteMeta(Sprite s) throws Exception { java.lang.reflect.Field f = bqd.class.getDeclaredField("j"); f.setAccessible(true); return (bsa) f.get(s); }
  static int frameIndex(Sprite s, int t) throws Exception { return spriteMeta(s).c(s.frameCounter()); }
}
