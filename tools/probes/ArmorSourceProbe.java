import java.lang.reflect.Field;
import java.util.*;

// Batch 49 (firearmor): every DamageSource the port uses against the player, run through the unchanged EntityPlayerMP.attackEntityFrom (sv.a(ro, float))
// on the PlayerDamageProbe double, with armour worn (plain, then Protection, Fire Protection, Feather Falling, Blast Protection, Projectile Protection),
// the Resistance potion in the active effects, and absorption hearts. Each record keeps health, the four armour pieces' damage, absorption, the food
// exhaustion the hit added (DamageSource.hungerDamage through EntityPlayer.addExhaustion) and the hurt-window state. Armour is boots first (InventoryPlayer.armorInventory). EnchantmentHelper's static Random
// is reseeded per record (seed in the record). DamageSource.causePlayerDamage (ro.a(yz)) is not run: EntityPlayerMP.attackEntityFrom refuses a player attacker while the double has PvP off
// (accepted false, nothing taken); bytecode-read, it is the same flag-free EntityDamageSource as causeMobDamage. Armour wear is yz/InventoryPlayer.damageArmor (called by applyArmorCalculations only).
public class ArmorSourceProbe {
  public static class Fireball extends ze { Fireball() { super(null); } protected void a(azu m) { } }
  static String num(float v) { return Float.toString(v); }
  static final String[] SOURCES = { "inFire", "onFire", "lava", "inWall", "drown", "starve", "cactus", "fall", "outOfWorld", "generic", "magic", "wither", "anvil", "fallingBlock",
    "mob", "arrow", "fireball", "thrown", "indirectMagic", "thorns", "explosion" };
  static ro source(String name, sv attacker, yz playerAttacker) throws Exception {
    switch (name) {
      case "magic": return ro.k;
      case "wither": return ro.l;
      case "anvil": return ro.m;
      case "fallingBlock": return ro.n;
      case "arrow": return ro.a((zc) PlayerDamageProbe.u.allocateInstance(zc.class), attacker);
      case "fireball": return ro.a((ze) PlayerDamageProbe.u.allocateInstance(Fireball.class), attacker);
      case "thrown": return ro.a((sa) attacker, attacker);
      case "indirectMagic": return ro.b((sa) attacker, attacker);
      case "thorns": return ro.a((sa) attacker);
      case "explosion": return ro.a((agw) null);
      default: return PlayerDamageProbe.source(name, attacker);
    }
  }
  static void wear(sv e, int material, int ench, int level) throws Exception {
    yx inv = (yx) PlayerDamageProbe.fd(yz.class, "bm").get(e);
    int[] base = material == 0 ? new int[] { 298, 299, 300, 301 } : material == 1 ? new int[] { 306, 307, 308, 309 } : new int[] { 310, 311, 312, 313 };
    for (int i = 0; i < 4; i++)
      inv.b[i] = ench < 0 ? new add(adb.d(base[3 - i]), 1, 0) : ArmorEnchantmentProbe.make(base[3 - i], 0, ArmorEnchantmentProbe.ench(ench, level));
  }
  static final Field itemDamage;
  static { try { itemDamage = PlayerDamageProbe.fd(add.class, "f"); } catch (Exception x) { throw new RuntimeException(x); } }
  static String armor(sv e) throws Exception {
    yx inv = (yx) PlayerDamageProbe.fd(yz.class, "bm").get(e);
    StringBuilder s = new StringBuilder();
    for (int i = 0; i < 4; i++) s.append(i == 0 ? "" : ",").append(inv.b[i] == null ? "null" : String.valueOf(itemDamage.getInt(inv.b[i])));
    return s.toString();
  }
  static int cases = 0;
  static void run(String name, String src, float amount, int material, int ench, int level, int resistance, float absorption) throws Exception {
    Map<String, Object> setup = PlayerDamageProbe.setup();
    sv e = PlayerDamageProbe.prepare("player", 64.5, 5.0, 64.5, setup);
    if (material >= 0) wear(e, material, ench, level);
    if (resistance >= 0) ((HashMap) PlayerDamageProbe.fd(sv.class, "f").get(e)).put(Integer.valueOf(11), new rw(11, 1000, resistance));
    if (absorption > 0) ((te) PlayerDamageProbe.fd(sa.class, "af").get(e)).b(17, Float.valueOf(absorption));
    yq attacker = new yq(PlayerDamageProbe.w); PlayerDamageProbe.pos(attacker, 66.5, 5.0, 64.5);
    yz other = (yz) PlayerDamageProbe.make("player"); PlayerDamageProbe.pos(other, 66.5, 5.0, 64.5);
    long seed = 49_000L + cases++;
    ((Random) ArmorEnchantmentProbe.helperRandom()).setSeed(seed);
    zr food = (zr) PlayerDamageProbe.fd(yz.class, "bp").get(e);
    Field exF = PlayerDamageProbe.fd(zr.class, "c");
    float exBefore = exF.getFloat(food), before = e.aS();
    ro s = source(src, attacker, other);
    boolean ok = e.a(s, amount);
    float abs = ((te) PlayerDamageProbe.fd(sa.class, "af").get(e)).d(17);
    System.out.println("{\"case\":\"" + name + "\",\"source\":\"" + src + "\",\"amount\":" + num(amount) + ",\"material\":" + material + ",\"ench\":" + ench + ",\"level\":" + level
      + ",\"resistance\":" + resistance + ",\"absorption\":" + num(absorption) + ",\"seed\":\"" + seed + "\",\"accepted\":" + ok + ",\"lost\":" + num(before - e.aS()) + ",\"health\":" + num(e.aS())
      + ",\"absorbed\":" + num(abs) + ",\"armor\":[" + armor(e) + "],\"exhaustion\":" + num(exF.getFloat(food) - exBefore) + ",\"last\":" + num(PlayerDamageProbe.ld.getFloat(e)) + "}");
  }
  public static void main(String[] args) throws Exception {
    PlayerDamageProbe.init();
    for (String src : SOURCES) for (float amount : new float[] { 1.0f, 6.0f }) {
      run("bare", src, amount, -1, -1, 0, -1, 0);
      run("iron", src, amount, 1, -1, 0, -1, 0);
      run("leather", src, amount, 0, -1, 0, -1, 0);
      run("diamond-prot4", src, amount, 2, 0, 4, -1, 0);
      run("iron-prot2", src, amount, 1, 0, 2, -1, 0);
      run("iron-fireprot4", src, amount, 1, 1, 4, -1, 0);
      run("iron-featherfall4", src, amount, 1, 2, 4, -1, 0);
      run("iron-blast4", src, amount, 1, 3, 4, -1, 0);
      run("iron-projectile4", src, amount, 1, 4, 4, -1, 0);
      run("bare-resist1", src, amount, -1, -1, 0, 1, 0);
      run("iron-resist0", src, amount, 1, -1, 0, 0, 0);
      run("iron-resist1", src, amount, 1, -1, 0, 1, 0);
      run("iron-resist4", src, amount, 1, -1, 0, 4, 0);
      run("iron-absorb4", src, amount, 1, -1, 0, -1, 4.0f);
      run("bare-absorb10", src, amount, -1, -1, 0, -1, 10.0f);
      run("all", src, amount, 1, 0, 3, 1, 3.0f);
    }
    // A large hit that wears armour more than once per point: wear = max(1, amount / 4).
    for (String src : new String[] { "mob", "fall", "onFire" }) run("big", src, 18.0f, 1, -1, 0, -1, 0);
  }
}
