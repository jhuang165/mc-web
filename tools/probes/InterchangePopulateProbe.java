import java.lang.reflect.*;
import java.util.*;

// Imported-chunk population (batch 27 interchange4), Minecraft Java 1.7.10. A rectangle of chunks is "stored": every one is
// generated with the unchanged ChunkProviderGenerate.provideChunk (terrain, caves, ravines, structure start search) and held
// like disk content, then the chunks are LOADED in x-outer, z-inner order. Loading calls the unchanged native
// Chunk.populateChunk (apx.a(apu,apu,II)) against an apu proxy whose chunkExists is the loaded set and whose populate is
// ChunkProviderServer.populate (set isTerrainPopulated, then the unchanged ChunkProviderGenerate.populate). Some chunks start
// with TerrainPopulated=true (saved populated) and holes leave chunks out of the stored set. Chunks outside the stored set are the
// lazy halo (generated terrain); the halo is dropped after every populate call, the model src/imported-population.js uses.
// Output: populate order, per-chunk SHA-1 of (id | meta << 12), final flags, tile entities and spawned entity counts.
public class InterchangePopulateProbe {
  static String q(String s){return TerrainProbe.q(s);}
  static String tiles(PopulationWorldProbe.W w,Set<Long> stored){
    List<aor> all=new ArrayList<>();for(Map.Entry<Long,apx> e:w.chunks.entrySet())if(stored.contains(e.getKey()))for(Object o:e.getValue().i.values())all.add((aor)o);
    all.sort(Comparator.<aor>comparingInt(t->t.c).thenComparingInt(t->t.e).thenComparingInt(t->t.d));
    List<String> out=new ArrayList<>();for(aor t:all){
      if(t instanceof apj)out.add("["+t.c+","+t.d+","+t.e+",\"spawner\","+q(((apj)t).a().e())+"]");
      else if(t instanceof aow){List<String> slots=new ArrayList<>();for(int i=0;i<27;i++)slots.add(MineshaftProbe.stack(((aow)t).a(i)));
        out.add("["+t.c+","+t.d+","+t.e+",\"chest\","+w.e(t.c,t.d,t.e)+",["+String.join(",",slots)+"]]");}
      else out.add("["+t.c+","+t.d+","+t.e+",\"other\","+q(t.getClass().getName())+"]");
    }return "["+String.join(",",out)+"]";
  }
  static void run(String label,long seed,String typeName,boolean mapFeatures,int cx,int cz,int sx,int sz,int populatedMod,int[][] holes)throws Exception{
    ahm type=typeName.equals("default")?ahm.b:typeName.equals("amplified")?ahm.e:ahm.d;
    TerrainProbe.resetMesa(); PopulationWorldProbe.W w=SpringProbe.world(PopulationWorldProbe.W.class,seed,0L);
    w.carts=new ArrayList<>();w.animals=new ArrayList<>();w.manager=new aib(seed,type);
    w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);TerrainProbe.set(w.info,"a",seed);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(w.info,type);}
    final aqz gen=new aqz(w,seed,mapFeatures);w.halo=new aqz(w,seed,false);
    Set<Long> hole=new HashSet<>();for(int[] h:holes)hole.add(SpringProbe.G.ck(h[0],h[1]));
    List<int[]> order=new ArrayList<>();Set<Long> stored=new HashSet<>();Map<Long,int[]> pos=new HashMap<>();
    List<String> inputs=new ArrayList<>(),presets=new ArrayList<>();
    for(int x=cx;x<cx+sx;x++)for(int z=cz;z<cz+sz;z++){
      long k=SpringProbe.G.ck(x,z);if(hole.contains(k))continue;
      apx c=gen.d(x,z);c.d=false;c.k=populatedMod>0&&Math.floorMod(x+z,populatedMod)==0;
      w.chunks.put(k,c);stored.add(k);pos.put(k,new int[]{x,z});
      inputs.add("["+x+","+z+","+q(MineshaftWorldProbe.chunkHash(c))+","+(c.k?1:0)+"]");
    }
    final Set<Long> loaded=new HashSet<>();final List<String> calls=new ArrayList<>();
    final akx dummy=null;
    apu proxy=(apu)Proxy.newProxyInstance(apu.class.getClassLoader(),new Class<?>[]{apu.class},(p,m,a)->{
      Class<?>[] t=m.getParameterTypes();
      if(t.length==2&&t[0]==int.class&&m.getReturnType()==boolean.class)return loaded.contains(SpringProbe.G.ck((Integer)a[0],(Integer)a[1]));
      if(t.length==2&&t[0]==int.class&&m.getReturnType()==apx.class)return w.chunks.get(SpringProbe.G.ck((Integer)a[0],(Integer)a[1]));
      if(t.length==3&&t[0]==apu.class){
        int x=(Integer)a[1],z=(Integer)a[2];apx c=w.chunks.get(SpringProbe.G.ck(x,z));
        if(!c.k){
          c.k=true;calls.add("["+x+","+z+"]");
          w.chunks.keySet().retainAll(stored);
          akx.M=true;try{gen.a(gen,x,z);}finally{akx.M=false;}
          w.chunks.keySet().retainAll(stored);
        }
        return null;
      }
      Class<?> r=m.getReturnType();if(r==boolean.class)return false;if(r==int.class)return 0;return null;
    });
    for(int x=cx;x<cx+sx;x++)for(int z=cz;z<cz+sz;z++){
      long k=SpringProbe.G.ck(x,z);if(!stored.contains(k))continue;
      loaded.add(k);w.chunks.get(k).d=true;w.chunks.get(k).a(proxy,proxy,x,z);
    }
    List<String> out=new ArrayList<>();
    for(int x=cx;x<cx+sx;x++)for(int z=cz;z<cz+sz;z++){long k=SpringProbe.G.ck(x,z);if(!stored.contains(k))continue;apx c=w.chunks.get(k);
      out.add("["+x+","+z+","+q(MineshaftWorldProbe.chunkHash(c))+","+(c.k?1:0)+"]");}
    if(label.equals(System.getenv("INTERCHANGE_DUMP"))){
      for(String dc:System.getenv("INTERCHANGE_CHUNKS").split(";")){String[] pc=dc.split(",");int[] d={Integer.parseInt(pc[0]),Integer.parseInt(pc[1])};{apx c=w.chunks.get(SpringProbe.G.ck(d[0],d[1]));byte[] b=new byte[65536*2];int k=0;
        for(int x=0;x<16;x++)for(int z=0;z<16;z++)for(int y=0;y<256;y++){b[k++]=(byte)aji.b(c.a(x,y,z));b[k++]=(byte)c.c(x,y,z);}
        System.err.println("DUMP "+d[0]+","+d[1]+" "+Base64.getEncoder().encodeToString(b));}}
    }
    StringJoiner hs=new StringJoiner(",","[","]");for(int[] h:holes)hs.add("["+h[0]+","+h[1]+"]");
    System.out.println("{\"label\":"+q(label)+",\"seed\":"+q(""+seed)+",\"type\":"+q(typeName)+",\"mapFeatures\":"+mapFeatures+",\"origin\":["+cx+","+cz+"],\"size\":["+sx+","+sz+"],\"populatedMod\":"+populatedMod+",\"holes\":"+hs+",\"inputs\":["+String.join(",",inputs)+"],\"calls\":["+String.join(",",calls)+"],\"chunks\":["+String.join(",",out)+"],\"tiles\":"+tiles(w,stored)+",\"animals\":"+w.animals.size()+",\"carts\":"+w.carts.size()+"}");
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();
    run("all-unpopulated",0L,"default",true,-6,10,6,6,0,new int[0][]);
    run("checker-populated",17L,"default",true,-25,5,5,6,3,new int[0][]);
    run("holes-largebiomes-nomap",17L,"largeBiomes",false,10,-53,6,5,0,new int[][]{{12,-51},{14,-50}});
    run("amplified-flowing-lava",5L,"amplified",false,0,-1,6,6,4,new int[0][]);
    run("structures-seed17",17L,"default",true,-8,-57,8,8,0,new int[0][]);
    run("structures-seed0-holes",0L,"default",true,-21,16,7,7,5,new int[][]{{-19,19}});
  }
}
