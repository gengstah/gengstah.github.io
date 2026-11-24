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
    if(raw?.v!==1)return rec;
    const sim=window.WilderSparringBattle.create({species});
    const validKit=s=>s.gear===undefined||Boolean(window.WilderSparringGear?.validate(s.gear,s.left,s.right));
    const stored=raw.lastReview;
    if(stored?.human===0&&[0,1].includes(stored.first)&&Array.isArray(stored.moves)&&stored.moves.length<=66){
      const teams=clean(stored);
      const same=["left","right"].every(side=>Array.isArray(stored[side])&&stored[side].length===3&&teams[side].every((id,i)=>id===stored[side][i]));
      if(same&&validKit(stored)&&replay(sim,{setup:teams,first:stored.first,moves:stored.moves})?.phase==="done")
        rec.lastReview=tape({setup:teams,first:stored.first,moves:stored.moves});
    }
    const m=raw.match;
    if(m&&[0,1].includes(m.first)&&Array.isArray(m.moves)&&m.moves.length<=66){
      const lineups=clean(m.setup);
      if(m.setup&&["cpu","local"].includes(m.setup.mode)&&["left","right"].every(side=>
        Array.isArray(m.setup[side])&&m.setup[side].length===3&&lineups[side].every((id,i)=>m.setup[side][i]===id))&&validKit(m.setup)){
        const match={setup:lineups,first:m.first,moves:m.moves.slice(),handoff:false};
        const pos=replay(sim,match);
        if(pos){
          match.handoff=lineups.mode==="local"&&pos.phase!=="done"&&m.handoff===true;
          rec.match=match;
          if(lineups.mode==="cpu"&&pos.phase==="done")rec.lastReview=tape(match);
        }
      }
    }
    return rec;
  }
  function tape(m){return {left:m.setup.left.slice(),right:m.setup.right.slice(),...gearCopy(m.setup.gear),first:m.first,human:0,moves:m.moves.slice()};}
  function create({game,row,image,go,render,notify,animate,playTone,active=()=>true}) {
    const species=game.species,sim=window.WilderSparringBattle.create({species});
    const rec=()=>game.state.sparring||restore(null,{species});
    const save=r=>game.saveSparring(r);
    const kin=id=>species[id].name;
    const sideName=(m,side)=>m.setup.mode==="local"?"Player "+(side+1):side===0?"Your team":rival(m.setup).name;
    const group=(title,rows,columns=1)=>({title,rows,columns});
    const button=(id,label,value,detail="",extra={})=>row("spar-"+id,label,value,detail,extra);
    const link=(label,target,detail="",extra={})=>button("view",label,target,detail,extra);
    const show=(value,mode="push")=>go("sparring",value,mode);
    let pending=null,cached=null,review=null,busy=false;
    const builder=window.WilderSparringTeams.create({game,row,image,go,render,notify,
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
    const library=window.WilderSparringLibrary?.create({species,sim,row,image,read:rec,save,show,render,live});
    const profile=p=>({species:p.id,name:kin(p.id),src:image(p.id),hp:p.hp,maxHp:p.maxHp,level:sim.rules.level,types:species[p.id].types,gear:held(p)});
    const roster=(ids,prefix,gear)=>ids.map((id,i)=>({label:kin(id),image:image(id),detail:[species[id].types.join(" / "),piece(gear?.[id])?.name].filter(Boolean).join(" · "),badge:i===0?prefix:""}));
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
      if(pending)sections.push(group("A guest crew sent a challenge",[button("invitation","Scout the guest lineup",null,pending.ids.map(kin).join(" · "))]));
      if(ongoing)sections.push(group("On the floor",[link("Resume the match","match",sideName(r.match,position().turn)+" to act · "+position().ply+" actions played",{tone:"primary"})]));
      else {
        sections.push(group("Choose a match",[
          button("mode","Battle a rival crew","cpu",opponent.name+" · tactical opponent",{tone:"primary"}),
          button("mode","Pass and play","local","Two players share this device and take turns.")]));
        if(r.match)sections.push(group("Last match",[link("Review the result","result")]));
      }
      if(r.lastReview)sections.push(group("Practice film",[row("nav","Replay your last rival match","sparring-review","Try a different decision on a recorded turn.")]));
      if(!ongoing)sections.push(group("Prepare",[
        link("Build your trio","edit:left:team",s.left.map(kin).join(" · ")),
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
        subtitle:kin(s.left[0])+" and "+kin(s.right[0])+" take the lead. "+(local?"Player 1":"Your trio")+" opens.",sections};
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
        const skills=options.filter(o=>["attack","guard","heal"].includes(o.kind));
        commands.push(group("Choose a skill",skills.map((o,i)=>({...matchesRow(m,o),key:String(i+1)})),2),
          group("Team commands",[link("Switch kin","cmd:swap",standing(side)-1+" conscious reserves",{key:"S"}),
            link("Duets","cmd:duet",side.beats+" / 3 beats",{key:"D"}),link("Coach’s read","coach","See a move and a possible reply.",{key:"H"})],3));
      }
      commands.push(group("Match desk",[link("Equipment","equipment","Inspect both teams’ six slots."),link("Match log","log:0"),link("Retire from match","retire")],2));
      const a=member(p.sides[0]),b=member(p.sides[1]);
      const strip=(s,i)=>({label:m.setup.mode==="local"?"P"+(i+1):i===0?"You":"Rival",beats:s.beats,active:s.active,
        team:s.team.map(p=>({id:p.id,src:image(p.id),hp:p.hp,maxHp:p.maxHp,gear:held(p)}))});
      return {kind:"battle",title:sideName(m,p.turn)+" to act",kicker:"SPARRING HALL   /   "+formatTurn(p).toUpperCase(),
        background:"ui/sparring-hall.png",ally:profile(a),foe:profile(b),log:p.log.slice(-2),
        lineups:{left:strip(p.sides[0],0),right:strip(p.sides[1],1)},
        subtitle:sideName(m,0)+" "+standing(p.sides[0])+" standing · "+sideName(m,1)+" "+standing(p.sides[1])+" standing",sections:commands};
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
        button("rematch","Quick rematch",null,sideName(m,1-m.first)+" opens next.",{tone:"primary"}),
        link("Edit your trio","edit:left:team","Change the lead, a reserve or a duet.")],2)];
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
    function model(value){
      const r=rec(),m=r.match,p=position(m),v=String(value||"");
      if(v==="guest"&&pending)return guest();
      if(library?.workshopRoute(v))return library.model(v);
      if(!v||v==="lobby")return pending&&!v?guest():lobby();
      if(v.startsWith("log:")&&m)return log(m,p,v.split(":")[1]);
      if(v==="equipment"&&m&&!m.handoff)return equipment(m,p);
      if(m&&p.phase!=="done"){
        if(v==="retire")return {title:"Retire from this match?",kicker:"MATCH DESK",
          sections:[group("Your lineups will stay at the hall",[link("Keep playing","match"),button("retire","Retire the match")])]};
        if(!m.handoff&&(m.setup.mode==="local"||p.turn===0)&&p.phase==="move"){
          if(v==="coach")return coach(m,p);
          if(v==="cmd:duet"||v==="cmd:swap")return optionsPage(m,p,v.slice(4));
        }
        return arena(m,p);
      }
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
    function effect(p,move){
      const side=p.turn===0?"ally":"foe",partner=move.targetId;
      return {kind:move.kind==="replace"?"swap":move.kind,name:move.label,type:move.type||species[member(p.sides[p.turn]).id].type,side,
        ...(move.kind==="duet"?{partner:image(partner),partnerType:species[partner].type}:{})};
    }
    async function take(command){
      if(busy)return;
      const m=rec().match;
      if(!m||m.handoff)return;
      busy=true;
      try {
        let p=position(m);
        if(active())show("match","replace");
        while(p.phase!=="done" && rec().match===m){
          const cpu=m.setup.mode==="cpu"&&p.turn===1;
          const move=cpu?sim.recommend(p):sim.forecast(p,command);
          if(!move?.available){if(move?.reason)notify(move.reason);break;}
          const after=sim.apply(p,move.id);
          if(!after)break;
          m.moves.push(move.id);m.handoff=m.setup.mode==="local"&&p.turn!==after.turn&&after.phase!=="done";
          cached={match:m,length:m.moves.length,pos:after};
          const r=rec();save({...r,match:m,lastReview:m.setup.mode==="cpu"&&after.phase==="done"?tape(m):r.lastReview});
          playTone?.(move.kind==="heal"?"care":move.kind==="duet"?"battle":"strike");
          if(active()&&animate)await animate(effect(p,move));
          p=after;
          if(!active()||rec().match!==m)break;
          show(p.phase==="done"?"result":"match","replace");
          if(p.phase==="done"||m.setup.mode!=="cpu"||p.turn!==1)break;
          command=null;
        }
      }finally{busy=false;if(active())render();}
    }
    function act(id,value){
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
        case "spar-start":start(r.setup,0);break;
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
      const v=String(value||"");
      if(!live()&&library?.key(e,v))return true;
      if(v.startsWith("edit:")&&!live())return builder.key(e,v);
      if(v!=="match"||e.repeat||busy)return false;
      const m=rec().match,p=position(m);
      if(!m||m.handoff||p.phase!=="move"||(m.setup.mode==="cpu"&&p.turn===1))return false;
      if(/^[1-3]$/.test(e.key)){
        const skill=sim.options(p).filter(o=>["attack","guard","heal"].includes(o.kind))[Number(e.key)-1];
        if(skill?.available)act("spar-move",skill.id);return true;
      }
      const dest={d:"cmd:duet",s:"cmd:swap",h:"coach"}[e.key.toLowerCase()];
      if(dest){show(dest);return true;}return false;
    }
    function loadFragment(hash){
      if(hash==="#sparring"){pending=null;return true;}
      const offered=builder.decodeLoadout(hash);
      if(!offered)return false;
      pending=offered;return true;
    }
    return {model,act,key,loadFragment,reviewRecord:()=>rec().lastReview};
  }
  window.WilderSparring={create,restore};
})();
