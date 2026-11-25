// On-foot connections and territorial wild kin use the same terrain as the player.
(() => {
  "use strict";
  const directions=[[1,0],[-1,0],[0,1],[0,-1]];
  const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  function create(game,world) {
    const regions=game.regions;
    const layouts=new Map();
    function layout(index) {
      if(layouts.has(index))return layouts.get(index);
      const region=world.regions[index],signs=region.exits,tiles=[region.spawn];
      const cell=(x,y)=>y*region.cols+x;
      const reserved=new Set(signs.map(s=>cell(s.x,s.y)));
      const previous=new Map([[cell(region.spawn.x,region.spawn.y),null]]);
      for(let i=0;i<tiles.length;i++)for(const [dx,dy] of directions){
        const p=tiles[i],x=p.x+dx,y=p.y+dy,k=cell(x,y);
        if(!reserved.has(k)&&!previous.has(k)&&world.walkable(index,x,y)){previous.set(k,cell(p.x,p.y));tiles.push({x,y});}
      }
      const occupied=[region.spawn,...region.sites,...game.sightings(index)];
      // Keep at least one route to each landmark and border open even while a
      // territorial kin is stationary. The bridge out of Mossbrook is one tile wide.
      for(const goal of [...occupied,...signs.map(s=>s.arrival)]){
        for(let k=cell(goal.x,goal.y);k!=null&&!reserved.has(k);k=previous.get(k))reserved.add(k);
      }
      const open=tiles.filter(p=>p.x>0&&p.x<region.cols-1&&p.y>1&&p.y<region.rows-1&&
        !reserved.has(cell(p.x,p.y))&&occupied.every(s=>distance(s,p)>1));
      const wild=region.sites.find(s=>s.id==="wild")||region.spawn;
      const ground=open.filter(p=>signs.every(s=>distance(s,p)>1&&distance(s.arrival,p)>1)).sort((a,b)=>distance(a,wild)-distance(b,wild));
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
      // Stone bollards frame the crossing, leaving the center open for its map arrow.
      ctx.translate(x,y);
      ctx.rotate(({left:Math.PI,up:-Math.PI/2,down:Math.PI/2})[site.direction]||0);
      for(const edge of [-9,7]){
        ctx.fillStyle="#645844";ctx.fillRect(-3,edge,6,3);
        ctx.fillStyle="#a99771";ctx.fillRect(-3,edge-1,5,2);
        ctx.fillStyle="#ead5a0";ctx.fillRect(-2,edge-2,3,1);
      }
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
