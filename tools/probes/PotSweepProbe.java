import java.util.*;

/** Batch 72 flowerpots72: every item and damage the unchanged 1.7.10 BlockFlowerPot accepts, what it stores, drops and writes to NBT, and the support rule. */
public final class PotSweepProbe {
  static String bool(boolean b){return b?"true":"false";}
  public static void main(String[] args)throws Exception{
    StoneUtilityProbe.U=StoneUtilityProbe.unsafe();aji.p();adb.l();
    ald pot=(ald)aji.e(140);
    int tried=0,items=0;List<String> out=new ArrayList<>();
    for(int id=1;id<=2300;id++){
      adb it=adb.d(id);if(it==null)continue;items++;
      for(int dmg=0;dmg<16;dmg++){
        for(int creative=0;creative<2;creative++){
          StoneUtilityProbe.W w=StoneUtilityProbe.world();w.put(0,64,0,140,0);mw p=StoneUtilityProbe.player(0,creative==1);
          w.tiles.put("0,64,0",pot.a((ahb)w,0));
          p.bm.a[p.bm.c]=new add(it,3,dmg);tried++;
          boolean ret=pot.a(w,0,64,0,p,1,.5F,.5F,.5F);
          if(!ret)continue;
          apf t=(apf)w.tiles.get("0,64,0");adb ti=t.a();
          add left=p.bm.a[p.bm.c];
          // Break: the plant drops from breakBlock, the pot from harvest (drop quantity of the block item).
          int meta=w.e(0,64,0);List<String> broke=new ArrayList<>();
          pot.a(w,0,64,0,(aji)pot,meta);for(add s:w.spawned)broke.add(StoneUtilityProbe.stackJson(s));w.spawned.clear();
          dh tag=new dh();t.b(tag);
          aji plant=aji.a(it);
          out.add("{\"kind\":\"potAccept\",\"id\":"+id+",\"damage\":"+dmg+",\"creative\":"+creative+",\"meta\":"+meta+",\"tile\":["+adb.b(ti)+","+t.b()+"],\"nbt\":["+tag.f("Item")+","+tag.f("Data")+"],\"left\":"+StoneUtilityProbe.stackJson(left)+",\"breakDrops\":"+StoneUtilityProbe.list(broke)+",\"plantBlock\":"+aji.b(plant)+",\"renderType\":"+plant.b()+"}");
        }
      }
    }
    for(String s:out)System.out.println(s);
    System.out.println("{\"kind\":\"potSweep\",\"items\":"+items+",\"tried\":"+tried+",\"accepted\":"+out.size()+"}");
    // NBT read of arbitrary Item/Data: unknown ids hold no item, Item 0 is empty.
    int[][] nbts={{0,0},{37,0},{37,5},{38,3},{38,15},{6,2},{6,9},{39,0},{40,0},{81,0},{32,0},{31,2},{31,0},{175,2},{1,0},{338,0},{295,0},{6000,0},{-5,0},{2256,1}};
    for(int[] n:nbts){
      dh tag=new dh();tag.a("Item",n[0]);tag.a("Data",n[1]);apf t=new apf();t.a(tag);
      dh back=new dh();t.b(back);adb ti=t.a();
      System.out.println("{\"kind\":\"potNbt\",\"in\":["+n[0]+","+n[1]+"],\"item\":"+(ti==null?-1:adb.b(ti))+",\"data\":"+t.b()+",\"out\":["+back.f("Item")+","+back.f("Data")+"]}");
    }
    // BlockFlowerPot.canPlaceBlockAt over every block id and metadata below an air cell.
    for(int id=0;id<=175;id++){
      aji b=aji.e(id);if(b==null||aji.b(b)!=id)continue;
      int mask=0;
      for(int m=0;m<16;m++){StoneUtilityProbe.W w=StoneUtilityProbe.world();w.put(0,63,0,id,m);if(pot.c((ahb)w,0,64,0))mask|=1<<m;}
      System.out.println("{\"kind\":\"potPlace\",\"below\":"+id+",\"mask\":"+mask+"}");
    }
    // A pot already holding a plant refuses every plant (tile occupied).
    {StoneUtilityProbe.W w=StoneUtilityProbe.world();w.put(0,64,0,140,2);mw p=StoneUtilityProbe.player(0,false);
     w.tiles.put("0,64,0",new apf(adb.d(37),0));p.bm.a[p.bm.c]=new add(adb.d(38),1,0);
     System.out.println("{\"kind\":\"potFull\",\"ret\":"+bool(pot.a(w,0,64,0,p,1,.5F,.5F,.5F))+"}");}
    // No tile entity at the cell: the activation returns false.
    {StoneUtilityProbe.W w=StoneUtilityProbe.world();w.put(0,64,0,140,0);mw p=StoneUtilityProbe.player(0,false);
     p.bm.a[p.bm.c]=new add(adb.d(38),1,0);
     System.out.println("{\"kind\":\"potNoTile\",\"ret\":"+bool(pot.a(w,0,64,0,p,1,.5F,.5F,.5F))+"}");}
  }
}
