import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

// Runs scripted clicks through the unchanged 1.7.10 InventoryPlayer (yx),
// Container (zs), ContainerPlayer (aap), ContainerWorkbench (aaf),
// ContainerFurnace (aaj), ContainerChest (aad), InventoryLargeChest (ra),
// TileEntityChest (aow), CraftingManager (afe) and ItemStack (add) classes.
// Only the player and world are test doubles: they are allocated without
// constructors and record dropped/broken stacks instead of spawning entities.
public class InventoryProbe {
  static final List<String> drops = new ArrayList<>(), broken = new ArrayList<>();

  public static class ProbePlayer extends yz {
    ProbePlayer() { super(null, null); }
    public r f_() { return null; }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public xk a(add stack, boolean random) { if (stack != null) drops.add(json(stack)); return null; }
    public xk a(add stack, boolean random, boolean thrower) { if (stack != null) drops.add(json(stack)); return null; }
    public void a(ph stat, int amount) {}
    public void a(add stack) { broken.add(json(stack)); }
    float armor(float damage) { return b(ro.a((sv) this), damage); }
  }

  public static class ProbeWorld extends ahb {
    ProbeWorld() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
  }

  // Opening and closing a world-less TileEntityChest would post block events;
  // only that user count is skipped, the slot storage is unchanged.
  public static class ProbeChest extends aow {
    public void f() {}
    public void l_() {}
  }

  static sun.misc.Unsafe unsafe() throws Exception {
    Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    f.setAccessible(true);
    return (sun.misc.Unsafe) f.get(null);
  }

  static String json(add s) {
    return s == null ? "null" : "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "]";
  }

  static add stack(String[] p, int at) {
    return new add(adb.d(Integer.parseInt(p[at])), Integer.parseInt(p[at + 1]), Integer.parseInt(p[at + 2]));
  }

  static String list(List<String> values) { return "[" + String.join(",", values) + "]"; }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    sun.misc.Unsafe unsafe = unsafe();
    BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
    String name = null, line;
    ProbePlayer player = null;
    yx inv = null;
    zs container = null;
    ProbeWorld world = null;
    List<String> results = new ArrayList<>();
    while ((line = in.readLine()) != null) {
      line = line.trim();
      if (line.isEmpty() || line.startsWith("#")) continue;
      String[] p = line.split("\\s+");
      switch (p[0]) {
        case "case" -> {
          name = p[1];
          player = (ProbePlayer) unsafe.allocateInstance(ProbePlayer.class);
          world = (ProbeWorld) unsafe.allocateInstance(ProbeWorld.class);
          player.o = world;
          player.bE = new yw();
          inv = new yx(player);
          player.bm = inv;
          container = new aap(inv, true, player);
          player.bn = container;
          player.bo = container;
          results.clear(); drops.clear(); broken.clear();
        }
        case "creative" -> player.bE.d = true;
        case "remote" -> world.E = true;
        case "workbench" -> { container = new aaf(inv, world, 0, 0, 0); player.bo = container; }
        case "furnace" -> { container = new aaj(inv, new apg()); player.bo = container; }
        case "chest" -> { container = new aad(inv, new ProbeChest()); player.bo = container; }
        case "largechest" -> { container = new aad(inv, new ra("container.chestDouble", new ProbeChest(), new ProbeChest())); player.bo = container; }
        case "inv" -> inv.a[Integer.parseInt(p[1])] = stack(p, 2);
        case "fill" -> { for (int i = 0; i < inv.a.length; i++) if (inv.a[i] == null) inv.a[i] = stack(p, 1); }
        case "burn" -> results.add(String.valueOf(apg.a(stack(p, 1))));
        case "smelt" -> results.add(json(afa.a().a(stack(p, 1))));
        case "armorinfo" -> { abb a = (abb) adb.d(Integer.parseInt(p[1])); results.add("[" + a.b + "," + a.c + "," + a.o() + "]"); }
        case "wear" -> inv.b[Integer.parseInt(p[1])] = stack(p, 2);
        case "hurt" -> { float d = player.armor(Float.parseFloat(p[1])); results.add("[" + d + "," + inv.l() + "]"); }
        case "put" -> container.a(Integer.parseInt(p[1])).c(stack(p, 2));
        case "cursor" -> inv.b(stack(p, 1));
        case "select" -> inv.c = Integer.parseInt(p[1]);
        case "click" -> results.add(json(container.a(Integer.parseInt(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3]), player)));
        case "add" -> { add s = stack(p, 1); boolean ok = inv.a(s); results.add("[" + ok + "," + s.b + "]"); }
        case "consume" -> results.add(String.valueOf(inv.a(adb.d(Integer.parseInt(p[1])))));
        case "damage" -> {
          int slot = Integer.parseInt(p[1]);
          inv.a[slot].a(Integer.parseInt(p[2]), player);
          if (inv.a[slot].b <= 0) inv.a[slot] = null;
        }
        case "pick" -> inv.a(adb.d(Integer.parseInt(p[1])), 0, false, player.bE.d);
        case "close" -> container.b(player);
        case "end" -> {
          List<String> main = new ArrayList<>(), slots = new ArrayList<>();
          List<String> armor = new ArrayList<>();
          for (add s : inv.a) main.add(json(s));
          for (add s : inv.b) armor.add(json(s));
          for (Object slot : container.c) slots.add(json(((aay) slot).d()));
          System.out.println("{\"case\":\"" + name + "\",\"inventory\":" + list(main) + ",\"cursor\":" + json(inv.o())
            + ",\"armor\":" + list(armor) + ",\"current\":" + inv.c + ",\"slots\":" + list(slots) + ",\"results\":" + list(results)
            + ",\"drops\":" + list(drops) + ",\"broken\":" + list(broken) + "}");
        }
        default -> throw new IllegalArgumentException(line);
      }
    }
  }
}
