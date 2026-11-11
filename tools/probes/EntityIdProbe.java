import java.lang.reflect.*;
import java.util.*;

// Unchanged 1.7.10 Entity ids: `Entity.nextEntityID` (sa.b, one static int) is read by the sa constructor (`this.entityId = nextEntityID++`, sa.c), so every entity of every
// world and class draws from one counter. Executed here: probe entities built with different (null) worlds, getEntityId (sa.y), equals and hashCode (both by id), and the
// HashSet iteration order of ids (EntityTracker.trackedEntities is a HashSet<EntityTrackerEntry>, whose hashCode is the entity id: bytecode-read, mn/my).
// Record: ids (consecutive), static counter before/after, equals/hashCode checks, hashset order of the entries for ids n..n+11 and a spread of larger ones.
public class EntityIdProbe {
  public static class TE extends sa {
    public TE(ahb w){super(w);}
    protected void c(){} protected void a(dh d){} protected void b(dh d){}
  }
  static Field fld(Class<?> c,String n)throws Exception{for(;c!=null;c=c.getSuperclass())try{Field f=c.getDeclaredField(n);f.setAccessible(true);return f;}catch(NoSuchFieldException e){}throw new NoSuchFieldException(n);}
  public static void main(String[] a)throws Exception{
    Field counter=fld(sa.class,"b");
    int before=counter.getInt(null);
    List<TE> es=new ArrayList<>();
    for(int i=0;i<12;i++)es.add(new TE(null)); // "worlds" differ only by which world the caller later adds them to: the constructor never sees one
    int after=counter.getInt(null);
    StringBuilder ids=new StringBuilder();
    for(TE e:es){if(ids.length()>0)ids.append(',');ids.append(e.y());}
    boolean eqSelf=es.get(0).equals(es.get(0)),eqOther=es.get(0).equals(es.get(1));
    boolean hashIsId=true;for(TE e:es)hashIsId&=e.hashCode()==e.y();
    // HashSet order for plain Integer hash keys, the order tracked entries iterate in
    Set<Integer> hs=new HashSet<>();for(TE e:es)hs.add(e.hashCode());
    Set<Integer> big=new HashSet<>(Arrays.asList(5,300,17,64,1,257,1000,33,16,18));
    System.out.println("{\"before\":"+before+",\"after\":"+after+",\"ids\":["+ids+"],\"equalsSelf\":"+eqSelf+",\"equalsOther\":"+eqOther+",\"hashIsId\":"+hashIsId+",\"setOrder\":"+hs+",\"setOrderBig\":"+big+"}");
  }
}
