import java.lang.reflect.Field;
import java.util.*;

// Batch 65 mpstats3: EntityLivingBase.func_94060_bK (sv.aX) = CombatTracker.func_94550_c (rn.c) with the attackingPlayer and revenge-target fallbacks, executed on the unchanged
// 1.7.10 classes (the real EntityPlayerMP as victim on the PlayerDamageProbe world double, as CombatTrackerProbe). One JSON object per scenario: a list of timed ops
//   "<tick> hit <spec> <amount>"   attackEntityFrom(DamageSource, amount) at that tick (a lethal amount ends the scenario after recording)
// spec = "kind:attacker" with kind mob/arrow/thrown/player (thrown = DamageSource.causeThrownDamage(entity, thrower): what a fishing hook uses) and attacker zombie, skeleton, alex,
// alexSword (a second player), or a plain DamageSource (onFire inFire generic). Each attacker id is one instance for the whole scenario. After every op the record holds `best`: the id of
// the entity sv.aX() returns (null for none), `entries` (CombatTracker list size) and `accepted` (attackEntityFrom's result). Entity.ticksExisted advances one per tick and CombatTracker.func_94549_h
// runs when it is a multiple of 20, as EntityLivingBase.onUpdate does.
public class CombatBestProbe {
  static sun.misc.Unsafe u;
  static final Map<String, sv> cache = new HashMap<>();

  static sv who(String id) throws Exception {
    sv a = cache.get(id);
    if (a == null) { a = CombatTrackerProbe.attacker(id); cache.put(id, a); }
    return a;
  }
  static String idOf(sv e) { for (Map.Entry<String, sv> en : cache.entrySet()) if (en.getValue() == e) return en.getKey(); return e == null ? null : "unknown"; }

  static ro source(String spec) throws Exception {
    if (!spec.contains(":")) return PlayerDamageProbe.source(spec, null);
    String[] s = spec.split(":");
    sv a = who(s[1]);
    ahb w = PlayerDamageProbe.w;
    switch (s[0]) {
      case "mob": return ro.a(a);
      case "player": return ro.a((yz) a);
      case "arrow": return ro.a(new zc(w), a);
      case "thrown": return ro.a((sa) new zo(w), a);
      default: throw new IllegalArgumentException(spec);
    }
  }

  static void scenario(String name, String... ops) throws Exception {
    cache.clear();
    sv e = PlayerDamageProbe.prepare("player", 64.5, 5.0, 64.5, PlayerDamageProbe.setup("health", 20f));
    MobMoveProbe.set(e, "b", u.allocateInstance(CombatTrackerProbe.PvpFake.class));
    Field aa = PlayerDamageProbe.fd(sv.class, "aa");
    PlayerDamageProbe.Player.message = null;
    int last = 0;
    StringBuilder hits = new StringBuilder(), opsOut = new StringBuilder();
    for (String op : ops) { opsOut.append(opsOut.length() == 0 ? "" : ",").append("\"").append(op).append("\""); last = Math.max(last, Integer.parseInt(op.split(" ")[0])); }
    boolean dead = false;
    for (int t = 0; t <= last && !dead; t++) {
      for (String op : ops) {
        String[] s = op.split(" ");
        if (Integer.parseInt(s[0]) != t) continue;
        SuffocationProbe.World.cells.clear();
        ro src = source(s[2]);
        boolean ok = e.a(src, Float.parseFloat(s[3]));
        sv best = e.aX();
        hits.append(hits.length() == 0 ? "" : ",").append("{\"tick\":").append(t).append(",\"op\":\"").append(op).append("\",\"accepted\":").append(ok)
          .append(",\"entries\":").append(((List) PlayerDamageProbe.fd(rn.class, "a").get(e.aW())).size()).append(",\"health\":").append(PlayerDamageProbe.num(e.aS()))
          .append(",\"best\":").append(best == null ? "null" : "\"" + idOf(best) + "\"").append("}");
        if (e.aS() <= 0) dead = true;
      }
      if (dead) break;
      aa.setInt(e, aa.getInt(e) + 1);
      PlayerDamageProbe.tick(e);
      if (aa.getInt(e) % 20 == 0) e.aW().g();
    }
    System.out.println("{\"case\":\"best\",\"name\":\"" + name + "\",\"ops\":[" + opsOut + "],\"hits\":[" + hits + "],\"dead\":" + dead + "}");
  }

  public static void main(String[] args) throws Exception {
    PlayerDamageProbe.init();
    u = PlayerDamageProbe.u; CombatTrackerProbe.u = u;
    // One hit; the rule works per entry (the largest single hit), not per total.
    scenario("player-only", "0 hit player:alex 3", "40 hit player:alex 4");
    scenario("player-then-zombie", "0 hit player:alex 5", "20 hit mob:zombie 2");
    scenario("zombie-big-player-small", "0 hit mob:zombie 9", "20 hit player:alex 2");
    scenario("zombie-big-player-third", "0 hit mob:zombie 9", "20 hit player:alex 3");
    scenario("zombie-big-player-third-minus", "0 hit mob:zombie 9", "20 hit player:alex 2.9");
    scenario("single-hits-not-sums", "0 hit player:alex 2", "20 hit player:alex 2", "40 hit mob:zombie 5");
    scenario("sums-would-differ", "0 hit player:alex 2", "20 hit player:alex 2", "40 hit player:alexSword 3");
    scenario("equal-first-wins", "0 hit player:alex 3", "20 hit player:alexSword 3");
    scenario("equal-first-wins-reverse", "0 hit player:alexSword 3", "20 hit player:alex 3");
    scenario("arrow-by-player", "0 hit arrow:alex 3", "20 hit mob:zombie 3");
    scenario("arrow-by-skeleton", "0 hit arrow:skeleton 3", "20 hit player:alex 1");
    scenario("window-100-plain", "0 hit generic 2", "99 hit player:alex 3", "230 hit player:alexSword 2");
    scenario("window-300-after-living", "0 hit mob:zombie 2", "150 hit player:alex 3", "280 hit generic 2", "590 hit generic 1");
    scenario("reset-after-300", "0 hit mob:zombie 2", "340 hit player:alex 3");
    scenario("zombie-then-quiet-100", "0 hit mob:zombie 2", "130 hit generic 2");
    // Lethal hits: the dying hit's CombatTracker.func_94547_a runs func_94549_h while dead, which empties the list first.
    scenario("lethal-by-player", "0 hit mob:zombie 4", "20 hit player:alex 40");
    scenario("lethal-by-zombie-after-player", "0 hit player:alex 3", "40 hit mob:zombie 40");
    scenario("lethal-by-fire-after-player", "0 hit player:alex 3", "40 hit onFire 40");
    scenario("lethal-by-fire-after-player-late", "0 hit player:alex 3", "150 hit onFire 40");
    scenario("lethal-by-fire-after-zombie-and-player", "0 hit mob:zombie 3", "20 hit player:alex 3", "60 hit inFire 40");
    scenario("lethal-by-fire-after-zombie-only", "0 hit mob:zombie 3", "60 hit inFire 40");
    scenario("lethal-arrow-skeleton-after-player", "0 hit player:alex 3", "40 hit arrow:skeleton 40");
    // A fishing hook: EntityFishHook calls attackEntityFrom(causeThrownDamage(hook, angler), 0). A player takes nothing and refuses it (EntityPlayer.attackEntityFrom returns false at amount 0).
    scenario("hook-zero", "0 hit thrown:alex 0");
    scenario("thrown-one", "0 hit thrown:alex 1");
  }
}
