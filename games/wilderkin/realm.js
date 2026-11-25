// The Lantern Commons shares map activity and friendly duels. Campaign saves stay on this device.
(() => {
  "use strict";
  const publicRoom="commons",sessionKey="wilderkin.realm.session.v1";
  const worlds=[publicRoom,...Array.from({length:7},(_,i)=>"commons-"+(i+2))];
  const validRoom=room=>worlds.includes(room)||/^friends-[a-f0-9]{12}$/.test(room);
  const roomName=room=>room===publicRoom?"Lantern Commons":worlds.includes(room)?"Lantern Commons "+room.slice(-1):"Friends’ clearing";
  const address=room=>room===publicRoom?"#online":"#online/"+room;
  const shortStatus={connecting:"Connecting",online:"Online",local:"Local tabs · retrying internet",offline:"Reconnecting",closed:"Offline"};
  function create({game,world,row,image,go,notify,refresh,location,syncPosition,walkTo,regionPage}){
    let conn=null,clock=null,status="closed",room=publicRoom,requested=publicRoom,availability="quiet";
    let roster=[],search="",playersPage=0,lastPhase="idle",matchAt=0,closing=false,restoring=false;
    let storage=null,localStorage=null;
    try{storage=window.sessionStorage;localStorage=window.localStorage;}catch{}
    const state=()=>game.state,transport=window.WilderRealmTransport;
    const field=window.WilderRealmWorld.create({world,storage:localStorage,
      send:(id,m)=>conn?.send(id,m),broadcast:m=>conn?.broadcast(m),onChange:refresh});
    const people=()=>field.people();
    const person=id=>people().find(p=>p.id===id);
    const name=id=>game.species[id]?.name;
    const arenaImage=id=>image(id,false);
    const regionName=i=>game.regions[i]?.name||"On the trail";
    const known=new Map();
    const portraits=new Map();
    function portrait(p){
      if(!portraits.has(p.palette)){
        const icon=document.createElement("canvas");icon.width=24;icon.height=24;
        window.WilderRealmWorld.paintSelf(icon.getContext("2d"),{self:{palette:p.palette}},12,21,"down");
        portraits.set(p.palette,icon);
      }
      return portraits.get(p.palette);
    }
    const personName=id=>person(id)?.name||known.get(id)||"The other courier";
    function available(id,direction){
      if(!conn||state().battle)return false;
      if(direction==="accept")return !!person(id);
      const other=person(id);
      return !!other&&other.activity==="trail"&&
        (direction==="incoming"?availability!=="quiet":other.duels==="open"||other.duels==="queue");
    }
    const duel=window.WilderRealmDuels.create({game,row,image:arenaImage,storage,send:(id,m)=>conn?.send(id,m),
      canInvite:available,onChange:duelChanged});
    function draft(){
      if(roster.length!==3||roster.some(id=>!state().party.some(p=>p.id===id)))roster=duel.team().slice();
      return roster.slice();
    }
    function readSession(){
      try{const data=JSON.parse(storage?.getItem(sessionKey)||"null");
        return data&&validRoom(data.room)&&/^[a-f0-9]{24}$/.test(data.id)?data:null;
      }catch{return null;}
    }
    function remember(){
      try{
        if(conn)storage?.setItem(sessionKey,JSON.stringify({room,id:conn.id,availability,roster:draft()}));
        else storage?.removeItem(sessionKey);
      }catch{}
    }
    function publish(force=false){
      if(!conn)return;
      const pos=location();if(!pos)return;
      const p=duel.read().phase;
      field.publish({...pos,lead:state().lead,duels:availability,activity:p==="active"?"duel":state().battle?"battle":"trail"},force);
    }
    function duelChanged(){
      const d=duel.read(),old=lastPhase;lastPhase=d.phase;
      if(closing||restoring)return;
      if(d.phase!==old){
        if(d.phase==="incoming")notify(personName(d.peer)+" invited you to a friendly duel.");
        if(d.phase==="active"){
          if(availability==="queue")availability="open";
          remember();go("online","duel","root");
        }
        if(d.phase==="done"&&old==="active")go("online","duel","root");
        if(d.phase==="idle"&&old!=="idle"){
          matchAt=Date.now()+8000;
          if(d.message&&["incoming","outgoing"].includes(old))notify(d.message);
        }
        publish(true);
      }
      refresh();
    }
    function heartbeat(){
      if(!conn)return;
      if(state().battle)campaignEncounter();
      publish();field.tick();duel.tick();
      if(availability!=="queue"||state().battle||duel.read().phase!=="idle"||Date.now()<matchAt)return;
      const pool=[conn.id,...people().filter(p=>p.duels==="queue"&&p.activity==="trail").map(p=>p.id)].sort();
      const index=pool.indexOf(conn.id),other=pool[index+1];
      if(index%2===0&&other){
        matchAt=Date.now()+10000;
        duel.invite(other,draft());
      }
    }
    function campaignEncounter(){
      if(!conn)return;
      const phase=duel.read().phase;
      if(phase==="incoming")duel.decline();
      if(phase==="outgoing")duel.cancel();
      publish();
    }
    function connect(to,session=null){
      if(!validRoom(to)||!transport)return;
      if(conn&&room===to)return go("online");
      if(conn)disconnect();
      room=requested=to;playersPage=0;status="connecting";availability=session&&["open","queue"].includes(session.availability)?session.availability:"quiet";
      if(Array.isArray(session?.roster)&&session.roster.length===3&&new Set(session.roster).size===3)roster=session.roster;
      try{
        const active=transport.connect({room:"wilderkin-v1-"+room,id:session?.id,
          onStatus:value=>{if(conn===active){status=value;refresh();}},
          onPeer:id=>{if(conn===active){field.peer(id);duel.peerJoined(id);}},
          onLeave:id=>{if(conn===active){duel.peerLeft(id);field.depart(id);refresh();}},
          onMessage:(id,msg)=>{
            if(conn!==active||!msg||typeof msg!=="object")return;
            if(msg.kind==="duel")duel.receive(id,msg);
            else{
              field.receive(id,msg);
              const p=person(id);if(p){if(known.size>=150&&!known.has(id))known.delete(known.keys().next().value);known.set(id,p.name);}
            }
          }});
        conn=active;game.realmWalking?.("join",conn.id);syncPosition();field.join(conn.id,room);
        restoring=true;
        try{duel.resume(conn.id);lastPhase=duel.read().phase;}finally{restoring=false;}
        publish(true);remember();clock=window.setInterval(heartbeat,1000);
      }catch{
        disconnect();notify("The realm connection could not start in this browser.");
      }
    }
    function disconnect(intentional=true){
      closing=true;
      if(clock!==null)window.clearInterval(clock);clock=null;
      if(intentional)duel.leave();
      const previous=conn;
      conn=null;previous?.close();field.leave();known.clear();status="closed";lastPhase="idle";
      if(previous){
        game.realmWalking?.(intentional?"leave":"suspend");
        if(intentional)syncPosition();
      }
      if(intentional){remember();availability="quiet";roster=[];}
      closing=false;refresh();
    }
    function restore(cachedPage=false){
      if(conn)return;
      const saved=readSession();
      if(!saved)return;
      const nav=window.performance?.getEntriesByType?.("navigation")?.[0]?.type;
      const sameTab=cachedPage||nav==="reload"||nav==="back_forward";
      if(sameTab){connect(saved.room,saved);if(duel.read().phase==="active")go("online","duel","root");}
    }
    const button=(id,label,value=null,detail="",extra={})=>row("realm-"+id,label,value,detail,extra);
    function banner(){
      if(!conn)return {label:"Play online",detail:"See other couriers, tend lanterns and duel.",id:"nav",value:"online"};
      const d=duel.read(),count=people().filter(p=>p.region===state().region).length;
      const where=count?count+" here":status==="local"?"Local realm":status==="offline"?"Reconnecting…":status==="connecting"?"Connecting…":"0 nearby";
      return {id:"nav",value:"online",label:d.phase==="incoming"?"Duel invitation":d.phase==="active"?"Live duel":where,
        detail:roomName(room)+" · "+(shortStatus[status]||"Connecting")};
    }
    function mapOuting(){
      if(!conn)return null;
      const event=field.event();if(!event)return null;
      const d=duel.read();
      const find=d.phase==="idle"&&availability!=="queue";
      const title=d.phase==="incoming"?"Duel invitation":d.phase==="done"?"Duel result":find?"Find a duel":"Duel gathering";
      return {title:roomName(room),belowMap:true,routes:[
        button("event","Waylight relay",null,event.lit+" / 3 lanterns burning",{badge:"PUBLIC EVENT",image:"ui/lantern-commons.png",tone:"primary"}),
        button(find?"queue":d.phase==="done"?"arena":"home",title,null,d.phase==="incoming"?"Review the challenge":find?"Queue with your trio":"Visit the gathering",{badge:"FRIENDLY PVP",image:arenaImage(draft()[0])})]};
    }
    function invitation(){
      const d=duel.read();
      if(d.locking)return {title:"Your trio is ready",text:"Waiting for "+personName(d.peer)+" to enter the ring.",rows:[button("decline","Withdraw")]};
      if(d.phase==="incoming")return {title:personName(d.peer)+" challenged you",text:"Choose three companions for a friendly level-20 duel.",
        rows:[button("accept","Accept duel",null,draft().map(name).join(" · "),{tone:"primary"}),button("team","Choose your trio"),button("decline","Decline invitation")]};
      if(d.phase==="outgoing")return {title:"Waiting for "+personName(d.peer),rows:[button("cancel","Withdraw challenge")]};
      if(d.phase==="active"||d.phase==="done")return {rows:[button("arena",d.phase==="active"?"Return to your duel":"View duel result",null,d.message||"",{tone:"primary"})]};
      return null;
    }
    function profile(id){
      const p=person(id);
      if(!p)return {title:"Courier left the trail",sections:[{rows:[button("home","Back to the commons")]}]};
      const d=duel.read(),ready=d.phase==="idle"&&available(id,"outgoing");
      return {title:p.name,kicker:roomName(room)+"   /   COURIER "+id.slice(-4).toUpperCase(),subtitle:regionName(p.region)+" · "+(p.activity==="duel"?"In a duel":p.activity==="battle"?"In a campaign battle":p.duels==="quiet"?"Exploring":p.duels==="queue"?"Looking for a duel":"Open to duels"),
        sections:[...[invitation()].filter(Boolean),{rows:[
          button("challenge","Challenge "+p.name,id,ready?"Friendly level-20 duel · "+draft().map(name).join(" / "):"They must be open to duels and both teams free.",{tone:"primary",disabled:!ready}),
          ...(p.region===state().region?[button("follow","Walk to their tile",id)]:[button("region","Locate on the atlas",p.region)]),
          button("emote","Wave","wave","Send a wave to this region."),button("home","Back to the commons")]}]};
    }
    function teamPage(view){
      const ids=draft(),slot=Number(view.split(":")[1]),page=Math.max(0,Number(view.split(":")[2])||0);
      const replace=view.startsWith("pick:");
      if(!replace)return {title:"Your duel trio",kicker:"FRIENDLY PVP   /   LEVEL 20",subtitle:"Your first kin leads. Everyone starts at full health with their species’ arena skills.",
        sections:[{rows:ids.map((id,i)=>button("slot",name(id),i,game.species[id].types.join(" / "),{image:arenaImage(id),badge:i===0?"LEAD":"RESERVE "+i}))},
          {rows:[button("home","Use this trio",null,null,{tone:"primary"})]}]};
      const all=state().party.map(p=>p.id).filter(id=>!game.species[id].bonus&&(!search||
        [name(id),game.kin(id,{owned:true}).name,...game.species[id].types].some(t=>t.toLowerCase().includes(search))));
      const per=8,start=Math.min(page,Math.max(0,Math.ceil(all.length/per)-1))*per;
      return {title:slot===0?"Choose your lead":"Choose a reserve",kicker:"YOUR DUEL TRIO",sections:[{rows:[
        button("search",search?"Search · "+search:"Find a companion",slot),...all.slice(start,start+per).map(id=>button("pick",name(id),slot+"|"+id,game.species[id].types.join(" / "),{image:arenaImage(id),badge:ids.includes(id)?"IN TRIO":""})),
        ...(start?[button("pickpage","Previous eight",slot+":"+(page-1))]:[]),...(start+per<all.length?[button("pickpage","Next eight",slot+":"+(page+1))]:[]),
        button("team","Back to trio")]}]};
    }
    function eventPage(){
      const e=field.event();
      if(!e)return home();
      return {title:e.title,kicker:regionName(state().region)+"   /   PUBLIC EVENT",subtitle:e.description,
        sections:[{title:e.lit+" of "+e.total+" lanterns burning",text:(e.earned?"You earned this round’s pin.":e.mine?"You helped this round.":"Light or tend one lantern to share the credit.")+
          " Next round in "+Math.ceil(e.remainingMs/60000)+" min · "+e.badges+" regional pins collected.",
          rows:e.lanterns.map(l=>button("lantern",l.name,l.id,l.mine?"You tended this lantern.":l.near?(l.lit?"Tend this flame":"Light this flame"):"Walk here to "+(l.lit?"tend the flame":"light the wick"),{badge:l.mine?"TENDED":l.lit?"LIT":"UNLIT",disabled:l.mine}))},
          {rows:[button("map","Return to the map"),button("home","Realm gathering")]}]};
    }
    function home(){
      const active=!!conn&&room===requested;
      if(!active){
        return {title:roomName(requested),kicker:"WILDERKIN   /   ONLINE WORLD",
          subtitle:"Meet other players on the trail. Light the region’s lanterns together or bring three kin to a friendly duel.",
          art:{src:"ui/lantern-commons.png",landscape:true,height:156},
          sections:[{rows:[button("join",conn?"Switch to "+roomName(requested):"Join "+roomName(requested),requested,
            "Share your courier, lead kin and tile with players in this realm.",{tone:"primary"}),
            ...(!conn&&requested===publicRoom?[button("private","Create a friends’ clearing",null,"Share a link to meet in your own realm.")]:[]),
            button("worlds","Choose a public world"),
            button("map","Return to the trail")]},{text:"Cross-device play uses public Nostr Game Engine relays. Your campaign stays saved in this browser."}]};
      }
      const list=people(),d=duel.read(),e=field.event(),me=field.self();
      const r=state().region,local=list.filter(p=>p.region===r).length;
      const size=12,lastPage=Math.max(0,Math.ceil(list.length/size)-1);
      playersPage=Math.min(playersPage,lastPage);
      const travelers=list.slice(playersPage*size,(playersPage+1)*size).map(p=>button("person",p.name,p.id,regionName(p.region)+" · "+
        (p.emote||({battle:"In battle",duel:"Dueling"}[p.activity])||(p.duels==="queue"?"Looking for a duel":p.duels==="open"?"Open to duels":"Exploring")),
        {image:portrait(p)}));
      return {title:roomName(room),kicker:(shortStatus[status]||"Connecting").toUpperCase()+"   /   "+(me?.name||"COURIER"),
        subtitle:regionName(r)+" · "+local+" other "+(local===1?"courier":"couriers")+" here · "+list.length+" across the realm.",
        sections:[...[invitation()].filter(Boolean),{rows:[
          button("map","Explore together",null,"See moving couriers and lanterns on the map.",{tone:"primary"}),
          ...(e?[button("event",e.title,null,e.lit+" / "+e.total+" lanterns lit"+(e.earned?" · pin earned":""))]:[])]},
          {title:"Friendly duels",rows:[
            ...(d.phase==="idle"?[button("queue",availability==="queue"?"Leave the duel queue":"Find a duel",null,
              availability==="queue"?"Searching this realm for another willing player.":"Match with another player looking to battle."),
              button("toggle",availability==="quiet"?"Open to challenges":"Mute challenges",null,availability==="quiet"?"Allow invitations while you explore.":"Explore quietly.")]:[]),
            ...(["idle","incoming"].includes(d.phase)&&!d.locking?[button("team","Choose your trio",null,draft().map(name).join(" / "))]:[])]},
          {title:"Players in the realm",text:list.length?(lastPage?"Page "+(playersPage+1)+" of "+(lastPage+1):""):
            status==="online"?"No other couriers in view yet. A friend can join with the realm link.":status==="local"?"Searching for the internet relay. Tabs in this browser can still meet here.":
            "Looking for other couriers…",
            rows:[...travelers,...(playersPage?[button("players","Previous couriers",playersPage-1)]:[]),...(playersPage<lastPage?[button("players","More couriers",playersPage+1)]:[])]},
          {title:"Gathering",rows:[button("copy","Copy realm link"),...["wave","rally","thanks"].map((v,i)=>button("emote",["Wave","Rally here","Thank the group"][i],v)),
            button("cloak","Choose your courier cloak"),button("worlds","Change public world"),button("leave","Leave online mode")]}]};
    }
    function model(view){
      if(view==="worlds")return {title:"Public worlds",kicker:"LANTERN COMMONS",subtitle:"Each world has its own couriers, lantern events and duel queue. Choose the same world to meet friends.",
        sections:[{columns:2,rows:worlds.map((id,i)=>button("world","World "+(i+1),id,roomName(id),{badge:conn&&id===room?"YOU ARE HERE":""}))}]};
      if(!conn||requested!==room)return home();
      if(view==="duel"&&["active","done"].includes(duel.read().phase))return duel.model();
      if(view==="event")return eventPage();
      if(view==="cloak")return {title:"Choose your courier cloak",kicker:"LANTERN COMMONS",subtitle:"Other players see your trail name and coat. This device remembers your choice.",
        sections:[{rows:field.looks().map(l=>button("wear",l.name,l.id,l.current?"Your current cloak":"Wear this cloak",{image:portrait(l),badge:l.current?"EQUIPPED":""}))},
          {rows:[button("home","Back to the commons")]}]};
      if(view?.startsWith("person:"))return profile(view.slice(7));
      if(view==="team"||view?.startsWith("pick:"))return teamPage(view);
      return home();
    }
    function open(view=null){go("online",view);}
    function showResult(result){if(result?.ok===false)notify(result.message||"That action is unavailable.");refresh();}
    function lantern(id){
      const l=field.event()?.lanterns.find(p=>p.id===id);
      if(!l)return;
      if(l.near){const res=field.light(id);notify(res.message);refresh();}
      else walkTo(l,{kind:"realm-lantern",id});
    }
    async function copy(){
      const url=new URL(window.location.href);url.hash=address(room);
      try{await window.navigator.clipboard.writeText(url.href);notify("Realm link copied.");}
      catch{window.prompt?.("Copy this realm link",url.href);}
    }
    function act(id,v){
      if(typeof id!=="string"||!id.startsWith("realm-"))return false;
      if(id.startsWith("realm-duel-")){
        duel.act(id,v);
        if(duel.read().phase==="idle")open();else refresh();
        return true;
      }
      if(id==="realm-join"){connect(requested);open();return true;}
      if(id==="realm-worlds"){open("worlds");return true;}
      if(id==="realm-world"){if(worlds.includes(v)){requested=v;open();}return true;}
      if(id==="realm-private"){
        const bytes=new Uint8Array(6);window.crypto.getRandomValues(bytes);
        connect("friends-"+Array.from(bytes,n=>n.toString(16).padStart(2,"0")).join(""));open();return true;
      }
      if(id==="realm-map"){if(conn)requested=room;go("world",null,"root");return true;}
      if(!conn)return true;
      switch(id){
        case "realm-home":requested=room;open();break;
        case "realm-arena":open("duel");break;
        case "realm-event":open("event");break;
        case "realm-lantern":lantern(v);break;
        case "realm-person":open("person:"+v);break;
        case "realm-players":if(Number.isInteger(v)&&v>=0){playersPage=v;open();}break;
        case "realm-cloak":open("cloak");break;
        case "realm-wear":{const result=field.wear(v);notify(result.message);refresh();break;}
        case "realm-follow":{const p=person(v);if(p&&p.region===state().region)walkTo(p,null);break;}
        case "realm-region":if(Number.isInteger(v)&&game.regions[v])regionPage(v);break;
        case "realm-emote":notify(field.wave(v).message);refresh();break;
        case "realm-team":open("team");break;
        case "realm-slot":search="";open("pick:"+v+":0");break;
        case "realm-pickpage":open("pick:"+v);break;
        case "realm-search":{const q=window.prompt?.("Search your companions by name or affinity",search);if(q!=null)search=q.trim().slice(0,45).toLowerCase();open("pick:"+v+":0");break;}
        case "realm-pick":{
          const [s,id]=String(v).split("|"),slot=Number(s),ids=draft();
          if(!Number.isInteger(slot)||slot<0||slot>2||!state().party.some(p=>p.id===id))break;
          const other=ids.indexOf(id);if(other>=0)ids[other]=ids[slot];ids[slot]=id;roster=ids;remember();open("team");break;
        }
        case "realm-toggle":availability=availability==="quiet"?"open":"quiet";remember();publish(true);refresh();break;
        case "realm-queue":availability=availability==="queue"?"open":"queue";matchAt=0;remember();publish(true);heartbeat();open();break;
        case "realm-challenge":showResult(duel.invite(v,draft()));open();break;
        case "realm-accept":showResult(duel.accept(draft()));break;
        case "realm-decline":case "realm-cancel":
          if(availability==="queue"){availability="open";remember();publish(true);}
          showResult(id==="realm-decline"?duel.decline():duel.cancel());break;
        case "realm-copy":void copy();break;
        case "realm-leave":disconnect();requested=publicRoom;go("world",null,"root");notify("You left the realm.");break;
        default:return false;
      }
      return true;
    }
    function fromHash(hash){
      const m=/^#online(?:\/(friends-[a-f0-9]{12}|commons-[2-8]))?$/.exec(hash);
      if(!m)return false;
      requested=duel.read().phase==="active"?room:m[1]||publicRoom;
      return true;
    }
    return {model,act,restore,fromHash,key:e=>duel.key(e),pose:(region,reduced)=>conn&&field.pose(region,reduced),hit:(r,x,y)=>conn&&field.hit(r,x,y),
      publish,banner,mapOuting,campaignEncounter,arrive:id=>{publish();lantern(id);open("event");},openPerson:id=>open("person:"+id),openEvent:()=>open("event"),
      address:()=>address(requested),disconnect,suspend:()=>disconnect(false),active:()=>duel.read().phase==="active",connected:()=>!!conn};
  }
  window.WilderRealm={create};
})();
