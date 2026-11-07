import java.lang.reflect.Field;
import java.util.*;

// CombatTracker (rn) and DamageSource.func_151519_b (ro.b) of the unchanged 1.7.10 classes, executed on the real EntityPlayerMP (mw) in the
// PlayerDamageProbe world double (Normal difficulty). One JSON object per scenario: a list of timed ops
//   "<tick> hit <spec> <amount>"      attackEntityFrom(DamageSource, amount) on the player at that tick
//   "<tick> fall <distance> <amount>" Entity.fallDistance (sv.R) set, then attackEntityFrom(DamageSource.fall, amount), then fallDistance 0
//   "<tick> R <distance>"             fallDistance set persistently (a hit taken while falling)
//   "<tick> env <none|ladder|vine|water>"  the cell at the feet is a ladder / vine, or Entity.inWater (sa.ac) is set
// A spec is a plain DamageSource (inFire onFire lava inWall drown starve cactus fall outOfWorld generic magic wither anvil fallingBlock) or
// "kind:attacker" with kind mob/arrow/fireball/explosion/indirectMagic/thrown/thorns/player and attacker zombie, zombieBob (custom name),
// zombieSword (holds a renamed item), skeleton, skeletonBow (renamed bow), ghast, creeper, witch, alex/alexSword (a second player), self (the victim) or null.
// Entity.ticksExisted (sv.aa) advances one per tick and CombatTracker.func_94549_h runs when it is a multiple of 20, as EntityLivingBase.onUpdate does.
// After every hit the real func_151521_b is recorded ("preview"); a fatal hit also records what EntityPlayerMP.onDeath broadcasts ("message").
public class CombatTrackerProbe {
  // The server double of PlayerDamageProbe answers isPVPEnabled (ab) false; a player attacker needs it true.
  public static class PvpFake extends SuffocationProbe.Fake { public boolean ab() { return true; } }

  static sun.misc.Unsafe u;
  static final int FX = 64, FY = 5, FZ = 64;

  static sv attacker(String id) throws Exception {
    sv a;
    switch (id) {
      case "zombie": case "zombieBob": case "zombieSword": a = new yq(PlayerDamageProbe.w); break;
      case "skeleton": case "skeletonBow": a = new yl(PlayerDamageProbe.w); break;
      case "ghast": a = new yd(PlayerDamageProbe.w); break;
      case "creeper": a = new xz(PlayerDamageProbe.w); break;
      case "witch": a = new yp(PlayerDamageProbe.w); break;
      case "wolf": case "wolfBob": case "wolfTamed": case "wolfTamedBob": a = new wv(PlayerDamageProbe.w); break;
      case "alex": case "alexSword":
        a = PlayerDamageProbe.make("player");
        u.putObject(a, u.objectFieldOffset(PlayerDamageProbe.fd(yz.class, "i")), new com.mojang.authlib.GameProfile(new UUID(0, 2), "Alex"));
        break;
      default: throw new IllegalArgumentException(id);
    }
    PlayerDamageProbe.pos(a, 66.5, 5.0, 64.5);
    if (id.equals("zombieBob") || id.equals("wolfBob") || id.equals("wolfTamedBob")) ((sw) a).a("Bob");
    if (id.startsWith("wolfTamed")) { ((wv) a).j(true); ((wv) a).b("Alex"); }
    if (id.equals("zombieSword")) a.c(0, new add(adb.d(276), 1, 0).c("Sting"));
    // A player's held stack is InventoryPlayer.getCurrentItem (bm.a[bm.c]); setCurrentItemOrArmor(0, ...) does not reach it on this double.
    if (id.equals("alexSword")) ((yz) a).bm.a[((yz) a).bm.c] = new add(adb.d(276), 1, 0).c("Sting");
    if (id.equals("skeletonBow")) a.c(0, new add(adb.d(261), 1, 0).c("Bow of Doom"));
    return a;
  }

  static ro source(String spec, sv victim) throws Exception {
    switch (spec) {
      case "magic": return ro.k;
      case "wither": return ro.l;
      case "anvil": return ro.m;
      case "fallingBlock": return ro.n;
      default: if (!spec.contains(":")) return PlayerDamageProbe.source(spec, null);
    }
    String[] s = spec.split(":");
    sv who = s[1].equals("null") ? null : s[1].equals("self") ? victim : attacker(s[1]);
    ahb w = PlayerDamageProbe.w;
    switch (s[0]) {
      case "mob": return ro.a(who);
      case "player": return ro.a((yz) who);
      case "arrow": return ro.a(new zc(w), who);
      case "fireball": return ro.a(new zi(w), who);
      case "indirectMagic": return ro.b(new zo(w), who);
      case "thrown": return ro.a((sa) new zo(w), who);
      case "thorns": return ro.a((sa) who); // DamageSource.causeThornsDamage(Entity): ro.a(sa); a bare sv argument would pick causeMobDamage ro.a(sv)
      case "explosion": return ro.a(new agw(w, who, 64.5, 5.0, 64.5, 3.0f));
      default: throw new IllegalArgumentException(spec);
    }
  }

  static void scenario(String name, float health, String... ops) throws Exception {
    sv e = PlayerDamageProbe.prepare("player", 64.5, 5.0, 64.5, PlayerDamageProbe.setup("health", health));
    MobMoveProbe.set(e, "b", u.allocateInstance(PvpFake.class));
    Field aa = PlayerDamageProbe.fd(sv.class, "aa"), fall = PlayerDamageProbe.fd(sa.class, "R"), water = PlayerDamageProbe.fd(sa.class, "ac");
    PlayerDamageProbe.Player.message = null;
    int deadAt = -1, last = 0;
    String env = "none";
    StringBuilder hits = new StringBuilder(), opsOut = new StringBuilder();
    for (String op : ops) {
      opsOut.append(opsOut.length() == 0 ? "" : ",").append("\"").append(op).append("\"");
      last = Math.max(last, Integer.parseInt(op.split(" ")[0]));
    }
    for (int t = 0; t <= last; t++) {
      for (String op : ops) {
        String[] s = op.split(" ");
        if (Integer.parseInt(s[0]) != t) continue;
        if (s[1].equals("env")) { env = s[2]; continue; }
        if (s[1].equals("R")) { fall.setFloat(e, Float.parseFloat(s[2])); continue; }
        SuffocationProbe.World.cells.clear();
        if (env.equals("ladder")) SuffocationProbe.World.cells.put(SuffocationProbe.World.key(FX, FY, FZ), 65);
        if (env.equals("vine")) SuffocationProbe.World.cells.put(SuffocationProbe.World.key(FX, FY, FZ), 106);
        water.setBoolean(e, env.equals("water"));
        boolean isFall = s[1].equals("fall");
        if (isFall) fall.setFloat(e, Float.parseFloat(s[2]));
        ro src = isFall ? ro.h : source(s[2], e);
        float amount = Float.parseFloat(s[3]);
        PlayerDamageProbe.World.events.clear();
        boolean ok = e.a(src, amount);
        if (isFall) fall.setFloat(e, 0f);
        hits.append(hits.length() == 0 ? "" : ",").append("{\"tick\":").append(t).append(",\"op\":\"").append(op).append("\",\"accepted\":").append(ok)
          .append(",\"entries\":").append(((List) PlayerDamageProbe.fd(rn.class, "a").get(e.aW())).size()).append(",\"health\":").append(PlayerDamageProbe.num(e.aS())).append(",\"preview\":").append(PlayerDamageProbe.chat(e.aW().b())).append("}");
        if (e.aS() <= 0 && deadAt < 0) deadAt = t;
      }
      if (deadAt >= 0) break;
      // World.updateEntityWithOptionalForce: ++ticksExisted, then the update; EntityLivingBase.onEntityUpdate (sv.C, run by PlayerDamageProbe.tick)
      // expires the revenge target (field i: dead, or ticksExisted - revengeTimer > 100) and the attacking player (field aR with aS recently-hit ticks).
      aa.setInt(e, aa.getInt(e) + 1);
      PlayerDamageProbe.tick(e);
      if (aa.getInt(e) % 20 == 0) e.aW().g();
    }
    System.out.println("{\"case\":\"combat\",\"name\":\"" + name + "\",\"health\":" + PlayerDamageProbe.num(health) + ",\"ops\":[" + opsOut + "],\"hits\":[" + hits + "],\"aaEnd\":" + aa.getInt(e) + ",\"deadAt\":" + deadAt
      + ",\"message\":" + (PlayerDamageProbe.Player.message == null ? "null" : PlayerDamageProbe.Player.message) + "}");
  }

  // Runs the ops twice, the last hit being fatal (amount 20, what a death shows) and then non-fatal (amount 3, the func_151521_b state a
  // non-fatal hit leaves). "A" in an op is the amount. A fatal hit calls CombatTracker.func_94549_h while dead, which empties the list first.
  static void both(String name, String... ops) throws Exception {
    for (int k = 0; k < 2; k++) {
      String[] o = new String[ops.length];
      for (int j = 0; j < ops.length; j++) o[j] = ops[j].replace(" A", k == 0 ? " 20" : " 3");
      scenario(name + (k == 0 ? "-fatal" : "-soft"), 20f, o);
    }
  }


  // EntityFallingBlock.fall(float) (xj.b), executed natively against a world double whose entity query returns the real EntityPlayerMP:
  // the damage dealt (min(floor(ceil(distance - 1) * fallHurtAmount), fallHurtMax)), DamageSource.anvil for an anvil and fallingBlock for
  // another block, the helmet rule of EntityLivingBase.attackEntityFrom, and the death message. `helmet` wears a leather helmet.
  static class FallWorld extends ahb {
    List<sa> targets = Collections.emptyList();
    FallWorld() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    protected apu j() { return null; } protected int p() { return 0; }
    public sa a(int id) { return null; }
    public aji a(int x, int y, int z) { return aji.e(0); }
    public int e(int x, int y, int z) { return 0; }
    public List a(sa self, azt bounds) { return targets; }
    public List b(sa self, azt bounds) { return targets; }
  }
  static void falling(String name, int blockId, boolean hurtFlag, float distance, float amount, int max, boolean helmet, float health) throws Exception {
    sv e = PlayerDamageProbe.prepare("player", 64.5, 5.0, 64.5, PlayerDamageProbe.setup("health", health));
    MobMoveProbe.set(e, "b", u.allocateInstance(PvpFake.class));
    PlayerDamageProbe.Player.message = null;
    add cap = null;
    if (helmet) { cap = new add(adb.d(298), 1, 0); ((yz) e).bm.b[3] = cap; }
    FallWorld fw = (FallWorld) u.allocateInstance(FallWorld.class);
    fw.targets = Collections.singletonList((sa) e);
    xj x = (xj) u.allocateInstance(xj.class);
    aji block = aji.e(blockId);
    PlayerDamageProbe.fd(sa.class, "o").set(x, fw);
    PlayerDamageProbe.fd(xj.class, "e").set(x, block);
    PlayerDamageProbe.fd(xj.class, "g").setBoolean(x, hurtFlag);
    PlayerDamageProbe.fd(xj.class, "h").setInt(x, max);
    PlayerDamageProbe.fd(xj.class, "i").setFloat(x, amount);
    PlayerDamageProbe.fd(sa.class, "Z").set(x, new Random(3));
    java.lang.reflect.Method fall = xj.class.getDeclaredMethod("b", float.class);
    fall.setAccessible(true);
    float before = e.aS();
    PlayerDamageProbe.World.events.clear();
    fall.invoke(x, distance);
    System.out.println("{\"case\":\"fallingBlock\",\"name\":\"" + name + "\",\"block\":" + blockId + ",\"hurtFlag\":" + hurtFlag + ",\"distance\":" + PlayerDamageProbe.num(distance)
      + ",\"amount\":" + PlayerDamageProbe.num(amount) + ",\"max\":" + max + ",\"helmet\":" + helmet + ",\"health\":" + PlayerDamageProbe.num(health)
      + ",\"healthAfter\":" + PlayerDamageProbe.num(e.aS()) + ",\"entries\":" + ((List) PlayerDamageProbe.fd(rn.class, "a").get(e.aW())).size()
      + ",\"helmetWear\":" + (cap == null ? 0 : cap.k()) + ",\"preview\":" + (((List) PlayerDamageProbe.fd(rn.class, "a").get(e.aW())).isEmpty() ? "null" : PlayerDamageProbe.chat(e.aW().b()))
      + ",\"message\":" + (PlayerDamageProbe.Player.message == null ? "null" : PlayerDamageProbe.Player.message) + "}");
  }

  public static void main(String[] args) throws Exception {
    PlayerDamageProbe.init();
    u = PlayerDamageProbe.u;
    // EntityFallingBlock.fall: anvil (145) and a plain block (12 sand with HurtEntities) over distances, amounts, caps, with and without a helmet.
    for (int block : new int[] { 145, 12 }) for (float d : new float[] { 0.5f, 1f, 1.5f, 2f, 3f, 5.25f, 12f, 40f }) {
      falling("fb-default", block, true, d, 2f, 40, false, 20f);
      falling("fb-default-helmet", block, true, d, 2f, 40, true, 20f);
      falling("fb-cap", block, true, d, 2f, 6, false, 20f);
      falling("fb-amount", block, true, d, 0.5f, 40, false, 20f);
      falling("fb-lethal", block, true, d, 2f, 40, false, 3f);
      falling("fb-no-hurt", block, false, d, 2f, 40, false, 20f);
    }
    String[] simple = { "inFire", "onFire", "lava", "inWall", "drown", "starve", "cactus", "fall", "outOfWorld", "generic", "magic", "wither", "anvil", "fallingBlock" };
    for (String s : simple) {
      both("alone-" + s, "0 hit " + s + " A");
      both("after-zombie-" + s, "0 hit mob:zombie 2", "12 hit " + s + " A");
      both("after-zombie-late-" + s, "0 hit mob:zombie 2", "150 hit " + s + " A");
      both("after-zombie-reset-" + s, "0 hit mob:zombie 2", "330 hit " + s + " A");
      both("after-generic-" + s, "0 hit generic 2", "12 hit " + s + " A");
    }
    // Attacker sources.
    String[] attackers = { "mob:zombie", "mob:zombieBob", "mob:zombieSword", "mob:skeleton", "player:alex", "player:alexSword", "arrow:skeleton", "arrow:skeletonBow",
      "arrow:zombieSword", "arrow:null", "arrow:self", "fireball:ghast", "fireball:zombieSword", "fireball:null", "explosion:creeper", "explosion:null",
      "indirectMagic:witch", "indirectMagic:zombieSword", "indirectMagic:null", "thrown:skeleton", "thrown:skeletonBow", "thrown:null", "thorns:zombie", "thorns:zombieBob", "thorns:zombieSword", "thorns:skeletonBow", "thorns:alex", "thorns:alexSword",
      "mob:alexSword", "mob:skeletonBow", "mob:wolf", "mob:wolfBob", "mob:wolfTamed", "mob:wolfTamedBob", "fireball:alexSword", "arrow:alexSword" };
    for (String a : attackers) both("attack-" + a.replace(':', '-'), "0 hit " + a + " A");
    // Fall variants: the fall entry's distance must exceed 5 for any death.fell message.
    for (String env : new String[] { "none", "ladder", "vine", "water" }) {
      both("fall-" + env, "0 env " + env, "0 fall 8 A");
      both("fall-short-" + env, "0 env " + env, "0 fall 4 A");
      both("fall-edge-" + env, "0 env " + env, "0 fall 5 A");
      both("fall-edge-over-" + env, "0 env " + env, "0 fall 5.5 A");
      both("fall-after-zombie-" + env, "0 env " + env, "0 hit mob:zombie 2", "12 env none", "12 fall 8 A");
      both("fall-after-generic-" + env, "0 env " + env, "0 hit generic 2", "12 env none", "12 fall 8 A");
      both("fall-after-zombie-same-" + env, "0 env " + env, "0 hit mob:zombie 2", "12 fall 8 A");
    }
    both("fall-assist-item", "0 hit mob:zombieSword 2", "12 fall 8 A");
    both("fall-assist-skeleton-bow", "0 hit arrow:skeletonBow 2", "12 fall 8 A");
    both("fall-assist-skeleton-plain", "0 hit arrow:skeleton 2", "12 fall 8 A");
    both("fall-assist-arrow-null", "0 hit arrow:null 2", "12 fall 8 A");
    both("fall-assist-self-arrow", "0 hit arrow:self 2", "12 fall 8 A");
    both("fall-assist-explosion", "0 hit explosion:creeper 2", "12 fall 8 A");
    both("fall-assist-explosion-null", "0 hit explosion:null 2", "12 fall 8 A");
    both("fall-assist-player", "0 hit player:alexSword 2", "12 fall 8 A");
    both("fall-assist-fireball-null", "0 hit fireball:null 2", "12 fall 8 A");
    both("fall-assist-thrown", "0 hit thrown:skeletonBow 2", "12 fall 8 A");
    both("fall-assist-magic", "0 hit magic 2", "12 fall 8 A");
    both("fall-after-cactus", "0 hit cactus 2", "12 fall 8 A");
    both("fall-after-lava", "0 hit lava 2", "12 fall 8 A");
    both("fall-late-zombie", "0 hit mob:zombie 2", "150 fall 8 A");
    both("fall-reset-zombie", "0 hit mob:zombie 2", "330 fall 8 A");
    both("fall-two-falls", "0 env ladder", "0 fall 6 2", "12 env vine", "12 fall 9 2", "24 env none", "24 fall 7 A");
    both("fall-two-falls-small-last", "0 env ladder", "0 fall 9 2", "12 env vine", "12 fall 6 A");
    both("fall-hit-while-falling", "0 R 7", "0 hit mob:zombie 2", "12 R 0", "12 fall 3 A");
    both("fall-then-oow", "0 fall 8 2", "12 hit outOfWorld A");
    both("oow-after-zombie", "0 hit mob:zombie 2", "12 hit outOfWorld A");
    both("oow-then-fall", "0 hit outOfWorld 2", "12 fall 8 A");
    both("oow-then-zombie-then-fall", "0 hit outOfWorld 2", "12 hit mob:zombie 2", "24 fall 8 A");
    both("fall-two-hits-before", "0 hit mob:zombie 2", "12 hit cactus 2", "24 fall 8 A");
    // Thorns: the victim of DamageSource.causeThornsDamage(wearer) is the one that hit the wearer; it assists a fall like any entity source.
    both("fall-assist-thorns", "0 hit thorns:zombie 2", "12 fall 8 A");
    both("fall-assist-thorns-sword", "0 hit thorns:zombieSword 2", "12 fall 8 A");
    both("revenge-thorns", "0 hit thorns:zombie 2", "50 hit lava A");
    both("killer-thorns-largest", "0 hit mob:skeleton 2", "12 hit thorns:zombie 5", "24 hit cactus A");
    // Wolves: a wolf is a normal living source entity, its name the EntityList name or the custom name; ownership changes nothing.
    both("revenge-wolf", "0 hit mob:wolf 2", "50 hit lava A");
    both("revenge-wolf-tamed-bob", "0 hit mob:wolfTamedBob 2", "50 hit drown A");
    both("fall-assist-wolf-tamed", "0 hit mob:wolfTamed 2", "12 fall 8 A");
    both("fall-assist-sword-mob", "0 hit mob:zombieSword 2", "12 fall 8 A");
    both("fall-assist-player-sword", "0 hit player:alexSword 2", "12 fall 8 A");
    // Fall distance 0 (an ender pearl sets fallDistance 0 and then deals DamageSource.fall 5.0), alone and after other hits, per fall site.
    for (String env : new String[] { "none", "ladder", "vine", "water" }) {
      both("pearl-fall-" + env, "0 env " + env, "0 fall 0 A");
      both("pearl-fall-after-fall-" + env, "0 env none", "0 fall 8 2", "12 env " + env, "12 fall 0 A");
      both("pearl-fall-after-zombie-" + env, "0 env " + env, "0 hit mob:zombie 2", "12 fall 0 A");
    }
    both("pearl-fall-5", "0 fall 0 5");
    // A vehicle's fall reaches the rider as EntityLivingBase.fall with the rider's own Entity.fallDistance (R) left alone: a rider that
    // never fell has 0, one that mounted while falling keeps its value.
    both("rider-fall-own-zero", "0 R 0", "0 hit fall A");
    both("rider-fall-own-kept", "0 R 7", "0 hit fall A");
    both("rider-fall-own-kept-after-zombie", "0 R 7", "0 hit mob:zombie 2", "12 hit fall A");
    both("rider-fall-own-kept-ladder", "0 env ladder", "0 R 7", "0 hit fall A");
    // The fighting entity: the largest damage dealer, a player when it did at least a third of the living maximum.
    both("killer-largest", "0 hit mob:zombie 2", "12 hit mob:skeleton 5", "24 hit lava A");
    both("killer-first-larger", "0 hit mob:zombie 5", "12 hit mob:skeleton 2", "24 hit lava A");
    both("killer-tie", "0 hit mob:zombie 3", "12 hit mob:skeleton 3", "24 hit lava A");
    both("killer-player-third", "0 hit mob:zombie 6", "12 hit player:alex 2", "24 hit lava A");
    both("killer-player-under-third", "0 hit mob:zombie 6", "12 hit player:alex 1.5", "24 hit lava A");
    both("killer-player-only", "0 hit player:alex 1", "12 hit drown A");
    both("killer-arrow-shooter", "0 hit arrow:skeleton 3", "12 hit cactus A");
    both("killer-projectile-only", "0 hit arrow:null 3", "12 hit cactus A");
    both("killer-explosion-null-only", "0 hit explosion:null 3", "12 hit cactus A");
    both("killer-fireball-null-only", "0 hit fireball:null 3", "12 hit cactus A");
    both("killer-self-arrow", "0 hit arrow:self 3", "12 hit cactus A");
    both("killer-mob-then-self-arrow", "0 hit mob:zombie 3", "12 hit arrow:self 2", "24 hit cactus A");
    // The combat window (100 ticks since the last entry, 300 after a living attacker) and the revenge target (100 ticks after the last living hit).
    for (int gap : new int[] { 90, 100, 101, 120, 280, 300, 301 }) {
      both("window-zombie-" + gap, "0 hit mob:zombie 2", gap + " hit lava A");
      both("window-generic-" + gap, "0 hit generic 2", gap + " hit lava A");
    }
    both("window-refreshed", "0 hit mob:zombie 2", "100 hit generic 2", "200 hit generic 2", "290 hit lava A");
    both("window-zombie-chain", "0 hit mob:zombie 2", "90 hit mob:zombie 2", "180 hit mob:zombie 2", "270 hit mob:zombie 2", "360 hit lava A");
    both("revenge-then-generic", "0 hit mob:zombie 2", "50 hit generic 2", "140 hit lava A");
    both("revenge-then-generic-2", "0 hit mob:zombie 2", "50 hit generic 2", "101 hit lava A");
    both("revenge-player-attacker", "0 hit player:alex 2", "95 hit lava A");
    both("revenge-player-attacker-late", "0 hit player:alex 2", "101 hit lava A");
    // Hit-window refusals add no entry; a top-up adds only the difference.
    both("refused-top-up", "0 hit mob:zombie 5", "2 hit mob:skeleton 3", "12 hit lava A");
    both("topup-larger", "0 hit mob:zombie 3", "2 hit mob:skeleton 6", "14 hit lava A");
    both("topup-then-largest", "0 hit mob:zombie 3", "2 hit mob:skeleton 5", "14 hit lava A");
  }
}
