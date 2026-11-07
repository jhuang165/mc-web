import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 19 mob doors round 3. A zombie (yq, unchanged) with the CanBreakDoors task walks a door path in a ticking world: every tick is
// Entity.onUpdate (sa.h) -> onLivingUpdate (sv.e): the target and task lists (EntityAIMoveThroughVillage us, EntityAIBreakDoor tz,
// EntityAIWander, ...), PathNavigate, EntityMoveHelper and moveEntity against the VillageLiveProbe world double with a village whose
// only door sits in a stone wall. Night (no burning), mobGriefing on, no players, brightness 1 (double). Per tick: position, collided
// horizontally, the door cell (id, lower half meta), which of us/tz are executing, the tz counter, the entity Random draws (nextFloat as f, nextInt(n) as in),
// the executing task priorities, the aux events (1010 wood knock, 1012 wood break, 2001 block break) and the navigator's path index.
public class ZombieDoorWalkProbe {
  static String num(double v) { return Double.toString(v); }
  static Object field(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static void at(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }

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
    // EntityPigZombie (yh) extends EntityZombie: the CanBreakDoors tag round trip (read: yq.a(dh) -> setBreakDoorsAItask; written: yq.b(dh)) and
    // isAIEnabled (bk), which is what keeps every EntityAI* task off a pigman.
    for (boolean on : new boolean[] {false, true}) {
      yh pig = new yh(w); yq zom = new yq(w);
      dh t = new dh(); t.a("CanBreakDoors", on); pig.a(t);
      dh out = new dh(); pig.b(out);
      System.out.println("{\"case\":\"pigmanDoors\",\"tag\":" + on + ",\"read\":" + pig.bZ() + ",\"written\":" + out.n("CanBreakDoors") + ",\"pigAI\":" + MobMoveProbe.method(sw.class, "bk").invoke(pig) + ",\"zombieAI\":" + MobMoveProbe.method(sw.class, "bk").invoke(zom) + "}");
    }
    Field diff = MobMoveProbe.field(ahb.class, "r");
    for (int difficulty = 2; difficulty <= 3; difficulty++) for (int variant = 0; variant < 3; variant++) for (long seed = 0; seed < 3; seed++) {
      diff.set(w, rd.values()[difficulty]);
      VillagerProbe.reset(); VillageLiveProbe.W.roofs.clear(); VillageLiveProbe.W.events.clear(); VillageLiveProbe.W.day = false; VillageLiveProbe.W.rain = false;
      VillagerProbe.World.aux.clear();
      MobMoveProbe.set(w, "s", new Random(2));
      wc c = new wc(w);
      MobMoveProbe.set(w, "A", c);
      // A stone wall at x 60 (y 0..2, z 40..60) with a wooden door at (60, 0..1, 50); the roof covers the east side (the village interior).
      for (int z = -60; z <= 160; z++) for (int y = 0; y <= 2; y++) VillageLiveProbe.put(60, y, z, 1, 0);
      VillageLiveProbe.rmdoor(60, 0, 50);
      VillageLiveProbe.door(60, 0, 50, variant == 1 ? 1 : 0);
      VillageLiveProbe.W.roofs.add(new int[] {61, 40, 75, 60});
      yv target = VillagerProbe.villager(w, 0, 88.5, 50.5, 7);
      for (int t = 0; t < 5; t++) { if (t % 60 == 0) c.a(62, 0, 50); c.a(); }
      VillageLiveProbe.LogRandom rand = new VillageLiveProbe.LogRandom(seed);
      yq z = new yq(w);
      double[][] starts = {{54.5, 50.5}, {55.5, 47.5}, {57.5, 53.5}};
      double[] sp = starts[variant];
      at(z, sp[0], 0, sp[1]);
      MobMoveProbe.set(z, "Z", rand);
      for (String n : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(z, n, 0f); // constructor rolls yaw from Math.random()
      z.d(target); // setAttackTarget: a villager 28 blocks past the wall, never ticked
      dh tag = new dh(); tag.a("CanBreakDoors", true); z.a(tag);
      VillagerProbe.World.entities.add(z);
      VillageLiveProbe.LogRandom.log.clear();
      StringBuilder ticks = new StringBuilder();
      int lastAux = 0;
      for (int t = 0; t < 380; t++) {
        z.h();
        List run = (List) field(field(z, "c"), "c");
        boolean tzOn = false, usOn = false;
        StringBuilder prio = new StringBuilder();
        int counter = 0;
        for (Object entry : run) { prio.append(prio.length() > 0 ? "," : "").append(MobMoveProbe.field(entry.getClass(), "b").getInt(entry)); Object a = field(entry, "a"); if (a instanceof tz) { tzOn = true; counter = MobMoveProbe.field(tz.class, "i").getInt(a); } if (a instanceof us) usOn = true; }
        ayf p = (ayf) field(z.m(), "c");
        int[] cell = VillagerProbe.World.cell(60, 0, 50);
        int[] upper = VillagerProbe.World.cell(60, 1, 50);
        StringBuilder aux = new StringBuilder();
        for (int i = lastAux; i < VillagerProbe.World.aux.size(); i++) aux.append(aux.length() > 0 ? "," : "").append("\"").append(VillagerProbe.World.aux.get(i)).append("\"");
        lastAux = VillagerProbe.World.aux.size();
        StringBuilder draws = new StringBuilder();
        for (String d : VillageLiveProbe.LogRandom.log) draws.append(draws.length() > 0 ? "," : "").append("\"").append(d.startsWith("f") ? "f" : d.substring(0, d.indexOf(':'))).append("\"");
        ticks.append(t > 0 ? "," : "").append("[").append(num(z.s)).append(",").append(num(z.t)).append(",").append(num(z.u)).append(",").append(z.E).append(",")
          .append(cell == null ? -1 : cell[0]).append(",").append(cell == null ? -1 : cell[1]).append(",").append(upper == null ? -1 : upper[0]).append(",").append(tzOn).append(",").append(usOn).append(",").append(counter).append(",")
          .append("[").append(draws).append("],").append(p == null ? -1 : MobMoveProbe.field(ayf.class, "c").getInt(p)).append(",[").append(aux).append("],[").append(prio).append("]]");
        VillageLiveProbe.LogRandom.log.clear();
      }
      System.out.println("{\"case\":\"doorWalk\",\"difficulty\":" + difficulty + ",\"variant\":" + variant + ",\"seed\":" + seed + ",\"start\":[" + num(sp[0]) + "," + num(sp[1]) + "],\"ticks\":[" + ticks + "]}");
    }
  }
}
