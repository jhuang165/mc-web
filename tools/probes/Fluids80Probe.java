import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 80 fluids80: executes the unchanged 1.7.10 classes for the falling-fluid, fluid-item and item-Fire leftovers of batch 79.
//  - land80: the real EntityFallingBlock.onUpdate (xj.h) lands blocks 8, 9, 10 and 11 (several metadata) on a world double whose setBlock (ahb.d) stores the cell and,
//    as Chunk.func_150807_a does on a server world, calls the new block's onBlockAdded; World.scheduleBlockUpdate (ahb.a(IIILaji;I)) is recorded.
//  - stack80: Item.getItemFromBlock stacks of 8/9 and 10/11: ItemStack.isItemEqual, ItemStack.areItemStacksEqual, InventoryPlayer.addItemStackToInventory of one then the
//    other into an empty inventory (the slots after), and EntityItem.combineItems of two item entities.
//  - fire80: an EntityItem whose fire counter (Entity.fire, sa.e) starts at N, updated T times falling through open air, then written (Entity.writeToNBT): Fire, Age, alive. And the
//    load path: Entity.readFromNBT of a compound with Fire N, then T updates.
public class Fluids80Probe {
  static String q(String s) { return "\"" + s + "\""; }
  public static class LW extends FallingBlock78Probe.Tiles79.World {
    static List<String> scheduled = new ArrayList<>();
    @Override public boolean d(int x, int y, int z, aji b, int meta, int flags) {
      super.d(x, y, z, b, meta, flags);
      b.b(this, x, y, z); // Chunk.func_150807_a: onBlockAdded of the new block (server world)
      return true;
    }
    @Override public void a(int x, int y, int z, aji b, int delay) { scheduled.add(x + "," + y + "," + z + "," + aji.b(b) + "," + delay); }
    @Override public void b(int x, int y, int z, aji b, int delay, int priority) { scheduled.add(x + "," + y + "," + z + "," + aji.b(b) + "," + delay + ",p" + priority); }
    @Override public void d(int x, int y, int z, aji b) {}
  }
  static <T> T world(Class<T> c) throws Exception {
    T w = (T) MobNbtProbe.u.allocateInstance(c);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if ((f.getType() == List.class || f.getType() == ArrayList.class) && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", MobNbtProbe.u.allocateInstance(aqq.class));
    return w;
  }
  static String slots(yx inv) {
    StringBuilder b = new StringBuilder();
    for (int i = 0; i < 4; i++) { add s = inv.a[i]; b.append(i > 0 ? "," : "").append(s == null ? "-" : adb.b(s.b()) + "x" + s.b); }
    return b.toString();
  }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    LW w = world(LW.class);
    for (int id : new int[] { 8, 9, 10, 11 }) for (int meta : new int[] { 0, 3, 7, 8 }) {
      LW.blocks.clear(); LW.metas.clear(); LW.tiles.clear(); LW.scheduled.clear();
      xj e = new xj(w, 0.5, 64.52, 0.5, aji.e(id), meta);
      e.b = 2;
      String err = null;
      try { for (int i = 0; i < 3 && !e.K; i++) e.h(); } catch (Throwable t) { err = t.toString(); }
      aji got = LW.blocks.get("0,64,0");
      System.out.println("{\"kind\":\"land80\",\"block\":" + id + ",\"meta\":" + meta + ",\"landed\":" + (got == null ? "null" : aji.b(got)) + ",\"landedMeta\":" + LW.metas.getOrDefault("0,64,0", -1)
        + ",\"dead\":" + e.K + ",\"scheduled\":" + q(String.join(";", LW.scheduled)) + ",\"error\":" + (err == null ? "null" : q(err.replace("\"", "'"))) + "}");
    }
    FallingBlock78Probe.W iw = world(FallingBlock78Probe.W.class);
    FallingBlock78Probe.W.below = aji.e(1);
    FallingBlock78Probe.W.target = aji.e(0);
    for (int[] p : new int[][] { { 8, 9 }, { 9, 8 }, { 8, 8 }, { 9, 9 }, { 10, 11 }, { 11, 10 }, { 10, 10 }, { 8, 10 } }) {
      add a = new add(aji.e(p[0]), 3, 0), b = new add(aji.e(p[1]), 2, 0);
      yx inv = new yx(null);
      boolean addA = inv.a(a.m()), addB = inv.a(b.m());
      xk ea = new xk(iw, 0.5, 70.0, 0.5, a.m()), eb = new xk(iw, 0.5, 70.0, 0.5, b.m());
      boolean combined = ea.a(eb);
      System.out.println("{\"kind\":\"stack80\",\"a\":" + p[0] + ",\"b\":" + p[1] + ",\"itemA\":" + adb.b(a.b()) + ",\"itemB\":" + adb.b(b.b()) + ",\"isItemEqual\":" + a.a(b)
        + ",\"areItemStacksEqual\":" + add.b(new add(aji.e(p[0]), 2, 0), b) + ",\"addA\":" + addA + ",\"addB\":" + addB + ",\"slots\":" + q(slots(inv)) + ",\"combined\":" + combined
        + ",\"entityCounts\":" + q(ea.f().b + "," + eb.f().b) + "}");
    }
    Field fire = sa.class.getDeclaredField("e"), rand = sa.class.getDeclaredField("Z");
    fire.setAccessible(true);
    rand.setAccessible(true);
    // In open air: the world double has no collision boxes, so an item reaching the stone at y 63 would sink in and be pushed out (noClip ticks) as no real world does.
    FallingBlock78Probe.W.below = aji.e(0);
    for (int start : new int[] { 0, 1, 20, 30, 300 }) for (int ticks : new int[] { 0, 1, 2, 5, 19, 20, 21, 29, 30, 31, 40 }) {
      xk e = new xk(iw, 0.5, 70.0, 0.5, new add(aji.e(12), 1, 0));
      e.v = 0; e.w = 0; e.x = 0;
      rand.set(e, new Random(80)); // Entity.rand is unseeded (new Random()); a fixed seed keeps the records reproducible
      fire.setInt(e, start);
      for (int i = 0; i < ticks && !e.K; i++) e.h();
      dh t = new dh();
      e.e(t);
      System.out.println("{\"kind\":\"fire80\",\"path\":\"set\",\"start\":" + start + ",\"ticks\":" + ticks + ",\"fire\":" + t.e("Fire") + ",\"age\":" + t.e("Age") + ",\"health\":" + t.e("Health") + ",\"dead\":" + e.K + "}");
    }
    for (int start : new int[] { -1, 0, 5, 40 }) for (int ticks : new int[] { 0, 1, 2, 5, 6, 21, 41 }) {
      xk src = new xk(iw, 0.5, 70.0, 0.5, new add(aji.e(12), 1, 0));
      dh t = new dh();
      src.e(t);
      t.a("Fire", (short) start);
      t.a("Age", (short) 7);
      xk e = new xk(iw, 0.5, 70.0, 0.5, new add(aji.e(12), 1, 0));
      e.f(t);
      e.v = 0; e.w = 0; e.x = 0;
      rand.set(e, new Random(80));
      for (int i = 0; i < ticks && !e.K; i++) e.h();
      dh o = new dh();
      e.e(o);
      System.out.println("{\"kind\":\"fire80\",\"path\":\"load\",\"start\":" + start + ",\"ticks\":" + ticks + ",\"fire\":" + o.e("Fire") + ",\"age\":" + o.e("Age") + ",\"health\":" + o.e("Health") + ",\"dead\":" + e.K + "}");
    }
  }
}
