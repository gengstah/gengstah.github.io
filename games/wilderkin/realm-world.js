// The shared trails carry only a courier's public pose and a regional lantern signal.
(() => {
  "use strict";
  const roundMs=10*60*1000,heartbeatMs=4000,staleMs=30000,maxCouriers=128,maxDrawn=24;
  const steps=[[0,1],[1,0],[0,-1],[-1,0]],directions=["up","right","down","left"];
  const activities=["trail","battle","duel"],gestures={wave:"Waving",rally:"Rally here",thanks:"Thank you"};
  const coats=[["#247d7b","#9ce8d2"],["#86589a","#e1b9ea"],["#ac5e32","#ffcb85"],["#466da4","#b4dafa"],
    ["#81712d","#f4df8e"],["#a95072","#f5b7d2"],["#428255","#b3edaa"],["#486286","#b8c7fb"]];
  const first=["Alder","Aspen","Birch","Briar","Brook","Cedar","Cove","Dawn","Dune","Echo","Fern","Flint","Hazel","Juniper","Linden","Moss",
    "Opal","Pine","Rain","Reed","River","Rowan","Sable","Sedge","Sorrel","Spruce","Stone","Thistle","Tide","Vale","Willow","Yew"];
  const last=["Badger","Bee","Bell","Brook","Cairn","Crest","Dove","Drake","Finch","Fox","Gale","Glen","Hare","Hawk","Heron","Hill",
    "Jay","Lark","Lynx","Moth","Newt","Owl","Pike","Quill","Reef","Robin","Rook","Skylark","Swift","Tern","Wren","Wisp"];
  const pinPrefix="wilderkin.waylight.pin.v1.";
  const validId=id=>typeof id==="string"&&id.length>0&&id.length<=160&&!/[\x00-\x20\x7f]/.test(id);
  const bitCount=mask=>(mask&1)+((mask>>1)&1)+((mask>>2)&1);
  const maskOk=mask=>Number.isInteger(mask)&&mask>=0&&mask<=7;
  const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  const cloakKey="wilderkin.courier.cloak.v1",validLook=look=>typeof look==="string"&&/^[a-f0-9]{8}$/.test(look);
  function hash(id){
    let h=2166136261;for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);
    h^=h>>>16;h=Math.imul(h,0x85ebca6b);h=(h^(h>>>13))>>>0;
    return h;
  }
  const dyeSeed=id=>hash(id).toString(16).padStart(8,"0");
  function identity(id,seed=dyeSeed(id)){
    const h=parseInt(seed,16),palette=(h>>>10)%coats.length;
    return {id,look:seed,name:first[h%first.length]+" "+last[(h>>>5)%last.length],palette,color:coats[palette][0]};
  }
  function browserStore(which){try{return window[which];}catch{return null;}}
  function create({world,send,broadcast,now=Date.now,sightings=region=>window.WilderGame?.sightings?.(region)||[],storage=browserStore("localStorage"),session=browserStore("sessionStorage"),onChange=()=>{}}){
    const peers=new Map(),sites=new Map(),rounds=new Map(),pins=new Set();
    let me=null,local=null,rack=null,chosen=null,seq=0,lastSend=-Infinity,lastWave=-Infinity,sent=null,gesture=null,gestureUntil=0;
    let epoch=-1,ledger="",lastPublishedEvent="",lastSync=-Infinity,recentPose=null;
    const validRegion=r=>Number.isInteger(r)&&r>=0&&!!world.regions[r];
    function spot(p){
      if(!p||!validRegion(p.region)||!Number.isInteger(p.x)||!Number.isInteger(p.y))return null;
      const r=world.regions[p.region];
      if(p.x<0||p.y<0||p.x>=r.cols||p.y>=r.rows||!world.walkable(p.region,p.x,p.y))return null;
      const known=window.WilderGame?.species;
      const lead=typeof p.lead==="string"&&/^[a-z][a-z0-9-]{0,36}$/.test(p.lead)&&(!known||Object.hasOwn(known,p.lead))?p.lead:null;
      return {region:p.region,x:p.x,y:p.y,facing:directions.includes(p.facing)?p.facing:"down",lead,activity:activities.includes(p.activity)?p.activity:"trail",duels:["open","queue"].includes(p.duels)?p.duels:"quiet"};
    }
    function readPins(){
      pins.clear();
      try{for(let r=0;r<world.regions.length;r++)if(storage?.getItem(pinPrefix+r)==="1")pins.add(r);}catch{ /* Pins also work during this visit. */ }
    }
    function roll(){
      const e=Math.floor(now()/roundMs);
      if(e===epoch)return false;
      epoch=e;rounds.clear();lastPublishedEvent="";
      if(ledger)try{
        const raw=session?.getItem(ledger);
        const saved=raw?.length<=12000?JSON.parse(raw):null;
        if(saved?.epoch===e&&Array.isArray(saved.regions)){
          for(const entry of saved.regions.slice(0,world.regions.length)){
            if(!Array.isArray(entry))continue;
            const [r,mask,mine]=entry;
            if(validRegion(r)&&maskOk(mask)&&maskOk(mine)&&(mask&mine)===mine)rounds.set(r,{mask,mine});
          }
        }
      }catch{ /* Storage is optional. */ }
      return true;
    }
    function saveRound(){
      try{session?.setItem(ledger,JSON.stringify({epoch,regions:[...rounds].map(([r,p])=>[r,p.mask,p.mine])}));}catch{}
    }
    function progress(region){
      roll();return rounds.get(region)||{mask:0,mine:0};
    }
    function update(region,mask,mine){
      const p=progress(region),next={mask:p.mask|mask,mine:p.mine|mine};
      if(next.mask===p.mask&&next.mine===p.mine)return false;
      rounds.set(region,next);saveRound();
      if(next.mask===7&&next.mine&&!pins.has(region)){
        pins.add(region);try{storage?.setItem(pinPrefix+region,"1");}catch{}
      }
      return true;
    }
    // Place all three stations on the player's connected component. The hearth
    // light is close enough to the arrival tile for a newly joined courier.
    function stations(region){
      if(sites.has(region))return sites.get(region);
      const area=world.regions[region],queue=[area.spawn],seen=new Set([area.spawn.x+","+area.spawn.y]);
      for(let i=0;i<queue.length;i++)for(const [dx,dy] of steps){
        const x=queue[i].x+dx,y=queue[i].y+dy,key=x+","+y;
        if(!seen.has(key)&&world.walkable(region,x,y)){seen.add(key);queue.push({x,y});}
      }
      const placed=[],landmarks=area.sites||[],wildlife=sightings(region);
      const free=queue.filter(p=>!landmarks.some(l=>distance(p,l)===0)&&
        !wildlife.some(l=>p.x===l.x&&(p.y===l.y||p.y===l.y-1)));
      const aim=[area.spawn,landmarks.find(p=>p.id==="camp")||area.spawn,landmarks.find(p=>p.id==="wild")||area.spawn];
      const names=["Hearth lantern","Path lantern","Clearing lantern"];
      for(let i=0;i<names.length;i++){
        const candidates=free.filter(p=>!placed.some(l=>distance(p,l)===0));
        const score=p=>{
          const near=placed.some(l=>distance(p,l)<3);
          return 40*Number(distance(p,area.spawn)===0)+12*Number(near)+
            4*Math.abs(distance(aim[i],p)-(i===0?1:2))+Number(p.y<2||p.x<1||p.x>=area.cols-1);
        };
        // Buildings and people have visual hit areas beyond their landmark tile.
        // Keep those tappable even when the lantern is only two tiles away.
        const ordered=candidates.map(p=>({p,weight:score(p)})).sort((a,b)=>a.weight-b.weight);
        const best=ordered.find(({p})=>!world.siteAt?.(region,p.x,p.y))?.p;
        if(best)placed.push({id:["hearth","path","clearing"][i],name:names[i],x:best.x,y:best.y,bit:1<<i});
      }
      sites.set(region,placed);return placed;
    }
    function wardrobe(id){
      let old;
      try{const raw=storage?.getItem(cloakKey);if(raw&&raw.length<100)old=JSON.parse(raw);}catch{}
      const base=validLook(old?.base)?old.base:rack?.[0]||dyeSeed(id);
      if(!rack||rack[0]!==base){
        rack=[base];const used=new Set([identity(id,base).palette]);
        for(let i=1;rack.length<6;i++){
          const dye=dyeSeed(base+"/"+i),colour=identity(id,dye).palette;
          if(!used.has(colour)){rack.push(dye);used.add(colour);}
        }
      }
      chosen=rack.includes(old?.look)?old.look:rack.includes(chosen)?chosen:base;
      saveCloak();return identity(id,chosen);
    }
    function saveCloak(){try{storage?.setItem(cloakKey,JSON.stringify({base:rack[0],look:chosen}));}catch{}}
    function looks(){
      return me?rack.map(dye=>({...identity(me.id,dye),id:dye,current:dye===chosen})):[];
    }
    function wear(dye){
      if(!me||!rack.includes(dye))return {ok:false,message:"Choose a cloak from your wardrobe."};
      chosen=dye;me=identity(me.id,chosen);saveCloak();recentPose=null;if(local)publish(local,true);onChange();
      return {ok:true,message:"You’re traveling as "+me.name+"."};
    }
    function join(id,room="commons"){
      if(!validId(id))return false;
      leave();me=wardrobe(id);seq=Math.max(0,Math.floor(now())*64);ledger="wilderkin.waylights.round.v1."+String(room).slice(0,128);
      readPins();roll();return true;
    }
    function leave(){
      me=null;local=null;seq=0;sent=null;peers.clear();recentPose=null;
      epoch=-1;ledger="";rounds.clear();lastSend=lastWave=lastSync=-Infinity;lastPublishedEvent="";gesture=null;gestureUntil=0;
    }
    function packet(){return {t:"presence",seq:++seq,...local,look:me.look,gesture:now()<gestureUntil?gesture:null,badge:pins.size>0};}
    function eventPacket(){
      if(!local)return null;
      const p=progress(local.region);
      return {t:"lanterns",region:local.region,epoch,mask:p.mask};
    }
    function sync(pub,to){
      const msg=eventPacket();if(!msg)return;
      if(to){if(msg.mask)send(to,msg);return;}
      const fingerprint=msg.epoch+"|"+msg.region+"|"+msg.mask;
      if((pub||now()-lastSync>=heartbeatMs||fingerprint!==lastPublishedEvent)&&msg.mask){broadcast(msg);lastSync=now();}
      lastPublishedEvent=fingerprint;
    }
    function publish(p,force=false){
      if(!me)return false;
      const next=spot(p);if(!next)return false;
      const moved=local?.region!==next.region;local=next;
      const t=now(),same=sent&&Object.keys(next).every(k=>sent[k]===next[k]);
      if(!force&&!moved&&(t-lastSend<180||same&&t-lastSend<heartbeatMs))return false;
      broadcast(packet());sync(force||moved||t-lastSend>=heartbeatMs);sent=local;lastSend=t;
      return true;
    }
    function peer(id){
      if(!me||!local||!validId(id)||id===me.id)return;
      send(id,packet());sync(true,id);
    }
    function position(rec,t,reduced){
      if(reduced||!rec.from)return {x:rec.x,y:rec.y};
      const f=Math.min(1,Math.max(0,(t-rec.movedAt)/rec.duration));
      return {x:rec.from.x+(rec.x-rec.from.x)*f,y:rec.from.y+(rec.y-rec.from.y)*f};
    }
    function admit(id,p,t){
      if(peers.size<maxCouriers)return true;
      for(const [peer,rec] of peers)if(t-rec.updated>staleMs)peers.delete(peer);
      if(peers.size<maxCouriers)return true;
      // Always make space for nearer travelers. Stable IDs break exact ties,
      // independently of which relay delivered the first presence.
      const rank=rec=>rec.region===local?.region?distance(rec,local):1000+Math.abs(rec.region-(local?.region??0));
      const compare=(a,b)=>rank(a)-rank(b)||a.id.localeCompare(b.id);
      let worst;
      for(const rec of peers.values())if(!worst||compare(rec,worst)>0)worst=rec;
      if(compare({...p,id},worst)>=0)return false;
      peers.delete(worst.id);return true;
    }
    function receive(id,msg){
      if(!me||!validId(id)||id===me.id||!msg||typeof msg!=="object")return false;
      const previous=peers.get(id),t=now();
      if(msg.t==="lanterns"){
        if(!previous||msg.region!==previous.region||!validRegion(msg.region)||msg.epoch!==Math.floor(t/roundMs)||!maskOk(msg.mask))return false;
        const changed=update(msg.region,msg.mask,0);
        if(changed){recentPose=null;onChange();}
        return changed;
      }
      if(msg.t!=="presence"||!Number.isSafeInteger(msg.seq)||msg.seq<1||previous&&msg.seq<=previous.seq)return false;
      const p=spot(msg);if(!p||!previous&&!admit(id,p,t))return false;
      const action=typeof msg.gesture==="string"&&Object.hasOwn(gestures,msg.gesture)?msg.gesture:null;
      const relocated=previous&&previous.region===p.region&&distance(p,previous)>0;
      const look=validLook(msg.look)?msg.look:dyeSeed(id);
      const changed=!previous||previous.look!==look||Object.keys(p).some(k=>p[k]!==previous[k])||action!==previous.gesture||previous.badge!==(msg.badge===true);
      const outfit=previous?.look===look?previous:identity(id,look);
      peers.set(id,{...outfit,...p,badge:msg.badge===true,seq:msg.seq,updated:t,gesture:action,
        emoteUntil:action?t+3300:0,from:relocated&&distance(p,previous)<=4?position(previous,t,false):relocated?null:previous?.region===p.region?previous.from:null,
        movedAt:relocated?t:previous?.movedAt||t,duration:relocated?Math.max(100,Math.min(320,t-previous.updated)):previous?.duration||180});
      if(changed){recentPose=null;onChange();}
      return true;
    }
    function depart(id){if(peers.delete(id)){recentPose=null;onChange();return true;}return false;}
    function tick(){
      if(!me)return;
      const t=now();let changed=roll();
      for(const [id,p] of peers){
        if(t-p.updated>staleMs){peers.delete(id);changed=true;}
        else if(p.gesture&&t>=p.emoteUntil){p.gesture=null;changed=true;}
      }
      if(gesture&&t>=gestureUntil){gesture=null;if(local)publish(local,true);changed=true;}
      if(local)publish(local);
      if(changed){recentPose=null;onChange();}
    }
    function self(){return me?{...me,...local,badge:pins.size>0,emote:now()<gestureUntil?gestures[gesture]:null}:null;}
    function people(){
      if(!me)return [];
      const t=now();
      return [...peers.values()].filter(p=>t-p.updated<=staleMs).map(p=>{
        const d=p.region===local?.region?distance(p,local):null;
        return {id:p.id,look:p.look,name:p.name,palette:p.palette,color:p.color,badge:p.badge,activity:p.activity,duels:p.duels,region:p.region,x:p.x,y:p.y,facing:p.facing,lead:p.lead,
          distance:d,nearby:d!==null&&d<=3,emote:p.emoteUntil>t?gestures[p.gesture]||null:null};
      }).sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
    }
    function wave(key){
      if(!local||!me||typeof key!=="string"||!Object.hasOwn(gestures,key))return {ok:false,message:"Join the shared trail to signal other couriers."};
      const t=now();if(t-lastWave<2200)return {ok:false,message:"Give your signal a moment to carry."};
      gesture=key;gestureUntil=t+3000;lastWave=t;publish(local,true);onChange();
      return {ok:true,message:gestures[key]+" · nearby couriers can see your signal."};
    }
    function event(){
      if(!me||!local)return null;
      const region=local.region,p=progress(region),complete=p.mask===7,earned=complete&&p.mine!==0;
      const lanterns=stations(region).map(s=>({...s,lit:!!(p.mask&s.bit),mine:!!(p.mine&s.bit),near:distance(s,local)<=1}));
      return {title:"The waylight relay",description:earned?"You helped light the route. Your Wayfinder pin is in the ledger.":
        complete?"The route is glowing. Tend any lantern to earn this region’s Wayfinder pin.":
        "Light three lanterns to mark the route home. Every courier who lights or tends one earns the region’s Wayfinder pin.",
        region,lanterns,lit:bitCount(p.mask),mine:bitCount(p.mine),total:3,complete,earned,badges:pins.size,endsAt:(epoch+1)*roundMs,
        remainingMs:Math.max(0,(epoch+1)*roundMs-now())};
    }
    function light(id){
      const e=event(),s=e?.lanterns.find(l=>l.id===id);
      if(!s||!s.near||local.activity!=="trail")return {ok:false,message:"Walk beside this lantern on the shared trail."};
      if(s.mine)return {ok:false,message:"Your help at this lantern is already recorded."};
      update(local.region,s.bit,s.bit);publish(local,true);recentPose=null;onChange();
      const result=event();
      return {ok:true,message:result.earned?"The route glows. You earned the "+world.regions[local.region].name+" Wayfinder pin.":
        (s.lit?"You tended the ":"You lit the ")+s.name.toLowerCase()+". "+result.lit+" of 3 lights are glowing."};
    }
    const offsets=[[.65,0],[-.65,0],[0,.65],[.6,-.55],[-.6,-.55],[.6,.55],[-.6,.55],[0,-.85]];
    function pose(region,reduced=false){
      if(!me||!local||region!==local.region)return null;
      const nowMs=now(),groups=new Map(),area=world.regions[region];
      const all=people().filter(p=>p.region===region);
      const visible=all.slice(0,maxDrawn).map((p,i)=>{
        const rec=peers.get(p.id),v=position(rec,nowMs,reduced),key=p.x+","+p.y;
        const occupied=(groups.get(key)||0)+(p.x===local.x&&p.y===local.y?1:0);
        groups.set(key,(groups.get(key)||0)+1);
        const offset=occupied?offsets[(occupied-1)%offsets.length]:[0,0];
        return {...p,drawX:Math.max(0,Math.min(area.cols-1,v.x+offset[0])),drawY:Math.max(0,Math.min(area.rows-1,v.y+offset[1])),showName:i<4||!!p.emote};
      });
      const crowds=new Map();
      for(const p of all.slice(maxDrawn)){
        const key=p.x+","+p.y,group=crowds.get(key);
        if(group)group.count++;
        else crowds.set(key,{id:p.id,x:p.x,y:p.y,count:1});
      }
      const e=event();recentPose={region,self:self(),people:visible,crowds:[...crowds.values()],lanterns:e?.lanterns||[]};return recentPose;
    }
    function hit(region,x,y){
      const scene=recentPose?.region===region?recentPose:pose(region,true);
      if(!scene||!Number.isInteger(x)||!Number.isInteger(y))return null;
      const walkers=scene.people.slice().sort((a,b)=>b.drawY-a.drawY);
      for(const top of [0,1]){
        const p=walkers.find(p=>Math.round(p.drawX)===x&&Math.round(p.drawY)-top===y);
        if(p)return {kind:"courier",id:p.id};
      }
      const crowd=scene.crowds.find(g=>g.x===x&&g.y===y);
      if(crowd)return {kind:"courier",id:crowd.id};
      const lamp=scene.lanterns.find(l=>l.x===x&&l.y===y);
      return lamp?{kind:"lantern",id:lamp.id}:null;
    }
    return {join,leave,publish,peer,receive,depart,tick,self,looks,wear,people,wave,event,light,pose,hit};
  }

  const walkerArt=[
    "    xxxxx    ","   xhhhhhx   ","  xhhHHHhhx  ","  xhhhHhhhx  "," xrrRRRRRrrx ",
    "   xskkksx   ","   xsksksx   ","    xsssx    ","   xrRRRrx   ","  xrRrRRrRx  ",
    "  xsRrRRRsx  ","  xssbBBBsx  ","   xrrRrrx   ","   xpxxppx   ","   xpx xpx   ",
    "  xbbx xbbx  ","  xxxx xxxx  "
  ];
  const sprites=new Map();
  function paintCoat(c,x,y,palette,facing){
    const colours={x:"#273f3e",h:"#785b46",H:"#b09b6c",r:coats[palette][0],R:coats[palette][1],s:"#dbab76",k:"#493f44",p:"#58667b",b:"#5e4a49",B:"#cea765"};
    for(let j=0;j<walkerArt.length;j++)for(let i=0;i<walkerArt[j].length;i++){
      let k=walkerArt[j][i];if(k===" ")continue;
      if(j>=5&&j<=7&&k!=="x"){
        if(facing==="up")k="h";
        else if(facing==="left"&&i>6||facing==="right"&&i<6)k="h";
      }
      c.fillStyle=colours[k];c.fillRect(x+i,y+j,1,1);
    }
  }
  function courier(c,p,x=Math.round(p.drawX*16+8),y=Math.round(p.drawY*16+10)){
    const key=p.palette+"|"+p.facing;
    c.fillStyle="#345847";c.fillRect(x-5,y-1,11,2);
    let sprite=sprites.get(key);
    if(!sprite&&typeof document!=="undefined"){
      sprite=document.createElement("canvas");sprite.width=13;sprite.height=17;
      paintCoat(sprite.getContext("2d"),0,0,p.palette,p.facing);sprites.set(key,sprite);
    }
    if(sprite)c.drawImage(sprite,x-6,y-17);else paintCoat(c,x-6,y-17,p.palette,p.facing);
    if(p.badge){c.fillStyle="#a07434";c.fillRect(x-3,y-8,3,3);c.fillStyle="#ffe99d";c.fillRect(x-2,y-8,1,2);}
    if(!p.showName)return;
    const words=p.emote||p.name;
    c.save();c.font="bold 7px monospace";c.textAlign="center";c.textBaseline="middle";
    const w=Math.ceil(c.measureText(words).width)+7,cx=Math.max(w/2,Math.min(c.canvas.width-w/2,x));
    const y0=y>=28?y-28:y+2;
    c.fillStyle=p.emote?"#fce4a5":"#20392f";c.fillRect(Math.round(cx-w/2),y0,w,9);
    c.fillStyle=p.emote?"#694728":coats[p.palette][1];c.fillRect(Math.round(cx-w/2),y0+8,w,1);
    c.fillText(words,Math.round(cx),y0+4);c.restore();
  }
  function paintSelf(c,pose,x,y,facing){
    if(!pose?.self)return false;
    const p=pose.self;
    courier(c,{...p,facing,showName:!!p.emote},x,y);
    // A pale pennant on the player's pack is visible in a crowd even without a nameplate.
    c.fillStyle="#273f3e";c.fillRect(x-7,y-16,2,11);
    c.fillStyle="#fff5bc";c.fillRect(x-7,y-17,6,3);c.fillRect(x-7,y-14,3,1);
    return true;
  }
  function lantern(c,l){
    const x=l.x*16+8,y=l.y*16+10;
    c.fillStyle="#554c3c";c.fillRect(x-4,y-2,8,3);c.fillRect(x-1,y-13,2,11);
    c.fillStyle="#bc9762";c.fillRect(x,y-10,1,8);c.fillRect(x-1,y-13,5,1);
    c.fillStyle="#33443c";c.fillRect(x-1,y-15,6,2);c.fillRect(x-2,y-13,8,7);c.fillRect(x-1,y-6,6,1);
    c.fillStyle=l.lit?"#f0b74e":"#77b9b1";c.fillRect(x-1,y-12,6,5);
    c.fillStyle=l.lit?"#fff4a7":"#335c57";c.fillRect(x,y-11,3,3);
    if(l.lit){c.fillStyle="#e9d38d";c.fillRect(x+7,y-13,2,1);c.fillRect(x-4,y-11,1,2);}
    if(l.mine){c.fillStyle="#905335";c.fillRect(x+1,y-4,4,2);c.fillStyle="#f2c979";c.fillRect(x+3,y-3,2,2);}
  }
  function layers(pose){
    if(!pose)return [];
    return [...pose.lanterns.map(l=>({z:l.y*16+8,paint:c=>lantern(c,l)})),...pose.people.map(p=>({z:p.drawY*16+10.1,paint:c=>courier(c,p)})),
      ...(pose.crowds||[]).map(g=>({z:g.y*16+11,paint:c=>{
        const x=g.x*16+8,y=g.y*16+7,text="+"+g.count;
        c.save();c.font="bold 7px monospace";c.textAlign="center";c.textBaseline="middle";
        const w=Math.ceil(c.measureText(text).width)+4;c.fillStyle="#1e474c";c.fillRect(Math.round(x-w/2),y-5,w,9);
        c.fillStyle="#d6ffdc";c.fillText(text,x,y);c.restore();
      }}))];
  }
  window.WilderRealmWorld=Object.freeze({create,layers,paintSelf,identity:id=>validId(id)?identity(id):null});
})();
