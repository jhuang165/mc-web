import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.*;

// Batch 28 negstacks3 evidence from the unchanged 1.7.10 classes (ZeroStacksProbe's player double, PlayerDamageProbe's world double).
//   inventory  tools/neg-stacks3-scripts.mjs scripts (the InventoryProbe format plus dispenser / hopper / brewing containers) through Container.slotClick
//              (zs.a), transferStackInSlot of ContainerPlayer, ContainerFurnace (aaj), ContainerChest (aad), ContainerDispenser (aaz),
//              ContainerHopper (aal) and ContainerBrewingStand (zz), with negative and zero stacks in the slots and the cursor.
public class NegStacks3Probe {
  static String json(add s) { return ZeroStacksProbe.json(s); }
  static String list(List<String> v) { return ZeroStacksProbe.list(v); }
  static add stack(String[] p, int at) { return ZeroStacksProbe.stack(p, at); }

  public static class Chest extends aow { public void f() {} public void l_() {} }

  public static void main(String[] args) throws Exception {
    String mode = args.length > 0 ? args[0] : "inventory";
    if (mode.equals("give")) { give(); return; }
    if (mode.equals("dispense")) { dispense(); return; }
    if (mode.equals("furnace") || mode.equals("brewing")) { tiles(mode.equals("furnace")); return; }
    PlayerDamageProbe.init();
    sun.misc.Unsafe u = PlayerDamageProbe.u;
    ArmorEnchantmentProbe.U = u;
    if (mode.equals("inventory")) inventory(u);
  }

  // ---- /give ----------------------------------------------------------------------------------------------------------------------
  // CommandGive.func_71515_b (bytecode-read) ends in EntityPlayer.func_146097_a(stack, false, false) (yz.a(add, Z)), then entity.delayBeforeCanPickup = 0 and
  // entity.func_145797_a(player name) (xk.a(String): the Owner field g). The native player, an EntityItem on the EW world double; the player's Entity.rand is seeded.
  static String num(double d) { return Double.toString(d); }
  static void give() throws Exception {
    EyeOfEnderProbe.main(new String[0]);
    System.out.println("--items--");
    MobMoveProbe.field(ahb.class, "L").set(WitchProbe.w, new ArrayList());
    for (int count : new int[] { 1, 5, 64 }) for (long seed : new long[] { 1, 2, 77 }) for (float yaw : new float[] { 0f, 45f, 170f, -90f, 400f }) for (float pitch : new float[] { 0f, 30f, -60f, 89f }) {
      EyeOfEnderProbe.EW.spawned.clear();
      EyeOfEnderProbe.Gamer p = NegStacks2Probe.gamer(false);
      MobMoveProbe.set(p, "Z", new Random(seed));
      MobMoveProbe.set(p, "s", 10.5); MobMoveProbe.set(p, "t", 64.0); MobMoveProbe.set(p, "u", -3.25);
      MobMoveProbe.set(p, "y", yaw); MobMoveProbe.set(p, "z", pitch);
      add stack = new add(adb.d(264), count, 0);
      xk e = p.a(stack, false);
      e.b = 0; e.a(p.b_());
      System.out.println("{\"case\":\"give\",\"count\":" + count + ",\"seed\":" + seed + ",\"yaw\":" + yaw + ",\"pitch\":" + pitch + ",\"x\":" + num(e.s) + ",\"y\":" + num(e.t) + ",\"z\":" + num(e.u)
        + ",\"mx\":" + num(e.v) + ",\"my\":" + num(e.w) + ",\"mz\":" + num(e.x) + ",\"delay\":" + e.b + ",\"owner\":\"" + MobMoveProbe.field(xk.class, "g").get(e) + "\",\"thrower\":" + MobMoveProbe.field(xk.class, "f").get(e)
        + ",\"stack\":" + json(e.f()) + ",\"spawned\":" + EyeOfEnderProbe.EW.spawned.size() + ",\"inventoryEmpty\":" + inventoryEmpty(p) + ",\"next\":" + ((Random) MobMoveProbe.field(sa.class, "Z").get(p)).nextInt(1000000) + "}");
    }
  }
  static boolean inventoryEmpty(yz p) throws Exception {
    yx i = (yx) MobMoveProbe.field(yz.class, "bm").get(p);
    for (add s : i.a) if (s != null) return false;
    for (add s : i.b) if (s != null) return false;
    return true;
  }

  static void inventory(sun.misc.Unsafe u) throws Exception {
    BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
    String name = null, line;
    ZeroStacksProbe.P player = null; yx inv = null; zs container = null;
    List<String> results = new ArrayList<>();
    while ((line = in.readLine()) != null) {
      line = line.trim();
      if (line.isEmpty() || line.startsWith("#")) continue;
      String[] p = line.split("\\s+");
      switch (p[0]) {
        case "case" -> {
          name = p[1];
          player = (ZeroStacksProbe.P) u.allocateInstance(ZeroStacksProbe.P.class);
          MobMoveProbe.field(sa.class, "o").set(player, PlayerDamageProbe.w);
          MobMoveProbe.field(sa.class, "Z").set(player, new Random(0));
          player.bE = new yw();
          inv = new yx(player);
          player.bm = inv;
          container = new aap(inv, true, player);
          player.bn = container; player.bo = container;
          results.clear(); ZeroStacksProbe.drops.clear(); ZeroStacksProbe.broken.clear();
        }
        case "furnace" -> { container = new aaj(inv, new apg()); player.bo = container; }
        case "chest" -> { container = new aad(inv, new Chest()); player.bo = container; }
        case "dispenser" -> { container = new aaz(inv, new apb()); player.bo = container; }
        case "hopper" -> { container = new aal(inv, new api()); player.bo = container; }
        case "brewing" -> { container = new zz(inv, new aov()); player.bo = container; }
        case "creative" -> player.bE.d = true;
        case "inv" -> inv.a[Integer.parseInt(p[1])] = stack(p, 2);
        case "wear" -> inv.b[Integer.parseInt(p[1])] = stack(p, 2);
        case "put" -> container.a(Integer.parseInt(p[1])).c(stack(p, 2));
        case "cursor" -> inv.b(stack(p, 1));
        case "select" -> inv.c = Integer.parseInt(p[1]);
        case "click" -> {
          String r; try { r = json(container.a(Integer.parseInt(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3]), player)); } catch (Throwable t) { r = "\"error " + t.getClass().getSimpleName() + "\""; }
          results.add(r);
        }
        case "close" -> container.b(player);
        case "end" -> {
          List<String> main = new ArrayList<>(), armor = new ArrayList<>(), sl = new ArrayList<>();
          for (add s : inv.a) main.add(json(s));
          for (add s : inv.b) armor.add(json(s));
          for (Object slot : container.c) sl.add(json(((aay) slot).d()));
          System.out.println("{\"case\":\"" + name + "\",\"inventory\":" + list(main) + ",\"cursor\":" + json(inv.o()) + ",\"armor\":" + list(armor)
            + ",\"current\":" + inv.c + ",\"slots\":" + list(sl) + ",\"results\":" + list(results) + ",\"drops\":" + list(ZeroStacksProbe.drops) + ",\"broken\":" + list(ZeroStacksProbe.broken) + "}");
        }
        default -> throw new IllegalArgumentException(line);
      }
    }
  }

  // ---- dispenser / dropper ---------------------------------------------------------------------------------------------------------
  // DispenseProbe's own rows (kind dispense / dropperInto, the dispense.test.js format) with stack sizes -2, -1 and 0 in the dispenser slots.
  static void dispense() throws Exception {
    java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); DispenseProbe.U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l(); kl.a();
    System.out.println("--items--");
    String[] items = { "280:%d:0", "262:%d:0", "344:%d:0", "332:%d:0", "373:%d:16396", "326:%d:0", "325:%d:0", "327:%d:0", "259:%d:0", "351:%d:15", "46:%d:0", "328:%d:0", "264:%d:0" };
    for (int n : new int[] { -2, -1, 0 }) for (String it : items) for (int block : new int[] { 23, 158 }) for (int f : new int[] { 2, 1 }) {
      String sp = String.format(it, n);
      DispenseProbe.dispense("neg-" + it.split(":")[0], block, f, 11, new String[] { sp }, "0,0,0,0,0");
    }
    // cells that make a behaviour act: water ahead for the empty bucket, a rail for the cart, wheat for bone meal, TNT for flint
    for (int n : new int[] { -2, -1, 0 }) for (int f = 2; f < 6; f++) {
      DispenseProbe.dispense("negEmptyWater", 23, f, 9, new String[] { "325:" + n + ":0" }, "0,0,0,9,0");
      DispenseProbe.dispense("negWaterAir", 23, f, 9, new String[] { "326:" + n + ":0" }, "0,0,0,0,0");
      DispenseProbe.dispense("negLavaAir", 23, f, 9, new String[] { "327:" + n + ":0" }, "0,0,0,0,0");
      DispenseProbe.dispense("negCartRail", 23, f, 3, new String[] { "328:" + n + ":0" }, "0,0,0,66,0");
      DispenseProbe.dispense("negBoneWheat", 23, f, 4, new String[] { "351:" + n + ":15" }, "0,0,0,59,2");
      DispenseProbe.dispense("negFlintTnt", 23, f, 4, new String[] { "259:" + n + ":0" }, "0,0,0,46,0");
      DispenseProbe.dispense("negFlintAir", 23, f, 4, new String[] { "259:" + n + ":0" }, "0,0,0,0,0");
    }
    // slot choice with a negative / zero stack among others (the pick is by non-null, the Random draws are unchanged)
    for (int f = 2; f < 4; f++) for (long seed : new long[] { 5, 6 }) {
      DispenseProbe.dispense("negSlotPick", 23, f, seed, new String[] { "280:-1:0", null, "281:0:0", "282:4:0", "283:-3:0" }, "0,0,0,0,0");
      DispenseProbe.dispense("negSlotPickDropper", 158, f, seed, new String[] { "280:-1:0", null, "281:0:0", "282:4:0", "283:-3:0" }, "0,0,0,0,0");
    }
    // dropper into a container ahead holding the same item at a negative size / zero, and a negative stack dropped into an empty container
    for (int f = 2; f < 4; f++) for (int n : new int[] { -2, -1, 0 }) {
      DispenseProbe.dropperInto("negIntoDispenserSame", f, 23, new apb(), new String[] { "280:" + n + ":0" }, new String[] { "280:3:0" });
      DispenseProbe.dropperInto("negIntoDispenserSame2", f, 23, new apb(), new String[] { "280:5:0" }, new String[] { "280:" + n + ":0" });
      DispenseProbe.dropperInto("negIntoDispenserEmpty", f, 23, new apb(), new String[] { null }, new String[] { "280:" + n + ":0" });
      DispenseProbe.dropperInto("negIntoChest", f, 54, new aow(), new String[] { "280:1:0" }, new String[] { "280:" + n + ":0" });
      DispenseProbe.dropperInto("negIntoChestSame", f, 54, new aow(), new String[] { "280:" + n + ":0" }, new String[] { "280:3:0" });
      DispenseProbe.dropperInto("negIntoHopper", f, 154, new api(), new String[] { null }, new String[] { "280:" + n + ":0" });
      DispenseProbe.dropperInto("negIntoFurnace", f, 61, new apg(), new String[] { null }, new String[] { "4:" + n + ":0" });
      DispenseProbe.dropperInto("negIntoFurnaceFuel", f, 61, new apg(), new String[] { null }, new String[] { "263:" + n + ":0" });
      DispenseProbe.dropperInto("negIntoFurnaceSame", f, 61, new apg(), new String[] { "4:" + n + ":0" }, new String[] { "4:3:0" });
    }
  }

  // ---- furnace and brewing stand ------------------------------------------------------------------------------------------------------
  // TileEntityFurnace.updateEntity (apg.h) and TileEntityBrewingStand.updateEntity (aov.h) driven on HopperProbe's World fixture with stack sizes -2..2 (0 is a real
  // size-0 stack; "x" is an empty slot). Snapshots: [tick, slots, burn/brew time, currentItemBurnTime, cookTime, block id, block metadata].
  static add spec(String sp) { return sp.equals("x") ? null : DispenseProbe.stack(sp); }
  static void tiles(boolean furnace) throws Exception {
    java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); RedstoneProbe.unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    System.out.println("--items--");
    int[] counts = { -2, -1, 0, 1, 2 };
    if (furnace) {
      String[] inputs = { "15:%d:0", "264:%d:0" }, fuels = { "263:%d:0", "327:%d:0", "264:%d:0" }, outputs = { "x", "265:-2:0", "265:0:0", "265:63:0", "265:2:0" };
      for (String in : inputs) for (int ci : counts) for (String fu : fuels) for (int cf : counts) for (String out : outputs) for (int hot = 0; hot < 2; hot++) {
        String[] sl = { String.format(in, ci), String.format(fu, cf), out };
        HopperProbe.L w = HopperProbe.world(1);
        w.raw(0, 1, 0, aji.e(61), 2);
        apg t = (apg) w.o(0, 1, 0);
        for (int i = 0; i < 3; i++) t.a(i, spec(sl[i]));
        if (hot == 1) { t.a = 30; t.i = 50; t.j = 5; }
        StringBuilder snaps = new StringBuilder();
        for (int tick = 1; tick <= 206; tick++) {
          w.time++; t.h(); w.tickUpdates();
          if (tick <= 3 || tick >= 200 && tick <= 206 || tick == 100) {
            if (snaps.length() > 0) snaps.append(',');
            snaps.append("[").append(tick).append(",[").append(slots(t, 3)).append("],").append(t.a).append(",").append(t.i).append(",").append(t.j).append(",").append(aji.b(w.a(0, 1, 0))).append(",").append(w.e(0, 1, 0)).append("]");
          }
        }
        System.out.println("{\"case\":\"furnace\",\"slots\":[\"" + sl[0] + "\",\"" + sl[1] + "\",\"" + sl[2] + "\"],\"hot\":" + hot + ",\"snaps\":[" + snaps + "]}");
      }
    } else {
      String[] ingredients = { "372:%d:0", "264:%d:0", "331:%d:0" }, bottles = { "373:%d:0", "374:%d:0", "x" };
      for (String ing : ingredients) for (int ci : counts) for (String b0 : bottles) for (int cb : new int[] { -2, -1, 0, 1 }) for (String b1 : new String[] { "x", "373:%d:0" }) for (int start = 0; start < 2; start++) {
        String[] sl = { b0.equals("x") ? "x" : String.format(b0, cb), b1.equals("x") ? "x" : String.format(b1, cb), "x", String.format(ing, ci) };
        HopperProbe.L w = HopperProbe.world(1);
        w.raw(0, 1, 0, aji.e(117), 0);
        aov t = (aov) w.o(0, 1, 0);
        for (int i = 0; i < 4; i++) t.a(i, spec(sl[i]));
        if (start == 1) MobMoveProbe.set(t, "k", 5);
        StringBuilder snaps = new StringBuilder();
        for (int tick = 1; tick <= 403; tick++) {
          w.time++; t.h(); w.tickUpdates();
          if (tick <= 3 || tick >= 398 && tick <= 403 || tick == 6) {
            if (snaps.length() > 0) snaps.append(',');
            snaps.append("[").append(tick).append(",[").append(slots(t, 4)).append("],").append(MobMoveProbe.field(aov.class, "k").getInt(t)).append(",").append(aji.b(w.a(0, 1, 0))).append(",").append(w.e(0, 1, 0)).append("]");
          }
        }
        System.out.println("{\"case\":\"brewing\",\"slots\":[" + q4(sl) + "],\"start\":" + start + ",\"snaps\":[" + snaps + "]}");
      }
    }
  }
  static String q4(String[] a) { StringBuilder b = new StringBuilder(); for (String s : a) b.append(b.length() > 0 ? "," : "").append("\"").append(s).append("\""); return b.toString(); }
  static String slots(rb t, int n) { StringBuilder b = new StringBuilder(); for (int i = 0; i < n; i++) b.append(i > 0 ? "," : "").append(DispenseProbe.enc(t.a(i))); return b.toString(); }
}
