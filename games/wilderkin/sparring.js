// The hall borrows six kin. A match save is its two lineups and the public moves actually played.
(() => {
  "use strict";
  const gearCopy=gear=>gear?{gear:{left:{...gear.left},right:{...gear.right}}}:{};
  const cloneSetup=s=>({...s,left:s.left.slice(),right:s.right.slice(),...gearCopy(s.gear)});
  const kits={
    "bell-keepers":{mossbell:"opening-pennant",coalmoth:"prism-lens",glimmeray:"mender-wrap"},
    "wind-post":{gustlance:"last-stitch",arcbill:"prism-lens",icereeve:"relay-bell"},
    "night-orchard":{lullprickle:"opening-pennant",leafweft:"seam-hook",pincoil:"relay-bell"},
    "red-foundry":{smelteroll:"last-stitch",boltbur:"prism-lens",kilnclaw:"mender-wrap"}
  };
  const piece=id=>window.WilderSparringGear?.byId(id);
  const held=p=>{
    const item=piece(p.gear);
    return item?{id:item.id,name:item.name,spent:Boolean(p.spent)}:null;
  };
  const member=s=>s.team[s.active];
  const standing=s=>s.team.filter(p=>p.hp>0).length;
  const total=s=>s.team.reduce((sum,p)=>sum+p.hp,0);
  function replay(sim,match,visit) {
    let pos=sim.start(match.setup.left,match.setup.right,match.first,match.setup.gear);
    if(!pos)return null;
    for(const id of match.moves){
      if(typeof id!=="string"||id.length>80)return null;
      const after=sim.apply(pos,id);
      if(!after)return null;
      if(visit)visit(pos,sim.forecast(pos,id),after);
      pos=after;
    }
    return pos;
  }
  function restore(raw,{species}) {
    const clean=setup=>window.WilderSparringTeams.restore(setup,{species});
    const setup=clean(raw?.v===1?raw.setup:null),rec={v:1,setup,match:null,lastReview:null};
    if(window.WilderSparringLibrary)rec.slots=window.WilderSparringLibrary.restore(raw?.v===1?raw.slots:null,{species});
    if(window.WilderCupSeries)rec.cup=window.WilderCupSeries.restore(raw?.v===1?raw.cup:null,{species});
    if(raw?.v!==1)return rec;
    const sim=window.WilderSparringBattle.create({species});
    const validKit=s=>s.gear===undefined||Boolean(window.WilderSparringGear?.validate(s.gear,s.left,s.right));
    const stored=raw.lastReview;
    if(stored?.human===0&&[0,1].includes(stored.first)&&Array.isArray(stored.moves)&&stored.moves.length<=66){
      const teams=clean(stored);
      const same=["left","right"].every(side=>Array.isArray(stored[side])&&stored[side].length===3&&teams[side].every((id,i)=>id===stored[side][i]));
      if(same&&validKit(stored)&&replay(sim,{setup:teams,first:stored.first,moves:stored.moves})?.phase==="done"){
        const scout=window.WilderScoutPractice?.checkCard(stored.scout,{...teams,rival:"custom"},stored.first,species,sim);
        rec.lastReview=tape({setup:teams,first:stored.first,moves:stored.moves,scout},stored.rival??null);
      }
    }
    const m=raw.match;
    if(m&&[0,1].includes(m.first)&&Array.isArray(m.moves)&&m.moves.length<=66){
      const lineups=clean(m.setup);
      if(m.setup&&["cpu","local"].includes(m.setup.mode)&&["left","right"].every(side=>
        Array.isArray(m.setup[side])&&m.setup[side].length===3&&lineups[side].every((id,i)=>m.setup[side][i]===id))&&validKit(m.setup)){
        const match={setup:lineups,first:m.first,moves:m.moves.slice(),handoff:false};
        const pos=replay(sim,match);
        if(pos){
          const scout=window.WilderScoutPractice?.checkCard(m.scout,lineups,m.first,species,sim);
          if(scout)match.scout=scout;
          match.handoff=lineups.mode==="local"&&pos.phase!=="done"&&m.handoff===true;
          rec.match=match;
          if(lineups.mode==="cpu"&&pos.phase==="done")rec.lastReview=tape(match,m.setup.rival??null);
        }
      }
    }
    return rec;
  }
  function tape(m,rival=m.setup.rival){return {left:m.setup.left.slice(),right:m.setup.right.slice(),...gearCopy(m.setup.gear),first:m.first,human:0,moves:m.moves.slice(),
    ...(window.WilderSparringTeams.namedCrew(rival,m.setup.right)?{rival}:{}),
    ...(m.scout?{scout:{...m.scout,ids:m.scout.ids.slice(),gear:{...m.scout.gear},picks:m.scout.picks.slice()}}:{})};}
  function create({game,row,image,go,render,notify,animate,playTone,openFinder,openRentals,active=()=>true}) {
    const species=game.species,sim=window.WilderSparringBattle.create({species});
    const rec=()=>game.state.sparring||restore(null,{species});
    const save=r=>game.saveSparring(r);
    const kin=id=>species[id].name;
    const sideName=(m,side)=>m.setup.mode==="local"?"Player "+(side+1):side===0?"Your team":
      m.cupOpponent||window.WilderScoutPractice?.coachName(m.scout?.coach,m.scout?.rental,species)||rival(m.setup).name;
    const group=(title,rows,columns=1)=>({title,rows,columns});
    const button=(id,label,value,detail="",extra={})=>row("spar-"+id,label,value,detail,extra);
    const link=(label,target,detail="",extra={})=>button("view",label,target,detail,extra);
    const show=(value,mode="push")=>go("sparring",value,mode);
    let pending=null,cached=null,review=null,busy=false,cupScreen=false;
    const builder=window.WilderSparringTeams.create({game,row,image,go,render,notify,openFinder,canEdit:()=>!busy&&!live()&&game.trailSaveIsCurrent?.()!==false,
      read:()=>rec().setup,write:patch=>{
        if(live())return;
        const r=rec();save({...r,setup:builder.restore({...r.setup,...patch})});
      },onStart:()=>show("preview")});
    const rival=s=>builder.rivals.find(r=>r.id===s.rival)||{name:s.rival==="shared"?"Guest crew":"Visiting crew",plan:"The visiting crew uses the same moves, switches and duets as your side."};
    function position(m=rec().match){
      if(!m)return null;
      if(cached?.match!==m||cached.length!==m.moves.length)cached={match:m,length:m.moves.length,pos:replay(sim,m)};
      return cached.pos;
    }
    const live=()=>{const p=position();return p&&p.phase!=="done";};
    const ember=window.WilderEmberPartners?.create({species,sim,row,image,show,live,playFromPractice});
    const scout=window.WilderScoutPractice?.create({game,sim,row,image,show,live,playFromPractice,openFinder,openRentals,notify,readSetup:()=>rec().setup});
    const library=window.WilderSparringLibrary?.create({species,sim,row,image,read:rec,save,show,render,live,playFromPractice});
    const cup=window.WilderCupSeries?.create({game,sim,row,image,show,render,notify,
      read:()=>rec().cup,save:value=>save({...rec(),cup:value}),startFight:m=>{
        playTone?.("battle");show("cup:match","replace");if(m.first===1)void take(null,true);
      }});
    const profile=p=>({species:p.id,name:kin(p.id),src:image(p.id),hp:p.hp,maxHp:p.maxHp,level:sim.rules.level,types:species[p.id].types,gear:held(p)});
    const roster=(ids,prefix,gear)=>ids.map((id,i)=>({label:kin(id),image:image(id),detail:[species[id].types.join(" / "),piece(gear?.[id])?.name,species[id].emberArt?.name].filter(Boolean).join(" · "),badge:i===0?prefix:""}));
    const packFor=s=>s.mode==="cpu"&&Object.hasOwn(kits,s.rival)&&window.WilderSparringGear?kits[s.rival]:null;
    function gearRows(p,m) {
      return p.sides.flatMap((side,i)=>{
        const lead=member(side),item=piece(lead.gear);
        return item?[{label:kin(lead.id)+" · "+item.name,detail:sideName(m,i)+" · "+(lead.spent?"Already used.":item.trigger+" "+item.effect),image:image(lead.id)}]:[];
      });
    }
    function equipment(m,p) {
      const sections=p.sides.map((side,i)=>group(sideName(m,i),side.team.map((k,slot)=>{
        const item=piece(k.gear);
        return {label:kin(k.id)+(item?" · "+item.name:""),detail:item?item.trigger+" "+item.effect:"Empty equipment slot.",
          badge:item?(k.spent?"USED":"READY"):slot===side.active?"LEAD":"",image:image(k.id)};
      })));
      sections.unshift(group("Battle floor",[link(p.phase==="done"?"Return to result":"Return to match",p.phase==="done"?"result":"match")]));
      return {title:"Equipment on the floor",kicker:"SPARRING HALL",sections};
    }
    function lobby(){
      const r=rec(),s=r.setup,ongoing=live(),opponent=rival(s);
      const sections=[];
      const rentals=openRentals?[row("nav","Borrow or challenge a rental team","rental-counter","Choose a four-kin team at the Rental Counter.")]:[];
      if(pending)sections.push(group("A guest crew sent a challenge",[button("invitation","Scout the guest lineup",null,pending.ids.map(kin).join(" · "))]));
      if(ongoing)sections.push(group("On the floor",[link("Resume the match","match",sideName(r.match,position().turn)+" to act · "+position().ply+" actions played",{tone:"primary"})]));
      else {
        sections.push(group("Choose a match",[
          button("mode","Battle a rival crew","cpu",opponent.name+" · tactical opponent",{tone:"primary"}),
          ...rentals,
          button("mode","Pass and play","local","Two players share this device and take turns."),
          row("nav","Battle a friend by link","bellpost","Play on two devices. Each of you chooses your own moves.")]));
        if(r.match)sections.push(group("Last match",[link("Review the result","result")]));
      }
      if(ongoing)sections.push(group("Friend matches",[...rentals,row("nav","Bellpost","bellpost","Play a friend on another device. Your Hall match stays on the floor.")]));
      if(cup)sections.push(group("Tournament desk",[link("Lantern Cup","cup","Register six, bring three, and play a best-of-three series.")]));
      if(ember)sections.push(group("Practice with partners",[link("Ember partners","ember","Bring a wounded reserve back into the fight or challenge the rival’s guard.")]));
      if(scout)sections.push(group("Scout Table",[row("nav","Scout a friend’s roster","scout-table","Bring four kin and lock three after scouting."),link("Practice with a scout","scout-practice","Choose a trio against a coach’s public four.")]));
      const films=[];
      if(r.lastReview)films.push(row("nav","Replay your last rival match","sparring-review","Try a different decision on a recorded turn."));
      if(window.WilderFilmRoom)films.push(row("nav","Enter the Film Room","film-room","Rehearse a shared battle or redraft its opening trio."));
      if(films.length)sections.push(group("Battle films",films));
      if(!ongoing)sections.push(group("Prepare",[
        link("Build your trio","edit:left:team",s.left.map(kin).join(" · ")),
        ...(openFinder?[row("nav","Find a duet partner","partner-finder","Choose a job, compare two partners and test the duet.")]:[]),
        ...(library?[link("Team case","bench","Save your builds and compare them in practice matches.")]:[]),
        link("Scout rival crews","edit:rivals","Eight teams with different battle plans.")]));
      return {title:"Sparring Hall",kicker:"THREE AGAINST THREE",subtitle:"Borrow any three field-guide kin. Both trios fight at level 20.",
        art:{src:"ui/sparring-hall.png",landscape:true},sections};
    }
    function preview(){
      const s=rec().setup,local=s.mode==="local",op=rival(s);
      const left=local?"Player 1":"Your trio",right=local?"Player 2":op.name;
      const sections=[group("Match desk",[
        button("start","Start the match",null,kin(s.left[0])+" opens against "+kin(s.right[0])+".",{tone:"primary"}),
        link("Matchup scout","edit:scout","Compare attack coverage and duet options.")],2),
        group(left,roster(s.left,"LEAD",s.gear?.left),3),group(right,roster(s.right,"LEAD",s.gear?.right),3)];
      if(!local)sections.push({title:op.name,text:op.plan+(op.counter?" "+op.counter:"")});
      const pack=packFor(s);
      if(pack){
        const equipped=Object.entries(pack).every(([id,kit])=>s.gear?.right?.[id]===kit);
        const pieces=Object.entries(pack).map(([id,kit])=>kin(id)+" · "+piece(kit).name).join(". ");
        sections.push(group("Crew equipment",[button("crew-kit",equipped?"Remove crew equipment":"Use crew equipment",equipped?"remove":"equip",
          equipped?"Return the visiting trio’s three pieces to the rack.":pieces+".")]));
      }
      sections.push(group("Lineups",[link("Edit "+(local?"Player 1’s team":"your trio"),"edit:left:team"),
        link(local?"Edit Player 2’s team":"Choose a different crew",local?"edit:right:team":"edit:rivals")],2),
        {title:"Match rules",text:sim.rules.description+" "+sim.rules.tiebreak});
      return {title:"Team preview",kicker:local?"LOCAL TWO-PLAYER MATCH":"SPARRING HALL   /   RIVAL MATCH",
        subtitle:kin(s.left[0])+" and "+kin(s.right[0])+" take the lead. "+(local?"Player 1":s.first===1?op.name:"Your trio")+" opens.",sections};
    }
    function guest(){
      if(!pending)return lobby();
      const ongoing=live();
      return {title:"Guest crew",kicker:"SHARED LINEUP",subtitle:"Play against a friend’s trio, coached by the hall.",
        sections:[group("Visiting team",roster(pending.ids,"LEAD",pending.gear)),group("Match desk",[
          button("accept","Use this guest crew",null,ongoing?"Finish or retire your current match to use this lineup.":"Review both teams before starting.",{disabled:!!ongoing,tone:"primary"}),
          ...(ongoing?[link("Resume current match","match")]:[]),button("dismiss","Put away the invitation")])]};
    }
    const formatTurn=(p)=>"Action "+Math.min(p.ply+1,p.limit)+" / "+p.limit;
    const matchesRow=(m,choice)=>button("move",choice.label,choice.id,choice.reason||choice.detail,
      {image:choice.targetId?image(choice.targetId):undefined,disabled:!choice.available,
        badge:choice.kind==="duet"?choice.cost+" BEATS":undefined});
    const signatureFor=p=>window.WilderSparringSignatures?.byId(member(p.sides[p.turn]).id);
    const signatureUsed=(side,signature)=>window.WilderSparringSignatures?.used?.(side,signature.id)??member(side).signatureSpent;
    function signatureButton(p,options) {
      const signature=signatureFor(p);
      if(!signature)return null;
      const side=p.sides[p.turn],moves=options.filter(o=>o.kind==="signature");
      const available=moves.some(o=>o.available),used=signatureUsed(side,signature);
      const hint=used?(signature.family?"Team pass spent":"Used this match"):!available?(moves[0]?.reason||"No conscious reserve"):
        signature.cost?"1 beat · Choose a reserve":"Read the next hit · Once per match";
      return link(signature.name,"cmd:signature",hint,{key:"4"});
    }
    function signaturePage(m,p) {
      const meta=signatureFor(p);
      if(!meta)return arena(m,p);
      const side=p.sides[p.turn],lead=member(side),spent=signatureUsed(side,meta);
      const rows=sim.options(p).filter(o=>o.kind==="signature").map(o=>{
        const target=side.team.find(k=>k.id===o.targetId);
        const after=o.available?sim.apply(p,o.id):null;
        const hit=after&&sim.options(after).filter(r=>r.kind==="attack"&&r.available).sort((a,b)=>b.damage-a.damage)[0];
        const forecast=hit?hit.label+" would deal "+hit.damage+" damage"+(meta.family?".":hit.consumeMark?" through cover.":" under quarter cover."):
          after?.phase==="done"?"The final bell rings before a reply.":o.reason;
        const beat=hit?.thornResponse?hit.thornResponse.beatsAfter+"/3 beats on contact":o.available?o.beatsAfter+"/3 beats after":"";
        let condition=target?target.hp+"/"+target.maxHp+" HP":"";
        if(after&&meta.id==="slipstream-pass")condition="Heals "+o.healPartner+" HP · "+(target.hp+o.healPartner)+"/"+target.maxHp+" HP on entry";
        if(after&&o.markFoe)condition+=" · Exposes "+kin(member(p.sides[1-p.turn]).id);
        const detail=[condition,forecast,beat].filter(Boolean).join(" · ");
        const label=target?(meta.family?"Pass to ":"Shelter ")+kin(target.id):"Set "+meta.name;
        return button("move",label,o.id,detail,
          {image:target?image(target.id):undefined,disabled:!o.available,tone:o.available?"primary":undefined});
      });
      return {title:meta.name,kicker:kin(lead.id).toUpperCase()+"   /   SIGNATURE",
        subtitle:(meta.family?(spent?"Team pass spent":"1 team pass remaining"):spent?"Use spent":"1 use remaining")+" · "+(meta.cost?meta.cost+" beat required · "+side.beats+" available":"No beat cost"),
        sections:[{title:"On this turn",text:meta.effect+" "+meta.tradeoff},
          group(meta.id==="thorn-read"?"Read the opposing lead":"Choose the incoming kin",
            rows.length?rows:[{label:"No conscious reserve is available."}]),
          {title:"Opponent’s reply",text:meta.counter},group("Battle floor",[link("Return to the match","match")])]};
    }
    function handoff(m,p){
      const next=sideName(m,p.turn),lead=member(p.sides[p.turn]);
      return {title:"Pass to "+next,kicker:formatTurn(p).toUpperCase(),subtitle:p.phase==="replace"?kin(lead.id)+" is down. Choose the next leader for a free replacement.":next+" has the next move.",
        sections:[group("Pass the device",[button("ready","I’m "+next,null,"Open my battle controls.",{tone:"primary"})]),
          ...(p.log.length?[{title:"Last action",text:p.log.at(-1)}]:[])]};
    }
    function arena(m,p){
      if(m.handoff)return handoff(m,p);
      const side=p.sides[p.turn],options=sim.options(p),cpu=m.setup.mode==="cpu"&&p.turn===1;
      const commands=[];
      if(cpu)commands.push(group("Opponent’s move",[button("cpu","Watch the rival’s move",null,"The coach reads the same public battle state.",{tone:"primary"})]));
      else if(p.phase==="replace")commands.push(group("Choose your next leader",options.map(o=>matchesRow(m,o))));
      else {
        const skills=options.filter(o=>["attack","guard","heal"].includes(o.kind)).map((o,i)=>({...matchesRow(m,o),key:String(i+1)}));
        const signature=signatureButton(p,options);
        if(signature)skills.push(signature);
        const art=species[member(side).id].emberArt;
        commands.push(group("Choose a skill",skills,2),
          group("Team commands",[...(art?[link(art.name,"cmd:ember",member(side).emberArtSpent?"Used this match":"Ember technique · once per kin",{key:"E"})]:[]),link("Switch kin","cmd:swap",standing(side)-1+" conscious reserves",{key:"S"}),
            link("Duets","cmd:duet",side.beats+" / 3 beats",{key:"D"}),link("Coach’s read","coach","See a move and a possible reply.",{key:"H"})],art?2:3));
      }
      commands.push(group("Match desk",[link("Equipment","equipment","Inspect both teams’ six slots."),link("Match log","log:0"),
        link(m.cupOpponent?"Concede this game":"Retire from match","retire")],2));
      const a=member(p.sides[0]),b=member(p.sides[1]);
      const strip=(s,i)=>({label:m.setup.mode==="local"?"P"+(i+1):i===0?"You":"Rival",beats:s.beats,active:s.active,
        team:s.team.map(p=>({id:p.id,src:image(p.id),hp:p.hp,maxHp:p.maxHp,gear:held(p)}))});
      const log=p.log.slice(-2);
      if(p.sides[1-p.turn].thornRead)log.push("Fernprickle is reading the next hit. A switch or recovery gives it nothing to counter.");
      return {kind:"battle",title:sideName(m,p.turn)+" to act",kicker:(m.cupOpponent?"LANTERN CUP · GAME "+m.gameNumber:"SPARRING HALL")+"   /   "+formatTurn(p).toUpperCase(),
        background:m.cupOpponent?"ui/lantern-cup.png":"ui/sparring-hall.png",ally:profile(a),foe:profile(b),log,
        lineups:{left:strip(p.sides[0],0),right:strip(p.sides[1],1)},
        subtitle:sideName(m,0)+" "+standing(p.sides[0])+" standing · "+sideName(m,1)+" "+standing(p.sides[1])+" standing",sections:commands};
    }
    function emberPage(m,p){
      const side=p.sides[p.turn],lead=member(side),art=species[lead.id].emberArt;
      if(!art)return arena(m,p);
      const moves=sim.options(p).filter(o=>o.kind==="ember-art");
      return {title:art.name,kicker:kin(lead.id).toUpperCase()+"   /   EMBER TECHNIQUE",subtitle:art.description,
        sections:[group("Choose your move",moves.length?moves.map(o=>({...matchesRow(m,o),detail:window.WilderEmberPartners?.forecastDetail(sim,p,o)||o.reason||o.detail})):[{label:"No conscious reserve",detail:"Banked Warmth needs a conscious reserve to receive its care."}]),
          group("Battle floor",[link("Return to the match","match")])]};
    }
    function optionsPage(m,p,kind){
      const side=p.sides[p.turn],options=sim.options(p).filter(o=>o.kind===kind);
      return {title:kind==="duet"?"Choose a duet":"Switch your leader",kicker:sideName(m,p.turn).toUpperCase()+"   /   "+formatTurn(p).toUpperCase(),
        subtitle:kind==="duet"?side.beats+" / 3 beats · Change between strike, guard, care and switch to build a beat.":"A switch takes your action. The incoming kin faces the reply.",
        sections:[group("Available partners",options.length?options.map(o=>matchesRow(m,o)):[{label:"No conscious reserves"}]),
          group("Battle floor",[link("Return to the match","match")])]};
    }
    function coach(m,p){
      const best=sim.recommend(p),gear=gearRows(p,m);
      return {title:"Coach’s read",kicker:formatTurn(p).toUpperCase(),subtitle:kin(member(p.sides[p.turn]).id)+" faces "+kin(member(p.sides[1-p.turn]).id)+".",
        sections:[{title:best.label,text:best.detail+" "+best.why},group("Your call",[button("move","Use "+best.label,best.id,"",{tone:"primary"}),link("Return to the match","match")]),
          ...(gear.length?[group("Active equipment",gear,2)]:[])]};
    }
    function timeline(m){
      if(review?.match===m&&review.count===m.moves.length)return review.events;
      const events=[];
      replay(sim,m,(before,move,after)=>{
        const side=before.turn,own=before.sides[side],other=before.sides[1-side];
        events.push({before,after,move,side,number:Math.min(before.limit,before.ply+1),actor:member(own).id,foe:member(other).id,
          hit:total(other)-total(after.sides[1-side]),heal:total(after.sides[side])-total(own),
          ko:standing(other)>standing(after.sides[1-side])});
      });
      review={match:m,count:m.moves.length,events};
      return events;
    }
    function result(m,p){
      const title=p.winner==="draw"?"Draw":sideName(m,p.winner)+" won";
      const events=timeline(m),played=events.filter(e=>e.move.kind!=="replace");
      const eligible=played.filter(e=>p.winner==="draw"||e.side===p.winner);
      const score=e=>e.hit+e.heal+(e.ko?30:0);
      const swing=eligible.reduce((best,e)=>!best||score(e)>score(best)?e:best,null);
      const sections=[group("Next match",[
        m.scout?row("scout-pr-restart","Return to Scout Table",null,"Keep your four and scout the next match.",{tone:"primary"}):
          button("rematch","Quick rematch",null,sideName(m,1-m.first)+" opens next.",{tone:"primary"}),
        link("Edit your trio","edit:left:team","Change the lead, a reserve or a duet.")],2)];
      if(window.WilderFilmRoom&&m.setup.mode==="cpu"&&swing){
        const moment=played.filter(e=>e.side===0&&e.number<=swing.number).at(-1)||swing;
        sections[0].rows.splice(1,0,row("hall-open-film","Rehearse action "+moment.number,events.indexOf(moment),
          "Take over before "+kin(moment.actor)+" used "+moment.move.label+", or try a different opening trio."));
      }
      if(swing){
        const facts=[swing.hit?kin(swing.foe)+" lost "+swing.hit+" HP":"",swing.heal?"the team recovered "+swing.heal+" HP":"",swing.ko?kin(swing.foe)+" fell":""].filter(Boolean);
        sections.push({title:"Turning point · action "+swing.number,text:kin(swing.actor)+" used "+swing.move.label+". "+(facts.join(" and ")+(facts.length?".":swing.move.detail))});
        const prior=played.filter(e=>e.side!==swing.side&&e.number<=swing.number).at(-1);
        if(prior){
          const best=sim.recommend(prior.before);
          sections.push({title:"Rematch idea · action "+prior.number,text:kin(prior.actor)+" used "+prior.move.label+". "+
            (best.id!==prior.move.id?"Try "+best.label+". "+best.why:"The coach also favored that move. "+best.why)});
        }else sections.push({title:"Rematch idea",text:"Scout how your lead matches up against "+kin(swing.actor)+" before the next opening."});
      }
      const equipment=p.sides.flatMap((side,i)=>side.team.filter(k=>k.gear).map(k=>{
        const event=events.find(e=>e.move.gearEvents?.some(g=>g.side===i&&g.holderId===k.id&&g.gearId===k.gear));
        const trigger=event?.move.gearEvents.find(g=>g.side===i&&g.holderId===k.id&&g.gearId===k.gear);
        const detail=trigger?"Action "+event.number+" · "+trigger.text:k.spent?"Used at the opening bell.":"Held through the final bell.";
        return {label:kin(k.id)+" · "+piece(k.gear).name,detail:sideName(m,i)+" · "+detail,image:image(k.id)};
      }));
      if(equipment.length)sections.push(group("Equipment report",equipment,2));
      const signatures=events.flatMap((e,index)=>{
        if(e.move.kind!=="signature")return [];
        const reply=events[index+1],read=reply?.move.thornResponse;
        const detail=e.move.signatureId==="beacon-pass"?kin(e.move.targetId)+" took the lead and exposed "+kin(member(e.after.sides[1-e.side]).id)+".":
          e.move.signatureId==="slipstream-pass"?kin(e.move.targetId)+" recovered "+e.move.healPartner+" HP on entry.":
          e.move.targetId?kin(e.move.targetId)+" took the lead under quarter cover. "+e.after.sides[e.side].beats+"/3 beats left.":
          read?kin(read.attackerId)+" became exposed. "+sideName(m,e.side)+" finished the reply with "+read.beatsAfter+"/3 beats.":
          reply?reply.move.label+" ended the read without contact.":"The final bell rang before a reply.";
        return [{label:"Action "+e.number+" · "+e.move.label,detail:sideName(m,e.side)+" · "+detail,image:image(e.actor)}];
      });
      const emberMoves=events.filter(e=>e.move.kind==="ember-art");
      if(emberMoves.length)sections.push(group("Ember techniques",emberMoves.map(e=>({label:"Action "+e.number+" · "+e.move.label,
        detail:sideName(m,e.side)+" · "+e.move.detail,image:image(e.actor)}))));
      if(signatures.length)sections.push(group("Signature plays",signatures));
      sections.push(group("At the bell",p.sides.map((side,i)=>{
        const duets=played.filter(e=>e.side===i&&e.move.kind==="duet").length;
        return {label:sideName(m,i),detail:standing(side)+" standing · "+total(side)+" HP · "+duets+(duets===1?" duet":" duets"),image:image(member(side).id)};
      }),2),
        group("Match desk",[...(m.setup.mode==="cpu"?[row("nav","Replay a decision","sparring-review","Try an alternate move against a coached reply.")]:[]),
          link("Read the action log","log:0"),link("Back to the hall","lobby")],2));
      return {title,kicker:"MATCH RESULT",subtitle:p.ply+" actions played. "+(p.sides.every(s=>standing(s)>0)?"The bell settled the match on standing kin, then remaining health.":"The last opposing kin fell."),sections};
    }
    function log(m,p,page){
      const events=timeline(m).slice().reverse(),pages=Math.max(1,Math.ceil(events.length/8));
      page=Math.max(0,Math.min(pages-1,Number(page)||0));
      const rows=events.slice(page*8,page*8+8).map(e=>({label:(e.move.kind==="replace"?"Replacement":"Action "+e.number)+" · "+e.move.label,
        detail:sideName(m,e.side)+" · "+kin(e.actor)+" · "+e.move.detail+(e.ko?" · "+kin(e.foe)+" fell":""),image:image(e.actor)}));
      return {title:"Action log",kicker:"PAGE "+(page+1)+" / "+pages,sections:[group("Latest first",rows.length?rows:[{label:"The opening move is still to come."}]),
        group("Match desk",[...(page>0?[link("Newer actions","log:"+(page-1))]:[]),
          ...(page<pages-1?[link("Earlier actions","log:"+(page+1))]:[]),link(p.phase==="done"?"Return to result":"Return to match",p.phase==="done"?"result":"match")],2)]};
    }
    function fightPage(m,p,v) {
      if(v.startsWith("log:")&&m)return log(m,p,v.split(":")[1]);
      if(v==="equipment"&&m&&!m.handoff)return equipment(m,p);
      if(m&&p.phase!=="done"){
        if(v==="retire")return {title:"Retire from this match?",kicker:"MATCH DESK",
          sections:[group("Your lineups will stay at the hall",[link("Keep playing","match"),button("retire","Retire the match")])]};
        if(!m.handoff&&(m.setup.mode==="local"||p.turn===0)&&p.phase==="move"){
          if(v==="coach")return coach(m,p);
          if(v==="cmd:signature")return signaturePage(m,p);
          if(v==="cmd:ember")return emberPage(m,p);
          if(v==="cmd:duet"||v==="cmd:swap")return optionsPage(m,p,v.slice(4));
        }
        return arena(m,p);
      }
      return null;
    }
    function model(value){
      const v=String(value||"");
      cupScreen=Boolean(cup&&(v==="cup"||v.startsWith("cup:")));
      if(cupScreen){
        const m=cup.field(),part=v.slice(4);
        if(m&&(/^(match|equipment|coach|cmd:(signature|duet|swap|ember)|log:\d+)$/.test(part)))
          return fightPage(m,position(m),part);
        return cup.model(v);
      }
      const r=rec(),m=r.match,p=position(m);
      if(v==="guest"&&pending)return guest();
      if(scout?.matches(v))return scout.model(v);
      if(ember?.matches(v))return ember.model(v);
      if(library?.workshopRoute(v))return library.model(v);
      if(!v||v==="lobby")return pending&&!v?guest():lobby();
      const field=fightPage(m,p,v);if(field)return field;
      if(v.startsWith("edit:"))return builder.page(v);
      if(library&&(v==="bench"||v.startsWith("bench:")))return library.model(v);
      if(v==="preview")return preview();
      if(m&&p.phase==="done"&&(v==="result"||v==="match"))return result(m,p);
      return lobby();
    }
    function start(setup,first){
      if(live())return false;
      const m={setup:cloneSetup(setup),first,moves:[],handoff:setup.mode==="local"&&first===1};
      save({...rec(),setup:cloneSetup(setup),match:m});playTone?.("battle");show("match","replace");
      if(setup.mode==="cpu"&&first===1)void take(null);
      return true;
    }
    function playFromPractice(raw,moves,expectedActions=2,first=0,card) {
      if(busy||live()||!raw||(raw.mode!==undefined&&raw.mode!=="cpu")||!Array.isArray(moves)||moves.length!==expectedActions||![0,1].includes(first))return false;
      const setup=builder.restore({...raw,mode:"cpu"});
      if(!["left","right"].every(side=>Array.isArray(raw[side])&&raw[side].length===3&&setup[side].every((id,i)=>raw[side][i]===id)))return false;
      if(raw.gear!==undefined&&!window.WilderSparringGear?.validate(raw.gear,setup.left,setup.right))return false;
      const m={setup:cloneSetup(setup),first,moves:moves.slice(),handoff:false};
      if(card!==undefined){
        const scout=window.WilderScoutPractice?.checkCard(card,setup,first,species,sim);
        if(!scout)return false;
        m.scout=scout;
      }
      const p=replay(sim,m);
      if(!p||p.phase==="done"||p.ply!==expectedActions||(p.turn!==0&&moves.length!==0))return false;
      cached={match:m,length:m.moves.length,pos:p};
      save({...rec(),setup:cloneSetup(setup),match:m});playTone?.("battle");show("match","replace");
      if(p.turn===1)void take(null);
      return true;
    }
    function prepareReedbank(id,course){
      if(busy||live()||!["gustlance","galeskip"].includes(id)||!["bell","ferry"].includes(course))return false;
      const bell=course==="bell",crew=builder.rivals.find(r=>r.id===(bell?"red-foundry":"ice-harbor"));
      const setup=builder.restore({left:bell?[id,"kilnclaw","iceribbon"]:[id,"dewfin","pincoil"],
        right:crew.team,rival:crew.id,mode:"cpu",first:1});
      save({...rec(),setup});show("preview");return true;
    }
    function effect(p,move){
      const side=p.turn===0?"ally":"foe",partner=move.targetId;
      const kind=move.id.startsWith("warmth:")?"heal":move.id==="vent:backdraft"?"attack":move.kind==="signature"?(move.targetId?"swap":"heal"):move.kind==="replace"?"swap":move.kind;
      const family=move.kind==="signature"&&window.WilderSparringSignatures.byId(move.signatureId)?.familyKey;
      if(family){
        const target=p.sides[p.turn].team.find(k=>k.id===partner),incomingKin=profile({...target,hp:target.hp+(move.heal||0)});
        return {kind:"swap",side,type:move.type,name:move.label,pass:family,incoming:incomingKin.src,incomingKin};
      }
      return {kind,name:move.label,type:move.type||species[member(p.sides[p.turn]).id].type,side,
        ...(move.kind==="duet"?{partner:image(partner),partnerType:species[partner].type}:{})};
    }
    async function take(command,inCup=false){
      if(busy)return;
      const current=()=>inCup?cup.field():rec().match;
      const here=()=>active()&&cupScreen===inCup;
      const route=(v)=>show(inCup?"cup:"+v:v,"replace");
      const m=current();
      if(!m||m.handoff)return;
      busy=true;
      try {
        let p=position(m);
        if(here())route("match");
        while(p.phase!=="done" && current()===m){
          const cpu=m.setup.mode==="cpu"&&p.turn===1;
          const move=cpu?sim.recommend(p):sim.forecast(p,command);
          if(!move?.available){if(move?.reason)notify(move.reason);break;}
          const after=sim.apply(p,move.id);
          if(!after)break;
          m.moves.push(move.id);m.handoff=m.setup.mode==="local"&&p.turn!==after.turn&&after.phase!=="done";
          cached={match:m,length:m.moves.length,pos:after};
          if(inCup)cup.saveTurn(m,after);
          else {const r=rec();save({...r,match:m,lastReview:m.setup.mode==="cpu"&&after.phase==="done"?tape(m):r.lastReview});}
          playTone?.(move.kind==="heal"||move.kind==="signature"?"care":move.kind==="duet"?"battle":"strike");
          if(here()&&animate)await animate(effect(p,move));
          p=after;
          if(!here()||(p.phase!=="done"&&current()!==m))break;
          route(p.phase==="done"?"result":"match");
          if(p.phase==="done"||m.setup.mode!=="cpu"||p.turn!==1)break;
          command=null;
        }
      }finally{busy=false;if(active())render();}
    }
    function act(id,value){
      if(cupScreen){
        if(busy)return true;
        if(cup.act(id,value))return true;
        const m=cup.field(),p=position(m);
        if(id==="spar-view"){
          const v=String(value);
          show(v==="retire"?"cup:concede":v==="cup"||v.startsWith("cup:")||v==="lobby"?v:"cup:"+v);return true;
        }
        if(id==="spar-move"&&m&&p?.turn===0){void take(value,true);return true;}
        if(id==="spar-cpu"&&m&&p?.turn===1){void take(null,true);return true;}
        return false;
      }
      if(!busy&&ember?.act(id,value))return true;
      if(!busy&&scout?.act(id,value))return true;
      if(!busy&&library?.act(id,value))return true;
      if(typeof id!=="string"||!id.startsWith("spar-"))return false;
      if(busy)return true;
      const r=rec(),m=r.match,p=position(m);
      if(id.startsWith("spar-team-"))return live()?true:builder.act(id,value);
      switch(id){
        case "spar-view":show(value);break;
        case "spar-mode":
          if(!live()&&["cpu","local"].includes(value)){save({...r,setup:{...r.setup,mode:value}});show("preview");}break;
        case "spar-crew-kit":{
          const pack=packFor(r.setup);
          if(!live()&&pack&&["equip","remove"].includes(value)){
            const gear={left:{...r.setup.gear?.left},right:value==="equip"?{...pack}:{}};
            save({...r,setup:builder.restore({...r.setup,gear})});render();
          }
          break;
        }
        case "spar-start":start(r.setup,r.setup.mode==="cpu"&&r.setup.first===1?1:0);break;
        case "spar-rematch":if(m&&p.phase==="done")start(m.setup,1-m.first);break;
        case "spar-ready":if(m?.handoff){m.handoff=false;save({...r,match:m});show("match","replace");}break;
        case "spar-move":
          if(m&&!m.handoff&&p.phase!=="done"&&(m.setup.mode==="local"||p.turn===0))void take(value);break;
        case "spar-cpu":if(m?.setup.mode==="cpu"&&p.turn===1&&p.phase!=="done")void take(null);break;
        case "spar-retire":if(live()){save({...r,match:null});show("lobby","replace");}break;
        case "spar-invitation":show("guest");break;
        case "spar-accept":if(pending&&!live()){
          const gear=r.setup.gear||Object.keys(pending.gear).length?{gear:{left:{...r.setup.gear?.left},right:{...pending.gear}}}:{};
          save({...r,setup:builder.restore({...r.setup,right:pending.ids,rival:"shared",mode:"cpu",...gear})});pending=null;show("preview","replace");
        }break;
        case "spar-dismiss":pending=null;show("lobby","replace");break;
        default:return false;
      }
      return true;
    }
    function key(e,value){
      let v=String(value||"");
      const inCup=Boolean(cup&&(v==="cup"||v.startsWith("cup:")));
      if(inCup){if(cup.key(e,v))return true;v=v.slice(4);}
      if(!inCup&&!live()&&library?.key(e,v))return true;
      if(!inCup&&v.startsWith("edit:")&&!live())return builder.key(e,v);
      if(v!=="match"||e.repeat||busy)return false;
      const m=inCup?cup.field():rec().match,p=position(m);
      if(!m||m.handoff||p.phase!=="move"||(m.setup.mode==="cpu"&&p.turn===1))return false;
      if(/^[1-3]$/.test(e.key)){
        const skill=sim.options(p).filter(o=>["attack","guard","heal"].includes(o.kind))[Number(e.key)-1];
        if(skill?.available)act("spar-move",skill.id);return true;
      }
      const navigate=v=>show(inCup?"cup:"+v:v);
      if(e.key.toLowerCase()==="e"&&species[member(p.sides[p.turn]).id].emberArt){navigate("cmd:ember");return true;}
      if(e.key==="4"&&signatureFor(p)){navigate("cmd:signature");return true;}
      const dest={d:"cmd:duet",s:"cmd:swap",h:"coach"}[e.key.toLowerCase()];
      if(dest){navigate(dest);return true;}return false;
    }
    function loadFragment(hash){
      if(hash==="#sparring"){pending=null;return true;}
      const offered=builder.decodeLoadout(hash);
      if(!offered)return false;
      pending=offered;return true;
    }
    function defaultPartners(){
      const setup=rec().setup,team=setup.left,starter=team.join(",")==="sprigkit,cindlet,dewfin";
      const anchor=starter?"dewfin":team[0],slot=starter?0:1;
      const context=builder.partnerContext("left",slot,{anchor});
      if(starter){
        context.role="mend";
        if(setup.rival==="bell-keepers")context.foe="pincoil";
      }
      return context;
    }
    return {model,act,key,loadFragment,prepareReedbank,reviewRecord:()=>rec().lastReview,defaultPartners,
      borrowRental:card=>scout?.borrowRental(card),challengeRental:card=>scout?.challengeRental(card)};
  }
  window.WilderSparring={create,restore};
})();
