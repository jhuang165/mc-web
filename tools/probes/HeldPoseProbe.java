import java.lang.reflect.Field;

// Batch 45: runs the unchanged 1.7.10 third-person held item transforms with the recording GL11 stand-in (probes/gl/GL11.java):
//  - RenderPlayer.renderSpecials (bop.a(AbstractClientPlayer, float)), the player's right-hand item (the cape, deadmau5 ears and helmet branches are skipped by stand-in answers);
//  - RenderBiped.renderEquippedItems (bnw.a(EntityLiving, float)), used by zombies, pigmen, skeletons, giants and the other biped mobs, adult and child;
//  - RenderWitch.renderEquippedItems (bpb.a(EntityWitch, float)), ModelWitch's right arm and nose pose at rest.
// Each ends in the unchanged ItemRenderer.renderItem (bly.a(EntityLivingBase, ItemStack, int)), which runs for real with a stand-in texture manager and entity; its 3D branch's
// RenderBlocks.renderBlockAsItem is replaced by a marker (["B", blockId]) because the executed block draw is item-render-reference.json's. Sprite items end in the real
// renderItemIn2D call, whose vertex count is recorded ([ "D", n ]). Events: ["T", x, y, z], ["R", angle, x, y, z], ["S", x, y, z], ["P"], ["O"], ["C", r, g, b, a].
// The model parts are at their constructor rest angles (limb animation is not part of the transform being recorded: postRender of the arm is the first events).
public class HeldPoseProbe {
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
  static class Watcher extends te {
    Watcher() { super(null); }
    public byte a(int index) { return 0; }
  }
  static class Inv extends yx { Inv() { super(null); } add held; public add d(int slot) { return null; } public add h() { return held; } }
  static class Player extends blg {
    static int using; add stack;
    Player() { super(null, null); }
    public r f_() { return null; }
    public fj c_() { return null; }
    public void a(fj message) {}
    public ahb d() { return null; }
    public boolean a(int level, String name) { return true; }
    public String b_() { return "Steve"; }
    public boolean n() { return false; }
    public boolean o() { return false; }
    public int bx() { return using; }
    public rf b(add s, int pass) { return new Icon(); }
  }
  static class Mob extends sw {
    Mob() { super(null); }
    add stack;
    public add be() { return stack; }
    public add r(int slot) { return null; }
    public rf b(add s, int pass) { return new Icon(); }
  }
  static class Witch extends yp {
    Witch() { super(null); }
    add stack;
    public add be() { return stack; }
    public rf b(add s, int pass) { return new Icon(); }
  }
  static class Blocks extends blm {
    Blocks() { super(null); }
    public void a(aji block, int damage, float brightness) { org.lwjgl.opengl.GL11.events.add("[\"B\"," + aji.b(block) + "]"); }
  }
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    sun.misc.Unsafe unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    bmh t = bmh.a;
    final Field fF = field(bmh.class, "f");
    org.lwjgl.opengl.GL11.onDraw = () -> {
      try { return "[\"D\"," + field(bmh.class, "g").get(t) + "]"; } catch (Exception e) { throw new RuntimeException(e); }
    };
    bao mc = (bao) unsafe.allocateInstance(bao.class);
    set(mc, "L", new bqf());
    bly items = (bly) unsafe.allocateInstance(bly.class);
    set(items, "d", mc);
    set(items, "h", unsafe.allocateInstance(Blocks.class));
    bnn manager = new bnn();
    manager.f = items;
    // item id, damage, use count (an item in use shows the blocking pose for swords), fishing (the player holds a rod cast: renderSpecials draws a stick)
    int[][] cases = {
      {1, 0, 0, 0}, {53, 0, 0, 0}, {54, 0, 0, 0}, {81, 0, 0, 0}, {85, 0, 0, 0}, {50, 0, 0, 0}, {6, 0, 0, 0}, {31, 1, 0, 0}, {58, 0, 0, 0}, {96, 0, 0, 0},
      {261, 0, 0, 0}, {267, 0, 0, 0}, {267, 0, 5, 0}, {257, 0, 0, 0}, {257, 0, 5, 0}, {268, 0, 0, 0}, {280, 0, 0, 0}, {346, 0, 0, 0}, {346, 0, 0, 1}, {398, 0, 0, 0}, {260, 0, 0, 0}, {263, 0, 0, 0}, {262, 0, 0, 0}, {297, 0, 0, 0}, {373, 0, 0, 0},
    };
    StringBuilder out = new StringBuilder("{\"cases\":[");
    int count = 0;
    for (String who : new String[] {"player", "biped", "babyBiped", "witch"}) {
      for (int[] c : cases) {
        adb item = adb.d(c[0]);
        if (item == null) continue;
        add stack = new add(item, 1, c[1]);
        org.lwjgl.opengl.GL11.events.clear();
        Player.using = c[2];
        if (who.equals("player")) {
          bop render = (bop) unsafe.allocateInstance(bop.class);
          set(render, "f", new bhm(0.0f));
          set(render, "b", manager);
          Player p = (Player) unsafe.allocateInstance(Player.class);
          set(p, "af", unsafe.allocateInstance(Watcher.class));
          Inv inv = (Inv) unsafe.allocateInstance(Inv.class);
          inv.held = stack;
          set(p, "bm", inv);
          if (c[3] != 0) set(p, "bK", unsafe.allocateInstance(xe.class));
          field(bop.class, "a").getName();
          java.lang.reflect.Method m = bop.class.getDeclaredMethod("a", blg.class, float.class);
          m.setAccessible(true);
          m.invoke(render, p, 0f);
        } else if (who.equals("witch")) {
          bpb render = (bpb) unsafe.allocateInstance(bpb.class);
          bim model = new bim(0.0f);
          model.s = false; // ModelBase.isChild defaults to true; RendererLivingEntity.doRender sets it from the entity
          set(render, "f", model);
          set(render, "i", model);
          set(render, "b", manager);
          Witch w = (Witch) unsafe.allocateInstance(Witch.class);
          set(w, "af", unsafe.allocateInstance(Watcher.class));
          w.stack = stack;
          java.lang.reflect.Method m = bpb.class.getDeclaredMethod("a", yp.class, float.class);
          m.setAccessible(true);
          m.invoke(render, w, 0f);
        } else {
          bnw render = (bnw) unsafe.allocateInstance(bnw.class);
          bhm model = new bhm(0.0f);
          model.s = who.equals("babyBiped"); // doRender copies entity.isChild() into the model
          set(render, "a", model);
          set(render, "i", model);
          set(render, "b", manager);
          Mob mob = (Mob) unsafe.allocateInstance(Mob.class);
          set(mob, "af", unsafe.allocateInstance(Watcher.class));
          mob.stack = stack;
          java.lang.reflect.Method m = bnw.class.getDeclaredMethod("a", sw.class, float.class);
          m.setAccessible(true);
          m.invoke(render, mob, 0f);
        }
        out.append(count++ > 0 ? "," : "").append("{\"who\":\"").append(who).append("\",\"id\":").append(c[0]).append(",\"damage\":").append(c[1]).append(",\"use\":").append(c[2]).append(",\"cast\":").append(c[3])
          .append(",\"events\":[").append(String.join(",", org.lwjgl.opengl.GL11.events)).append("]}");
      }
    }
    // Item.isFull3D (f), shouldRotateAroundOrigin (g) and requiresMultipleRenderPasses (b) of every registered item, by id.
    out.append("],\"flags\":{");
    int n = 0;
    for (int id = 1; id < 4096; id++) {
      adb item = adb.d(id);
      if (item == null) continue;
      out.append(n++ > 0 ? "," : "").append("\"").append(id).append("\":[").append(item.f() ? 1 : 0).append(",").append(item.g() ? 1 : 0).append(",").append(item.b() ? 1 : 0).append("]");
    }
    System.out.println(out.append("}}"));
  }
}
