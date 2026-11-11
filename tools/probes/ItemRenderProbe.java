import java.util.ArrayList;
import java.util.List;

// Batch 42: runs the unchanged 1.7.10 RenderBlocks.renderBlockAsItem (blm.a(aji, meta, brightness), what inventory slots, hands and dropped items draw for blocks
// whose render type RenderBlocks.renderItemIn3d (blm.a(int)) accepts: 0, 31, 39, 13, 10, 11, 27, 22, 21, 16, 26, 32, 34, 35) with the real Tessellator (bmh). The
// transform and colour calls (GL11.glTranslatef, glRotatef, glColor4f) go to a stand-in GL11 (probes/gl/GL11.java, shadows LWJGL, which is not on the classpath) that
// records them in call order, and its glDrawArrays (Tessellator.draw) records the vertices the Tessellator holds: per vertex x, y, z, u, v (float bits), colour int,
// normal int, brightness int. Per (block id, metadata) the output is the event list; metadata other than 0 is written only when it differs from metadata 0.
// Icons are distinct per registered name as in RenderTypes2Probe (u = 2 * index + fraction). Arguments: none needed besides the colormap PNGs (unused here).
public class ItemRenderProbe {
  static final int[] TYPES = {0, 31, 39, 13, 10, 11, 27, 22, 21, 16, 26, 32, 34, 35};

  public static void main(String[] args) throws Exception {
    java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    sun.misc.Unsafe unsafe = (sun.misc.Unsafe) uf.get(null);
    LightFloatProbe.unsafe = unsafe;
    aji.p();
    aha.a(LightFloatProbe.pixels(args[0]));
    agx.a(LightFloatProbe.pixels(args[1]));
    ((alt) aji.e(18)).b(true); ((alt) aji.e(161)).b(true); blm.b = true;
    rg register = name -> new RenderTypes2Probe.Icon(String.valueOf(name));
    for (int id = 0; id < 256; id++) { aji b = aji.e(id); if (b != null && id != 0) try { b.a(register); } catch (Throwable e) {} }
    bbj settings = new bbj();
    bao.M = new bao();
    bao.M.u = settings;
    blm rb = (blm) unsafe.allocateInstance(blm.class);
    LightFloatProbe.set(rb, "c", true); // useInventoryTint, set by the constructor
    LightFloatProbe.set(rb, "q", bao.M);
    bmh t = bmh.a;
    final java.lang.reflect.Field fF = LightFloatProbe.field(bmh.class, "f");
    org.lwjgl.opengl.GL11.onDraw = () -> {
      try {
        int[] raw = (int[]) fF.get(t); int n = (Integer) LightFloatProbe.get(t, "g"); // vertexCount
        StringBuilder s = new StringBuilder("[\"D\",").append(n).append(",[");
        for (int i = 0; i < n; i++) {
          int o = i * 8;
          for (int k = 0; k < 8; k++) s.append(i + k > 0 ? "," : "").append(raw[o + k]);
        }
        return s.append("]]").toString();
      } catch (Exception e) { throw new RuntimeException(e); }
    };
    StringBuilder out = new StringBuilder("{\"items\":[");
    int count = 0;
    List<String> failed = new ArrayList<>();
    for (int id = 1; id < 256; id++) {
      aji block = aji.e(id);
      if (block == null || block == aji.e(0)) continue;
      int type = block.b();
      boolean ok = false;
      for (int ty : TYPES) ok |= ty == type;
      if (!ok || !blm.a(type)) continue;
      String first = null;
      for (int meta = 0; meta < 16; meta++) {
        org.lwjgl.opengl.GL11.events.clear();
        try { rb.a(block, meta, 1.0f); } catch (Throwable e) { failed.add(id + ":" + meta + " " + e); org.lwjgl.opengl.GL11.events.clear(); try { LightFloatProbe.field(bmh.class, "x").setBoolean(t, false); } catch (Exception e2) {} continue; }
        String ev = "[" + String.join(",", org.lwjgl.opengl.GL11.events) + "]";
        if (meta == 0) first = ev;
        else if (ev.equals(first)) continue;
        out.append(count++ > 0 ? "," : "").append("{\"id\":").append(id).append(",\"meta\":").append(meta).append(",\"type\":").append(type).append(",\"events\":").append(ev).append("}");
      }
    }
    out.append("],\"failed\":[");
    for (int i = 0; i < failed.size(); i++) out.append(i > 0 ? "," : "").append("\"").append(failed.get(i).replace("\"", "'")).append("\"");
    out.append("],\"icons\":[");
    for (int i = 0; i < RenderTypes2Probe.names.size(); i++) out.append(i > 0 ? "," : "").append("\"").append(RenderTypes2Probe.names.get(i)).append("\"");
    System.out.println(out.append("]}"));
  }
}
