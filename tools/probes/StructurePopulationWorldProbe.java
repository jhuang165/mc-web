import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged ChunkProviderGenerate.provideChunk + populate, all four structure
// maps enabled. Map feature calls are traced at their native entry points; all
// block writes, tiles, entities, pending ticks, drops and both RNG streams use
// the same World/Chunk doubles as the previous mineshaft population probe.
public class StructurePopulationWorldProbe {
  static List<String> searchOrder = new ArrayList<>(), populateOrder = new ArrayList<>(), populateResults = new ArrayList<>();
  static String q(String s) { return TerrainProbe.q(s); }
  static class M extends asw { public void a(apu p,ahb w,int x,int z,aji[] b){searchOrder.add("mineshaft");super.a(p,w,x,z,b);} public boolean a(ahb w,Random r,int x,int z){populateOrder.add("mineshaft");boolean v=super.a(w,r,x,z);populateResults.add("mineshaft:"+v);return v;} }
  static class V extends avn { public void a(apu p,ahb w,int x,int z,aji[] b){searchOrder.add("village");super.a(p,w,x,z,b);} public boolean a(ahb w,Random r,int x,int z){populateOrder.add("village");boolean v=super.a(w,r,x,z);populateResults.add("village:"+v);return v;} }
  static class S extends aug { public void a(apu p,ahb w,int x,int z,aji[] b){searchOrder.add("stronghold");super.a(p,w,x,z,b);} public boolean a(ahb w,Random r,int x,int z){populateOrder.add("stronghold");boolean v=super.a(w,r,x,z);populateResults.add("stronghold:"+v);return v;} }
  static class T extends atx { public void a(apu p,ahb w,int x,int z,aji[] b){searchOrder.add("scatteredFeature");super.a(p,w,x,z,b);} public boolean a(ahb w,Random r,int x,int z){populateOrder.add("scatteredFeature");boolean v=super.a(w,r,x,z);populateResults.add("scatteredFeature:"+v);return v;} }
  static Map<?,?> map(ave generator) throws Exception { return (Map<?,?>)TerrainProbe.field(ave.class,"d").get(generator); }
  static String starts(ave gen)throws Exception {
    StringJoiner rows=new StringJoiner(",","[","]");
    for(Object o:map(gen).values()){avm s=(avm)o;asv b=s.a();rows.add("[["+s.e()+","+s.f()+"],["+b.a+","+b.b+","+b.c+","+b.d+","+b.e+","+b.f+"],"+s.b().size()+"]");}
    return rows.toString();
  }
  static String mapRows(aqz gen)throws Exception {
    return "{\"mineshaft\":"+starts((ave)TerrainProbe.get(gen,"w"))+",\"village\":"+starts((ave)TerrainProbe.get(gen,"v"))+",\"stronghold\":"+starts((ave)TerrainProbe.get(gen,"u"))+",\"scatteredFeature\":"+starts((ave)TerrainProbe.get(gen,"x"))+"}";
  }
  static String list(List<String> strings){StringJoiner s=new StringJoiner(",","[","]");for(String v:strings)s.add(q(v));return s.toString();}
  static String entities(PopulationWorldProbe.W w){StringJoiner out=new StringJoiner(",","[","]");for(sa e:w.animals){String name=PopulationTailProbe.NAMES.get(e.getClass());if(name==null&&e instanceof yv)name="Villager";if(name==null)name=e.getClass().getSimpleName();int profession=e instanceof yv?((yv)e).bZ():-1;out.add("["+q(name)+","+e.s+","+e.t+","+e.u+","+Float.floatToIntBits(e.y)+","+profession+"]");}return out.toString();}
  static String step(PopulationWorldProbe.W w, aqz gen, int x, int z)throws Exception {
    w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");w.callCount=0;w.writeCount=0;
    searchOrder.clear(); populateOrder.clear(); populateResults.clear();
    Random random=(Random)TerrainProbe.get(gen,"i");
    gen.a(gen,x,z);
    return "{\"chunk\":["+x+","+z+"],\"searchOrder\":"+list(searchOrder)+",\"populateOrder\":"+list(populateOrder)+",\"populateResults\":"+list(populateResults)+",\"callCount\":"+w.callCount+",\"callsSha1\":"+q(TerrainProbe.hex(w.calls.digest()))+",\"writeCount\":"+w.writeCount+",\"writesSha1\":"+q(TerrainProbe.hex(w.writes.digest()))+",\"providerNextLong\":"+q(""+random.nextLong())+"}";
  }
  static void run(long seed,String typeName,int cx,int cz)throws Exception {
    ahm type=typeName.equals("default")?ahm.b:typeName.equals("amplified")?ahm.e:ahm.d;
    TerrainProbe.resetMesa(); PopulationWorldProbe.W w=SpringProbe.world(PopulationWorldProbe.W.class,seed,0L);
    w.carts=new ArrayList<>();w.animals=new ArrayList<>();w.manager=new aib(seed,type);
    w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);TerrainProbe.set(w.info,"a",seed);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(w.info,type);}
    aqz gen=new aqz(w,seed,true);w.halo=new aqz(w,seed,false);
    TerrainProbe.set(gen,"w",new M());TerrainProbe.set(gen,"v",new V());TerrainProbe.set(gen,"u",new S());TerrainProbe.set(gen,"x",new T());
    searchOrder.clear(); apx chunk=gen.d(cx,cz);String search=list(searchOrder);chunk.d=true;w.chunks.put(SpringProbe.G.ck(cx,cz),chunk);
    String input=MineshaftWorldProbe.chunkHash(chunk);
    List<String> step=new ArrayList<>(); akx.M=true;
    try { step.add(step(w,gen,cx,cz)); } finally { akx.M=false; }
    String tileData=PopulationWorldProbe.tiles(w);
    String area=MineshaftWorldProbe.chunkHash(w.e(cx,cz));
    System.out.println("{\"kind\":\"area\",\"seed\":"+q(""+seed)+",\"type\":"+q(typeName)+",\"chunk\":["+cx+","+cz+"],\"searchOrder\":"+search+",\"inputSha1\":"+q(input)+",\"steps\":["+String.join(",",step)+"],\"starts\":"+mapRows(gen)+",\"tiles\":"+tileData+",\"entities\":"+entities(w)+",\"carts\":["+String.join(",",w.carts)+"],\"pending\":["+w.pending+"],\"drops\":["+w.drops+"],\"areaSha1\":"+q(area)+",\"worldNextLong\":"+q(""+((Random)TerrainProbe.get(w,"s")).nextLong())+"}");
  }
  public static void main(String[] args)throws Exception {
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();
    run(0L,"default",-19,18);run(17L,"default",-25,5);run(17L,"default",-4,-55);run(17L,"default",10,-53);run(0L,"default",0,-1);
  }
}
