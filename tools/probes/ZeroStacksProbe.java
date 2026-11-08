import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Method;
import java.util.*;

// Batch 24 zerostacks. What a zero-size stack (ItemStack.damageItem leaves a Thorns- or anvil-broken piece at stackSize 0, see ThornsWearProbe
// ghost rows and ZeroArmourStackProbe) does in the unchanged 1.7.10 classes, on the PlayerDamageProbe world double (Normal difficulty):
//   inventory  tools/probes/zero-stack-scenarios.txt (the InventoryProbe script format) run through InventoryPlayer (yx), Container.slotClick (zs.a),
//              ContainerPlayer (aap) and its transferStackInSlot. Unlike InventoryProbe's double, the player here keeps the native
//              EntityPlayer.dropPlayerItemWithRandomChoice / func_146097_a (yz.a(add,Z) / yz.a(add,ZZ)), so a stackSize 0 drop is refused natively;
//              only joinEntityItemWithWorld (yz.a(xk)) is replaced to record the EntityItem's stack. renderBrokenItemStack (sv.a(add)) is recorded.
//   mobThorns  EnchantmentHelper.func_151384_a (afv.a) on a REAL EntityZombie (yq) wearing an iron chestplate with Thorns at its last durability:
//              the slot after the break and after a second reaction, getTotalArmorValue (sv.aV), the events of renderBrokenItemStack (the
//              random.break sound on the world Random, five item-crack particles drawing three Entity.rand floats each) and the next zombie Random int.
//   mobNbt     the zombie with a zero-size chestplate (and a zero-size held sword) written by Entity.writeToNBTOptional (sa.c) and loaded by
//              EntityList.createEntityFromNBT (sg.a): the Equipment list's string form and the loaded equipment.
//   mobDrop    EntityLiving.dropEquipment (sw.a(ZI)) of a zombie wearing a zero-size or a whole chestplate, for drop chances 0.085 / 1 / 2,
//              recentlyHit, looting and seeds: the spawned EntityItems (Entity.entityDropItem refuses stackSize 0) and the next Random int.
//   mobXp      EntityZombie.getExperiencePoints (yq.e(yz)) with a zero-size or whole chestplate: the points and the next Random int.
//   anvil      EntityLivingBase.attackEntityFrom (sv.a(ro,F)) with DamageSource.anvil on the real EntityPlayerMP double and on a zombie, wearing a
//              leather helmet at a given damage (and an iron chestplate): accepted, health after, the helmet slot, getTotalArmorValue after, events.
// One JSON object per line.
public class ZeroStacksProbe {
  static final List<String> drops = new ArrayList<>(), broken = new ArrayList<>();

  public static class P extends yz {
    P() { super(null, null); }
    public r f_() { return null; }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public void a(ph stat, int amount) {}
    public void a(add stack) { broken.add(json(stack)); }
    public void a(xk item) { drops.add(json(item.f())); }
    public float g() { return 1.62f; }
  }

  static String json(add s) { return s == null ? "null" : "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "]"; }
  static add stack(String[] p, int at) { return new add(adb.d(Integer.parseInt(p[at])), Integer.parseInt(p[at + 1]), Integer.parseInt(p[at + 2])); }
  static String list(List<String> v) { return "[" + String.join(",", v) + "]"; }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static String strings(List<String> l) { List<String> o = new ArrayList<>(); for (String s : l) o.add(q(s)); return list(o); }
  static String slots(add[] a) { List<String> o = new ArrayList<>(); for (add s : a) o.add(json(s)); return list(o); }
  static Random rand(sa e) throws Exception { return (Random) MobMoveProbe.field(sa.class, "Z").get(e); }
  static void rand(sa e, long seed) throws Exception { MobMoveProbe.field(sa.class, "Z").set(e, new Random(seed)); }
  static add[] equipment(sw e) { add[] a = new add[5]; for (int i = 0; i < 5; i++) a[i] = e.q(i); return a; }
  static yq zombie() throws Exception { yq z = new yq(PlayerDamageProbe.w); PlayerDamageProbe.pos(z, 64.5, 5.0, 64.5); return z; }
  static void clearEvents() { PlayerDamageProbe.World.events.clear(); ChickenProbe.World.sounds.clear(); ChickenProbe.World.spawned.clear(); DifficultyProbe.World.swirlNames.clear(); DifficultyProbe.World.swirls.clear(); }
  static String spawnedItems() { List<String> o = new ArrayList<>(); for (Object e : ChickenProbe.World.spawned) if (e instanceof xk) o.add(json(((xk) e).f())); return list(o); }

  public static void main(String[] args) throws Exception {
    PlayerDamageProbe.init();
    sun.misc.Unsafe u = PlayerDamageProbe.u;
    ArmorEnchantmentProbe.U = u;
    String mode = args.length > 0 ? args[0] : "all";
    if (mode.equals("inventory")) { inventory(u); return; }
    mobThorns();
    mobNbt();
    mobDrop();
    mobXp();
    anvil();
  }

  // ---- inventory scripts ------------------------------------------------------------------------------------------------------------
  static void inventory(sun.misc.Unsafe u) throws Exception {
    BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
    String name = null, line;
    P player = null; yx inv = null; zs container = null;
    List<String> results = new ArrayList<>();
    while ((line = in.readLine()) != null) {
      line = line.trim();
      if (line.isEmpty() || line.startsWith("#")) continue;
      String[] p = line.split("\\s+");
      switch (p[0]) {
        case "case" -> {
          name = p[1];
          player = (P) u.allocateInstance(P.class);
          MobMoveProbe.field(sa.class, "o").set(player, PlayerDamageProbe.w);
          MobMoveProbe.field(sa.class, "Z").set(player, new Random(0));
          player.bE = new yw();
          inv = new yx(player);
          player.bm = inv;
          container = new aap(inv, true, player);
          player.bn = container; player.bo = container;
          results.clear(); drops.clear(); broken.clear();
        }
        case "creative" -> player.bE.d = true;
        case "inv" -> inv.a[Integer.parseInt(p[1])] = stack(p, 2);
        case "wear" -> inv.b[Integer.parseInt(p[1])] = stack(p, 2);
        case "put" -> container.a(Integer.parseInt(p[1])).c(stack(p, 2));
        case "cursor" -> inv.b(stack(p, 1));
        case "select" -> inv.c = Integer.parseInt(p[1]);
        case "click" -> results.add(json(container.a(Integer.parseInt(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3]), player)));
        case "add" -> { add s = stack(p, 1); boolean ok = inv.a(s); results.add("[" + ok + "," + s.b + "]"); }
        case "consume" -> results.add(String.valueOf(inv.a(adb.d(Integer.parseInt(p[1])))));
        // ItemStack.damageItem on a main slot, then the stackSize <= 0 clear every held-item caller makes (InventoryProbe's convention;
        // attackTargetEntityWithCurrentItem, ItemInWorldManager.tryHarvestBlock, tryUseItem, interactWith call destroyCurrentEquippedItem).
        case "damage" -> {
          int slot = Integer.parseInt(p[1]);
          inv.a[slot].a(Integer.parseInt(p[2]), player);
          if (inv.a[slot].b <= 0) inv.a[slot] = null;
        }
        case "close" -> container.b(player);
        case "end" -> {
          List<String> main = new ArrayList<>(), armor = new ArrayList<>(), sl = new ArrayList<>();
          for (add s : inv.a) main.add(json(s));
          for (add s : inv.b) armor.add(json(s));
          for (Object slot : container.c) sl.add(json(((aay) slot).d()));
          System.out.println("{\"case\":\"" + name + "\",\"inventory\":" + list(main) + ",\"cursor\":" + json(inv.o()) + ",\"armor\":" + list(armor)
            + ",\"current\":" + inv.c + ",\"slots\":" + list(sl) + ",\"results\":" + list(results) + ",\"drops\":" + list(drops) + ",\"broken\":" + list(broken) + "}");
        }
        default -> throw new IllegalArgumentException(line);
      }
    }
  }

  // ---- mobs ----------------------------------------------------------------------------------------------------------------------------
  static add chest(int count, int damage, int[][] ench) { add s = ArmorEnchantmentProbe.make(307, damage, ench); s.b = count; return s; }

  static void mobThorns() throws Exception {
    Random picks = new Random(1710_24_01L);
    for (int t = 1; t <= 3; t++) for (int unb = 0; unb <= 2; unb += 2) for (int k = 0; k < 6; k++) {
      long seed = picks.nextLong(), seed2 = picks.nextLong();
      yq z = zombie();
      int[][] e = unb > 0 ? ArmorEnchantmentProbe.ench(7, t, 34, unb) : ArmorEnchantmentProbe.ench(7, t);
      z.c(3, chest(1, 240, e)); // iron chestplate, max damage 240: one more point breaks it
      String before = slots(equipment(z));
      ArmorEnchantmentProbe.Living attacker = ArmorEnchantmentProbe.living(), attacker2 = ArmorEnchantmentProbe.living();
      clearEvents();
      rand(z, seed);
      afv.a(z, (sa) attacker);
      String after = slots(equipment(z)), events = strings(PlayerDamageProbe.World.events);
      int particles = DifficultyProbe.World.swirlNames.size(), next = rand(z).nextInt();
      int armour = z.aV();
      clearEvents();
      rand(z, seed2);
      afv.a(z, (sa) attacker2);
      String second = slots(equipment(z));
      int next2 = rand(z).nextInt();
      System.out.println("{\"case\":\"mobThorns\",\"row\":[" + t + "," + unb + "," + q(String.valueOf(seed)) + "," + before + "," + attacker.log + "," + after + "," + events + "," + particles + "," + next + "," + armour
        + "," + q(String.valueOf(seed2)) + "," + attacker2.log + "," + second + "," + strings(PlayerDamageProbe.World.events) + "," + next2 + "]}");
    }
  }

  static void mobNbt() throws Exception {
    int[][] thorns = ArmorEnchantmentProbe.ench(7, 3);
    for (int variant = 0; variant < 3; variant++) {
      yq z = zombie();
      z.c(3, chest(0, 0, thorns));
      if (variant >= 1) { add sword = ArmorEnchantmentProbe.make(267, 0, null); sword.b = 0; z.c(0, sword); }
      if (variant == 2) z.c(4, new add(adb.d(298), 1, 7));
      dh t = new dh();
      if (!z.c(t)) throw new IllegalStateException("zombie not saved");
      dq eq = t.c("Equipment", 10);
      sa loaded = sg.a(t, PlayerDamageProbe.w);
      sw m = (sw) loaded;
      dh again = new dh();
      m.c(again);
      System.out.println("{\"case\":\"mobNbt\",\"row\":[" + variant + "," + q(eq.toString()) + "," + slots(equipment(m)) + "," + m.aV() + "," + q(again.c("Equipment", 10).toString()) + "]}");
    }
  }

  static void mobDrop() throws Exception {
    Method drop = MobMoveProbe.method(sw.class, "a", boolean.class, int.class);
    Random picks = new Random(1710_24_02L);
    float[] chances = { 0.085f, 1.0f, 2.0f };
    for (int size = 0; size <= 1; size++) for (float chance : chances) for (boolean hit : new boolean[] { true, false }) for (int looting : new int[] { 0, 3 }) for (int k = 0; k < 3; k++) {
      long seed = picks.nextLong();
      yq z = zombie();
      z.c(3, chest(size, 0, null));
      ((float[]) MobMoveProbe.field(sw.class, "e").get(z))[3] = chance;
      clearEvents();
      rand(z, seed);
      drop.invoke(z, hit, looting);
      System.out.println("{\"case\":\"mobDrop\",\"row\":[" + size + "," + chance + "," + hit + "," + looting + "," + q(String.valueOf(seed)) + "," + spawnedItems() + "," + rand(z).nextInt() + "]}");
    }
  }

  static void mobXp() throws Exception {
    Method xp = MobMoveProbe.method(yq.class, "e", yz.class);
    for (int size = -1; size <= 1; size++) for (long seed = 0; seed < 4; seed++) {
      yq z = zombie();
      if (size >= 0) z.c(3, chest(size, 0, null));
      // EntityLiving.experienceValue (sw.b) is 5 for a zombie (EntityMob's constructor).
      rand(z, seed);
      int points = (Integer) xp.invoke(z, (yz) null);
      System.out.println("{\"case\":\"mobXp\",\"row\":[" + size + "," + seed + "," + points + "," + rand(z).nextInt() + "]}");
    }
  }

  static void anvil() throws Exception {
    for (String type : new String[] { "player", "zombie" }) for (int damage : new int[] { 0, 40, 50, 54, 55 }) for (float amount : new float[] { 2f, 6f, 12f }) for (boolean chestplate : new boolean[] { false, true }) {
      sv e = PlayerDamageProbe.prepare(type, 64.5, 5.0, 64.5, PlayerDamageProbe.setup());
      add helmet = new add(adb.d(298), 1, damage); // leather helmet, max damage 55
      add chestStack = chestplate ? new add(adb.d(307), 1, 0) : null;
      if (e instanceof yz) { yx inv = ((yz) e).bm; inv.b[3] = helmet; inv.b[2] = chestStack; }
      else { ((sw) e).c(4, helmet); ((sw) e).c(3, chestStack); }
      clearEvents();
      float health = e.aS();
      boolean ok = e.a(ro.m, amount);
      add now = e instanceof yz ? ((yz) e).bm.b[3] : ((sw) e).q(4);
      System.out.println("{\"case\":\"anvil\",\"row\":[" + q(type) + "," + damage + "," + amount + "," + chestplate + "," + ok + "," + health + "," + e.aS() + "," + json(now) + "," + (now == helmet) + "," + e.aV()
        + "," + strings(PlayerDamageProbe.World.events) + "," + DifficultyProbe.World.swirlNames.size() + "]}");
    }
  }
}
