import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 22 villagers4. ZombieDoorAttackProbe's door wall and zombie (yq, CanBreakDoors, attack target set with EntityLiving.setAttackTarget), but the
// target is a real EntityPlayer (P, 1000 health, not ticked) standing 6 blocks behind the door in the stone room, so the
// zombie's EntityAIAttackOnCollide, EntityAIBreakDoor and EntityAIMoveThroughVillage run until its melee lands on the player
// (EntityPlayer.attackEntityFrom: the difficulty scaling of EntityPlayer.damageEntity applies). Per tick: zombie position, collided flag, door
// cell, tasks, counter, zombie Random draws, aux events, player health lost, player motion. The record ends two ticks after the first hit, or
// after 450 ticks (300 for Normal with a closed door).
public class ZombieDoorPlayerProbe {
  static String num(double v) { return Double.toString(v); }
  static Object field(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static void at(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static String draws(List<String> log) {
    StringBuilder draws = new StringBuilder();
    for (String d : log) draws.append(draws.length() > 0 ? "," : "").append("\"").append(d.startsWith("f") ? "f" : d.substring(0, d.indexOf(':'))).append("\"");
    return draws.toString();
  }

  // A real EntityPlayer (yz) as PlayerKnockbackProbe.P: attackEntityFrom runs unmodified.
  public static class P extends yz {
    P(ahb world) { super(world, new com.mojang.authlib.GameProfile(java.util.UUID.nameUUIDFromBytes("probe".getBytes()), "probe")); }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
  }
  static String motion(sa e) throws Exception { return "[" + num(MobMoveProbe.d(e, "v")) + "," + num(MobMoveProbe.d(e, "w")) + "," + num(MobMoveProbe.d(e, "x")) + "]"; }

  static class Log extends Random {
    List<String> log = new ArrayList<>();
    Log(long seed) { super(seed); }
    public int nextInt(int bound) { int r = super.nextInt(bound); log.add("i" + bound + ":" + r); return r; }
    public float nextFloat() { float r = super.nextFloat(); log.add("f:" + r); return r; }
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    VillageLiveProbe.W w = (VillageLiveProbe.W) u.allocateInstance(VillageLiveProbe.W.class);
    VillageLiveProbe.world = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    MobMoveProbe.set(info, "x", new agy());
    MobMoveProbe.set(w, "x", info);
    Field diff = MobMoveProbe.field(ahb.class, "r");
    // difficulty, variant, seed: Normal with a closed door never breaks it (one 300-tick record); Easy with an open door is one record; the other cases use three seeds
    int[][] cases = {{2, 0, 0}, {1, 1, 0}, {2, 1, 0}, {2, 1, 1}, {2, 1, 2}, {3, 0, 0}, {3, 0, 1}, {3, 0, 2}, {3, 1, 0}, {3, 1, 1}, {3, 1, 2}};
    for (int[] cs : cases) {
      int difficulty = cs[0], variant = cs[1]; long seed = cs[2];
      diff.set(w, rd.values()[difficulty]);
      VillagerProbe.reset(); VillageLiveProbe.W.roofs.clear(); VillageLiveProbe.W.events.clear(); VillageLiveProbe.W.day = false; VillageLiveProbe.W.rain = false;
      VillagerProbe.World.aux.clear();
      MobMoveProbe.set(w, "s", new Random(2));
      wc c = new wc(w);
      MobMoveProbe.set(w, "A", c);
      for (int z = -60; z <= 160; z++) for (int y = 0; y <= 2; y++) VillageLiveProbe.put(60, y, z, 1, 0);
      // the villager's room: stone walls around x 61..70, z 45..55 (y 0..3), so it cannot run away past the zombie
      for (int y = 0; y <= 3; y++) { for (int x = 60; x <= 71; x++) { VillageLiveProbe.put(x, y, 44, 1, 0); VillageLiveProbe.put(x, y, 56, 1, 0); } for (int z = 44; z <= 56; z++) VillageLiveProbe.put(71, y, z, 1, 0); }
      for (int y = 0; y <= 3; y++) if (y > 2) VillageLiveProbe.put(60, y, 50, 1, 0);
      VillageLiveProbe.rmdoor(60, 0, 50);
      VillageLiveProbe.door(60, 0, 50, variant == 1 ? 1 : 0);
      VillageLiveProbe.W.roofs.add(new int[] {61, 40, 75, 60});
      P target = new P(w);
      MobMoveProbe.set(target, "Z", new Random(7));
      target.a(yj.a).a(1000.0);
      target.g(1000.0f);
      MobMoveProbe.set(target, "L", 0f); // EntityPlayerMP (mw) sets yOffset (sa.L) to 0: posY is the feet on the server, as the port assumes (bytecode-read)
      at(target, 66.5, 0.0, 50.5);
      for (int t = 0; t < 5; t++) { if (t % 60 == 0) c.a(62, 0, 50); c.a(); }
      Log zr = new Log(seed);
      yq z = new yq(w);
      double[] sp = {54.5, 50.5};
      at(z, sp[0], 0, sp[1]);
      MobMoveProbe.set(z, "Z", zr);
      for (String n : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(z, n, 0f);
      MobMoveProbe.set(z, "D", true);
      z.d(target);
      dh tag = new dh(); tag.a("CanBreakDoors", true); z.a(tag);
      VillagerProbe.World.entities.add(z);
      VillagerProbe.World.entities.add(target);
      StringBuilder ticks = new StringBuilder();
      int lastAux = 0, hitTick = -1;
      int limit = difficulty == 2 && variant == 0 ? 300 : 450;
      for (int t = 0; t < limit; t++) {
        if (t % 60 == 0) c.a(62, 0, 50);
        c.a();
        zr.log.clear();
        z.h();
        List run = (List) field(field(z, "c"), "c");
        boolean tzOn = false, usOn = false, atkOn = false;
        int counter = 0;
        for (Object entry : run) { Object a = field(entry, "a"); if (a instanceof tz) { tzOn = true; counter = MobMoveProbe.field(tz.class, "i").getInt(a); } if (a instanceof us) usOn = true; if (a instanceof uq) atkOn = true; }
        int[] cell = VillagerProbe.World.cell(60, 0, 50);
        int[] upper = VillagerProbe.World.cell(60, 1, 50);
        StringBuilder aux = new StringBuilder();
        for (int i = lastAux; i < VillagerProbe.World.aux.size(); i++) aux.append(aux.length() > 0 ? "," : "").append("\"").append(VillagerProbe.World.aux.get(i)).append("\"");
        lastAux = VillagerProbe.World.aux.size();
        double lost = 1000.0 - target.aS();
        ticks.append(t > 0 ? "," : "").append("[").append(num(z.s)).append(",").append(num(z.t)).append(",").append(num(z.u)).append(",").append(z.E).append(",")
          .append(num(lost)).append(",").append(motion(target)).append(",")
          .append(cell == null ? -1 : cell[0]).append(",").append(cell == null ? -1 : cell[1]).append(",").append(upper == null ? -1 : upper[0]).append(",").append(tzOn).append(",").append(usOn).append(",").append(atkOn).append(",").append(counter).append(",")
          .append("[").append(draws(zr.log)).append("],[").append(aux).append("]]");
        if (hitTick < 0 && target.aS() < 1000f) hitTick = t;
        if (hitTick >= 0 && t >= hitTick + 2) break;
      }
      System.out.println("{\"case\":\"doorAttack\",\"difficulty\":" + difficulty + ",\"variant\":" + variant + ",\"seed\":" + seed + ",\"hitTick\":" + hitTick + ",\"ticks\":[" + ticks + "]}");
    }
  }
}
