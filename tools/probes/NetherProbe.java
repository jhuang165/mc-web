import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged 1.7.10 ChunkProviderHell (aqv): provideChunk stages (terrain a(II[Block), surface b(II[Block), MapGenCavesHell aqy)
// and populate (WorldGenHellLava, Fire, GlowStone1/2, mushrooms, quartz WorldGenMinable, hidden lava). The nether fortress
// (MapGenNetherBridge, atd) writes only in populate and is replaced by a no-op subclass; a real atd start search over the
// generated area decides whether an origin is fortress-free (only fortress-free origins are recorded).
// World H is SpringProbe's double over real Chunk storage with a WorldProviderHell-shaped provider (hasNoSky, isHellWorld,
// dimension -1). Light is an explicit fixture: full/block 0, saved sky 15 (as PopulationWorldProbe). hellRNG is NOT reseeded
// by populate, so the generation order (all chunks x outer z inner, then populates x outer z inner) is part of the record.
// Unpopulated neighbours are a lazy halo from a second provider (own hellRNG). World.rand is seeded 0.
public class NetherProbe {
  static String q(String s){return TerrainProbe.q(s);}
  public static class NoFortress extends atd {
    public void a(apu p,ahb w,int x,int z,aji[] b){}
    public boolean a(ahb w,Random r,int x,int z){return false;}
  }
  public static class H extends SpringProbe.G {
    aqv halo;
    public boolean c(int x,int z){return true;}
    public apx e(int x,int z){
      apx c=chunks.get(ck(x,z));
      if(c==null){c=halo.d(x,z);c.d=true;chunks.put(ck(x,z),c);}return c;
    }
    public int j(int x,int y,int z){call(3,x,y,z);return 0;}
    public int b(ahn l,int x,int y,int z){call(l==ahn.a?7:6,x,y,z);return l==ahn.a?15:0;}
    public boolean d(sa e){return super.d(e);}
    public ayl a(Class c,String n){return null;}
    public void a(String n,ayl d){}
  }
  static H world(long seed)throws Exception{
    H w=SpringProbe.world(H.class,seed,0L);w.manager=new aib(seed,ahm.b);w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);
    aqo p=(aqo)TerrainProbe.unsafe.allocateInstance(aqp.class);
    TerrainProbe.field(aqo.class,"f").set(p,true);TerrainProbe.field(aqo.class,"g").set(p,true);TerrainProbe.field(aqo.class,"i").set(p,-1);
    TerrainProbe.field(ahb.class,"t").set(w,p);
    return w;
  }
  static aqv provider(H w,long seed,boolean stub)throws Exception{
    aqv g=new aqv(w,seed);if(stub)TerrainProbe.field(aqv.class,"c").set(g,new NoFortress());return g;
  }
  static String hashBlocks(aji[] a)throws Exception{return TerrainProbe.hash(a);}
  static aji[] fromChunk(apx c){aji[] a=new aji[32768];for(int x=0;x<16;x++)for(int z=0;z<16;z++)for(int y=0;y<128;y++)a[(x*16+z)*128+y]=c.a(x,y,z);return a;}
  static String counts(aji[] a){TreeMap<Integer,Integer> m=new TreeMap<>();for(aji b:a){int id=b==null?0:aji.b(b);m.merge(id,1,Integer::sum);}
    StringBuilder s=new StringBuilder("{");for(Map.Entry<Integer,Integer> e:m.entrySet()){if(s.length()>1)s.append(',');s.append('"').append(e.getKey()).append("\":").append(e.getValue());}return s.append('}').toString();}
  static String chunkHash(apx c)throws Exception{
    MessageDigest d=MessageDigest.getInstance("SHA-1");byte[] buf=new byte[65536*4];int k=0;
    for(int x=0;x<16;x++)for(int z=0;z<16;z++)for(int y=0;y<256;y++){int v=aji.b(c.a(x,y,z))|c.c(x,y,z)<<12;buf[k++]=(byte)v;buf[k++]=(byte)(v>>8);buf[k++]=(byte)(v>>16);buf[k++]=(byte)(v>>24);}
    d.update(buf);return TerrainProbe.hex(d.digest());
  }
  static void chunk(long seed,int x,int z)throws Exception{
    H w=world(seed);aqv gen=provider(w,seed,true);aqv staged=provider(w,seed,true);
    Random r=(Random)TerrainProbe.get(staged,"i");r.setSeed((long)x*341873128712L+(long)z*132897987541L);
    aji[] blocks=new aji[32768];staged.a(x,z,blocks);String terrain=hashBlocks(blocks);staged.b(x,z,blocks);String surface=hashBlocks(blocks);
    aqx caves=(aqx)TerrainProbe.get(staged,"t");caves.a(staged,w,x,z,blocks);String carved=hashBlocks(blocks);
    apx c=gen.d(x,z);aji[] fin=fromChunk(c);
    if(!hashBlocks(fin).equals(carved))throw new AssertionError("provideChunk differs from staged "+seed+" "+x+" "+z);
    System.out.println("{\"kind\":\"chunk\",\"seed\":"+q(""+seed)+",\"x\":"+x+",\"z\":"+z+",\"terrainSha1\":"+q(terrain)+",\"surfaceSha1\":"+q(surface)+",\"sha1\":"+q(carved)
      +",\"counts\":"+counts(fin)+",\"nextLong\":"+q(""+((Random)TerrainProbe.get(gen,"i")).nextLong())+"}");
  }
  // Real atd start search (fortress-free test) over the generated area; returns the number of starts found.
  static int fortressStarts(long seed,int cx,int cz,int size)throws Exception{
    H w=world(seed);atd real=new atd();
    for(int x=cx;x<cx+size;x++)for(int z=cz;z<cz+size;z++)real.a(null,w,x,z,new aji[32768]);
    return ((Map)TerrainProbe.get(real,"d")).size();
  }
  static void population(String label,long seed,int size,int popSize,int tries)throws Exception{
    int cx=0,cz=0,found=-1,shifts=0;
    for(;shifts<tries;shifts++){cx=shifts*17-3*(shifts%3);cz=shifts*11-5*(shifts%4);if(fortressStarts(seed,cx,cz,size)==0){found=0;break;}}
    if(found!=0)throw new AssertionError("no fortress-free origin for "+label);
    H w=world(seed);aqv gen=provider(w,seed,true);w.halo=provider(w,seed,true);
    List<String> inputs=new ArrayList<>(),steps=new ArrayList<>(),pops=new ArrayList<>();
    for(int x=cx;x<cx+size;x++)for(int z=cz;z<cz+size;z++){apx c=gen.d(x,z);c.d=true;w.chunks.put(SpringProbe.G.ck(x,z),c);inputs.add("["+x+","+z+","+q(chunkHash(c))+"]");}
    for(int x=cx;x<cx+popSize;x++)for(int z=cz;z<cz+popSize;z++){
      w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");w.callCount=0;w.writeCount=0;
      String traceDir=System.getenv("NETHER_TRACE");if(traceDir!=null)w.trace=new StringBuilder();
      gen.a(gen,x,z);pops.add("["+x+","+z+"]");
      if(traceDir!=null)java.nio.file.Files.write(java.nio.file.Paths.get(traceDir,label+"-"+x+"-"+z+".txt"),w.trace.toString().getBytes());
      steps.add("{\"chunk\":["+x+","+z+"],\"calls\":"+w.callCount+",\"callSha1\":"+q(TerrainProbe.hex(w.calls.digest()))+",\"writes\":"+w.writeCount+",\"writeSha1\":"+q(TerrainProbe.hex(w.writes.digest()))+"}");
    }
    List<String> area=new ArrayList<>();for(int x=cx;x<cx+size;x++)for(int z=cz;z<cz+size;z++)area.add(q(chunkHash(w.e(x,z))));
    System.out.println("{\"kind\":\"population\",\"label\":"+q(label)+",\"seed\":"+q(""+seed)+",\"origin\":["+cx+","+cz+"],\"size\":"+size+",\"populated\":"+popSize+",\"shifts\":"+shifts+",\"fortressStarts\":0,\"inputs\":["+String.join(",",inputs)
      +"],\"steps\":["+String.join(",",steps)+"],\"areaSha1\":["+String.join(",",area)+"],\"pending\":["+w.pending+"],\"hellNextLong\":"+q(""+((Random)TerrainProbe.get(gen,"i")).nextLong())+",\"worldNextLong\":"+q(""+w.s.nextLong())+"}");
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();
    long[] seeds={0,-1,8675309,Long.MIN_VALUE,Long.MAX_VALUE,12345,-987654321987L,42};
    int[][] chunks={{0,0},{1,0},{-1,-1},{5,-7},{-23,17},{100,100},{1874999,-1874999},{-30,2}};
    for(long seed:seeds)for(int[] c:chunks)chunk(seed,c[0],c[1]);
    int i=0;for(long seed:seeds)population("nether-"+(i++),seed,4,3,80);
  }
}
