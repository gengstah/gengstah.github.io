// The two HUDs follow the same west/east lanes as the fighting kin on the grounds.
(() => {
  "use strict";
  const grounds="ui/twinbell-grounds.png",lanes=["West","East"];
  const teams={
    right:{label:"Rival",rail:"#493436",edge:"#976854",panel:"#faf0da",badge:"#76483f",light:"#fac584"},
    left:{label:"You",rail:"#213f36",edge:"#719c7b",panel:"#edf1de",badge:"#355e49",light:"#c6e7a0"}
  };
  function narration(field){
    if(!field)return [];
    return ["right","left"].flatMap(side=>{
      const beats=field[side+"Beats"],team=field[side+"Name"];
      return [[teams[side].label,team,Number.isInteger(beats)?beats+" of 3 beats":""].filter(Boolean).join(", "),
        ...lanes.map((lane,i)=>{
          const k=field[side]?.[i],focus=field.focus?.side===side&&field.focus.lane===i,target=field.target?.side===side&&field.target.lane===i;
          return lane+" lane, "+(k?k.name+", "+k.hp+" of "+k.maxHp+" health":"empty")+(focus?", selected":"")+(target?", targeted":"");
        })];
    });
  }
  function create({c,rect,ellipse,label,getFont,fit,source,picture,rightFacing,control,highlighted}){
    const spritesByImage=new WeakMap();
    // Generated kin and hand-painted starters have different transparent margins.
    // Trim to their actual silhouettes so their feet meet the floor and each lane is visible.
    function portrait(src){
      const image=source(src);if(!image)return null;
      if(spritesByImage.has(image))return spritesByImage.get(image);
      const canvas=document.createElement("canvas"),w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
      canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0);
      const pixels=ctx.getImageData(0,0,w,h).data;
      let left=w,top=h,right=-1,bottom=-1;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>24){
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      }
      if(right<left){spritesByImage.set(image,null);return null;}
      const sw=right-left+1,sh=bottom-top+1,rim=Math.max(1,Math.round(Math.max(sw,sh)/58));
      canvas.width=sw+rim*2;canvas.height=sh+rim*2;
      for(const [dx,dy] of [[0,-rim],[-rim,0],[rim,0],[0,rim]])ctx.drawImage(image,left,top,sw,sh,rim+dx,rim+dy,sw,sh);
      ctx.globalCompositeOperation="source-in";ctx.fillStyle="#fff1c9";ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.globalCompositeOperation="source-over";ctx.drawImage(image,left,top,sw,sh,rim,rim,sw,sh);
      spritesByImage.set(image,canvas);return canvas;
    }
    let previous=null,changes={};
    function update(field){
      if(!field){previous=null;changes={};return;}
      const next={};
      for(const side of ["right","left"])lanes.forEach((_,i)=>{
        const k=field[side]?.[i],key=side+i;
        if(!k){delete changes[key];return;}
        next[key]={id:k.id,hp:k.hp};
        const old=previous?.[key];
        if(old?.id!==k.id)delete changes[key];
        else if(old.hp!==k.hp)changes[key]={amount:k.hp-old.hp,at:performance.now()};
      });
      previous=next;
    }
    function draw(field,x,y,w,t,still){
      const small=w<440,rail=19,panel=30,sideH=rail+panel,half=w/2;
      const sky=y+sideH,stageH=Math.round(Math.min(245,Math.max(105,w*.32))),near=sky+stageH,h=sideH*2+stageH;
      const sprites=[];
      c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
      // The same courtyard remains readable while the image loads or in offline asset fallback.
      if(source(field.background||grounds))picture(field.background||grounds,x,sky,w,stageH,"cover",false,.38);
      else{
        rect(c,x,sky,w,stageH*.42,"#a6c9be");rect(c,x,sky+stageH*.37,w,stageH*.15,"#658866");
        rect(c,x,sky+stageH*.49,w,stageH*.51+1,"#d4ab74");rect(c,x,sky+stageH*.5,w,3,"#8c704e");
        for(let i=0;i<8;i++)rect(c,x+(i+.25)*w/8,sky+stageH*.39,3,stageH*.11,"#896a49");
      }
      for(const side of ["right","left"]){
        const home=side==="left",style=teams[side],railY=home?near+panel:y,hudY=home?near:y+rail;
        rect(c,x,railY,w,rail,style.rail);rect(c,x,home?railY+rail-2:railY,w,2,style.edge);
        const beats=field[side+"Beats"],team=field[side+"Name"],score=Number.isInteger(beats);
        c.font=getFont(11,"mono",700);
        const tag=style.label.toUpperCase(),tagW=c.measureText(tag).width;
        label(c,tag,x+7,railY+3,11,style.light,"mono",700);
        c.font=getFont(12,"body",650);
        label(c,fit(c,team||"",w-tagW-(score?96:28)),x+tagW+16,railY+1,12,"#fff8df","body",650);
        if(score)label(c,beats+"/3 BEATS",x+w-7,railY+3,10,"#fff5d5","mono",700,"right");
        lanes.forEach((lane,i)=>{
          const k=field[side]?.[i],px=x+i*half,focused=field.focus?.side===side&&field.focus.lane===i;
          const target=field.target?.side===side&&field.target.lane===i;
          const colW=Math.floor(half),laneW=small?32:37,life=k?k.hp+"/"+k.maxHp:"";
          const status=k?.action&&!k.action.disabled?{...k.action,uid:"twin-field-"+side+i,
            aria:[k.action.label,style.label,lane+" lane",k.name,k.hp+" of "+k.maxHp+" health"].join(". ")}:null;
          const hit=status&&control(status,px,hudY,colW,panel),hot=focused||highlighted(hit);
          rect(c,px,hudY,colW,panel,hot?"#fff0ad":style.panel,hot?"#967433":"#b7ae8d");
          rect(c,px+4,hudY+4,laneW,18,hot?"#694c27":style.badge);
          label(c,lane.toUpperCase(),px+4+laneW/2,hudY+7,10,"#fff9db","mono",700,"center");
          const num=small?11:12;c.font=getFont(num,"mono",650);const healthW=c.measureText(life).width;
          const nameX=px+laneW+11,right=px+colW-6,font=small?15:17;
          c.font=getFont(font,"title",650);label(c,fit(c,k?.name||"Empty lane",right-nameX-healthW-4),nameX,hudY+2,font,"#21392e","title",650);
          label(c,life,right,hudY+7,num,"#273d32","mono",650,"right");
          if(k){
            const ratio=Math.max(0,Math.min(1,k.hp/Math.max(1,k.maxHp))),bw=colW-12;
            rect(c,px+6,hudY+24,bw,3,"#c3c7ad");rect(c,px+6,hudY+24,Math.round(bw*ratio),3,ratio<.25?"#a53c32":ratio<.5?"#aa7137":"#498058");
          }
          const cx=Math.round(x+w*((home?.16:.35)+i*.49)),base=Math.round(sky+stageH*(home?.97:.75));
          const size=Math.round(Math.min(w*(home?.244:.207),stageH*(home?.76:.65)));
          sprites.push({side,k,cx,base,size,hot,target,status,i});
        });
      }
      c.save();c.beginPath();c.rect(x,sky,w,stageH);c.clip();
      for(const {side,k,cx,base,size,hot,target,status,i} of sprites){
        const far=side==="right",art=k&&portrait(k.src),scale=art?size/Math.max(art.width,art.height):1;
        const sw=art?Math.round(art.width*scale):size,sh=art?Math.round(art.height*scale):size,r=Math.round(sw*.44);
        ellipse(c,cx,base,r,far?5:7,"#4e47275c");
        if(hot)ellipse(c,cx,base,r+3,far?6:8,null,"#fff4a3",2);
        if(!k){rect(c,cx-5,base-2,10,2,"#fff1c8");continue;}
        const key=side+i,change=changes[key],elapsed=change?t-change.at:Infinity;
        const reacting=!still&&elapsed>=0&&elapsed<520;
        const recoil=reacting&&change.amount<0?Math.sin(elapsed/30)*3*(1-elapsed/520):0;
        const idle=still?0:Math.sin(t*.0026+i*1.9+(far?2.4:0))*1.5;
        const top=Math.round(base-sh-2+idle),cy=top+sh/2;
        if(art){
          const flip=k.flip??(far?rightFacing.has(k.src):!rightFacing.has(k.src));
          c.save();c.translate(Math.round(cx+recoil),top);c.scale(flip?-1:1,1);
          c.imageSmoothingEnabled=false;c.globalAlpha=k.hp>0?1:.4;c.drawImage(art,-Math.floor(sw/2),0,sw,sh);c.restore();
        }
        if(target){
          const offset=still?2:2+Math.round(Math.sin(t*.008)),arm=7;
          for(const dx of [-1,1])for(const dy of [-1,1]){
            const cornerX=Math.round(cx+dx*(sw/2+offset)),cornerY=Math.round(cy+dy*(sh/2+offset));
            for(const [ink,weight] of [["#382f2b",4],["#fff3bb",2]]){
              rect(c,dx<0?cornerX:cornerX-arm,cornerY,arm,weight,ink);
              rect(c,cornerX,dy<0?cornerY:cornerY-arm,weight,arm,ink);
            }
          }
        }
        if(hot){
          const tip=Math.max(sky+8,top-1);
          c.fillStyle="#4c3926";c.beginPath();c.moveTo(cx-7,tip-5);c.lineTo(cx+7,tip-5);c.lineTo(cx,tip+2);c.fill();
          c.fillStyle="#ffe19b";c.beginPath();c.moveTo(cx-4,tip-4);c.lineTo(cx+4,tip-4);c.lineTo(cx,tip);c.fill();
        }
        if(reacting){
          const amount=(change.amount>0?"+":"")+change.amount;c.font=getFont(12,"mono",700);
          const tw=c.measureText(amount).width+8,dx=cx+size*.22,dy=Math.max(sky+2,cy-size*.43-elapsed/80);
          rect(c,dx-tw/2,dy,tw,16,change.amount>0?"#2b6146":"#663d36");label(c,amount,dx,dy+1,12,"#fff9de","mono",700,"center");
        }
        if(status){
          const hitH=Math.max(38,sh),spriteHit=control(status,cx-sw/2,cy-hitH/2,sw,hitH);
          spriteHit.pointerOnly=true;
        }
      }
      c.restore();c.restore();return h;
    }
    return {draw,update};
  }
  window.WilderTwinField=Object.freeze({create,narration});
})();
