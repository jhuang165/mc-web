import java.lang.reflect.Field;
import java.util.*;

// Void fog of the unchanged 1.7.10 client. The WorldProvider answers are read from the original
// providers (aqo.j getWorldHasVoidParticles, aqo.k getVoidFogYFactor on aqq/aqp/aqr with each
// WorldType in aqo.c and hasNoSky in aqo.g). EntityRenderer.updateFogColor (blt.a(float) bytes
// 685-799) and setupFog (blt.a(int,float) bytes 410-519) need a GL client, so their arithmetic is
// transcribed from javap with the same double/float widths and replayed here; the browser tests
// compare its own port against these records. No game class is patched or shipped.
public class VoidFogProbe {
  static String json(double v) { return Double.isNaN(v) ? "null" : Float.toString((float) v); }
  public static void main(String[] args) throws Exception {
    ahm[] types = { ahm.b, ahm.c, ahm.d, ahm.e };
    String[] names = { "default", "flat", "largeBiomes", "amplified" };
    aqo[] providers = { new aqq(), new aqp(), new aqr() };
    int[] ids = { 0, -1, 1 };
    Field c = aqo.class.getDeclaredField("c"), g = aqo.class.getDeclaredField("g");
    c.setAccessible(true); g.setAccessible(true);
    double[] factors = new double[4];
    for (int p = 0; p < 3; p++) for (int t = 0; t < 4; t++) {
      aqo provider = providers[p];
      c.set(provider, types[t]); g.setBoolean(provider, p > 0);
      if (p == 0) factors[t] = provider.k();
      System.out.println("{\"case\":\"provider\",\"dimension\":" + ids[p] + ",\"worldType\":\"" + names[t] + "\",\"hasVoid\":" + provider.j() + ",\"factor\":" + provider.k() + "}");
    }
    // updateFogColor: d0 = (lastTickPosY + (posY - lastTickPosY) * partial) * factor; below 1 it is clamped at 0, squared
    // and multiplies each fog channel (as float via double). Blindness (duration < 20 eases, else 0) is not included here.
    double[] ys = { -10, -1, 0, 1, 4, 8, 16, 24, 31, 31.99, 32, 33, 63.62, 100 };
    for (int t = 0; t < 4; t += 1) for (double y : ys) {
      double d0 = (y + (y - y) * 0.5) * factors[t];
      float scale = 1;
      if (d0 < 1) { if (d0 < 0) d0 = 0; d0 *= d0; scale = (float) (1.0f * d0); }
      System.out.println("{\"case\":\"color\",\"worldType\":\"" + names[t] + "\",\"y\":" + y + ",\"scale\":" + scale + "}");
    }
    // setupFog: d0 = skyLight / 16.0 + (lastTickPosY + (posY - lastTickPosY) * partial + 4.0) / 32.0;
    // if d0 < 1: clamp at 0, square, f1 = 100.0F * (float) d0, at least 5.0F, far = min(far, f1).
    float[] fars = { 64, 128, 256 };
    for (float far : fars) for (int sky = 0; sky <= 15; sky += 3) for (double y : new double[] { -4, 0, 8, 20, 40, 63, 80, 120 }) {
      float f = far;
      double d0 = sky / 16.0 + (y + (y - y) * 1.0 + 4.0) / 32.0;
      if (d0 < 1) {
        if (d0 < 0) d0 = 0;
        d0 *= d0;
        float f1 = 100.0F * (float) d0;
        if (f1 < 5.0F) f1 = 5.0F;
        if (f > f1) f = f1;
      }
      System.out.println("{\"case\":\"far\",\"far\":" + far + ",\"sky\":" + sky + ",\"y\":" + y + ",\"result\":" + f + "}");
    }
    // WorldClient.doVoidFogParticles (bjf.b bytes 116-137): nextInt(8) > y and hasVoid spawn depthsuspend.
    for (int y = -2; y <= 10; y++) for (int roll = 0; roll < 8; roll++)
      System.out.println("{\"case\":\"particle\",\"y\":" + y + ",\"roll\":" + roll + ",\"spawns\":" + (roll > y) + "}");
  }
}
