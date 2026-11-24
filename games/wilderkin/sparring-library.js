// Save a build, change it, and let the same coaches play both versions against one rival.
(() => {
  "use strict";
  const capacity=4;
  const teamCopy=(team,gear)=>({team:team.slice(),gear:{...gear}});
  const sameKit=(a,b)=>a.team.every((id,i)=>b.team[i]===id&&a.gear[id]===b.gear[id]);
  function restore(raw,{species}) {
    return Array.from({length:capacity},(_,i)=>{
      const slot=Array.isArray(raw)?raw[i]:null;
      if(!Array.isArray(slot?.team)||slot.team.length!==3||new Set(slot.team).size!==3||
        !slot.team.every(id=>typeof id==="string"&&Object.hasOwn(species,id)&&!species[id].bonus))return null;
      const gear=window.WilderSparringGear.normalize({left:slot.gear},slot.team,[]).left;
      const name=typeof slot.name==="string"?slot.name.replace(/[\u0000-\u001f\u007f]/g,"").trim().slice(0,20):"";
      return {...teamCopy(slot.team,gear),name:name||"Team "+(i+1)};
    });
  }
  const sideResult=(p,i)=>p.sides[i].team.filter(k=>k.hp>0).length+" standing · "+p.sides[i].team.reduce((sum,k)=>sum+k.hp,0)+" HP";
  const victor=p=>p.winner==="draw"?"Draw":p.winner===0?"Win":"Loss";
  function create({species,sim,row,image,read,save,show,render,live}) {
    const name=id=>species[id].name;
    const gearName=id=>window.WilderSparringGear.byId(id).name;
    const group=(title,rows,columns=1)=>({title,rows,columns});
    const button=(action,label,value,detail="",extra={})=>row("bench-"+action,label,value,detail,extra);
    const visit=(label,view,detail="",extra={})=>button("open",label,view,detail,extra);
    const held=build=>build.team.flatMap(id=>build.gear[id]?[name(id)+" · "+gearName(build.gear[id])]:[]).join(" / ");
    const copyCurrent=setup=>teamCopy(setup.left,setup.gear?.left);
    const slots=()=>read().slots||Array(capacity).fill(null);
    function setSlot(i,slot) {
      const list=slots().slice();list[i]=slot;save({...read(),slots:list});
    }
    let draft="",trial=null;
    const exercise={
      squad:["sprigkit","cindlet","dewfin"],rival:["coilcrown","slateweaver","cairnwatch"],
      pieces:["opening-pennant","prism-lens","last-stitch"]
    };
    function workshop() {
      return {title:"The Earth Wire wager",kicker:"COACH’S WORKSHOP",art:{src:image("coilcrown"),caption:"Coilcrown · Earth Wire captain"},
        subtitle:"Sprigkit leads the original trio against Earth Wire. Can changing just its equipment turn the matchup around?",
        sections:[group("Choose a piece to test",exercise.pieces.map(id=>{
          const item=window.WilderSparringGear.byId(id);
          return button("experiment",item.name,id,item.effect,{image:"art/gear/"+id+".png"});
        })),group("The wager",[{label:"Same trios, different equipment",detail:"The coaches play two matches with Sprigkit unequipped and two with your choice. Each side opens once."}])]};
    }
    function cards() {
      const current=copyCurrent(read().setup);
      const rows=slots().map((s,i)=>s?visit(s.name,"bench:card:"+i,s.team.map(name).join(" · "),{image:image(s.team[0]),badge:sameKit(current,s)?"CURRENT":""}):
        button("save","Save in slot "+(i+1),String(i),current.team.map(name).join(" · ")));
      return {title:"Team case",kicker:"SPARRING HALL",subtitle:"Keep a trio with its lead and equipment. Compare a saved build with your current team against the same rival.",
        sections:[group("Saved teams",rows),group("At the desk",[row("spar-view","Edit current trio","edit:left:team"),row("spar-view","Choose a rival","edit:rivals"),
          visit("The Earth Wire wager","bench:workshop","Try one piece against a known rival.")],2)]};
    }
    function card(i) {
      const slot=slots()[i];
      if(!slot)return cards();
      const current=copyCurrent(read().setup),equal=sameKit(slot,current);
      return {title:slot.name,kicker:"SAVED TEAM   /   SLOT "+(i+1),sections:[
        group("Battle order",slot.team.map((id,index)=>({label:name(id),detail:slot.gear[id]?gearName(slot.gear[id]):"No gear",image:image(id),badge:index===0?"LEAD":""})),3),
        group("Team desk",[button("compare","Test against current trio",String(i),"Both builds face the same rival, each going first and second.",{disabled:equal,tone:"primary"}),
          button("recall","Use this team",String(i),"Load this build for your next match.",{disabled:equal}),
          button("rival","Spar against this team",String(i),"Keep your trio and seat the saved team opposite."),
          visit("Replace with current trio","bench:replace:"+i,current.team.map(name).join(" · "),{disabled:equal}),
          button("rename","Rename team",String(i)),visit("All saved teams","bench")])]};
    }
    function compare(i) {
      const slot=slots()[i],setup=read().setup,build=copyCurrent(setup);
      if(!slot||sameKit(slot,build)||live())return;
      runTrials(i,slot,build,teamCopy(setup.right,setup.gear?.right));
    }
    function runTrials(index,baseline,variant,opponent) {
      const lineups=[baseline,variant];
      const run={index,slotName:baseline.name,opponent,lineups,games:[],count:0,finished:false};
      trial=run;show("bench:trial:"+index);
      let p=null,notes=[],turns=[],opening=[];
      function play() {
        if(trial!==run)return;
        if(index!=="workshop"&&live()){trial=null;return;}
        const end=performance.now()+8;
        do {
          const which=Math.floor(run.count/2),first=run.count%2;
          if(!p){
            const a=lineups[which];
            p=sim.start(a.team,opponent.team,first,{left:a.gear,right:opponent.gear});
            opening=p.sides.map(s=>s.beats);
            notes=p.sides.flatMap(s=>s.team.filter(kin=>kin.spent).map(kin=>"Opening bell · "+name(kin.id)+" · "+gearName(kin.gear)));
            turns=[];
          }
          const move=sim.recommend(p),next=sim.apply(p,move.id);
          const actor=p.sides[p.turn],foe=p.sides[1-p.turn];
          turns.push({number:p.ply+1,side:p.turn,actor:name(actor.team[actor.active].id),target:name(foe.team[foe.active].id),
            command:move.id,move:move.label,damage:move.damage||0,replacement:move.kind==="replace",detail:move.detail});
          const triggers=[];
          for(let s=0;s<2;s++)for(let j=0;j<3;j++){
            const after=next.sides[s].team[j],before=p.sides[s].team[j];
            if(after.spent&&!before.spent)triggers.push(name(after.id)+" · "+gearName(after.gear));
          }
          if(triggers.length)notes.push("Action "+(p.ply+1)+" · "+triggers.join(" / "));
          p=next;
          if(p.phase==="done"){
            run.games.push({which,first,verdict:victor(p),actions:p.ply,home:sideResult(p,0),away:sideResult(p,1),notes,turns,opening});
            p=null;run.count++;
            if(run.count===4){run.finished=true;render();return;}
          }
        }while(performance.now()<end);
        setTimeout(play,0);
      }
      setTimeout(play,0);
    }
    function results(i) {
      const t=trial;
      const example=i==="workshop";
      if(!t||t.index!==i)return example?workshop():card(i);
      const back=example?visit("Test another piece","bench:workshop"):visit("Back to saved team","bench:card:"+i);
      if(!t.finished)return {title:"Playing the trials",kicker:"TEAM CASE",subtitle:"The coaches are playing four matches against "+name(t.opponent.team[0])+"’s trio.",sections:[group("Team desk",[back])]};
      const sections=t.lineups.map((build,k)=>{
        const matches=t.games.filter(g=>g.which===k);
        return group(k===0?t.slotName:build.name||"Current trio",matches.map(g=>visit(g.verdict+" · "+(g.first===0?"your lead opens":"rival opens"),"bench:game:"+t.games.indexOf(g),
          g.actions+" actions · "+g.home)));
      });
      const [saved,current]=t.lineups,changes=[];
      current.team.forEach((id,slot)=>{
        const old=saved.team.indexOf(id);
        if(old<0)changes.push({label:name(id)+" joined",detail:"Slot "+(slot+1),image:image(id)});
        else if(old!==slot)changes.push({label:name(id)+" moved",detail:"Slot "+(old+1)+" → "+(slot+1),image:image(id)});
        if(saved.gear[id]!==current.gear[id])changes.push({label:name(id)+"’s gear",detail:(saved.gear[id]?gearName(saved.gear[id]):"No gear")+" → "+(current.gear[id]?gearName(current.gear[id]):"No gear"),image:image(id)});
      });
      saved.team.filter(id=>!current.team.includes(id)).forEach(id=>changes.push({label:name(id)+" left the trio",image:image(id)}));
      sections.push(group("What changed",changes));
      if(t.games[0].opening[0]!==t.games[2].opening[0]){
        sections.push(group("Before the first move",[0,2].map(n=>({
          label:n===0?t.slotName:current.name||"Current trio",detail:"Your opening beats · "+t.games[n].opening[0]+"/3"
        }))));
      }
      const describe=t=>(t.side===0?"Your ":"Rival ")+t.actor+" · "+t.move+(t.damage?" against "+t.target+" for "+t.damage+" damage.":".");
      for(const seat of [0,1]){
        const original=t.games[seat].turns,variation=t.games[seat+2].turns;
        const divergence=original.findIndex((turn,n)=>variation[n]&&
          (turn.command!==variation[n].command||turn.move!==variation[n].move||turn.actor!==variation[n].actor||
           (turn.damage>0&&turn.target!==variation[n].target)||turn.damage!==variation[n].damage));
        if(divergence>=0){
          const heading="First different move or damage when "+(seat===0?"you":"the rival")+" opened";
          sections.push(group(heading,[
            {label:t.slotName+" · action "+original[divergence].number,detail:describe(original[divergence])},
            {label:(current.name||"Current trio")+" · action "+variation[divergence].number,detail:describe(variation[divergence])}]));
        }
      }
      sections.push(group("Take the field",example?[live()?row("spar-view","Resume your match","match"):button("adopt","Use workshop teams",null,"Load the tested build and Earth Wire into team preview."),back]:
        [button("recall","Load "+t.slotName,String(i),"Return to team preview with this build."),row("spar-view","Play with current trio","preview"),back]));
      return {title:"Practice results",kicker:"TEAM CASE   /   FOUR COACHED MATCHES",subtitle:"Both coaches used the same battle rules. Opposing trio: "+t.opponent.team.map(name).join(" · ")+".",sections};
    }
    function report(n,pageNumber) {
      const match=trial?.games[n];if(!match)return cards();
      const kit=trial.lineups[match.which],charges=match.notes.map(text=>({label:text}));
      const pages=Math.ceil(match.turns.length/6),page=Math.max(0,Math.min(pages-1,Number(pageNumber)||0));
      const route="bench:game:"+n+":";
      const actions=match.turns.slice(page*6,page*6+6).map(t=>({
        label:(t.replacement?"Replacement before ":"Action ")+t.number+" · "+t.move,
        detail:(t.side===0?"Your ":"Rival ")+t.actor+" · "+t.detail
      }));
      return {title:match.verdict+" in "+match.actions+" actions",kicker:"PRACTICE LOG",subtitle:(match.first===0?"Your team":"The rival")+" opened.",sections:[
        group("At the finish",[{label:kit.team.map(name).join(" · "),detail:match.home},{label:trial.opponent.team.map(name).join(" · "),detail:match.away}]),
        group("Equipment used",charges.length?charges:[{label:"No piece activated",detail:held(kit)||"Your trio carried no gear."}]),
        group("Action log · "+(page+1)+" / "+pages,actions),
        group("Team desk",[...(page>0?[visit("Earlier actions",route+(page-1))]:[]),
          ...(page+1<pages?[visit("Later actions",route+(page+1))]:[]),visit("Compare all four matches","bench:trial:"+trial.index)])]};
    }
    function model(v) {
      const [,screen,n,pageNumber]=String(v).split(":"),i=Number(n);
      if(screen==="workshop")return workshop();
      if(screen==="trial"&&n==="workshop")return results("workshop");
      if(screen==="game")return report(i,pageNumber);
      if(!Number.isInteger(i)||i<0||i>=capacity||!slots()[i])return cards();
      if(screen==="card")return card(i);
      if(screen==="trial")return results(i);
      if(screen==="replace")return {title:"Replace "+slots()[i].name+"?",kicker:"TEAM CASE",subtitle:read().setup.left.map(name).join(" · "),
        sections:[group("Save the current lineup and equipment",[button("replace","Replace saved build",n),visit("Keep saved build","bench:card:"+i)])]};
      if(screen==="name")return {title:"Name your team",kicker:"TEAM CASE",subtitle:draft||"Enter a name",sections:[
        group("Name",[button("letter","Save name",n+"|save","",{disabled:!draft.trim(),tone:"primary"}),button("letter","Delete",n+"|back"),
          button("letter","Space",n+"| "),button("letter","Clear",n+"|clear")],2),
        {grid:{cols:7,cells:[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-"].map(c=>button("letter",c,n+"|"+c))}}]};
      return cards();
    }
    function type(i,token) {
      if(typeof token!=="string")return;
      if(token==="save"){
        if(!draft.trim())return;setSlot(i,{...slots()[i],name:draft.trim()});show("bench:card:"+i,"replace");return;
      }
      if(token==="back")draft=[...draft].slice(0,-1).join("");
      else if(token==="clear")draft="";
      else if([...token].length===1&&draft.length+token.length<=20)draft+=token;
      render();
    }
    function key(e,view) {
      if(!String(view).startsWith("bench:name:")||e.ctrlKey||e.metaKey||e.altKey)return false;
      const i=Number(view.split(":")[2]);if(!slots()[i])return false;
      if(e.key==="Enter"&&typeof document!=="undefined"&&document.activeElement?.tagName==="BUTTON")return false;
      if(e.key==="Enter")type(i,"save");else if(e.key==="Backspace")type(i,"back");else if([...e.key].length===1)type(i,e.key);else return false;
      return true;
    }
    function act(id,value) {
      if(typeof id!=="string"||!id.startsWith("bench-"))return false;
      const action=id.slice(6),str=String(value);
      if(live()&&action!=="experiment"&&!(action==="open"&&workshopRoute(str)))return true;
      if(action==="open"){if(!str.startsWith("bench:trial:")&&!str.startsWith("bench:game:"))trial=null;show(str);return true;}
      if(action==="experiment"&&exercise.pieces.includes(str)){
        runTrials("workshop",{...teamCopy(exercise.squad),name:"Bare lead"},{...teamCopy(exercise.squad,{sprigkit:str}),name:gearName(str)},teamCopy(exercise.rival));
        return true;
      }
      if(action==="adopt"&&trial?.index==="workshop"&&trial.finished){
        const r=read(),build=trial.lineups[1],setup={left:build.team.slice(),right:exercise.rival.slice(),gear:{left:{...build.gear},right:{}},rival:"earth-wire",mode:"cpu"};
        save({...r,setup});show("preview");return true;
      }
      const [n,token]=str.split("|"),i=Number(n);
      if(!Number.isInteger(i)||i<0||i>=capacity)return true;
      const r=read(),slot=slots()[i];
      if(action==="save"&&!slot||action==="replace"&&slot){
        setSlot(i,{...copyCurrent(r.setup),name:slot?.name||"Team "+(i+1)});show("bench:card:"+i);return true;
      }
      if(!slot)return true;
      if(action==="compare")compare(i);
      else if(action==="recall"||action==="rival"){
        const side=action==="recall"?"left":"right";
        const setup={...r.setup,[side]:slot.team.slice(),gear:{...r.setup.gear,[side]:{...slot.gear}}};
        if(side==="right"){setup.mode="cpu";setup.rival="custom";}
        save({...r,setup});show("preview");
      }else if(action==="rename"){draft=slot.name;show("bench:name:"+i);}
      else if(action==="letter")type(i,token);
      return true;
    }
    function workshopRoute(v){
      return v==="bench:workshop"||v==="bench:trial:workshop"||(trial?.index==="workshop"&&v.startsWith("bench:game:"));
    }
    return {model,act,key,workshopRoute};
  }
  window.WilderSparringLibrary={restore,create};
})();
