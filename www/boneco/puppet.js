/* Caixa do Corre — motoboy 2D animado em recorte (cut-out), estilo desenho/anime.
   Puppet.create(canvas, base) -> Promise<{setMood(m), play(kind), anchor(name)}>
   Princípios usados: antecipação, amassar/esticar, continuidade (follow-through),
   ação sobreposta (cabeça/braços atrasados), arcos, easing e efeitos de mangá. */
(function(){
const BOX={head:[205,113,363,304],torso:[176,232,393,514],upL:[124,298,222,380],foL:[74,304,171,380],haL:[1,319,100,380],
  hips:[196,490,379,566],thL:[177,482,289,660],shL:[129,610,261,808],thR:[288,482,392,660],shR:[310,610,440,807]};
const AX=574; // espelho do braço esquerdo para o direito (x' = AX - x)
const BONES=[ // nome, pai, pivô (coordenadas da arte original)
 ['root',null,[288,805]],['hips','root',[288,520]],['torso','hips',[288,505]],['head','torso',[283,302]],
 ['upL','torso',[208,337]],['foL','upL',[136,339]],['haL','foL',[80,345]],
 ['upR','torso',[AX-208,337]],['foR','upR',[AX-136,339]],['haR','foR',[AX-80,345]],
 ['thL','hips',[240,528]],['shL','thL',[230,650]],['thR','hips',[336,528]],['shR','thR',[346,650]]];
const IDX={};BONES.forEach((b,i)=>IDX[b[0]]=i);
// ordem de desenho (de trás pra frente)
const DRAW=[['upR','upL',1],['upL','upL',0],['hips','hips',0],['thL','thL',0],['thR','thR',0],['shL','shL',0],['shR','shR',0],
  ['torso','torso',0],['head','head',0],['foL','foL',0],['haL','haL',0],['foR','foL',1],['haR','haL',1]];
const REST={upL:[-76],foL:[-8],haL:[-6],upR:[76],foR:[8],haR:[6]};
const D2R=Math.PI/180,S=Math.sin,C=Math.cos,ease=p=>p<.5?2*p*p:1-(-2*p+2)**2/2,cl=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const env=(q,i=.15,o=.15)=>q<i?ease(q/i):q>1-o?ease((1-q)/o):1;
const lerp=(a,b,f)=>a+(b-a)*f;
/* matriz 2D [a,b,c,d,e,f] */
const mul=(m,n)=>[m[0]*n[0]+m[2]*n[1],m[1]*n[0]+m[3]*n[1],m[0]*n[2]+m[2]*n[3],m[1]*n[2]+m[3]*n[3],m[0]*n[4]+m[2]*n[5]+m[4],m[1]*n[4]+m[3]*n[5]+m[5]];
const T=(x,y)=>[1,0,0,1,x,y],R=a=>{const c=C(a),s=S(a);return[c,s,-s,c,0,0]},Sc=(x,y)=>[x,0,0,y,0,0];
const ap=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];

/* objetos (desenhos vetoriais) */
const SVG={
 burger:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-13 -12 26 24"><path d="M-11 -1 Q0 -15 11 -1z" fill="#e8a14a" stroke="#121418" stroke-width="1.4"/><circle cx="-4" cy="-6" r=".8" fill="#fff3c4"/><circle cx="2" cy="-8" r=".8" fill="#fff3c4"/><circle cx="6" cy="-5" r=".8" fill="#fff3c4"/><path d="M-12 -1 h24 l-2 3 -3-1.5 -3 1.5 -3-1.5 -3 1.5 -3-1.5 -3 1.5 -3-1.5z" fill="#62c95c" stroke="#121418" stroke-width="1"/><rect x="-11" y="2" width="22" height="4" rx="2" fill="#7a3f1f" stroke="#121418" stroke-width="1"/><path d="M-10 6 h20 v2 q0 3-3 3 h-14 q-3 0-3-3z" fill="#e8a14a" stroke="#121418" stroke-width="1.4"/></svg>',
 fuel:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -16 24 30"><rect x="-10" y="-9" width="20" height="22" rx="3" fill="#e0262e" stroke="#121418" stroke-width="1.6"/><path d="M4 -9 l5 -6" stroke="#121418" stroke-width="3.4" stroke-linecap="round"/><rect x="-6" y="-13" width="7" height="5" rx="1.5" fill="none" stroke="#121418" stroke-width="2"/><path d="M-6 -4 l12 12 M6 -4 l-12 12" stroke="#a5141b" stroke-width="2"/><rect x="-8" y="-7" width="4" height="15" rx="2" fill="#fff" opacity=".35"/></svg>',
 wrench:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -16 16 32"><path d="M0 14 V-6" stroke="#121418" stroke-width="6.4" stroke-linecap="round"/><path d="M0 14 V-6" stroke="#b9c1cc" stroke-width="3.6" stroke-linecap="round"/><path d="M-6 -9 a6.5 6.5 0 1 0 12 0 l-3.5 4 h-5z" fill="#b9c1cc" stroke="#121418" stroke-width="1.6"/></svg>',
 bill:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-13 -8 26 16"><rect x="-12" y="-7" width="24" height="14" rx="2" fill="#4fbf6f" stroke="#121418" stroke-width="1.4"/><rect x="-9" y="-4" width="18" height="8" rx="1" fill="none" stroke="#2c8a49" stroke-width="1"/><circle r="3.2" fill="#8ee0a6" stroke="#2c8a49" stroke-width="1"/></svg>'};
function svgImg(s){const i=new Image();i.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);return i}

async function create(canvas,base,opts={}){
  const ctx=canvas.getContext('2d');
  const names=['head','torso','upL','foL','haL','hips','thL','shL','thR','shR'];
  const IMG={};
  await Promise.all(names.map(n=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>{IMG[n]=i;ok()};i.onerror=no;i.src=base+'part_'+n+'.png'})));
  const PROP={};for(const k in SVG)PROP[k]=svgImg(SVG[k]);

  /* estado suavizado de cada osso: [rot(graus), dx, dy, sx, sy] */
  const cur={};BONES.forEach(b=>cur[b[0]]=[0,0,0,1,1]);
  let timers=[],mood='neutral',ev=null,t0=0,lastT=0,fx=[],nextFx=0,view=[1,0,0,1,0,0],W=1,H=1,mats=[],prop=null;

  function size(){const d=Math.min(window.devicePixelRatio||1,2),w=canvas.clientWidth,h=canvas.clientHeight;
    if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d)}
    W=w;H=h;const hr=+canvas.dataset.headroom||0,s=((h-hr)*0.97)/700;view=[s,0,0,s,w/2-288*s+w*0.04,h-6-805*s];return d}

  /* ---------- poses ---------- */
  function P(o){const r={};for(const k in o){const v=o[k];r[k]=[v[0]||0,v[1]||0,v[2]||0,v[3]===undefined?1:v[3],v[4]===undefined?1:v[4]]}return r}
  function rest(){const r={};for(const b of BONES)r[b[0]]=[(REST[b[0]]||[0])[0],0,0,1,1];return r}
  function add(a,b,f=1){for(const k in b){const x=a[k],y=b[k];x[0]+=y[0]*f;x[1]+=y[1]*f;x[2]+=y[2]*f;x[3]*=1+(y[3]-1)*f;x[4]*=1+(y[4]-1)*f}return a}
  function setAbs(a,b,f=1){for(const k in b){const x=a[k],y=b[k];for(let i=0;i<5;i++)x[i]=lerp(x[i],y[i],f)}return a}

  function moodPose(t){
    const p=rest();
    if(mood==='happy'){
      // pulinhos no ritmo, braços comemorando alternado, cabeça atrasada (ação sobreposta)
      const ph=t*5.2,h=Math.abs(S(ph)),land=Math.pow(1-h,6);
      add(p,P({root:[0,0,-h*34,1+land*.07,1-land*.09],torso:[S(ph*.5)*4],head:[S(ph*.5-.7)*7,0,land*4],
        upL:[120+S(ph)*18],foL:[-25+S(ph-.6)*20],haL:[S(ph-1)*15],upR:[-120-S(ph+Math.PI)*18],foR:[25-S(ph+Math.PI-.6)*20],haR:[-S(ph+Math.PI-1)*15],
        thL:[-4-h*6],thR:[4+h*6],shL:[h*8],shR:[-h*8]}));
      return p}
    if(mood==='sad'){
      // ombros caídos, cabeça baixa, respiração lenta e suspiro
      const br=S(t*1.1),sigh=Math.max(0,S(t*.55))**8;
      add(p,P({root:[0,0,0,1+sigh*.02,.97-sigh*.03],hips:[0,0,6],torso:[2+br*1.2,0,4+sigh*4],head:[10+br*2+sigh*4,4,14+sigh*6],
        upL:[-12],foL:[-4],haL:[-4],upR:[12],foR:[4],haR:[4],thL:[2],thR:[-2]}));
      return p}
    if(mood==='scared'){
      // tremedeira, braços pra cima balançando, joelhos batendo
      const j=S(t*47)*1.6,k=C(t*39)*1.6,fl=S(t*9);
      add(p,P({root:[0,j*1.5,0],torso:[k*.8],head:[-6+j*2,k,-4],
        upL:[131+fl*10],foL:[32+fl*16],haL:[fl*20],upR:[-131+fl*10],foR:[-32+fl*16],haR:[fl*20],
        thL:[6+j*2],thR:[-6+j*2],shL:[-8],shR:[8]}));
      return p}
    // tranquilo: respira, balança o peso, olha em volta e às vezes dá tchau
    const br=S(t*2.1),sw=S(t*.8),cyc=t%8,wave=cyc>5.2&&cyc<7.6?S((cyc-5.2)/2.4*Math.PI):0;
    add(p,P({root:[0,sw*3,0,1-br*.006,1+br*.012],hips:[sw*1.2],torso:[-sw*1.5,0,-br*1.5],head:[S(t*.9-.6)*5+sw*1.5,0,-br*1],
      upL:[br*2+sw*2],foL:[br*2],upR:[-br*2+sw*2-wave*121],foR:[-wave*(40+S(t*10)*22)],haR:[-wave*S(t*10-.8)*25],
      thL:[sw*2],thR:[sw*2]}));
    return p;
  }

  function eventPose(k,q,t,p){
    if(k==='jump'){ // antecipação → estica → voo com giro → aterrissa amassando
      if(q<.2){const a=ease(q/.2);setAbs(p,P({root:[0,0,0,1+.16*a,1-.24*a],head:[0,0,10*a],upL:[-40],foL:[-30],upR:[40],foR:[30],thL:[-8*a],thR:[8*a]}),1)}
      else if(q<.82){const a=(q-.2)/.62,h=4*a*(1-a),st=a<.25?1-a/.25:0;
        const tuck=S(cl((a-.12)/.76)*Math.PI);
        setAbs(p,P({root:[0,-h*38,-h*150,1-.1*st,1+.18*st],torso:[0],head:[-6],upL:[58-tuck*40],foL:[10+tuck*60],haL:[-10],upR:[-58+tuck*40],foR:[-10-tuck*60],haR:[10],
          thL:[-14-tuck*20],shL:[34+tuck*50],thR:[14+tuck*20],shR:[-34-tuck*50]}),1);
        p.hips[0]=-360*ease(cl((a-.12)/.76)); // mortal no ar (gira em volta do quadril)
        p.hips[2]=-60*S(cl((a-.12)/.76)*Math.PI);
      }else{const a=(q-.82)/.18,sq=S(a*Math.PI);setAbs(p,P({root:[0,0,0,1+.14*sq,1-.2*sq],head:[0,0,8*sq],upL:[45-35*sq],foL:[-10],upR:[-45+35*sq],foR:[10],thL:[-6*sq],thR:[6*sq]}),1-a*.6);p.hips[0]=-360}
    }else if(k==='eat'){ // hambúrguer cai na mão, leva até o capacete e mastiga
      const toFace=P({upR:[-118],foR:[-118],haR:[-30],head:[-6,0,0],torso:[-3]});
      if(q<.28){setAbs(p,P({upR:[-35],foR:[-70],haR:[-20]}),ease(q/.28))}
      else if(q<.42)setAbs(p,toFace,ease((q-.28)/.14));
      else if(q<.86){setAbs(p,toFace,1);const c=S((q-.42)*70);add(p,P({head:[c*5,0,Math.max(0,c)*4],foR:[c*6],root:[0,0,0,1+Math.max(0,c)*.02,1-Math.max(0,c)*.02]}))}
      else{setAbs(p,toFace,1-ease((q-.86)/.14));add(p,P({upL:[45*env((q-.86)/.14,.3,.4)],foL:[-60*env((q-.86)/.14,.3,.4)]}))}
    }else if(k==='fuel'){ // galão pesado: braço afunda, corpo inclina, suspiro
      const f=env(q,.2,.2),drop=q>.22&&q<.4?S((q-.22)/.18*Math.PI):0;
      setAbs(p,P({upL:[-88+drop*6],foL:[-4],haL:[-8],torso:[-5-drop*3,0,drop*4],hips:[0,-4],head:[8+(q>.4?Math.min(1,(q-.4)/.2)*8:0),0,6],upR:[70],root:[0,0,drop*4,1+drop*.04,1-drop*.06]}),f);
    }else if(k==='fix'){ // chave na mão, aperta girando o pulso, depois limpa a testa
      const f=env(q,.15,.15);
      if(q<.75){setAbs(p,P({upR:[-20],foR:[-95],haR:[(q>.2?S((q-.2)*36)*35:0)],torso:[3],head:[10,0,4]}),f)}
      else{const a=(q-.75)/.25;setAbs(p,P({upL:[150],foL:[-75],haL:[-30],head:[-6],upR:[60]}),env(a,.3,.35))}
    }else if(k==='loss'){ // a nota sai voando com asinhas e ele estica o braço atrás
      const f=env(q,.12,.2);
      setAbs(p,P({upR:[-30-(q<.3?q/.3*15:15)],foR:[-10],haR:[-25],torso:[6],head:[-10],upL:[-60],root:[0,6*f,0]}),f);
      if(q>.55)add(p,P({torso:[-4],head:[12,0,6],upR:[30]}),ease(cl((q-.55)/.2)));
    }
    return p;
  }

  /* ---------- efeitos de mangá ---------- */
  function spawn(o){fx.push(Object.assign({age:0,life:1,vx:0,vy:0,rot:0,vr:0,s:1},o))}
  function headPt(){return ap(mul(view,mats[IDX.head]),283,190)}
  function handPt(side){return side==='R'?ap(mul(view,mats[IDX.haR]),AX-40,350):ap(mul(view,mats[IDX.haL]),40,350)}
  function footPt(){return ap(view,288,805)}
  function burst(n,o){for(let i=0;i<n;i++){const a=Math.PI*2*i/n+Math.random()*.3,sp=60+Math.random()*50;spawn(Object.assign({vx:C(a)*sp,vy:S(a)*sp},o))}}
  function ambient(t){
    if(t<nextFx)return;const [hx,hy]=headPt();
    if(mood==='happy'){spawn({k:'spark',x:hx+(Math.random()-.5)*W*.7,y:hy+(Math.random()-.3)*H*.4,life:.9,s:.6+Math.random()*.6});nextFx=t+.35}
    else if(mood==='sad'){spawn({k:'drop',x:hx+(Math.random()-.5)*26,y:hy-38,vy:55,life:.8,s:.7});nextFx=t+.18}
    else if(mood==='scared'){spawn({k:'sweat',x:hx+(Math.random()<.5?-1:1)*22,y:hy-10,vx:(Math.random()-.5)*80,vy:-60,life:.8});nextFx=t+.3}
    else nextFx=t+1;
  }
  function drawFx(dt){
    const [hx,hy]=mats.length?headPt():[0,0];
    // símbolos fixos do humor
    ctx.save();ctx.lineCap='round';
    if(mood==='sad'){ // linhas de tristeza e nuvenzinha de chuva
      ctx.strokeStyle='rgba(40,46,80,.55)';ctx.lineWidth=1.6;
      for(let i=0;i<5;i++){const x=hx-16+i*8;ctx.beginPath();ctx.moveTo(x,hy-16);ctx.lineTo(x,hy+6+(i%2)*6);ctx.stroke()}
      cloud(hx,hy-40,.85,'#6b7a99');
    }
    if(mood==='scared'){ // "!!"
      const b=S(performance.now()/80)*2;ctx.fillStyle='#fff';ctx.strokeStyle='#121418';ctx.lineWidth=3;ctx.font='900 18px Barlow Condensed, sans-serif';
      ctx.strokeText('!!',hx+26,hy-22+b);ctx.fillText('!!',hx+26,hy-22+b);
    }
    ctx.restore();
    fx=fx.filter(f=>(f.age+=dt)<f.life);
    for(const f of fx){
      f.x+=f.vx*dt;f.y+=f.vy*dt;f.rot+=f.vr*dt;if(f.g)f.vy+=f.g*dt;
      const a=1-f.age/f.life;ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.rot);ctx.globalAlpha=Math.min(1,a*1.6);
      if(f.k==='spark')star(6*f.s*(.6+.4*S(f.age*12)),'#fff6b0');
      else if(f.k==='coin'){ctx.fillStyle='#ffd23f';ctx.strokeStyle='#121418';ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(0,0,6*Math.abs(C(f.age*10)),6,0,0,7);ctx.fill();ctx.stroke()}
      else if(f.k==='drop'||f.k==='sweat'){ctx.fillStyle='#7cc4ff';ctx.strokeStyle='#121418';ctx.lineWidth=1;ctx.scale(f.s,f.s);ctx.beginPath();ctx.moveTo(0,-6);ctx.quadraticCurveTo(5,2,0,5);ctx.quadraticCurveTo(-5,2,0,-6);ctx.fill();ctx.stroke()}
      else if(f.k==='puff')cloud(0,0,f.s*(1+f.age*1.5),'rgba(255,255,255,.9)');
      else if(f.k==='dust'){cloud(0,0,.35*f.s*(1+f.age*2.5),'rgba(255,240,225,.85)')}
      else if(f.k==='crumb'){ctx.fillStyle='#e8a14a';ctx.fillRect(-1.5,-1.5,3,3)}
      else if(f.k==='zap')star(5*f.s,'#ffe14a',4);
      else if(f.k==='text'){ctx.font='900 14px Barlow Condensed, sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#121418';ctx.strokeText(f.txt,0,0);ctx.fillStyle='#fff';ctx.fillText(f.txt,0,0)}
      else if(f.k==='bill'){const fl=S(f.age*30);ctx.fillStyle='#fff';ctx.strokeStyle='#121418';ctx.lineWidth=1;
        for(const sd of[-1,1]){ctx.save();ctx.scale(sd,1);ctx.rotate(-.3-fl*.5);ctx.beginPath();ctx.ellipse(13,-3,9,4,-.4,0,7);ctx.fill();ctx.stroke();ctx.restore()}
        if(PROP.bill.complete)ctx.drawImage(PROP.bill,-13,-8,26,16)}
      ctx.restore();
    }
  }
  function star(r,col,n=4){ctx.fillStyle=col;ctx.strokeStyle='#121418';ctx.lineWidth=1;ctx.beginPath();
    for(let i=0;i<n*2;i++){const a=i*Math.PI/n,rr=i%2?r*.35:r;ctx.lineTo(S(a)*rr,-C(a)*rr)}ctx.closePath();ctx.fill();ctx.stroke()}
  function cloud(x,y,s,col){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle=col;ctx.strokeStyle='#121418';ctx.lineWidth=1.2/s;
    ctx.beginPath();ctx.arc(-8,2,6,0,7);ctx.arc(0,-2,8,0,7);ctx.arc(9,2,6,0,7);ctx.fill();ctx.restore()}

  /* ---------- quadro ---------- */
  function frame(ms){
    const t=ms/1000,dt=Math.min(.05,Math.max(0,t-(lastT||t)));lastT=t;
    let tgt=moodPose(t),k=null,q=0;
    if(ev){q=(t-t0)/ev.dur;if(q>=1){if(ev.k==='jump')cur.hips[0]=((cur.hips[0]%360)+540)%360-180;ev=null;prop=null}else{k=ev.k;tgt=eventPose(k,q,t,tgt)}}
    const a=1-Math.exp(-dt*(k?20:9));
    for(const b of BONES){const c=cur[b[0]],g=tgt[b[0]];for(let i=0;i<5;i++)c[i]+=(g[i]-c[i])*a}
    // matrizes
    mats=[];for(const [n,par,pv] of BONES){const c=cur[n];
      let m=mul(T(pv[0]+c[1],pv[1]+c[2]),mul(R(c[0]*D2R),mul(Sc(c[3],c[4]),T(-pv[0],-pv[1]))));
      mats[IDX[n]]=par?mul(mats[IDX[par]],m):m}
    const d=size();ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,W,H);
    // sombra no chão
    const [fx0,fy0]=footPt(),lift=Math.max(0,-cur.root[2])/150;
    ctx.fillStyle=`rgba(0,0,0,${.22*(1-lift*.7)})`;ctx.beginPath();ctx.ellipse(fx0,fy0-2,W*.27*(1-lift*.4),5,0,0,7);ctx.fill();
    for(const [bn,img,mir] of DRAW){
      const m=mul(view,mats[IDX[bn]]),bx=BOX[img],I=IMG[img];
      ctx.setTransform(d*m[0],d*m[1],d*m[2],d*m[3],d*m[4],d*m[5]);
      if(mir){ctx.translate(AX,0);ctx.scale(-1,1)}
      ctx.drawImage(I,bx[0],bx[1],bx[2]-bx[0],bx[3]-bx[1]);
    }
    ctx.setTransform(d,0,0,d,0,0);
    drawProp(k,q,t);
    ambient(t);drawFx(dt);
  }
  function frameNoSmooth(t){
    let k=ev?ev.k:null,q=ev?(t-t0):0;
    mats=[];for(const [n,par,pv] of BONES){const c=cur[n];
      let m=mul(T(pv[0]+c[1],pv[1]+c[2]),mul(R(c[0]*D2R),mul(Sc(c[3],c[4]),T(-pv[0],-pv[1]))));
      mats[IDX[n]]=par?mul(mats[IDX[par]],m):m}
    const d=size();ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,W,H);
    const [fx0,fy0]=footPt();ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(fx0,fy0-2,W*.27,5,0,0,7);ctx.fill();
    for(const [bn,img,mir] of DRAW){const m=mul(view,mats[IDX[bn]]),bx=BOX[img];
      ctx.setTransform(d*m[0],d*m[1],d*m[2],d*m[3],d*m[4],d*m[5]);if(mir){ctx.translate(AX,0);ctx.scale(-1,1)}
      ctx.drawImage(IMG[img],bx[0],bx[1],bx[2]-bx[0],bx[3]-bx[1])}
    ctx.setTransform(d,0,0,d,0,0);drawProp(k,q,t);drawFx(0);
  }
  function drawProp(k,q,t){
    if(!k||!prop)return;const I=PROP[prop];if(!I.complete)return;
    let side=prop==='fuel'?'L':'R',[x,y]=handPt(side),s=1,rot=0,alpha=1;
    if(k==='eat'){if(q<.28){y-=(1-ease(q/.28))*120}s=q<.46?1:Math.max(0,1-Math.floor((q-.46)/.1)*.25)}
    else if(k==='fuel'){if(q<.22)y-=(1-q/.22)**2*130;y+=12;if(q>.85)alpha=1-(q-.85)/.15}
    else if(k==='fix'){if(q<.2)y-=(1-q/.2)**2*130;rot=q>.2&&q<.75?S((q-.2)*36)*.6:0;if(q>.75)alpha=Math.max(0,1-(q-.75)/.1)}
    else if(k==='loss')return;
    if(s<=0)return;
    const w=prop==='fuel'?28:prop==='wrench'?15:24,h=prop==='fuel'?35:prop==='wrench'?30:22;
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);ctx.drawImage(I,-w/2,-h/2,w,h);ctx.restore();
  }
  function play(kind){
    const durs={jump:1.35,eat:3,fuel:2.8,fix:2.6,loss:2};
    ev={k:kind,dur:durs[kind]||1.5};t0=performance.now()/1000;
    prop={eat:'burger',fuel:'fuel',fix:'wrench'}[kind]||null;
    timers.forEach(clearTimeout);timers=[];
    const tm=ms=>timers.push(setTimeout(ms[1],ms[0]*1000*ev.dur));
    if(kind==='jump'){tm([.2,()=>{const [x,y]=footPt();for(const sd of[-1,1])spawn({k:'dust',x:x+sd*14,y:y-4,vx:sd*45,vy:-14,life:.45})}]);
      tm([.45,()=>{const [x,y]=headPt();burst(8,{k:'spark',x,y,life:.8,s:1});spawn({k:'coin',x,y:y-10,vy:-60,g:120,life:1})}]);
      tm([.84,()=>{const [x,y]=footPt();for(const sd of[-1,1])spawn({k:'dust',x:x+sd*16,y:y-4,vx:sd*60,vy:-12,life:.5,s:1.2})}])}
    if(kind==='eat')for(let i=0;i<6;i++)tm([.48+i*.06,()=>{const [x,y]=headPt();spawn({k:'crumb',x:x+12,y:y+20,vx:(Math.random()-.3)*60,vy:-30,g:300,life:.7});if(i%2==0)spawn({k:'text',txt:'nhac',x:x+30,y:y-6-i*3,vy:-20,life:.5})}]);
    if(kind==='fuel')tm([.45,()=>{const [x,y]=headPt();spawn({k:'puff',x:x+24,y:y+14,vx:30,vy:-8,life:.9,s:.7});spawn({k:'text',txt:'haa…',x:x+34,y:y-2,vx:20,vy:-10,life:.9})}]);
    if(kind==='fix')for(let i=0;i<7;i++)tm([.25+i*.07,()=>{const [x,y]=handPt('R');burst(3,{k:'zap',x,y,life:.35,s:.8})}]);
    if(kind==='loss')tm([.15,()=>{const [x,y]=handPt('R');spawn({k:'bill',x,y,vx:55,vy:-70,vr:.4,life:1.6})}]);
  }
  function loop(ms){if(!document.hidden&&onScreen)frame(ms);requestAnimationFrame(loop)}
  let onScreen=true;try{new IntersectionObserver(es=>{onScreen=es[0].isIntersecting}).observe(canvas)}catch(e){}
  if(!opts.manual)requestAnimationFrame(loop);
  return{setMood(m){mood=m},play,get mood(){return mood},
    /* só para testes: desenha um instante exato, sem suavização */
    _at(sec,m,k,q){mood=m;ev=k?{k,dur:1}:null;t0=sec-(q||0);lastT=0;for(const b of BONES)cur[b[0]]=[0,0,0,1,1];const tg=k?eventPose(k,q,sec,moodPose(sec)):moodPose(sec);for(const b of BONES)cur[b[0]]=tg[b[0]].slice();prop=k?({eat:'burger',fuel:'fuel',fix:'wrench'}[k]||null):null;frameNoSmooth(sec)}};
}
window.Puppet={create};
})();
