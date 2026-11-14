import java.util.*;

// Minecraft Java 1.7.10 RenderFish (bns) line endpoint, replayed from its bytecode (javap -c -p bns, doRender(xe, d, d, d, f, f)).
// The renderer itself needs LWJGL and a Tessellator, so this probe transcribes its arithmetic statement by statement, in float and
// double exactly as the bytecode does, and runs the UNCHANGED game classes for the parts that are plain data: azw (Vec3.rotateAroundX
// and rotateAroundY, a(F) and b(F)), qh (MathHelper sin/cos table and sqrt), and EntityPlayer.getEyeHeight (yz.g, constructed without
// running its constructor). Branches: first person (the angler is the local player and the view is first person): the hand vector
// (-0.5, 0.03, 0.8) turned by pitch, yaw and the swing offsets; any other view: the angler's renderYawOffset, with the eye height
// term 0 for the local player and getEyeHeight (0.12) for another player. The 17 points are the sagging curve from the hook (i = 0)
// to the tip (i = 16), as vertex offsets from the camera-relative render position.
public class FishLineProbe {
  public static class Pl extends yz {
    Pl() { super(null, null); }
    public add be() { return null; }
    public add bF() { return null; }
    public boolean Z() { return true; }
    public add q(int slot) { return null; }
    public void c(int slot, add stack) {}
    public add[] ak() { return new add[0]; }
    public r f_() { return null; }
    public boolean a(int level, String command) { return false; }
    public void a(fj message) {}
  }

  static String d(double v) { return Double.toString(v); }
  static final float PI = 3.1415927f;

  static double[] tipFirst(double[] a, float prevPitch, float pitch, float prevYaw, float yaw, float swingProgress, float pt) {
    float f8 = qh.a(qh.c(swingProgress) * PI);
    azw v = azw.a(-0.5, 0.03, 0.8);
    v.a(-(prevPitch + (pitch - prevPitch) * pt) * PI / 180.0f);
    v.b(-(prevYaw + (yaw - prevYaw) * pt) * PI / 180.0f);
    v.b(f8 * 0.5f);
    v.a(-f8 * 0.7f);
    return new double[] {a[0] + (a[3] - a[0]) * (double) pt + v.a, a[1] + (a[4] - a[1]) * (double) pt + v.b, a[2] + (a[5] - a[2]) * (double) pt + v.c};
  }

  static double[] tipOther(double[] a, float prevRYO, float ryo, double eye, float pt) {
    float f10 = (prevRYO + (ryo - prevRYO) * pt) * PI / 180.0f;
    double s = qh.a(f10), c = qh.b(f10);
    return new double[] {a[0] + (a[3] - a[0]) * (double) pt - c * 0.35 - s * 0.85, a[1] + eye + (a[4] - a[1]) * (double) pt - 0.45, a[2] + (a[5] - a[2]) * (double) pt - s * 0.35 + c * 0.85};
  }

  public static void main(String[] args) throws Exception {
    sun.misc.Unsafe u; { java.lang.reflect.Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); f.setAccessible(true); u = (sun.misc.Unsafe) f.get(null); }
    float eyeHeight = ((yz) u.allocateInstance(Pl.class)).g(); // EntityPlayer.getEyeHeight (a constant 0.12f)
    Random r = new Random(65);
    int n = 0;
    for (int k = 0; k < 96; k++) {
      boolean first = k % 3 == 0, local = k % 2 == 0 || first;
      float pt = k % 4 == 0 ? 1.0f : r.nextFloat();
      float yaw = (float) (r.nextDouble() * 720 - 360), pitch = (float) (r.nextDouble() * 180 - 90);
      float prevYaw = yaw - (float) (r.nextDouble() * 20 - 10), prevPitch = pitch - (float) (r.nextDouble() * 10 - 5);
      float ryo = (float) (r.nextDouble() * 720 - 360), prevRyo = ryo - (float) (r.nextDouble() * 20 - 10);
      float swing = k % 5 == 0 ? 0f : r.nextFloat();
      double ax = r.nextDouble() * 40 - 20, ay = 60 + r.nextDouble() * 5, az = r.nextDouble() * 40 - 20;
      double[] a = {ax - r.nextDouble() * 0.3, ay - r.nextDouble() * 0.1, az - r.nextDouble() * 0.3, ax, ay, az};
      double hx = ax + r.nextDouble() * 12 - 6, hy = 58 + r.nextDouble() * 4, hz = az + r.nextDouble() * 12 - 6;
      double[] h = {hx - r.nextDouble() * 0.2, hy - r.nextDouble() * 0.2, hz - r.nextDouble() * 0.2, hx, hy, hz};
      double cx = ax + r.nextDouble() * 3, cy = ay + r.nextDouble(), cz = az - r.nextDouble() * 3;
      double eye = local ? 0.0 : (double) eyeHeight;
      double[] tip = first ? tipFirst(a, prevPitch, pitch, prevYaw, yaw, swing, pt) : tipOther(a, prevRyo, ryo, eye, pt);
      double d9 = h[0] + (h[3] - h[0]) * (double) pt, d10 = h[1] + (h[4] - h[1]) * (double) pt + 0.25, d11 = h[2] + (h[5] - h[2]) * (double) pt;
      double rx = d9 - cx, ry = h[1] + (h[4] - h[1]) * (double) pt - cy, rz = d11 - cz; // the renderer's d, d1, d2: the hook relative to the camera
      double d12 = (double) (float) (tip[0] - d9), d13 = (double) (float) (tip[1] - d10), d14 = (double) (float) (tip[2] - d11);
      StringBuilder pts = new StringBuilder();
      for (int i = 0; i <= 16; i++) {
        float f = (float) i / (float) 16;
        double px = rx + d12 * (double) f, py = ry + d13 * (double) (f * f + f) * 0.5 + 0.25, pz = rz + d14 * (double) f;
        if (i > 0) pts.append(',');
        pts.append('[').append(d(px + cx)).append(',').append(d(py + cy)).append(',').append(d(pz + cz)).append(']');
      }
      System.out.println("{\"case\":\"line" + k + "\",\"first\":" + first + ",\"local\":" + local + ",\"pt\":" + d(pt) + ",\"yaw\":" + d(yaw) + ",\"pitch\":" + d(pitch) + ",\"prevYaw\":" + d(prevYaw) + ",\"prevPitch\":" + d(prevPitch)
        + ",\"renderYawOffset\":" + d(ryo) + ",\"prevRenderYawOffset\":" + d(prevRyo) + ",\"swing\":" + d(swing) + ",\"angler\":" + Arrays.toString(a) + ",\"hook\":" + Arrays.toString(h) + ",\"camera\":[" + d(cx) + "," + d(cy) + "," + d(cz) + "]"
        + ",\"eyeTerm\":" + d(eye) + ",\"tip\":[" + d(tip[0]) + "," + d(tip[1]) + "," + d(tip[2]) + "],\"points\":[" + pts + "]}");
      n++;
    }
    System.out.println("{\"case\":\"eye\",\"getEyeHeight\":" + d(eyeHeight) + "}");
  }
}
