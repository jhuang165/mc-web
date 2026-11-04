import java.lang.reflect.*;
import java.util.*;

// Drives the unchanged EntityVillager (yv), ContainerMerchant (aat), InventoryMerchant (aas),
// SlotMerchantResult (aau), MerchantRecipe (agn) and MerchantRecipeList (ago) through scripted
// villager trading sessions: interact, recipe selection, payment placement, clicks and shift-clicks
// on the result, closing, and the restock ticks of updateAITick (bp). Each case prints its steps and
// the state after every step as one JSON line. The step choices come from a seeded java.util.Random
// inside this probe, but they are written out, so the JavaScript replay needs no Java Random.
// Doubles: the world is VillagerOffersProbe's, the player is InventoryProbe's ProbePlayer plus a
// getName and displayGUIMerchant that open the real container.
public class VillagerTradeLiveProbe {
  public static class Player extends InventoryProbe.ProbePlayer {
    static aat container;
    public String b_() { return "Player"; }
    public void a(agm merchant, String name) { container = new aat(bm, merchant, o); bo = container; merchant.b(this); } // EntityPlayerMP.displayGUIMerchant sends getRecipes(player) after opening
  }

  static sun.misc.Unsafe unsafe;
  static VillagerProbe.World world;
  static Player player;
  static yv villager;
  static Random shuffleRandom;
  static Field shuffleField;
  static List<String> steps;
  static final Set<Integer> ids = new TreeSet<>();

  static String stack(add s) {
    if (s == null) return "null";
    ids.add(adb.b(s.b()));
    return "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "]";
  }
  static add make(int id, int count, int damage) { return new add(adb.d(id), count, damage); }
  static Object get(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static int geti(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).getInt(o); }

  static String offers() throws Exception {
    ago list = (ago) get(villager, "bu");
    if (list == null) return "null";
    StringBuilder b = new StringBuilder("[");
    for (int i = 0; i < list.size(); i++) {
      agn r = (agn) list.get(i);
      b.append(i > 0 ? "," : "").append(VillagerOffersProbe.offer(r));
      for (add s : new add[] {r.a(), r.b(), r.d()}) if (s != null) ids.add(adb.b(s.b()));
    }
    return b.append(']').toString();
  }

  static String state() throws Exception {
    StringBuilder b = new StringBuilder("{\"slots\":[");
    for (int i = 0; i < 39; i++) b.append(i > 0 ? "," : "").append(stack(Player.container == null ? null : Player.container.a(i).d()));
    b.append("],\"cursor\":").append(stack(player.bm.o()));
    b.append(",\"drops\":[");
    for (int i = 0; i < InventoryProbe.drops.size(); i++) b.append(i > 0 ? "," : "").append(InventoryProbe.drops.get(i));
    b.append("],\"sounds\":[");
    for (int i = 0; i < VillagerProbe.World.sounds.size(); i++) b.append(i > 0 ? "," : "").append('"').append(VillagerProbe.World.sounds.get(i)).append('"');
    b.append("],\"offers\":").append(offers());
    rw regen = villager.b(rv.l);
    b.append(",\"timeUntilReset\":").append(geti(villager, "bv")).append(",\"needsInit\":").append(MobMoveProbe.b(villager, "bw"))
      .append(",\"riches\":").append(geti(villager, "bx")).append(",\"livingSoundTime\":").append(villager.a_)
      .append(",\"customer\":").append(get(villager, "bt") != null)
      .append(",\"regen\":").append(regen == null ? "null" : String.valueOf(regen.b()))
      .append(",\"health\":").append(villager.aS());
    InventoryProbe.drops.clear();
    VillagerProbe.World.sounds.clear();
    return b.append('}').toString();
  }

  static void step(String json) throws Exception { steps.add("{\"step\":" + json + ",\"state\":" + state() + "}"); }

  static void tickAI(int n) throws Exception {
    Method bp = yv.class.getDeclaredMethod("bp");
    bp.setAccessible(true);
    // Village timer (field bq): every 70-120 ticks bp() asks the VillageCollection for the nearest village and draws
    // nextInt(50) from the entity Random. The browser has no villages, so the timer is pinned out of the way to
    // measure the restock rules alone (documented as an open item in villager-trading-live.md).
    for (int i = 0; i < n; i++) { MobMoveProbe.field(yv.class, "bq").setInt(villager, 1 << 30); bp.invoke(villager); }
  }

  static void newCase(int profession, long seed, long shuffleSeed, int age, boolean egg) throws Exception {
    VillagerProbe.reset();
    InventoryProbe.drops.clear();
    world = (VillagerProbe.World) VillagerOffersProbe.world();
    villager = new yv(world, profession);
    MobMoveProbe.set(villager, "Z", new Random(seed));
    if (age != 0) villager.c(age);
    shuffleRandom = (Random) shuffleField.get(null);
    if (shuffleRandom == null) { shuffleRandom = new Random(shuffleSeed); shuffleField.set(null, shuffleRandom); } else shuffleRandom.setSeed(shuffleSeed);
    player = (Player) unsafe.allocateInstance(Player.class);
    player.o = world;
    player.bE = new yw();
    player.bm = new yx(player);
    Player.container = null;
    if (egg) player.bm.a[0] = make(383, 1, 90);
    steps = new ArrayList<>();
  }

  static int emptyPlayerSlot() {
    for (int i = 3; i < 39; i++) if (Player.container.a(i).d() == null) return i;
    return -1;
  }
  static void click(int slot, int button, int mode) throws Exception {
    Player.container.a(slot, button, mode, player);
    step("{\"op\":\"click\",\"slot\":" + slot + ",\"button\":" + button + ",\"mode\":" + mode + "}");
  }
  static void put(int slot, int id, int count, int damage) throws Exception {
    Player.container.a(slot).c(make(id, count, damage));
    step("{\"op\":\"put\",\"slot\":" + slot + ",\"id\":" + id + ",\"count\":" + count + ",\"damage\":" + damage + "}");
  }
  static void interact() throws Exception {
    boolean r = villager.a(player);
    step("{\"op\":\"interact\",\"result\":" + r + "}");
  }
  static void select(int i) throws Exception {
    Player.container.e(i);
    step("{\"op\":\"select\",\"index\":" + i + "}");
  }
  static void close() throws Exception {
    Player.container.b(player);
    step("{\"op\":\"close\"}");
  }
  static void tick(int n) throws Exception {
    tickAI(n);
    step("{\"op\":\"tick\",\"count\":" + n + "}");
  }

  static void trading(int profession, long seed, int rounds) throws Exception {
    long shuffleSeed = 987654321L + seed * 7919L + profession * 104729L;
    newCase(profession, seed, shuffleSeed, 0, false);
    Random sr = new Random(seed * 31 + profession);
    // The first interact plays no sound; the first inventory calculation after it may.
    interact();
    for (int round = 0; round < rounds; round++) {
      ago list = (ago) get(villager, "bu");
      if (get(villager, "bt") == null) {
        // The previous session ended: let timers run, then talk to the villager again.
        tick(sr.nextInt(3) == 0 ? sr.nextInt(80) : 45);
        interact();
        continue;
      }
      int roll = sr.nextInt(100);
      if (roll < 8) { close(); continue; }
      if (roll < 14) { tick(1 + sr.nextInt(30)); continue; }
      if (roll < 20) { // arbitrary junk and clicks
        int slot = sr.nextInt(39);
        if (sr.nextBoolean()) put(slot, new int[] {265, 4, 296, 388, 1, 35}[sr.nextInt(6)], 1 + sr.nextInt(20), 0);
        else click(slot, sr.nextInt(2), sr.nextInt(4) == 0 ? 1 : 0);
        continue;
      }
      if (roll < 24) { select(sr.nextInt(list.size() + 1)); continue; }
      // A purchase attempt.
      int index = sr.nextInt(list.size());
      agn r = (agn) list.get(index);
      select(index);
      int mode = sr.nextInt(3); // 0 buy first in slot 0, 1 swapped, 2 short of payment
      add buy = r.a(), buyB = r.b();
      int multiple = 1 + sr.nextInt(2), a = buy.b * multiple, b = buyB == null ? 0 : buyB.b * multiple;
      if (mode == 2) a = Math.max(1, a - 1);
      int idA = adb.b(buy.b()), idB = buyB == null ? -1 : adb.b(buyB.b());
      int sa = mode == 1 && buyB != null ? 1 : 0;
      put(sa, idA, Math.min(a, 64), 0);
      if (buyB != null) put(1 - sa, idB, Math.min(b, 64), 0);
      else if (sr.nextInt(8) == 0) put(1, 280, 1, 0);
      int take = sr.nextInt(3);
      if (take == 0) click(2, 0, 1);
      else if (take == 1) { click(2, sr.nextInt(2), 0); int e = emptyPlayerSlot(); if (e >= 0) click(e, 0, 0); }
      else { click(2, 0, 1); click(2, 0, 1); }
    }
    close();
    tick(60);
    Random entity = (Random) MobMoveProbe.field(villager.getClass(), "Z").get(villager);
    StringBuilder out = new StringBuilder("{\"kind\":\"trading\",\"profession\":").append(profession).append(",\"seed\":").append(seed)
      .append(",\"shuffleSeed\":").append(shuffleSeed).append(",\"steps\":[").append(String.join(",", steps))
      .append("],\"nextEntityInt\":").append(entity.nextInt()).append(",\"nextShuffleInt\":").append(shuffleRandom.nextInt()).append('}');
    System.out.println(out);
  }

  static void refusal(String label, int age, boolean egg, boolean alreadyTrading, boolean dead) throws Exception {
    newCase(0, 5, 11, age, egg);
    if (alreadyTrading) { villager.a_(player); }
    if (dead) villager.f(0f);
    interact();
    System.out.println("{\"kind\":\"refusal\",\"label\":\"" + label + "\",\"profession\":0,\"seed\":5,\"shuffleSeed\":11,\"age\":" + age + ",\"egg\":" + egg + ",\"alreadyTrading\":" + alreadyTrading + ",\"dead\":" + dead + ",\"steps\":[" + String.join(",", steps) + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    unsafe = MobMoveProbe.unsafe();
    shuffleField = Collections.class.getDeclaredField("r");
    shuffleField.setAccessible(true);
    new yv(VillagerOffersProbe.world(), 0);
    refusal("adult", 0, false, false, false);
    refusal("child", -24000, false, false, false);
    refusal("egg", 0, true, false, false);
    refusal("already trading", 0, false, true, false);
    for (int profession = 0; profession < 5; profession++) for (long seed = 0; seed < 12; seed++) trading(profession, seed, 70);
    StringBuilder limits = new StringBuilder("{\"kind\":\"stackLimits\",\"limits\":{");
    boolean first = true;
    for (int id : ids) { limits.append(first ? "" : ",").append('"').append(id).append("\":").append(adb.d(id) == null ? 64 : new add(adb.d(id)).e()); first = false; }
    System.out.println(limits.append("}}"));
  }
}
