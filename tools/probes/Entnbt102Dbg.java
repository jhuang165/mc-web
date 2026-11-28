import java.util.*;
// Batch 102 entnbt102: prints the cause of a failing summon/save (villager Offers rows crashed on save in Entnbt102Probe).
public class Entnbt102Dbg {
  public static void main(String[] a) throws Exception {
    Summon86Probe.setup();
    CmdExec83Probe.fresh("solo");
    for (int i = 1; i < a.length; i++) {
      System.out.println("== " + a[i]);
      try {
        List<sa> got = Summon87Probe.summon(a[0], a[i]);
        dh t = new dh(); got.get(got.size() - 1).c(t);
        System.out.println(Entnbt94Probe.sorted(t));
      } catch (Throwable x) { Throwable c = x; while (c.getCause() != null) c = c.getCause(); System.out.println("!" + c); StackTraceElement[] st = c.getStackTrace(); for (int k = 0; k < Math.min(6, st.length); k++) System.out.println("   " + st[k]); }
    }
  }
}
