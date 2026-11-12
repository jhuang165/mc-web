import java.lang.reflect.Field;
import java.util.*;

// Batch 50 (mobresist): the mob side of EntityLivingBase.attackEntityFrom / damageEntity (sv.a, sv.d, sv.b armour, sv.c Resistance and enchantments, then the absorption amount sv.bs/sv.m)
// run on the unchanged EntityZombie (yq, natural armour 2) with armour worn (plain, then Protection, Fire Protection, Feather Falling, Blast Protection, Projectile Protection),
// the Resistance potion in the active effects and absorption hearts, for every DamageSource the port uses, plus DamageSource.causePlayerDamage (ro.a(yz)). The PvP rows run
// the same sources against the real EntityPlayerMP with PvP enabled on the server double (MinecraftServer.ab), with a player attacker. Each record keeps health, the four
// armour pieces' damage (EntityLivingBase.damageArmor sv.h is empty: mobs never wear it down), absorption and whether the hit was accepted. EnchantmentHelper's static Random is reseeded per record.
public class MobResistProbe {
  public static class Fireball extends ze { Fireball() { super(null); } protected void a(azu m) { } }
  public static class PvpServer extends SuffocationProbe.Fake { public boolean ab() { return true; } }
  static String num(float v) { return Float.toString(v); }
  static final String[] SOURCES = { "inFire", "onFire", "lava", "inWall", "drown", "starve", "cactus", "fall", "outOfWorld", "generic", "magic", "wither", "anvil", "fallingBlock",
    "mob", "player", "arrow", "fireball", "thrown", "indirectMagic", "thorns", "explosion" };
  static ro source(String name, sv attacker, yz playerAttacker) throws Exception {
    if (name.equals("player")) return ro.a(playerAttacker);
    return ArmorSourceProbe.source(name, attacker, playerAttacker);
  }
  static void wearZombie(sv e, int material, int ench, int level) throws Exception {
    int[] base = material == 0 ? new int[] { 298, 299, 300, 301 } : material == 1 ? new int[] { 306, 307, 308, 309 } : new int[] { 310, 311, 312, 313 };
    for (int i = 0; i < 4; i++)
      ((td) e).c(i + 1, ench < 0 ? new add(adb.d(base[3 - i]), 1, 0) : ArmorEnchantmentProbe.make(base[3 - i], 0, ArmorEnchantmentProbe.ench(ench, level)));
  }
  static String armor(sv e, boolean player) throws Exception {
    StringBuilder s = new StringBuilder();
    if (player) { yx inv = (yx) PlayerDamageProbe.fd(yz.class, "bm").get(e); for (int i = 0; i < 4; i++) s.append(i == 0 ? "" : ",").append(inv.b[i] == null ? "null" : String.valueOf(ArmorSourceProbe.itemDamage.getInt(inv.b[i]))); }
    else { add[] a = ((td) e).ak(); for (int i = 1; i < 5; i++) s.append(i == 1 ? "" : ",").append(a[i] == null ? "null" : String.valueOf(ArmorSourceProbe.itemDamage.getInt(a[i]))); }
    return s.toString();
  }
  static int cases = 0;
  static void run(String victim, String name, String src, float amount, int material, int ench, int level, int resistance, float absorption) throws Exception {
    boolean player = victim.equals("player");
    Map<String, Object> setup = PlayerDamageProbe.setup();
    sv e = PlayerDamageProbe.prepare(player ? "player" : "zombie", 64.5, 5.0, 64.5, setup);
    if (player) { PlayerDamageProbe.fd(mw.class, "b").set(e, PlayerDamageProbe.u.allocateInstance(PvpServer.class)); if (material >= 0) ArmorSourceProbe.wear(e, material, ench, level); }
    else if (material >= 0) wearZombie(e, material, ench, level);
    if (resistance >= 0) ((HashMap) PlayerDamageProbe.fd(sv.class, "f").get(e)).put(Integer.valueOf(11), new rw(11, 1000, resistance));
    if (absorption > 0) e.m(absorption);
    yq attacker = new yq(PlayerDamageProbe.w); PlayerDamageProbe.pos(attacker, 66.5, 5.0, 64.5);
    yz other = (yz) PlayerDamageProbe.make("player"); PlayerDamageProbe.pos(other, 66.5, 5.0, 64.5);
    long seed = 50_000L + cases++;
    ((Random) ArmorEnchantmentProbe.helperRandom()).setSeed(seed);
    float before = e.aS();
    ro s = source(src, attacker, other);
    boolean ok = e.a(s, amount);
    System.out.println("{\"victim\":\"" + victim + "\",\"case\":\"" + name + "\",\"source\":\"" + src + "\",\"amount\":" + num(amount) + ",\"material\":" + material + ",\"ench\":" + ench + ",\"level\":" + level
      + ",\"resistance\":" + resistance + ",\"absorption\":" + num(absorption) + ",\"seed\":\"" + seed + "\",\"accepted\":" + ok + ",\"health\":" + num(e.aS())
      + ",\"absorbed\":" + num(e.bs()) + ",\"armor\":[" + armor(e, player) + "],\"last\":" + num(PlayerDamageProbe.ld.getFloat(e)) + "}");
  }
  static void loadouts(String victim, String src, float amount) throws Exception {
    run(victim, "bare", src, amount, -1, -1, 0, -1, 0);
    run(victim, "iron", src, amount, 1, -1, 0, -1, 0);
    run(victim, "leather", src, amount, 0, -1, 0, -1, 0);
    run(victim, "diamond-prot4", src, amount, 2, 0, 4, -1, 0);
    run(victim, "iron-prot2", src, amount, 1, 0, 2, -1, 0);
    run(victim, "iron-fireprot4", src, amount, 1, 1, 4, -1, 0);
    run(victim, "iron-featherfall4", src, amount, 1, 2, 4, -1, 0);
    run(victim, "iron-blast4", src, amount, 1, 3, 4, -1, 0);
    run(victim, "iron-projectile4", src, amount, 1, 4, 4, -1, 0);
    run(victim, "bare-resist1", src, amount, -1, -1, 0, 1, 0);
    run(victim, "iron-resist0", src, amount, 1, -1, 0, 0, 0);
    run(victim, "iron-resist1", src, amount, 1, -1, 0, 1, 0);
    run(victim, "iron-resist4", src, amount, 1, -1, 0, 4, 0);
    run(victim, "iron-absorb4", src, amount, 1, -1, 0, -1, 4.0f);
    run(victim, "bare-absorb10", src, amount, -1, -1, 0, -1, 10.0f);
    run(victim, "all", src, amount, 1, 0, 3, 1, 3.0f);
  }
  public static void main(String[] args) throws Exception {
    PlayerDamageProbe.init();
    for (String src : SOURCES) for (float amount : new float[] { 1.0f, 6.0f }) loadouts("zombie", src, amount);
    for (String src : new String[] { "player", "mob" }) for (float amount : new float[] { 1.0f, 6.0f }) loadouts("player", src, amount);
    for (String src : new String[] { "mob", "fall", "onFire" }) run("zombie", "big", src, 18.0f, 1, -1, 0, -1, 0);
  }
}
