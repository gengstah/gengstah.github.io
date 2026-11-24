(() => {
  "use strict";

  // Hand-plotted body plans at the game's native pixel resolution. Each palette is
  // ink, deep shadow, shade, local color, light and glint, in increasing luminance.
  const palettes = {
    Grove:["#23382d","#3a5142","#507c43","#80a94f","#b5ce70","#e2ecab"],
    Ember:["#392a32","#683642","#a44537","#d46942","#ef9f5b","#ffda97"],
    Tide:["#20343e","#315262","#397486","#56a8a7","#89ccbd","#ceefe0"],
    Vane:["#273d41","#456168","#60888a","#8db7a6","#bed7ba","#edf2d6"],
    Arc:["#433039","#79503b","#aa7033","#dfa543","#f1ce66","#fff2b5"],
    Loam:["#382f34","#5f473d","#886651","#b08a5e","#d9b885","#f4dfb3"],
    Rime:["#293546","#455c7a","#5f89a4","#84b8c6","#b3dce0","#e6faf4"],
    Gloam:["#332c42","#514360","#745b85","#937aa3","#bca1bb","#e7d3d9"],
    Chime:["#412f44","#72506d","#97718e","#c78da5","#e4b4bd","#fbe2d3"],
    Alloy:["#29323a","#47535f","#687685","#92a0a4","#bac5bf","#e8ebe0"],
    cream:["#423c39","#766653","#a99472","#ccb692","#e9d9b3","#fff0d2"],
    reed:["#243a38","#3b5850","#528473","#78aa83","#afd09b","#daebbe"],
    honey:["#553731","#96553d","#c27946","#e8a85f","#f7cf80","#ffedb3"],
    coral:["#482d3e","#76445a","#a75861","#d88178","#e9aa89","#f7d7ad"]
  };
  const morphColors = [
    ["Tide","reed"],["Ember","honey"],["Loam","Alloy"],["Vane","cream"],["Arc","Alloy"],
    ["Gloam","Chime"],["Rime","Vane"],["Grove","reed"],["Alloy","honey"],["Chime","honey"],
    ["Loam","cream"],["Tide","coral"],["Grove","honey"],["Ember","Alloy"],["Vane","Tide"],
    ["Arc","Gloam"],["Gloam","Tide"],["Rime","Alloy"],["Chime","Vane"]
  ];
  const cache = new Map();
  const SIZE = 56;

  function painter(context,primary,accent,secondary) {
    const ink = primary[0], cream = palettes.cream;
    function pixel(x,y,color,w=1,h=1) {
      context.fillStyle=color;
      context.fillRect(Math.round(x),Math.round(y),w,h);
    }
    function line(x0,y0,x1,y1,color,width=1) {
      x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
      const dx=Math.abs(x1-x0),sx=x0<x1 ? 1 : -1;
      const dy=-Math.abs(y1-y0),sy=y0<y1 ? 1 : -1;
      let err=dx+dy;
      while (true) {
        pixel(x0,y0,color,width,width);
        if (x0===x1 && y0===y1) break;
        const step=2*err;
        if(step>=dy){err+=dy;x0+=sx;}
        if(step<=dx){err+=dx;y0+=sy;}
      }
    }
    function lines(points,color,width=1) {
      for(let i=2;i<points.length;i+=2) line(points[i-2],points[i-1],points[i],points[i+1],color,width);
    }
    // Scanline fill keeps diagonal steps sharp, including at fractional display scales.
    function plate(points,pal=primary) {
      const ys=points.filter((_,n)=>n%2);
      const top=Math.min(...ys),bottom=Math.max(...ys);
      for(let y=top;y<=bottom;y++) {
        const edges=[];
        for(let j=points.length-2,i=0;i<points.length;j=i,i+=2) {
          const x0=points[j], y0=points[j+1], x1=points[i], y1=points[i+1];
          if ((y0>y+.4)!==(y1>y+.4)) edges.push(x0+(x1-x0)*(y+.4-y0)/(y1-y0));
        }
        edges.sort((a,b)=>a-b);
        for(let i=0;i+1<edges.length;i+=2) {
          const left=Math.round(edges[i]),right=Math.round(edges[i+1]),width=Math.max(1,right-left);
          const height=(y-top)/Math.max(1,bottom-top);
          pixel(left,y,pal[height>.78 ? 2 : 3],width);
          if(height<.45 && width>3)pixel(left,y,pal[4],Math.max(1,Math.round(width*.38)));
          if(width>4)pixel(right-Math.max(1,Math.round(width*.22)),y,pal[height>.7?1:2],Math.max(1,Math.round(width*.22)));
        }
      }
      lines([...points,points[0],points[1]],pal[0]);
    }
    function bulb(x,y,rx,ry,pal=primary) {
      for(let yy=-ry;yy<=ry;yy++) {
        const half=Math.round(rx*Math.sqrt(Math.max(0,1-(yy/ry)**2)));
        const neighbor=Math.round(rx*Math.sqrt(Math.max(0,1-((Math.abs(yy)+1)/ry)**2)));
        const edge=Math.max(1,half-neighbor);
        pixel(x-half,y+yy,pal[0],half*2+1);
        if(Math.abs(yy)===ry || half<edge) continue;
        const left=x-half+edge,width=2*(half-edge)+1;
        pixel(left,y+yy,pal[yy>ry*.55?2:3],width);
        const shadow=Math.max(0,Math.round(width*(.20+yy/ry*.13)));
        if (shadow)pixel(left+width-shadow,y+yy,pal[yy>ry*.60?1:2],shadow);
        if(yy<ry*.15 && width>3)pixel(left,y+yy,pal[4],Math.max(1,Math.round(width*(.30-yy/ry*.2))));
      }
    }
    function stroke(points,width,pal=primary) {
      lines(points,pal[0],width);
      const inset=points.map(v=>v+1);
      lines(inset,pal[2],Math.max(1,width-2));
      if(width>3) lines(inset,pal[3],width-3);
    }
    function eye(x,y,flip=false) {
      pixel(x,y-1,ink,3);
      pixel(x-1,y,ink,5,3);
      pixel(x,y+3,ink,3);
      pixel(x+(flip?0:2),y+1,cream[5],2,2);
      pixel(x,y,"#fff8d8");
    }
    function paw(x,y,pal=primary) {
      plate([x-3,y-5,x+2,y-5,x+3,y-1,x+2,y+1,x-5,y+1,x-5,y-1,x-3,y-2],pal);
      pixel(x-4,y,cream[4],1);pixel(x-2,y,cream[4],1);
    }
    function ears(x,y,long=false,pal=primary) {
      const h=long?13:7;
      plate([x-6,y+2,x-9,y-h,x-5,y-h+1,x-1,y],pal);
      plate([x+1,y+1,x+3,y-h-1,x+6,y-h+1,x+6,y+2],pal);
      line(x-7,y-h+2,x-4,y-1,accent[3]);line(x+4,y-h+2,x+3,y-1,accent[3]);
    }
    function head(x,y,rx=8,ry=7,pal=primary) {
      bulb(x,y,rx,ry,pal);
      eye(x-3,y-2);
    }
    function wing(x,y,w,h,pal=accent) {
      plate([x,y,x+w,y-h,x+w-3,y-2,x+w-8,y-4,x+w-9,y+1,x+5,y+2,x+3,y+4],pal);
      line(x+3,y,x+w-4,y-h+3,pal[4]);
    }
    function horn(x,y,side=1) {
      plate([x,y+1,x+side*2,y-5,x+side*6,y-8,x+side*5,y-5,x+side*4,y,x+side*2,y+2],cream);
    }
    return {pixel,line,lines,plate,bulb,stroke,eye,paw,ears,head,wing,horn,ink,p:primary,a:accent,s:secondary,c:cream};
  }

  // The placement of the field adaptation and flank marks follows the anatomy of each family.
  const anchors = {
    mole:[29,26,31,33],heron:[28,24,33,31],ram:[30,25,36,34],dragonfly:[26,24,31,29],
    toad:[29,24,33,33],armadillo:[31,22,35,33],newt:[29,29,34,35],owl:[32,16,34,35],
    glider:[29,24,30,32],hedgehog:[30,21,33,31],hare:[32,25,34,35],seal:[31,27,36,36],
    gecko:[30,25,33,33],crab:[29,25,31,34],stag:[30,26,33,33],jelly:[27,15,30,26],
    serpent:[32,26,32,37],falcon:[28,21,33,32],pika:[32,22,32,36],snail:[34,19,34,28],
    angler:[31,22,35,33],fungus:[29,18,32,27],bat:[29,21,30,32],mantis:[35,23,36,32],
    gryphon:[31,22,33,34],spider:[33,21,33,31]
  };

  function adaptation(g,x,y,m) {
    const {pixel,line,plate,bulb,stroke,p,a,c}=g;
    const frond=(dx,dy,wide=2,pal=a)=>{
      plate([x-2,y+3,x+Math.round(dx/2)-wide,y+Math.round(dy/2),x+dx,y+dy,x+Math.round(dx/2)+wide,y+Math.round(dy/2)+wide,x+2,y+3],pal);
    };
    const gem=(dx,dy,w,h,pal=a)=>plate([x+dx,y+dy-h,x+dx+w,y+dy,x+dx+1,y+dy+h,x+dx-w,y+dy+1],pal);
    const stalk=(dx,dy,pal=a)=>{line(x,y,x+dx,y+dy,pal[0],2);line(x,y,x+dx,y+dy,pal[3]);};
    switch(m) {
      case 0:
        plate([x-5,y+3,x-5,y-6,x-3,y-4,x+1,y-10,x+2,y-5,x+7,y-8,x+5,y-1,x+2,y+3],a);
        line(x-2,y+1,x+1,y-6,a[5]);break;
      case 1:
        plate([x-6,y+2,x-5,y-5,x-2,y-3,x+1,y-12,x+3,y-6,x+6,y-8,x+7,y-4,x+6,y+2],p);
        plate([x-2,y+2,x,y-4,x+2,y-3,x+3,y-6,x+4,y+2],a);break;
      case 2:
        plate([x-7,y+3,x-5,y-5,x-1,y-9,x+5,y-7,x+8,y+2],a);
        line(x-1,y-8,x+1,y-2,a[5]);line(x+1,y-2,x+6,y+1,a[1]);break;
      case 3:frond(9,-7);frond(3,-12);frond(-4,-10,2,c);break;
      case 4:
        stroke([x-3,y,x-4,y-6,x-7,y-8],3,a); stroke([x+2,y,x+5,y-6,x+5,y-10],3,a);
        bulb(x-7,y-8,2,2,p);bulb(x+6,y-11,2,2,p);break;
      case 5:
        stalk(-6,-8,p);stalk(2,-11,p);stalk(7,-6,p);
        bulb(x-6,y-8,3,3,a);bulb(x+2,y-10,3,3,p);bulb(x+7,y-5,2,2,a);break;
      case 6:
        frond(-7,-8);frond(-1,-13,2,p);frond(6,-10);frond(10,-5,2,p);
        pixel(x-2,y-6,c[5],2);break;
      case 7:
        frond(8,-7,3);frond(-2,-12,4,p);frond(-8,-6,3);
        line(x-1,y-1,x-2,y-8,a[5]);break;
      case 8:
        for(let i=0;i<3;i++) {
          const d=i*4-5;
          plate([x+d,y+2,x+d-2,y-4-i%2*2,x+d+1,y-7-i%2*2,x+d+5,y-6,x+d+5,y+1],p);
          pixel(x+d,y-3,a[4],2,2);
        }
        break;
      case 9:
        stalk(-6,-7);stalk(1,-10);stalk(7,-5);
        for(const [dx,dy] of [[-6,-4],[1,-7],[7,-2]]) {
          plate([x+dx-1,y+dy-2,x+dx+1,y+dy-2,x+dx+3,y+dy+2,x+dx-3,y+dy+2],a);
          pixel(x+dx,y+dy+3,p[1]);
        }
        break;
      case 10:
        plate([x-5,y+2,x-10,y-3,x-10,y-8,x-6,y-10,x-8,y-7,x-7,y-4,x-2,y-2],c);
        plate([x+1,y+1,x+4,y-4,x+8,y-6,x+9,y-10,x+11,y-7,x+10,y-3,x+4,y+2],p);break;
      case 11:
        for(const [dx,dy,ex,ey] of [[-4,-7,-7,-9],[-4,-7,-3,-11],[3,-7,1,-12],[3,-7,7,-10],[6,-3,10,-6]]) {
          stroke([x,y+2,x+dx,y+dy,x+ex,y+ey],3,a);
        }
        break;
      case 12:
        stroke([x-3,y+2,x+2,y-5,x+8,y-9,x+12,y-9],2,p);
        for(const [dx,dy] of [[0,-4],[4,-7],[8,-9]]) {
          plate([x+dx,y+dy,x+dx-3,y+dy-3,x+dx-3,y+dy-5,x+dx+1,y+dy-3],a);
          plate([x+dx+1,y+dy,x+dx+6,y+dy-1,x+dx+3,y+dy+2,x+dx+1,y+dy+2],p);
        }
        break;
      case 13:
        for(const [dx,h] of [[-5,5],[0,8],[5,6]]) {
          plate([x+dx-2,y+2,x+dx-2,y-h,x+dx+2,y-h-1,x+dx+3,y+2],a);
          pixel(x+dx-1,y-h,p[4],3,1);
        }
        pixel(x+2,y-11,p[3],2);pixel(x-5,y-9,p[4]);break;
      case 14:
        plate([x-4,y+2,x-2,y-5,x+4,y-10,x+10,y-12,x+7,y-7,x+12,y-8,x+5,y-3,x+1,y+2],a);
        line(x-1,y-2,x+6,y-8,p[5]);break;
      case 15:
        for(const [dx,dy] of [[-8,-6],[7,-9]]) {
          const mid=dx>0?2:-3;
          stroke([x,y,x+mid,y-4,x+mid+3,y-5,x+dx,y+dy],2,a);
          pixel(x+dx+1,y+dy-1,p[5],2,2);
        }
        break;
      case 16:
        stalk(-6,-7,p);stalk(4,-10,p);stalk(9,-5,p);
        bulb(x-6,y-8,2,3,a);bulb(x+4,y-10,3,4,a);bulb(x+9,y-5,2,2,a);
        pixel(x+3,y-12,c[5],2);break;
      case 17:
        plate([x-7,y+3,x-7,y-6,x-4,y-9,x,y-7,x+1,y+3],p);
        plate([x-2,y+2,x-1,y-10,x+3,y-13,x+6,y-10,x+5,y+1],p);
        plate([x+4,y+3,x+6,y-6,x+9,y-8,x+10,y-5,x+8,y+3],a);
        line(x+2,y-9,x+2,y-3,p[5]);break;
      case 18:
        for(const [dx,dy] of [[-6,-2],[-5,-6],[-1,-9],[4,-7],[6,-3]])gem(dx,dy,2,3,dx%2===0?a:p);
        bulb(x,y-3,3,3,c);break;
    }
  }

  function drawBody(shape,g) {
    const {pixel,line,lines,plate,bulb,stroke,eye,paw,ears,head,wing,horn,ink,p,a,s,c}=g;
    switch(shape) {
      case "mole":
        paw(37,43,s);bulb(31,33,13,9);bulb(32,37,8,4,c);bulb(18,31,9,7);
        plate([9,30,15,30,14,35,7,34,5,32],c);bulb(7,32,2,2,a);eye(16,29);
        bulb(22,38,6,4,s);for(const dx of [0,3,6])plate([17+dx,39,20+dx,39,17+dx,44,15+dx,44],c);
        bulb(39,37,5,3);pixel(20,25,p[4],3);break;
      case "heron":
        for(const [x,y,offset] of [[31,36,4],[25,37,-1]]) {
          stroke([x,y,x+offset,42,x+offset-2,49],2,a);lines([x+offset-5,50,x+offset,48,x+offset+3,50],ink);
        }
        wing(33,31,14,5,s);bulb(29,30,9,6);wing(25,30,14,5,a);
        stroke([21,29,16,25,20,19,17,16],5,p);bulb(15,16,5,4);
        plate([11,16,2,19,11,19,14,17],a);eye(13,14);break;
      case "ram":
        paw(23,44,s);paw(39,45,s);bulb(30,33,13,9);
        paw(26,45);paw(37,46);bulb(19,29,8,8);plate([11,28,16,30,14,34,8,34,8,31],c);
        bulb(22,25,5,5,a);bulb(22,26,2,2,p);horn(16,24,-1);eye(13,27);pixel(9,30,ink,2);
        bulb(43,30,3,3,c);break;
      case "dragonfly":
        for(const [dy,width] of [[-6,14],[4,15]]) {
          plate([25,26,21,20+dy,8,18+dy,7,21+dy,19,26],s);
          plate([26,27,32,16+dy,32+width,11+dy,45,17+dy,32,27],a);
          line(29,24,42,15+dy,a[5]);
        }
        stroke([23,28,32,29,45,34,50,31],4,p);bulb(24,28,5,4);
        bulb(16,28,6,5);bulb(13,26,3,3,c);eye(12,25);
        lines([21,31,17,36,11,36],ink);lines([25,32,24,38,19,39],ink);break;
      case "toad":
        bulb(37,37,8,6,s);plate([31,37,41,38,46,42,45,44,31,43],p);
        bulb(25,34,13,9);bulb(20,37,8,5,c);bulb(17,29,8,6);
        bulb(15,25,4,4);eye(13,24);bulb(22,26,3,3);pixel(21,24,ink,2,2);
        lines([9,32,14,34,19,33],p[1]);paw(19,42);paw(28,43);break;
      case "armadillo":
        stroke([38,34,44,38,49,36,51,32],3,s);paw(21,43,s);paw(36,44,s);
        bulb(30,32,13,10);for(const x of [26,31,36])lines([x,24,x+2,27,x+3,33,x+2,39],p[1]);
        ears(17,30,false,s);head(16,34,7,5,s);plate([11,32,14,34,12,38,6,38,6,36],c);pixel(6,35,ink,2);
        paw(24,44);paw(36,44);break;
      case "newt":
        stroke([33,35,40,33,45,25,49,25,50,28],5,p);
        plate([37,33,42,23,48,21,46,26,42,32],a);
        bulb(29,35,12,5);paw(20,39,s);paw(34,40);head(16,32,8,6);
        lines([9,34,13,35,17,34],p[1]);line(22,34,32,34,p[4],2);break;
      case "owl":
        paw(24,44,a);paw(33,44,a);plate([27,29,36,30,38,43,34,41,29,44],s);
        bulb(28,32,11,12);bulb(28,34,6,8,c);wing(32,33,9,6,s);
        ears(25,21,false);bulb(25,23,11,8);
        bulb(20,24,5,5,c);bulb(29,24,5,5,c);eye(19,23);eye(27,23,true);
        plate([23,26,26,26,25,30],a);break;
      case "glider":
        stroke([35,32,42,23,46,24,44,29,40,30],5,s);
        plate([14,27,19,21,26,28,41,34,43,41,30,38,20,42,19,34],a);
        bulb(28,31,9,6);paw(22,38,s);paw(39,38);
        ears(17,27,false);head(17,28,7,6);bulb(12,31,4,3,c);pixel(8,29,ink,2);eye(15,26);break;
      case "hedgehog":
        for(const [x,y] of [[19,25],[23,22],[29,22],[35,23],[40,26],[43,31],[44,35]]) {
          plate([x-3,y+6,x+3,y-3,x+4,y+6],s);
        }
        paw(23,43,s);paw(37,44);bulb(30,33,13,9);bulb(18,34,8,6,c);
        plate([13,32,16,36,10,37,5,35],c);pixel(5,33,ink,3,2);eye(15,31);
        for(const x of [24,30,36])lines([x,29,x+3,27,x+2,31],p[1]);break;
      case "hare":
        bulb(39,30,4,4,c);bulb(30,34,10,9);bulb(34,37,7,6,s);paw(33,43,s);
        plate([18,28,13,13,14,7,17,8,21,21,22,26],p);
        plate([21,26,22,12,26,8,28,11,25,25],p);
        line(15,12,19,22,a[3],2);line(25,14,23,21,a[3]);
        head(19,29,7,7);bulb(15,33,4,3,c);pixel(11,31,ink,2);eye(17,26);paw(23,43);break;
      case "seal":
        plate([35,34,43,32,50,25,50,30,47,33,52,32,50,36,43,39,36,40],s);
        bulb(29,36,13,7);bulb(23,37,9,5,c);head(18,29,7,8);
        bulb(13,32,4,3,c);pixel(11,29,ink,3);eye(16,26);lines([12,32,6,31],ink);lines([12,33,6,34],ink);
        plate([24,37,28,38,27,42,20,45,17,44],s);break;
      case "gecko":
        stroke([32,35,42,31,46,23,43,20,39,22],4,p);
        for(const [x,y,dx,dy] of [[23,32,-3,-6],[26,36,-3,6],[34,36,6,4],[35,31,3,-5]]) {
          stroke([x,y,x+dx,y+dy,x+dx-2,y+dy+1],3,s);
          for(let n=0;n<3;n++)pixel(x+dx-3+n*2,y+dy+2+(n%2),a[4],2,1);
        }
        bulb(29,33,10,5);bulb(17,31,8,6);bulb(16,27,4,3);eye(14,27);line(10,33,17,34,ink);break;
      case "crab":
        for(const side of [-1,1])for(const k of [0,1,2]) {
          const x=27+side*(7+k);
          stroke([x,33+k,x+side*8,31+k*3,x+side*11,35+k*3],3,s);
        }
        bulb(28,34,12,7);bulb(20,27,3,3,c);bulb(28,26,3,3,c);eye(18,26);eye(26,25,true);
        stroke([20,34,13,32,12,26],4,p);
        plate([13,30,8,29,5,24,5,17,9,20,10,24,13,23,14,18,17,20,17,26],a);
        plate([38,32,40,26,40,21,43,23,44,26,47,22,48,25,45,30],s);break;
      case "stag":
        for(const [x,offset] of [[24,-2],[29,1],[36,3],[38,-1]])stroke([x,35,x+offset,42,x+offset-1,47],3,offset>0?s:p);
        bulb(31,32,11,7);stroke([22,31,18,22,16,20],6,p);bulb(15,22,6,5);
        plate([12,22,16,25,13,28,7,27,7,25],c);eye(13,20);
        for(const x of [14,20]){stroke([x,19,x+1,13,x-2,9,x-3,6],2,a);stroke([x+1,13,x+5,11,x+5,8],2,a);}
        plate([39,28,45,22,44,29,40,31],s);break;
      case "jelly":
        for(const [x,dx,h] of [[20,-3,14],[25,2,19],[30,-2,16],[35,3,12]]) {
          stroke([x,29,x+dx,33,x+dx-2,38,x+dx+1,29+h],3,x%2?s:a);
        }
        bulb(28,25,12,10);plate([16,27,19,24,35,23,40,28,39,31,35,30,31,32,26,30,21,32,17,30],a);
        eye(22,23);eye(31,23,true);pixel(28,28,p[1],2);break;
      case "serpent":
        stroke([32,37,41,33,45,27,48,28],4,s);
        bulb(29,38,13,6);bulb(27,37,8,3,s);
        stroke([25,38,19,35,17,28,20,24],6,p);head(20,23,7,5);
        plate([12,24,17,24,17,27,11,27],c);eye(18,21);lines([12,26,8,27,5,25],a[2]);
        line(6,27,4,28,a[2]);break;
      case "falcon":
        plate([29,32,37,35,44,42,34,40,32,42,26,35],s);
        paw(25,44,a);paw(30,44,a);bulb(28,32,9,11);bulb(24,33,5,7,c);
        wing(28,29,15,6,s);head(22,23,8,6);
        plate([16,22,11,24,10,28,13,27,15,27,17,25],a);eye(18,21);
        line(17,19,23,20,p[1]);break;
      case "pika":
        paw(23,44,s);paw(34,44,s);bulb(29,34,11,10);bulb(26,36,7,6,c);
        bulb(17,25,4,5);bulb(29,23,4,5);bulb(17,25,2,3,a);bulb(29,23,2,3,a);
        head(22,28,9,7);bulb(16,32,5,3,c);eye(19,26);pixel(12,30,ink,2);
        bulb(21,36,3,3);bulb(39,34,3,3,c);break;
      case "snail":
        plate([9,36,17,35,27,37,37,36,45,38,51,37,48,41,31,43,15,42,8,40],s);
        bulb(32,31,11,11);lines([38,35,33,38,26,34,25,29,29,25,34,25,36,29,34,32,31,32],p[1],2);
        bulb(16,36,6,5,s);
        stroke([15,34,10,29,10,25],2,s);stroke([19,33,20,28,22,25],2,s);
        bulb(10,25,3,3,c);eye(9,24);bulb(22,24,2,2,c);pixel(21,23,ink,2);break;
      case "angler":
        plate([36,32,48,24,47,31,52,35,47,37,49,41,36,37],a);
        bulb(28,33,13,9);plate([27,26,32,19,34,26,39,24,37,29],s);
        stroke([22,27,20,19,13,17,10,21],2,p);bulb(10,22,3,3,a);eye(19,29);
        plate([13,33,21,34,17,40,13,39,11,37],c);lines([11,35,16,36,21,34],ink);
        plate([29,34,36,35,34,40,30,38],a);break;
      case "fungus":
        paw(23,45,s);paw(32,45,s);bulb(27,36,8,9,c);bulb(21,36,4,3);
        plate([11,29,14,22,20,18,25,16,32,17,38,20,43,28,39,31,32,30,26,32,19,30,14,31],p);
        lines([12,29,18,28,25,29,32,27,40,28],a[4]);
        bulb(22,22,3,2,a);bulb(34,23,2,2,s);eye(23,33);eye(30,33,true);break;
      case "bat":
        plate([25,29,18,25,10,16,8,20,8,27,3,34,9,33,12,36,16,33,21,37,25,33],s);
        plate([30,29,39,20,48,14,48,21,51,28,53,32,47,30,44,34,39,32,35,37,30,33],a);
        line(39,22,44,32,a[2]);line(10,21,12,33,s[2]);
        bulb(28,33,6,7);paw(26,41,s);paw(32,40,s);ears(26,26,false);head(26,27,7,6);bulb(22,31,3,2,c);eye(23,26);break;
      case "mantis":
        for(const [x,dx] of [[30,-5],[34,4],[38,8]])stroke([x,32,x+dx,37,x+dx-3,44],2,s);
        plate([26,30,36,25,45,28,41,34,32,36,26,34],p);wing(31,29,15,1,a);
        stroke([28,32,24,27,22,23],4,p);
        plate([15,21,29,20,24,27,19,27],p);eye(17,21);pixel(26,21,ink,2,2);
        lines([18,21,16,15,13,13],ink);lines([24,21,27,15,28,12],ink);
        stroke([24,28,20,35,13,33],3,p);plate([12,34,10,31,12,23,13,29,17,34],a);
        stroke([25,31,23,38,18,38],2,p);break;
      case "gryphon":
        stroke([37,34,44,29,45,24],3,p);plate([44,27,43,20,46,23,49,18,48,26],a);
        paw(24,44,s);paw(39,44,s);bulb(31,33,11,8);paw(24,45);paw(36,45);
        wing(28,31,12,13,s);bulb(21,29,6,8,c);ears(20,23,false);head(19,25,7,6);
        plate([14,25,9,26,8,30,11,29,15,29],a);eye(16,23);break;
      case "spider":
        for(const side of [-1,1])for(const [k,offset] of [[0,-4],[1,0],[2,4],[3,8]]) {
          const x=27+side*(4+k);
          stroke([x,31+k,x+side*(8+k),24+offset,x+side*(14+k),30+offset],2,k%2?s:p);
        }
        bulb(33,30,9,8);bulb(23,34,8,6,s);bulb(19,32,4,4,c);eye(18,31);bulb(25,31,3,3,c);eye(24,30,true);
        lines([18,37,16,40,14,39],ink,2);lines([23,37,23,40,20,40],ink,2);break;
    }
  }

  function flankMark(g,x,y,m) {
    const {pixel,line,lines,a,s}=g;
    switch (m%5) {
      case 0:pixel(x-2,y-1,s[2],2,2);pixel(x+1,y+1,a[4],2);break;
      case 1:lines([x-2,y-1,x-1,y+1,x+1,y-1,x+3,y],a[2]);break;
      case 2:line(x-2,y,x,y-2,a[4]);line(x+1,y+1,x+3,y-1,a[2]);break;
      case 3:pixel(x-2,y-2,a[4],2);pixel(x+2,y,s[1],2);pixel(x,y+1,a[4]);break;
      case 4:line(x-2,y-2,x-2,y+1,s[2]);line(x+1,y-1,x+1,y+2,a[4]);break;
    }
  }

  function sprite(id,design) {
    if(cache.has(id))return cache.get(id);
    const canvas=document.createElement("canvas");
    canvas.width=canvas.height=SIZE;
    const g=canvas.getContext("2d");
    const [base,trim]=morphColors[design.morph];
    const primary=palettes[base],accent=palettes[trim];
    const secondary=design.secondary ? palettes[design.secondary] : accent;
    const tools=painter(g,primary,accent,secondary);
    const [x,y,mx,my]=anchors[design.shape];
    adaptation(tools,x,y,design.morph);
    drawBody(design.shape,tools);
    flankMark(tools,mx,my,design.morph);
    const url=canvas.toDataURL("image/png");
    cache.set(id,url);
    return url;
  }

  window.WilderKinArt = {sprite};
})();
