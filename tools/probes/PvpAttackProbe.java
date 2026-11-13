import java.lang.reflect.Field;
import java.util.*;

// Batch 63 (mppvp): EntityPlayer.attackTargetEntityWithCurrentItem (yz.r) run on the unchanged 1.7.10 classes with a real EntityPlayerMP attacker and a real EntityPlayerMP victim
// (PlayerDamageProbe double, PvP enabled on the server double as in MobResistProbe). The attacker's held stack is put in hotbar slot 0 and its attribute modifiers are applied to the
// attacker's attribute map (EntityLivingBase.onUpdate does that on the next update, which the double does not run). One JSON line per case: the victim's health after every hit,
// hurtResistantTime, the attacker's weapon damage, every victim armour piece's damage, both players' motion, the attacker's sprint flag, the victim's burning flag and the death message.
public class PvpAttackProbe {
  // EntityPlayerMP.onCriticalHit (b) and onEnchantmentCritical (c) send an animation packet through the WorldServer entity tracker, which the world double does not have: only record that they ran.
  public static class Attacker extends PlayerDamageProbe.Player {
    static boolean crit, enchantCrit;
    public void b(sa target) { crit = true; }
    public void c(sa target) { enchantCrit = true; }
  }
  static String num(float v) { return Float.toString(v); }
  static String num(double v) { return Double.toString(v); }
  static int cases = 0;
  static String stack(add s) throws Exception { return s == null ? "null" : String.valueOf(ArmorSourceProbe.itemDamage.getInt(s)); }
  static double d(sa e, String n) throws Exception { return PlayerDamageProbe.fd(sa.class, n).getDouble(e); }
  // hits: arrays of {weaponId, enchantment id/level pairs...}, applied in order in the same tick to the same victim
  static void run(String name, int[][] hits, boolean sprint, boolean fall, boolean creative, int material, int ench, int level, float health, float yaw) throws Exception {
    Map<String, Object> setup = PlayerDamageProbe.setup();
    sv victim = PlayerDamageProbe.prepare("player", 65.5, 5.0, 64.5, setup);
    PlayerDamageProbe.fd(mw.class, "b").set(victim, PlayerDamageProbe.u.allocateInstance(MobResistProbe.PvpServer.class));
    if (material >= 0) ArmorSourceProbe.wear(victim, material, ench, level);
    if (creative) ((yw) PlayerDamageProbe.fd(yz.class, "bE").get(victim)).a = true;
    if (health > 0) victim.g(health);
    PlayerDamageProbe.playerClass = Attacker.class; Attacker.crit = Attacker.enchantCrit = false;
    yz attacker = (yz) PlayerDamageProbe.make("player");
    PlayerDamageProbe.playerClass = PlayerDamageProbe.Player.class;
    PlayerDamageProbe.pos(attacker, 64.5, 5.0, 64.5);
    PlayerDamageProbe.fd(sa.class, "y").setFloat(attacker, yaw);
    yx inv = (yx) PlayerDamageProbe.fd(yz.class, "bm").get(attacker);
    PlayerDamageProbe.fd(sa.class, "v").setDouble(attacker, 1.0); PlayerDamageProbe.fd(sa.class, "x").setDouble(attacker, 1.0); // so the 0.6 factor of a knockback hit shows
    if (sprint) attacker.c(true);
    if (fall) { PlayerDamageProbe.fd(sa.class, "R").setFloat(attacker, 2.0f); PlayerDamageProbe.fd(sa.class, "D").setBoolean(attacker, false); }
    else PlayerDamageProbe.fd(sa.class, "D").setBoolean(attacker, true);
    long seed = 63_000L + cases++;
    ((Random) ArmorEnchantmentProbe.helperRandom()).setSeed(seed);
    StringBuilder out = new StringBuilder();
    for (int h = 0; h < hits.length; h++) {
      int[] spec = hits[h];
      add held = spec[0] == 0 ? null : ArmorEnchantmentProbe.make(spec[0], 0, ArmorEnchantmentProbe.ench(Arrays.copyOfRange(spec, 1, spec.length)));
      if (inv.a[0] != null) attacker.bc().a(inv.a[0].D()); // tl.a removes the previous weapon's modifiers
      inv.a[0] = held; inv.c = 0;
      if (held != null) attacker.bc().b(held.D()); // tl.b applies them
      float before = victim.aS(); int hrBefore = PlayerDamageProbe.hr.getInt(victim);
      attacker.r(victim);
      out.append(h == 0 ? "" : ",").append("{\"health\":").append(num(victim.aS())).append(",\"dealt\":").append(num(before - victim.aS())).append(",\"resist\":").append(PlayerDamageProbe.hr.getInt(victim))
        .append(",\"hitWindow\":").append(hrBefore).append(",\"last\":").append(num(PlayerDamageProbe.ld.getFloat(victim))).append(",\"weapon\":").append(stack(held)).append("}");
    }
    sa v = victim, a = attacker;
    System.out.println("{\"case\":\"" + name + "\",\"seed\":\"" + seed + "\",\"hits\":" + Arrays.deepToString(hits).replace(" ", "").replace("[", "[").replace("]", "]") + ",\"sprint\":" + sprint + ",\"fall\":" + fall + ",\"creative\":" + creative
      + ",\"material\":" + material + ",\"ench\":" + ench + ",\"level\":" + level + ",\"startHealth\":" + num(health > 0 ? health : 20f) + ",\"yaw\":" + num(yaw)
      + ",\"results\":[" + out + "],\"victimMotion\":[" + num(d(v, "v")) + "," + num(d(v, "w")) + "," + num(d(v, "x"))
      + "],\"attackerMotion\":[" + num(d(a, "v")) + "," + num(d(a, "x")) + "],\"crit\":" + Attacker.crit + ",\"enchantCrit\":" + Attacker.enchantCrit + ",\"attackerSprinting\":" + a.ao() + ",\"victimBurning\":" + v.al()
      + ",\"armor\":[" + MobResistProbe.armor(victim, true) + "],\"death\":" + (PlayerDamageProbe.Player.message == null ? "null" : PlayerDamageProbe.Player.message) + "}");
  }
  static int[] w(int id, int... ench) { int[] r = new int[1 + ench.length]; r[0] = id; System.arraycopy(ench, 0, r, 1, ench.length); return r; }
  static void one(String name, int[] hit, boolean sprint, boolean fall, int material, int ench, int level) throws Exception { run(name, new int[][] { hit }, sprint, fall, false, material, ench, level, 0, -90f); }
  public static void main(String[] args) throws Exception {
    PlayerDamageProbe.init();
    int[] tools = { 0, 268, 272, 267, 276, 283, 271, 258, 275, 279, 278, 257, 256, 277, 273, 269, 280 };
    for (int t : tools) { one("tool-" + t, w(t), false, false, -1, -1, 0); one("tool-" + t + "-iron", w(t), false, false, 1, -1, 0); }
    for (int lvl = 1; lvl <= 5; lvl++) one("sharp" + lvl, w(276, 16, lvl), false, false, -1, -1, 0);
    one("smite3", w(276, 17, 3), false, false, -1, -1, 0);
    one("bane3", w(276, 18, 3), false, false, -1, -1, 0);
    one("stick-sharp5", w(280, 16, 5), false, false, -1, -1, 0);
    for (int lvl = 1; lvl <= 2; lvl++) one("knockback" + lvl, w(276, 19, lvl), false, false, -1, -1, 0);
    for (int lvl = 1; lvl <= 2; lvl++) one("fireaspect" + lvl, w(276, 20, lvl), false, false, -1, -1, 0);
    one("sprint-fist", w(0), true, false, -1, -1, 0);
    one("sprint-sword", w(267), true, false, -1, -1, 0);
    one("sprint-knockback2", w(267, 19, 2), true, false, -1, -1, 0);
    one("crit-sword", w(267), false, true, -1, -1, 0);
    one("crit-fist", w(0), false, true, -1, -1, 0);
    one("crit-sharp5", w(276, 16, 5), false, true, -1, -1, 0);
    one("crit-all", w(276, 16, 5, 19, 2, 20, 2), true, true, 2, 0, 4);
    one("sword-leather", w(276), false, false, 0, -1, 0);
    one("sword-iron", w(276), false, false, 1, -1, 0);
    one("sword-diamond", w(276), false, false, 2, -1, 0);
    one("sword-diamond-prot4", w(276), false, false, 2, 0, 4);
    one("sword-iron-prot2", w(276), false, false, 1, 0, 2);
    one("sword-iron-featherfall4", w(276), false, false, 1, 2, 4);
    one("sword-iron-projectile4", w(276), false, false, 1, 4, 4);
    run("window-weaker", new int[][] { w(276), w(268) }, false, false, false, -1, -1, 0, 0, -90f);
    run("window-equal", new int[][] { w(276), w(276) }, false, false, false, -1, -1, 0, 0, -90f);
    run("window-stronger", new int[][] { w(268), w(276) }, false, false, false, -1, -1, 0, 0, -90f);
    run("window-stronger-armor", new int[][] { w(268), w(276) }, false, false, false, 1, -1, 0, 0, -90f);
    run("creative", new int[][] { w(276) }, true, false, true, -1, -1, 0, 0, -90f);
    run("lethal", new int[][] { w(276) }, false, false, false, -1, -1, 0, 3f, -90f);
    run("lethal-armor", new int[][] { w(276) }, false, false, false, 1, -1, 0, 3f, -90f);
    run("yaw30", new int[][] { w(267, 19, 1) }, true, false, false, -1, -1, 0, 0, 30f);
    run("yaw200", new int[][] { w(267, 19, 1) }, true, false, false, -1, -1, 0, 0, 200f);
  }
}
