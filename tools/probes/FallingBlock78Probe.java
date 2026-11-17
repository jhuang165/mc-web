import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 78 falling78: executes the unchanged 1.7.10 classes for the falling-block leftovers.
//  - item: Item.getItemFromBlock for water, lava, fire and portal (and controls): class, id, stack size, a stack's NBT as an item entity writes it.
//  - land: World.canPlaceEntityOnSide(block, x, y, z, true, 1, null, null) (the check EntityFallingBlock.onUpdate makes) over a set of cells the block lands in.
//  - fire: the Fire short an EntityItem saves after 0, 1, 2, 5 and 200 onUpdate calls (Entity.moveEntity sets fire to -fireResistance while it is not burning).
public class FallingBlock78Probe {
  public static class W extends HorseProbe.World {
    static aji target = aji.e(0), below = aji.e(1);
    public aji a(int x, int y, int z) { return y == 64 ? target : y == 63 ? below : aji.e(0); }
    public int e(int x, int y, int z) { return 0; }
  }
  static String q(String s) { return "\"" + s + "\""; }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    W world = (W) MobNbtProbe.u.allocateInstance(W.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if ((f.getType() == List.class || f.getType() == ArrayList.class) && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", MobNbtProbe.u.allocateInstance(aqq.class));
    int[] blocks = { 8, 9, 10, 11, 51, 90, 12, 13, 145, 1 };
    for (int id : blocks) {
      aji b = aji.e(id);
      adb it = adb.a(b);
      StringBuilder o = new StringBuilder("{\"kind\":\"item\",\"block\":" + id + ",\"material\":" + q(b.o() == awt.a ? "air" : "other") + ",\"item\":");
      if (it == null) o.append("null}");
      else {
        add stack = new add(b, 1, b.a(0));
        dh t = new dh();
        stack.b(t);
        o.append("{\"class\":" + q(it.getClass().getName()) + ",\"id\":" + adb.b(it) + ",\"max\":" + it.m() + ",\"damage\":" + b.a(0) + ",\"nbtId\":" + t.e("id") + ",\"nbtCount\":" + t.d("Count") + ",\"nbtDamage\":" + t.e("Damage") + "}}");
      }
      System.out.println(o);
    }
    int[] targets = { 0, 9, 8, 11, 10, 51, 78, 31, 1, 90, 106, 175 };
    // below: stone (solid top), glass (not a solid top surface), air, leaves, bottom stone slab, netherrack-free; only fire and portal can depend on it.
    for (int below : new int[] { 1, 20, 0, 18, 44 }) for (int id : blocks) for (int target : targets) {
      if (below != 1 && id != 51 && id != 90 && id != 12) continue;
      W.target = aji.e(target);
      W.below = aji.e(below);
      String res;
      try { res = String.valueOf(world.a(aji.e(id), 0, 64, 0, true, 1, null, null)); } catch (Throwable t) { res = q(t.getClass().getSimpleName()); }
      System.out.println("{\"kind\":\"land\",\"block\":" + id + ",\"target\":" + target + ",\"below\":" + below + ",\"canPlace\":" + res + "}");
    }
    W.below = aji.e(1);
    W.target = aji.e(0);
    for (int ticks : new int[] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 40, 200 }) {
      xk e = new xk(world, 0.5, 70.0, 0.5, new add(aji.e(12), 1, 0));
      e.v = 0; e.w = 0; e.x = 0;
      for (int i = 0; i < ticks; i++) e.h();
      dh t = new dh();
      e.c(t);
      System.out.println("{\"kind\":\"fire\",\"ticks\":" + ticks + ",\"fire\":" + t.e("Fire") + ",\"age\":" + t.e("Age") + "}");
    }
  }
}
