import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged 1.7.10 MapGenBase/MapGenStructure/MapGenMineshaft (aqx/ave/asw), StructureStart (avm),
// StructureMineshaftStart (atc), StructureComponent (avk), StructureBoundingBox (asv) and the
// mineshaft pieces (asx/asy/asz/ata/atb) with WeightedRandomChestContent (qx). The World is an
// explicit block-access double: synthetic fixtures or native terrain/surface/cave/ravine chunks.
// MapGenStructureData persistence is stubbed (loadItemData null, setItemData ignored).
public class MineshaftProbe {
  static String jstr(String s){return TerrainProbe.q(s);}
  static String key(int x,int y,int z){return x+","+y+","+z;}
  static String stack(add s){
    if(s==null)return "null";
    StringBuilder e=new StringBuilder("[");dq tags=ade.bR.g(s);
    for(int i=0;i<tags.c();i++){if(i>0)e.append(',');dh t=tags.b(i);e.append('[').append(t.e("id")).append(',').append(t.e("lvl")).append(']');}
    return "["+adb.b(s.b())+","+s.b+","+s.k()+","+e+"]]";
  }
  static void put(MessageDigest d,int... a){for(int v:a)for(int s=0;s<32;s+=8)d.update((byte)(v>>s));}
  static int hash3(int x,int y,int z){return (x*73856093)^(y*19349663)^(z*83492791);}
  // Synthetic fixtures, mirrored in src/mineshaft-generator.test.js and src/structure-framework.test.js.
  static int fixture(String f,int x,int y,int z){
    if(f.equals("air"))return 0;
    if(y>63)return 0;
    if(f.equals("stone"))return 1;
    if(f.equals("water"))return Math.floorMod(x*7+z*13,97)==0&&y>=20&&y<=60?9:1;
    int k=hash3(x>>1,y>>1,z>>1)&15;
    return k<=2?0:k==3?20:k==4?13:k==5?18:1; // pockets: air, glass, gravel, leaves, stone
  }
  static class Chest extends aow {
    List<String> calls=new ArrayList<>();
    public void a(int slot,add s){calls.add("["+slot+","+stack(s)+"]");super.a(slot,s);}
    public void e(){}
  }
  static class W extends TerrainProbe.W {
    String fixture;Map<String,aji[]> chunks;Map<String,aji> edits=new HashMap<>();Map<String,aor> tiles=new LinkedHashMap<>();
    MessageDigest calls,writes;int callCount,writeCount;StringBuilder fullWrites;List<String> entities=new ArrayList<>();
    void call(int... a){callCount++;put(calls,a);}
    public aji a(int bx,int by,int bz){call(0,bx,by,bz);if(by<0||by>=256||bx< -30000000||bx>=30000000||bz< -30000000||bz>=30000000)return aji.e(0);
      aji edit=edits.get(key(bx,by,bz));if(edit!=null)return edit;
      if(fixture.equals("natural")){aji[] c=chunks.get((bx>>4)+","+(bz>>4));if(c==null)throw new AssertionError("Missing chunk "+(bx>>4)+","+(bz>>4));aji b=c[((bx&15)*16+(bz&15))*256+by];return b==null?aji.e(0):b;}
      return aji.e(fixture(fixture,bx,by,bz));
    }
    public boolean c(int x,int y,int z){call(1,x,y,z);return a(x,y,z).o()==awt.a;}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){call(2,x,y,z,aji.b(b),meta,flags);if(y<0||y>=256||x< -30000000||x>=30000000||z< -30000000||z>=30000000)return false;
      String k=key(x,y,z);edits.put(k,b);writeCount++;put(writes,x,y,z,aji.b(b),meta,flags);
      if(fullWrites!=null){if(fullWrites.length()>1)fullWrites.append(',');fullWrites.append('[').append(x).append(',').append(y).append(',').append(z).append(',').append(aji.b(b)).append(',').append(meta).append(',').append(flags).append(']');}
      tiles.remove(k);if(b==ajn.ae)tiles.put(k,new Chest());if(b==ajn.ac)tiles.put(k,new apj());return true;
    }
    public ahu a(int x,int z){return manager.a(x,z);}
    public aor o(int x,int y,int z){call(4,x,y,z);return tiles.get(key(x,y,z));}
    public boolean d(sa e){
      call(5,(int)Math.floor(e.s),(int)Math.floor(e.t),(int)Math.floor(e.u));
      if(!(e instanceof xm))throw new AssertionError(e.getClass().getName());
      xm m=(xm)e;StringBuilder s=new StringBuilder("[").append(jstr("MinecartChest")).append(',').append(e.s).append(',').append(e.t).append(',').append(e.u).append(",[");
      for(int i=0;i<m.a();i++){if(i>0)s.append(',');s.append(stack(m.a(i)));}
      entities.add(s.append("]]").toString());return true;
    }
    public ayl a(Class c,String n){return null;}
    public void a(String n,ayl d){}
    String tileList(){StringBuilder s=new StringBuilder("[");
      for(Map.Entry<String,aor> en:tiles.entrySet()){if(s.length()>1)s.append(',');s.append('[').append(jstr(en.getKey())).append(',');
        if(en.getValue() instanceof Chest){Chest c=(Chest)en.getValue();s.append(jstr("chest")).append(",[");for(int i=0;i<27;i++){if(i>0)s.append(',');s.append(stack(c.a(i)));}s.append("],[").append(String.join(",",c.calls)).append(']');}
        else s.append(jstr("spawner")).append(',').append(jstr(((apj)en.getValue()).a().e()));s.append(']');}
      return s.append(']').toString();}
  }
  static W world(long seed,String fixture)throws Exception{
    W w=(W)TerrainProbe.unsafe.allocateInstance(W.class);w.seed=seed;w.fixture=fixture;w.edits=new HashMap<>();w.tiles=new LinkedHashMap<>();w.entities=new ArrayList<>();
    w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");
    TerrainProbe.field(ahb.class,"t").set(w,TerrainProbe.unsafe.allocateInstance(aqq.class));
    for(Field f:ahb.class.getDeclaredFields())if(f.getType()==List.class&&!Modifier.isStatic(f.getModifiers())){f.setAccessible(true);f.set(w,new ArrayList<>());}
    return w;
  }
  static String bb(asv b){return "["+b.a+","+b.b+","+b.c+","+b.d+","+b.e+","+b.f+"]";}
  // Same text as JSON.stringify of the JS piece description.
  static String piece(avk p)throws Exception{
    StringBuilder s=new StringBuilder("[");asv b=p.c();
    String type=p instanceof asy?"MSCorridor":p instanceof asz?"MSCrossing":p instanceof ata?"MSRoom":p instanceof atb?"MSStairs":null;
    if(type==null)throw new AssertionError(p.getClass().getName());
    s.append(jstr(type)).append(',').append(p.g).append(',').append(p.h).append(',').append(b.a).append(',').append(b.b).append(',').append(b.c).append(',').append(b.d).append(',').append(b.e).append(',').append(b.f);
    if(p instanceof asy)s.append(',').append(TerrainProbe.get(p,"a")).append(',').append(TerrainProbe.get(p,"b")).append(',').append(TerrainProbe.get(p,"c")).append(',').append(TerrainProbe.get(p,"d"));
    if(p instanceof asz)s.append(',').append(TerrainProbe.get(p,"a")).append(',').append(TerrainProbe.get(p,"b"));
    if(p instanceof ata){s.append(",[");boolean c=false;for(Object o:(List)TerrainProbe.get(p,"a")){if(c)s.append(',');c=true;s.append(bb((asv)o));}s.append(']');}
    return s.append(']').toString();
  }
  static String pieces(avm st)throws Exception{StringBuilder s=new StringBuilder("[");for(Object o:st.b()){if(s.length()>1)s.append(',');s.append(piece((avk)o));}return s.append(']').toString();}
  static String sha(String s)throws Exception{return TerrainProbe.hex(MessageDigest.getInstance("SHA-1").digest(s.getBytes("UTF-8")));}
  static Map<?,?> map(ave m)throws Exception{return (Map<?,?>)TerrainProbe.field(ave.class,"d").get(m);}
  static Random rand(aqx m)throws Exception{return (Random)TerrainProbe.field(aqx.class,"b").get(m);}
  static String startList(ave m,int full)throws Exception{
    StringBuilder s=new StringBuilder("[");int n=0;
    for(Object o:map(m).values()){avm st=(avm)o;if(s.length()>1)s.append(',');String p=pieces(st);
      s.append("{\"chunk\":[").append(st.e()).append(',').append(st.f()).append("],\"bb\":").append(bb(st.a())).append(",\"pieceCount\":").append(st.b().size()).append(",\"piecesSha1\":").append(jstr(sha(p)));
      if(n++<full)s.append(",\"pieces\":").append(p);s.append('}');}
    return s.append(']').toString();
  }
  static long populationSeed(long seed,int cx,int cz){Random r=new Random(seed);long a=r.nextLong()/2L*2L+1L,b=r.nextLong()/2L*2L+1L;return (long)cx*a+(long)cz*b^seed;}

  // 1. Candidate decisions and start piece lists over native MapGenBase.func_151539_a driver calls.
  static void starts(long seed,String label,int[][] centers,int full)throws Exception{
    W w=world(seed,"stone");asw m=new asw();StringBuilder after=new StringBuilder("[");
    for(int[] c:centers){m.a((apu)null,w,c[0],c[1],(aji[])null);if(after.length()>1)after.append(',');after.append(jstr(""+rand(m).nextLong()));}
    StringBuilder keys=new StringBuilder("[");for(Object o:map(m).values()){avm st=(avm)o;if(keys.length()>1)keys.append(',');keys.append('[').append(st.e()).append(',').append(st.f()).append(']');}
    StringBuilder cs=new StringBuilder("[");for(int[] c:centers){if(cs.length()>1)cs.append(',');cs.append('[').append(c[0]).append(',').append(c[1]).append(']');}
    System.out.println("{\"kind\":\"starts\",\"label\":"+jstr(label)+",\"worldSeed\":"+jstr(""+seed)+",\"centers\":"+cs+"],\"randomAfter\":"+after+"],\"keys\":"+keys+"],\"starts\":"+startList(m,full)+"}");
  }
  // Raw canSpawnStructureAtCoords decisions after the native per-chunk seeding and nextInt.
  static void candidates(long seed,int x0,int z0,int size)throws Exception{
    asw m=new asw();Random r=rand(m);r.setSeed(seed);long a=r.nextLong(),b=r.nextLong();StringBuilder acc=new StringBuilder("[");MessageDigest d=MessageDigest.getInstance("SHA-1");
    for(int x=x0;x<x0+size;x++)for(int z=z0;z<z0+size;z++){r.setSeed((long)x*a^(long)z*b^seed);r.nextInt();boolean ok=m.a(x,z);long next=r.nextLong();put(d,ok?1:0,(int)(next>>>32),(int)next);
      if(ok){if(acc.length()>1)acc.append(',');acc.append('[').append(x).append(',').append(z).append(']');}}
    System.out.println("{\"kind\":\"candidates\",\"worldSeed\":"+jstr(""+seed)+",\"origin\":["+x0+","+z0+"],\"size\":"+size+",\"accepted\":"+acc+"],\"decisionSha1\":"+jstr(TerrainProbe.hex(d.digest()))+"}");
  }
  // 2. Population: provideChunk's generate then populate's generateStructuresInChunk, chunk by chunk.
  static void populate(long seed,String fixture,String label,int[][] chunkList,Map<String,aji[]> chunks,String inputs,int fullLimit)throws Exception{
    W w=world(seed,fixture);w.chunks=chunks;asw m=new asw();StringBuilder rows=new StringBuilder("[");int full=0;
    for(int[] c:chunkList){
      m.a((apu)null,w,c[0],c[1],(aji[])null);
      w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");w.callCount=0;w.writeCount=0;w.entities=new ArrayList<>();w.fullWrites=full<fullLimit?new StringBuilder("["):null;
      Random r=new Random(populationSeed(seed,c[0],c[1]));boolean ok=m.a(w,r,c[0],c[1]);
      if(rows.length()>1)rows.append(',');
      rows.append("{\"chunk\":[").append(c[0]).append(',').append(c[1]).append("],\"result\":").append(ok).append(",\"writeCount\":").append(w.writeCount).append(",\"writesSha1\":").append(jstr(TerrainProbe.hex(w.writes.digest())))
        .append(",\"callCount\":").append(w.callCount).append(",\"callsSha1\":").append(jstr(TerrainProbe.hex(w.calls.digest()))).append(",\"entities\":[").append(String.join(",",w.entities)).append("],\"nextLong\":").append(jstr(""+r.nextLong()));
      if(w.fullWrites!=null&&w.writeCount>0){full++;rows.append(",\"writes\":").append(w.fullWrites).append(']');}
      rows.append('}');
    }
    System.out.println("{\"kind\":\"populate\",\"label\":"+jstr(label)+",\"worldSeed\":"+jstr(""+seed)+",\"fixture\":"+jstr(fixture)+(inputs==null?"":",\"inputs\":"+inputs)+",\"chunks\":"+rows+"],\"tiles\":"+w.tileList()+",\"startsAfter\":"+startList(m,0)+"}");
  }
  static int[][] coverage(asv b){List<int[]> l=new ArrayList<>();
    for(int cx=Math.floorDiv(b.a-23+15,16);cx<=Math.floorDiv(b.d-8,16);cx++)for(int cz=Math.floorDiv(b.c-23+15,16);cz<=Math.floorDiv(b.f-8,16);cz++)l.add(new int[]{cx,cz});
    return l.toArray(new int[0][]);}
  static Map<String,aji[]> naturalChunks(long seed,int cx0,int cz0,int n,StringBuilder inputs)throws Exception{
    W base=(W)TerrainProbe.unsafe.allocateInstance(W.class);base.seed=seed;base.manager=new aib(seed,ahm.b);base.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(base.info,ahm.b);}
    Map<String,aji[]> chunks=new HashMap<>();inputs.append('[');TerrainProbe.resetMesa();aqz terrain=new aqz(base,seed,false);aqw caves=new aqw();aqs ravines=new aqs();
    for(int x=cx0;x<cx0+n;x++)for(int z=cz0;z<cz0+n;z++){
      aji[] blocks=new aji[65536];byte[] meta=new byte[65536];((Random)TerrainProbe.get(terrain,"i")).setSeed((long)x*341873128712L+(long)z*132897987541L);
      axl.a();terrain.a(x,z,blocks);axl.a();terrain.a(x,z,blocks,meta,base.manager.b(null,x*16,z*16,16,16));caves.a(null,base,x,z,blocks);ravines.a(null,base,x,z,blocks);chunks.put(x+","+z,blocks);
      if(inputs.length()>1)inputs.append(',');inputs.append('[').append(x).append(',').append(z).append(',').append(jstr(TerrainProbe.hash(blocks))).append(']');
    }
    inputs.append(']');return chunks;
  }
  // 3. Framework helpers on a probe component with each coordBaseMode.
  static class T extends avk {
    T(int mode,asv b){super(0);g=mode;f=b;}
    protected void a(dh d){} protected void b(dh d){}
    public boolean a(ahb w,Random r,asv b){return true;}
  }
  static class Sel extends avl {
    public void a(Random r,int x,int y,int z,boolean edge){if(edge){a=ajn.e;b=0;}else if(r.nextFloat()<0.4f){a=ajn.ab;b=r.nextInt(3);}else{a=ajn.a;b=0;}}
  }
  static void framework(long rseed,int mode)throws Exception{
    W w=world(0,"pockets");asv b=asv.a(37,30,-21,-1,-1,0,9,7,11,mode<0?0:mode);T t=new T(mode,b);
    int ox=mode<0?b.a:0,oy=mode<0?b.b:0,oz=mode<0?b.c:0;asv clip=new asv(b.a-2,b.c+3,b.a+6,b.f+1);clip.b=28;clip.e=34;
    Random r=new Random(rseed);StringBuilder res=new StringBuilder("[");
    res.append(t.a(w,clip));
    t.a(w,clip,ox+0,oy+0,oz+0,ox+8,oy+0,oz+10,ajn.d,ajn.e,true);
    t.a(w,clip,ox+1,oy+1,oz+1,ox+7,oy+3,oz+9,ajn.f,2,ajn.a,0,false);
    t.a(w,clip,ox+2,oy+2,oz+2,ox+5,oy+4,oz+6);
    t.a(w,clip,ox+0,oy+1,oz+0,ox+8,oy+4,oz+10,true,r,new Sel());
    t.a(w,clip,r,0.35f,ox+0,oy+2,oz+0,ox+8,oy+5,oz+10,ajn.T,ajn.a,true);
    for(int i=0;i<12;i++)t.a(w,clip,r,0.5f,ox+i%9,oy+3,oz+i,ajn.aa,i&7);
    t.a(w,clip,ox+0,oy+3,oz+0,ox+8,oy+6,oz+10,ajn.a,false);
    t.a(w,clip,ox+0,oy+1,oz+0,ox+8,oy+6,oz+10,ajn.G,true);
    for(int i=0;i<9;i++)t.b(w,ox+i,oy+2,oz+i,clip);
    for(int i=0;i<9;i++)t.b(w,ajn.e,i,ox+i,oy+0,oz+10-i,clip);
    qx[] loot=qx.a((qx[])TerrainProbe.field(asx.class,"a").get(null),ade.bR.b(r));
    for(int i=0;i<6;i++)res.append(',').append(t.a(w,clip,r,ox+i,oy+1,oz+2*i,loot,3+i));
    res.append(',').append(t.a(w,clip));
    StringBuilder off=new StringBuilder("[");for(int x=-1;x<=9;x+=5)for(int z=-1;z<=11;z+=6){if(off.length()>1)off.append(',');off.append('[').append(t.a(x,z)).append(',').append(t.a(x)).append(',').append(t.b(x,z)).append(']');}
    System.out.println("{\"kind\":\"framework\",\"seed\":"+jstr(""+rseed)+",\"mode\":"+mode+",\"bb\":"+bb(b)+",\"clip\":"+bb(clip)+",\"results\":"+res+"],\"offsets\":"+off+"],\"writeCount\":"+w.writeCount+",\"writesSha1\":"+jstr(TerrainProbe.hex(w.writes.digest()))+",\"callCount\":"+w.callCount+",\"callsSha1\":"+jstr(TerrainProbe.hex(w.calls.digest()))+",\"tiles\":"+w.tileList()+",\"nextLong\":"+jstr(""+r.nextLong())+"}");
  }
  static void boxes()throws Exception{
    StringBuilder s=new StringBuilder("[");
    for(int mode=-1;mode<=5;mode++)for(int[] a:new int[][]{{0,0,0,0,0,0,1,1,1},{37,30,-21,-1,-1,0,9,7,11},{-100,64,250,3,-5,7,5,3,8},{29999990,12,-29999990,-4,0,-8,10,2,3}}){
      asv b=asv.a(a[0],a[1],a[2],a[3],a[4],a[5],a[6],a[7],a[8],mode);if(s.length()>1)s.append(',');s.append('[').append(mode).append(',').append(Arrays.toString(a).replace(" ","")).append(',').append(bb(b)).append(',').append(b.b()).append(',').append(b.c()).append(',').append(b.d()).append(',').append(b.e()).append(',').append(b.f()).append(',').append(b.g()).append(']');}
    System.out.println("{\"kind\":\"boxes\",\"values\":"+s+"]}");
    StringBuilder meta=new StringBuilder("[");
    for(int mode=-1;mode<=3;mode++){T t=new T(mode,new asv(0,0,0,1,1,1));for(int id=0;id<256;id++){aji bl=aji.e(id);for(int m=0;m<16;m++){int v=t.a(bl,m);if(v!=m){if(meta.length()>1)meta.append(',');meta.append('[').append(mode).append(',').append(id).append(',').append(m).append(',').append(v).append(']');}}}}
    System.out.println("{\"kind\":\"metadata\",\"changed\":"+meta+"]}");
  }
  static void config()throws Exception{
    StringBuilder mats=new StringBuilder("[");for(int id=0;id<256;id++){aji b=aji.e(id);if(id>0)mats.append(',');mats.append('[').append(id).append(',').append(b.o()==awt.a).append(',').append(b.o().d()).append(',').append(b.j()).append(',').append(b instanceof akk).append(']');}
    StringBuilder loot=new StringBuilder("[");for(qx row:(qx[])TerrainProbe.field(asx.class,"a").get(null)){if(loot.length()>1)loot.append(',');add st=(add)TerrainProbe.get(row,"b");loot.append('[').append(stack(st)).append(',').append(TerrainProbe.get(row,"c")).append(',').append(TerrainProbe.get(row,"d")).append(',').append(TerrainProbe.get(row,"a")).append(',').append(st.e()).append(']');}
    StringBuilder ids=new StringBuilder("{");String[] names={"a","d","e","f","G","aJ","aq","aa","ac","ae","ao","av","ar","ad","bl","bg","bz","ap","aB","bC","J","F","at","z","T","ab"};
    for(String n:names){if(ids.length()>1)ids.append(',');ids.append(jstr(n)).append(':').append(aji.b((aji)TerrainProbe.field(ajn.class,n).get(null)));}
    W w=world(0,"stone");xm cart=new xm(w,0.5,1.5,2.5);
    System.out.println("{\"kind\":\"config\",\"materials\":"+mats+"],\"loot\":"+loot+"],\"blocks\":"+ids+"},\"minecartSlots\":"+cart.a()+",\"direction\":"+Arrays.toString(p.f).replace(" ","")+",\"facing\":"+Arrays.toString(q.a).replace(" ","")+",\"chance\":"+TerrainProbe.get(new asw(),"e")+"}");
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();
    config();boxes();
    for(long s:new long[]{0,1,8675309})for(int mode=-1;mode<=3;mode++)framework(s*31+mode,mode);
    for(long seed:new long[]{0,8675309,-123456789})candidates(seed,-96,-96,192);
    candidates(Long.MIN_VALUE,1874900,-1875000,100);
    int[][] near=new int[49][];for(int i=0;i<49;i++)near[i]=new int[]{(i/7-3)*17,(i%7-3)*17};
    int[][] far=new int[9][];for(int i=0;i<9;i++)far[i]=new int[]{1000+(i/3)*17,-2000+(i%3)*17};
    for(long seed:new long[]{0,8675309,-123456789})starts(seed,"near",near,3);
    for(long seed:new long[]{1,Long.MAX_VALUE})starts(seed,"far",far,2);
    starts(Long.MIN_VALUE,"edge",new int[][]{{1874990,-1874990},{-1874990,1874990}},1);
    // Synthetic population over two near-origin starts per seed (largest/first in map order).
    for(long seed:new long[]{8675309,0}){
      asw m=new asw();W w=world(seed,"stone");for(int[] c:near)m.a((apu)null,w,c[0],c[1],(aji[])null);
      List<avm> all=new ArrayList<>();for(Object o:map(m).values())all.add((avm)o);
      avm first=all.get(0),big=Collections.max(all,Comparator.comparingInt(a->a.b().size()));
      for(String f:new String[]{"stone","pockets","water","air"})populate(seed,f,f+":first:"+first.e()+","+first.f(),coverage(first.a()),null,null,f.equals("pockets")&&seed==8675309?2:0);
      if(big!=first)populate(seed,"pockets","pockets:largest:"+big.e()+","+big.f(),coverage(big.a()),null,null,0);
    }
    // Natural: 3x3 populated chunks around a start over 16 native terrain chunks.
    for(long seed:new long[]{8675309,-123456789,0}){
      asw m=new asw();W w=world(seed,"stone");for(int[] c:near)m.a((apu)null,w,c[0],c[1],(aji[])null);
      avm st=(avm)map(m).values().iterator().next();int cx=st.e(),cz=st.f();StringBuilder inputs=new StringBuilder();
      Map<String,aji[]> chunks=naturalChunks(seed,cx-1,cz-1,4,inputs);int[][] list=new int[9][];for(int i=0;i<9;i++)list[i]=new int[]{cx-1+i/3,cz-1+i%3};
      populate(seed,"natural","natural:"+cx+","+cz,list,chunks,inputs.toString(),seed==8675309?2:1);
    }
  }
}
