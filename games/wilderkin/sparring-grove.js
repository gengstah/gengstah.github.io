// Two turns at Thornbridge, using the normal Hall battle rules and command tape.
(() => {
  "use strict";
  const root="bench:grove";
  const names=["mossbell","fernprickle"];
  const partner="dewfin",rival=["cindlet","sprigkit","glimmeray"];
  const group=(title,rows,columns=1)=>({title,rows,columns});
  function create({species,sim,row,image,show,live,playFromPractice}) {
    const name=id=>species[id].name;
    const signature=id=>window.WilderSparringSignatures.byId(id);
    const route=(...parts)=>[root,...parts].join(":");
    const link=(label,path,detail="",extra={})=>row("grove-open",label,path,detail,extra);
    const kinCard=(id,detail)=>({label:name(id),image:image(id),detail});
    function setup(id) {
      return {left:[id,partner,"coalmoth"],right:rival.slice(),mode:"cpu",rival:"custom",gear:{left:{[id]:"opening-pennant"},right:{}}};
    }
    const matches=view=>typeof view==="string"&&(view===root||view.startsWith(root+":"));
    function entrance(){
      return {title:"The Thornbridge crossing",kicker:"SPARRING HALL   /   GROVE LESSON",
        art:{src:"ui/thornbridge.png",caption:"Thornbridge · the practice trail",landscape:true},
        subtitle:"Cindlet is holding the bridge. Both Grove kin have 80 HP. Which one would you lead?",
        sections:[group("Choose your lead",names.map(id=>link(name(id),route(id),signature(id).name+" · "+(id==="mossbell"?
          "Bring Dewfin across under cover.":"Keep the lead and invite a strike."),{image:image(id)}))),
          group("Test both leads",[
            row("bench-grove-trial","Face the Bell Keepers","grove-bells","Coalmoth and Arcbill join your lead. Test both against the same three rivals."),
            row("bench-grove-trial","Face the Ice Harbor Pilots","grove-ice","Coalmoth and Glimmeray join your lead. Try both opening orders.")]),
          group("Team builder",[live()?row("spar-view","Resume your match","match"):
            row("spar-view","Compare Grove signatures","edit:left:grove:0","Read the scouting cards and choose one for your own team.")])]};
    }
    function exercise(id,choice,reply) {
      if(!names.includes(id))return null;
      const team=setup(id),start=sim.start(team.left,team.right,0,team.gear);
      const signatureId=id==="mossbell"?"shelter:"+partner:"stance:thorn-read";
      const ordinary=id==="mossbell"?"swap:"+partner:sim.options(start).find(m=>m.kind==="guard").id;
      const command=choice==="signature"?signatureId:choice==="ordinary"?ordinary:null;
      const after=command?sim.apply(start,command):null;
      const answer=reply==="strike"?"skill:ember-pop":reply==="switch"?"swap:sprigkit":null;
      const final=after&&answer?sim.apply(after,answer):null;
      return {team,start,signatureId,ordinary,command,after,answer,final};
    }
    const lead=side=>side.team[side.active];
    function model(view){
      const [, ,id,choice,reply]=view.split(":");
      const e=exercise(id,choice,reply);
      if(!e)return entrance();
      const moss=id==="mossbell",step=e.final?3:e.after?2:1;
      const model={title:step===1?name(id)+" at the crossing":step===2?"Choose Cindlet’s reply":"After the reply",
        kicker:"THORNBRIDGE   /   "+step+" OF 3",sections:[]};
      if(step===1){
        model.subtitle=moss?"Dewfin wants to take the lead against Ember. Choose how Mossbell brings it in.":
          "Fernprickle can strike under cover or set a trap for the next attacker. You’ll choose Cindlet’s reply.";
        const option=(key,cmd)=>{
          const m=sim.forecast(e.start,cmd);
          return link(m.label,route(id,key),m.detail,{tone:key==="signature"?"primary":undefined});
        };
        model.sections.push(group("Your move · 1 opening beat",[option("signature",e.signatureId),option("ordinary",e.ordinary)]),
          group("On the bridge",[kinCard(id,name(id)+" leads · Opening Pennant"),kinCard("cindlet","Rival lead · Ember")],2));
      }else if(step===2){
        const acting=lead(e.after.sides[0]),cover=e.after.sides[0].cover;
        model.subtitle=name(acting.id)+" now leads"+(cover<1?" under "+(cover===.25?"quarter":"half")+" damage cover":"")+". Will Cindlet attack or bring in Sprigkit?";
        model.sections.push(group("Play the rival’s turn",[["strike","skill:ember-pop"],["switch","swap:sprigkit"]].map(([key,cmd])=>{
          const m=sim.forecast(e.after,cmd);
          return link(m.label,route(id,choice,key),m.detail,{image:image(key==="strike"?"cindlet":"sprigkit")});
        })),group("Your first move",[{label:sim.forecast(e.start,e.command).label,detail:sim.forecast(e.start,e.command).detail}]));
      }else{
        const actual=e.final,otherCmd=choice==="signature"?e.ordinary:e.signatureId;
        const alternative=sim.apply(sim.apply(e.start,otherCmd),e.answer);
        const ally=lead(actual.sides[0]),otherAlly=lead(alternative.sides[0]),enemy=lead(actual.sides[1]);
        const difference=ally.hp-otherAlly.hp,opening=sim.forecast(e.start,e.command),response=sim.forecast(e.after,e.answer);
        if(moss){
          model.subtitle=difference>0?"Shelter Call saved "+difference+" HP on this crossing. Dewfin now has the next move.":
            difference<0?"The ordinary switch cost Dewfin "+(-difference)+" more HP than Shelter Call would have.":
            "Cindlet stepped aside. Dewfin crossed at full health either way, and an ordinary switch keeps Shelter Call ready.";
        }else{
          model.subtitle=enemy.exposed?"Cindlet struck into Thorn Read. It is exposed, and Fernprickle earned a beat for reading the attack.":
            choice==="signature"?"Cindlet switched. Thorn Read spent its one use and caught nobody.":"Fernprickle used its regular brace. Thorn Read is still available.";
        }
        const detail=(position,side)=>{
          const s=position.sides[side],kin=lead(s);
          return kin.hp+"/"+kin.maxHp+" HP · "+s.beats+"/3 beats"+(kin.exposed?" · exposed":"");
        };
        model.sections.push(group("On the bridge",[kinCard(ally.id,detail(actual,0)),kinCard(enemy.id,detail(actual,1))],2),
          group("Play the next turn",[live()?row("spar-view","Resume your match","match"):
            row("grove-play","Play on from here",view,"Continue this exact position against the Hall coach.",{tone:"primary"}),
            link("Change the rival’s reply",route(id,choice)),link("Change your opening move",route(id)),link("Try the other Grove kin",route(moss?"fernprickle":"mossbell"))]),
          group("Two moves played",[{label:opening.label,detail:opening.detail},{label:response.label,detail:response.detail}]));
      }
      return model;
    }
    function act(action,value){
      if(action==="grove-open"&&matches(value)){show(value);return true;}
      if(action!=="grove-play")return false;
      if(!live()&&matches(value)){
        const [, ,id,choice,reply]=value.split(":"),e=exercise(id,choice,reply);
        if(e?.final)playFromPractice?.(e.team,[e.command,e.answer]);
      }
      return true;
    }
    return {model,act,matches};
  }
  window.WilderGroveLesson={create};
})();
