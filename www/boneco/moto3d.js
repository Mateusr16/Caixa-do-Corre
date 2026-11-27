/* Caixa do Corre — motoboy 3D animado (modelo e animações feitos no Blender).
   Carrega boneco/motoboy_app.glb e troca de animação com transição suave (crossfade).
   window.Moto3D.create(canvas) -> Promise<{setMood(m), play(kind)}> */
import * as THREE from 'three';
import { GLTFLoader } from '../lib/GLTFLoader.js';

const MOOD = { neutral: 'Parado', happy: 'Feliz', sad: 'Triste', scared: 'Assustado' };
const EVENT = { jump: 'Pulo', eat: 'Comendo', fuel: 'Gasolina', fix: 'Manutencao', loss: 'Nota' };

/* objetos que aparecem na mão durante a reação */
function makeProps() {
  const m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: .6 });
  const g = {};
  const burger = new THREE.Group();
  const bun = new THREE.Mesh(new THREE.SphereGeometry(.07, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m(0xe8a14a));
  bun.position.y = .02; burger.add(bun);
  const meat = new THREE.Mesh(new THREE.CylinderGeometry(.072, .072, .025, 20), m(0x6b3a1e)); burger.add(meat);
  const leaf = new THREE.Mesh(new THREE.CylinderGeometry(.078, .078, .008, 20), m(0x62c95c)); leaf.position.y = .016; burger.add(leaf);
  const bot = new THREE.Mesh(new THREE.CylinderGeometry(.068, .065, .03, 20), m(0xe8a14a)); bot.position.y = -.026; burger.add(bot);
  g.Comendo = burger;
  const can = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.16, .2, .09), m(0xd8262d)); body.position.y = -.12; can.add(body);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .08), m(0x222222)); spout.position.set(.05, .0, 0); spout.rotation.z = -.6; can.add(spout);
  g.Gasolina = can;
  const wr = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(.03, .22, .015), m(0xb9c1cc)); bar.position.y = .08; wr.add(bar);
  const head = new THREE.Mesh(new THREE.TorusGeometry(.03, .012, 8, 16, Math.PI * 1.5), m(0xb9c1cc)); head.position.y = .2; wr.add(head);
  g.Manutencao = wr;
  const bill = new THREE.Mesh(new THREE.PlaneGeometry(.16, .08), new THREE.MeshStandardMaterial({ color: 0x4fbf6f, side: THREE.DoubleSide }));
  g.Nota = bill;
  Object.values(g).forEach(o => { o.visible = false; o.traverse(x => { if (x.isMesh) x.castShadow = false; }); });
  return g;
}

async function create(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(26, 1, .1, 50);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x553322, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd0b0, 1.2); rim.position.set(3, 2, -3); scene.add(rim);

  const gltf = await new GLTFLoader().loadAsync('boneco/motoboy_app.glb');
  const model = gltf.scene; scene.add(model);
  model.rotation.y = -0.35;               // 3/4, olhando pra quem usa o app
  model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(model);
  const clips = {};
  for (const c of gltf.animations) clips[c.name.replace(/^MB_/, '')] = c;
  // pulo um pouco mais baixo, pra caber no topo do app
  for (const n of ['Pulo', 'Feliz']) for (const tr of (clips[n] ? clips[n].tracks : []))
    if (/root\.position$/.test(tr.name)) for (let i = 1; i < tr.values.length; i += 3) if (tr.values[i] > 0) tr.values[i] *= n === 'Pulo' ? .55 : .8;
  const act = (n) => clips[n] ? mixer.clipAction(clips[n]) : null;

  // objetos presos nos ossos das mãos
  const props = makeProps();
  const bone = (n) => { let b = null; model.traverse(o => { if (o.isBone && [n, n.replace('.', ''), n.replace('.', '_')].includes(o.name)) b = o; }); return b; };
  const hR = bone('hand.R'), hL = bone('hand.L');
  for (const [k, p] of Object.entries(props)) {
    const tgt = k === 'Gasolina' ? hL : hR; if (!tgt) continue;
    tgt.add(p); p.position.set(0, .11, -.02);
  }

  let mood = 'neutral', loopAct = act('Parado'), evAct = null, evName = null;
  if (loopAct) loopAct.play();
  function toLoop(name, fade = .45) {
    const a = act(name); if (!a || a === loopAct) return;
    a.reset().setEffectiveWeight(1).play();
    if (!evAct) loopAct.crossFadeTo(a, fade, false); else loopAct.stop();
    loopAct = a;
  }
  function play(kind) {
    const name = EVENT[kind]; const a = act(name); if (!a) return;
    if (evAct) evAct.fadeOut(.15);
    Object.values(props).forEach(p => p.visible = false);
    if (props[name]) props[name].visible = true;
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.setEffectiveWeight(1);
    a.play(); (evAct || loopAct).crossFadeTo(a, .18, false);
    evAct = a; evName = name;
  }
  mixer.addEventListener('finished', (e) => {
    if (e.action !== evAct) return;
    loopAct.reset().play(); evAct.crossFadeTo(loopAct, .35, false);
    const done = evName; evAct = null; evName = null;
    setTimeout(() => { if (!evName && props[done]) props[done].visible = false; }, 300);
  });

  // a nota sai voando da mão
  let billFly = 0;
  const box = { min: new THREE.Vector3(0, 0, 0) }, h = 1.92; // altura do boneco no Blender (m)
  function frameCam() {
    const w = canvas.clientWidth, hh = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(hh * renderer.getPixelRatio())) renderer.setSize(w, hh, false);
    cam.aspect = w / hh;
    const dist = (h * 1.36) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    cam.position.set(0, h * .62, dist); cam.lookAt(0, h * .58, 0); cam.updateProjectionMatrix();
  }
  const clock = new THREE.Clock(); let onScreen = true;
  try { new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }).observe(canvas); } catch (e) {}
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), .05);
    if (document.hidden || !onScreen) return;
    frameCam(); mixer.update(dt);
    if (evName === 'Nota' && evAct) {
      const t = evAct.time / clips.Nota.duration, p = props.Nota;
      if (t > .25) { p.position.set(0, .11 + (t - .25) * 1.2, -(t - .25) * .6); p.rotation.set(t * 9, t * 6, t * 4); p.visible = t < .8; }
      else { p.position.set(0, .11, -.02); p.rotation.set(0, 0, 0); }
    }
    renderer.render(scene, cam);
  }
  loop();
  return { setMood(m) { mood = m; toLoop(MOOD[m] || 'Parado'); }, play, get mood() { return mood; } };
}
window.Moto3D = { create };
window.dispatchEvent(new Event('moto3d-ready'));
