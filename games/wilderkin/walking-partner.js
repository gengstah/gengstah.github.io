// Walking companionship, trail reading and memories are independent of the battle formation.
(() => {
  "use strict";
  const directions=[[0,-1,"north"],[1,0,"east"],[0,1,"south"],[-1,0,"west"]];
  const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  const point=p=>({x:p.x,y:p.y});
  const now=()=>globalThis.performance?.now()??Date.now();
  const moods={
    Grove:["brushes the dust from Finch’s boots with a fresh leaf","traces the bent stems beside the path","finds a bit of green and holds it up as if it were treasure"],
    Ember:["settles close enough to warm the little buckle on Finch’s pack","pauses beside a patch of stone that is still warm","warms one side of Finch’s notebook until its damp pages uncurl"],
    Tide:["restores a bead of water to a drying print with a careful nudge","follows a line where the dew has been disturbed","coaxes a drop along the edge of Finch’s sleeve"],
    Vane:["returns from a little circuit and matches Finch’s pace","tests the breeze above the trail","waits for a rising current, then stirs the air past Finch’s face"],
    Arc:["greets Finch with a tick of static against the brass satchel clasp","listens for a break in the hum of the ground","draws a spark between two pebbles and waits for Finch to notice"],
    Loam:["nudges a flat pebble beside Finch’s foot","picks out the firm ground beside the freshest prints","rests its weight against a warm stone beside Finch"],
    Rime:["presses a tiny frost flower onto the dark cover of Finch’s notebook","finds a break in the thin crust at the trail edge","leaves one little patch of unmelted frost under Finch’s hand"],
    Gloam:["steps into the shade of Finch’s pack and stays there","listens into a sheltered pocket where the wind goes quiet","settles close enough for Finch to feel its breathing"],
    Chime:["sounds a quiet two-note greeting and waits for an answer","waits for a second note under the ordinary sound of the trail","copies the click of Finch’s buckle, a little more tunefully each time"],
    Alloy:["straightens the bent brass tab on Finch’s map case","follows the scrape marks on a flat stone","taps the clasp of Finch’s bag until it sits just right"]
  };
  const weatherTalk={
    wood:"A seed has caught on your sleeve. Your companion stays still until you can lift it into the light.",
    fen:"Ripples run ahead through the reeds. The two of you stop until you can tell which are your own.",
    dune:"The wind is filling in the prints behind you. Your companion presses a fresh mark beside yours.",
    alpine:"The path drops away beyond the shoulder. Your companion takes the inside of the next bend with you.",
    grotto:"A drip strikes the cave floor. Your companion looks back when its echo reaches you from behind.",
    shore:"The tide has left a line of empty shells. Your companion picks a way between them without a crunch.",
    basalt:"The old stone holds the afternoon heat. Your companion settles on it for a moment beside you.",
    ice:"One pair of tracks looks blue in the shade and gold in the sun. Your companion follows them back to you.",
    night:"A lamp winks across the dark trail. Your companion stands shoulder to shoulder with you until it winks again.",
    mesa:"A red grain of grit jumps every time your companion steps. Finch sketches the little pattern in the margin."
  };
  const glideGuards=new Set(["Reed Parry","Talon Block","Sail Juke","Talon Swerve","Wing Shroud","Ash Veil","Mirror Glide","Bell Recoil"]);
  const lowGuards=new Set(["Coil Brace","Shell Door","Tail Check","Flipper Check","Fin Parry","Slick Slide"]);
  function restore(raw,party,species,regions) {
    const owned=new Set(party.map(p=>p.id));
    const mode=raw?.mode==="hidden"||raw?.mode==="lead"||owned.has(raw?.mode)?raw.mode:"lead";
    const memories={};
    for(const [id,m] of Object.entries(raw?.memories||{})) {
      if(!owned.has(id)||!Number.isInteger(m?.region)||!regions[m.region])continue;
      if(m.kind==="crest" && regions[m.region].crest)memories[id]={kind:"crest",region:m.region};
      else if(m.kind==="note" && Object.hasOwn(species,m.subject))memories[id]={kind:"note",region:m.region,subject:m.subject};
    }
    const a=raw?.last;
    const last=Number.isInteger(a?.region)&&regions[a.region]&&Number.isInteger(a.x)&&a.x>=0&&a.x<24&&Number.isInteger(a.y)&&a.y>=0&&a.y<13?
      {region:a.region,x:a.x,y:a.y}:null;
    return {mode,memories,last};
  }
  function create({species,regions}) {
    let animation=null;
    const normalise=(raw,party)=>restore(raw,party,species,regions);
    const mode=s=>s.walking?.mode||"lead";
    const current=s=>mode(s)==="hidden"?null:mode(s)==="lead"?s.lead:mode(s);
    const playerPoint=s=>s.positions[s.region]||window.WilderWorld.regions[s.region].spawn;
    function initial(s,player) {
      const world=window.WilderWorld,map=world.regions[s.region],previous=s.walking?.last;
      if(previous?.region===s.region && distance(previous,player)===1 && world.walkable(s.region,previous.x,previous.y))return point(previous);
      const adjacent=directions.map(([dx,dy])=>({x:player.x+dx,y:player.y+dy})).filter(p=>world.walkable(s.region,p.x,p.y));
      return adjacent.find(p=>!map.sites.some(site=>distance(p,site)===0))||adjacent[0]||point(player);
    }
    function step(s,previous,next,time=now()) {
      if(!s.walking)return;
      if(!previous || distance(previous,next)!==1) {s.walking.last=null;animation=null;return;}
      // Each destination is the player's previous tile. Even a direction change at a corner
      // moves the follower over the consumed edge, never diagonally through scenery.
      const from=initial(s,previous);
      s.walking.last={region:s.region,...point(previous)};
      animation={id:current(s),region:s.region,from,to:point(previous),at:time};
    }
    function pose(s,time=now(),reduced=false) {
      const id=current(s);
      if(!id||!species[id]||!window.WilderWorld)return null;
      const tile=initial(s,playerPoint(s)),a=animation,kin=species[id];
      let x=tile.x,y=tile.y,progress=1,dx=0,dy=0;
      if(a && a.id===id && a.region===s.region && a.to.x===tile.x&&a.to.y===tile.y) {
        progress=reduced?1:Math.max(0,Math.min(1,(time-a.at)/115));
        dx=a.to.x-a.from.x;dy=a.to.y-a.from.y;
        x=a.from.x+dx*progress;y=a.from.y+dy*progress;
      }
      const guard=kin.skills.find(s=>s.kind==="guard")?.name;
      return {id,x,y,tileX:tile.x,tileY:tile.y,dx,dy,progress,
        gait:glideGuards.has(guard)?"glide":lowGuards.has(guard)?"slide":"step"};
    }
    function select(s,value) {
      if(s.battle)return {ok:false,kind:"error",message:"Choose your walking companion after the encounter."};
      if(value!=="lead"&&value!=="hidden"&&!s.party.some(p=>p.id===value))return {ok:false,kind:"error",message:"Choose a companion you have befriended."};
      s.walking.mode=value;animation=null;
      return {ok:true,kind:"walker",message:value==="hidden"?"Finch will walk alone.":value==="lead"?"Your party leader will walk beside Finch.":species[value].name+" will walk beside Finch."};
    }
    function remember(s,kind,subject) {
      const id=current(s);
      if(!id||!s.walking||!s.party.some(p=>p.id===id))return;
      const memories=s.walking.memories;
      if(kind==="note"&&s.fieldwork?.[subject]?.complete&&!memories[id])memories[id]={kind,subject,region:s.region};
      if(kind==="crest"&&subject===s.region&&s.crests.includes(s.region)&&memories[id]?.kind!=="crest")memories[id]={kind,region:s.region};
    }
    function memoryText(s,id) {
      const m=s.walking?.memories[id];
      if(!m)return "";
      const r=regions[m.region],name=species[id].name;
      if(m.kind==="crest")return "After you earned the "+r.crest+", Finch sat down outside "+r.lodge+". "+name+" nosed the new crest until the metal stopped swinging. That is the part Finch drew.";
      return "In "+r.name+", Finch and "+name+" stayed quiet long enough to read "+species[m.subject].name+"’s signs. The first line in their shared notebook still has a smudge at the edge.";
    }
    function info(s) {
      const id=current(s),setting=mode(s);
      if(!id)return {id:null,mode:setting,name:"Walking alone"};
      const p=s.party.find(p=>p.id===id),k=species[id],r=regions[s.region],voice=moods[k.type]||moods.Grove;
      const hurt=p.hp*3<=p.maxHp;
      let moment=k.name+" "+voice[0]+".";
      if(!p.hp)moment=k.name+" rests against Finch at every stop. It perks up a little when Finch turns toward the camp trail.";
      else if(hurt)moment=k.name+" takes shorter steps. It stays near Finch and looks toward the camp trail.";
      else if(s.landmark==="camp")moment="A coal settles in the campfire. "+k.name+" "+voice[2]+".";
      else if(s.landmark==="warden"&&r.warden)moment=s.crests.includes(s.region)?k.name+" pauses outside "+r.lodge+". The "+r.crest+" taps the satchel when Finch turns back.":k.name+" looks from Warden "+r.warden+" to Finch, then leans in until they touch.";
      else if(s.fieldwork?.[id]?.complete&&window.WilderKinDex.encounterPools[s.region].includes(id))moment=k.name+" stops where Finch first studied its movements. This time it waits beside Finch while another wild kin takes its place.";
      else if(window.WilderKinDex.encounterPools[s.region].includes(id))moment=k.name+" leaves Finch’s side just long enough to touch a familiar trail marker, then returns without a call.";
      return {id,mode:setting,name:k.name,hp:p.hp,maxHp:p.maxHp,moment,resting:!p.hp,
        weather:weatherTalk[r.biome]||weatherTalk.wood,greeting:k.name+" "+voice[2]+".",seeking:k.name+" "+voice[1]+".",
        memory:memoryText(s,id),region:r.name};
    }
    function sense(s,sightings,job,objective) {
      if(!current(s)||s.battle)return null;
      const world=window.WilderWorld,region=world.regions[s.region],start=playerPoint(s),sites=region.sites;
      const unsolved=sightings.filter(site=>!s.fieldwork?.[site.species]?.complete);
      let targets=unsolved,screen="study";
      if(!targets.length) {
        let kind=job.targetSite;
        screen="expedition";
        if(job.done) {
          const here=regions[s.region];
          const away=objective?.target!=null&&objective.target!==s.region;
          if(!away && here.warden && !s.crests.includes(s.region)) {
            const heard=window.WilderStory.chapterDone(s,here.ordinal);
            kind=heard?"warden":"camp";screen=heard?"warden":"chronicle";
          } else if(!away && s.crests.length===window.WilderAtlas.routes.length&&!window.WilderStory.ending(s)) {
            kind="camp";screen="chronicle";
          } else {kind="travel";screen="atlas";}
        }
        targets=sites.filter(site=>(site.kind||site.id)===kind);
      }
      const byTile=new Map(targets.map(site=>[site.x+","+site.y,site]));
      const queue=[{...point(start),steps:0,first:"here"}],seen=new Set([start.x+","+start.y]);
      for(let i=0;i<queue.length;i++) {
        const p=queue[i],site=byTile.get(p.x+","+p.y);
        if(site)return {site:site.species?site.id:sites.indexOf(site),species:site.species||null,kind:site.kind||site.id,label:site.label,
          steps:p.steps,direction:p.first,screen};
        for(const [dx,dy,dir] of directions) {
          const x=p.x+dx,y=p.y+dy,key=x+","+y;
          if(seen.has(key)||!world.walkable(s.region,x,y))continue;
          seen.add(key);queue.push({x,y,steps:p.steps+1,first:p.steps?p.first:dir});
        }
      }
      return null;
    }
    return {restore:normalise,info,select,step,pose,remember,sense};
  }

  function pages({game,row,image,go,render,notify,locate}) {
    const select=(value,label,detail,extra={})=>row("walk-partner-select",label,value,detail,extra);
    const show=(value,label,detail)=>row("walk-partner-page",label,value,detail);
    function model(value) {
      const s=game.state,p=game.walkerInfo();
      if(String(value||"").startsWith("roster")) {
        const list=s.party.slice().sort((a,b)=>game.species[a.id].name.localeCompare(game.species[b.id].name));
        const total=Math.ceil(list.length/8),page=Math.min(total-1,Math.max(0,parseInt(String(value).split("-")[1])||0));
        const rows=list.slice(page*8,page*8+8).map(c=>select(c.id,game.species[c.id].name,
          (s.team.includes(c.id)?"Traveling party":"At camp")+" · Lv. "+c.level,{image:image(c.id),badge:p.id===c.id?"WALKING":"",disabled:!!s.battle}));
        const nav=[];
        if(page>0)nav.push(show("roster-"+(page-1),"Previous page"));
        if(page<total-1)nav.push(show("roster-"+(page+1),"Next page"));
        return {title:"Choose a walking partner",kicker:"TRAIL COMPANIONS",subtitle:"A friend at camp can join Finch on the map while your battle team keeps its places.",
          sections:[{columns:2,rows},...(nav.length?[{title:"Page "+(page+1)+" / "+total,columns:2,rows:nav}]:[])]};
      }
      if(value==="sense"&&p.id) {
        const lead=game.walkerSense(),sections=[{text:p.seeking}];
        if(lead) {
          const direction=lead.steps===0?"You are standing at the spot.":lead.steps===1?"One step "+lead.direction+".":"Head "+lead.direction+" first. The trail leads "+lead.steps+" steps to the spot.";
          const goal=lead.species?game.species[lead.species].name:lead.label;
          sections.push({title:lead.species?"Fresh wildlife signs":"The way onward",text:direction},
            {rows:[row("walk-partner-follow","Follow "+p.name,null,goal,{tone:"primary"})]});
        } else sections.push({text:"Your companion can read the local trail again when the encounter is over."});
        return {title:"Trail sense",kicker:p.name+"   /   "+p.region,sections};
      }
      const selection=[show("roster","Choose any companion",s.party.length+" befriended"),
        select("lead","Walk with the battle leader",game.species[s.lead].name,{badge:p.mode==="lead"?"AUTO":"",disabled:!!s.battle}),
        select("hidden","Walk alone","Let your companion rest off the map.",{badge:p.mode==="hidden"?"ACTIVE":"",disabled:!!s.battle})];
      const sections=[];
      if(p.id) {
        sections.push({title:"Together on the trail",text:p.moment},
          {columns:2,rows:[show("sense","Read the trail together","Find a wildlife sighting or a way onward."),show(value==="quiet"?"":"quiet",value==="quiet"?"Back to the trail notes":"Share a quiet moment","Notice this place together.")]});
        if(value==="quiet")sections.push({title:p.region,text:p.weather+" "+p.greeting});
        if(p.memory)sections.push({title:"A shared memory",text:p.memory});
      }
      sections.push({title:"Walking companion",rows:selection});
      return {title:p.id?p.name:"Finch’s walking partners",kicker:"TRAIL COMPANIONS",sections,
        art:p.id?{src:image(p.id),caption:p.mode==="lead"?"Walking with the battle leader":"Finch’s chosen walking partner"}:undefined};
    }
    function act(id,value) {
      if(id==="walk-partner-page"){go("walker",value);return true;}
      if(id==="walk-partner-select"){const r=game.setWalker(value);if(r.ok)go("walker",null,"replace");else render();notify(r.message);return true;}
      if(id==="walk-partner-follow"){
        const h=game.walkerSense();
        if(h)locate(h.site,h.species?"":h.screen);
        else notify("There is no trail to follow here.");
        return true;
      }
      return false;
    }
    return {model,act};
  }
  function hit(p,x,y) {
    return !!p&&p.tileX===x&&p.tileY===y;
  }
  window.WilderWalkingPartner={create,pages,hit};
})();
