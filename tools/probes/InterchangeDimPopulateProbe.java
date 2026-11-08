import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Imported Nether and End chunk population (batch 28 interchange5), Minecraft Java 1.7.10. Like InterchangePopulateProbe, a rectangle of
// chunks is "stored": every one is generated with the unchanged provideChunk (Nether: ChunkProviderHell aqv with the real
// MapGenNetherBridge atd search; End: ChunkProviderEnd ara) and held like disk content, then the chunks are LOADED x outer, z inner.
// Loading calls the unchanged native Chunk.populateChunk (apx.a(apu,apu,II)) against an apu proxy whose chunkExists is the loaded set and
// whose populate is ChunkProviderServer.populate (set isTerrainPopulated, then the unchanged provider populate).
//   Nether: the populating provider is a FRESH ChunkProviderHell (a server that just started: hellRNG is the constructor state, no
//   provideChunk has reseeded it) that shares the generating provider's fortress start map (Fortress.dat holds the starts across a restart).
//   hellRNG then carries over every populate call, as natively. World.rand is Random(0) once (natively time-seeded).
//   End: ChunkProviderEnd.populate draws from World.rand (natively time-seeded), so the proxy seeds World.rand before each populate call
//   with seed ^ (x * 341873128712 + z * 132897987541), the stable per-chunk seed dimension-world.js already uses.
// Chunks outside the stored set are the lazy halo (generated terrain, dropped after every populate call).
// Output: populate order, per-chunk SHA-1 of (id | meta << 12) over 256 heights, final flags, tile entities, entities, pending ticks.
public class InterchangeDimPopulateProbe {
  static String q(String s){return TerrainProbe.q(s);}
  static String chunkHash(apx c)throws Exception{
    MessageDigest d=MessageDigest.getInstance("SHA-1");byte[] buf=new byte[65536*4];int k=0;
    for(int x=0;x<16;x++)for(int z=0;z<16;z++)for(int y=0;y<256;y++){int v=aji.b(c.a(x,y,z))|c.c(x,y,z)<<12;buf[k++]=(byte)v;buf[k++]=(byte)(v>>8);buf[k++]=(byte)(v>>16);buf[k++]=(byte)(v>>24);}
    d.update(buf);return TerrainProbe.hex(d.digest());
  }
  static String tiles(Map<Long,apx> chunks,SpringProbe.G w,Set<Long> stored){
    List<aor> all=new ArrayList<>();for(Map.Entry<Long,apx> e:chunks.entrySet())if(stored.contains(e.getKey()))for(Object o:e.getValue().i.values())all.add((aor)o);
    all.sort(Comparator.<aor>comparingInt(t->t.c).thenComparingInt(t->t.e).thenComparingInt(t->t.d));
    List<String> out=new ArrayList<>();for(aor t:all){
      if(t instanceof apj)out.add("["+t.c+","+t.d+","+t.e+",\"spawner\","+q(((apj)t).a().e())+"]");
      else if(t instanceof aow){List<String> slots=new ArrayList<>();for(int i=0;i<27;i++)slots.add(MineshaftProbe.stack(((aow)t).a(i)));
        out.add("["+t.c+","+t.d+","+t.e+",\"chest\","+w.e(t.c,t.d,t.e)+",["+String.join(",",slots)+"]]");}
      else out.add("["+t.c+","+t.d+","+t.e+",\"other\","+q(t.getClass().getName())+"]");
    }return "["+String.join(",",out)+"]";
  }
  interface Populator{void populate(int x,int z)throws Exception;}
  static void run(String dim,String label,long seed,int cx,int cz,int sx,int sz,int populatedMod,int[][] holes,boolean[] opts)throws Exception{
    boolean nether=dim.equals("nether");
    SpringProbe.G w;Object genProv;Populator populator;final List<String> ents=new ArrayList<>();
    final Map<Long,apx> chunks;
    final StringBuilder pend;
    if(nether){
      NetherProbe.H h=NetherProbe.world(seed);aqv gen=NetherProbe.provider(h,seed,false);h.halo=NetherProbe.provider(h,seed,true);
      aqv fresh=NetherProbe.provider(h,seed,false);TerrainProbe.field(aqv.class,"c").set(fresh,TerrainProbe.get(gen,"c"));
      w=h;genProv=gen;populator=(x,z)->fresh.a(fresh,x,z);
    }else{
      EndProbe.W e=EndProbe.world(seed,0,true);w=e;genProv=e.gen;
      final EndProbe.W ew=e;
      populator=(x,z)->{EndProbe.setRand(ew,seed^((long)x*341873128712L+(long)z*132897987541L));ew.spawned.clear();ew.gen.a(ew.gen,x,z);ents.addAll(ew.spawned);};
    }
    chunks=nether?((NetherProbe.H)w).chunks:((EndProbe.W)w).chunks;
    final SpringProbe.G fw=w;
    Set<Long> hole=new HashSet<>();for(int[] hh:holes)hole.add(SpringProbe.G.ck(hh[0],hh[1]));
    final Set<Long> stored=new HashSet<>();List<String> inputs=new ArrayList<>();
    for(int x=cx;x<cx+sx;x++)for(int z=cz;z<cz+sz;z++){
      long k=SpringProbe.G.ck(x,z);if(hole.contains(k))continue;
      apx c=nether?((aqv)genProv).d(x,z):((ara)genProv).d(x,z);c.d=false;c.k=populatedMod>0&&Math.floorMod(x+z,populatedMod)==0;
      chunks.put(k,c);stored.add(k);
      inputs.add("["+x+","+z+","+q(chunkHash(c))+","+(c.k?1:0)+"]");
    }
    final Set<Long> loaded=new HashSet<>();final List<String> calls=new ArrayList<>();
    final Populator pop=populator;
    apu proxy=(apu)Proxy.newProxyInstance(apu.class.getClassLoader(),new Class<?>[]{apu.class},(p,m,a)->{
      Class<?>[] t=m.getParameterTypes();
      if(t.length==2&&t[0]==int.class&&m.getReturnType()==boolean.class)return loaded.contains(SpringProbe.G.ck((Integer)a[0],(Integer)a[1]));
      if(t.length==2&&t[0]==int.class&&m.getReturnType()==apx.class)return chunks.get(SpringProbe.G.ck((Integer)a[0],(Integer)a[1]));
      if(t.length==3&&t[0]==apu.class){
        int x=(Integer)a[1],z=(Integer)a[2];apx c=chunks.get(SpringProbe.G.ck(x,z));
        if(!c.k){
          c.k=true;calls.add("["+x+","+z+"]");
          chunks.keySet().retainAll(stored);
          pop.populate(x,z);
          chunks.keySet().retainAll(stored);
        }
        return null;
      }
      Class<?> r=m.getReturnType();if(r==boolean.class)return false;if(r==int.class)return 0;return null;
    });
    for(int x=cx;x<cx+sx;x++)for(int z=cz;z<cz+sz;z++){
      long k=SpringProbe.G.ck(x,z);if(!stored.contains(k))continue;
      loaded.add(k);chunks.get(k).d=true;chunks.get(k).a(proxy,proxy,x,z);
    }
    List<String> out=new ArrayList<>();
    for(int x=cx;x<cx+sx;x++)for(int z=cz;z<cz+sz;z++){long k=SpringProbe.G.ck(x,z);if(!stored.contains(k))continue;apx c=chunks.get(k);
      out.add("["+x+","+z+","+q(chunkHash(c))+","+(c.k?1:0)+"]");}
    StringJoiner hs=new StringJoiner(",","[","]");for(int[] hh:holes)hs.add("["+hh[0]+","+hh[1]+"]");
    System.out.println("{\"dim\":"+q(dim)+",\"label\":"+q(label)+",\"seed\":"+q(""+seed)+",\"origin\":["+cx+","+cz+"],\"size\":["+sx+","+sz+"],\"populatedMod\":"+populatedMod+",\"holes\":"+hs+",\"inputs\":["+String.join(",",inputs)+"],\"calls\":["+String.join(",",calls)+"],\"chunks\":["+String.join(",",out)+"],\"tiles\":"+tiles(chunks,w,stored)+",\"entities\":["+String.join(",",ents)+"],\"pending\":["+w.pending+"]}");
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();
    boolean[] none=new boolean[0];
    String only=System.getenv("DIM_ONLY");
    if(only==null||only.equals("nether")){
      run("nether","all-unpopulated",0L,-4,3,6,6,0,new int[0][],none);
      run("nether","checker-populated",17L,-9,2,5,6,3,new int[0][],none);
      run("nether","holes",8675309L,10,-13,6,5,0,new int[][]{{12,-11},{14,-10}},none);
      run("nether","big-seed42",42L,-10,-10,12,12,0,new int[0][],none);
      run("nether","big-seed5-holes",5L,-1,-14,12,12,5,new int[][]{{3,-8}},none);
    }
    if(only==null||only.equals("end")){
      run("end","origin-dragon",0L,-3,-3,6,6,0,new int[0][],none);
      run("end","checker",42L,-5,2,6,5,3,new int[0][],none);
      run("end","holes-negative",-1L,-6,-8,7,6,0,new int[][]{{-3,-5},{-2,-4}},none);
      run("end","big",8675309L,0,0,10,10,0,new int[0][],none);
    }
  }
}
