import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Runs the unchanged ItemEnderPearl right-click method (aco.a) against native
// ItemStack/EntityPlayer/EntityEnderPearl classes and a minimal recording world.
public class EnderPearlUseProbe {
  static class W extends MobMoveProbe.ProbeWorld {
    List<String> events = new ArrayList<>();
    static add stack;
    W() { super(); }
    public void a(sa entity, String sound, float volume, float pitch) {
      events.add("sound|" + sound + "|" + volume + "|" + pitch + "|count=" + stack.b);
    }
    public boolean d(sa entity) {
      if (!(entity instanceof zm)) throw new AssertionError(entity.getClass());
      events.add("spawn|enderPearl|count=" + stack.b + "|xyz=" + entity.s + "," + entity.t + "," + entity.u);
      return true;
    }
  }
  static class P extends yz {
    P() { super(null, null); }
    public add be() { return null; }
    public add q(int slot) { return null; }
    public void c(int slot, add stack) {}
    public add[] ak() { return new add[0]; }
    public r f_() { return null; }
    public boolean a(int level, String command) { return false; }
    public void a(fj message) {}
  }
  static sun.misc.Unsafe unsafe() throws Exception {
    Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); f.setAccessible(true); return (sun.misc.Unsafe) f.get(null);
  }
  static void set(Object o, String name, Object value) throws Exception { MobMoveProbe.set(o, name, value); }
  static void run(String name, boolean creative, boolean remote) throws Exception {
    sun.misc.Unsafe u = unsafe();
    W world = (W) u.allocateInstance(W.class); world.E = remote; world.events = new ArrayList<>();
    set(world, "t", u.allocateInstance(aqq.class));
    P player = (P) u.allocateInstance(P.class);
    set(player, "o", world); set(player, "Z", new Random(32)); set(player, "C", azt.a(0, 0, 0, 0, 0, 0));
    set(player, "bE", new yw()); player.bE.d = creative;
    set(player, "s", 2.0); set(player, "t", 64.0); set(player, "u", -3.0);
    set(player, "y", 25.0F); set(player, "z", -10.0F);
    aco item = new aco(); W.stack = new add(item, 2);
    Field random = adb.class.getDeclaredField("g"); random.setAccessible(true); random.set(null, new Random(71));
    add returned = item.a(W.stack, world, player);
    System.out.println("{\"case\":\"" + name + "\",\"creative\":" + creative + ",\"remote\":" + remote + ",\"sameStack\":" + (returned == W.stack)
      + ",\"maxStack\":" + MobMoveProbe.field(adb.class, "h").getInt(item) + ",\"count\":" + W.stack.b + ",\"events\":" + strings(world.events) + "}");
  }
  static String strings(List<String> values) {
    StringBuilder b = new StringBuilder("[");
    for (String s : values) { if (b.length() > 1) b.append(','); b.append('"').append(s).append('"'); }
    return b.append(']').toString();
  }
  public static void main(String[] args) throws Exception {
    run("survival-server", false, false);
    run("survival-client", false, true);
    run("creative-server", true, false);
  }
}
