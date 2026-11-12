import java.lang.reflect.Field;
import java.util.*;

// Batch 51 (mobvictims, tag b51mv): the skeleton (yl), the wither skeleton (yl type 1), the zombie pigman (yh) and the wither (xc) as victims of the same DamageSources as
// b50mr (MobResistProbe), run through the unchanged attackEntityFrom (sv.a / yg.a / yq.a / yh.a / xc.a). Each record keeps health, absorption, the hurt window
// (hurtResistantTime, hurtTime, lastDamage), the revenge or anger state (pigman: angerLevel bs, randomSoundDelay bt, the target; wither: Invul via ca(), the block-break
// cooldown bv and the head cooldowns bu) and, for the pigman, which of its neighbours were angered by a player's hit (the 32 block call).
public class MobVictimProbe {
  static String num(float v) { return Float.toString(v); }
  static final String[] SOURCES = MobResistProbe.SOURCES;
  static int cases = 0;
  static final Field ANGER, SOUND, TARGET;
  static { try { ANGER = PlayerDamageProbe.fd(yh.class, "bs"); SOUND = PlayerDamageProbe.fd(yh.class, "bt"); TARGET = MobMoveProbe.field(td.class, "bm"); } catch (Exception x) { throw new RuntimeException(x); } }
  static sv make(String kind) throws Exception {
    if (kind.equals("skeleton")) return new yl(PlayerDamageProbe.w);
    if (kind.equals("witherSkeleton")) { yl e = new yl(PlayerDamageProbe.w); e.a(1); return e; }
    if (kind.equals("pigman")) return new yh(PlayerDamageProbe.w);
    return new xc(PlayerDamageProbe.w);
  }
  static sv place(String kind, double x, double z) throws Exception {
    PlayerDamageProbe.World.cells.clear();
    sv e = make(kind);
    PlayerDamageProbe.pos(e, x, 5.0, z);
    MobMoveProbe.set(e, "Z", new Random(7));
    return e;
  }
  static String who(sa t, sa attacker, sa player) { return t == null ? "none" : t == attacker ? "attacker" : t == player ? "player" : "other"; }
  static String state(sv e, String kind, sa attacker, sa player) throws Exception {
    StringBuilder s = new StringBuilder();
    s.append("\"health\":").append(num(e.aS())).append(",\"absorbed\":").append(num(e.bs())).append(",\"resist\":").append(PlayerDamageProbe.hr.getInt(e))
      .append(",\"hurtTime\":").append(PlayerDamageProbe.ht.getInt(e)).append(",\"last\":").append(num(PlayerDamageProbe.ld.getFloat(e)))
      .append(",\"revenge\":\"").append(who(e.aJ(), attacker, player)).append("\",\"target\":\"").append(who((sa) TARGET.get(e), attacker, player)).append("\"");
    if (kind.equals("pigman")) s.append(",\"anger\":").append(ANGER.getInt(e) > 0 ? 1 : 0).append(",\"angerLevel\":").append(ANGER.getInt(e)).append(",\"soundDelay\":").append(SOUND.getInt(e));
    if (kind.equals("wither")) {
      xc w = (xc) e; int[] bu = (int[]) PlayerDamageProbe.fd(xc.class, "bu").get(e);
      s.append(",\"invul\":").append(w.ca()).append(",\"armored\":").append(w.cb()).append(",\"bv\":").append(PlayerDamageProbe.fd(xc.class, "bv").getInt(e)).append(",\"bu\":[").append(bu[0]).append(",").append(bu[1]).append("]");
    }
    return s.toString();
  }
  static void gear(sv e, int material, int ench, int level) throws Exception { if (material >= 0) MobResistProbe.wearZombie(e, material, ench, level); }
  static ro source(String src, sv attacker, yz other) throws Exception {
    return MobResistProbe.source(src, attacker, other);
  }
  static sv attackerFor(String name) throws Exception {
    sv a = name.equals("spider") ? new yn(PlayerDamageProbe.w) : new yq(PlayerDamageProbe.w);
    PlayerDamageProbe.pos(a, 66.5, 5.0, 64.5);
    return a;
  }
  // hits: "source:amount" pairs applied one after the other with no tick between them.
  static void run(String kind, String name, int material, int ench, int level, int resistance, float absorption, float health, int invul, String attackerKind, String... hits) throws Exception {
    sv e = place(kind, 64.5, 64.5);
    gear(e, material, ench, level);
    if (resistance >= 0) ((HashMap) PlayerDamageProbe.fd(sv.class, "f").get(e)).put(Integer.valueOf(11), new rw(11, 1000, resistance));
    if (absorption > 0) e.m(absorption);
    if (health >= 0) e.g(health);
    if (invul >= 0) ((xc) e).s(invul);
    sv attacker = attackerFor(attackerKind);
    yz other = (yz) PlayerDamageProbe.make("player"); PlayerDamageProbe.pos(other, 66.5, 5.0, 64.5);
    long seed = 51_000L + cases++;
    ((Random) ArmorEnchantmentProbe.helperRandom()).setSeed(seed);
    MobMoveProbe.set(PlayerDamageProbe.w, "s", new Random(9));
    StringBuilder steps = new StringBuilder();
    for (String hit : hits) {
      String[] p = hit.split(":");
      boolean ok = e.a(source(p[0], attacker, other), Float.parseFloat(p[1]));
      steps.append(steps.length() == 0 ? "" : ",").append("{\"source\":\"").append(p[0]).append("\",\"amount\":").append(p[1]).append(",\"accepted\":").append(ok).append(",").append(state(e, kind, attacker, other)).append("}");
    }
    System.out.println("{\"victim\":\"" + kind + "\",\"case\":\"" + name + "\",\"attacker\":\"" + attackerKind + "\",\"material\":" + material + ",\"ench\":" + ench + ",\"level\":" + level
      + ",\"resistance\":" + resistance + ",\"absorption\":" + num(absorption) + ",\"startHealth\":" + num(health) + ",\"startInvul\":" + invul + ",\"seed\":\"" + seed + "\",\"steps\":[" + steps + "]}");
  }
  static void loadouts(String kind, String src, float amount, String attackerKind) throws Exception {
    String hit = src + ":" + amount;
    run(kind, "bare", -1, -1, 0, -1, 0, -1, -1, attackerKind, hit);
    run(kind, "iron", 1, -1, 0, -1, 0, -1, -1, attackerKind, hit);
    run(kind, "diamond-prot4", 2, 0, 4, -1, 0, -1, -1, attackerKind, hit);
    run(kind, "bare-resist1", -1, -1, 0, 1, 0, -1, -1, attackerKind, hit);
    run(kind, "bare-absorb4", -1, -1, 0, -1, 4.0f, -1, -1, attackerKind, hit);
    run(kind, "all", 1, 0, 3, 1, 3.0f, -1, -1, attackerKind, hit);
  }
  // The pigman's call for help: the hit player angers every pigman within 32 blocks, the hit pigman included; a mob attacker angers none.
  static void group(String name, String src, float amount, String... extraAt) throws Exception {
    PlayerDamageProbe.World.cells.clear();
    yh e = (yh) place("pigman", 64.5, 64.5);
    List<sa> near = new ArrayList<>();
    for (String at : extraAt) { String[] c = at.split(","); yh o = (yh) place("pigman", Double.parseDouble(c[0]), Double.parseDouble(c[1])); near.add(o); }
    near.add(e);
    PlayerDamageProbe.World.near = near;
    sv attacker = attackerFor("zombie");
    yz other = (yz) PlayerDamageProbe.make("player"); PlayerDamageProbe.pos(other, 66.5, 5.0, 64.5);
    MobMoveProbe.set(PlayerDamageProbe.w, "s", new Random(9));
    boolean ok = e.a(source(src, attacker, other), amount);
    StringBuilder others = new StringBuilder();
    for (int i = 0; i < near.size() - 1; i++) { yh o = (yh) near.get(i); others.append(i == 0 ? "" : ",").append("{\"angerLevel\":").append(ANGER.getInt(o)).append(",\"target\":\"").append(who((sa) TARGET.get(o), attacker, other)).append("\"}"); }
    PlayerDamageProbe.World.near = null;
    System.out.println("{\"victim\":\"pigman-group\",\"case\":\"" + name + "\",\"source\":\"" + src + "\",\"amount\":" + num(amount) + ",\"extra\":" + Arrays.toString(extraAt).replace("[", "[\"").replace("]", "\"]").replace(", ", "\",\"") + ",\"accepted\":" + ok
      + ",\"self\":{" + state(e, "pigman", attacker, other) + "},\"others\":[" + others + "]}");
  }
  // Batch 52 (mobexport, tag b52me): Entity.onStruckByLightning (sa.a(xh): dealFireDamage(5), ++fire, setFire(8) at 0) on fire-immune and ordinary mobs from several fire counters, with and
  // without Fire Protection IV armour (EnchantmentProtection.getFireTimeForEntity). The bolt is an unconstructed xh (the method ignores its argument).
  static final Field FIRE, IMMUNE;
  static { try { FIRE = MobMoveProbe.field(sa.class, "e"); IMMUNE = MobMoveProbe.field(sa.class, "ae"); } catch (Exception x) { throw new RuntimeException(x); } }
  static void bolt(String kind, int fire, int material, int ench, int level) throws Exception {
    PlayerDamageProbe.World.cells.clear();
    sv e = kind.equals("zombie") ? new yq(PlayerDamageProbe.w) : kind.equals("magma_cube") ? (sv) sg.a("LavaSlime", PlayerDamageProbe.w) : make(kind);
    PlayerDamageProbe.pos(e, 64.5, 5.0, 64.5);
    gear(e, material, ench, level);
    FIRE.setInt(e, fire);
    float before = e.aS();
    e.a((xh) PlayerDamageProbe.u.allocateInstance(xh.class));
    System.out.println("{\"victim\":\"bolt\",\"kind\":\"" + kind + "\",\"start\":" + fire + ",\"material\":" + material + ",\"ench\":" + ench + ",\"level\":" + level
      + ",\"fire\":" + FIRE.getInt(e) + ",\"health\":" + num(e.aS()) + ",\"before\":" + num(before) + ",\"immune\":" + IMMUNE.getBoolean(e) + "}");
  }
  // A pigman hit by an arrow: the shooter is a player (ro.a(arrow, player), DamageSource.causeArrowDamage) or a mob; the hit player's call angers every pigman within 32 blocks.
  static void arrowGroup(String name, boolean playerShooter, String... extraAt) throws Exception {
    PlayerDamageProbe.World.cells.clear();
    yh e = (yh) place("pigman", 64.5, 64.5);
    List<sa> near = new ArrayList<>();
    for (String at : extraAt) { String[] c = at.split(","); near.add((yh) place("pigman", Double.parseDouble(c[0]), Double.parseDouble(c[1]))); }
    near.add(e);
    PlayerDamageProbe.World.near = near;
    sv attacker = attackerFor("zombie");
    yz other = (yz) PlayerDamageProbe.make("player"); PlayerDamageProbe.pos(other, 66.5, 5.0, 64.5);
    MobMoveProbe.set(PlayerDamageProbe.w, "s", new Random(9));
    boolean ok = e.a(ro.a((zc) PlayerDamageProbe.u.allocateInstance(zc.class), playerShooter ? (sa) other : (sa) attacker), 4.0f);
    StringBuilder others = new StringBuilder();
    for (int i = 0; i < near.size() - 1; i++) { yh o = (yh) near.get(i); others.append(i == 0 ? "" : ",").append("{\"angerLevel\":").append(ANGER.getInt(o)).append(",\"target\":\"").append(who((sa) TARGET.get(o), attacker, other)).append("\"}"); }
    PlayerDamageProbe.World.near = null;
    System.out.println("{\"victim\":\"pigman-arrow\",\"case\":\"" + name + "\",\"shooter\":\"" + (playerShooter ? "player" : "mob") + "\",\"neighbours\":" + extraAt.length + ",\"accepted\":" + ok
      + ",\"self\":{" + state(e, "pigman", attacker, other) + "},\"others\":[" + others + "]}");
  }
  public static void main(String[] args) throws Exception {
    PlayerDamageProbe.init();
    for (String kind : new String[] { "skeleton", "witherSkeleton", "pigman" })
      for (String src : SOURCES) for (float amount : new float[] { 1.0f, 6.0f }) loadouts(kind, src, amount, "zombie");
    // The wither: its own spawn phase, the armoured half, and the undead / non-undead attacker rule.
    String[] witherSources = new String[SOURCES.length + 1];
    System.arraycopy(SOURCES, 0, witherSources, 0, SOURCES.length); witherSources[SOURCES.length] = "mobSpider";
    float[][] states = { { 100.0f, 220 }, { 300.0f, 1 }, { 300.0f, 0 }, { 151.0f, 0 }, { 150.0f, 0 }, { 20.0f, 0 } };
    for (String src : witherSources) for (float amount : new float[] { 1.0f, 6.0f, 40.0f }) for (float[] st : states) {
      String s = src.equals("mobSpider") ? "mob" : src, a = src.equals("mobSpider") ? "spider" : "zombie";
      run("wither", "state-" + (int) st[0] + "-" + (int) st[1], -1, -1, 0, -1, 0, st[0], (int) st[1], a, s + ":" + amount);
      if (st[1] == 0 && st[0] >= 150) { run("wither", "absorb4-" + (int) st[0], -1, -1, 0, -1, 4.0f, st[0], 0, a, s + ":" + amount); run("wither", "iron-" + (int) st[0], 1, -1, 0, -1, 0, st[0], 0, a, s + ":" + amount); }
    }
    // Two hits in the hurt window: only the excess counts, the second lands as a top-up.
    String[][] pairs = { { "generic:3", "generic:5" }, { "generic:5", "generic:3" }, { "player:5", "player:5" }, { "arrow:4", "generic:6" }, { "mob:4", "player:7" }, { "magic:2", "fall:6" } };
    for (String kind : new String[] { "skeleton", "witherSkeleton", "pigman" }) for (String[] pr : pairs) run(kind, "window", -1, -1, 0, -1, 0, -1, -1, "zombie", pr);
    for (String[] pr : pairs) { run("wither", "window-300", -1, -1, 0, -1, 0, 300.0f, 0, "zombie", pr); run("wither", "window-150", -1, -1, 0, -1, 0, 150.0f, 0, "zombie", pr); }
    // Pigman anger: a player's hit sets it and calls every pigman within 32 blocks, a mob's hit does not; a refused hit (invulnerable) never gets that far.
    for (String src : new String[] { "player", "mob", "arrow", "generic", "fall" }) {
      group("alone", src, 4.0f);
      group("neighbours", src, 4.0f, "70.5,64.5", "64.5,95.5", "64.5,100.5", "100.5,64.5");
    }
    // A pigman or wither skeleton at 1 health: the killing hit.
    for (String kind : new String[] { "skeleton", "witherSkeleton", "pigman" }) for (String src : new String[] { "player", "mob", "generic", "fire" }) if (!src.equals("fire")) run(kind, "kill-1hp", -1, -1, 0, -1, 0, 1.0f, -1, "zombie", src + ":6.0");
    // Batch 52: lightning on fire-immune and ordinary mobs, and a pigman shot by a player's arrow.
    for (String kind : new String[] { "zombie", "pigman", "witherSkeleton", "wither", "magma_cube", "skeleton" })
      for (int fire : new int[] { -1, 0, 1, 5, 19, 160 }) {
        bolt(kind, fire, -1, -1, 0);
        if (kind.equals("zombie") || kind.equals("pigman") || kind.equals("skeleton")) bolt(kind, fire, 2, 1, 4);
      }
    for (boolean player : new boolean[] { true, false }) {
      arrowGroup("alone", player);
      arrowGroup("neighbours", player, "70.5,64.5", "64.5,95.5", "64.5,100.5", "100.5,64.5");
    }
  }
}
