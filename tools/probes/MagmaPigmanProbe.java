import java.lang.reflect.Field;
import java.util.*;

// Runs the unchanged EntityMagmaCube (yf, "LavaSlime"), EntityPigZombie (yh, "PigZombie"), EntityPig.onStruckByLightning (wo.a(xh)) and
// BlockPortal.updateTick (amp) of the 1.7.10 JAR on SlimeProbe's world double (constructor-less World, entity list, block map, a chunk per
// coordinate, a real EntityPlayer double). Nothing is patched; Entity.rand is a seeded java.util.Random wherever a result depends on it.
// Prints one JSON object per line: magmaFacts, magmaJumpDelay, magmaDrops, magmaSplit, magmaAttack, magmaThink, pigFacts, pigSpawn, pigAnger,
// pigThink, pigDrops, pigNbt, pigLightning, portal and the magma cube model.
public class MagmaPigmanProbe {
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static String q(String s) { return s == null ? "null" : "\"" + s + "\""; }
  static Field fd(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }
  static Object call(Object o, Class<?> c, String n, Object... a) throws Exception {
    Class<?>[] types = new Class<?>[a.length];
    for (int i = 0; i < a.length; i++) types[i] = a[i] instanceof Integer ? int.class : a[i] instanceof Boolean ? boolean.class : a[i] instanceof Float ? float.class : a[i] instanceof Double ? double.class : a[i].getClass();
    return MobMoveProbe.method(c, n, types).invoke(o, a);
  }
  static void pos(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static void seed(sa e, long seed) throws Exception { MobMoveProbe.set(e, "Z", new Random(seed * 2654435761L + 7)); for (String n : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(e, n, 0f); }
  static String items() {
    StringBuilder s = new StringBuilder();
    for (Object o : ChickenProbe.World.spawned) { add st = ((xk) o).f(); s.append(s.length() > 0 ? "," : "").append("[").append(adb.b(st.b())).append(",").append(st.b).append(",").append(st.k()).append("]"); }
    return "[" + s + "]";
  }
  static String strings(List<String> l) {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < l.size(); i++) s.append(i > 0 ? "," : "").append(q(l.get(i)));
    return s.append("]").toString();
  }
  static int randNext(sa e) throws Exception { return ((Random) fd(sa.class, "Z").get(e)).nextInt(); }
  static int heldId(sw e) { add s = e.q(0); return s == null ? 0 : adb.b(s.b()); }

  static yf magma(int size, double x, double y, double z, long seed) throws Exception {
    yf e = new yf(WitchProbe.w);
    seed(e, seed);
    MobMoveProbe.method(ym.class, "a", int.class).invoke(e, size);
    MobMoveProbe.set(e, "bn", 15);
    pos(e, x, y, z);
    return e;
  }
  static yh pig(double x, double y, double z, long seed) throws Exception {
    yh e = new yh(WitchProbe.w);
    seed(e, seed);
    pos(e, x, y, z);
    return e;
  }

  static void magmaFacts() throws Exception {
    WitchProbe.reset();
    StringBuilder rows = new StringBuilder();
    for (int size : new int[] {1, 2, 3, 4, 8}) {
      yf e = magma(size, 64.5, 0, 64.5, 1);
      Class<?> c = yf.class;
      float before = e.aS();
      MobMoveProbe.method(c, "bj").invoke(e);
      double jump = e.w;
      yf f = magma(size, 64.5, 0, 64.5, 1);
      rows.append(rows.length() > 0 ? "," : "").append("{\"size\":").append(size).append(",\"stored\":").append(f.bX()).append(",\"width\":").append(num(f.M)).append(",\"height\":").append(num(f.N))
        .append(",\"maxHealth\":").append(f.a(yj.a).e()).append(",\"health\":").append(num(before)).append(",\"speedAttr\":").append(f.a(yj.d).e())
        .append(",\"armor\":").append(f.aV()).append(",\"damage\":").append(MobMoveProbe.method(c, "bU").invoke(f)).append(",\"canDamage\":").append(MobMoveProbe.method(c, "bT").invoke(f))
        .append(",\"hurt\":").append(q((String) MobMoveProbe.method(c, "aT").invoke(f))).append(",\"death\":").append(q((String) MobMoveProbe.method(c, "aU").invoke(f)))
        .append(",\"jumpSound\":").append(q((String) MobMoveProbe.method(c, "bV").invoke(f))).append(",\"particle\":").append(q((String) MobMoveProbe.method(c, "bP").invoke(f)))
        .append(",\"volume\":").append(num((Float) MobMoveProbe.method(c, "bf").invoke(f))).append(",\"makesJumpSound\":").append(MobMoveProbe.method(c, "bY").invoke(f))
        .append(",\"landSound\":").append(MobMoveProbe.method(c, "bW").invoke(f)).append(",\"drop\":").append(adb.b((adb) MobMoveProbe.method(c, "u").invoke(f)))
        .append(",\"jumpMotion\":").append(num(jump)).append(",\"jumpFlag\":").append(e.al).append(",\"fireImmune\":").append(MobMoveProbe.b(f, "ae")).append(",\"inLavaFlag\":").append(f.P())
        .append(",\"brightnessPacked\":").append(f.c(0f)).append(",\"brightness\":").append(num(f.d(0f))).append(",\"eyeHeight\":").append(num(f.g()))
        .append(",\"squishDecay\":").append(squishDecay(f)).append(",\"experience\":").append(MobMoveProbe.field(sw.class, "b").getInt(f)).append(",\"canDespawn\":").append(MobMoveProbe.method(sw.class, "v").invoke(f))
        .append(",\"child\":").append(q(MobMoveProbe.method(c, "bQ").invoke(f).getClass().getName())).append("}");
    }
    System.out.println("{\"case\":\"magmaFacts\",\"rows\":[" + rows + "],\"saveSizeTag\":\"Size\"}");
  }
  // bS (alterSquishAmount) leaves squishAmount * factor.
  static String squishDecay(yf f) throws Exception {
    MobMoveProbe.set(f, "h", 1f);
    MobMoveProbe.method(yf.class, "bS").invoke(f);
    return num(MobMoveProbe.fl(f, "h"));
  }

  static void magmaJumpDelay() throws Exception {
    StringBuilder rows = new StringBuilder();
    for (long seed = 0; seed < 200; seed++) {
      yf e = magma(1, 64.5, 0, 64.5, seed);
      rows.append(seed > 0 ? "," : "").append(MobMoveProbe.method(yf.class, "bR").invoke(e));
    }
    System.out.println("{\"case\":\"magmaJumpDelay\",\"rows\":[" + rows + "]}");
  }

  static void magmaDrops() throws Exception {
    for (int size : new int[] {1, 2, 4}) {
      for (int looting = 0; looting <= 3; looting += 3) {
        StringBuilder rows = new StringBuilder();
        for (long seed = 0; seed < 120; seed++) {
          WitchProbe.reset();
          yf e = magma(size, 64.5, 0, 64.5, seed);
          MobMoveProbe.method(sw.class, "b", boolean.class, int.class).invoke(e, true, looting);
          rows.append(seed > 0 ? "," : "").append(items()).append("");
        }
        System.out.println("{\"case\":\"magmaDrops\",\"size\":" + size + ",\"looting\":" + looting + ",\"rows\":[" + rows + "]}");
      }
    }
  }

  // setDead (B): children are magma cubes (bQ) of half the size at the same offsets as a slime's.
  static void magmaSplit() throws Exception {
    for (int size : new int[] {1, 2, 4}) {
      StringBuilder rows = new StringBuilder();
      for (long seed = 0; seed < 60; seed++) {
        WitchProbe.reset();
        yf e = magma(size, 64.5, 3, 70.5, seed);
        e.g(0f);
        e.B();
        StringBuilder kids = new StringBuilder();
        for (Object o : ChickenProbe.World.spawned) {
          ym k = (ym) o;
          kids.append(kids.length() > 0 ? "," : "").append("[").append(k instanceof yf ? "\"LavaSlime\"" : "\"Slime\"").append(",").append(k.bX()).append(",").append(num(k.s)).append(",").append(num(k.t)).append(",").append(num(k.u)).append(",").append(num(k.y)).append(",").append(num(k.aS())).append("]");
        }
        rows.append(seed > 0 ? "," : "").append("[").append(kids).append("]");
      }
      System.out.println("{\"case\":\"magmaSplit\",\"size\":" + size + ",\"rows\":[" + rows + "]}");
    }
  }

  static void magmaAttack() throws Exception {
    StringBuilder rows = new StringBuilder();
    for (int size : new int[] {1, 2, 4})
      for (double d : new double[] {0.2, 0.5, 0.7, 1.1, 1.3, 2.3, 2.5, 3.0}) {
        WitchProbe.reset();
        yf e = magma(size, 64.5, 0, 64.5, 9);
        WitchProbe.Gamer p = WitchProbe.player(64.5, 0, 64.5 + d, false);
        pos(p, 64.5, 0.0, 64.5 + d);
        e.b_(p);
        rows.append(rows.length() > 0 ? "," : "").append("{\"size\":").append(size).append(",\"dist\":").append(d).append(",\"hits\":").append(WitchProbe.hitLog)
          .append(",\"sounds\":").append(strings(ChickenProbe.World.sounds)).append(",\"rand\":").append(randNext(e)).append("}");
      }
    System.out.println("{\"case\":\"magmaAttack\",\"rows\":[" + rows + "]}");
  }

  // The armour value in a real hit: attackEntityFrom with a player source on a magma cube of each size (generic 5 damage).
  static void magmaArmor() throws Exception {
    StringBuilder rows = new StringBuilder();
    for (int size : new int[] {1, 2, 3, 4})
      for (float amount : new float[] {1f, 4f, 10f, 40f}) {
        WitchProbe.reset();
        yf e = magma(size, 64.5, 0, 64.5, 5);
        WitchProbe.Gamer p = WitchProbe.player(64.5, 0, 66.5, false);
        e.g(1000f);
        float before = e.aS();
        e.a(ro.a(p), amount);
        rows.append(rows.length() > 0 ? "," : "").append("[").append(size).append(",").append(num(amount)).append(",").append(num(before - e.aS())).append("]");
      }
    System.out.println("{\"case\":\"magmaArmor\",\"rows\":[" + rows + "]}");
  }

  static String state(ym e) throws Exception {
    return "[" + num(e.s) + "," + num(e.t) + "," + num(e.u) + "," + num(e.v) + "," + num(e.w) + "," + num(e.x) + "," + num(e.y) + "," + num(e.aO) + "," + (e.D ? 1 : 0)
      + "," + num(e.h) + "," + num(e.i) + "," + num(e.bm) + "," + MobMoveProbe.field(ym.class, "bn").getInt(e) + "," + (MobMoveProbe.b(e, "bc") ? 1 : 0) + "," + num(e.be) + "," + num(e.bd) + "," + e.aS() + "," + (e.K ? 1 : 0)
      + "," + MobMoveProbe.field(sa.class, "e").getInt(e) + "]";
  }

  static void magmaThink(String kind, int size, long seed, int ticks) throws Exception {
    WitchProbe.reset();
    DifficultyProbe.World.swirls.clear(); DifficultyProbe.World.swirlNames.clear();
    yf e = magma(size, 64.5, 0, 64.5, seed);
    WitchProbe.Gamer p = null;
    double pz = 64.5;
    switch (kind) {
      case "near": p = WitchProbe.player(64.5, 0, 72.5, false); pz = 72.5; break;
      case "lava": for (int x = 60; x < 70; x++) for (int y = 0; y < 3; y++) for (int z = 60; z < 70; z++) WitchProbe.WW.cells.put(x + "," + y + "," + z, new int[] {11, 0}); break;
      case "burning": e.e(8); break;
      default: break;
    }
    StringBuilder out = new StringBuilder();
    List<Integer> particleTicks = new ArrayList<>();
    for (int i = 0; i < ticks; i++) {
      int before = DifficultyProbe.World.swirls.size();
      MobMoveProbe.set(e, "p", MobMoveProbe.d(e, "s")); MobMoveProbe.set(e, "q", MobMoveProbe.d(e, "t")); MobMoveProbe.set(e, "r", MobMoveProbe.d(e, "u"));
      e.h();
      out.append(i > 0 ? "," : "").append(state(e));
      if (DifficultyProbe.World.swirls.size() > before) particleTicks.add(i);
    }
    System.out.println("{\"case\":\"magmaThink\",\"kind\":" + q(kind) + ",\"size\":" + size + ",\"seed\":" + seed + ",\"player\":" + (p == null ? "null" : "[64.5,0," + num(pz) + "]")
      + ",\"fields\":\"x,y,z,vx,vy,vz,yaw,head,onGround,squishAmount,squishFactor,prevSquishFactor,jumpDelay,jumping,moveForward,moveStrafing,health,dead,fire\""
      + ",\"particleTicks\":" + particleTicks + ",\"particleNames\":" + new TreeSet<>(DifficultyProbe.World.swirlNames).stream().map(MagmaPigmanProbe::q).toList()
      + ",\"particleCount\":" + DifficultyProbe.World.swirls.size() + ",\"sounds\":" + strings(ChickenProbe.World.sounds) + ",\"ticks\":[" + out + "]}");
  }

  // Magma cube spawn rule: yf.by is the plain difficulty, no-collision and no-liquid check.
  static void magmaSpawn() throws Exception {
    StringBuilder rows = new StringBuilder();
    for (int diff : new int[] {0, 1, 2, 3}) {
      for (int liquid = 0; liquid <= 1; liquid++) {
        WitchProbe.reset();
        if (liquid == 1) WitchProbe.WW.cells.put("64,0,64", new int[] {11, 0});
        fd(ahb.class, "r").set(WitchProbe.w, rd.values()[diff]);
        yf e = magma(1, 64.5, 0, 64.5, 1);
        yh z = pig(64.5, 0, 64.5, 1);
        rows.append(rows.length() > 0 ? "," : "").append("[").append(diff).append(",").append(liquid).append(",").append(e.by()).append(",").append(z.by()).append("]");
      }
    }
    fd(ahb.class, "r").set(WitchProbe.w, rd.values()[2]);
    System.out.println("{\"case\":\"spawnRule\",\"fields\":\"difficulty,liquid,magmaCube,pigman\",\"rows\":[" + rows + "]}");
  }

  static void pigFacts() throws Exception {
    WitchProbe.reset();
    yh e = pig(64.5, 0, 64.5, 1);
    Class<?> c = yh.class;
    StringBuilder rows = new StringBuilder();
    rows.append("{\"width\":").append(num(e.M)).append(",\"height\":").append(num(e.N)).append(",\"maxHealth\":").append(e.a(yj.a).e()).append(",\"health\":").append(num(e.aS()))
      .append(",\"speedAttr\":").append(e.a(yj.d).e()).append(",\"attackDamage\":").append(e.a(yj.e).e()).append(",\"followRange\":").append(e.a(yj.b).e())
      .append(",\"reinforcements\":").append(e.a(reinforcement()).e()).append(",\"armor\":").append(e.aV()).append(",\"fireImmune\":").append(MobMoveProbe.b(e, "ae"))
      .append(",\"aiEnabled\":").append(MobMoveProbe.method(c, "bk").invoke(e)).append(",\"say\":").append(q((String) MobMoveProbe.method(c, "t").invoke(e)))
      .append(",\"hurt\":").append(q((String) MobMoveProbe.method(c, "aT").invoke(e))).append(",\"death\":").append(q((String) MobMoveProbe.method(c, "aU").invoke(e)))
      .append(",\"volume\":").append(num((Float) MobMoveProbe.method(c, "bf").invoke(e))).append(",\"pitch\":").append(num((Float) MobMoveProbe.method(sv.class, "bg").invoke(e)))
      .append(",\"talkInterval\":").append(e.q()).append(",\"canDespawn\":").append(MobMoveProbe.method(sw.class, "v").invoke(e)).append(",\"experience\":").append(MobMoveProbe.field(sw.class, "b").getInt(e))
      .append(",\"canHarvest\":").append(e.a((yz) null) ? "true" : "false").append(",\"angerField\":").append(fd(yh.class, "bs").getInt(e)).append(",\"soundDelayField\":").append(fd(yh.class, "bt").getInt(e))
      .append(",\"boost\":{\"name\":\"Attacking speed boost\",\"amount\":0.45,\"operation\":0}}");
    System.out.println("{\"case\":\"pigFacts\",\"row\":" + rows + "}");
  }
  static th reinforcement() throws Exception { return (th) MobMoveProbe.field(yq.class, "bp").get(null); }

  // onSpawnWithEgg(null) (a(sy)): the held item after the constructor-less spawn and the child/villager rolls, over entity seeds.
  static void pigSpawn() throws Exception {
    StringBuilder rows = new StringBuilder();
    int babies = 0, villagers = 0;
    for (long s = 0; s < 400; s++) {
      WitchProbe.reset();
      fd(ahb.class, "r").set(WitchProbe.w, rd.values()[2]);
      MobMoveProbe.set(WitchProbe.w, "s", new Random(s * 2654435761L + 7));
      yh e = pig(64.5, 0, 64.5, s);
      reinforcement();
      e.a((sy) null);
      boolean child = e.f(), villager = e.cb();
      if (child) babies++;
      if (villager) villagers++;
      if (s < 40) rows.append(rows.length() > 0 ? "," : "").append("[").append(s).append(",").append(child).append(",").append(villager).append(",").append(heldId(e)).append(",").append(randNext(e)).append("]");
    }
    System.out.println("{\"case\":\"pigSpawn\",\"fields\":\"seed,child,villager,heldItem,randNext\",\"seeds\":400,\"worldSeedFormula\":\"seed * 2654435761 + 7\",\"children\":" + babies + ",\"villagers\":" + villagers + ",\"rows\":[" + rows + "]}");
  }

  // attackEntityFrom with a player source: the pig zombie and every pig zombie within 32 blocks of it become angry (c(sa)).
  static void pigAnger() throws Exception {
    StringBuilder rows = new StringBuilder();
    for (long seed = 0; seed < 24; seed++) {
      WitchProbe.reset();
      fd(ahb.class, "r").set(WitchProbe.w, rd.values()[2]);
      WitchProbe.Gamer p = WitchProbe.player(60.5, 0, 60.5, false);
      yh a = pig(64.5, 0, 64.5, seed), near = pig(80.5, 0, 64.5, seed + 100), far = pig(100.5, 0, 64.5, seed + 200), edge = pig(96.5, 0, 64.5, seed + 300);
      WitchProbe.bodies.add(a);
      yq plain = new yq(WitchProbe.w); pos(plain, 70.5, 0, 64.5); seed(plain, 7); WitchProbe.bodies.add(plain);
      WitchProbe.bodies.add(near); WitchProbe.bodies.add(far); WitchProbe.bodies.add(edge);
      boolean hurt = a.a(ro.a(p), 1.0f);
      rows.append(rows.length() > 0 ? "," : "").append("[").append(seed).append(",").append(hurt).append(",").append(angry(a)).append(",").append(angry(near)).append(",").append(angry(far)).append(",").append(angry(edge)).append(",").append(a.o() != null)
        .append(",").append(randNext(a)).append(",").append(randNext(near)).append("]");
    }
    // A hit from a non-player (a skeleton) angers nobody; an unprovoked pig zombie has no target.
    WitchProbe.reset();
    yh calm = pig(64.5, 0, 64.5, 1);
    yn skeleton = new yn(WitchProbe.w); pos(skeleton, 66.5, 0, 64.5);
    calm.a(ro.a((sv) skeleton), 1.0f);
    String byMob = angry(calm);
    // Anger NBT (aggressive only): Anger short, written and read; the legacy findPlayerToAttack (bR) returns null at 0.
    WitchProbe.reset();
    yh t = pig(64.5, 0, 64.5, 1);
    WitchProbe.Gamer p = WitchProbe.player(66.5, 0, 64.5, false);
    Object base = MobMoveProbe.method(yh.class, "bR").invoke(t);
    fd(yh.class, "bs").setInt(t, 5);
    Object angryFind = MobMoveProbe.method(yh.class, "bR").invoke(t);
    System.out.println("{\"case\":\"pigAnger\",\"fields\":\"seed,hurt,self,near(16 away),far(36 away),edge(32 away),hasTarget,selfRandNext,nearRandNext\",\"angerRange\":32,\"rows\":[" + rows + "],\"byMob\":" + byMob
      + ",\"findCalm\":" + (base == null ? "null" : "\"player\"") + ",\"findAngry\":" + (angryFind == null ? "null" : "\"player\"") + "}");
  }
  static String angry(yh e) throws Exception { return "[" + fd(yh.class, "bs").getInt(e) + "," + fd(yh.class, "bt").getInt(e) + "]"; }

  // onUpdate (h): the angry sound plays when randomSoundDelay counts down to 0 (volume * 2, pitch * 1.8) and the speed boost modifier follows the target.
  static void pigThink() throws Exception {
    StringBuilder rows = new StringBuilder();
    for (long seed = 0; seed < 12; seed++) {
      WitchProbe.reset();
      yh e = pig(64.5, 0, 64.5, seed);
      WitchProbe.Gamer p = WitchProbe.player(60.5, 0, 64.5, false);
      WitchProbe.bodies.add(e);
      e.a(ro.a(p), 0.0f);
      int anger = fd(yh.class, "bs").getInt(e), delay = fd(yh.class, "bt").getInt(e);
      StringBuilder ticks = new StringBuilder();
      for (int i = 0; i < 120; i++) {
        int sounds = ChickenProbe.World.sounds.size();
        e.h();
        ticks.append(i > 0 ? "," : "").append("[").append(fd(yh.class, "bt").getInt(e)).append(",").append(num(e.a(yj.d).e())).append(",").append(ChickenProbe.World.sounds.size() - sounds).append("]");
      }
      rows.append(rows.length() > 0 ? "," : "").append("{\"seed\":").append(seed).append(",\"anger\":").append(anger).append(",\"delay\":").append(delay).append(",\"angerAfter\":").append(fd(yh.class, "bs").getInt(e))
        .append(",\"sounds\":").append(strings(ChickenProbe.World.sounds)).append(",\"ticks\":[").append(ticks).append("]}");
    }
    System.out.println("{\"case\":\"pigThink\",\"tickFields\":\"randomSoundDelay,speedAttr,soundsThisTick\",\"rows\":[" + rows + "]}");
  }

  static void pigDrops() throws Exception {
    for (int looting = 0; looting <= 3; looting += 3) {
      StringBuilder rows = new StringBuilder(), rare = new StringBuilder(), equip = new StringBuilder();
      for (long seed = 0; seed < 120; seed++) {
        WitchProbe.reset();
        yh e = pig(64.5, 0, 64.5, seed);
        MobMoveProbe.method(sw.class, "b", boolean.class, int.class).invoke(e, true, looting);
        rows.append(seed > 0 ? "," : "").append(items());
        WitchProbe.reset();
        yh r = pig(64.5, 0, 64.5, seed);
        MobMoveProbe.method(yh.class, "n", int.class).invoke(r, looting > 0 ? 1 : 0);
        rare.append(seed > 0 ? "," : "").append(items());
        // dropEquipment(recentlyHit, looting) with the gold sword the spawn gives.
        WitchProbe.reset();
        yh q = pig(64.5, 0, 64.5, seed);
        MobMoveProbe.method(yh.class, "bC").invoke(q);
        MobMoveProbe.method(sw.class, "a", boolean.class, int.class).invoke(q, true, looting);
        equip.append(seed > 0 ? "," : "").append(items()).append("");
      }
      System.out.println("{\"case\":\"pigDrops\",\"looting\":" + looting + ",\"rows\":[" + rows + "],\"rare\":[" + rare + "],\"equipment\":[" + equip + "]}");
    }
    // Experience: 5 plus 1 + nextInt(3) per equipment item whose drop chance is at most 1.
    StringBuilder xp = new StringBuilder();
    WitchProbe.Gamer p = WitchProbe.player(60.5, 0, 64.5, false);
    for (int held = 0; held <= 1; held++)
      for (long seed = 0; seed < 8; seed++) {
        yh e = pig(64.5, 0, 64.5, seed);
        if (held == 1) MobMoveProbe.method(yh.class, "bC").invoke(e);
        xp.append(xp.length() > 0 ? "," : "").append("[").append(held).append(",").append(seed).append(",").append(MobMoveProbe.method(sw.class, "e", yz.class).invoke(e, p)).append("]");
      }
    System.out.println("{\"case\":\"pigXp\",\"rows\":[" + xp + "]}");
  }

  static void pigNbt() throws Exception {
    WitchProbe.reset();
    yh e = pig(64.5, 0, 64.5, 1);
    MobMoveProbe.method(yh.class, "bC").invoke(e);
    fd(yh.class, "bs").setInt(e, 123);
    dh tag = new dh();
    e.e(tag);
    StringBuilder keys = new StringBuilder();
    for (Object k : new TreeSet<>(tag.c())) keys.append(keys.length() > 0 ? "," : "").append(q((String) k));
    dh back = new dh();
    yh r = pig(64.5, 0, 64.5, 2);
    r.f(tag);
    System.out.println("{\"case\":\"pigNbt\",\"anger\":" + tag.e("Anger") + ",\"id\":" + q(tag.j("id")) + ",\"keys\":[" + keys + "],\"restoredAnger\":" + fd(yh.class, "bs").getInt(r) + ",\"restoredHeld\":" + heldId(r)
      + ",\"equipmentCount\":" + tag.c("Equipment", 10).c() + ",\"dropChances\":" + tag.c("DropChances", 5).c() + ",\"hurtByKeys\":" + tag.c("HurtBy") + "}");
  }

  // EntityPig.onStruckByLightning (wo.a(xh)): a pig zombie with a golden sword at the pig's position, yaw and pitch; the pig is removed.
  static void pigLightning() throws Exception {
    StringBuilder rows = new StringBuilder();
    for (int baby = 0; baby <= 1; baby++) {
      WitchProbe.reset();
      wo p = new wo(WitchProbe.w);
      seed(p, 3);
      pos(p, 10.5, 64, -3.5);
      p.y = 123.5f; p.z = 17.25f;
      if (baby == 1) p.c(-24000);
      xh bolt = (xh) WitchProbe.u.allocateInstance(xh.class);
      p.a(bolt);
      yh made = null;
      for (Object o : ChickenProbe.World.spawned) if (o instanceof yh) made = (yh) o;
      rows.append(rows.length() > 0 ? "," : "").append("{\"baby\":").append(baby == 1).append(",\"spawned\":").append(ChickenProbe.World.spawned.size()).append(",\"pigDead\":").append(p.K);
      if (made != null) rows.append(",\"pos\":[").append(num(made.s)).append(",").append(num(made.t)).append(",").append(num(made.u)).append("],\"rot\":[").append(num(made.y)).append(",").append(num(made.z)).append("],\"held\":")
        .append(heldId(made)).append(",\"anger\":").append(fd(yh.class, "bs").getInt(made)).append(",\"health\":").append(num(made.aS())).append(",\"child\":").append(made.f()).append(",\"fire\":").append(MobMoveProbe.field(sa.class, "e").getInt(made));
      rows.append(",\"pigFire\":").append(MobMoveProbe.field(sa.class, "e").getInt(p)).append(",\"pigHealth\":").append(num(p.aS())).append("}");
    }
    System.out.println("{\"case\":\"pigLightning\",\"rows\":[" + rows + "]}");
  }

  // BlockPortal.updateTick (amp.a(ahb, x, y, z, Random)): nextInt(2000) < difficulty id, then the first solid top surface below,
  // a non-normal cube above it, and ItemMonsterPlacer.spawnCreature(57) at (x + 0.5, floor + 1.1, z + 0.5).
  static void portal() throws Exception {
    aji block = aji.e(90);
    StringBuilder rows = new StringBuilder();
    for (int diff = 0; diff <= 3; diff++) {
      WitchProbe.reset();
      fd(ahb.class, "r").set(WitchProbe.w, rd.values()[diff]);
      WitchProbe.WW.cells.put("5,59,5", new int[] {1, 0});
      WitchProbe.WW.cells.put("5,63,5", new int[] {90, 0});
      int spawns = 0;
      List<Long> first = new ArrayList<>();
      String where = "null";
      for (long s = 0; s < 6000; s++) {
        ChickenProbe.World.spawned.clear();
        Random r = new Random(s);
        MobMoveProbe.set(WitchProbe.w, "s", new Random(s + 1));
        block.a(WitchProbe.w, 5, 63, 5, r);
        if (!ChickenProbe.World.spawned.isEmpty()) {
          spawns++;
          if (first.size() < 12) first.add(s);
          sa spawned = (sa) ChickenProbe.World.spawned.get(0);
          where = "[" + q(spawned.getClass().getName()) + "," + num(spawned.s) + "," + num(spawned.t) + "," + num(spawned.u) + "," + MobMoveProbe.field(sa.class, "am").getInt(spawned) + "," + heldId((sw) spawned) + "]";
        }
      }
      rows.append(rows.length() > 0 ? "," : "").append("{\"difficulty\":").append(diff).append(",\"trials\":6000,\"spawns\":").append(spawns).append(",\"firstSeeds\":").append(first).append(",\"entity\":").append(where).append("}");
    }
    // Roll order check: with the entity roll failing the world's rand is untouched.
    fd(ahb.class, "r").set(WitchProbe.w, rd.values()[2]);
    System.out.println("{\"case\":\"portal\",\"rows\":[" + rows + "]}");
  }

  // ModelMagmaCube (bho): eight slices (bix[]) plus the core.
  static void magmaModel() throws Exception {
    bho m = new bho();
    StringBuilder b = new StringBuilder("{\"model\":\"magmacube\",\"class\":\"" + m.getClass().getName() + "\",\"texture\":[" + m.t + "," + m.u + "],\"parts\":{");
    boolean first = true;
    for (Field f : bho.class.getDeclaredFields()) {
      if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
      f.setAccessible(true);
      Object v = f.get(m);
      if (v instanceof bix[]) {
        bix[] arr = (bix[]) v;
        for (int i = 0; i < arr.length; i++) { if (!first) b.append(','); first = false; b.append("\"slice").append(i).append("\":").append(ModelProbe.part(arr[i])); }
      } else if (v instanceof bix) { if (!first) b.append(','); first = false; b.append("\"").append(f.getName()).append("\":").append(ModelProbe.part((bix) v)); }
    }
    System.out.println(b.append("}}"));
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    WitchProbe.u = MobMoveProbe.unsafe();
    sun.misc.Unsafe u = WitchProbe.u;
    WitchProbe.w = (WitchProbe.WW) u.allocateInstance(SlimeProbe.SW.class);
    WitchProbe.WW w = WitchProbe.w;
    DifficultyProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    aqq provider = new aqq();
    java.lang.reflect.Method gen = aqo.class.getDeclaredMethod("a"); gen.setAccessible(true); gen.invoke(provider);
    MobMoveProbe.set(w, "t", provider);
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    fd(ays.class, "g").setLong(info, 1);
    fd(ays.class, "x").set(info, new agy());
    fd(ahb.class, "x").set(w, info);
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    fd(ahb.class, "J").set(w, date);
    fd(ahb.class, "r").set(w, rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class) { f.setAccessible(true); f.set(w, new bac()); }
    final SlimeProbe.SW sw0 = (SlimeProbe.SW) w;
    MobMoveProbe.set(w, "v", java.lang.reflect.Proxy.newProxyInstance(MagmaPigmanProbe.class.getClassLoader(), new Class[] {apu.class}, (pr, m, a) -> {
      Class<?> r = m.getReturnType();
      if (r == apx.class) { apx c = sw0.d((Integer) a[0] << 4, (Integer) a[1] << 4); Field hf = MobMoveProbe.field(apx.class, "f"); if (hf.get(c) == null) hf.set(c, new int[256]); return c; }
      if (r == boolean.class) return true;
      if (r == int.class) return 0;
      return null;
    }));
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    DifficultyProbe.World.light = 15;

    magmaFacts();
    magmaJumpDelay();
    magmaDrops();
    magmaSplit();
    magmaAttack();
    magmaArmor();
    magmaSpawn();
    for (int size : new int[] {1, 2, 4}) {
      for (long seed = 1; seed <= 2; seed++) { magmaThink("idle", size, seed, 200); magmaThink("near", size, seed, 160); }
      magmaThink("lava", size, 3, 120);
    }
    magmaThink("burning", 2, 3, 60);
    pigFacts();
    pigSpawn();
    pigAnger();
    pigThink();
    pigDrops();
    pigNbt();
    pigLightning();
    portal();
    magmaModel();
  }
}
