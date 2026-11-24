// Wildlife encounters track distinct, observable behaviors. No clock or random capture roll gates a note.
(() => {
  "use strict";

  const signals = ["trace","sound","surroundings"];
  const clueNames = ["Read the traces","Listen closely","Watch the surroundings"];
  const methods = {
    yield:["Leave a crossing open","Step aside and stay clear of the route."],
    shade:["Cast a little shade","Hold the journal between the subject and the light."],
    light:["Open the light","Move the folded blind aside so the light reaches the ground."],
    quiet:["Dampen the noise","Lay your scarf over the rattling trail bell."],
    echo:["Answer the second call","Tap the hollow cover of your journal in the pause."],
    marker:["Mark a safe landing","Lay a pale reed across the stable edge."],
    wind:["Raise a wind ribbon","Lift a loose ribbon where the air can catch it."],
    spill:["Loosen the spillway","Lift a pebble to let a small trickle run through."],
    dam:["Stop the trickle","Wedge the loose pebble back into the seep."],
    steady:["Steady the loose stone","Hold the flat stone still against the bank."],
    room:["Give the nest room","Lower yourself behind the blind, away from the nest."],
    straw:["Leave dry nesting fiber","Slide loose grass beside the unfinished rim."],
    cache:["Cover the cache","Draw a thin screen of loose leaves over the pile."],
    reveal:["Open a seed pocket","Brush litter away from the buried seeds."],
    perch:["Offer a dry perch","Set the fallen branch across the wet ground."],
    mirror:["Reflect the signal","Turn the polished clasp of your satchel toward the far bank."]
  };
  // A recurring silhouette can mean different things. Track, sound, and social clues distinguish the two cases.
  const behaviors = [
    ["crossing","The last one across","yield",["marker","echo"],
      "Two sets of prints cross the gap. A third, much smaller set stops at your feet.",
      "There is a short call from the far side, then a much softer answer behind you.",
      "The kin looks past you whenever something small stirs in the grass.",
      "A youngster darts through the space you leave. The adult waits for it, then turns back to you."],
    ["crossing","Testing the landing","marker",["yield","wind"],
      "Scuffed takeoff marks all point at a firm shelf beside a patch of loose ground.",
      "Each test jump ends in a clatter of falling grit, followed by a quiet pause.",
      "There is a safe ledge, but the edge disappears against the ground behind it.",
      "The pale reed makes the edge visible. The kin lands beside it on the first try."],
    ["nest","An unfinished cradle","straw",["room","shade"],
      "Short ends of grass stick out of an unfinished nest. The only long pieces lie out of reach.",
      "Every few breaths there is a little rasp as another too-short stem slips loose.",
      "The kin is weaving alone. It keeps reaching toward the fallen dry grass.",
      "A long stem locks the rim into place. The kin tucks the last loose end under your sleeve."],
    ["nest","The nest on watch","room",["straw","echo"],
      "The nest rim is tightly woven. Small tracks lead in, while adult tracks circle it.",
      "Something cheeps under the lining. The adult answers only when you stand back.",
      "A small face appears behind the adult whenever your shadow leaves the nest.",
      "From the blind you see the hidden young climb out. The parent settles next to your boots."],
    ["call","A call cut short","echo",["quiet","mirror"],
      "Pairs of prints stop on opposite sides of a hollow with a strong echo.",
      "The far caller sounds once. The near caller repeats it and leaves a deliberate beat of silence.",
      "The pair exchange places, listening through the same gap in their rhythm.",
      "Your answering tap completes the phrase. The kin carries the rhythm back to its companion."],
    ["call","A sound under the bell","quiet",["echo","wind"],
      "Tiny search circles crowd the base of a loose metal bell.",
      "Each time the bell stops rattling, a faint answer comes from the roots.",
      "The caller leans toward the roots. A gust rattles the bell and it loses its place.",
      "Under your scarf the bell falls quiet. A hidden neighbor answers, and the pair find each other."],
    ["water","A stranded seed raft","spill",["dam","steady"],
      "A line of stranded seeds stops against a pebble dam, just short of the wet channel.",
      "Seeds scrape against the dry lip. Beyond it you can hear water moving.",
      "The kin keeps nudging the seed raft toward the gap, while the water pools behind the stone.",
      "A trickle lifts the seed raft into the channel. The kin follows it, leaving a clear bank for your sketch."],
    ["water","The washout","dam",["spill","perch"],
      "A downhill trickle cuts straight across the scrape where the kin stores its seeds.",
      "You can hear seeds ticking downstream each time the seep surges.",
      "The kin keeps returning to the same cache just as the running water spills into it.",
      "The wedged pebble diverts the seep. The kin gathers the last drifting seeds and begins to eat."],
    ["glow","A patch of warming light","light",["shade","mirror"],
      "Every resting mark falls within a narrow patch of light. Your blind cuts the patch in half.",
      "A low hum rises whenever a glint of sunlight reaches the resting kin.",
      "The kin turns with the sun and stretches toward the edge of your shadow.",
      "In the open light, the kin uncurls. A row of tiny pollinators joins it in the warm patch."],
    ["glow","The sheltered molt","shade",["light","wind"],
      "Delicate translucent flakes lie only under the few broad leaves that cast full shade.",
      "The scraping stops in deep shadow and starts up when the glare returns.",
      "A companion stands on the bright side of the molting kin, casting a thin, shifting shadow.",
      "In the steady shade the last skin comes free in one piece. The kin leaves it across your open notebook."],
    ["wind","The lost thermal","wind",["perch","quiet"],
      "Short hops turn back at the lip. Loose fibers occasionally rise straight up.",
      "The high notes of the breeze rise and fall, with silence between the gusts.",
      "The kin is watching the airborne fibers to locate the edge of an invisible updraft.",
      "Your ribbon shows the rising air. The kin catches it and glides a full circle over the blind."],
    ["wind","A place to come down","perch",["wind","marker"],
      "Several touchdown marks fill with water. There is no dry place here to rest.",
      "The circling kin gives a tired call. Each time it touches the mud it launches again.",
      "It follows a floating branch but cannot land while the branch rolls in the water.",
      "The branch settles across the bank. The kin steps onto the dry perch, shakes itself and rests."],
    ["store","The unfinished winter cache","cache",["reveal","straw"],
      "A neat mound of seeds has been pushed under loose leaf litter. Its top still shows.",
      "The kin falls silent every time a scavenger calls from overhead.",
      "A shadow passes overhead. The kin hurriedly drags another leaf across its seed pile.",
      "Under the leaf screen the seeds disappear. The kin takes a different path back to its shelter."],
    ["store","Hatching season","reveal",["cache","room"],
      "The seeds have already sprouted. Scrapes in the thick litter stop just short of the shoots.",
      "Small beaks or jaws peck at the litter. The shoots rustle underneath.",
      "New young are searching the old cache. The adult is peeling away the litter, one leaf at a time.",
      "The young reach the first shoots and feed. The adult offers you one split seed husk."],
    ["signal","A glint on the far bank","mirror",["echo","shade"],
      "Two polished stones face one another across a bend. The middle stone has slipped into shadow.",
      "The signaling kin makes no call. It pauses at the same intervals as the distant flashes.",
      "A far-off kin flashes once. On this side, a watcher keeps turning toward the dark middle stone.",
      "Your clasp carries the far flash around the bend. A watcher returns a second, brighter signal."],
    ["signal","The trembling ledge","steady",["echo","marker"],
      "Cracks radiate from a loose stone. The kin keeps pressing it down to compare its vibrations.",
      "A long, hollow rattle masks the much shorter knock the kin is trying to locate.",
      "The loose stone shakes whenever a neighbor taps. The kin tries to hold it still and listen at the same time.",
      "Once you steady the stone, a clean knock comes through. The kin finds the sheltered hollow below."]
  ];
  const habitat = {
    wood:"a leaf-strewn clearing",mesa:"a sheltered rock shelf",night:"a pale starlit hollow",
    fen:"a hollow between reed beds",dune:"the lee of a sand ridge",alpine:"a shelf above the treeline",
    grotto:"a chamber at the cave mouth",shore:"the high bank of a tide pool",basalt:"a pocket in the cooling rock",
    ice:"the lee of a frost ridge"
  };
  const preferred = {
    Tide:["water","store","crossing"], Ember:["glow","signal","nest"], Grove:["store","nest","glow"],
    Vane:["wind","crossing","nest"], Arc:["signal","call","glow"], Loam:["signal","store","nest"],
    Rime:["water","glow","crossing"], Chime:["call","signal","crossing"], Alloy:["signal","call","nest"],
    Gloam:["call","glow","store"]
  };
  const rewardItem={crossing:"reed",nest:"reed",call:"ore",water:"sap",glow:"sap",wind:"reed",store:"sap",signal:"ore"};
  const rewardLabels={reed:"silver reeds",sap:"sun sap",ore:"bellstones"};
  // Family-specific spoor ties the same ecological question to the actual animal on the trail.
  const spoor={
    "Tunnel Feint":"Broad foreclaws have pushed two low ridges of soft soil ahead of each print.",
    "Reed Lunge":"Three long toes have marked the mud. One tip has traced a tiny lure circle.",
    "Horn Brace":"The left and right hoof edges have taken the weight in turn.",
    "Reed Parry":"Four separate wing tips have brushed the pollen on the stems.",
    "Rebound Bump":"A pair of wide landing prints is followed by the round impression of a throat pouch.",
    "Roll Brace":"The shallow track carries a row of overlapping plate impressions.",
    "Tail Check":"A fine tail line doubles back within the space between two prints.",
    "Talon Block":"Two hooked talons have pressed small crescents into the perch.",
    "Sail Juke":"Four tiny landing marks are joined by the faint print of a fold of skin.",
    "Quill Brace":"A fan of fine quill marks shows where the animal turned on its side.",
    "Heel Feint":"Two long heel prints land ahead of the shorter forefeet.",
    "Flipper Check":"The foreflippers have pulled two parallel furrows through the grit.",
    "Grip Feint":"The splayed toe pads have lifted a layer of dust clean off the stone.",
    "Pincer Block":"Six small prints run sideways beside a deep scrape from the larger claw.",
    "Antler Turn":"Twig forks are polished at the exact height of the lowest antler tine.",
    "Bell Recoil":"Fine streamer lines end at the round mark of a resting bell.",
    "Coil Brace":"A crescent of smooth soil marks the inside of a tightening coil.",
    "Talon Swerve":"The long outer flight feathers have skimmed the ground in a fan.",
    "Cache Feint":"Paired forepaws have left tiny, close-set strokes at the edge.",
    "Shell Door":"The broad foot has left a single damp line under the edge of the shell.",
    "Fin Parry":"A narrow drag mark from the lure crosses two parallel fin strokes.",
    "Cap Guard":"A ring of pale spores has collected in the deep heel prints.",
    "Wing Shroud":"Two hooked hind toes have scored the underside of a low perch.",
    "Scythe Parry":"Paired curls of cut grass mark the resting edge of the folded forelimbs.",
    "Beak Guard":"Heavy hind paws have stamped the same patch between lighter feather tracks.",
    "Silk Check":"Fine silk threads bridge the eight pinpricks at the edge of the track.",
    "Brush Dash":"The leaf tips have brushed twin narrow streaks above the paw prints.",
    "Cinder Roll":"Grains around the tail mark have fused into little beads of glass.",
    "Slick Slide":"The feathery fins have traced a comb pattern in the film of water.",
    "Shell Bump":"Petals shaken from the shell garden have caught in the fresh prints.",
    "Ash Veil":"Ember scales glint in the dust where the wings brushed a stem.",
    "Mirror Glide":"A thin, wet arc marks the waterline beneath each gliding turn."
  };
  function seed(text) {
    let n=2166136261;
    for (const char of text) n=Math.imul(n^char.charCodeAt(0),16777619);
    return n>>>0;
  }
  const error = message=>({ok:false,kind:"error",message});
  function create({species,pools,regions}) {
    const homes=new Map(),locations=new Map();
    pools.forEach((pool,i)=>pool.forEach(id=>homes.set(id,i)));
    function behavior(id) {
      const n=seed(id),types=preferred[species[id].type],motif=types[n%types.length];
      const pair=behaviors.filter(b=>b[0]===motif);
      return pair[(n>>>9)%pair.length];
    }
    function restore(raw) {
      const clean={};
      if(!raw || typeof raw!=="object")return clean;
      for(const [id,data] of Object.entries(raw)) {
        if(!homes.has(id)||!data||typeof data!=="object")continue;
        const clues=signals.filter(s=>Array.isArray(data.clues)&&data.clues.includes(s));
        if(!clues.length)continue;
        const [, , , options]=behavior(id);
        const tried=options.filter(s=>Array.isArray(data.tried)&&data.tried.includes(s));
        clean[id]={clues,tried,complete:data.complete===true};
      }
      return clean;
    }
    function sightings(i) {
      if(!Number.isInteger(i)||!regions[i])return [];
      if(!locations.has(i)) {
        const tiles=window.WilderWorld.sightingTiles(i,pools[i].length);
        locations.set(i,pools[i].map((id,n)=>({
          ...tiles[n],id:"sighting:"+id,kind:"sighting",species:id,label:"Watch "+species[id].name,
          motion:behavior(id)[0],seed:seed(id)
        })));
      }
      return locations.get(i);
    }
    function study(state,id) {
      if(!homes.has(id))return null;
      const r=homes.get(id),nearby=state.region===r;
      // Journal lookups across the atlas need no remote map generation.
      const spot=nearby?sightings(r).find(s=>s.species===id):null;
      const pos=nearby?(state.positions[r]||window.WilderWorld.regions[r].spawn):null;
      const atSite=!!(spot && !state.battle && Math.abs(pos.x-spot.x)+Math.abs(pos.y-spot.y)<=1);
      const record=state.fieldwork?.[id]||{clues:[],tried:[],complete:false};
      const [motion,title,correct,others,...lines]=behavior(id),item=rewardItem[motion];
      const offset=seed(id)%3,options=[correct,...others];
      const complete=record.complete,loc=regions[r],kin=species[id];
      const track=spoor[kin.skills.find(s=>s.kind==="guard")?.name];
      return {id,name:kin.name,title,region:r,location:loc.name,biome:loc.biome,theme:loc.theme,atSite,complete,motion,variant:correct,
        description:"In "+(habitat[loc.biome]||"a sheltered clearing")+" at "+loc.name+", "+kin.name+" keeps returning to the same spot.",
        clues:signals.map((code,n)=>({id:"read-"+code,label:clueNames[n],
          text:record.clues.includes(code)||complete?(n===0&&track?track+" ":"")+lines[n]:"",read:record.clues.includes(code)})),
        choices:[0,1,2].map(n=>{
          const method=options[(n+offset)%3];return {id:"try-"+method,label:methods[method][0],detail:methods[method][1],tried:record.tried.includes(method)};
        }),
        canRespond:atSite&&!complete&&record.clues.length>record.tried.length,
        answer:complete?lines[3]:"",reward:"2 "+rewardLabels[item],
        nextHint:record.clues.length===0?"Read one sign before approaching.":record.tried.length>=record.clues.length&&!complete?"Read another sign to try a different approach.":""};
    }
    function observe(state,id,action) {
      const encounter=study(state,id);
      if(!encounter)return error("That species has no field sighting.");
      if(!encounter.atSite)return error("Stand next to the kin on its home map between encounters.");
      if(encounter.complete)return error("This behavior is already recorded in your notebook.");
      const records=state.fieldwork||{},existing=records[id],record=existing||{clues:[],tried:[],complete:false};
      const [prefix,method]=String(action).split("-");
      if(prefix==="read"&&signals.includes(method)&&action==="read-"+method) {
        if(record.clues.includes(method))return error("You have already read that sign.");
        record.clues.push(method);
        records[id]=record;state.fieldwork=records;
        if(!state.seen.includes(id))state.seen.push(id);
        return {ok:true,kind:"observation",message:encounter.name+" · "+clueNames[signals.indexOf(method)]+" recorded."};
      }
      if(!encounter.choices.some(c=>c.id===action))return error("Choose one of the field actions.");
      if(!encounter.canRespond)return error(encounter.nextHint||"Read a sign before trying an approach.");
      if(record.tried.includes(method))return error("You have already seen its response to this approach.");
      const [motion,,correct,alternatives]=behavior(id);
      if(correct!==method) {
        record.tried.push(method);
        // Reveal the reacting sense without penalizing supplies or forcing a timed retry.
        const hint=alternatives.indexOf(method)===0?"It turns toward the original disturbance.":"It takes a step away, then returns to the same spot.";
        return {ok:true,kind:"field-reaction",message:hint+" Study another sign to see what you missed."};
      }
      record.complete=true;
      const item=rewardItem[motion];
      state.bag[item]=(state.bag[item]||0)+2;
      return {ok:true,kind:"field-note",message:encounter.title+" entered in your notebook. Found "+encounter.reward+"."};
    }
    function canInvite(state,id) {
      const observation=study(state,id);
      if(!observation?.atSite || !observation.complete)return error("First understand this kin at its sighting.");
      if(state.party.some(p=>p.id===id))return error("This kin is already one of your companions.");
      if(!state.bag.kinweave)return error("Craft a Kinweave to offer a peaceful invitation.");
      return {ok:true,kind:"invite",message:"Offer a Kinweave to "+observation.name+"."};
    }
    function notebook(state) {
      return Object.keys(state.fieldwork||{}).filter(id=>homes.has(id)).map(id=>study(state,id)).sort((a,b)=>a.region-b.region||a.name.localeCompare(b.name));
    }
    return {sightings,study,observe,restore,canInvite,notebook};
  }
  const pigments={
    wood:["#c7debc","#91b36f","#628b58","#436957","#cfad7b","#82bcb0"],fen:["#b8d7bd","#82a981","#577d66","#365c51","#b3b279","#62a69d"],
    mesa:["#eed1a3","#ccac80","#a27e61","#775e55","#dfbd86","#7fa99d"],dune:["#ecd5aa","#d9b980","#b39468","#896f54","#e6c895","#91b4a3"],
    night:["#7b8fae","#687b90","#5a687b","#424b66","#a59cb0","#819bb2"],alpine:["#cedbd4","#9cad9d","#748f85","#576d6a","#c4bf9f","#84adb3"],
    grotto:["#a3a4b7","#858499","#6c687e","#48475f","#ad9a93","#8095a7"],shore:["#cbdbc5","#aabb90","#869d79","#657f6a","#d6c396","#72b0ad"],
    basalt:["#d7b9a3","#ae947d","#8e756a","#685655","#c29c7c","#b37e6b"],ice:["#dce6e3","#b3cbca","#95b1b5","#6e909b","#c6cfc1","#8cb9c4"]
  };
  const images=new Map(),landscapes=new Map();
  function sprite(id) {
    if(!images.has(id)) {
      if(images.size>=60)images.delete(images.keys().next().value);
      const image=new Image();image.src=window.WilderKinDex.spriteUrl(id);images.set(id,image);
    }
    return images.get(id);
  }
  // Paint on the renderer's single canvas. The native-pixel study scene retains silhouettes on small screens.
  function panel(study) {
    return {height:148,draw(ctx,x,y,w,h,time) {
      const pal=pigments[study.biome]||pigments.wood,m=study.motion,calm=study.complete;
      const unit=Math.min(h/74,w/164),width=Math.ceil(w/unit),height=Math.ceil(h/unit),ground=height*.77|0;
      const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const t=reduced?0:(time||0)/1000,phase=Math.floor(t*2)%4;
      const cx=Math.floor(width*.5),rseed=seed(study.id),v=study.variant;
      ctx.save(); ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.translate(x,y);ctx.scale(unit,unit);ctx.imageSmoothingEnabled=false;
      function box(color,xx,yy,ww,hh){ctx.fillStyle=color;ctx.fillRect(Math.round(xx),Math.round(yy),ww,hh);}
      function kin(xx,yy,size,flip=false) {
        const image=sprite(study.id);
        if(!image.complete||!image.naturalWidth)return;
        ctx.save();ctx.translate(Math.round(xx),Math.round(yy));if(flip)ctx.scale(-1,1);
        ctx.drawImage(image,-size/2,-size,size,size);ctx.restore();
      }
      box(pal[0],0,0,width,height);
      for(let layer=0;layer<2;layer++) {
        for(let a=0;a<width;a+=4) {
          const ridge=height*(.24+layer*.13)+Math.sin(a*(layer?.036:.049)+rseed%23)*5+Math.cos(a*.071)*2;
          box(pal[1+layer],a,ridge,4,height);
        }
      }
      box(pal[1],0,ground-7,width,height);
      if(!landscapes.has(study.theme)) {
        const im=new Image();im.src="ui/battle-"+study.theme+".png";landscapes.set(study.theme,im);
      }
      const backdrop=landscapes.get(study.theme);
      if(backdrop.complete&&backdrop.naturalWidth) {
        const bw=backdrop.naturalWidth,bh=backdrop.naturalHeight,ratio=width/height;
        const sw=Math.min(bw,bh*ratio),sh=Math.min(bh,bw/ratio);
        ctx.drawImage(backdrop,(bw-sw)/2,(bh-sh)*.86,sw,sh,0,0,width,height);
        ctx.globalAlpha=.15;box(pal[0],0,0,width,height);ctx.globalAlpha=1;
      }
      const watery=m==="water"||study.biome==="shore"||study.biome==="fen";
      for(let a=0;a<width;a+=5) {
        const drift=Math.sin(a*.036+rseed%8)*2;
        if(watery||!backdrop.complete)box(watery?pal[5]:pal[4],a,ground+drift,5,height-ground+2);
        if(watery&&a%3===phase%3)box(pal[0],a,ground+4+drift,4,1);
      }
      for(let a=6;a<width;a+=13) {
        if(Math.abs(a-cx)<42)continue;
        const n=(rseed%13+a*7)%6,gy=ground+5+n;
        box(pal[2],a,gy-n,1,n);box(pal[2],a-2,gy-3,2,1);box(pal[2],a+1,gy-4,2,1);
      }
      const markerX=cx+27;
      let hop=0,shift=0;
      if(m==="wind"||m==="crossing") {
        shift=Math.round(Math.sin(t*1.1)*(calm?2:6));hop=Math.round(Math.abs(Math.sin(t*1.1))*(m==="wind"?8:2));
      } else if (m==="nest"||m==="store"||m==="water") hop=-Math.round(Math.max(0,Math.sin(t*2.6))*2);
      else hop=Math.round(Math.sin(t*1.3));
      if(m==="water") {
        box(pal[3],markerX-8,ground+1,15,3);
        for(let j=0;j<4;j++)box("#e3c170",markerX-13-j%2*3+(calm&&v==="spill"?phase*3:0),ground+j,2,1);
      }
      if(m==="nest"||m==="store") {
        for(let j=0;j<12;j++) {
          const k=(j*7)%15;
          box(j%2?pal[3]:"#a48051",markerX-9+k,ground+1-(j%4),5,1);
        }
        if(v==="room"||v==="reveal") {
          const littleX=markerX+(calm?5:0),littleY=ground+(calm?0:3);
          kin(littleX,littleY,calm?19:12,true);
          if(!calm)for(let n=0;n<4;n++)box(pal[2],littleX-5+3*n,ground-2,1,4);
        }
      }
      if(m==="crossing"||m==="call"||m==="signal") {
        if(v==="yield"||v==="echo"||v==="mirror")kin(calm&&v==="yield"?cx-31+phase:markerX+6,ground-1,18,true);
        else {box(pal[3],markerX-3,ground-3,10,4);box(pal[1],markerX-1,ground-4,7,2);}
      }
      if(m==="wind"){box(pal[3],markerX-15,ground-1,24,3);box(pal[2],markerX+3,ground-4,5,3);}
      if(m==="glow") {
        box("#dcce91",cx-14,ground-1,31,2);box("#ded79a",cx-10,ground,23,2);
        if(v==="shade"){box(pal[3],markerX-7,ground-29,17,3);box(pal[2],markerX-4,ground-31,12,2);box(pal[3],markerX+3,ground-28,1,28);}
      }
      // Small square ripples, notes and wind flecks follow the behavior's observed rhythm.
      if(m==="call"||m==="signal"||m==="wind") {
        const col=m==="wind"?pal[0]:"#fbdda2";
        for(let j=0;j<3;j++) {
          const dx=((phase+2*j)%6)*3;
          box(col,cx+8+j*7+dx,ground-29-j%2*4-phase,3,1);
          if(m!=="wind")box(col,cx+9+j*7+dx,ground-30-j%2*4-phase,1,3);
        }
      }
      box(pal[2],cx-14+shift,ground+1,28,2);
      kin(cx+shift,ground+1-hop,40);
      ctx.restore();
    }};
  }
  window.WilderFieldwork={create,panel,sprite};
})();
