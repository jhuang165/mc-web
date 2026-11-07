import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 18 mob doors. Runs the unchanged EntityAIMoveThroughVillage (us) on a zombie (yq) in the VillageLiveProbe flat-world
// double with a built village: shouldExecute, startExecuting, continueExecuting and resetTask per round, recording the door
// chosen (Village.getVillageDoorInfoList order), the navigator's canBreakDoors flag after each call, the path end, the
// visited-door list and the entity Random. Variants: open ground, an entity walled into a stone cell (no path, so the
// findRandomTargetBlockTowards fallback draws), and the village's door objects replaced by equal-coordinate clones (the
// visited list compares coordinates, not identity).
public class MoveThroughVillageProbe {
  static String num(double v) { return Double.toString(v); }
  static Object field(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static int draw(Object o) throws Exception { return ((Random) field(o, "Z")).nextInt(1000000); }
  static void at(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static String pt(Object p) throws Exception { return p == null ? "null" : "[" + MobMoveProbe.field(p.getClass(), "a").getInt(p) + "," + MobMoveProbe.field(p.getClass(), "b").getInt(p) + "," + MobMoveProbe.field(p.getClass(), "c").getInt(p) + "]"; }
  static String door(vy d) { return d == null ? "null" : "[" + d.a + "," + d.b + "," + d.c + "]"; }

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
    Field dF = MobMoveProbe.field(us.class, "d"), cF = MobMoveProbe.field(us.class, "c"), fF = MobMoveProbe.field(us.class, "f");
    double[][] starts = {{46.5, 46.5}, {53.5, 53.5}, {60.5, 55.5}};
    for (int variant = 0; variant < 3; variant++) for (int rebuild = 0; rebuild < 2; rebuild++) if (variant == 2 && rebuild == 1) continue;
    else for (int day = 0; day < 2; day++) for (int nocturnal = 0; nocturnal < 2; nocturnal++) for (int flag = 0; flag < 2; flag++) for (long seed = 0; seed < 3; seed++) {
      wc c = VillageLiveProbe.built(80 + (variant == 2 ? 1 : 0), 12, 5);
      double[] sp = starts[(int) ((seed + variant) % 3)];
      if (variant == 2) for (int x = -1; x <= 1; x++) for (int z = -1; z <= 1; z++) for (int y = 0; y <= 2; y++)
        if (x != 0 || z != 0 || y == 2) VillageLiveProbe.put((int) Math.floor(sp[0]) + x, y, (int) Math.floor(sp[1]) + z, 1, 0);
      VillageLiveProbe.W.day = day == 1;
      yq z = new yq(w);
      at(z, sp[0], 0, sp[1]);
      MobMoveProbe.set(z, "D", true);
      VillagerProbe.World.entities.add(z);
      MobMoveProbe.set(z, "Z", new Random(seed));
      z.m().b(flag == 1);
      us task = new us(z, 1.0, nocturnal == 1);
      vz village = (vz) c.b().get(0);
      StringBuilder doors = new StringBuilder();
      for (Object d : village.f()) doors.append(doors.length() > 0 ? "," : "").append(door((vy) d));
      StringBuilder rounds = new StringBuilder();
      for (int round = 0; round < 20; round++) {
        if (rebuild == 1 && round == 3) {
          List l = village.f();
          for (int i = 0; i < l.size(); i++) { vy o = (vy) l.get(i); l.set(i, new vy(o.a, o.b, o.c, o.d, o.e, o.f)); }
        }
        boolean ret = task.a();
        vy d = (vy) dF.get(task);
        String entry = "[" + ret + "," + door(d) + "," + z.m().c() + "," + pt(cF.get(task) == null ? null : ((ayf) cF.get(task)).c());
        boolean cont = false;
        if (ret) {
          task.c();
          entry += "," + z.m().c() + "," + z.m().g();
          // mode by round: even rounds the entity ends next to the door, odd rounds it stays put
          if (round % 3 != 2 && d != null) at(z, d.a + 0.5, 0, d.c + 2.5);
          cont = task.b();
          task.d();
        } else entry += ",null,null";
        List vis = (List) fF.get(task);
        StringBuilder v = new StringBuilder();
        for (Object o : vis) v.append(v.length() > 0 ? "," : "").append(door((vy) o));
        rounds.append(round > 0 ? "," : "").append(entry).append(",").append(cont).append(",").append(z.m().c()).append(",[").append(v).append("]]");
        at(z, sp[0], 0, sp[1]);
        z.m().h(); // navigator.clearPathEntity
      }
      System.out.println("{\"case\":\"throughVillage\",\"variant\":" + variant + ",\"rebuild\":" + (rebuild == 1) + ",\"day\":" + (day == 1) + ",\"nocturnal\":" + (nocturnal == 1) + ",\"flag\":" + (flag == 1)
        + ",\"seed\":" + seed + ",\"start\":[" + num(sp[0]) + "," + num(sp[1]) + "],\"doors\":[" + doors + "],\"rounds\":[" + rounds + "],\"next\":" + draw(z) + "}");
    }
  }
}
