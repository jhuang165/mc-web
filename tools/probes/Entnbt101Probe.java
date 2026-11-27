import java.util.*;

// Batch 101 entnbt101: mob NBT edge values not covered by Entnbt94/97/98 (CustomName / CustomNameVisible forms, ActiveEffects field widths and shapes, Attributes field widths),
// through the real 1.7.10 classes, in Entnbt97MobProbe's row format [name, tag, "written compound (sorted)", "same after sg.a reload", "written hex"].
// "effTicks": [name, tag, [[updates, ActiveEffects written]...]] after 0, 1, 20 onUpdate calls.
public class Entnbt101Probe {
  static String q(String s) { return CmdChatProbe.q(s); }
  static String eff(String id, String amp, String dur, String extra) { return "{ActiveEffects:[{Id:" + id + ",Amplifier:" + amp + ",Duration:" + dur + extra + "}]}"; }
  public static void main(String[] argv) throws Exception {
    Summon86Probe.setup();
    CmdExec83Probe.fresh("solo");
    List<String[]> e = new ArrayList<>();
    for (String m : new String[] {"Zombie", "Cow", "Villager", "Bat"}) {
      for (String t : new String[] {"{CustomName:\"\"}", "{CustomName:\"Bob\"}", "{CustomName:\"Bob\",CustomNameVisible:1b}", "{CustomNameVisible:1b}", "{CustomName:\"\",CustomNameVisible:1b}",
          "{CustomName:\"Bob\",CustomNameVisible:2b}", "{CustomName:\"Bob\",CustomNameVisible:-1b}", "{CustomName:\"Bob\",CustomNameVisible:1}", "{CustomName:\"Bob\",CustomNameVisible:256}",
          "{CustomName:\"Bob\",CustomNameVisible:256b}", "{CustomName:\"Bob\",CustomNameVisible:0.5f}", "{CustomName:\"Bob\",CustomNameVisible:\"true\"}", "{CustomName:\"Bob\",CustomNameVisible:3s}",
          "{CustomName:\"Bob\",CustomNameVisible:1L}", "{CustomName:5}", "{CustomName:5b,CustomNameVisible:1b}", "{CustomName:\"\\u00a7aGreen\"}", "{CustomName:\"  spaced  \"}",
          "{CustomName:\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}", "{CustomName:{a:1}}", "{CustomName:[1,2]}"})
        e.add(new String[] {m, t});
    }
    // ActiveEffects: field widths and shapes
    for (String m : new String[] {"Zombie", "Cow"}) {
      e.add(new String[] {m, eff("1b", "1b", "100", "")});
      e.add(new String[] {m, eff("1s", "1b", "100", "")});
      e.add(new String[] {m, eff("1", "1b", "100", "")});
      e.add(new String[] {m, eff("257", "1b", "100", "")});
      e.add(new String[] {m, eff("1L", "1b", "100", "")});
      e.add(new String[] {m, eff("1.0f", "1b", "100", "")});
      e.add(new String[] {m, eff("\"1\"", "1b", "100", "")});
      e.add(new String[] {m, eff("-1b", "1b", "100", "")});
      e.add(new String[] {m, eff("0b", "1b", "100", "")});
      e.add(new String[] {m, eff("1b", "1s", "100", "")});
      e.add(new String[] {m, eff("1b", "1", "100", "")});
      e.add(new String[] {m, eff("1b", "129", "100", "")});
      e.add(new String[] {m, eff("1b", "256", "100", "")});
      e.add(new String[] {m, eff("1b", "-129", "100", "")});
      e.add(new String[] {m, eff("1b", "1L", "100", "")});
      e.add(new String[] {m, eff("1b", "1.9f", "100", "")});
      e.add(new String[] {m, eff("1b", "-1.9d", "100", "")});
      e.add(new String[] {m, eff("1b", "\"1\"", "100", "")});
      e.add(new String[] {m, eff("1b", "1b", "100b", "")});
      e.add(new String[] {m, eff("1b", "1b", "100s", "")});
      e.add(new String[] {m, eff("1b", "1b", "70000s", "")});
      e.add(new String[] {m, eff("1b", "1b", "-100", "")});
      e.add(new String[] {m, eff("1b", "1b", "0", "")});
      e.add(new String[] {m, eff("1b", "1b", "2147483647", "")});
      e.add(new String[] {m, eff("1b", "1b", "-2147483648", "")});
      e.add(new String[] {m, eff("1b", "1b", "4294967296L", "")});
      e.add(new String[] {m, eff("1b", "1b", "100.7f", "")});
      e.add(new String[] {m, eff("1b", "1b", "100.7d", "")});
      e.add(new String[] {m, eff("1b", "1b", "NaNf", "")});
      e.add(new String[] {m, eff("1b", "1b", "\"100\"", "")});
      e.add(new String[] {m, eff("1b", "1b", "100", ",Ambient:1b")});
      e.add(new String[] {m, eff("1b", "1b", "100", ",Ambient:2b")});
      e.add(new String[] {m, eff("1b", "1b", "100", ",Ambient:1")});
      e.add(new String[] {m, eff("1b", "1b", "100", ",Ambient:256")});
      e.add(new String[] {m, eff("1b", "1b", "100", ",Ambient:\"true\"")});
      e.add(new String[] {m, "{ActiveEffects:[{Id:1b,Duration:100}]}"});
      e.add(new String[] {m, "{ActiveEffects:[{Id:1b,Amplifier:1b}]}"});
      e.add(new String[] {m, "{ActiveEffects:[{Amplifier:1b,Duration:100}]}"});
      e.add(new String[] {m, "{ActiveEffects:[{}]}"});
      e.add(new String[] {m, "{ActiveEffects:[]}"});
      e.add(new String[] {m, "{ActiveEffects:5}"});
      e.add(new String[] {m, "{ActiveEffects:{Id:1b,Amplifier:1b,Duration:100}}"});
      e.add(new String[] {m, "{ActiveEffects:[1,2]}"});
      e.add(new String[] {m, "{ActiveEffects:[{Id:1b,Amplifier:1b,Duration:100},{Id:1b,Amplifier:3b,Duration:50}]}"});
      e.add(new String[] {m, "{ActiveEffects:[{Id:1b,Amplifier:3b,Duration:50},{Id:1b,Amplifier:1b,Duration:100}]}"});
      e.add(new String[] {m, "{ActiveEffects:[{Id:1b,Amplifier:1b,Duration:100},{Id:2b,Amplifier:0b,Duration:60}]}"});
      e.add(new String[] {m, "{ActiveEffects:[{Id:5b,Amplifier:0b,Duration:60},{Id:1b,Amplifier:1b,Duration:100},{Id:8b,Amplifier:0b,Duration:60}]}"});
      e.add(new String[] {m, "{ActiveEffects:[{Id:21b,Amplifier:2b,Duration:100},{Id:22b,Amplifier:1b,Duration:100},{Id:23b,Amplifier:0b,Duration:100},{Id:24b,Amplifier:0b,Duration:100},{Id:25b,Amplifier:0b,Duration:100},{Id:26b,Amplifier:0b,Duration:100}]}"});
      e.add(new String[] {m, "{ActiveEffects:[{Id:6b,Amplifier:0b,Duration:100},{Id:7b,Amplifier:0b,Duration:100},{Id:10b,Amplifier:0b,Duration:100},{Id:19b,Amplifier:0b,Duration:100},{Id:20b,Amplifier:0b,Duration:100}]}"});
    }
    // Attributes: field widths and shapes
    String mh = "generic.maxHealth";
    for (String t : new String[] {
        "{Attributes:[{Name:\"" + mh + "\",Base:40}]}", "{Attributes:[{Name:\"" + mh + "\",Base:40L}]}", "{Attributes:[{Name:\"" + mh + "\",Base:40s}]}", "{Attributes:[{Name:\"" + mh + "\",Base:40b}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:40.5f}]}", "{Attributes:[{Name:\"" + mh + "\",Base:\"40\"}]}", "{Attributes:[{Name:\"" + mh + "\",Base:1.0E300d}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:1000000000000.0d}]}", "{Attributes:[{Name:\"" + mh + "\",Base:0.0d}]}",
        "{Attributes:[{Name:5,Base:40.0d}]}", "{Attributes:[{Name:\"\",Base:40.0d}]}", "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:5}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:4,Operation:0,UUIDMost:1L,UUIDLeast:2L}]}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:4.0f,Operation:0,UUIDMost:1L,UUIDLeast:2L}]}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:4.0d,Operation:0b,UUIDMost:1L,UUIDLeast:2L}]}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:4.0d,Operation:1L,UUIDMost:1L,UUIDLeast:2L}]}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:4.0d,Operation:-1,UUIDMost:1L,UUIDLeast:2L}]}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:4.0d,Operation:3,UUIDMost:1L,UUIDLeast:2L}]}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:4.0d,Operation:0,UUIDMost:1,UUIDLeast:2}]}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:\"x\",Operation:0,UUIDMost:1L,UUIDLeast:2L}]}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[{Name:5,Amount:4.0d,Operation:0,UUIDMost:1L,UUIDLeast:2L}]}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[{Name:\"\",Amount:4.0d,Operation:0,UUIDMost:1L,UUIDLeast:2L}]}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:-100.0d,Operation:0,UUIDMost:1L,UUIDLeast:2L}]}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:-2.0d,Operation:2,UUIDMost:1L,UUIDLeast:2L}]}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[{Name:\"a\",Amount:1.0d,Operation:0,UUIDMost:1L,UUIDLeast:2L},{Name:\"b\",Amount:2.0d,Operation:0,UUIDMost:1L,UUIDLeast:3L}]}]}",
        "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[1,2]}]}", "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[{}]}]}",
        "{Attributes:[5]}", "{Attributes:[{}]}", "{Attributes:5}", "{Attributes:[{Name:\"generic.movementSpeed\",Base:0.0d}]}", "{Attributes:[{Name:\"generic.knockbackResistance\",Base:-1.0d}]}",
        "{Attributes:[{Name:\"generic.followRange\",Base:3000.0d}]}", "{Attributes:[{Name:\"generic.followRange\",Base:-1.0d}]}", "{Attributes:[{Name:\"generic.maxHealth\",Base:2000000000.0d}]}",
        "{Attributes:[{Name:\"generic.maxHealth\",Base:1.0d}],HealF:20.0f}"})
      for (String m : new String[] {"Zombie", "Cow"}) e.add(new String[] {m, t});
    StringBuilder out = new StringBuilder("{\"edge\":[");
    boolean first = true;
    for (String[] c : e) { out.append(first ? "" : ",").append("[" + q(c[0]) + "," + q(c[1]) + "," + q(Entnbt94Probe.edge(c[0], c[1], false)) + "," + q(Entnbt94Probe.edge(c[0], c[1], true)) + "," + q(Entnbt94Probe.hexW(c[0], c[1])) + "]"); first = false; }
    out.append("],\"effTicks\":[");
    first = true;
    for (String[] c : e) {
      if (!c[1].contains("ActiveEffects")) continue;
      StringBuilder steps = new StringBuilder();
      try {
        List<sa> got = Summon87Probe.summon(c[0], c[1]);
        sa m = got.get(got.size() - 1);
        int done = 0;
        for (int target : new int[] {0, 1, 20}) {
          while (done < target) { m.h(); done++; }
          dh t = new dh(); m.c(t);
          steps.append(steps.length() == 0 ? "" : ",").append("[" + target + "," + q(t.c("ActiveEffects") ? t.a("ActiveEffects").toString() : "none") + "," + q(t.c("HealF") ? t.h("HealF") + "" : "none") + "]");
        }
      } catch (Throwable x) { steps.append(steps.length() == 0 ? "" : ",").append("[-1," + q("!" + x) + ",\"\"]"); }
      out.append(first ? "" : ",").append("[" + q(c[0]) + "," + q(c[1]) + ",[" + steps + "]]"); first = false;
    }
    System.out.println(out.append("]}"));
  }
}
