// One opening round against a pair chosen from the captain's public six.
(() => {
  "use strict";
  function create({game,library,series,row,image,go,notify,active}){
    const route="signal-box",sim=window.WilderTwinBattle.create({game});
    const name=id=>game.species[id].name;
    const group=(title,rows,columns=1)=>({title,rows,columns});
    const button=(id,label,value,detail="",extra={})=>row("signal-"+id,label,value,detail,extra);
    const show=(view=null,mode="push")=>go(route,view,mode);
    const back=()=>go("switchyard","pick");
    let ticket="",leads=[],bout=null,previous=null;
    function prepare(){
      const d=series.desk(), valid=d.phase==="pick"&&d.picks.length===4;
      const next=valid?JSON.stringify([d.id,d.roster,d.captain,d.games.length,d.picks]):"";
      if(next!==ticket){
        ticket=next;bout=null;previous=null;
        leads=valid?(d.games.at(-1)?.right?.ids||d.captain.ids).slice(0,2):[];
      }
      return valid?d:null;
    }
    function fieldFour(card,ids,name){
      return {name,ids,gear:Object.fromEntries(ids.filter(id=>card.gear[id]).map(id=>[id,card.gear[id]]))};
    }
    function start(d){
      const ids=[...leads,...d.captain.ids.filter(id=>!leads.includes(id))].slice(0,4);
      if(leads.length!==2||!leads.every(id=>d.captain.ids.includes(id)))return;
      const practice=window.WilderTwinMatch.create({game,library,sim,storage:null});
      if(!practice.choose(fieldFour(d.roster,d.picks,"Your practice four")).ok||!practice.choose(fieldFour(d.captain,ids,"Sela’s practice four"),true).ok||!practice.start().ok)return;
      bout=practice;show("ring","replace");
    }
    function commit(...args){
      if(!prepare()||!bout||bout.read().history.length)return {ok:false,message:"Choose an opening pair at the Signal Box."};
      return bout.commit(...args);
    }
    function ringGo(_,view,mode){
      if(view==="ring"&&bout?.read().history.length)view="report";
      show(view,mode);
    }
    const ring=window.WilderTwinRing.create({game,row,image,notify,go:ringGo,active,read:()=>prepare()&&bout?.read(),commit,
      onSetup:()=>show(null),venue:{name:"Signal Box",route,background:"ui/switchyard.png",deskLabel:"Choose practice opponents",deskDetail:"Rehearse another opening.",rules:false,nextLabel:"See the practice result"}});
    function table(d,lane){
      if(lane===0||lane===1){
        return {title:"Choose "+(lane?"East":"West")+" rival",kicker:"SIGNAL BOX  /  POSSIBLE LEADS",sections:[
          group("Sela’s public six",d.captain.ids.map(id=>button("foe",name(id),lane+"|"+id,
            game.species[id].types.join(" / "),{image:image(id),badge:leads[lane]===id?"Selected":leads[1-lane]===id?"Swap lanes":""})),2)]};
      }
      const possible=[...leads,...d.captain.ids.filter(id=>!leads.includes(id))].slice(0,4);
      return {title:"Signal Box",kicker:"SWITCHYARD  /  OPENING PRACTICE",subtitle:"Choose a possible rival pair and play one round. Sela’s Cup selection stays sealed.",sections:[
        group("Your leads",d.picks.slice(0,2).map((id,i)=>({label:name(id),badge:i?"East":"West",image:image(id)})),2),
        group("Your prediction",leads.map((id,i)=>button("lane",name(id),i,"Choose another rival.",{badge:i?"East":"West",image:image(id)})),2),
        group("First bell",[button("start","Play this opening",null,"Practice against "+name(leads[0])+" and "+name(leads[1])+".",{tone:"primary",key:"1"}),
          {label:"Practice reserves",detail:possible.slice(2).map(name).join(" and ")},button("return","Return to team selection")])]};
    }
    function report(){
      const r=bout.read(),sides=r.pos.sides;
      function damageRows(side){
        return sides[side].team.filter(k=>r[side?"right":"left"].ids.slice(0,2).includes(k.id)||k.hp!==k.maxHp).map(k=>{
          const then=previous?.[side]?.[k.id],diff=k.hp-then;
          const delta=Number.isFinite(then)?(diff===0?" · same as last try":" · "+(diff>0?"+":"")+diff+" HP vs last try"):"";
          return {label:name(k.id),detail:k.maxHp+" → "+k.hp+" HP"+delta,image:image(k.id)};
        });
      }
      return {title:"Opening result",kicker:"SIGNAL BOX  /  ONE ROUND",subtitle:"This trial used your predicted pair. Your four are still at the Cup desk.",sections:[
        group("After the bell",[button("retry","Retry the same opening",null,"Choose new orders and compare HP.",{tone:"primary",key:"1"}),
          button("return","Return to team selection",null,"Change your four or lock them for the Cup.",{key:"2"}),button("rivals","Try other rival leads"),row("twin-log","Read the round",1)],2),
        group("Your kin",damageRows(0),2),group("Practice rivals",damageRows(1),2)]};
    }
    function model(view){
      const d=prepare();
      if(!d)return {title:"Signal Box",sections:[group("Practice opening",[button("return","Open the Cup desk",null,"Pick four from your registered six to rehearse.")])]};
      if(view==="west"||view==="east")return table(d,view==="west"?0:1);
      if(!view||!bout)return table(d);
      if(view==="report"||view==="ring"&&bout.read().history.length)return bout.read().history.length?report():ring.model("ring");
      return ring.model(view);
    }
    function act(id,value,view){
      if(id==="signal-return"){back();return true;}
      const d=prepare();if(!d)return false;
      if(id==="signal-lane"){if(value===0||value===1)show(value===0?"west":"east");return true;}
      if(id==="signal-foe"){
        const [target,kin]=String(value).split("|"),i=Number(target);
        if((i===0||i===1)&&d.captain.ids.includes(kin)){
          if(kin!==leads[i]){if(leads[1-i]===kin)leads[1-i]=leads[i];leads[i]=kin;previous=null;bout=null;}
          show(null,"replace");
        }
        return true;
      }
      if(id==="signal-start"){previous=null;start(d);return true;}
      if(id==="signal-rivals"){previous=null;show(null);return true;}
      if(id==="signal-retry"&&bout){
        previous=bout.read().pos.sides.map(s=>Object.fromEntries(s.team.map(k=>[k.id,k.hp])));
        start(d);return true;
      }
      return !!bout&&ring.act(id,value,view);
    }
    function key(e,v){
      if(e.repeat||!prepare())return false;
      if(!v||v==="report"){if(e.key==="1")return act(v?"signal-retry":"signal-start",null,v);if(v&&e.key==="2")return act("signal-return",null,v);return false;}
      return !!bout&&ring.key(e,v);
    }
    return {model,act,key};
  }
  window.WilderSignalBox=Object.freeze({create});
})();
