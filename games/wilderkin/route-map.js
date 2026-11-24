// Finch's linen route chart. Markers carry the same names and actions for touch and keyboard.
(() => {
  "use strict";
  const inks={wood:"#768e61",mesa:"#b47755",night:"#777994",fen:"#6b9280",dune:"#c29b62",alpine:"#889e9c",grotto:"#84758a",shore:"#6e9c98",basalt:"#937a68",ice:"#8eacaf"};
  function line(ctx,pts,color,width=1){
    ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  function glyph(ctx,x,y,biome) {
    const tone=inks[biome]||inks.wood;
    ctx.fillStyle=tone;
    if(["fen","shore","ice"].includes(biome)){
      for(let i=0;i<3;i++)line(ctx,[[x-8+i*2,y+i*3],[x-4+i*2,y+i*3-1],[x+i*2,y+i*3],[x+5+i*2,y+i*3-2]],tone,1.5);
    } else if(biome==="wood") {
      for(let i=-1;i<2;i++){const xx=x+i*5,yy=y+i%2*2;ctx.beginPath();ctx.moveTo(xx,yy-6);ctx.lineTo(xx-4,yy+2);ctx.lineTo(xx+4,yy+2);ctx.fill();ctx.fillRect(xx-1,yy+1,2,3);}
    }else{
      line(ctx,[[x-10,y+4],[x-4,y-6],[x+1,y+2],[x+5,y-3],[x+10,y+4]],tone,1.7);
    }
  }
  function labels(ctx,name,max){
    const lines=[""];
    for(const word of name.split(" ")){
      const i=lines.length-1,test=lines[i]?lines[i]+" "+word:word;
      if(lines[i]&&ctx.measureText(test).width>max)lines.push(word);else lines[i]=test;
    }
    return lines;
  }
  function chart(nodes,districts=false) {
    const height=districts?340:205;
    const anchors=[[.16,.73],[.15,.48],[.20,.24],[.44,.13],[.44,.39],[.43,.65],[.61,.82],[.76,.60],[.73,.33],[.85,.12]];
    function positions(x,y,w,h){
      if(districts){
        const span=Math.min(w,900),left=x+(w-span)/2;
        return nodes.map((n,i)=>({...n,cx:left+anchors[i][0]*span,cy:y+anchors[i][1]*h,cw:span*.275,rh:h*.20}));
      }
      const cols=Math.min(nodes.length,districts?(w<520?3:5):(w<540?3:6));
      const rows=Math.ceil(nodes.length/cols),cw=(w-16)/cols,rh=(h-22)/rows;
      return nodes.map((n,i)=>{
        const r=Math.floor(i/cols),column=r%2?cols-1-i%cols:i%cols;
        const cx=x+8+(column+.5)*cw,cy=y+13+(r+.37)*rh+Math.sin(i*2.3)*Math.min(10,rh*.11);
        return {...n,cx,cy,cw,rh};
      });
    }
    return {height,draw(ctx,x,y,w,h){
      const pts=positions(x,y,w,h);
      ctx.fillStyle="#d4e3d9";ctx.fillRect(x,y,w,h);
      for(let i=0;i<7;i++){
        const py=y+12+i*(h/7);
        const pts=Array.from({length:19},(_,j)=>[x+j*w/18,py+3*Math.sin(j*.8+i)]);
        line(ctx,pts,"#b8cec0");
      }
      const shore=pts.map(p=>[p.cx,p.cy]);
      ctx.lineJoin="round";ctx.lineCap="round";
      if(districts){
        const span=Math.min(w,900),left=x+(w-span)/2;
        const pos=(xx,yy)=>[left+xx*span,y+yy*h];
        const coast=[
          [.075,.86],[.034,.74],[.052,.67],[.10,.64],[.068,.59],[.045,.51],[.08,.45],[.095,.37],[.07,.34],[.073,.23],
          [.14,.22],[.14,.14],[.23,.11],[.26,.15],[.32,.12],[.36,.05],[.49,.046],[.54,.115],[.52,.18],
          [.60,.23],[.65,.18],[.67,.115],[.73,.12],[.79,.045],[.895,.035],[.93,.10],[.90,.17],[.94,.25],[.865,.295],
          [.875,.37],[.945,.405],[.925,.51],[.84,.525],[.875,.61],[.83,.70],[.776,.72],[.76,.83],[.676,.865],
          [.64,.925],[.51,.94],[.505,.86],[.45,.81],[.37,.84],[.31,.80],[.27,.86],[.23,.84],[.17,.89]
        ].map(([xx,yy])=>pos(xx,yy));
        ctx.beginPath();coast.forEach(([xx,yy],i)=>i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy));ctx.closePath();
        ctx.lineWidth=7;ctx.strokeStyle="#b1c6ae";ctx.stroke();ctx.fillStyle="#e8e3bf";ctx.fill();
        ctx.lineWidth=1.5;ctx.strokeStyle="#8ea383";ctx.stroke();
        ctx.save();ctx.clip();
        for(let i=0;i<120;i++){
          const xx=(Math.sin(i*57.13)*8127)%1,yy=(Math.sin(i*23.9+1)*7919)%1;
          const [px,py]=pos(Math.abs(xx),Math.abs(yy));
          const p=pts.reduce((a,b)=>Math.hypot(px-b.cx,py-b.cy)<Math.hypot(px-a.cx,py-a.cy)?b:a,pts[0]);
          ctx.fillStyle=inks[p.biome]||inks.wood;ctx.globalAlpha=.16;
          ctx.beginPath();ctx.ellipse(px,py,4+(i%5)*2,2+i%4,0,0,2*Math.PI);ctx.fill();
          ctx.globalAlpha=.63;if(i%4===0)glyph(ctx,px,py,p.biome);
        }
        ctx.globalAlpha=1;
        for(const river of [[[.35,.14],[.34,.24],[.28,.31],[.31,.39],[.27,.44],[.29,.49],[.22,.52],[.16,.57],[.10,.57],[0,.61]],
          [[.68,.22],[.63,.3],[.61,.35],[.64,.43],[.59,.49],[.60,.6],[.67,.64],[.66,.72],[.72,.78],[.77,.82]]]){
          line(ctx,river.map(([xx,yy])=>pos(xx,yy)),"#adc7b6",3);
        }
        ctx.restore();
        const [cx,cy]=pos(.934,.85);
        line(ctx,[[cx,cy-13],[cx,cy+10]],"#637f71");line(ctx,[[cx-8,cy],[cx+8,cy]],"#637f71");
        ctx.fillStyle="#526e60";ctx.beginPath();ctx.moveTo(cx,cy-14);ctx.lineTo(cx+3,cy-2);ctx.lineTo(cx-3,cy-2);ctx.fill();
        ctx.font="600 9px monospace";ctx.textAlign="center";ctx.fillText("N",cx,cy-17);
      }else{
        for(const [tint,r] of [["#a6b99d",.96],["#c2c8a6",.90],["#e3dfbd",.80],["#eee6c9",.68]]){
          line(ctx,shore,tint,Math.min(h*.58,pts[0].cw*r));
        }
      }
      for(let i=0;i<pts.length;i++){
        const p=pts[i];glyph(ctx,p.cx-p.cw*.30,p.cy-10,p.biome);glyph(ctx,p.cx+p.cw*.25,p.cy-16,p.biome);
        if(i){ctx.setLineDash([3,5]);line(ctx,[[pts[i-1].cx,pts[i-1].cy],[p.cx,p.cy]],p.visited?"#77754a":"#9c957b",2);ctx.setLineDash([]);}
      }
      pts.forEach(p=>{
        const r=p.current?10:8;
        ctx.fillStyle=p.current?"#eabd65":p.visited?"#4a795b":p.open?"#efe7c4":"#c7c7aa";ctx.strokeStyle="#526246";ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(p.cx,p.cy,r,0,Math.PI*2);ctx.fill();ctx.stroke();
        if(p.current){ctx.fillStyle="#3d553c";ctx.fillRect(p.cx-2,p.cy-2,4,4);}
        if(p.pin){line(ctx,[[p.cx+8,p.cy-1],[p.cx+8,p.cy-19]],"#76572d",2);ctx.fillStyle="#bb744d";ctx.fillRect(p.cx+9,p.cy-19,8,6);}
        ctx.font="600 12px 'DM Sans', sans-serif";ctx.textAlign="center";ctx.textBaseline="top";
        const words=labels(ctx,p.label,p.cw-6);
        words.forEach((word,i)=>{
          const tw=ctx.measureText(word).width,yy=p.cy+12+i*13;
          ctx.fillStyle="#f4efd9eb";ctx.fillRect(p.cx-tw/2-2,yy-1,tw+4,14);
          ctx.fillStyle="#344d3c";ctx.fillText(word,p.cx,yy);
        });
      });
      ctx.strokeStyle="#899880";ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
    },hotspots(x,y,w,h){
      return positions(x,y,w,h).map(p=>({id:p.id,value:p.value,label:p.label,detail:p.detail,x:p.cx-p.cw*.43,y:p.cy-15,w:p.cw*.86,h:Math.min(p.rh*.85,64)}));
    }};
  }
  window.WilderRouteMap={chart};
})();
