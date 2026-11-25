/* Caixa do Corre — motoboy 3D animado (WebGL puro, funciona offline).
   Moto3D.create(canvas, binUrl, texUrl) -> Promise<{draw(pose), project([x,y,z], pose, bone)}>
   pose = {rot, tilt, roll, y, x, sx, sy, bones:{nome:[rx,ry,rz]}}  (radianos / unidades do modelo) */
(function(){
const BONES=[
 ['pelvis',-1,[0.11,-0.24,0.30]],['chest',0,[0.11,-0.16,0.30]],['head',1,[0.22,0.40,0.30]],
 ['armR',1,[0.40,0.30,0.30]],['foreR',3,[0.62,0.02,0.42]],['armL',1,[-0.24,0.33,0.30]],['foreL',5,[-0.42,0.02,0.40]],
 ['thighL',0,[-0.03,-0.30,0.30]],['shinL',7,[-0.15,-0.60,0.30]],['thighR',0,[0.27,-0.30,0.30]],['shinR',9,[0.36,-0.60,0.30]],
 ['handR',4,[0.61,0.19,0.56]],['fingR',11,[0.555,0.335,0.60]],['fingR2',11,[0.635,0.325,0.60]],['thumbR',11,[0.53,0.31,0.60]],
 ['handL',6,[-0.31,-0.10,0.52]]];
const NB=BONES.length;
const VS=`attribute vec3 aPos;attribute vec3 aNrm;attribute vec2 aUv;attribute float aW;attribute vec3 aCol;attribute vec2 aBi;attribute float aBw;
uniform mat4 uM;uniform mat4 uP;uniform float uOut;uniform mat4 uB[${NB}];
varying vec3 vN;varying vec2 vUv;varying float vW;varying vec3 vCol;
void main(){
 mat4 S=uB[int(aBi.x+0.5)]*aBw+uB[int(aBi.y+0.5)]*(1.0-aBw);
 vec3 n=normalize(mat3(S)*aNrm);
 vec4 p=S*vec4(aPos,1.0);p.xyz+=n*uOut;
 vec4 w=uM*p;vN=normalize(mat3(uM)*n);vUv=aUv;vW=aW;vCol=aCol;gl_Position=uP*w;}`;
const FS=`precision mediump float;
uniform sampler2D uTex;uniform float uOutline;
varying vec3 vN;varying vec2 vUv;varying float vW;varying vec3 vCol;
void main(){
 if(uOutline>0.5){gl_FragColor=vec4(0.07,0.078,0.094,1.0);return;}
 vec3 n=normalize(vN);
 vec3 L=normalize(vec3(-0.45,0.6,0.65));
 float d=max(dot(n,L),0.0);
 float toon=smoothstep(0.18,0.32,d)*0.55+smoothstep(0.62,0.75,d)*0.2;
 vec3 tex=texture2D(uTex,vUv).rgb;
 vec3 base=mix(vCol,tex,vW);
 float lit=mix(0.58+toon*0.75,0.9+d*0.16,vW);
 float rim=pow(1.0-max(n.z,0.0),3.0)*0.18;
 gl_FragColor=vec4(base*lit+rim,1.0);
}`;
function mul(a,b){const o=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];o[i*4+j]=s}return o}
function rotY(t){const c=Math.cos(t),s=Math.sin(t);return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1])}
function rotX(t){const c=Math.cos(t),s=Math.sin(t);return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1])}
function rotZ(t){const c=Math.cos(t),s=Math.sin(t);return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1])}
function scl(x,y,z){return new Float32Array([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1])}
function tr(x,y,z){return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1])}
function model(p){
  let m=tr(p.x||0,(p.y||0)-0.95,0);
  m=mul(m,scl(p.sx||1,p.sy||1,p.sx||1));
  m=mul(m,tr(0,0.95,0));
  m=mul(m,rotZ(p.roll||0));m=mul(m,rotX(p.tilt||0));m=mul(m,rotY(p.rot||0));
  return m;
}
/* matrizes de cada osso (espaço do modelo): pai * T(pivô) * R * T(-pivô) */
function skeleton(bones){
  const out=new Array(NB),flat=new Float32Array(NB*16);
  for(let i=0;i<NB;i++){
    const [name,par,pv]=BONES[i],r=(bones&&bones[name])||[0,0,0];
    let m=tr(pv[0],pv[1],pv[2]);
    m=mul(m,rotY(r[1]));m=mul(m,rotX(r[0]));m=mul(m,rotZ(r[2]));
    m=mul(m,tr(-pv[0],-pv[1],-pv[2]));
    out[i]=par<0?m:mul(out[par],m);flat.set(out[i],i*16);
  }
  return{mats:out,flat};
}
function ortho(asp){const h=1.2,w=h*asp;return new Float32Array([1/w,0,0,0, 0,1/h,0,0, 0,0,-0.4,0, 0,-0.02,0,1])}
function sh(gl,t,src){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(s);return s}

async function create(canvas,binUrl,texUrl){
  const gl=canvas.getContext('webgl',{antialias:true,alpha:true,premultipliedAlpha:true});
  if(!gl)throw new Error('sem webgl');
  const [buf,img]=await Promise.all([
    fetch(binUrl).then(r=>{if(!r.ok)throw new Error('bin');return r.arrayBuffer()}),
    new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=texUrl})]);
  const h=new Uint32Array(buf,0,3);if(h[0]!==0x32544f4d)throw new Error('formato');
  const nV=h[1],nF=h[2];let o=12;
  const pos=new Int16Array(buf,o,nV*3);o+=nV*6;
  const uv=new Uint16Array(buf,o,nV*2);o+=nV*4;
  const idx=new Uint16Array(buf,o,nF*3);o+=nF*6;
  const nrm=new Int8Array(buf,o,nV*3);o+=nV*3;
  const w=new Uint8Array(buf,o,nV);o+=nV;
  const col=new Uint8Array(buf,o,nV*3);o+=nV*3;
  const bi=new Uint8Array(buf,o,nV*2);o+=nV*2;
  const bw=new Uint8Array(buf,o,nV);
  const pr=gl.createProgram();gl.attachShader(pr,sh(gl,gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw gl.getProgramInfoLog(pr);
  gl.useProgram(pr);
  function attr(name,data,size,type,norm){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    const l=gl.getAttribLocation(pr,name);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,size,type,norm,0,0)}
  attr('aPos',pos,3,gl.SHORT,true);attr('aNrm',nrm,3,gl.BYTE,true);attr('aUv',uv,2,gl.UNSIGNED_SHORT,true);
  attr('aW',w,1,gl.UNSIGNED_BYTE,true);attr('aCol',col,3,gl.UNSIGNED_BYTE,true);
  attr('aBi',bi,2,gl.UNSIGNED_BYTE,false);attr('aBw',bw,1,gl.UNSIGNED_BYTE,true);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const U={M:gl.getUniformLocation(pr,'uM'),P:gl.getUniformLocation(pr,'uP'),Out:gl.getUniformLocation(pr,'uOut'),Ol:gl.getUniformLocation(pr,'uOutline'),T:gl.getUniformLocation(pr,'uTex'),B:gl.getUniformLocation(pr,'uB')};
  gl.uniform1i(U.T,0);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
  function size(){const d=Math.min(window.devicePixelRatio||1,3),W=Math.round(canvas.clientWidth*d),H=Math.round(canvas.clientHeight*d);
    if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H}return W/H}
  let last=null;
  function draw(p){
    const asp=size();gl.viewport(0,0,canvas.width,canvas.height);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    last=skeleton(p.bones);
    gl.uniformMatrix4fv(U.B,false,last.flat);
    gl.uniformMatrix4fv(U.M,false,model(p));gl.uniformMatrix4fv(U.P,false,ortho(asp));
    gl.cullFace(gl.FRONT);gl.uniform1f(U.Out,0.016);gl.uniform1f(U.Ol,1);gl.drawElements(gl.TRIANGLES,nF*3,gl.UNSIGNED_SHORT,0);
    gl.cullFace(gl.BACK);gl.uniform1f(U.Out,0);gl.uniform1f(U.Ol,0);gl.drawElements(gl.TRIANGLES,nF*3,gl.UNSIGNED_SHORT,0);
  }
  /* posição na tela de um ponto do modelo, seguindo o osso (mão, viseira) */
  function project(v,p,bone){
    let q=v;
    if(bone){const i=BONES.findIndex(b=>b[0]===bone),sk=last||skeleton(p.bones),b=sk.mats[i];
      q=[b[0]*v[0]+b[4]*v[1]+b[8]*v[2]+b[12],b[1]*v[0]+b[5]*v[1]+b[9]*v[2]+b[13],b[2]*v[0]+b[6]*v[1]+b[10]*v[2]+b[14]]}
    const mp=mul(ortho(canvas.clientWidth/canvas.clientHeight),model(p));
    const x=mp[0]*q[0]+mp[4]*q[1]+mp[8]*q[2]+mp[12],y=mp[1]*q[0]+mp[5]*q[1]+mp[9]*q[2]+mp[13];
    return{x:(x+1)/2*canvas.clientWidth,y:(1-y)/2*canvas.clientHeight};
  }
  return{draw,project};
}
window.Moto3D={create};
})();
