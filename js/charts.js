(function(root){
  'use strict';
  function aggregate(points,minutes){
    const groups=[];
    for(const p of points){const bucket=Math.floor((p.t-1)/(minutes*60000));let g=groups.at(-1);if(!g||g.bucket!==bucket){g={bucket,t:p.t,o:p.o??p.p,h:p.h??p.p,l:p.l??p.p,c:p.p,v:p.v||0};groups.push(g);}else{g.h=Math.max(g.h,p.h??p.p);g.l=Math.min(g.l,p.l??p.p);g.c=p.p;g.v+=p.v||0;}}
    return groups;
  }
  function indicators(bars){let ema=bars[0]?.c||0,gain=0,loss=0;return bars.map((b,i)=>{ema=b.c*2/10+ema*8/10;const sample=bars.slice(Math.max(0,i-19),i+1),mean=sample.reduce((s,p)=>s+p.c,0)/sample.length,std=Math.sqrt(sample.reduce((s,p)=>s+(p.c-mean)**2,0)/sample.length);if(i){const diff=b.c-bars[i-1].c;if(i<=14){gain+=Math.max(0,diff)/14;loss+=Math.max(0,-diff)/14;}else{gain=(gain*13+Math.max(0,diff))/14;loss=(loss*13+Math.max(0,-diff))/14;}}return {...b,ema,sma:i>=19?mean:null,upper:i>=19?mean+2*std:null,lower:i>=19?mean-2*std:null,rsi:i>=14?(loss===0?(gain===0?50:100):100-100/(1+gain/loss)):null};});}
  function draw(canvas,points,options={}){
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height||!points.length)return;
    const w=rect.width,h=rect.height,dpr=root.devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
    const bars=indicators(aggregate(points,options.interval||5)),left=10,right=w-58,top=17,bottom=h-(options.rsi?108:50),n=bars.length;
    let low=Math.min(...bars.map(b=>options.bands&&b.lower!==null?Math.min(b.l,b.lower):b.l)),high=Math.max(...bars.map(b=>options.bands&&b.upper!==null?Math.max(b.h,b.upper):b.h));const pad=Math.max(.03,(high-low)*.12);low-=pad;high+=pad;
    const x=i=>left+(i+.5)/n*(right-left),y=p=>bottom-(p-low)/(high-low)*(bottom-top),width=Math.max(1,Math.min(14,(right-left)/n*.65));
    ctx.font='9px Arial';ctx.lineWidth=1;
    for(let i=0;i<5;i++){const value=low+(high-low)*i/4;ctx.strokeStyle='#e8eef2';ctx.beginPath();ctx.moveTo(left,y(value));ctx.lineTo(right,y(value));ctx.stroke();ctx.fillStyle='#8499a7';ctx.fillText(value.toFixed(2),right+7,y(value)+3);}
    const vmax=Math.max(...bars.map(b=>b.v),1);bars.forEach((b,i)=>{ctx.fillStyle=b.c>=b.o?'#16836c25':'#c3545925';ctx.fillRect(x(i)-width/2,bottom+4,width,b.v/vmax*22);});
    function line(key,color,lineWidth=1){ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.beginPath();let started=false;bars.forEach((b,i)=>{if(b[key]===null)return;if(started)ctx.lineTo(x(i),y(b[key]));else{ctx.moveTo(x(i),y(b[key]));started=true;}});ctx.stroke();}
    if(options.mode==='line')line('c','#087cb7',1.8);else bars.forEach((b,i)=>{ctx.lineWidth=1;ctx.strokeStyle=ctx.fillStyle=b.c>=b.o?'#16836c':'#c35459';ctx.beginPath();ctx.moveTo(x(i),y(b.h));ctx.lineTo(x(i),y(b.l));ctx.stroke();ctx.fillRect(x(i)-width/2,y(Math.max(b.o,b.c)),width,Math.max(1.2,Math.abs(y(b.o)-y(b.c))));});
    if(options.sma)line('sma','#d99431',1.5);if(options.ema)line('ema','#8861c1',1.5);if(options.bands){line('upper','#6d9dcb');line('lower','#6d9dcb');}
    ctx.setLineDash([3,3]);ctx.strokeStyle='#8db3ce';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,y(bars.at(-1).c));ctx.lineTo(right,y(bars.at(-1).c));ctx.stroke();ctx.setLineDash([]);
    if(options.rsi){const ry=v=>h-31-v/100*48;ctx.fillStyle='#f8fafc';ctx.fillRect(left,h-82,right-left,53);ctx.font='8px Arial';ctx.fillStyle='#8094a2';ctx.fillText('RSI 14',left+3,h-73);[30,70].forEach(v=>{ctx.setLineDash([2,3]);ctx.strokeStyle='#ccd7df';ctx.beginPath();ctx.moveTo(left,ry(v));ctx.lineTo(right,ry(v));ctx.stroke();ctx.fillText(String(v),right+6,ry(v)+3);});ctx.setLineDash([]);ctx.beginPath();ctx.strokeStyle='#8861c1';let start=false;bars.forEach((b,i)=>{if(b.rsi===null)return;if(start)ctx.lineTo(x(i),ry(b.rsi));else{ctx.moveTo(x(i),ry(b.rsi));start=true;}});ctx.stroke();}
    ctx.font='9px Arial';ctx.fillStyle='#8b9ca8';for(let i=0;i<4;i++){const idx=Math.round(i*(n-1)/3),label=options.interval>=1440?new Date(bars[idx].t).toLocaleDateString('en-US',{month:'short',day:'numeric'}):new Date(bars[idx].t).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});ctx.fillText(label,Math.max(left,Math.min(right-45,x(idx)-20)),h-10);}
    let hovered=bars.at(-1);if(options.pointer!==undefined){const index=Math.max(0,Math.min(n-1,Math.floor((options.pointer-left)/(right-left)*n)));hovered=bars[index];ctx.strokeStyle='#829aaa';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(x(index),top);ctx.lineTo(x(index),h-28);ctx.stroke();ctx.beginPath();ctx.moveTo(left,y(hovered.c));ctx.lineTo(right,y(hovered.c));ctx.stroke();ctx.setLineDash([]);}
    return hovered;
  }
  root.NorthstarCharts={aggregate,indicators,draw};if(typeof module!=='undefined')module.exports=root.NorthstarCharts;
})(typeof window!=='undefined'?window:globalThis);
