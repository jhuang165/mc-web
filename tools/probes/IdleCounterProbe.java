import java.lang.reflect.Field;
import java.util.ArrayList;

// WorldServer.updateEntities (mt.h) idle gate, executed on the unchanged 1.7.10 class (batch 35 awayrun5). An instance made with Unsafe.allocateInstance has no
// profiler or server, so a call that gets past the gate and reaches World.updateEntities (ahb.h) throws NullPointerException, while a call stopped by the gate
// returns normally. Per case: the player list (ahb.h) is empty or holds an object, the counter P (mt.P) starts at a value; the output is whether the gate stopped
// the call ("gate") or it went on ("past"), and P afterwards.
public class IdleCounterProbe {
  static Object run(sun.misc.Unsafe u, boolean players, int p) throws Exception {
    Object w = u.allocateInstance(Class.forName("mt"));
    Field list = Class.forName("ahb").getDeclaredField("h"); list.setAccessible(true);
    ArrayList<Object> l = new ArrayList<>(); if (players) l.add(new Object());
    list.set(w, l);
    Field pf = Class.forName("mt").getDeclaredField("P"); pf.setAccessible(true);
    pf.setInt(w, p);
    String out;
    try { Class.forName("mt").getMethod("h").invoke(w); out = "gate"; }
    catch (java.lang.reflect.InvocationTargetException e) { out = e.getCause() instanceof NullPointerException ? "past" : "error:" + e.getCause(); }
    return "{\"players\":" + players + ",\"p\":" + p + ",\"result\":\"" + out + "\",\"pAfter\":" + pf.getInt(w) + "}";
  }
  public static void main(String[] a) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true);
    sun.misc.Unsafe u = (sun.misc.Unsafe) uf.get(null);
    int[] ps = {0, 1, 1198, 1199, 1200, 1201, 5000};
    for (int p : ps) System.out.println(run(u, false, p));
    for (int p : new int[] {0, 700, 1200, 5000}) System.out.println(run(u, true, p));
  }
}
