// Translate a round's board description into canvas controls. The fragment is never attached to the document.
(() => {
  "use strict";
  const label = node => node.textContent.trim().replace(/\s+/g," ");
  const cell = node => {
    const action = node.tagName === "BUTTON";
    const tower = node.querySelector(".fair-bells");
    const text = tower ? node.lastChild.textContent + " · " + ([...tower.children].map(label).join(" ") || "empty") : label(node);
    return {id:action ? "play-move" : undefined, value:node.dataset.play, label:text, aria:node.getAttribute("aria-label") || text,
      tone:[...node.classList].find(c=>!c.startsWith("fair-")), disabled:action && node.disabled};
  };
  function wireBoard(node) {
    const segments = [...node.querySelectorAll("line")].map(line =>
      [Number(line.getAttribute("x1")),Number(line.getAttribute("y1")),Number(line.getAttribute("x2")),Number(line.getAttribute("y2")),line.classList.contains("crossed")]);
    const posts = [...node.querySelectorAll("circle")].map((p,i) => ({
      x:Number(p.getAttribute("cx")), y:Number(p.getAttribute("cy")), here:p.classList.contains("here"), name:String.fromCharCode(65+i)
    }));
    return {height:190, text:"Bridge network · dotted bridges have been crossed.", draw(ctx,x,y,w,h) {
      const scale=Math.min(w,h)/100, left=x+(w-100*scale)/2;
      ctx.save();ctx.translate(left,y);ctx.scale(scale,scale);
      for (const [x1,y1,x2,y2,used] of segments) {
        ctx.beginPath();ctx.strokeStyle=used?"#879985":"#a57643";ctx.lineWidth=2;
        ctx.setLineDash(used?[3,3]:[]);ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
      }
      ctx.setLineDash([]);ctx.font="bold 8px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
      for (const p of posts) {
        ctx.fillStyle=p.here?"#e1b967":"#496f60";ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=p.here?"#28392e":"#fff9dd";ctx.fillText(p.name,p.x,p.y);
      }
      ctx.restore();
    }};
  }
  function sectionsFor(activity,round) {
    const template=document.createElement("template");
    template.innerHTML=activity.view(round);
    const sections=[];
    function read(node) {
      const type=node.classList;
      if (type.contains("fair-tiles")) {
        sections.push({grid:{cols:Number(node.style.getPropertyValue("--columns")),cells:[...node.children].map(cell)}});
      } else if (type.contains("fair-buttons")) {
        sections.push({columns:Math.min(3,node.children.length),rows:[...node.children].map(cell)});
      } else if (type.contains("fair-gauge")) {
        sections.push({text:[...node.children].map(label).join("   ·   ")});
      } else if (type.contains("fair-flight")) {
        sections.push({grid:{cols:3,cells:[...node.querySelectorAll(".fair-tile")].map(cell)}});
      } else if (type.contains("fair-water")) {
        sections.push({meter:{low:round.low, high:round.low+26, value() {
          if (round.steady) return round.position;
          const phase=((performance.now()-round.started)%4000)/2000;
          return (phase<=1?phase:2-phase)*100;
        }}});
      } else if (type.contains("fair-wire")) {
        sections.push(wireBoard(node));
      } else if (type.contains("fair-history") || type.contains("fair-vessels")) {
        if (node.children.length) sections.push({text:[...node.children].map(label).join("   /   ")});
      } else if (label(node)) sections.push({text:label(node)});
    }
    [...template.content.children].forEach(read);
    return sections;
  }
  function create({game,row,notify,go,render}) {
    const activities=window.WilderActivities.games;
    let session=null;
    function start(id) {
      const activity=activities.find(g=>g.id===id);
      if (!activity) return;
      const pass=game.gamePass(id);
      if (!pass.earned || game.state.region!==activity.region || game.state.battle) {
        notify(pass.reason || "Return to this game’s home region."); return;
      }
      if (!session || session.id!==id) session={id,round:activity.setup()};
      go("play",id);
    }
    function model(id) {
      const activity=activities.find(g=>g.id===id);
      if (!session || session.id!==id) return {title:activity.name,sections:[{rows:[row("play-start","Start round",id)]}]};
      const round=session.round;
      const controls=[];
      if (round.result==="won") controls.push(row("play-claim","Collect reward",id));
      else controls.push(row("play-restart",round.result ? "Try again" : "Restart round",id));
      controls.push(row("back","Leave table"));
      const sections=round.result ? [{title:round.result==="won"?"Round cleared":"Round ended",text:round.notice}] : sectionsFor(activity,round);
      if (!round.result && round.notice) sections.push({text:round.notice});
      sections.push({columns:2,rows:controls});
      return {title:activity.name,kicker:game.regions[activity.region].name,subtitle:activity.description,sections};
    }
    function act(action,value) {
      if (action==="play-start") {start(value);return true;}
      if (!session || !action.startsWith("play-")) return false;
      const activity=activities.find(g=>g.id===session.id);
      if (action==="play-move" && !session.round.result) activity.play(session.round,value);
      if (action==="play-restart") session.round=activity.setup();
      if (action==="play-claim" && session.round.result==="won") {
        const reward=game.awardGame(activity.id);
        if (!reward.ok) {notify(reward.message);return true;}
        session=null;go("game-info",activity.id,"replace");notify(reward.message);return true;
      }
      render();return true;
    }
    return {model,act,reset(){session=null;}};
  }
  window.WilderCanvasGames={create};
})();
