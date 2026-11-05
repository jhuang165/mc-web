import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Drives the unchanged 1.7.10 ContainerHorseInventory (aam) with its saddle slot (aan) and armour slot (aao), AnimalChest (zt),
// EntityHorse (wi) gear, EntityLiving leash methods (sw.c(yz) interact, sw.b(sa,boolean) / a(boolean,boolean) and
// EntityCreature td.bL updateLeashedState), ItemLead (adf) with EntityLeashKnot (su), ItemNameTag (adm) and the CraftingManager
// lead recipe, on the HorseProbe world double (HorseProbe.java, MobMoveProbe.java). One JSON object per line:
//   container   slot count, size and per-slot (x, y, enabled) for each horse type, with and without a chest
//   slotValid   Slot.isItemValid for saddle, horse armour, chest block, stick and apple on every gear slot
//   transfer    transferStackInSlot into and out of the horse inventory over gear states
//   usable      canInteractWith by distance and life
//   drops       EntityHorse.cK (gear and chest contents on death, then the chest block)
//   leash       td.bL over holder distances (unleash beyond 10, velocity pull beyond 6, lead drop)
//   leashUse    sw.c(yz) with a lead: attach, owner unleash, creative, monsters, held-stack counts
//   knot        ItemLead.onItemUse over fences within 7 blocks (adf.a) and EntityLeashKnot.interact
//   nameTag     ItemNameTag.itemInteractionForEntity: named, unnamed, mobs, players and persistence
//   recipe      the lead recipe from the CraftingManager
public class HorseGearProbe {
  public static class GW extends HorseProbe.World {
    static List<sa> entities = new ArrayList<>();
    static int fx = Integer.MIN_VALUE, fy, fz;
    public aji a(int x, int y, int z) { return x == fx && y == fy && z == fz ? aji.e(85) : super.a(x, y, z); }
    public boolean d(sa e) { if (!(e instanceof xk)) entities.add(e); return super.d(e); }
    public List a(Class c, azt box) {
      List<sa> out = new ArrayList<>();
      for (sa e : entities) {
        if (!c.isInstance(e)) continue;
        double x = e.s, y = e.t, z = e.u;
        if (x >= box.a && x <= box.d && y >= box.b && y <= box.e && z >= box.c && z <= box.f) out.add(e);
      }
      return out;
    }
  }

  static void out(String s) { System.out.println(s); }
  static String str(String s) { return HorseProbe.str(s); }
  static sun.misc.Unsafe u;
  static yz player, creative;

  static void at(sa e, double x, double y, double z) throws Exception {
    MobMoveProbe.set(e, "s", x); MobMoveProbe.set(e, "t", y); MobMoveProbe.set(e, "u", z);
    MobMoveProbe.set(e, "p", x); MobMoveProbe.set(e, "q", y); MobMoveProbe.set(e, "r", z);
  }
  static add item(String kind, int count) { return HorseProbe.itemStack(kind, count); }
  static zt chestOf(wi e) throws Exception { return (zt) MobMoveProbe.field(wi.class, "bG").get(e); }
  static wi gearHorse(int type, boolean chested) throws Exception {
    wi e = HorseProbe.typed(5, type);
    e.i(true);
    if (chested) { e.l(true); MobMoveProbe.method(wi.class, "cN").invoke(e); }
    at(e, 0, 0, 0);
    return e;
  }
  static String stacks(rb inv) {
    StringBuilder b = new StringBuilder("[");
    for (int i = 0; i < inv.a(); i++) b.append(i > 0 ? "," : "").append(HorseProbe.stack(inv.a(i)));
    return b.append("]").toString();
  }
  static yx playerInv(yz p) throws Exception { return (yx) MobMoveProbe.field(yz.class, "bm").get(p); }
  static yz freshPlayer(boolean creativeMode) throws Exception {
    yz p = HorseProbe.makePlayer(creativeMode);
    at(p, 0, 0, 0);
    return p;
  }
  static String slotRows(aam c) {
    StringBuilder b = new StringBuilder("[");
    for (int i = 0; i < c.c.size(); i++) {
      aay s = (aay) c.c.get(i);
      b.append(i > 0 ? "," : "").append("{\"slot\":" + s.g + ",\"x\":" + s.h + ",\"y\":" + s.i + ",\"enabled\":" + s.b() + "}");
    }
    return b.append("]").toString();
  }

  static void container() throws Exception {
    for (int type = 0; type < 5; type++) for (int chested = 0; chested < 2; chested++) {
      if (chested == 1 && type != 1 && type != 2) continue;
      wi e = gearHorse(type, chested == 1);
      yz p = freshPlayer(false);
      zt chest = chestOf(e);
      aam c = new aam(playerInv(p), chest, e);
      out("{\"case\":\"container\",\"type\":" + type + ",\"chested\":" + (chested == 1) + ",\"size\":" + chest.a() + ",\"slots\":" + c.c.size() + ",\"rows\":" + slotRows(c)
        + ",\"canWearArmor\":" + e.cB() + ",\"canCarryChest\":" + e.cC() + "}");
    }
  }

  static void slotValid() throws Exception {
    String[] kinds = { "saddle", "ironArmor", "goldArmor", "diamondArmor", "chest", "stick", "apple" };
    for (int type = 0; type < 5; type++) for (int chested = 0; chested < 2; chested++) {
      if (chested == 1 && type != 1 && type != 2) continue;
      for (int occupied = 0; occupied < 2; occupied++) {
        wi e = gearHorse(type, chested == 1);
        yz p = freshPlayer(false);
        zt chest = chestOf(e);
        aam c = new aam(playerInv(p), chest, e);
        if (occupied == 1) { chest.a(0, item("saddle", 1)); if (type == 0) chest.a(1, item("ironArmor", 1)); }
        for (String kind : kinds) {
          StringBuilder v = new StringBuilder("[");
          int n = Math.min(chest.a(), 3);
          for (int s = 0; s < n; s++) v.append(s > 0 ? "," : "").append(((aay) c.c.get(s)).a(item(kind, 1)));
          out("{\"case\":\"slotValid\",\"type\":" + type + ",\"chested\":" + (chested == 1) + ",\"occupied\":" + (occupied == 1) + ",\"item\":" + str(kind) + ",\"valid\":" + v + "]}");
        }
      }
    }
  }

  static void transfer() throws Exception {
    String[] kinds = { "saddle", "ironArmor", "stick", "chest", "apple" };
    int[][] setups = { { 0, 0 }, { 1, 0 }, { 1, 1 }, { 2, 1 }, { 3, 0 } };
    for (int[] su : setups) for (int pre = 0; pre < 3; pre++) for (String kind : kinds) {
      wi e = gearHorse(su[0], su[1] == 1);
      yz p = freshPlayer(false);
      zt chest = chestOf(e);
      yx inv = playerInv(p);
      aam c = new aam(inv, chest, e);
      if (pre == 1) chest.a(0, item("saddle", 1));
      if (pre == 2) { chest.a(0, item("saddle", 1)); if (su[0] == 0) chest.a(1, item("goldArmor", 1)); if (chest.a() > 2) chest.a(2, item("stick", 5)); }
      inv.a[0] = item(kind, kind.equals("stick") || kind.equals("apple") ? 3 : 1);
      HorseProbe.clear();
      int index = chest.a() + 27;
      add moved = c.b(p, index);
      out("{\"case\":\"transfer\",\"dir\":\"in\",\"type\":" + su[0] + ",\"chested\":" + (su[1] == 1) + ",\"pre\":" + pre + ",\"item\":" + str(kind) + ",\"result\":" + HorseProbe.stack(moved)
        + ",\"horse\":" + stacks(chest) + ",\"hotbar0\":" + HorseProbe.stack(inv.a[0]) + ",\"saddled\":" + e.cu() + ",\"armor\":" + e.cl() + "}");
    }
    // from the horse into the player's inventory
    for (int[] su : new int[][] { { 0, 0 }, { 1, 1 } }) for (int slot = 0; slot < 3; slot++) {
      if (slot == 2 && su[1] == 0) continue;
      wi e = gearHorse(su[0], su[1] == 1);
      yz p = freshPlayer(false);
      zt chest = chestOf(e);
      yx inv = playerInv(p);
      aam c = new aam(inv, chest, e);
      chest.a(0, item("saddle", 1));
      if (su[0] == 0) chest.a(1, item("diamondArmor", 1));
      if (chest.a() > 2) chest.a(2, item("stick", 5));
      add moved = c.b(p, slot);
      StringBuilder pi = new StringBuilder("[");
      boolean first = true;
      for (int i = 0; i < inv.a.length; i++) if (inv.a[i] != null) { pi.append(first ? "" : ",").append("{\"slot\":" + i + ",\"stack\":" + HorseProbe.stack(inv.a[i]) + "}"); first = false; }
      out("{\"case\":\"transfer\",\"dir\":\"out\",\"type\":" + su[0] + ",\"chested\":" + (su[1] == 1) + ",\"slot\":" + slot + ",\"result\":" + HorseProbe.stack(moved) + ",\"horse\":" + stacks(chest)
        + ",\"player\":" + pi + "],\"saddled\":" + e.cu() + ",\"armor\":" + e.cl() + "}");
    }
  }

  static void usable() throws Exception {
    for (double dist : new double[] { 0, 3, 7.9, 8.0, 8.1, 20 }) for (int dead = 0; dead < 2; dead++) {
      wi e = gearHorse(0, false);
      yz p = freshPlayer(false);
      at(p, dist, 0, 0);
      if (dead == 1) e.g(0f);
      aam c = new aam(playerInv(p), chestOf(e), e);
      out("{\"case\":\"usable\",\"distance\":" + dist + ",\"dead\":" + (dead == 1) + ",\"usable\":" + c.a(p) + "}");
    }
  }

  static void drops() throws Exception {
    for (int kind = 0; kind < 4; kind++) {
      HorseProbe.clear();
      wi e = gearHorse(kind == 3 ? 2 : kind == 2 ? 1 : 0, kind >= 2);
      zt chest = chestOf(e);
      if (kind >= 1) { chest.a(0, item("saddle", 1)); }
      if (kind == 1) chest.a(1, item("goldArmor", 1));
      if (kind >= 2) { chest.a(2, item("stick", 5)); chest.a(16, item("apple", 2)); }
      e.cK();
      out("{\"case\":\"drops\",\"kind\":" + kind + ",\"chested\":" + e.ck() + ",\"items\":" + HorseProbe.strings(HorseProbe.World.items) + "}");
    }
  }

  static String vec(sa e) throws Exception { return "[" + MobMoveProbe.d(e, "v") + "," + MobMoveProbe.d(e, "w") + "," + MobMoveProbe.d(e, "x") + "]"; }

  static void leash() throws Exception {
    for (double dist : new double[] { 1, 3.9, 4.0, 4.1, 5.9, 6.0, 6.1, 8, 9.9, 10.0, 10.1, 12 }) for (double dy : new double[] { 0, 3 }) {
      HorseProbe.clear();
      wi e = gearHorse(0, false);
      yz p = freshPlayer(false);
      at(p, dist, dy, 0);
      e.b(p, true);
      String steps = "[";
      for (int i = 0; i < 3; i++) {
        MobMoveProbe.method(sw.class, "bL").invoke(e);
        steps += (i > 0 ? "," : "") + "{\"leashed\":" + e.bN() + ",\"motion\":" + vec(e) + ",\"drops\":" + HorseProbe.strings(HorseProbe.World.items) + "}";
      }
      out("{\"case\":\"leash\",\"distance\":" + dist + ",\"dy\":" + dy + ",\"steps\":" + steps + "]}");
    }
    // holder removed or dead
    {
      HorseProbe.clear();
      wi e = gearHorse(0, false);
      yz p = freshPlayer(false);
      e.b(p, true);
      MobMoveProbe.set(p, "K", true);
      MobMoveProbe.method(sw.class, "bL").invoke(e);
      out("{\"case\":\"leashHolderDead\",\"leashed\":" + e.bN() + ",\"drops\":" + HorseProbe.strings(HorseProbe.World.items) + "}");
    }
  }

  static void leashUse() throws Exception {
    String[] subjects = { "horse", "pig", "zombie", "donkey" };
    for (String subject : subjects) for (int creativeMode = 0; creativeMode < 2; creativeMode++) for (int count = 1; count <= 2; count++) {
      HorseProbe.clear();
      sv e = subject.equals("horse") ? gearHorse(0, false) : subject.equals("donkey") ? gearHorse(1, false) : subject.equals("pig") ? new wo(HorseProbe.W) : new yq(HorseProbe.W);
      if (!subject.equals("horse") && !subject.equals("donkey")) { MobMoveProbe.set(e, "Z", new Random(3)); at(e, 0, 0, 0); }
      sw m = (sw) e;
      yz p = freshPlayer(creativeMode == 1);
      HorseProbe.hold(p, new add(ade.ca, count));
      boolean first = m.c(p);
      int heldAfter = HorseProbe.held(p) == null ? 0 : HorseProbe.held(p).b;
      boolean leashedAfter = m.bN();
      boolean holder = m.bO() == p;
      // a second lead click on the leashed mob
      HorseProbe.hold(p, new add(ade.ca, 2));
      boolean second = m.c(p);
      int heldSecond = HorseProbe.held(p) == null ? 0 : HorseProbe.held(p).b;
      out("{\"case\":\"leashUse\",\"subject\":" + str(subject) + ",\"creative\":" + (creativeMode == 1) + ",\"count\":" + count + ",\"first\":" + first + ",\"heldAfter\":" + heldAfter + ",\"leashed\":" + leashedAfter
        + ",\"holderIsPlayer\":" + holder + ",\"second\":" + second + ",\"secondLeashed\":" + m.bN() + ",\"heldAfterSecond\":" + heldSecond + ",\"drops\":" + HorseProbe.strings(HorseProbe.World.items) + "}");
    }
    // the holder's empty-hand click takes the lead off again (a drop outside Creative)
    for (int creativeMode = 0; creativeMode < 2; creativeMode++) {
      HorseProbe.clear();
      wo pig = new wo(HorseProbe.W);
      MobMoveProbe.set(pig, "Z", new Random(3));
      at(pig, 0, 0, 0);
      yz p = freshPlayer(creativeMode == 1);
      pig.b(p, true);
      HorseProbe.hold(p, null);
      boolean r = pig.c(p);
      out("{\"case\":\"unleash\",\"creative\":" + (creativeMode == 1) + ",\"result\":" + r + ",\"leashed\":" + pig.bN() + ",\"drops\":" + HorseProbe.strings(HorseProbe.World.items) + "}");
    }
  }

  static void knot() throws Exception {
    // adf.a(player, world, x, y, z): fence at (5, 0, 0); leashed pigs at distance within and beyond 7 blocks
    for (double d : new double[] { 0, 3, 6.9, 7.1, 9 }) for (int creativeMode = 0; creativeMode < 2; creativeMode++) {
      HorseProbe.clear();
      GW.entities.clear();
      GW.fx = 5; GW.fy = 0; GW.fz = 0;
      wo pig = new wo(HorseProbe.W);
      MobMoveProbe.set(pig, "Z", new Random(3));
      at(pig, 5 + d, 0, 0);
      GW.entities.add(pig);
      yz p = freshPlayer(creativeMode == 1);
      at(p, 5, 0, 3);
      pig.b(p, true);
      boolean used = new adf().a(new add(ade.ca, 1), p, HorseProbe.W, 5, 0, 0, 1, 0.5f, 0.5f, 0.5f);
      sa holder = pig.bO();
      int knots = 0;
      for (sa e : GW.entities) if (e instanceof su) knots++;
      out("{\"case\":\"knot\",\"pigDistance\":" + d + ",\"creative\":" + (creativeMode == 1) + ",\"used\":" + used + ",\"holderIsKnot\":" + (holder instanceof su) + ",\"holderIsPlayer\":" + (holder == p) + ",\"knots\":" + knots + "}");
    }
    // a lead on a non-fence block
    {
      HorseProbe.clear();
      GW.entities.clear();
      GW.fx = Integer.MIN_VALUE;
      yz p = freshPlayer(false);
      boolean used = new adf().a(new add(ade.ca, 1), p, HorseProbe.W, 5, 0, 0, 1, 0.5f, 0.5f, 0.5f);
      out("{\"case\":\"knotNoFence\",\"used\":" + used + "}");
    }
    // clicking an existing knot: with a lead, mobs held by the player attach; without, the knot dies (Creative also unleashes)
    for (int withLead = 0; withLead < 2; withLead++) for (int creativeMode = 0; creativeMode < 2; creativeMode++) {
      HorseProbe.clear();
      GW.entities.clear();
      GW.fx = 5; GW.fy = 0; GW.fz = 0;
      su knot = su.a(HorseProbe.W, 5, 0, 0);
      wo pig = new wo(HorseProbe.W);
      MobMoveProbe.set(pig, "Z", new Random(3));
      at(pig, 5, 0, 0);
      GW.entities.add(pig);
      yz p = freshPlayer(creativeMode == 1);
      at(p, 5, 0, 3);
      pig.b(knot, true);
      if (withLead == 1) HorseProbe.hold(p, new add(ade.ca, 1));
      boolean r = knot.c(p);
      out("{\"case\":\"knotClick\",\"lead\":" + (withLead == 1) + ",\"creative\":" + (creativeMode == 1) + ",\"result\":" + r + ",\"knotDead\":" + MobMoveProbe.field(sa.class, "K").getBoolean(knot) + ",\"pigLeashed\":" + pig.bN() + ",\"drops\":" + HorseProbe.strings(HorseProbe.World.items) + "}");
    }
    GW.fx = Integer.MIN_VALUE;
    GW.entities.clear();
  }

  static boolean persistent(sw e) throws Exception {
    // EntityLiving.persistenceRequired: the boolean that bF() sets (field bs or bt; read both)
    return MobMoveProbe.field(sw.class, "bt").getBoolean(e);
  }

  static void nameTag() throws Exception {
    String[] subjects = { "pig", "horse", "zombie", "villager", "player" };
    for (String subject : subjects) for (int named = 0; named < 3; named++) for (int count = 1; count <= 2; count++) {
      HorseProbe.clear();
      sv target;
      if (subject.equals("player")) target = freshPlayer(false);
      else if (subject.equals("horse")) target = gearHorse(0, false);
      else {
        target = subject.equals("pig") ? new wo(HorseProbe.W) : subject.equals("zombie") ? new yq(HorseProbe.W) : new yv(HorseProbe.W);
        MobMoveProbe.set(target, "Z", new Random(3));
        at(target, 0, 0, 0);
      }
      yz p = freshPlayer(false);
      add tag = new add(ade.cb, count);
      if (named == 1) tag.c("Rex");
      if (named == 2) tag.c("");
      boolean before = target instanceof sw && persistent((sw) target);
      boolean r = tag.b().a(tag, p, target);
      sw m = target instanceof sw ? (sw) target : null;
      out("{\"case\":\"nameTag\",\"subject\":" + str(subject) + ",\"stackName\":" + str(named == 1 ? "Rex" : named == 2 ? "(empty)" : "") + ",\"hasDisplayName\":" + tag.u() + ",\"count\":" + count + ",\"result\":" + r
        + ",\"countAfter\":" + tag.b + ",\"customName\":" + str(m == null ? null : m.bG()) + ",\"hasCustomName\":" + (m != null && m.bH()) + ",\"persistentBefore\":" + before + ",\"persistentAfter\":" + (m != null && persistent(m)) + "}");
    }
  }

  static void recipe() throws Exception {
    List<afg> recipes = afe.a().b();
    for (int index = 0; index < recipes.size(); index++) {
      afg r = recipes.get(index);
      add result = r.b();
      if (result == null || result.b() != ade.ca) continue;
      List<String> ing = new ArrayList<>();
      String type = "special", dims = "";
      if (r instanceof afh) {
        type = "shaped";
        dims = ",\"width\":" + MobMoveProbe.field(afh.class, "a").getInt(r) + ",\"height\":" + MobMoveProbe.field(afh.class, "b").getInt(r);
        for (add a : (add[]) MobMoveProbe.field(afh.class, "c").get(r)) ing.add(HorseProbe.stack(a));
      } else if (r instanceof afi) {
        type = "shapeless";
        for (Object a : (List) MobMoveProbe.field(afi.class, "b").get(r)) ing.add(HorseProbe.stack((add) a));
      }
      out("{\"case\":\"recipe\",\"index\":" + index + ",\"type\":" + str(type) + dims + ",\"ingredients\":" + ing + ",\"result\":" + HorseProbe.stack(result) + "}");
    }
    out("{\"case\":\"itemIds\",\"lead\":" + adb.b(ade.ca) + ",\"nameTag\":" + adb.b(ade.cb) + ",\"saddle\":" + adb.b(ade.av) + ",\"maxStack\":{\"lead\":" + ade.ca.m() + ",\"nameTag\":" + ade.cb.m() + ",\"saddle\":" + ade.av.m() + ",\"ironArmor\":" + ade.bX.m() + "}}");
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    u = MobMoveProbe.unsafe();
    GW world = (GW) u.allocateInstance(GW.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class));
    final apx empty = (apx) u.allocateInstance(apx.class);
    MobMoveProbe.set(empty, "u", new apz[16]);
    MobMoveProbe.set(world, "v", java.lang.reflect.Proxy.newProxyInstance(apu.class.getClassLoader(), new Class[] { apu.class }, (proxy, m, a) -> {
      Class r = m.getReturnType();
      if (r == apx.class) return empty;
      if (r == boolean.class) return true;
      if (r == int.class) return 0;
      return null;
    }));
    HorseProbe.W = world;
    HorseProbe.player = HorseProbe.makePlayer(false);
    container();
    slotValid();
    transfer();
    usable();
    drops();
    leash();
    leashUse();
    knot();
    nameTag();
    recipe();
  }
}
