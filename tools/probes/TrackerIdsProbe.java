import java.lang.reflect.*;
import java.util.*;

// Batch 50 (trackerids): ONE EntityTracker holds every tracked entity in one HashSet, numbered by the one Entity.nextEntityID counter (sa.b; the sa constructor post-increments it).
// This probe runs the REAL EntityTrackerEntry `my` (hashCode = entity id) for entities of two unrelated classes built through the real sa constructor in a scripted spawn order
// (the "mob" class and the "object" class, interleaved), adds each entry to ONE real java.util.HashSet as trackEntity does, removes some as untrackEntity does, and records after every
// step the ids, their kind and the set's iteration order. src/tracker-ids-b50.test.js replays the same script through the port's mob tracker and object tracker sharing one id counter
// and one JavaHashSetOrder and compares the combined walk.
public class TrackerIdsProbe {
  public static class Mob extends sa { public Mob(ahb w) { super(w); } protected void c() {} protected void a(dh d) {} protected void b(dh d) {} }
  public static class Obj extends sa { public Obj(ahb w) { super(w); } protected void c() {} protected void a(dh d) {} protected void b(dh d) {} }
  static String run(String name, String script) throws Exception {
    // script tokens: m = spawn a mob, o = spawn an object, -N = untrack the Nth spawned entity (1-based)
    Set<my> set = new HashSet<>();
    List<my> entries = new ArrayList<>();
    StringBuilder steps = new StringBuilder("["), orders = new StringBuilder("["), ids = new StringBuilder("[");
    boolean first = true;
    for (String tok : script.split(" ")) {
      if (tok.startsWith("-")) { my m = entries.get(Integer.parseInt(tok.substring(1)) - 1); set.remove(m); }
      else {
        sa e = tok.equals("m") ? new Mob(null) : new Obj(null);
        my m = new my(e, 80, 3, true);
        entries.add(m); set.add(m);
        ids.append(entries.size() > 1 ? "," : "").append(e.y());
      }
      StringBuilder o = new StringBuilder("[");
      boolean f = true;
      for (my m : set) { if (!f) o.append(','); f = false; o.append(m.a.y()); }
      if (!first) { steps.append(','); orders.append(','); }
      first = false;
      steps.append('"').append(tok).append('"');
      orders.append(o).append(']');
    }
    return "{\"case\":\"" + name + "\",\"javaVersion\":\"" + System.getProperty("java.version") + "\",\"steps\":" + steps + "],\"ids\":" + ids + "],\"orders\":" + orders + "]}";
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    Field counter = null; for (Class<?> c = sa.class; counter == null; c = c.getSuperclass()) try { counter = c.getDeclaredField("b"); } catch (NoSuchFieldException x) {}
    counter.setAccessible(true); counter.setInt(null, 1); // a world's first entity is id 1 for the port's counter
    System.out.println(run("interleaved", "m o m o o m o m m o"));
    // enough entities of both kinds to pass the 12 -> 24 -> 48 resize thresholds, removals in the middle
    counter.setInt(null, 1);
    StringBuilder b = new StringBuilder();
    for (int i = 0; i < 50; i++) b.append(i % 3 == 0 ? "m " : "o ");
    b.append("-3 -4 -20 -21 m o -40 o o");
    System.out.println(run("grown", b.toString().trim()));
    // the counter past 65536 (spread folds the high half in) and a world whose first entity was long ago: ids 65525.. with a mixed spawn/untrack history
    counter.setInt(null, 65525);
    System.out.println(run("high", "m o o m m o m o o m -2 -5 o m m o o m o m m o o m -9 m o"));
    counter.setInt(null, 1 << 20);
    System.out.println(run("million", "o m o m o o m m o o m o m o -4 -8 m m o o m o"));
  }
}
