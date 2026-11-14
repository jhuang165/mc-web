import java.lang.reflect.Field;

// Batch 64: runs the unchanged 1.7.10 ItemRenderer.renderItemInFirstPerson (bly.a(float)) for a held item with the recording GL11 stand-in (probes/gl/GL11.java). The Minecraft
// instance (probes/fp/bao), RenderManager, RenderHelper, the texture manager, texture helper and OpenGlHelper are stand-ins (the originals need a GL context); the player is a
// subclass of EntityClientPlayerMP whose constructor is skipped (Unsafe), with the swing progress, the use count and the interpolated view fields set per case; the world answers
// every light query with 0. Nothing in the item branch of bly.a is replaced, so every glTranslatef, glRotatef and glScalef the original makes is recorded in order, up to and
// including the final ItemRenderer.renderItem (the sprite quads are recorded as ["D", n], a block item is the marker ["B", id] as in HeldPoseProbe).
// Events: ["T", x, y, z], ["R", angle, x, y, z], ["S", x, y, z], ["P"], ["O"], ["C", r, g, b, a], ["D", n], ["B", id], ["A"] (first-person arm drawn), ["M", frame] (map colours drawn).
public class FirstPersonProbe {
  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass()) try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }
  static void set(Object o, String name, Object v) throws Exception { field(o.getClass(), name).set(o, v); }
  static class Icon implements rf {
    public int a() { return 16; }
    public int b() { return 16; }
    public float c() { return 0f; }
    public float d() { return 1f; }
    public float a(double v) { return (float) v; }
    public float e() { return 0f; }
    public float f() { return 1f; }
    public float b(double v) { return (float) v; }
    public String g() { return "probe"; }
  }
  static class Inv extends yx { Inv() { super(null); } add held; public add d(int slot) { return null; } public add h() { return held; } }
  static class Player extends bjk {
    static float swing; static int using;
    Player() { super(null, null, null, null, null); }
    public r f_() { return null; }
    public fj c_() { return null; }
    public void a(fj message) {}
    public ahb d() { return null; }
    public boolean a(int level, String name) { return true; }
    public String b_() { return "Steve"; }
    public boolean n() { return false; }
    public boolean o() { return false; }
    public float k(float partial) { return swing; }
    public int bx() { return using; }
    public bqx r() { return null; }
    public rf b(add s, int pass) { return new Icon(); }
  }
  static class World extends bjf {
    World() { super(null, null, 0, null, null); }
    public int c(int x, int y, int z, int w) { return 0; }
    public ayl a(Class c, String name) { return new ayi(name); }
  }
  static class Blocks extends blm {
    Blocks() { super(null); }
    public void a(aji block, int damage, float brightness) { org.lwjgl.opengl.GL11.events.add("[\"B\"," + aji.b(block) + "]"); }
  }
  // Map cases (Batch 65): RenderPlayer.renderFirstPersonArm (bop.a(yz)) and the map colour renderer MapItemRenderer.render (bbx.a(ayi, boolean)) are recorded as markers; the pose and the
  // background quad between them are the unchanged bly.a code. The world hands every map lookup a fresh MapData, so the branch reaches the renderer call.
  static class ArmRender extends bop { public void a(yz p) { org.lwjgl.opengl.GL11.events.add("[\"A\"]"); } }
  static class MapRender extends bbx { MapRender() { super(null); } public void a(ayi data, boolean frame) { org.lwjgl.opengl.GL11.events.add("[\"M\"," + frame + "]"); } }
  static class Renderer extends blt { Renderer() { super(null, null); } static bbx maps; public bbx i() { return maps; } }
  static String f(float v) { return Float.toString(v); }
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    sun.misc.Unsafe unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    bmh t = bmh.a;
    org.lwjgl.opengl.GL11.onDraw = () -> { try { return "[\"D\"," + field(bmh.class, "g").get(t) + "]"; } catch (Exception e) { throw new RuntimeException(e); } };
    bao mc = (bao) unsafe.allocateInstance(bao.class);
    set(mc, "L", new bqf());
    Player p = (Player) unsafe.allocateInstance(Player.class);
    mc.h = p;
    mc.f = (bjf) unsafe.allocateInstance(World.class);
    bnn.arm = (bno) unsafe.allocateInstance(ArmRender.class);
    Renderer.maps = (bbx) unsafe.allocateInstance(MapRender.class);
    mc.p = (blt) unsafe.allocateInstance(Renderer.class);
    bly items = (bly) unsafe.allocateInstance(bly.class);
    set(items, "d", mc);
    set(items, "h", unsafe.allocateInstance(Blocks.class));
    bnn manager = new bnn();
    manager.f = items;
    Inv inv = (Inv) unsafe.allocateInstance(Inv.class);
    set(p, "bm", inv);
    // item id, damage, use count, swing progress, equip progress (f), previous equip (g), partial ticks; view: pitch, prevPitch, yaw, prevYaw, armPitch, prevArmPitch, armYaw, prevArmYaw
    float[][] cases = {
      {267, 0, 0, 0f, 1f, 1f, 1f}, {267, 0, 5, 0f, 1f, 1f, 1f}, {267, 0, 0, 0.3f, 1f, 1f, 1f}, {267, 0, 5, 0.3f, 1f, 1f, 1f}, {267, 0, 5, 0.6f, 0.4f, 0.2f, 0.25f},
      {257, 0, 5, 0f, 1f, 1f, 1f}, {261, 0, 0, 0f, 1f, 1f, 1f}, {261, 0, 5, 0f, 1f, 1f, 1f}, {261, 0, 40, 0f, 1f, 1f, 1f}, {261, 0, 71990, 0f, 1f, 1f, 1f}, {261, 0, 71998, 0f, 1f, 1f, 0.5f}, {261, 0, 71980, 0.2f, 0.8f, 0.7f, 0.25f}, {297, 0, 0, 0f, 1f, 1f, 1f}, {297, 0, 10, 0f, 1f, 1f, 1f},
      {373, 0, 0, 0f, 1f, 1f, 1f}, {373, 0, 12, 0f, 1f, 1f, 1f}, {1, 0, 0, 0f, 1f, 1f, 1f}, {1, 0, 0, 0.45f, 1f, 1f, 1f}, {50, 0, 0, 0.2f, 0.7f, 0.5f, 0.5f}, {280, 0, 0, 0.5f, 1f, 1f, 1f}, {346, 0, 0, 0f, 1f, 1f, 1f},
      // Batch 65: filled map (id 358): rest, swing, equip animation, mid-swing with a turned view
      {358, 0, 0, 0f, 1f, 1f, 1f}, {358, 0, 0, 0.3f, 1f, 1f, 1f}, {358, 0, 0, 0.7f, 0.5f, 0.3f, 0.25f}, {358, 0, 0, 0f, 0.2f, 0.1f, 0.5f}, {358, 3, 0, 1f, 1f, 1f, 0f},
    };
    // map cases also get steeper pitches (the pitch term of the map pose)
    float[][] pitchViews = { {-40f, -40f, 0, 0, 0, 0, 0, 0}, {35f, 30f, 20f, 10f, 30f, 25f, 15f, 10f}, {90f, 90f, 0, 0, 90f, 90f, 0, 0} };
    // Two view rows: level view, and a turned view where the arm's own lag shows in the sway rotations.
    float[][] views = { {0, 0, 0, 0, 0, 0, 0, 0}, {20f, 10f, 70f, 50f, 15f, 5f, 60f, 40f} };
    StringBuilder out = new StringBuilder("{\"cases\":[");
    int count = 0;
    java.util.List<float[]> all = new java.util.ArrayList<>();
    for (float[] v : views) all.add(v);
    for (float[] v : pitchViews) all.add(v);
    for (float[] v : all) {
      boolean pitchOnly = v[0] == -40f || v[0] == 90f || (v[0] == 35f && v[1] == 30f);
      for (float[] c : cases) {
        if (pitchOnly && c[0] != 358) continue;
        adb item = adb.d((int) c[0]);
        if (item == null) continue;
        add stack = new add(item, 1, (int) c[1]);
        inv.held = stack;
        set(items, "e", stack);
        set(items, "f", c[4]);
        set(items, "g", c[5]);
        Player.swing = c[3];
        Player.using = (int) c[2];
        // pitch (z) / yaw (y) and the previous values (B, A); the arm's lag fields blk.h, blk.bL (pitch), blk.g, blk.i (yaw)
        set(p, "z", v[0]); set(p, "B", v[1]); set(p, "y", v[2]); set(p, "A", v[3]);
        set(p, "h", v[4]); set(p, "bL", v[5]); set(p, "g", v[6]); set(p, "i", v[7]);
        org.lwjgl.opengl.GL11.events.clear();
        items.a(c[6]);
        out.append(count++ > 0 ? "," : "").append("{\"id\":" + (int) c[0] + ",\"damage\":" + (int) c[1] + ",\"use\":" + (int) c[2] + ",\"swing\":" + f(c[3]) + ",\"equip\":" + f(c[4]) + ",\"prevEquip\":" + f(c[5]) + ",\"partial\":" + f(c[6])
          + ",\"view\":[" + f(v[0]) + "," + f(v[1]) + "," + f(v[2]) + "," + f(v[3]) + "," + f(v[4]) + "," + f(v[5]) + "," + f(v[6]) + "," + f(v[7]) + "],\"events\":[" + String.join(",", org.lwjgl.opengl.GL11.events) + "]}");
      }
    }
    System.out.println(out.append("]}"));
  }
}
