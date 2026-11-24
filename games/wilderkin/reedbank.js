// Brookside Mill lends the same partner and opponent for each attempt at a crossing.
(() => {
  "use strict";
  const scouts=["gustlance","galeskip"];
  const drills={
    bell:{name:"Beat the mill bell",foe:"mossbell",brief:"Cindlet must clear a braced Mossbell on its first strike. Mossbell has 30 HP left."},
    ferry:{name:"Bring the runner ashore",foe:"dewfin",brief:"Cindlet has 12 HP left. Get it onto the ferry and keep it standing through Dewfin’s charged Bubble Jet."}
  };
  const art={src:"art/story/reedbank-mill.png",landscape:true};
  function create({game,row,image,go,render,notify,playTone,animate,active=()=>true}) {
    let attempt=null,busy=false;
    const kin=id=>game.species[id];
    const other=id=>scouts.find(s=>s!==id);
    const group=(title,rows)=>({title,rows});
    const nav=(name,label,detail)=>row("nav",label,name,detail);
    const select=(course,id,label,detail)=>row("reedbank-start",label,course+"|"+id,detail,{image:image(id)});
    const cleared=(course,id)=>game.state.relayClears?.includes(course+"|"+id);
    function desk() {
      const stamps=Object.keys(drills).filter(course=>scouts.some(id=>cleared(course,id))).length;
      return {viewId:"reedbank:desk",title:"Reedbank Relay",kicker:"BROOKSIDE MILL   /   MOSSBROOK VALE",art,
        subtitle:"Finch has two practice runs before the ferry leaves. Borrow a scout and get Cindlet across.",
        sections:[group("Choose a crossing · "+stamps+" / 2 cleared",Object.entries(drills).map(([course,d])=>
          row("view",d.name,"reedbank|"+course,d.brief,{badge:scouts.some(id=>cleared(course,id))?"CLEARED":""}))),
          group("Take a scout on the trail",scouts.map(id=>row("open-kin",kin(id).name,id,game.regions[game.homes[id][0]].name,{image:image(id)})))]};
    }
    function choose(course) {
      return {viewId:"reedbank:choose:"+course,title:drills[course].name,kicker:"REEDBANK RELAY   /   CHOOSE YOUR SCOUT",
        subtitle:drills[course].brief,sections:[group("Who hands off to Cindlet?",scouts.map(id=>{
          const t=window.WilderFamilyTechniques.forKin(id);
          return select(course,id,kin(id).name+" · "+t.name,t.summary+(cleared(course,id)?" Cleared this crossing.":""));
        })),{text:"Both scouts have the same Vane affinity, health and strike power. You have one beat to spend."}]};
    }
    function start(course,id) {
      if(!Object.hasOwn(drills,course)||!scouts.includes(id))return;
      const team=[id,"cindlet"],field={region:0,team,lead:id,party:team.map(s=>game.loaner(s,20)),battle:null};
      game.withLoaners(field,begin=>{
        begin([drills[course].foe],20,"The ferry draws level with the mill.");
        const battle=game.state.battle;
        battle.turn=3;
        if(course==="bell")battle.enemy.hp=30;
        else field.party[1].hp=12;
      });
      attempt={course,id,field,outcome:null,lastMessage:""};playTone?.("battle");go("reedbank","crossing");
    }
    function profile(p) {
      const k=kin(p.id);
      return {species:p.id,name:k.name,src:image(p.id),hp:p.hp,maxHp:p.maxHp,level:p.level,types:k.types};
    }
    function crossing(a) {
      return game.withLoaners(a.field,()=>{
        const b=game.state.battle,lead=game.team().find(p=>p.id===b.activeId),pass=game.familyTechnique();
        const intent=game.foeIntent();
        let choices;
        if(pass){
          const target=pass.targets[0];
          const effect=pass.id==="beacon"?"Mark "+kin(b.enemy.id).name+" for Cindlet’s attack.":"Restore "+target.heal+" HP before the reply.";
          choices=group("Hand the lead to Cindlet",[
            row("reedbank-play",pass.name,"pass",effect+" Cindlet will finish at "+target.hpAfter+" / "+target.maxHp+" HP.",{tone:"primary"}),
            row("reedbank-play","Ordinary switch","swap","Spend this turn switching. Cindlet takes half damage on entry.")]);
        }else{
          choices=group("Cindlet has one strike before the bell",kin(lead.id).skills.filter(s=>s.kind!=="heal").map(s=>
            row("reedbank-play",s.name,s.id,s.description)));
        }
        return {viewId:"reedbank:turn:"+b.turn,kind:"battle",theme:game.regions[0].theme,title:drills[a.course].name,kicker:"BROOKSIDE MILL   /   "+(pass?"HANDOFF":"FINAL STRIKE"),
          subtitle:pass?drills[a.course].brief:(b.enemy.beaconMarked?"The beacon mark is showing through Mossbell’s guard.":"Mossbell braces as the bell starts to swing."),
          ally:profile(lead),foe:profile(b.enemy),log:pass?[kin(b.enemy.id).name+" is winding up "+intent.skill.name+"."]:b.log.slice(-2),sections:[choices]};
      });
    }
    function result(a) {
      const {course,id}=a,peer=other(id);
      const success=course==="bell"?"The bell rings over an open crossing.":"Cindlet steps onto the ferry.";
      const miss=course==="bell"?"The bell rings before the crossing clears.":"The ferry crew brings Cindlet back to the bank.";
      const rival=course==="bell"?"Red Foundry":"Ice Harbor Pilots";
      return {viewId:"reedbank:result",title:a.outcome==="clear"?"Crossing cleared":"Back at the mill",kicker:drills[course].name,art,
        subtitle:a.outcome==="clear"?success:miss,
        sections:[{title:kin(id).name+" and Cindlet",text:a.lastMessage},
          group("Run the crossing again",[select(course,peer,"Try "+kin(peer).name,"Replay the same position with "+window.WilderFamilyTechniques.forKin(peer).name+"."),
            select(course,id,"Try "+kin(id).name+" again","Keep the same scout and opening position."),
            row("view","Try the other crossing","reedbank|"+(course==="bell"?"ferry":"bell"),drills[course==="bell"?"ferry":"bell"].name)]),
          group("Beyond the mill",[row("reedbank-hall","Battle "+rival,course+"|"+id,"Set your Hall draft to "+kin(id).name+"’s loaner trio and take the second turn."),
            row("open-kin","Find a wild "+kin(id).name,id,game.regions[game.homes[id][0]].name),nav("reedbank","Return to Brookside Mill")])]};
    }
    async function play(action) {
      if(busy||!attempt||attempt.outcome)return;
      const a=attempt,b=a.field.battle,handingOff=b?.activeId===a.id;
      if(!b || (handingOff?!["pass","swap"].includes(action):!kin("cindlet").skills.some(s=>s.kind!=="heal"&&s.id===action)))return;
      busy=true;
      try {
        const {turn,fx,reply}=game.withLoaners(a.field,()=>{
          const intent=game.foeIntent(),move=handingOff?null:kin("cindlet").skills.find(s=>s.id===action);
          const pass=action==="pass"?game.familyTechnique():null;
          const name=move?.name||pass?.name||"Switch to Cindlet";
          const fx={side:"ally",kind:move?.kind||"swap",name,type:move?.type||kin(a.id).type};
          if(pass){
            const target=a.field.party[1],incomingKin=profile({...target,hp:target.hp+pass.targets[0].heal});
            Object.assign(fx,{pass:pass.id,incoming:incomingKin.src,incomingKin});
          }
          const turn=handingOff?(action==="pass"?game.useFamilyTechnique("cindlet"):game.swap("cindlet")):game.useSkill(action);
          return {turn,fx,reply:intent.skill};
        });
        if(!turn.ok){notify(turn.message);return;}
        a.lastMessage=turn.message;
        if(a.course==="ferry"||!handingOff){
          const hp=a.field.party[1].hp,cleared=a.course==="bell"?turn.kind==="victory":hp>0;
          a.outcome=cleared?"clear":"miss";
          if(a.course==="bell")a.lastMessage+=" Mossbell has "+b.enemy.hp+" HP left.";
          else a.lastMessage+=" Cindlet has "+hp+" HP left.";
          if(cleared)game.recordRelay(a.course,a.id);
        }
        if(active())await animate?.(fx);
        if(active())await animate?.(turn.kind==="victory"?{kind:"defeat",side:"foe",name:kin(b.enemy.id).name}:
          {kind:"attack",side:"foe",name:reply.name,type:reply.type});
      }finally{busy=false;if(active())render();}
    }
    function model(value) {
      if(Object.hasOwn(drills,value))return choose(value);
      if(value==="crossing"&&attempt)return attempt.outcome?result(attempt):crossing(attempt);
      return desk();
    }
    function act(id,value) {
      if(id==="reedbank-start"&&!busy)start(...String(value).split("|"));
      else if(id==="reedbank-play")void play(value);
      else return false;
      return true;
    }
    return {model,act};
  }
  window.WilderReedbank={create};
})();
