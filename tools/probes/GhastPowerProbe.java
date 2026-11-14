// Batch 69 (projectiles4): the ghast's ExplosionPower tag reaching the fireball it fires. The unchanged EntityGhast (yd) reads the tag with readEntityFromNBT, then runs the
// BlazeGhastProbe ghastAi loop (a player 20 blocks away) until it fires; the spawned EntityLargeFireball's explosion power (zg.e) is recorded. The ball is then ticked into a
// stone block on the FireballProbe path elsewhere (fireballs-reference.json), where the power becomes the explosion size.
public class GhastPowerProbe extends BlazeGhastProbe {
  static String quoteList(java.util.List<String> l) { StringBuilder s = new StringBuilder("["); for (int k = 0; k < l.size(); k++) s.append(k > 0 ? "," : "").append(quote(l.get(k))); return s.append("]").toString(); }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    World w = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(w, "s", new java.util.Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == java.util.List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new java.util.ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    for (java.lang.reflect.Field f : ays.class.getDeclaredFields())
      if (f.getType() == agy.class) { f.setAccessible(true); f.set(info, new agy()); }
    MobMoveProbe.set(w, "x", info);
    MobMoveProbe.set(w, "r", rd.c);
    WolfProbe.W = null;
    // EntityList (sg) and the thrown projectiles: which of them have an id (an egg has none: not saved, not summonable, not created by name)
    {
      java.util.List<String> names = new java.util.ArrayList<>();
      for (Object n : sg.b()) names.add((String) n);
      java.util.Collections.sort(names);
      sa egg = (sa) u.allocateInstance(zl.class), ball = (sa) u.allocateInstance(zj.class), pearl = (sa) u.allocateInstance(zm.class);
      out("{\"case\":\"entityList\",\"eggName\":" + quote(sg.b(egg)) + ",\"eggId\":" + sg.a(egg) + ",\"snowballName\":" + quote(sg.b(ball)) + ",\"snowballId\":" + sg.a(ball)
        + ",\"pearlName\":" + quote(sg.b(pearl)) + ",\"pearlId\":" + sg.a(pearl) + ",\"createdByName\":" + (sg.a("Egg", w) != null) + ",\"hasEggName\":" + names.contains("Egg")
        + ",\"names\":" + quoteList(names) + "}");
    }
    for (int power : new int[] { -1, 0, 1, 3, 7, 40 }) { // -1: no tag at all (the default 1)
      yd e = ghast(w, 11, 64.5, 40, 64.5);
      dh tag = new dh();
      if (power >= 0) tag.a("ExplosionPower", power);
      e.a(tag);
      World.player = player(w, 64.5, 40, 84.5, 0, 0);
      boolean fired = false;
      for (int tick = 1; tick <= 300 && !fired; tick++) {
        World.spawned.clear();
        inv(yd.class, e, "bq");
        if (!World.spawned.isEmpty()) {
          fired = true;
          sa f = World.spawned.get(0);
          out("{\"case\":\"ghastPower\",\"tag\":" + power + ",\"ghastRead\":" + in(e, "bs") + ",\"tick\":" + tick + ",\"fireball\":" + fireball(f) + "}");
        }
        MobMoveProbe.set(e, "v", d(e, "v") * 0.91F); MobMoveProbe.set(e, "w", d(e, "w") * 0.91F); MobMoveProbe.set(e, "x", d(e, "x") * 0.91F);
        setPos(e, d(e, "s") + d(e, "v"), d(e, "t") + d(e, "w"), d(e, "u") + d(e, "x"));
      }
      if (!fired) out("{\"case\":\"ghastPower\",\"tag\":" + power + ",\"fired\":false}");
    }
  }
}
