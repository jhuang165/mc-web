import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Executes unchanged ChunkProviderGenerate.populate (aqz) from its first line through the
// water/lava lake gates and eight dungeon attempts. It stops at the first Random draw or World
// call made from a BiomeGenBase or BiomeDecorator frame (biome.decorate). World is a double:
// native terrain/surface/cave/ravine chunks, explicit sky-light and freeze fixtures, real biomes.
public class PopulationStageProbe {
  static String q(String s){return TerrainProbe.q(s);}
  static class Stop extends RuntimeException{}
  static Set<String> decorating=new HashSet<>();static List<aia> decorators=new ArrayList<>();static boolean armed;static Field decoratorWorld,decoratorRandom;
  static final StackWalker walker=StackWalker.getInstance();
  static void check(){if(armed&&walker.walk(s->s.anyMatch(f->decorating.contains(f.getClassName())))){armed=false;throw new Stop();}}
  static class Trace extends Random {
    StringBuilder draws;
    protected int next(int bits){check();return super.next(bits);}
    public int nextInt(int n){int v=super.nextInt(n);if(draws!=null&&walker.walk(s->s.skip(1).findFirst()).get().getClassName().equals("aqz")){if(draws.length()>1)draws.append(',');draws.append('[').append(n).append(',').append(v).append(']');}return v;}
  }
  static int light(int x,int y,int z){return Math.floorMod(x*31+y*7+z*17,5)==0?0:15;}
  static boolean freeze(int x,int y,int z){return Math.floorMod(x*7+z*13,11)==0;}
  static class S extends TerrainProbe.W {
    Map<String,aji[]> chunks;Map<String,aji> edits;Map<String,aor> tiles;MessageDigest calls,writes;int callCount,writeCount;TreeMap<Integer,Integer> ids;boolean building;
    static boolean out(int x,int y,int z){return y<0||y>=256||x< -30000000||z< -30000000||x>=30000000||z>=30000000;}
    static void put(MessageDigest d,int... a){for(int v:a)for(int s=0;s<32;s+=8)d.update((byte)(v>>s));}
    void call(int... a){check();callCount++;put(calls,a);}
    public aji a(int x,int y,int z){call(0,x,y,z);if(out(x,y,z))return aji.e(0);aji b=edits.get(x+","+y+","+z);if(b!=null)return b;
      aji[] c=chunks.get((x>>4)+","+(z>>4));if(c==null)throw new AssertionError("Missing chunk "+x+","+z);b=c[((x&15)*16+(z&15))*256+y];return b==null?aji.e(0):b;}
    public boolean c(int x,int y,int z){return a(x,y,z)==aji.e(0);}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){int id=aji.b(b);call(1,x,y,z,id,meta,flags);if(out(x,y,z))return false;
      String k=x+","+y+","+z;edits.put(k,b);writeCount++;put(writes,x,y,z,id,meta,flags);ids.merge(id,1,Integer::sum);tiles.remove(k);
      if(b==ajn.ae)tiles.put(k,new DungeonProbe.Chest());if(b==ajn.ac)tiles.put(k,new apj());return true;}
    public boolean f(int x,int y,int z){return d(x,y,z,ajn.a,0,3);}
    public int b(ahn l,int x,int y,int z){if(l!=ahn.a)throw new AssertionError();call(2,x,y,z);return light(x,y,z);}
    public ahu a(int x,int z){if(building)return manager.a(x,z);call(3,x,z);return manager.a(x,z);}
    public boolean r(int x,int y,int z){call(4,x,y,z);return freeze(x,y,z);}
    public aor o(int x,int y,int z){call(5,x,y,z);return tiles.get(x+","+y+","+z);}
  }
  // Map-feature stand-ins: they record call order and return without drawing from Random.
  static List<String> structureLog;static boolean villageResult;
  static String log(String n,int x,int z){structureLog.add(q(n+" "+x+" "+z));return n;}
  static class Mine extends asw{public boolean a(ahb w,Random r,int x,int z){log("mineshaft",x,z);return false;}}
  static class Village extends avn{public boolean a(ahb w,Random r,int x,int z){log("village",x,z);return villageResult;}}
  static class Stronghold extends aug{public boolean a(ahb w,Random r,int x,int z){log("stronghold",x,z);return false;}}
  static class Scattered extends atx{public boolean a(ahb w,Random r,int x,int z){log("scattered",x,z);return false;}}
  static int slot(ahu b){ahu[] all=ahu.n();for(int i=0;i<all.length;i++)if(all[i]==b)return i;throw new AssertionError();}
  static S terrain(long seed,int cx,int cz,StringBuilder inputs)throws Exception{
    S w=(S)TerrainProbe.unsafe.allocateInstance(S.class);w.seed=seed;w.manager=new aib(seed,ahm.b);w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(w.info,ahm.b);}
    w.chunks=new HashMap<>();w.edits=new HashMap<>();w.tiles=new LinkedHashMap<>();w.ids=new TreeMap<>();w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");
    w.building=true;TerrainProbe.resetMesa();aqz gen=new aqz(w,seed,false);aqw caves=new aqw();aqs ravines=new aqs();
    for(int x=cx;x<=cx+1;x++)for(int z=cz;z<=cz+1;z++){
      aji[] blocks=new aji[65536];byte[] meta=new byte[65536];((Random)TerrainProbe.get(gen,"i")).setSeed((long)x*341873128712L+(long)z*132897987541L);
      axl.a();gen.a(x,z,blocks);axl.a();gen.a(x,z,blocks,meta,w.manager.b(null,x*16,z*16,16,16));caves.a(null,w,x,z,blocks);ravines.a(null,w,x,z,blocks);w.chunks.put(x+","+z,blocks);
      if(inputs.length()>1)inputs.append(',');inputs.append('[').append(x).append(',').append(z).append(',').append(q(TerrainProbe.hash(blocks))).append(']');
    }
    w.building=false;return w;
  }
  // mode: "none" (mapFeaturesEnabled false), "stubs" (enabled, no structure generated), "village" (village reports true).
  static Map<String,Object> run(long seed,int cx,int cz,String mode,boolean emit)throws Exception{
    StringBuilder inputs=new StringBuilder("[");S w=terrain(seed,cx,cz,inputs);inputs.append(']');
    aqz gen=new aqz(w,seed,!mode.equals("none"));structureLog=new ArrayList<>();villageResult=mode.equals("village");
    if(!mode.equals("none")){TerrainProbe.set(gen,"w",TerrainProbe.unsafe.allocateInstance(Mine.class));TerrainProbe.set(gen,"v",TerrainProbe.unsafe.allocateInstance(Village.class));TerrainProbe.set(gen,"u",TerrainProbe.unsafe.allocateInstance(Stronghold.class));TerrainProbe.set(gen,"x",TerrainProbe.unsafe.allocateInstance(Scattered.class));}
    Trace r=new Trace();r.draws=new StringBuilder("[");TerrainProbe.set(gen,"i",r);
    armed=true;try{gen.a((apu)null,cx,cz);throw new AssertionError("Decoration not reached");}catch(Stop ok){}finally{armed=false;akx.M=false;for(aia d:decorators){decoratorWorld.set(d,null);decoratorRandom.set(d,null);}}
    ahu biome=w.manager.a(cx*16+16,cz*16+16);
    StringBuilder tiles=new StringBuilder("[");int spawners=0;
    for(Map.Entry<String,aor> en:w.tiles.entrySet()){
      if(tiles.length()>1)tiles.append(',');tiles.append('[').append(q(en.getKey())).append(',');
      if(en.getValue() instanceof DungeonProbe.Chest){DungeonProbe.Chest c=(DungeonProbe.Chest)en.getValue();tiles.append(q("chest")).append(",[");for(int i=0;i<27;i++){if(i>0)tiles.append(',');tiles.append(DungeonProbe.stack(c.a(i)));}tiles.append("],[").append(String.join(",",c.calls)).append(']');}
      else{spawners++;tiles.append(q("spawner")).append(',').append(q(((apj)en.getValue()).a().e()));}tiles.append(']');
    }
    StringBuilder ids=new StringBuilder("[");for(Map.Entry<Integer,Integer> e:w.ids.entrySet()){if(ids.length()>1)ids.append(',');ids.append('[').append(e.getKey()).append(',').append(e.getValue()).append(']');}
    String line="{\"kind\":\"stage\",\"worldSeed\":"+q(""+seed)+",\"chunk\":["+cx+","+cz+"],\"mode\":"+q(mode)+",\"biome\":["+slot(biome)+","+biome.ay+"],\"inputs\":"+inputs+",\"draws\":"+r.draws+"],\"structureCalls\":"+structureLog+",\"writeCount\":"+w.writeCount+",\"writeSha1\":"+q(TerrainProbe.hex(w.writes.digest()))+",\"writeIds\":"+ids+"],\"tiles\":"+tiles+"],\"callCount\":"+w.callCount+",\"callSha1\":"+q(TerrainProbe.hex(w.calls.digest()))+",\"nextLong\":"+q(""+r.nextLong())+"}";
    if(emit)System.out.println(line);
    Map<String,Object> m=new HashMap<>();m.put("line",line);m.put("spawners",spawners);m.put("water",w.ids.getOrDefault(aji.b(ajn.j),0));m.put("lava",w.ids.getOrDefault(aji.b(ajn.l),0));m.put("biome",biome);m.put("draws",r.draws.toString());return m;
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();
    Field decoratorField=null;for(Field f:ahu.class.getDeclaredFields())if(f.getType()==aia.class){f.setAccessible(true);decoratorField=f;}
    decoratorWorld=aia.class.getDeclaredField("a");decoratorRandom=aia.class.getDeclaredField("b");decoratorWorld.setAccessible(true);decoratorRandom.setAccessible(true);
    for(ahu b:ahu.n())if(b!=null){for(Class<?> c=b.getClass();c!=Object.class;c=c.getSuperclass())decorating.add(c.getName());aia d=(aia)decoratorField.get(b);decorators.add(d);for(Class<?> c=d.getClass();c!=Object.class;c=c.getSuperclass())decorating.add(c.getName());}
    StringBuilder materials=new StringBuilder("[");for(int id=0;id<256;id++){aji b=aji.e(id);if(b==null)continue;if(materials.length()>1)materials.append(',');materials.append('[').append(id).append(',').append(b.o().a()).append(',').append(b.o().d()).append(']');}
    StringBuilder stops=new StringBuilder("[");for(String c:new TreeSet<>(decorating)){if(stops.length()>1)stops.append(',');stops.append(q(c));}
    System.out.println("{\"kind\":\"config\",\"water\":"+aji.b(ajn.j)+",\"lava\":"+aji.b(ajn.l)+",\"desert\":["+slot(ahu.q)+","+ahu.q.ay+"],\"desertHills\":["+slot(ahu.F)+","+ahu.F.ay+"],\"materials\":"+materials+"],\"stopClasses\":"+stops+"]}");
    long[] seeds={0,8675309,-123456789};
    int dungeons=0;boolean lava=false,lavaHigh=false,lavaHighPass=false,water=false;
    for(long seed:seeds){
      for(int cx=-1;cx<=2;cx++)for(int cz=-1;cz<=2;cz++){Map<String,Object> m=run(seed,cx,cz,"none",true);
        dungeons+=(int)m.get("spawners");lava|=(int)m.get("lava")>0;water|=(int)m.get("water")>0;}
      for(int[] c:new int[][]{{0,0},{1,-1},{-2,3}})for(String mode:new String[]{"stubs","village"})run(seed,c[0],c[1],mode,true);
      // Desert and desert hills skip the water-lake draw; find the nearest chunk of each.
      for(ahu target:new ahu[]{ahu.q,ahu.F}){
        aib manager=new aib(seed,ahm.b);boolean found=false;
        for(int radius=0;radius<=400&&!found;radius++)for(int cx=-radius;cx<=radius&&!found;cx++)for(int cz=-radius;cz<=radius&&!found;cz++){
          if(Math.abs(cx)!=radius&&Math.abs(cz)!=radius)continue;
          if(manager.a(cx*16+16,cz*16+16)==target){run(seed,cx,cz,"none",true);found=true;}
        }
        if(!found)throw new AssertionError("No "+target.ay+" for "+seed);
      }
    }
    // Rare branches: three accepted dungeons in total, an accepted lava lake and a lava gate at y >= 63.
    // Water lakes that are drawn but rejected show as a [4,0] gate draw without water writes.
    for(int i=0;i<4000&&!(dungeons>=3&&lava&&lavaHigh&&lavaHighPass);i++){
      int cx=3+i%40,cz=-20+i/40;Map<String,Object> m=run(8675309,cx,cz,"none",false);String d=(String)m.get("draws");
      boolean nd=dungeons<3&&(int)m.get("spawners")>0,nl=!lava&&(int)m.get("lava")>0,nh=false,np=false;
      // Gate draws (after an optional [4,0]+3 water draws): [8,0],[16,x],[248,a],[a+8,y],[16,z],[10,...] only when y >= 63.
      if(d.contains("[248,")){String[] parts=d.substring(1,d.length()-1).split("\\],\\[");for(int k=0;k+5<parts.length;k++)if(parts[k].startsWith("8,0")&&parts[k+2].startsWith("248,")&&parts[k+5].startsWith("10,")){if(parts[k+5].equals("10,0"))np=!lavaHighPass;else nh=!lavaHigh;break;}}
      if(nd||nl||nh||np){System.out.println(m.get("line"));if(nd)dungeons+=(int)m.get("spawners");lava|=nl;lavaHigh|=nh;lavaHighPass|=np;}
    }
    if(!(dungeons>=3&&lava&&lavaHigh&&lavaHighPass&&water))throw new AssertionError("Coverage "+dungeons+lava+lavaHigh+lavaHighPass+water);
  }
}
