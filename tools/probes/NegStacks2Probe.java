import java.util.*;

// Batch 27 negstacks2 evidence on the unchanged 1.7.10 classes (EyeOfEnderProbe's EW world double, Attributes2Probe's helpers, NegStacksProbe's style). No class is patched.
//  add        InventoryPlayer.addItemStackToInventory (yx.a(add)) of a stack with size -2..2 into several inventory states, Survival and Creative:
//             the returned flag, the stack size left and the inventory afterwards.
//  pickup     EntityItem.onCollideWithPlayer (xk.b_(yz)) with delayBeforeCanPickup 0, run twice: the entity stack, isDead, the inventory.
//  decr       InventoryPlayer.decrStackSize (yx.a(int, int)) of a stack with size -2..5 by n 0..64: the stack handed back and the slot afterwards.
//  drop       EntityPlayer.func_146097_a (yz.a(add, boolean, boolean)) and InventoryPlayer.dropAllItems (yx.m()): the spawned item entities.
//  armour     InventoryPlayer.getTotalArmorValue (yx.l()) with a diamond (not armour) and an iron chestplate in armour slot 2, sizes -1/0/1.
//  interact   EntityPlayer.interactWith (yz.q(sa)) of a pig / horse (HorseGearProbe's world) with a saddle, lead, name tag or dye... held at size -2..2: result and the held slot after.
//  firework   ItemFirework.onItemUse (acs.a) at stackSize -1/0/1 in Survival and Creative.
public class NegStacks2Probe {
  static void out(String s) { System.out.println(s); }
  static String stack(add s) { return Attributes2Probe.stack(s); }
  static String inv(yx i) {
    StringBuilder b = new StringBuilder("[");
    boolean first = true;
    for (int k = 0; k < i.a.length + i.b.length; k++) {
      add s = k < i.a.length ? i.a[k] : i.b[k - i.a.length];
      if (s == null) continue;
      if (!first) b.append(",");
      first = false;
      b.append("[").append(k).append(",").append(adb.b(s.b())).append(",").append(s.b).append(",").append(s.k()).append("]");
    }
    return b.append("]").toString();
  }
  static EyeOfEnderProbe.Gamer gamer(boolean creative) throws Exception {
    EyeOfEnderProbe.Gamer p = Attributes2Probe.gamer(creative);
    MobMoveProbe.set(p, "i", new com.mojang.authlib.GameProfile(new UUID(1L, 2L), "Player"));
    return p;
  }
  static yx inventoryOf(EyeOfEnderProbe.Gamer p) throws Exception { return (yx) MobMoveProbe.field(yz.class, "bm").get(p); }
  // Inventory states: 0 empty, 1 same item x5 in slot 2, 2 same item x64 in slot 2 (rest empty), 3 every slot full of dirt, 4 every slot full of dirt except slot 7 holding 10 of the item
  static void fill(yx i, int state, int itemId) {
    if (state == 1) i.a[2] = new add(adb.d(itemId), 5, 0);
    if (state == 2) i.a[2] = new add(adb.d(itemId), 64, 0);
    if (state >= 3) for (int k = 0; k < i.a.length; k++) i.a[k] = new add(adb.d(3), 64, 0);
    if (state == 4) i.a[7] = new add(adb.d(itemId), 10, 0);
  }
  static void adds() throws Exception {
    Object[][] kinds = { { "diamond", 264, 0 }, { "ironSword", 267, 0 }, { "damagedSword", 267, 7 }, { "bucket", 325, 0 } };
    for (Object[] k : kinds) for (int creative = 0; creative < 2; creative++) for (int state = 0; state < 5; state++) for (int count : new int[] { -2, -1, 0, 1, 2 }) {
      EyeOfEnderProbe.Gamer p = gamer(creative == 1);
      yx i = inventoryOf(p);
      fill(i, state, (Integer) k[1]);
      add s = new add(adb.d((Integer) k[1]), count, (Integer) k[2]);
      boolean r; String error = null;
      try { r = i.a(s); } catch (Throwable x) { r = false; error = x.toString(); }
      out("{\"case\":\"add\",\"name\":\"" + k[0] + "\",\"creative\":" + (creative == 1) + ",\"state\":" + state + ",\"count\":" + count + ",\"result\":" + r + ",\"left\":" + s.b
        + ",\"inventory\":" + inv(i) + ",\"error\":" + (error == null ? "null" : Attributes2Probe.q(error)) + "}");
    }
  }
  static void pickups() throws Exception {
    WitchProbe.WW w = WitchProbe.w;
    for (int state : new int[] { 0, 1, 2 }) for (int creative = 0; creative < 2; creative++) for (int count : new int[] { -2, -1, 0 }) {
      EyeOfEnderProbe.EW.spawned.clear();
      dh t = new dh();
      t.a("Health", (short) 5); t.a("Age", (short) 0);
      t.a("Item", Attributes2Probe.itemTag(264, count, 0));
      xk e = new xk(w);
      MobMoveProbe.set(e, "Z", new Random(3));
      e.a(t);
      MobMoveProbe.set(e, "b", 0);
      EyeOfEnderProbe.Gamer p = gamer(creative == 1);
      yx i = inventoryOf(p);
      fill(i, state, 264);
      StringBuilder steps = new StringBuilder("[");
      for (int pass = 0; pass < 2; pass++) {
        String error = null;
        try { e.b_(p); } catch (Throwable x) { error = x.toString(); }
        if (pass > 0) steps.append(",");
        steps.append("{\"stack\":" + stack(e.f()) + ",\"dead\":" + MobMoveProbe.field(sa.class, "K").getBoolean(e) + ",\"inventory\":" + inv(i) + ",\"error\":" + (error == null ? "null" : Attributes2Probe.q(error)) + "}");
      }
      out("{\"case\":\"pickup\",\"creative\":" + (creative == 1) + ",\"state\":" + state + ",\"count\":" + count + ",\"steps\":" + steps + "]}");
    }
  }
  static void decrs() throws Exception {
    for (int size : new int[] { -2, -1, 0, 1, 2, 5 }) for (int n : new int[] { 0, 1, 2, 5, 64 }) for (int slot : new int[] { 3, 38 }) {
      EyeOfEnderProbe.Gamer p = gamer(false);
      yx i = inventoryOf(p);
      add s = new add(adb.d(264), size, 0);
      if (slot < 36) i.a[slot] = s; else i.b[slot - 36] = s;
      add got = i.a(slot, n);
      out("{\"case\":\"decr\",\"slot\":" + slot + ",\"size\":" + size + ",\"n\":" + n + ",\"result\":" + stack(got) + ",\"same\":" + (got == s) + ",\"inventory\":" + inv(i) + "}");
    }
  }
  static String spawned() {
    StringBuilder b = new StringBuilder("[");
    for (int k = 0; k < EyeOfEnderProbe.EW.spawned.size(); k++) {
      sa e = EyeOfEnderProbe.EW.spawned.get(k);
      if (k > 0) b.append(",");
      b.append(e instanceof xk ? stack(((xk) e).f()) : "\"" + e.getClass().getSimpleName() + "\"");
    }
    return b.append("]").toString();
  }
  static void drops() throws Exception {
    for (int count : new int[] { -2, -1, 0, 1 }) for (int kind = 0; kind < 3; kind++) {
      EyeOfEnderProbe.EW.spawned.clear();
      EyeOfEnderProbe.Gamer p = gamer(false);
      yx i = inventoryOf(p);
      add s = new add(adb.d(264), count, 0);
      String what;
      if (kind == 0) { what = "dropItem"; xk e = p.a(s, false, true); i.a[0] = null; what += e == null ? "Null" : "Entity"; }
      else if (kind == 1) { what = "dropAll"; i.a[0] = s; i.a[5] = new add(adb.d(264), count, 0); i.m(); }
      else { what = "dropAllArmour"; i.b[2] = s; i.m(); }
      out("{\"case\":\"drop\",\"what\":\"" + what + "\",\"count\":" + count + ",\"spawned\":" + spawned() + ",\"inventory\":" + inv(i) + "}");
    }
  }
  static void armours() throws Exception {
    for (int item : new int[] { 264, 307 }) for (int count : new int[] { -1, 0, 1 }) {
      EyeOfEnderProbe.Gamer p = gamer(false);
      yx i = inventoryOf(p);
      i.b[2] = new add(adb.d(item), count, 0);
      out("{\"case\":\"armour\",\"item\":" + item + ",\"count\":" + count + ",\"armorValue\":" + i.l() + "}");
    }
  }
  static void fireworks() throws Exception {
    WitchProbe.WW w = WitchProbe.w;
    for (int creative = 0; creative < 2; creative++) for (int count : new int[] { -1, 0, 1 }) {
      WitchProbe.WW.cells.clear();
      EyeOfEnderProbe.EW.log.clear();
      EyeOfEnderProbe.EW.spawned.clear();
      WitchProbe.WW.cells.put("0,63,0", new int[] { 1, 0 });
      EyeOfEnderProbe.Gamer p = gamer(creative == 1);
      add s = new add(adb.d(401), count, 0);
      boolean used; String error = null;
      try { used = s.a(p, w, 0, 63, 0, 1, 0.5f, 1f, 0.5f); } catch (Throwable x) { used = false; error = x.toString(); }
      out("{\"case\":\"firework\",\"creative\":" + (creative == 1) + ",\"count\":" + count + ",\"used\":" + used + ",\"after\":" + s.b + ",\"spawned\":" + EyeOfEnderProbe.EW.spawned.size()
        + ",\"error\":" + (error == null ? "null" : Attributes2Probe.q(error)) + "}");
    }
  }
  static void interacts() throws Exception {
    HorseGearProbe.setup();
    Object[][] kinds = { { "saddle", 329 }, { "lead", 420 }, { "nameTag", 421 } };
    for (String subject : new String[] { "pig", "horse" }) for (Object[] k : kinds) for (int creative = 0; creative < 2; creative++) for (int count : new int[] { -2, -1, 0, 1, 2 }) {
      HorseProbe.clear();
      sv e;
      if (subject.equals("horse")) e = HorseGearProbe.gearHorse(0, false);
      else { e = new wo(HorseProbe.W); MobMoveProbe.set(e, "Z", new Random(3)); HorseGearProbe.at(e, 0, 0, 0); }
      yz p = HorseGearProbe.freshPlayer(creative == 1);
      add held = new add(adb.d((Integer) k[1]), count, 0);
      if (k[0].equals("nameTag")) held.c("Rex");
      HorseProbe.hold(p, held);
      boolean r; String error = null;
      try { r = p.q(e); } catch (Throwable x) { r = false; error = x.toString(); }
      add after = HorseProbe.held(p);
      out("{\"case\":\"interact\",\"subject\":\"" + subject + "\",\"item\":\"" + k[0] + "\",\"creative\":" + (creative == 1) + ",\"count\":" + count + ",\"result\":" + r + ",\"after\":" + stack(after)
        + ",\"sameStack\":" + (after == held) + ",\"heldCount\":" + held.b + ",\"error\":" + (error == null ? "null" : Attributes2Probe.q(error)) + "}");
    }
  }
  public static void main(String[] args) throws Exception {
    String mode = args.length > 0 ? args[0] : "x";
    if (mode.equals("interact")) { out("--items--"); interacts(); return; }
    EyeOfEnderProbe.main(new String[0]);
    out("--items--");
    WitchProbe.WW w = WitchProbe.w;
    MobMoveProbe.field(ahb.class, "L").set(w, new ArrayList());
    EyeOfEnderProbe.EW.log.clear();
    adds(); pickups(); decrs(); drops(); armours(); fireworks();
  }
}
