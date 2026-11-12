import java.awt.image.BufferedImage;
import java.io.File;
import java.lang.reflect.Field;
import java.nio.ByteBuffer;
import java.util.*;
import javax.imageio.ImageIO;
import org.lwjgl.opengl.GL11;

// Batch 53 displayquads (tag b53dq): the flat and cube display shapes a minecart's custom display block draws through RenderBlocks.renderBlockAsItem (blm.a(aji, int, float)),
// executed on the unchanged 1.7.10 client classes. LWJGL's GL11 is a stub (tools/probes/displayquads/org/lwjgl/opengl/GL11.java) that logs glTranslatef / glRotatef / glScalef / glColor4f
// and runs a hook on glDrawArrays; the hook reads the static Tessellator's (bmh.a) raw vertex buffer (stride 32 bytes: x y z u v floats, RGBA bytes at 20, signed normal bytes at 24).
// Block icons come from the real Block.registerIcons (aji.a(rg)) fed a stub IIconRegister: every registered name is an icon (rf) whose u and v run 2k..2k+1 for the k-th name of that block's
// registration, so a recorded u or v is "k + icon fraction" and the icon name is recovered from it (fractions are v from the top, as the port's displayQuads uses).
public class DisplayQuadsProbe {
  static final List<String> names = new ArrayList<>();
  static final List<String> allNames = new ArrayList<>(); // names of the 1000+ pre-registration, so a borrowed icon (stairs: planks, beacon base: obsidian, glass shell) reports its name too (batch 54)
  static class Icon implements rf {
    final String name; int k;
    Icon(String name, int k) { this.name = name; this.k = k; }
    public int a() { return 16; }
    public int b() { return 16; }
    public float c() { return 2f * k; }
    public float d() { return 2f * k + 1f; }
    public float a(double d) { float w = d() - c(); return c() + w * (float) d / 16.0f; }
    public float e() { return 2f * k; }
    public float f() { return 2f * k + 1f; }
    public float b(double d) { float h = f() - e(); return e() + h * (float) d / 16.0f; }
    public String g() { return name; }
  }
  static class Reg implements rg {
    final Map<String, Icon> icons = new LinkedHashMap<>();
    public rf a(String name) { return icons.computeIfAbsent(String.valueOf(name), n -> new Icon(n, icons.size())); }
  }
  static Reg reg, all;
  static Field fld(String n) throws Exception { Field f = bmh.class.getDeclaredField(n); f.setAccessible(true); return f; }
  static final List<String> draws = new ArrayList<>();
  static String fl(float v) { return Float.toString(v); }
  static void capture() {
    try {
      ByteBuffer b = (ByteBuffer) fld("b").get(bmh.a);
      boolean hasTex = fld("m").getBoolean(bmh.a), hasColor = fld("l").getBoolean(bmh.a), hasNormal = fld("o").getBoolean(bmh.a), hasBright = fld("n").getBoolean(bmh.a);
      StringBuilder s = new StringBuilder();
      s.append("{\"mode\":").append(GL11.drawMode).append(",\"count\":").append(GL11.drawCount).append(",\"hasColor\":").append(hasColor).append(",\"hasNormal\":").append(hasNormal).append(",\"hasBrightness\":").append(hasBright).append(",\"hasTexture\":").append(hasTex).append(",\"vertices\":[");
      for (int i = 0; i < GL11.drawCount; i++) {
        int o = (GL11.drawFirst + i) * 32;
        float x = b.getFloat(o), y = b.getFloat(o + 4), z = b.getFloat(o + 8), u = b.getFloat(o + 12), v = b.getFloat(o + 16);
        int ku = (int) Math.floor(u / 2), kv = (int) Math.floor(v / 2);
        String icon = ku != kv || ku < 0 ? "?" : ku >= 1000 ? (ku - 1000 < allNames.size() ? allNames.get(ku - 1000) : "?") : ku < names.size() ? names.get(ku) : "?";
        s.append(i == 0 ? "" : ",").append("{\"pos\":[").append(fl(x)).append(",").append(fl(y)).append(",").append(fl(z)).append("],\"uv\":[").append(fl(u - 2 * ku)).append(",").append(fl(v - 2 * kv)).append("],\"icon\":\"").append(icon).append("\"");
        if (hasColor) s.append(",\"rgba\":[").append(b.get(o + 20) & 255).append(",").append(b.get(o + 21) & 255).append(",").append(b.get(o + 22) & 255).append(",").append(b.get(o + 23) & 255).append("]");
        if (hasNormal) s.append(",\"normal\":[").append(b.get(o + 24)).append(",").append(b.get(o + 25)).append(",").append(b.get(o + 26)).append("]");
        s.append("}");
      }
      draws.add(s.append("]}").toString());
    } catch (Exception e) { throw new RuntimeException(e); }
  }
  static int[] pixels(String path) throws Exception {
    BufferedImage img = ImageIO.read(new File(path));
    int[] a = new int[65536];
    img.getRGB(0, 0, 256, 256, a, 0, 256);
    return a;
  }
  static void render(String name, int id, int meta, float brightness) {
    aji b = aji.e(id);
    for (int i = 1; i < 256; i++) { aji o = aji.e(i); if (o != null && o != ajn.a) o.a(all); } // reset every block to its 1000+ icons first: an earlier case's small-k icons must not stay on a block another block borrows (the beacon's glass shell)
    reg = new Reg();
    b.a(reg); // Block.registerIcons
    if (id == 2) aji.e(3).a(reg); // the grass block's bottom face is the dirt block's icon
    names.clear(); // names are read in register order below
    for (String n : reg.icons.keySet()) names.add(n);
    GL11.log.clear(); draws.clear();
    blm rb = new blm();
    rb.a(b, meta, brightness);
    StringBuilder calls = new StringBuilder();
    for (String c : GL11.log) calls.append(calls.length() == 0 ? "" : ",").append("\"").append(c).append("\"");
    StringBuilder dr = new StringBuilder();
    for (String d : draws) dr.append(dr.length() == 0 ? "" : ",").append(d);
    System.out.println("{\"name\":\"" + name + "\",\"id\":" + id + ",\"meta\":" + meta + ",\"brightness\":" + fl(brightness) + ",\"renderType\":" + b.b() + ",\"icons\":" + names.size() + ",\"calls\":[" + calls + "],\"draws\":[" + dr + "]}");
  }
  public static void main(String[] args) throws Exception {
    GL11.drawHook = DisplayQuadsProbe::capture;
    aji.p(); adb.l();
    all = new Reg(); // every block's icons registered once (icons at 1000+), so a block that borrows another block's icon never meets null; the block drawn is registered again per case with small k
    for (int id = 1; id < 256; id++) { aji b = aji.e(id); if (b != null && b != ajn.a) b.a(all); }
    for (Icon i : all.icons.values()) { i.k += 1000; allNames.add(i.name); }
    aha.a(pixels(args[0]));
    agx.a(pixels(args[1]));
    int[][] cases = {
      {31, 0}, {31, 1}, {31, 2}, {6, 0}, {6, 1}, {6, 2}, {6, 3}, {37, 0}, {38, 0}, {38, 1}, {38, 8}, {39, 0}, {40, 0}, {32, 0}, {30, 0}, {83, 0}, {115, 0}, {115, 3},
      {50, 0}, {50, 5}, {75, 0}, {76, 0}, {104, 0}, {105, 0}, {2, 0}, {3, 0}, {18, 0}, {18, 1}, {18, 2}, {161, 0}, {1, 0}, {17, 0}, {17, 5}, {20, 0}, {44, 0}, {44, 3}, {53, 0}, {85, 0}, {139, 0}, {139, 1}, {81, 0}, {116, 0}, {145, 0}, {122, 0}, {138, 0}, {154, 0},
    };
    for (int[] c : cases) render("case", c[0], c[1], 1.0f);
    for (int m = 0; m < 8; m++) { render("wheat", 59, m, 1.0f); render("carrots", 141, m, 1.0f); render("potatoes", 142, m, 1.0f); }
    for (int m = 0; m < 8; m++) { render("pumpkin-stem", 104, m, 1.0f); render("melon-stem", 105, m, 1.0f); }
    for (int m = 3; m < 16; m += 4) render("tallgrass-meta", 31, m, 1.0f);
    render("dim", 2, 0, 0.5f); render("dim", 31, 1, 0.5f); render("dim", 38, 0, 0.5f); render("dim", 50, 0, 0.5f); render("dim", 53, 0, 0.5f); render("dim", 104, 3, 0.5f);
  }
}
