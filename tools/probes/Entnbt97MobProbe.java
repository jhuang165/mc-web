import java.util.*;

// Batch 97 entnbt97 part 2: mob and generic-entity NBT edge values through the real 1.7.10 classes, in Entnbt94Probe's row format
// [name, tag, "written compound (sorted)", "same after sg.a reload", "written hex"] (CommandSummon on Summon86Probe's double, Entity.writeToNBTOptional sa.c).
public class Entnbt97MobProbe {
  static String q(String s) { return CmdChatProbe.q(s); }
  public static void main(String[] argv) throws Exception {
    Summon86Probe.setup();
    CmdExec83Probe.fresh("solo");
    String m1 = "{Name:\"generic.maxHealth\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:4.0d,Operation:0,UUIDMost:1L,UUIDLeast:2L}]}";
    List<String[]> e = new ArrayList<>();
    String[] mobs = {"Zombie", "Cow", "Skeleton", "Creeper", "Wolf"};
    // Attributes
    e.add(new String[] {"Zombie", "{Attributes:[{Name:\"foo.bar\",Base:5.0d}]}"});
    e.add(new String[] {"Cow", "{Attributes:[{Name:\"generic.attackDamage\",Base:9.0d}]}"});
    e.add(new String[] {"Zombie", "{Attributes:[" + m1 + "]}"});
    e.add(new String[] {"Zombie", "{Attributes:[{Name:\"generic.maxHealth\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:4.0d,Operation:1,UUIDMost:1L,UUIDLeast:2L},{Name:\"b\",Amount:-0.5d,Operation:2,UUIDMost:3L,UUIDLeast:4L},{Name:\"c\",Amount:1.0d,Operation:0,UUIDMost:5L,UUIDLeast:6L}]}]}"});
    e.add(new String[] {"Zombie", "{Attributes:[{Name:\"generic.maxHealth\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:4.0d,Operation:7,UUIDMost:1L,UUIDLeast:2L}]}]}"});
    e.add(new String[] {"Zombie", "{Attributes:[{Name:\"generic.maxHealth\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:4.0d,Operation:0}]}]}"});
    e.add(new String[] {"Zombie", "{Attributes:[{Name:\"generic.maxHealth\",Base:40.0d,Modifiers:[{Amount:4.0d,Operation:0,UUIDMost:1L,UUIDLeast:2L}]}]}"});
    e.add(new String[] {"Zombie", "{Attributes:[{Name:\"generic.maxHealth\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:4.0d,Operation:0,UUIDMost:1L,UUIDLeast:2L},{Name:\"a2\",Amount:5.0d,Operation:0,UUIDMost:1L,UUIDLeast:2L}]}]}"});
    e.add(new String[] {"Zombie", "{Attributes:[{Name:\"generic.maxHealth\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:4.0d,Operation:0,UUIDMost:1L,UUIDLeast:2L}]},{Name:\"generic.maxHealth\",Base:60.0d}]}"});
    e.add(new String[] {"Zombie", "{Attributes:[{Name:\"generic.maxHealth\",Base:-5.0d}]}"});
    e.add(new String[] {"Zombie", "{Attributes:[{Name:\"generic.movementSpeed\",Base:0.5f}]}"});
    e.add(new String[] {"Zombie", "{Attributes:[{Name:\"generic.movementSpeed\",Base:3}]}"});
    e.add(new String[] {"Zombie", "{Attributes:[{Name:\"generic.followRange\",Base:0.0d},{Name:\"generic.knockbackResistance\",Base:2.0d}]}"});
    e.add(new String[] {"Zombie", "{Attributes:[{Base:5.0d}]}"});
    e.add(new String[] {"Zombie", "{Attributes:[{Name:\"generic.maxHealth\"}]}"});
    e.add(new String[] {"Zombie", "{Attributes:[{Name:\"zombie.spawnReinforcements\",Base:1.0d}]}"});
    e.add(new String[] {"Zombie", "{Attributes:[{Name:\"generic.attackDamage\",Base:2.0d,Modifiers:[{Name:\"Random spawn bonus\",Amount:0.5d,Operation:1,UUIDMost:7L,UUIDLeast:8L}]}]}"});
    e.add(new String[] {"Zombie", "{Attributes:{Name:\"generic.maxHealth\",Base:40.0d}}"});
    e.add(new String[] {"Zombie", "{Attributes:[]}"});
    e.add(new String[] {"Zombie", "{Attributes:[{Name:\"generic.maxHealth\",Base:40.0d,Modifiers:[]}]}"});
    // DropChances, CanPickUpLoot, PersistenceRequired
    for (String m : new String[] {"Zombie", "Cow"}) {
      e.add(new String[] {m, "{DropChances:[0.0f,1.0f,2.0f,-1.0f,0.5f]}"});
      e.add(new String[] {m, "{DropChances:[0.5f,0.25f]}"});
      e.add(new String[] {m, "{DropChances:[0.5f,0.25f,0.1f,0.2f,0.3f,0.4f,0.5f]}"});
      e.add(new String[] {m, "{DropChances:[0.5d,0.25d,0.1d,0.2d,0.3d]}"});
      e.add(new String[] {m, "{DropChances:[1,2,3,4,5]}"});
      e.add(new String[] {m, "{DropChances:[NaNf,Infinityf,-Infinityf,1.0E30f,0.0f]}"});
      e.add(new String[] {m, "{DropChances:[]}"});
      e.add(new String[] {m, "{DropChances:0.5f}"});
      e.add(new String[] {m, "{CanPickUpLoot:1b}"});
      e.add(new String[] {m, "{CanPickUpLoot:2b}"});
      e.add(new String[] {m, "{CanPickUpLoot:-1b}"});
      e.add(new String[] {m, "{CanPickUpLoot:1}"});
      e.add(new String[] {m, "{CanPickUpLoot:256}"});
      e.add(new String[] {m, "{CanPickUpLoot:0.5f}"});
      e.add(new String[] {m, "{CanPickUpLoot:\"true\"}"});
      e.add(new String[] {m, "{PersistenceRequired:1b}"});
      e.add(new String[] {m, "{PersistenceRequired:5b}"});
      e.add(new String[] {m, "{PersistenceRequired:1}"});
      e.add(new String[] {m, "{PersistenceRequired:256}"});
      e.add(new String[] {m, "{PersistenceRequired:0b,CanPickUpLoot:1b}"});
    }
    // Leash
    for (String m : new String[] {"Cow", "Zombie", "Wolf"}) {
      e.add(new String[] {m, "{Leashed:1b,Leash:{X:5,Y:70,Z:5}}"});
      e.add(new String[] {m, "{Leashed:1b,Leash:{X:5,Y:70}}"});
      e.add(new String[] {m, "{Leashed:1b,Leash:{X:5,Y:70,Z:5,UUIDMost:1L,UUIDLeast:2L}}"});
      e.add(new String[] {m, "{Leashed:1b,Leash:{UUIDMost:0L,UUIDLeast:0L}}"});
      e.add(new String[] {m, "{Leashed:1b,Leash:{}}"});
      e.add(new String[] {m, "{Leashed:1b,Leash:5}"});
      e.add(new String[] {m, "{Leashed:1b,Leash:{X:5.5d,Y:70.5d,Z:5.5d}}"});
      e.add(new String[] {m, "{Leashed:2b,Leash:{X:5,Y:70,Z:5}}"});
      e.add(new String[] {m, "{Leashed:1,Leash:{X:5,Y:70,Z:5}}"});
      e.add(new String[] {m, "{Leash:{X:5,Y:70,Z:5}}"});
      e.add(new String[] {m, "{Leashed:0b,Leash:{UUIDMost:1L,UUIDLeast:2L}}"});
    }
    StringBuilder out = new StringBuilder("{\"edge\":[");
    boolean first = true;
    for (String[] c : e) { out.append(first ? "" : ",").append("[" + q(c[0]) + "," + q(c[1]) + "," + q(Entnbt94Probe.edge(c[0], c[1], false)) + "," + q(Entnbt94Probe.edge(c[0], c[1], true)) + "," + q(Entnbt94Probe.hexW(c[0], c[1])) + "]"); first = false; }
    out.append("],\"leashTicks\":[");
    first = true;
    for (String[] c : e) {
      if (!c[1].contains("Leash")) continue;
      StringBuilder steps = new StringBuilder();
      try {
        List<sa> got = Summon87Probe.summon(c[0], c[1]);
        sa m = got.get(got.size() - 1);
        int done = 0;
        for (int target : new int[] {0, 1, 3}) {
          while (done < target) { m.h(); done++; }
          dh t = new dh(); m.c(t);
          steps.append(steps.length() == 0 ? "" : ",").append("[" + target + "," + q(t.c("Leashed") ? t.a("Leashed").toString() : "none") + "," + q(t.c("Leash") ? t.a("Leash").toString() : "none") + "]");
        }
      } catch (Throwable x) { steps.append(steps.length() == 0 ? "" : ",").append("[-1," + q("!" + x) + ",\"\"]"); }
      out.append(first ? "" : ",").append("[" + q(c[0]) + "," + q(c[1]) + ",[" + steps + "]]"); first = false;
    }
    System.out.println(out.append("]}"));
  }
}
