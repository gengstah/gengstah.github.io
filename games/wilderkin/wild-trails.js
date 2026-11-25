// On-foot connections and territorial wild kin use the same terrain as the player.
(() => {
  "use strict";
  const directions=[[1,0],[-1,0],[0,1],[0,-1]];
  const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  function create(game,world) {
    const regions=game.regions;
    const roads=regions.map(()=>new Set());
    function join(a,b) {
      if(a<0||b<0||a===b)return;
      roads[a].add(b);roads[b].add(a);
    }
    let lastDistrict=0;
    for(let i=1;i<regions.length;i++){
      join(i-1,i);
      if(regions[i].district!==regions[i-1].district){join(lastDistrict,i);lastDistrict=i;}
    }
    // The old quarry road gives Mossbrook a dangerous alternative to the ridge path.
    join(0,regions.findIndex(r=>r.name==="Fossil Steps"));
    const layouts=new Map();
    function layout(index) {
      if(layouts.has(index))return layouts.get(index);
      const region=world.regions[index],tiles=[region.spawn],seen=new Set([region.spawn.y*region.cols+region.spawn.x]);
      for(let i=0;i<tiles.length;i++)for(const [dx,dy] of directions){
        const x=tiles[i].x+dx,y=tiles[i].y+dy,k=y*region.cols+x;
        if(!seen.has(k)&&world.walkable(index,x,y)){seen.add(k);tiles.push({x,y});}
      }
      const occupied=[region.spawn,...region.sites,...game.sightings(index)];
      const open=tiles.filter(p=>p.x>0&&p.x<region.cols-1&&p.y>1&&p.y<region.rows-1&&occupied.every(s=>distance(s,p)>1));
      const signs=[];
      for(const [n,to] of [...roads[index]].entries()){
        const targets=[[region.cols-2,region.spawn.y],[1,region.spawn.y],[region.spawn.x,2],[region.spawn.x,region.rows-2]];
        const edge=targets[n%targets.length];
        const spot=open.filter(p=>signs.every(s=>distance(s,p)>2)).sort((a,b)=>distance(a,edge)-distance(b,edge))[0];
        if(spot)signs.push({...spot,id:"road-"+to,kind:"road",to,facesLeft:spot.x<region.spawn.x,level:regions[to].wildLevel,label:"Trail to "+regions[to].name});
      }
      const wild=region.sites.find(s=>s.id==="wild")||region.spawn;
      const ground=open.filter(p=>signs.every(s=>distance(s,p)>1)).sort((a,b)=>distance(a,wild)-distance(b,wild));
      const stops=[];
      for(const p of ground){
        const neighbor=ground.find(q=>distance(p,q)===1);
        if(neighbor){stops.push(p,neighbor);break;}
      }
      if(!stops.length&&ground.length)stops.push(ground[0]);
      const pool=game.pools[index],species=pool[index%pool.length];
      const roamer=stops.length?{kind:"roamer",id:"roamer",species,level:regions[index].wildLevel,
        label:"Wild "+game.species[species].name+" · Lv. "+regions[index].wildLevel,stops}:null;
      const area={signs,roamer};layouts.set(index,area);return area;
    }
    function markers(index,now) {
      const {signs,roamer}=layout(index);
      if(!roamer)return signs;
      const phase=Math.floor(now/2600),stops=roamer.stops;
      const from=stops[phase%stops.length],to=stops[(phase+1)%stops.length];
      const progress=Math.max(0,(now%2600-1900)/700);
      const drawX=from.x+(to.x-from.x)*progress,drawY=from.y+(to.y-from.y)*progress;
      return [...signs,{...roamer,x:Math.round(drawX),y:Math.round(drawY),drawX,drawY}];
    }
    return {layout,markers};
  }
  function paint(ctx,site,time) {
    const x=Math.round((site.drawX??site.x)*16)+8,y=Math.round((site.drawY??site.y)*16)+8;
    ctx.save();
    if(site.kind==="road"){
      ctx.translate(x,y);if(site.facesLeft)ctx.scale(-1,1);
      ctx.fillStyle="#513f2d";ctx.fillRect(-2,-12,4,15);ctx.fillRect(-7,-13,13,7);ctx.fillRect(5,-11,3,3);
      ctx.fillStyle="#c99b5b";ctx.fillRect(-6,-12,11,5);ctx.fillRect(5,-10,2,1);
      ctx.fillStyle="#fff0ba";ctx.fillRect(-4,-10,7,1);ctx.fillRect(1,-11,1,3);
    }else{
      const art=window.WilderFieldwork.sprite(site.species);
      ctx.fillStyle="#52694d";ctx.fillRect(x-7,y,14,2);
      const bob=time&&Math.sin(time*2.6)>.55?1:0;
      if(art.complete&&art.naturalWidth)ctx.drawImage(art,x-12,y-21-bob,24,24);
      const badge="Lv."+site.level;
      ctx.font="bold 8px monospace";ctx.textAlign="center";ctx.textBaseline="middle";
      const w=Math.ceil(ctx.measureText(badge).width)+5;
      const left=Math.max(0,Math.min(ctx.canvas.width-w,x-Math.round(w/2)));
      ctx.fillStyle="#512e31";ctx.fillRect(left,y-32,w,10);
      ctx.fillStyle="#fff2d7";ctx.fillText(badge,left+w/2,y-26.5);
      ctx.fillStyle="#853b38";ctx.beginPath();ctx.moveTo(x+7,y-18);ctx.lineTo(x+12,y-13);ctx.lineTo(x+7,y-8);ctx.lineTo(x+2,y-13);ctx.closePath();ctx.fill();
      ctx.fillStyle="#fff2d7";ctx.fillRect(x+7,y-16,1,4);ctx.fillRect(x+7,y-11,1,1);
    }
    ctx.restore();
  }
  window.WilderWildTrails={create,paint};
})();
