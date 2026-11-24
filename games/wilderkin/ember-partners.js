// Both training choices begin after four legal Hall commands. The player can replay or continue that exact match.
(() => {
  "use strict";
  const route="ember",crest="charquill",vent="kilnbeak",partner="dewfin",foe="mossbell";
  const setup={left:[partner,crest,vent],right:[foe,"cindlet","glimmeray"],mode:"cpu",rival:"custom"};
  const group=(title,rows,columns=1)=>({title,rows,columns});
  function forecastDetail(sim,pos,move){
    if(!move.available)return move.reason;
    const after=sim.apply(pos,move.id);
    const reply=sim.options(after).filter(o=>o.available&&o.kind==="attack").sort((a,b)=>b.damage-a.damage)[0];
    return move.detail+(reply?" "+reply.label+" could reply for "+reply.damage+" damage.":"");
  }
  function create({species,sim,row,image,show,live,playFromPractice}){
    const name=id=>species[id].name,art=id=>species[id].emberArt;
    const matches=v=>v===route||v.startsWith(route+":");
    const link=(label,value,detail="",extra={})=>row("ember-open",label,value,detail,extra);
    const find=id=>row("open-kin","Find "+name(id)+" in "+(id===crest?"Mossbrook Vale":"Cinderfall Ridge"),id,"Open its field guide and habitat directions.",{image:image(id)});
    const lead=s=>s.team[s.active];
    const profile=k=>({name:name(k.id),species:k.id,src:image(k.id),types:species[k.id].types,hp:k.hp,maxHp:k.maxHp,level:k.level});
    const strip=(s,label)=>({label,beats:s.beats,active:s.active,team:s.team.map(k=>({id:k.id,...profile(k)}))});
    function floor(pos){
      const [a,b]=pos.sides;
      return {kind:"battle",background:"ui/sparring-hall.png",ally:profile(lead(a)),foe:profile(lead(b)),
        lineups:{left:strip(a,"Your trio"),right:strip(b,"Rival")}};
    }
    function entrance(){
      return {title:"Ember partners",kicker:"SPARRING HALL   /   LEVEL 20",art:{src:"ui/ember-partners.png",landscape:true,caption:"Ember partners"},
        subtitle:"Dewfin took a hit from Mossbell and needs to leave the front. Which heron will you send in?",
        sections:[group("Choose Dewfin’s partner",[crest,vent].map(id=>link(name(id)+" · "+art(id).name,route+":"+id,art(id).description,
          {image:image(id),tone:id===crest?"primary":undefined}))),group("Practice ring",[link("Back to the Hall","lobby")]),group("Meet them on the trail",[find(crest),find(vent)])]};
    }
    function opening(id){
      const hit=species[foe].skills.find(s=>s.kind==="attack").id,brace=species[foe].skills.find(s=>s.kind==="guard").id;
      const leadHit=species[partner].skills.find(s=>s.kind==="attack").id;
      const moves=["skill:"+leadHit,"skill:"+hit,"swap:"+id,"skill:"+brace];
      let p=sim.start(setup.left,setup.right,0);
      for(const cmd of moves)p=sim.apply(p,cmd);
      return {pos:p,moves,reply:"skill:"+hit};
    }
    function scenario(id){
      const {pos,moves,reply}=opening(id),opts=sim.options(pos);
      const technique=id===crest?"warmth:"+partner:"vent:backdraft";
      const ordinary=opts.find(o=>o.kind==="guard");
      return {pos,moves,reply,choices:{art:sim.forecast(pos,technique),brace:ordinary}};
    }
    function exchange(e,key){
      const choice=e.choices[key],after=sim.apply(e.pos,choice.id),response=sim.forecast(after,e.reply);
      return {choice,response,pos:sim.apply(after,response.id),moves:[...e.moves,choice.id,response.id]};
    }
    function model(v){
      const [,id,choice]=v.split(":");
      if(![crest,vent].includes(id))return entrance();
      const e=scenario(id),start=e.pos,wounded=start.sides[0].team[0],here=route+":"+id;
      if(!Object.hasOwn(e.choices,choice))return {...floor(start),title:name(id)+" takes the front",kicker:"EMBER PARTNERS   /   YOUR MOVE",
        subtitle:name(partner)+" waits at "+wounded.hp+"/"+wounded.maxHp+" HP. "+name(foe)+" is braced and will answer with "+species[foe].skills.find(s=>s.kind==="attack").name+".",
        sections:[group("Play one move",Object.entries(e.choices).map(([key,o])=>link(o.label,here+":"+key,o.reason||o.detail,
          {disabled:!o.available,tone:key==="art"?"primary":undefined}))),group("Practice ring",[link("Change herons",route)])]};
      const actual=exchange(e,choice),other=exchange(e,choice==="art"?"brace":"art");
      const actor=lead(actual.pos.sides[0]),rival=lead(actual.pos.sides[1]),reserve=actual.pos.sides[0].team[0];
      const hp=k=>k.hp+"/"+k.maxHp+" HP";
      const compare=(label,mine,theirs)=>({label,detail:name(mine.id)+" · "+hp(mine)+" here · "+hp(theirs)+" with "+other.choice.label,image:image(mine.id)});
      return {...floor(actual.pos),title:"After Mossbell’s reply",kicker:"EMBER PARTNERS   /   NEXT TURN",
        log:[name(id)+" · "+actual.choice.label,name(foe)+" · "+actual.response.label+" · "+actual.response.damage+" damage"],
        subtitle:choice==="art"?actual.choice.detail+" "+name(id)+" has spent its use.":actual.choice.detail+" "+art(id).name+" is still ready.",
        sections:[group("Compare the same reply",[
          compare("Wounded reserve",reserve,other.pos.sides[0].team[0]),compare("Your lead",actor,lead(other.pos.sides[0])),
          compare("Rival lead",rival,lead(other.pos.sides[1]))]),
          group("Your next decision",[live()?row("spar-view","Resume your Hall match","match"):
            row("ember-play","Finish this fight",v,"Take the next turn with these exact teams and HP.",{tone:"primary"}),
            link("Try "+other.choice.label,here+":"+(choice==="art"?"brace":"art")),link("Try "+name(id===crest?vent:crest),route+":"+(id===crest?vent:crest)),
            link("Back to the Hall","lobby")]),group("On the trail",[find(id)])]};
    }
    function act(action,value){
      if(action==="ember-open"){
        if(typeof value==="string"&&(matches(value)||value==="lobby"))show(value);
        return true;
      }
      if(action!=="ember-play")return false;
      const [section,id,choice]=String(value).split(":");
      if(section===route&&[crest,vent].includes(id)&&["art","brace"].includes(choice)&&!live()){
        const result=exchange(scenario(id),choice);playFromPractice(setup,result.moves,result.moves.length);
      }
      return true;
    }
    return {matches,model,act};
  }
  window.WilderEmberPartners={create,forecastDetail};
})();
