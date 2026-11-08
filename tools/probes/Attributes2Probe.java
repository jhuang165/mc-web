import java.lang.reflect.Field;
import java.util.*;

// Batch 25 attributes2 evidence on the unchanged 1.7.10 classes (no class is patched or shipped).
// Mode "mobs" (InterchangeSpawnProbe's EquipmentProbe world double):
//  maxHealth   a wolf (wild and with an OwnerUUID), slimes and magma cubes of several sizes and every horse type, written, the Attributes list
//              edited (maxHealth modifiers of operation 0/1/2, an edited base, a high or low HealF, no list at all), then read back with sa.f:
//              getMaxHealth (sv.aY), getHealth (sv.aS) and the list written again.
//  tame        a wild wolf with a maxHealth modifier through EntityWolf.setTamed(true) (wv.j) then setHealth(20) (sv.g), interact's taming order.
//  aiEnabled   every registered living class: isAIEnabled (sv.bk), getAIMoveSpeed (sv.bl) and the movementSpeed attribute after construction.
//  noAttributes a zombie or pigman read from a compound without an Attributes list, on several Entity.rand seeds: knockbackResistance.
// Mode "horse" (HorseProbe's world double):
//  horseRide   a saddled, ridden horse with a movementSpeed modifier: EntityHorse.moveEntityWithHeading (wi.e(FF)) ticks; bp after each tick.
// Mode "items" (EyeOfEnderProbe.EW block map world double):
//  itemRead    ItemStack.loadItemStackFromNBT (add.a(dh)) of Count -1/0/1; EntityItem.readEntityFromNBT (xk.a(dh)), onUpdate (xk.h) and
//              onCollideWithPlayer (xk.b_) with Count 0; TileEntityHopper.readFromNBT (api.a(dh)) of a Count 0 slot.
//  use         ItemStack.tryPlaceItemIntoWorld (add.a(yz, ahb, IIIIFFF)) with stackSize 0 and 1, in Survival and Creative.
//  rightClick  ItemStack.useItemRightClick (add.a(ahb, yz)) then, for food and milk, onFoodEaten (add.b(ahb, yz)), stackSize 0 and 1.
//  breakPitch  EntityLivingBase.renderBrokenItemStack (sv.a(add)) on a zombie: the random.break pitch against the world Random (ahb.s).
public class Attributes2Probe {
  static void out(String s) { System.out.println(s); }
  static String q(String s) { return HorseProbe.str(s == null ? null : s.replace("\\", "/").replace("\"", "'")); }
  static sun.misc.Unsafe u;
  static EquipmentProbe.World w;

  static double maxHp(sa e) { return ((sv) e).a(yj.a).e(); }
  static dh mh(dh t) { return InterchangeSpawnProbe.attr(t, "generic.maxHealth"); }

  static void maxHealthCase(String id, String label, dh t, String extra) throws Exception {
    String input = InterchangeLinkProbe.hex(t), inputAttrs = t.b("Attributes", 9) ? InterchangeLinkProbe.attrsTag(t) : "null";
    sa back = InterchangeSpawnProbe.read(id, t);
    dh t2 = InterchangeSpawnProbe.write(back);
    out("{\"case\":\"maxHealth\",\"id\":" + q(id) + ",\"variant\":" + q(label) + extra + ",\"input\":" + inputAttrs + ",\"healF\":" + (t.b("HealF", 99) ? Float.toString(t.h("HealF")) : "null")
      + ",\"maxHealth\":" + maxHp(back) + ",\"aY\":" + ((sv) back).aY() + InterchangeSpawnProbe.rec(back, t2) + ",\"nbt\":\"" + input + "\"}");
  }
  static void variants(String id, String extra, java.util.function.Consumer<dh> prep) throws Exception {
    String[] labels = { "plain", "add4", "mul0.5", "total0.5", "all", "base30add4", "lowHealF", "highHealF", "noList", "negative" };
    for (String label : labels) {
      sa e = InterchangeSpawnProbe.make(id, 9);
      dh t = InterchangeSpawnProbe.write(e);
      prep.accept(t);
      switch (label) {
        case "add4": InterchangeSpawnProbe.addModifier(mh(t), "Probe add", 4.0, 0, 21, 1); break;
        case "mul0.5": InterchangeSpawnProbe.addModifier(mh(t), "Probe mul", 0.5, 1, 21, 2); break;
        case "total0.5": InterchangeSpawnProbe.addModifier(mh(t), "Probe total", 0.5, 2, 21, 3); break;
        case "all":
          InterchangeSpawnProbe.addModifier(mh(t), "Probe total", 0.5, 2, 21, 3);
          InterchangeSpawnProbe.addModifier(mh(t), "Probe mul", 0.5, 1, 21, 2);
          InterchangeSpawnProbe.addModifier(mh(t), "Probe add", 4.0, 0, 21, 1);
          InterchangeSpawnProbe.addModifier(mh(t), "Probe mul2", 0.25, 1, 21, 4);
          t.a("HealF", 1000.0f);
          break;
        case "base30add4": mh(t).a("Base", 30.0); InterchangeSpawnProbe.addModifier(mh(t), "Probe add", 4.0, 0, 21, 1); t.a("HealF", 1000.0f); break;
        case "lowHealF": InterchangeSpawnProbe.addModifier(mh(t), "Probe add", 4.0, 0, 21, 1); t.a("HealF", 3.0f); break;
        case "highHealF": InterchangeSpawnProbe.addModifier(mh(t), "Probe add", 4.0, 0, 21, 1); t.a("HealF", 1000.0f); break;
        case "noList": t.o("Attributes"); t.a("HealF", 1000.0f); break;
        case "negative": InterchangeSpawnProbe.addModifier(mh(t), "Probe neg", -2.0, 2, 21, 5); t.a("HealF", 5.0f); break;
        default: break;
      }
      maxHealthCase(id, label, t, extra);
    }
  }

  static void mobs() throws Exception {
    aji.p(); adb.l();
    u = MobMoveProbe.unsafe();
    EquipmentProbe.u = u;
    w = (EquipmentProbe.World) u.allocateInstance(EquipmentProbe.World.class);
    EquipmentProbe.w = w;
    DifficultyProbe.w = w;
    InterchangeSpawnProbe.u = u;
    InterchangeSpawnProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(w, info);
    MobMoveProbe.field(ahb.class, "A").set(w, new wc(w));
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    DifficultyProbe.setDifficulty(2);
    EquipmentProbe.environment(1, 0, 6, 1, false);

    // ---- maxHealth ----
    variants("Wolf", ",\"tamed\":false", (t) -> {});
    variants("Wolf", ",\"tamed\":true", (t) -> t.a("OwnerUUID", new UUID(1L, 2L).toString()));
    // A wild wolf's base edited to 20 then tamed on load, and a tamed wolf whose saved base is 8 (setTamed resets it to 20 after HealF).
    for (int tamed = 0; tamed < 2; tamed++) {
      sa e = InterchangeSpawnProbe.make("Wolf", 9);
      dh t = InterchangeSpawnProbe.write(e);
      if (tamed == 1) t.a("OwnerUUID", new UUID(1L, 2L).toString());
      mh(t).a("Base", 8.0);
      InterchangeSpawnProbe.addModifier(mh(t), "Probe add", 4.0, 0, 21, 1);
      t.a("HealF", 1000.0f);
      maxHealthCase("Wolf", "base8add4", t, ",\"tamed\":" + (tamed == 1));
    }
    for (String id : new String[] { "Slime", "LavaSlime" })
      for (int size : new int[] { 0, 1, 3 }) { final int s = size; variants(id, ",\"size\":" + (size + 1), (t) -> t.a("Size", s)); }
    for (int type = 0; type < 5; type++) { final int ty = type; variants("EntityHorse", ",\"type\":" + type, (t) -> t.a("Type", ty)); }
    for (String id : new String[] { "Zombie", "Pig" }) variants(id, "", (t) -> {});

    // ---- tame ----
    for (int mod = 0; mod < 3; mod++) {
      wv e = (wv) InterchangeSpawnProbe.make("Wolf", 9);
      ti hp = (ti) e.a(yj.a);
      if (mod == 1) hp.a(new tj(new UUID(21, 1), "Probe add", 4.0, 0));
      if (mod == 2) hp.a(new tj(new UUID(21, 2), "Probe total", -0.5, 2));
      double before = hp.e();
      float healthBefore = e.aS();
      e.j(true);
      double afterTame = hp.e();
      e.g(20.0f);
      out("{\"case\":\"tame\",\"modifier\":" + mod + ",\"before\":" + before + ",\"healthBefore\":" + healthBefore + ",\"afterTame\":" + afterTame + ",\"health\":" + e.aS() + ",\"base\":" + hp.b() + "}");
    }

    // ---- aiEnabled ----
    List<String> names = new ArrayList<>();
    Field cf = sg.class.getDeclaredField("c");
    cf.setAccessible(true);
    for (Object k : ((Map) cf.get(null)).keySet()) names.add((String) k);
    Collections.sort(names);
    java.lang.reflect.Method bk = MobMoveProbe.method(sv.class, "bk");
    for (String n : names) {
      sa e;
      try { e = InterchangeSpawnProbe.make(n, 1); } catch (Throwable x) { continue; }
      if (!(e instanceof sv)) continue;
      ti speed = (ti) ((sv) e).a(yj.d);
      out("{\"case\":\"aiEnabled\",\"id\":" + q(n) + ",\"class\":" + q(e.getClass().getName()) + ",\"ai\":" + bk.invoke(e) + ",\"aiMoveSpeed\":" + ((sv) e).bl()
        + ",\"movementSpeed\":" + (speed == null ? "null" : Double.toString(speed.e())) + "}");
    }

    // ---- noAttributes ----
    for (String n : new String[] { "Zombie", "PigZombie" })
      for (long seed = 1; seed <= 4; seed++) {
        sa e = InterchangeSpawnProbe.make(n, seed);
        dh t = InterchangeSpawnProbe.write(e);
        double savedKnock = ((sv) e).a(yj.c).e();
        t.o("Attributes");
        sa back = sg.a(n, w);
        MobMoveProbe.set(back, "Z", new Random(seed + 40));
        double fresh = ((sv) back).a(yj.c).e();
        back.f(t);
        dh t2 = InterchangeSpawnProbe.write(back);
        out("{\"case\":\"noAttributes\",\"id\":" + q(n) + ",\"seed\":" + seed + ",\"savedKnockback\":" + savedKnock + ",\"freshKnockback\":" + fresh + ",\"knockback\":" + ((sv) back).a(yj.c).e()
          + InterchangeSpawnProbe.rec(back, t2) + "}");
      }
  }

  static void horse() throws Exception {
    aji.p(); adb.l();
    HorseProbe.World world = (HorseProbe.World) HorseProbe.u.allocateInstance(HorseProbe.World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", HorseProbe.u.allocateInstance(aqq.class));
    HorseProbe.W = world;
    HorseProbe.player = HorseProbe.makePlayer(false);
    HorseProbe.creative = HorseProbe.makePlayer(true);
    // name, modifier amount, operation, prior bp (the AI's last setAIMoveSpeed; -1 = the attribute value), ticks
    Object[][] sc = { { "plain", 0.0, -1, -1f, 20 }, { "mul0.5", 0.5, 1, -1f, 20 }, { "add0.1", 0.1, 0, -1f, 20 }, { "slow", -0.75, 2, -1f, 20 }, { "priorFast", 0.5, 1, 0.9f, 3 } };
    for (Object[] s : sc) {
      wi e = HorseProbe.mountedHorse(1, true, 0f, 0f, 0.98f, 0f);
      ti speedAttr = (ti) e.a(yj.d);
      double base = speedAttr.b();
      if ((Integer) s[2] >= 0) speedAttr.a(new tj(new UUID(31, 1), "Probe speed", (Double) s[1], (Integer) s[2]));
      float value = (float) speedAttr.e(), prior = (Float) s[3] < 0 ? value : (Float) s[3];
      e.i(prior);
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < (Integer) s[4]; i++) {
        MobMoveProbe.set(e, "p", MobMoveProbe.d(e, "s"));
        MobMoveProbe.set(e, "q", MobMoveProbe.d(e, "t"));
        MobMoveProbe.set(e, "r", MobMoveProbe.d(e, "u"));
        e.e(0f, 0.98f);
        e.ac();
        rows.append(i > 0 ? "," : "").append("{\"horse\":" + MobMoveProbe.state(e) + ",\"aiSpeed\":" + MobMoveProbe.field(sv.class, "bp").getFloat(e) + ",\"jumpFactor\":" + MobMoveProbe.field(sv.class, "aQ").getFloat(e) + "}");
      }
      HorseProbe.player.a((sa) null);
      out("{\"case\":\"horseRide\",\"name\":" + q((String) s[0]) + ",\"base\":" + base + ",\"value\":" + value + ",\"prior\":" + prior + ",\"ticks\":[" + rows + "]}");
    }
  }

  // ---- items ----
  static String stack(add s) { return s == null ? "null" : "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "]"; }
  static dh itemTag(int id, int count, int damage) { dh t = new dh(); t.a("id", (short) id); t.a("Count", (byte) count); t.a("Damage", (short) damage); return t; }

  static EyeOfEnderProbe.Gamer gamer(boolean creative) throws Exception {
    EyeOfEnderProbe.Gamer p = EyeOfEnderProbe.player(creative, false);
    MobMoveProbe.set(p, "bm", new yx(p));
    MobMoveProbe.set(p, "bp", new zr());
    return p;
  }
  static void items() throws Exception {
    EyeOfEnderProbe.main(new String[0]); // sets up the EW world; its own records are printed with other case names and ignored by the verifier
    out("--items--");
    WitchProbe.WW w = WitchProbe.w;
    MobMoveProbe.field(ahb.class, "L").set(w, new ArrayList());
    EyeOfEnderProbe.EW.log.clear();

    // ---- itemRead ----
    for (int count : new int[] { -1, 0, 1, 64, 65, 127 }) {
      add s = add.a(itemTag(1, count, 0));
      out("{\"case\":\"itemRead\",\"what\":\"loadItemStackFromNBT\",\"count\":" + count + ",\"stack\":" + stack(s) + "}");
    }
    for (int count : new int[] { -1, 0, 1 }) {
      dh t = new dh();
      t.a("Health", (short) 5); t.a("Age", (short) 0);
      t.a("Item", itemTag(264, count, 0));
      xk e = new xk(w);
      MobMoveProbe.set(e, "Z", new Random(3));
      e.a(t);
      boolean deadAfterRead = MobMoveProbe.field(sa.class, "K").getBoolean(e);
      String error = null;
      try { e.h(); } catch (Throwable x) { error = x.toString(); }
      boolean deadAfterTick = MobMoveProbe.field(sa.class, "K").getBoolean(e);
      String beforePickup = stack(e.f());
      EyeOfEnderProbe.Gamer p = gamer(false);
      yx inv = (yx) MobMoveProbe.field(yz.class, "bm").get(p);
      MobMoveProbe.set(e, "b", 0); // delayBeforeCanPickup
      String pickError = null;
      try { e.b_(p); } catch (Throwable x) { pickError = x.toString(); }
      int held = 0;
      for (add s : inv.a) if (s != null) held += s.b;
      dh t2 = new dh();
      e.e(t2);
      out("{\"case\":\"itemRead\",\"what\":\"EntityItem\",\"count\":" + count + ",\"stack\":" + beforePickup + ",\"afterPickup\":" + stack(e.f()) + ",\"deadAfterRead\":" + deadAfterRead + ",\"tickError\":" + (error == null ? "null" : q(error))
        + ",\"deadAfterTick\":" + deadAfterTick + ",\"pickError\":" + (pickError == null ? "null" : q(pickError)) + ",\"inventoryCount\":" + held + ",\"deadAfterPickup\":" + MobMoveProbe.field(sa.class, "K").getBoolean(e)
        + ",\"written\":" + (t2.b("Item", 10) ? stack(add.a(t2.m("Item"))) : "null") + "}");
    }
    for (int count : new int[] { -1, 0, 1 }) {
      dh t = new dh();
      t.a("id", "Hopper"); t.a("x", 0); t.a("y", 64); t.a("z", 0);
      dq items = new dq();
      dh slot = itemTag(264, count, 0);
      slot.a("Slot", (byte) 2);
      items.a(slot);
      t.a("Items", items);
      api h = new api();
      h.a(t);
      dh t2 = new dh();
      h.b(t2);
      out("{\"case\":\"itemRead\",\"what\":\"hopper\",\"count\":" + count + ",\"stack\":" + stack(h.a(2)) + ",\"writtenItems\":" + t2.c("Items", 10).c() + "}");
    }

    // ---- use (tryPlaceItemIntoWorld) on the top of a stone block at (0, 63, 0) ----
    // name, item id, damage, block under (id) at y 63, and a block placed at y 64 first (0 none)
    Object[][] uses = {
      { "stone", 1, 0, 1, 0 }, { "torch", 50, 0, 1, 0 }, { "slab", 44, 0, 1, 0 }, { "cake", 354, 0, 1, 0 }, { "redstone", 331, 0, 1, 0 },
      { "sign", 323, 0, 1, 0 }, { "door", 324, 0, 1, 0 }, { "bed", 355, 0, 1, 0 }, { "seeds", 295, 0, 60, 0 }, { "spawnEgg", 383, 90, 1, 0 },
      { "hoe", 290, 0, 2, 0 }, { "flintAndSteel", 259, 0, 1, 0 }, { "boneMealSapling", 351, 15, 2, 6 }, { "reed", 338, 0, 2, 0 }, { "skull", 397, 0, 1, 0 },
      { "netherWart", 372, 0, 88, 0 }, { "string", 287, 0, 1, 0 }, { "repeater", 356, 0, 1, 0 }, { "flowerPotItem", 390, 0, 1, 0 }, { "minecartOnRail", 328, 0, 66, 0 },
    };
    for (Object[] c : uses) for (int creative = 0; creative < 2; creative++) for (int count : new int[] { 1, 0 }) {
      WitchProbe.WW.cells.clear();
      EyeOfEnderProbe.EW.log.clear();
      EyeOfEnderProbe.EW.spawned.clear();
      int under = (Integer) c[3], above = (Integer) c[4];
      int targetY = above != 0 ? 64 : 63;
      WitchProbe.WW.cells.put("0,63,0", new int[] { under, 0 });
      if (above != 0) WitchProbe.WW.cells.put("0,64,0", new int[] { above, 0 });
      if ((Integer) c[1] == 338) WitchProbe.WW.cells.put("1,63,0", new int[] { 9, 0 });
      EyeOfEnderProbe.Gamer p = gamer(creative == 1);
      EyeOfEnderProbe.itemRandom(4);
      MobMoveProbe.set(w, "s", new Random(2));
      add s = new add(adb.d((Integer) c[1]), count, (Integer) c[2]);
      boolean used;
      String error = null;
      try { used = s.a(p, w, 0, targetY, 0, 1, 0.5f, 1f, 0.5f); } catch (Throwable x) { used = false; error = x.toString(); }
      out("{\"case\":\"use\",\"name\":" + q((String) c[0]) + ",\"item\":" + c[1] + ",\"creative\":" + (creative == 1) + ",\"count\":" + count + ",\"used\":" + used + ",\"after\":" + s.b + ",\"damage\":" + s.k()
        + ",\"error\":" + (error == null ? "null" : q(error)) + ",\"spawned\":" + EyeOfEnderProbe.EW.spawned.size() + ",\"events\":" + EyeOfEnderProbe.strings(EyeOfEnderProbe.EW.log) + "}");
    }

    // ---- rightClick (useItemRightClick, then onFoodEaten for the eaten items) ----
    // name, item id, damage, ray hit kind (0 none, 1 stone top at (0,63,0), 2 water source at (0,63,0)), eat
    Object[][] clicks = {
      { "snowball", 332, 0, 0, false }, { "egg", 344, 0, 0, false }, { "enderPearl", 368, 0, 0, false }, { "expBottle", 384, 0, 0, false }, { "splashPotion", 373, 16385, 0, false },
      { "apple", 260, 0, 0, true }, { "bread", 297, 0, 0, true }, { "goldenApple", 322, 0, 0, true }, { "stew", 282, 0, 0, true }, { "milk", 335, 0, 0, true }, { "potion", 373, 8193, 0, true },
      { "emptyBucketWater", 325, 0, 2, false }, { "waterBucket", 326, 0, 1, false }, { "lavaBucket", 327, 0, 1, false }, { "glassBottleWater", 374, 0, 2, false }, { "fireworkAir", 401, 0, 0, false },
      { "bow", 261, 0, 0, false }, { "sword", 267, 0, 0, false }, { "book", 386, 0, 0, false },
    };
    for (Object[] c : clicks) for (int creative = 0; creative < 2; creative++) for (int count : new int[] { 1, 0 }) {
      WitchProbe.WW.cells.clear();
      EyeOfEnderProbe.EW.log.clear();
      EyeOfEnderProbe.EW.spawned.clear();
      int ray = (Integer) c[3];
      if (ray == 1) { WitchProbe.WW.cells.put("0,63,0", new int[] { 1, 0 }); EyeOfEnderProbe.EW.rayHit = new int[] { 0, 63, 0, 1 }; }
      if (ray == 2) { WitchProbe.WW.cells.put("0,63,0", new int[] { 9, 0 }); EyeOfEnderProbe.EW.rayHit = new int[] { 0, 63, 0, 1 }; }
      EyeOfEnderProbe.Gamer p = gamer(creative == 1);
      ((yx) MobMoveProbe.field(yz.class, "bm").get(p)).a[0] = null;
      zr food = p.bQ();
      MobMoveProbe.field(zr.class, "a").setInt(food, 10);
      EyeOfEnderProbe.itemRandom(4);
      MobMoveProbe.set(w, "s", new Random(2));
      add s = new add(adb.d((Integer) c[1]), count, (Integer) c[2]);
      ((yx) MobMoveProbe.field(yz.class, "bm").get(p)).a[((yx) MobMoveProbe.field(yz.class, "bm").get(p)).c] = s;
      add result = null, eaten = null;
      String error = null;
      boolean inUse = false;
      try {
        result = s.a(w, p);
        inUse = p.by();
        if ((Boolean) c[4] && result != null) eaten = result.b(w, p);
      } catch (Throwable x) { error = x.toString(); }
      out("{\"case\":\"rightClick\",\"name\":" + q((String) c[0]) + ",\"item\":" + c[1] + ",\"creative\":" + (creative == 1) + ",\"count\":" + count + ",\"result\":" + stack(result) + ",\"same\":" + (result == s)
        + ",\"inUse\":" + inUse + ",\"eaten\":" + stack(eaten) + ",\"after\":" + s.b + ",\"food\":" + food.a() + ",\"error\":" + (error == null ? "null" : q(error))
        + ",\"spawned\":" + EyeOfEnderProbe.EW.spawned.size() + ",\"events\":" + EyeOfEnderProbe.strings(EyeOfEnderProbe.EW.log) + "}");
    }

    // ---- breakPitch ----
    for (long seed = 1; seed <= 4; seed++) {
      EyeOfEnderProbe.EW.log.clear();
      yq z = new yq(w);
      MobMoveProbe.set(z, "Z", new Random(seed + 50));
      MobMoveProbe.set(w, "s", new Random(seed));
      z.a(new add(adb.d(307), 1, 0));
      Random wr = (Random) MobMoveProbe.field(ahb.class, "s").get(w), er = (Random) MobMoveProbe.field(sa.class, "Z").get(z);
      List<String> sounds = new ArrayList<>();
      int particles = 0;
      for (String l : EyeOfEnderProbe.EW.log) if (l.startsWith("sound|")) sounds.add(l); else if (l.startsWith("particle|")) particles++;
      Random check = new Random(seed);
      out("{\"case\":\"breakPitch\",\"seed\":" + seed + ",\"sounds\":" + EyeOfEnderProbe.strings(sounds) + ",\"particles\":" + particles + ",\"expected\":" + (0.8f + check.nextFloat() * 0.4f)
        + ",\"worldNext\":" + wr.nextInt(1000000) + ",\"entityNext\":" + er.nextInt(1000000) + "}");
    }
  }

  public static void main(String[] args) throws Exception {
    String mode = args.length > 0 ? args[0] : "mobs";
    if (mode.equals("mobs")) mobs();
    else if (mode.equals("horse")) horse();
    else items();
  }
}
