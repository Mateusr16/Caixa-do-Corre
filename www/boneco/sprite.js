/* Caixa do Corre — motoboy em animação limitada (estilo anime de TV).
   Poses-chave desenhadas inteiras + troca com "pop" de amassar/esticar + deformação
   elástica do corpo inteiro (respira, balança, quica). Nenhuma junta gira solta.
   Sprite.create(canvas, base) -> Promise<{setMood(m), play(kind)}> */
(function(){
const A={"rest":{"head":[159.5,47.2],"handR":[206.1,203.7],"handL":[116.9,203.7]},"waveA":{"head":[159.5,47.2],"handR":[221.9,46.7],"handL":[116.9,203.7]},"waveB":{"head":[159.5,47.2],"handR":[261.7,63.3],"handL":[116.9,203.7]},"cheer":{"head":[155.6,47.3],"handR":[244.7,48.9],"handL":[78.3,48.9]},"cheerB":{"head":[163.4,47.3],"handR":[226.7,41.4],"handL":[96.3,41.4]},"sad":{"head":[176.4,69.2],"handR":[192.6,214.2],"handL":[130.4,212.1]},"scared":{"head":[153.7,45.5],"handR":[234.8,45.2],"handL":[88.2,45.2]},"scaredB":{"head":[155.6,45.3],"handR":[225,42.4],"handL":[98,42.4]},"crouch":{"head":[159.5,50.2],"handR":[236.9,191.6],"handL":[86.1,191.6]},"eat":{"head":[145.5,48.2],"handR":[159,129.6],"handL":[116.9,206]},"hold":{"head":[156.5,49.8],"handR":[214.5,199],"handL":[131.7,205.6]},"fix":{"head":[177.3,50.6],"handR":[227,66.7],"handL":[117,201.3]},"wipe":{"head":[153.7,47.5],"handR":[228.8,199],"handL":[126.7,63.2]},"reach":{"head":[166.2,47.6],"handR":[266.5,65.6],"handL":[95.1,192]}};
const FOOT=[162,354],PW=300,PH=360; // coordenadas das poses (a imagem tem 400x480)
const S=Math.sin,C=Math.cos,ease=p=>p<.5?2*p*p:1-(-2*p+2)**2/2,cl=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const SVG={
 burger:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-13 -12 26 24"><path d="M-11 -1 Q0 -15 11 -1z" fill="#e8a14a" stroke="#121418" stroke-width="1.4"/><circle cx="-4" cy="-6" r=".8" fill="#fff3c4"/><circle cx="2" cy="-8" r=".8" fill="#fff3c4"/><circle cx="6" cy="-5" r=".8" fill="#fff3c4"/><path d="M-12 -1 h24 l-2 3 -3-1.5 -3 1.5 -3-1.5 -3 1.5 -3-1.5 -3 1.5 -3-1.5z" fill="#62c95c" stroke="#121418" stroke-width="1"/><rect x="-11" y="2" width="22" height="4" rx="2" fill="#7a3f1f" stroke="#121418" stroke-width="1"/><path d="M-10 6 h20 v2 q0 3-3 3 h-14 q-3 0-3-3z" fill="#e8a14a" stroke="#121418" stroke-width="1.4"/></svg>',
 fuel:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -16 24 30"><rect x="-10" y="-9" width="20" height="22" rx="3" fill="#e0262e" stroke="#121418" stroke-width="1.6"/><path d="M4 -9 l5 -6" stroke="#121418" stroke-width="3.4" stroke-linecap="round"/><rect x="-6" y="-13" width="7" height="5" rx="1.5" fill="none" stroke="#121418" stroke-width="2"/><path d="M-6 -4 l12 12 M6 -4 l-12 12" stroke="#a5141b" stroke-width="2"/><rect x="-8" y="-7" width="4" height="15" rx="2" fill="#fff" opacity=".35"/></svg>',
 wrench:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -16 16 32"><path d="M0 14 V-6" stroke="#121418" stroke-width="6.4" stroke-linecap="round"/><path d="M0 14 V-6" stroke="#b9c1cc" stroke-width="3.6" stroke-linecap="round"/><path d="M-6 -9 a6.5 6.5 0 1 0 12 0 l-3.5 4 h-5z" fill="#b9c1cc" stroke="#121418" stroke-width="1.6"/></svg>',
 bill:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-13 -8 26 16"><rect x="-12" y="-7" width="24" height="14" rx="2" fill="#4fbf6f" stroke="#121418" stroke-width="1.4"/><rect x="-9" y="-4" width="18" height="8" rx="1" fill="none" stroke="#2c8a49" stroke-width="1"/><circle r="3.2" fill="#8ee0a6" stroke="#2c8a49" stroke-width="1"/></svg>'};
const svgImg=s=>{const i=new Image();i.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);return i};

async function create(canvas,base){
  const ctx=canvas.getContext('2d'),IMG={},PROP={};
  await Promise.all(Object.keys(A).map(n=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>{IMG[n]=i;ok()};i.onerror=no;i.src=base+'pose_'+n+'.webp'})));
  for(const k in SVG)PROP[k]=svgImg(SVG[k]);
  let mood='neutral',ev=null,t0=0,last=0,pose='rest',popT=-9,timers=[],fx=[],nextFx=0,W=1,H=1,k=1,onScreen=true;
  // transformações suavizadas do corpo inteiro: x,y (px), sx,sy, rot (rad), bend (curva lateral)
  const cur={x:0,y:0,sx:1,sy:1,rot:0,bend:0};
  function size(){const d=Math.min(window.devicePixelRatio||1,2),w=canvas.clientWidth,h=canvas.clientHeight;
    if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d)}
    W=w;H=h;const hr=+canvas.dataset.headroom||0;k=(h-hr-6)/(FOOT[1]-20)*.94;return d}
  function setPose(n,t){if(n!==pose){pose=n;popT=t}}

  /* ---------- o que fazer em cada instante ---------- */
  function target(t){
    const g={x:0,y:0,sx:1,sy:1,rot:0,bend:0};let p='rest';
    if(mood==='happy'){ // pulinhos em loop; troca de pose a cada pulo (como num anime)
      const per=.62,ph=(t%per)/per,n=Math.floor(t/per),air=S(Math.PI*ph);
      p=n%2?'cheer':'cheerB';g.y=-20*air;
      const contact=ph<.14||ph>.86;g.sx=contact?1.08:.97;g.sy=contact?.9:1.05;g.rot=S(t*2.4)*.03;
    }else if(mood==='sad'){p='sad';const br=S(t*1.1);g.sy=.985+br*.008;g.bend=-.05+S(t*.5)*.02;g.y=2}
    else if(mood==='scared'){p=Math.floor(t/.09)%2?'scared':'scaredB';g.x=S(t*53)*1.6;g.rot=S(t*41)*.012;g.sy=1+S(t*29)*.01}
    else{ // tranquilo: respira, balança, e de vez em quando dá tchau
      const br=S(t*2.1),cyc=t%8;g.sy=1+br*.012;g.sx=1-br*.006;g.bend=S(t*.8)*.05;g.rot=S(t*.8)*.01;
      if(cyc>5.2&&cyc<7.4)p=Math.floor((cyc-5.2)/.16)%2?'waveB':'waveA';
    }
    if(ev){const q=(t-t0)/ev.dur;if(q>=1){ev=null}else{const r=eventTarget(ev.k,q,t,g);if(r)p=r}}
    return{g,p};
  }
  function eventTarget(e,q,t,g){
    g.bend*=.3;
    if(e==='jump'){
      if(q<.2){const a=ease(q/.2);g.sx=1+.14*a;g.sy=1-.2*a;g.y=0;return 'crouch'}
      if(q<.8){const a=(q-.2)/.6,st=Math.max(0,1-a*3);g.y=-38*S(Math.PI*a);g.sx=1-.1*st;g.sy=1+.16*st;g.rot=S(a*Math.PI*2)*.07;return a<.5?'cheer':'cheerB'}
      const a=(q-.8)/.2,sq=S(a*Math.PI);g.sx=1+.12*sq;g.sy=1-.16*sq;g.y=0;return a<.5?'crouch':'rest';
    }
    if(e==='eat'){
      if(q<.25)return 'rest';
      if(q<.86){const c=S((q-.3)*60);g.sy=1+Math.max(0,c)*.03;g.sx=1-Math.max(0,c)*.015;g.rot=c*.015;return 'eat'}
      g.sy=1.02;return 'rest';
    }
    if(e==='fuel'){
      if(q<.22)return 'rest';
      const a=(q-.22)/.78,dip=a<.18?S(a/.18*Math.PI):0;g.sy=1-dip*.08;g.sx=1+dip*.04;g.rot=-.04*Math.min(1,a*4)*(a>.85?1-(a-.85)/.15:1);g.y=dip*3;
      return q<.88?'hold':'rest';
    }
    if(e==='fix'){
      if(q<.2)return 'rest';
      if(q<.72){g.x=S(t*30)*.8;g.rot=S((q-.2)*40)*.015;return 'fix'}
      return q<.95?'wipe':'rest';
    }
    if(e==='loss'){
      if(q<.1)return 'rest';
      if(q<.62){g.rot=.05;g.x=4;return 'reach'}
      g.sy=.97;g.y=2;return 'rest';
    }
    return null;
  }

  /* ---------- desenho com deformação elástica (faixas horizontais) ---------- */
  function M(){ // ponto da pose (coord. 300x360) -> tela, seguindo o corpo
    const fx=W/2+cur.x,fy=H-6+cur.y,pop=popScale(),c=C(cur.rot),s=S(cur.rot);
    return(px,py)=>{let rx=px-FOOT[0],ry=py-FOOT[1];const v=cl(-ry/(FOOT[1]-20));rx+=cur.bend*v*v*90;
      rx*=k*cur.sx*pop;ry*=k*cur.sy*(2-pop);return[fx+rx*c-ry*s,fy+rx*s+ry*c]}}
  function popScale(){const a=(last-popT)/.16;return a<0||a>1?1:1+.07*S(a*Math.PI)}
  function drawBody(d){
    const I=IMG[pose],sc=I.width/PW,N=40,pop=popScale();
    const fx=W/2+cur.x,fy=H-6+cur.y;
    ctx.setTransform(d,0,0,d,0,0);ctx.translate(fx,fy);ctx.rotate(cur.rot);ctx.scale(k*cur.sx*pop,k*cur.sy*(2-pop));
    for(let i=0;i<N;i++){
      const y0=i*PH/N,y1=(i+1)*PH/N,v=cl((FOOT[1]-(y0+y1)/2)/(FOOT[1]-20)),off=cur.bend*v*v*90;
      ctx.drawImage(I,0,y0*sc,I.width,(y1-y0)*sc+1,-FOOT[0]+off,y0-FOOT[1],PW,y1-y0+.6);
    }
  }

  /* ---------- efeitos de mangá ---------- */
  function spawn(o){fx.push(Object.assign({age:0,life:1,vx:0,vy:0,rot:0,vr:0,s:1},o))}
  const pt=(name)=>M()(...A[pose][name]);
  const foot=()=>[W/2+cur.x,H-6];
  function burst(n,o){for(let i=0;i<n;i++){const a=Math.PI*2*i/n+Math.random()*.3,sp=60+Math.random()*40;spawn(Object.assign({vx:C(a)*sp,vy:S(a)*sp},o))}}
  function star(r,col,n=4){ctx.fillStyle=col;ctx.strokeStyle='#121418';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<n*2;i++){const a=i*Math.PI/n,rr=i%2?r*.35:r;ctx.lineTo(S(a)*rr,-C(a)*rr)}ctx.closePath();ctx.fill();ctx.stroke()}
  function cloud(x,y,s,col){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle=col;ctx.beginPath();ctx.arc(-8,2,6,0,7);ctx.arc(0,-2,8,0,7);ctx.arc(9,2,6,0,7);ctx.fill();ctx.restore()}
  function ambient(t){
    if(t<nextFx)return;const [hx,hy]=pt('head');
    if(mood==='happy'){spawn({k:'spark',x:hx+(Math.random()-.5)*W*.8,y:hy+(Math.random()-.2)*H*.45,life:.9,s:.5+Math.random()*.6});nextFx=t+.35}
    else if(mood==='sad'){spawn({k:'drop',x:hx+(Math.random()-.5)*24,y:hy-30,vy:55,life:.7,s:.6});nextFx=t+.2}
    else if(mood==='scared'){spawn({k:'drop',x:hx+(Math.random()<.5?-1:1)*20,y:hy-8,vx:(Math.random()-.5)*80,vy:-60,g:220,life:.8,s:.8});nextFx=t+.28}
    else nextFx=t+1;
  }
  function drawFx(dt,t){
    const [hx,hy]=pt('head');ctx.save();ctx.lineCap='round';
    if(mood==='sad'){ctx.strokeStyle='rgba(40,46,80,.5)';ctx.lineWidth=1.5;for(let i=0;i<5;i++){const x=hx-14+i*7;ctx.beginPath();ctx.moveTo(x,hy-12);ctx.lineTo(x,hy+4+(i%2)*5);ctx.stroke()}cloud(hx,hy-30,.8,'#6b7a99')}
    if(mood==='scared'){const b=S(t*12)*2;ctx.font='900 17px Barlow Condensed, sans-serif';ctx.lineWidth=3;ctx.strokeStyle='#121418';ctx.fillStyle='#fff';ctx.strokeText('!!',hx+22,hy-14+b);ctx.fillText('!!',hx+22,hy-14+b)}
    ctx.restore();
    fx=fx.filter(f=>(f.age+=dt)<f.life);
    for(const f of fx){f.x+=f.vx*dt;f.y+=f.vy*dt;f.rot+=f.vr*dt;if(f.g)f.vy+=f.g*dt;
      const a=1-f.age/f.life;ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.rot);ctx.globalAlpha=Math.min(1,a*1.6);
      if(f.k==='spark')star(6*f.s*(.6+.4*S(f.age*12)),'#fff6b0');
      else if(f.k==='coin'){ctx.fillStyle='#ffd23f';ctx.strokeStyle='#121418';ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(0,0,6*Math.abs(C(f.age*10))+.5,6,0,0,7);ctx.fill();ctx.stroke()}
      else if(f.k==='drop'){ctx.fillStyle='#7cc4ff';ctx.strokeStyle='#121418';ctx.lineWidth=1;ctx.scale(f.s,f.s);ctx.beginPath();ctx.moveTo(0,-6);ctx.quadraticCurveTo(5,2,0,5);ctx.quadraticCurveTo(-5,2,0,-6);ctx.fill();ctx.stroke()}
      else if(f.k==='puff')cloud(0,0,f.s*(1+f.age*1.5),'rgba(255,255,255,.85)');
      else if(f.k==='dust')cloud(0,0,.35*f.s*(1+f.age*2.5),'rgba(255,240,225,.8)');
      else if(f.k==='crumb'){ctx.fillStyle='#e8a14a';ctx.fillRect(-1.5,-1.5,3,3)}
      else if(f.k==='zap')star(5*f.s,'#ffe14a',4);
      else if(f.k==='text'){ctx.font='900 14px Barlow Condensed, sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#121418';ctx.strokeText(f.txt,0,0);ctx.fillStyle='#fff';ctx.fillText(f.txt,0,0)}
      else if(f.k==='bill'){const fl=S(f.age*30);ctx.fillStyle='#fff';ctx.strokeStyle='#121418';ctx.lineWidth=1;
        for(const sd of[-1,1]){ctx.save();ctx.scale(sd,1);ctx.rotate(-.3-fl*.5);ctx.beginPath();ctx.ellipse(13,-3,9,4,-.4,0,7);ctx.fill();ctx.stroke();ctx.restore()}
        if(PROP.bill.complete)ctx.drawImage(PROP.bill,-13,-8,26,16)}
      ctx.restore()}
  }
  function drawProp(t){
    if(!ev)return;const q=(t-t0)/ev.dur,e=ev.k;let n,side,fall=0,s=1,rot=0,al=1;
    if(e==='eat'){n='burger';side='handR';if(q<.25)fall=(1-ease(q/.25))*120;s=q<.42?1:Math.max(0,1-Math.floor((q-.42)/.1)*.25);if(q>.86)return}
    else if(e==='fuel'){n='fuel';side='handL';if(q<.22)fall=(1-q/.22)**2*130;if(q>.85)al=1-(q-.85)/.15}
    else if(e==='fix'){n='wrench';side='handR';if(q<.2)fall=(1-q/.2)**2*130;rot=q>.2&&q<.72?S((q-.2)*36)*.6:0;if(q>.72)return}
    else return;
    if(s<=0)return;const I=PROP[n];if(!I.complete)return;
    let [x,y]=pt(side);y-=fall;if(n==='fuel')y+=12;
    const w=n==='fuel'?26:n==='wrench'?14:24,h=n==='fuel'?32:n==='wrench'?28:22;
    ctx.save();ctx.globalAlpha=al;ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);ctx.drawImage(I,-w/2,-h/2,w,h);ctx.restore();
  }

  /* ---------- quadro ---------- */
  function frame(ms){
    const t=ms/1000,dt=Math.min(.05,Math.max(0,t-(last||t)));last=t;
    const {g,p}=target(t);setPose(p,t);
    const a=1-Math.exp(-dt*(ev?22:10));for(const key in cur)cur[key]+=(g[key]-cur[key])*a;
    const d=size();ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,W,H);
    const [fx0,fy0]=foot(),lift=cl(-cur.y/38);
    ctx.fillStyle=`rgba(0,0,0,${.22*(1-lift*.6)})`;ctx.beginPath();ctx.ellipse(fx0,fy0-2,W*.24*(1-lift*.35),5,0,0,7);ctx.fill();
    drawBody(d);ctx.setTransform(d,0,0,d,0,0);drawProp(t);ambient(t);drawFx(dt,t);
  }
  function play(kind){
    const durs={jump:1.25,eat:3,fuel:2.8,fix:2.6,loss:2};
    ev={k:kind,dur:durs[kind]||1.5};t0=performance.now()/1000;
    timers.forEach(clearTimeout);timers=[];const at=(f,fn)=>timers.push(setTimeout(fn,f*1000*ev.dur));
    if(kind==='jump'){at(.2,()=>{const [x,y]=foot();for(const sd of[-1,1])spawn({k:'dust',x:x+sd*14,y:y-4,vx:sd*45,vy:-14,life:.45})});
      at(.45,()=>{const [x,y]=pt('head');burst(8,{k:'spark',x,y,life:.8});spawn({k:'coin',x,y:y-10,vy:-60,g:120,life:1})});
      at(.82,()=>{const [x,y]=foot();for(const sd of[-1,1])spawn({k:'dust',x:x+sd*16,y:y-4,vx:sd*60,vy:-12,life:.5,s:1.2})})}
    if(kind==='eat')for(let i=0;i<6;i++)at(.45+i*.065,()=>{const [x,y]=pt('handR');spawn({k:'crumb',x,y,vx:(Math.random()-.3)*60,vy:-30,g:300,life:.7});if(i%2==0){const [hx,hy]=pt('head');spawn({k:'text',txt:'nhac',x:hx+28,y:hy-4-i*3,vy:-20,life:.5})}});
    if(kind==='fuel')at(.45,()=>{const [x,y]=pt('head');spawn({k:'puff',x:x+22,y:y+12,vx:30,vy:-8,life:.9,s:.7});spawn({k:'text',txt:'haa…',x:x+32,y:y-2,vx:20,vy:-10,life:.9})});
    if(kind==='fix')for(let i=0;i<7;i++)at(.24+i*.07,()=>{const [x,y]=pt('handR');burst(3,{k:'zap',x,y:y-8,life:.35,s:.8})});
    if(kind==='loss')at(.12,()=>{const [x,y]=pt('handR');spawn({k:'bill',x,y,vx:50,vy:-70,vr:.4,life:1.6})});
  }
  function loop(ms){if(!document.hidden&&onScreen)frame(ms);requestAnimationFrame(loop)}
  try{new IntersectionObserver(es=>{onScreen=es[0].isIntersecting}).observe(canvas)}catch(e){}
  requestAnimationFrame(loop);
  return{setMood(m){mood=m},play};
}
window.Sprite={create};
})();
