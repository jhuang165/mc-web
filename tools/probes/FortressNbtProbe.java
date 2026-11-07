import java.io.*;
import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged 1.7.10 Nether fortress persistence (data/Fortress.dat): MapGenNetherBridge (atd) as a MapGenStructure with its
// private MapGenStructureData (avj, field "e" of ave), MapGenNetherBridge.Start (ate), every fortress piece (atg..atw) and the
// unchanged MapGenStructureIO registry, over the FortressProbe/NetherProbe worlds.
// Modes:
//   (no argument)      "driver" records: the real MapGenBase driver (ave.a(apu,ahb,II[aji)) over the FortressProbe centers, the
//                      private data serialised as the raw {data:{Features}} root MapStorage wraps (base64, native HashMap order);
//                      "population" records: real ChunkProviderHell populations around native fortress starts, the data
//                      serialised after the search (created) and after population (start NBT rewritten, flags and removed
//                      pieces), plus the usual replay hashes.
//   dat <dir>          the same populations with the data preloaded from <dir>/<label>.Fortress.dat (gzip, via CompressedStreamTools)
//                      through MapStorage's loader path (avj.a(root.m("data"))) and the unchanged func_143027_a /
//                      MapGenStructureIO.func_143035_a; emits the replay and the native re-serialisation of what was loaded.
public class FortressNbtProbe {
  static String q(String s){return TerrainProbe.q(s);}
  static String b64(byte[] a){return Base64.getEncoder().encodeToString(a);}
  public static class DW extends NetherProbe.H {
    Map<String,ayl> data;
    public ayl a(Class c,String n){return data==null?null:data.get(n);}
  }
  static DW world(long seed,Map<String,ayl> preload)throws Exception{
    DW w=SpringProbe.world(DW.class,seed,0L);w.manager=new aib(seed,ahm.b);w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);
    aqo p=(aqo)TerrainProbe.unsafe.allocateInstance(aqp.class);
    TerrainProbe.field(aqo.class,"f").set(p,true);TerrainProbe.field(aqo.class,"g").set(p,true);TerrainProbe.field(aqo.class,"i").set(p,-1);
    TerrainProbe.field(ahb.class,"t").set(w,p);w.data=preload;
    return w;
  }
  static avj data(ave gen)throws Exception{return (avj)TerrainProbe.field(ave.class,"e").get(gen);}
  static byte[] raw(avj d)throws Exception{
    dh data=new dh();d.b(data);dh root=new dh();root.a("data",data);
    ByteArrayOutputStream b=new ByteArrayOutputStream();du.a(root,(DataOutput)new DataOutputStream(b));return b.toByteArray();
  }
  static String keys(avj d){StringJoiner s=new StringJoiner(",","[","]");for(Object k:d.a().c())s.add(q((String)k));return s.toString();}
  static String mapKeys(ave gen)throws Exception{StringJoiner s=new StringJoiner(",","[","]");for(Object o:FortressProbe.map(gen).values()){avm v=(avm)o;s.add("["+v.e()+","+v.f()+"]");}return s.toString();}
  static String ids(avj d){
    TreeMap<String,Integer> m=new TreeMap<>();dh f=d.a();
    for(Object k:f.c()){dh st=f.m((String)k);m.merge(st.j("id"),1,Integer::sum);du_children(st,m);}
    StringJoiner s=new StringJoiner(",","{","}");for(Map.Entry<String,Integer> e:m.entrySet())s.add(q(e.getKey())+":"+e.getValue());return s.toString();
  }
  static void du_children(dh start,Map<String,Integer> m){
    dq l=start.c("Children",10);for(int i=0;i<l.c();i++)m.merge("piece:"+l.b(i).j("id"),1,Integer::sum);
  }
  // Fortress population as in FortressProbe.population, with the private data captured before and after populate.
  static void population(String label,long seed,int[] hit,int size,int popSize,Map<String,ayl> preload,boolean dat)throws Exception{
    int cx=hit[0]-2,cz=hit[1]-2;
    DW w=world(seed,preload);aqv gen=NetherProbe.provider(w,seed,false);w.halo=NetherProbe.provider(w,seed,false);
    atd bridge=(atd)gen.c;
    List<String> steps=new ArrayList<>();
    for(int x=cx;x<cx+size;x++)for(int z=cz;z<cz+size;z++){apx c=gen.d(x,z);c.d=true;w.chunks.put(SpringProbe.G.ck(x,z),c);}
    avj before=data(bridge);String created=b64(raw(before)),createdKeys=keys(before),createdIds=ids(before),order=mapKeys(bridge);
    for(int x=cx;x<cx+popSize;x++)for(int z=cz;z<cz+popSize;z++){
      w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");w.callCount=0;w.writeCount=0;
      gen.a(gen,x,z);
      steps.add("{\"chunk\":["+x+","+z+"],\"calls\":"+w.callCount+",\"callSha1\":"+q(TerrainProbe.hex(w.calls.digest()))+",\"writes\":"+w.writeCount+",\"writeSha1\":"+q(TerrainProbe.hex(w.writes.digest()))+"}");
    }
    List<String> area=new ArrayList<>();for(int x=cx;x<cx+size;x++)for(int z=cz;z<cz+size;z++)area.add(q(NetherProbe.chunkHash(w.e(x,z))));
    avj after=data(bridge);byte[] populatedRaw=raw(after);
    String replay="\"steps\":["+String.join(",",steps)+"],\"areaSha1\":["+String.join(",",area)+"],\"hellNextLong\":"+q(""+((Random)TerrainProbe.get(gen,"i")).nextLong())+",\"worldNextLong\":"+q(""+w.s.nextLong())
      +",\"mapOrder\":"+order+",\"populatedIds\":"+ids(after);
    System.out.println("{\"kind\":"+q(dat?"dat":"population")+",\"label\":"+q(label)+",\"seed\":"+q(""+seed)+",\"hit\":["+hit[0]+","+hit[1]+"],\"origin\":["+cx+","+cz+"],\"size\":"+size+",\"populated\":"+popSize
      +",\"created\":"+q(created)+",\"createdKeys\":"+createdKeys+",\"createdIds\":"+createdIds+",\"populatedData\":"+q(b64(populatedRaw))
      +(dat?"":",\"populatedGzip\":"+q(b64(du.a(rootOf(after)))))+","+replay+"}");
  }
  static dh rootOf(avj d){dh data=new dh();d.b(data);dh root=new dh();root.a("data",data);return root;}
  static void driver(long seed,String label,int[][] centers)throws Exception{
    DW w=world(seed,null);atd m=new atd();
    for(int[] c:centers)m.a((apu)null,w,c[0],c[1],(aji[])null);
    avj d=data(m);
    System.out.println("{\"kind\":\"driver\",\"label\":"+q(label)+",\"worldSeed\":"+q(""+seed)+",\"centers\":"+Arrays.deepToString(centers)+",\"data\":"+q(b64(raw(d)))+",\"keys\":"+keys(d)+",\"ids\":"+ids(d)+",\"mapOrder\":"+mapKeys(m)+"}");
  }
  static avj load(dh root)throws Exception{avj d=new avj("Fortress");d.a(root.m("data"));return d;}
  static final long[] POP_SEEDS={0,17,8675309,-123456789,2,1};
  static int[][] popHit(int index)throws Exception{
    long s=index<6?POP_SEEDS[index]:index==6?8675309:0;int pick=index<6?0:1;
    return new int[][]{FortressProbe.hits(s,-64,-64,128)[pick]};
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();
    boolean dat=args.length>1&&args[0].equals("dat");
    String only=System.getenv("FORTRESS_NBT_POP"); // one population index per JVM (native class statics leak between worlds)
    if(only==null&&!dat){
      long[] seeds={0,17,8675309,-123456789,Long.MIN_VALUE,Long.MAX_VALUE,1,2,3,5,7,11,-1,-42,123456789012345L,99999};
      for(long s:seeds){
        int[][] h=FortressProbe.hits(s,-64,-64,128);
        driver(s,"native:"+s,new int[][]{h[0],{h[0][0]+5,h[0][1]-3},h[1],{h[1][0]-8,h[1][1]+8},h[2]});
      }
      return;
    }
    int index=Integer.parseInt(only);
    int[] hit=popHit(index)[0];long seed=index<6?POP_SEEDS[index]:index==6?8675309:0;
    String label="fortress-"+index+":"+hit[0]+","+hit[1];
    if(dat){
      Map<String,ayl> preload=new HashMap<>();
      try(InputStream in=new FileInputStream(new File(args[1],label+".Fortress.dat"))){preload.put("Fortress",load(du.a(in)));}
      population(label,seed,hit,6,5,preload,true);
    } else population(label,seed,hit,6,5,null,false);
  }
}
