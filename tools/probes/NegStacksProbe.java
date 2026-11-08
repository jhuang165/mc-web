import java.util.*;

// Batch 26 negstacks evidence on the unchanged 1.7.10 classes (EyeOfEnderProbe's EW world double, Attributes2Probe's helpers). No class is patched.
//  tileRead   TileEntityChest (aow), TileEntityDispenser (apb), TileEntityFurnace (apg), TileEntityBrewingStand (aov) readFromNBT (a(dh)) of a slot with Count -1/0/1,
//             the slot read back (a(int)) and the Items list written again (b(dh)): the written Count.
//  playerRead InventoryPlayer.readFromNBT (yx.b(dq)) of main and armour slots with Count -1/0/1, written again (yx.a(dq)).
//  use        ItemStack.tryPlaceItemIntoWorld at stackSize -1 (and 0 and 1 for the blocks that matter) in Survival and Creative.
//  rightClick useItemRightClick (then onFoodEaten) at stackSize -1.
//  chain      the same item used three times in a row from stackSize 1 and 0 (what stackSize each use leaves).
public class NegStacksProbe {
  static void out(String s) { System.out.println(s); }
  static String stack(add s) { return Attributes2Probe.stack(s); }

  static dh tileTag(String id, int slot, int count, int itemId, int size) {
    dh t = new dh();
    t.a("id", id); t.a("x", 0); t.a("y", 64); t.a("z", 0);
    dq items = new dq();
    dh e = Attributes2Probe.itemTag(itemId, count, 0);
    e.a("Slot", (byte) slot);
    items.a(e);
    t.a("Items", items);
    return t;
  }
  static void tiles() throws Exception {
    Object[][] kinds = { { "chest", "Chest", 3 }, { "dispenser", "Trap", 4 }, { "furnace", "Furnace", 1 }, { "brewing", "Cauldron", 2 } };
    for (Object[] k : kinds) for (int count : new int[] { -1, 0, 1, 127 }) {
      int slot = (Integer) k[2];
      dh t = tileTag((String) k[1], slot, count, 264, 0);
      Object te; add got; dh t2 = new dh(); int written = -999, listSize = -1;
      String name = (String) k[0];
      if (name.equals("chest")) { aow c = new aow(); c.a(t); got = c.a(slot); c.b(t2); te = c; }
      else if (name.equals("dispenser")) { apb c = new apb(); c.a(t); got = c.a(slot); c.b(t2); te = c; }
      else if (name.equals("furnace")) { apg c = new apg(); c.a(t); got = c.a(slot); c.b(t2); te = c; }
      else { aov c = new aov(); c.a(t); got = c.a(slot); c.b(t2); te = c; }
      dq list = t2.c("Items", 10);
      listSize = list.c();
      if (listSize > 0) written = list.b(0).d("Count");
      out("{\"case\":\"tileRead\",\"tile\":\"" + name + "\",\"count\":" + count + ",\"stack\":" + stack(got) + ",\"listSize\":" + listSize + ",\"writtenCount\":" + written + "}");
    }
  }
  static void player() throws Exception {
    for (int count : new int[] { -1, 0, 1 }) for (int slotKind = 0; slotKind < 2; slotKind++) {
      EyeOfEnderProbe.Gamer p = Attributes2Probe.gamer(false);
      yx inv = (yx) MobMoveProbe.field(yz.class, "bm").get(p);
      dq list = new dq();
      dh e = Attributes2Probe.itemTag(264, count, 0);
      e.a("Slot", (byte) (slotKind == 0 ? 3 : 100));
      list.a(e);
      inv.b(list);
      dq back = new dq();
      inv.a(back);
      int written = back.c() > 0 ? back.b(0).d("Count") : -999;
      out("{\"case\":\"playerRead\",\"slot\":\"" + (slotKind == 0 ? "main" : "armour") + "\",\"count\":" + count + ",\"main\":" + stack(inv.a[3]) + ",\"armour\":" + stack(inv.b[0]) + ",\"listSize\":" + back.c() + ",\"writtenCount\":" + written + "}");
    }
  }
  static void items() throws Exception {
    EyeOfEnderProbe.main(new String[0]);
    out("--items--");
    WitchProbe.WW w = WitchProbe.w;
    MobMoveProbe.field(ahb.class, "L").set(w, new ArrayList());
    EyeOfEnderProbe.EW.log.clear();
    Object[][] uses = {
      { "stone", 1, 0, 1, 0 }, { "torch", 50, 0, 1, 0 }, { "slab", 44, 0, 1, 0 }, { "cake", 354, 0, 1, 0 }, { "redstone", 331, 0, 1, 0 },
      { "door", 324, 0, 1, 0 }, { "bed", 355, 0, 1, 0 }, { "seeds", 295, 0, 60, 0 }, { "spawnEgg", 383, 90, 1, 0 },
      { "boneMealSapling", 351, 15, 2, 6 }, { "reed", 338, 0, 2, 0 }, { "netherWart", 372, 0, 88, 0 }, { "minecartOnRail", 328, 0, 66, 0 },
    };
    for (Object[] c : uses) for (int creative = 0; creative < 2; creative++) for (int count : new int[] { -1, -2 }) {
      WitchProbe.WW.cells.clear();
      EyeOfEnderProbe.EW.log.clear();
      EyeOfEnderProbe.EW.spawned.clear();
      int under = (Integer) c[3], above = (Integer) c[4];
      int targetY = above != 0 ? 64 : 63;
      WitchProbe.WW.cells.put("0,63,0", new int[] { under, 0 });
      if (above != 0) WitchProbe.WW.cells.put("0,64,0", new int[] { above, 0 });
      if ((Integer) c[1] == 338) WitchProbe.WW.cells.put("1,63,0", new int[] { 9, 0 });
      EyeOfEnderProbe.Gamer p = Attributes2Probe.gamer(creative == 1);
      EyeOfEnderProbe.itemRandom(4);
      MobMoveProbe.set(w, "s", new Random(2));
      add s = new add(adb.d((Integer) c[1]), count, (Integer) c[2]);
      boolean used; String error = null;
      try { used = s.a(p, w, 0, targetY, 0, 1, 0.5f, 1f, 0.5f); } catch (Throwable x) { used = false; error = x.toString(); }
      out("{\"case\":\"use\",\"name\":" + Attributes2Probe.q((String) c[0]) + ",\"item\":" + c[1] + ",\"creative\":" + (creative == 1) + ",\"count\":" + count + ",\"used\":" + used + ",\"after\":" + s.b
        + ",\"error\":" + (error == null ? "null" : Attributes2Probe.q(error)) + ",\"spawned\":" + EyeOfEnderProbe.EW.spawned.size() + "}");
    }
    Object[][] clicks = {
      { "snowball", 332, 0, 0, false }, { "enderPearl", 368, 0, 0, false }, { "apple", 260, 0, 0, true }, { "milk", 335, 0, 0, true },
      { "emptyBucketWater", 325, 0, 2, false }, { "waterBucket", 326, 0, 1, false }, { "glassBottleWater", 374, 0, 2, false },
    };
    for (Object[] c : clicks) for (int creative = 0; creative < 2; creative++) for (int count : new int[] { -1 }) {
      WitchProbe.WW.cells.clear();
      EyeOfEnderProbe.EW.log.clear();
      EyeOfEnderProbe.EW.spawned.clear();
      int ray = (Integer) c[3];
      if (ray == 1) { WitchProbe.WW.cells.put("0,63,0", new int[] { 1, 0 }); EyeOfEnderProbe.EW.rayHit = new int[] { 0, 63, 0, 1 }; }
      if (ray == 2) { WitchProbe.WW.cells.put("0,63,0", new int[] { 9, 0 }); EyeOfEnderProbe.EW.rayHit = new int[] { 0, 63, 0, 1 }; }
      EyeOfEnderProbe.Gamer p = Attributes2Probe.gamer(creative == 1);
      yx inv = (yx) MobMoveProbe.field(yz.class, "bm").get(p);
      zr food = p.bQ();
      MobMoveProbe.field(zr.class, "a").setInt(food, 10);
      EyeOfEnderProbe.itemRandom(4);
      MobMoveProbe.set(w, "s", new Random(2));
      add s = new add(adb.d((Integer) c[1]), count, (Integer) c[2]);
      inv.a[inv.c] = s;
      add result = null, eaten = null; String error = null;
      try { result = s.a(w, p); if ((Boolean) c[4] && result != null) eaten = result.b(w, p); } catch (Throwable x) { error = x.toString(); }
      out("{\"case\":\"rightClick\",\"name\":" + Attributes2Probe.q((String) c[0]) + ",\"creative\":" + (creative == 1) + ",\"count\":" + count + ",\"result\":" + stack(result) + ",\"same\":" + (result == s)
        + ",\"eaten\":" + stack(eaten) + ",\"after\":" + s.b + ",\"error\":" + (error == null ? "null" : Attributes2Probe.q(error)) + "}");
    }
  }
  public static void main(String[] args) throws Exception {
    String mode = args.length > 0 ? args[0] : "tiles";
    if (mode.equals("tiles")) { EyeOfEnderProbe.main(new String[0]); out("--items--"); tiles(); player(); }
    else items();
  }
}
