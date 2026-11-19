/* Kopie aus gitlab.uni-bayreuth.de/bt150952/geoecology (js/sampling-3d.js, Commit e087a04), Beschriftungen deutsch.
   Aenderungen an Geometrie oder Ablauf bitte zuerst im geoecology-Repo machen und hierher uebernehmen. */
(function(){
const host=document.getElementById('three');
if(!window.THREE||!THREE.OrbitControls){host.innerHTML='<p class="fallback">Die 3D-Ansicht konnte in diesem Browser nicht geladen werden.</p>';return;}

/* Units: 1 = 1 cm. Ring 250 cm³: inner radius 4, height 5 */
const RI=4, RO=4.25, RH=5, LIFT=16, TRENCH_R=9, TRENCH_D=7;
const LAYERS=[
  {name:'Obere Schicht', depth:'0–5 cm', x:-22, s:0, hz:0, tray:-30},
  {name:'Mittlere Schicht', depth:'20–25 cm', x:1, s:-20, hz:1, tray:-22},
  {name:'Tiefe Schicht', depth:'45–50 cm', x:23, s:-45, hz:2, tray:-14}
];
const PHASES=[
  {d:2.5, short:'Freilegen', title:'Stelle vorbereiten', text:i=>i===0?'Streu und Pflanzen werden entfernt, die Oberfläche wird vorsichtig eingeebnet. Der Stechzylinder wird mit der Schneide nach unten aufgesetzt.':`Eine Grube ist bis ${i===1?'20':'45'} cm Tiefe ausgehoben. Auf der Grubensohle wird der Stechzylinder mit der Schneide nach unten aufgesetzt.`},
  {d:5, short:'Pressen', title:'Langsam einpressen', text:()=>'Die eigens gebaute Hydraulikpresse drückt den Stechzylinder senkrecht, langsam und gleichmäßig in den Boden, bis er bündig mit der Oberfläche abschließt. Ohne Hammer: Schläge erzeugen seitliche Risse.'},
  {d:1.5, short:'Abnehmen', title:'Presse abnehmen', text:()=>'Die Presse wird abgehoben. Im Zylinder steckt jetzt ein ungestörter Bodenkern.'},
  {d:4, short:'Freigraben', title:'Zylinder freigraben', text:()=>'Der Boden rund um den Zylinder wird mit Messer oder Kelle entfernt, bis etwas unter die Unterkante des Zylinders.'},
  {d:2.5, short:'Platte', title:'Platte unterschieben', text:()=>'Eine flache Platte wird unter den Zylinder geschoben. Sie trennt den Kern vom Untergrund und hält ihn von unten.'},
  {d:2.5, short:'Heben', title:'Herausheben', text:()=>'Zylinder, Kern und Platte kommen gemeinsam heraus, ohne dass die Probe kippt oder gequetscht wird.'},
  {d:3, short:'Verschließen', title:'Abstreichen, verschließen, beschriften', text:()=>'Überstehender Boden wird bündig abgestrichen, beide Enden werden mit Deckeln verschlossen, der Zylinder wird mit Standort, Tiefe und Datum beschriftet.'}
];
const PER=PHASES.reduce((a,p)=>a+p.d,0), TOTAL=PER*LAYERS.length, HOLD=2;

const ease=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
const clamp=t=>Math.max(0,Math.min(1,t));

/* Renderer, scene, camera */
const renderer=new THREE.WebGLRenderer({antialias:true,stencil:true});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(35,1,1,1000);
const controls=new THREE.OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.enablePan=false;
controls.minDistance=40; controls.maxDistance=230;
controls.minPolarAngle=0.35; controls.maxPolarAngle=1.35;
controls.minAzimuthAngle=-0.05; controls.maxAzimuthAngle=1.45;
const target0=new THREE.Vector3(LAYERS[0].x,LAYERS[0].s+9,0);
controls.target.copy(target0);
camera.position.copy(target0).add(new THREE.Vector3(74,54,106).multiplyScalar(0.78)); /* im schmaleren Lab-Rahmen naeher ran als im geoecology-Original */

function setBg(){scene.background=new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--scene').trim()||'#e6ece8'); dirty=true;}
let dirty=true;
setBg();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',setBg);
new MutationObserver(setBg).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

scene.add(new THREE.HemisphereLight(0xffffff,0x7a6a58,0.85));
const sun=new THREE.DirectionalLight(0xffffff,0.75);
sun.position.set(50,110,70); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,near:10,far:300});
scene.add(sun);

/* Soil textures */
function soilTex(base,specks,extra){
  const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d');
  g.fillStyle=base; g.fillRect(0,0,256,256);
  for(let i=0;i<2600;i++){g.fillStyle=specks[i%specks.length]; const r=Math.random()*1.8+0.4; g.globalAlpha=0.35+Math.random()*0.4; g.beginPath(); g.arc(Math.random()*256,Math.random()*256,r,0,7); g.fill();}
  g.globalAlpha=1; if(extra) extra(g);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,2); return t;
}
const HZ=[
  {top:0, bot:-15, label:'A · Oberboden', tex:soilTex('#3d2c1f',['#2a1d14','#55402d','#1e150e'])},
  {top:-15, bot:-40, label:'B · Unterboden', tex:soilTex('#7d5433',['#6a4528','#93643c','#a8662e'],g=>{for(let i=0;i<40;i++){g.fillStyle='rgba(176,98,40,.55)';g.beginPath();g.ellipse(Math.random()*256,Math.random()*256,4+Math.random()*8,2+Math.random()*4,Math.random()*3,0,7);g.fill();}})},
  {top:-40, bot:-62, label:'C · Ausgangsgestein', tex:soilTex('#b39a70',['#9f875e','#c4ad84','#8d7a5c'],g=>{for(let i=0;i<30;i++){g.fillStyle='#8b857a';g.beginPath();g.arc(Math.random()*256,Math.random()*256,2+Math.random()*5,0,7);g.fill();}})}
];
HZ.forEach(h=>{
  h.side=new THREE.MeshStandardMaterial({map:h.tex,roughness:1});
  h.topMat=new THREE.MeshStandardMaterial({map:h.tex,roughness:1,stencilWrite:true,stencilRef:1,stencilFunc:THREE.NotEqualStencilFunc,stencilFail:THREE.KeepStencilOp,stencilZFail:THREE.KeepStencilOp,stencilZPass:THREE.KeepStencilOp});
  h.wall=new THREE.MeshStandardMaterial({map:h.tex,roughness:1,color:0xd8d0c8,side:THREE.BackSide});
  h.floor=new THREE.MeshStandardMaterial({map:h.tex,roughness:1,color:0xb4aca3});
});

/* Stepped soil block: surface, pit floor at 20 cm, pit floor at 45 cm */
const REGIONS=[{x0:-35,x1:-10,top:0},{x0:-10,x1:12,top:-20},{x0:12,x1:35,top:-45}];
const Z0=-25, Z1=25;
REGIONS.forEach(r=>HZ.forEach(h=>{
  const top=Math.min(h.top,r.top), bot=h.bot; if(top<=bot) return;
  const geo=new THREE.BoxGeometry(r.x1-r.x0,top-bot,Z1-Z0);
  const topMat=top===r.top?h.topMat:h.side;
  const m=new THREE.Mesh(geo,[h.side,h.side,topMat,h.side,h.side,h.side]);
  m.position.set((r.x0+r.x1)/2,(top+bot)/2,0); m.receiveShadow=true; scene.add(m);
}));

/* Grass on the surface, cleared around the sampling spot */
(function(){
  const geo=new THREE.ConeGeometry(0.22,1,4); geo.translate(0,0.5,0);
  const mat=new THREE.MeshStandardMaterial({color:0x5f8a3c,roughness:0.9});
  const N=1100, inst=new THREE.InstancedMesh(geo,mat,N), m=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler();
  let k=0;
  while(k<N){
    const x=-35+Math.random()*25, z=Z0+Math.random()*(Z1-Z0);
    if(Math.hypot(x-LAYERS[0].x,z)<12) continue;
    if(z<-13&&x>-34&&x<-10) continue;
    e.set((Math.random()-0.5)*0.5,Math.random()*3,(Math.random()-0.5)*0.5); q.setFromEuler(e);
    const h=1.2+Math.random()*2.2;
    m.compose(new THREE.Vector3(x,0,z),q,new THREE.Vector3(1,h,1)); inst.setMatrixAt(k++,m);
  }
  scene.add(inst);
})();

/* Horizon labels on the profile face */
function label(text){
  const c=document.createElement('canvas'); c.width=512; c.height=112; const g=c.getContext('2d');
  g.fillStyle='rgba(255,255,255,0.88)'; g.beginPath(); g.moveTo(24,8); g.arcTo(504,8,504,104,22); g.arcTo(504,104,8,104,22); g.arcTo(8,104,8,8,22); g.arcTo(8,8,504,8,22); g.fill();
  g.fillStyle='#1b2420'; g.font='600 46px "Source Sans 3", "Segoe UI", sans-serif'; g.textBaseline='middle'; g.fillText(text,32,58);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthWrite:false,depthTest:false}));
  sp.renderOrder=10; sp.scale.set(15,3.3,1); sp.center.set(0,0.5); return sp;
}
HZ.forEach((h,k)=>{const sp=label(h.label); sp.position.set([-31,-7,15][k],[-7.5,-30,-53][k],Z1+1); scene.add(sp);});

/* Wooden tray for finished samples */
const tray=new THREE.Mesh(new THREE.BoxGeometry(24,1,8),new THREE.MeshStandardMaterial({color:0xa07a4c,roughness:0.8}));
tray.position.set(-22,0.5,-18); tray.castShadow=tray.receiveShadow=true; scene.add(tray);

/* Shared materials */
const steel=new THREE.MeshStandardMaterial({color:0xd8dde1,metalness:0.35,roughness:0.35,side:THREE.DoubleSide});
const capMat=new THREE.MeshStandardMaterial({color:0x2f6fa3,roughness:0.5});
const plateMat=new THREE.MeshStandardMaterial({color:0xaab2b9,metalness:0.3,roughness:0.4});
const white=new THREE.MeshStandardMaterial({color:0xf5f5f0,roughness:0.7});
const mask=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,stencilWrite:true,stencilRef:1,stencilFunc:THREE.AlwaysStencilFunc,stencilZPass:THREE.ReplaceStencilOp});

const ringGeo=new THREE.LatheGeometry([new THREE.Vector2(RI,0),new THREE.Vector2(RO,0.9),new THREE.Vector2(RO,RH),new THREE.Vector2(RI,RH),new THREE.Vector2(RI,0)],64);
const unitCyl=new THREE.CylinderGeometry(1,1,1,48); unitCyl.translate(0,0.5,0);
const unitWall=new THREE.CylinderGeometry(1,1,1,48,1,true); unitWall.translate(0,-0.5,0);
const unitDisk=new THREE.CircleGeometry(1,48); unitDisk.rotateX(-Math.PI/2);

/* One site (static: hole, trench, stub) and one sample (moving: ring, core, plate, caps) per layer */
LAYERS.forEach(L=>{
  const h=HZ[L.hz];
  const site=new THREE.Group(); site.position.set(L.x,L.s,0); scene.add(site);
  L.mask=new THREE.Mesh(unitDisk,mask); L.mask.position.y=0.02; L.mask.renderOrder=-1; site.add(L.mask);
  L.wall=new THREE.Mesh(unitWall,h.wall); site.add(L.wall);
  L.floor=new THREE.Mesh(unitDisk,h.floor); L.floor.receiveShadow=true; site.add(L.floor);
  L.stub=new THREE.Mesh(unitCyl,[h.side,h.side,h.side]); L.stub.scale.set(RI-0.05,1,RI-0.05); site.add(L.stub);
  L.spoil=[[2,-12.5],[-3.5,-13],[6,-11.5]].map(([x,z])=>{const m=new THREE.Mesh(new THREE.DodecahedronGeometry(2.6,1),h.side); m.position.set(x,0,z); m.scale.set(1,0.45,1); m.castShadow=true; site.add(m); return m;});
  L.site=site;

  const smp=new THREE.Group(); scene.add(smp);
  L.ring=new THREE.Mesh(ringGeo,steel); L.ring.castShadow=true; smp.add(L.ring);
  L.core=new THREE.Mesh(unitCyl,[h.side,h.topMat===null?h.side:new THREE.MeshStandardMaterial({map:h.tex,roughness:1}),h.side]);
  L.core.scale.set(RI-0.02,RH,RI-0.02); smp.add(L.core);
  L.plate=new THREE.Mesh(new THREE.BoxGeometry(12,0.3,12),plateMat); L.plate.castShadow=true; smp.add(L.plate);
  L.capT=new THREE.Mesh(new THREE.CylinderGeometry(RO+0.25,RO+0.25,0.8,48),capMat); L.capT.position.y=0.4; smp.add(L.capT);
  L.capB=new THREE.Mesh(new THREE.CylinderGeometry(RO+0.25,RO+0.25,0.8,48),capMat); L.capB.position.y=-RH-0.4; smp.add(L.capB);
  L.tag=new THREE.Mesh(new THREE.BoxGeometry(3.2,1.8,0.12),white); L.tag.position.set(0,-2.5,RO+0.07); smp.add(L.tag);
  [L.capT,L.capB].forEach(c=>c.castShadow=true);
  L.smp=smp;
});

/* Eigenbau-Hydraulikpresse (Platzhalter, bis das Foto da ist) */
const press=new THREE.Group(); scene.add(press);
const frameMat=new THREE.MeshStandardMaterial({color:0x55616c,metalness:0.2,roughness:0.55});
const hydMat=new THREE.MeshStandardMaterial({color:0xe0a526,metalness:0.2,roughness:0.45});
const chrome=new THREE.MeshStandardMaterial({color:0xeef1f3,metalness:0.4,roughness:0.2});
function pm(geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;press.add(m);return m;}
[-15,15].forEach(z=>{pm(new THREE.BoxGeometry(7,1,7),frameMat,0,0.5,z);pm(new THREE.BoxGeometry(2.6,44,2.6),frameMat,0,22,z);});
pm(new THREE.BoxGeometry(5,4,35),frameMat,0,45,0);
pm(new THREE.CylinderGeometry(3,3,13,32),hydMat,0,36.5,0);
pm(new THREE.CylinderGeometry(3.4,3.4,1.2,32),frameMat,0,43,0);
const rod=pm(new THREE.CylinderGeometry(1.1,1.1,1,24),chrome,0,0,0);
const holder=pm(new THREE.CylinderGeometry(4.7,4.7,1.6,48),frameMat,0,0,0);
pm(new THREE.BoxGeometry(5,4,7),hydMat,9,2,19);
const lever=pm(new THREE.CylinderGeometry(0.35,0.35,10,12),frameMat,9,8,19); lever.rotation.z=0.5;
const hose=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(9,4,17),new THREE.Vector3(10,14,13),new THREE.Vector3(5,34,6),new THREE.Vector3(2.5,40,2.6)]),40,0.45,8),new THREE.MeshStandardMaterial({color:0x222222,roughness:0.6}));
press.add(hose);

/* Trowel for digging */
const trowel=new THREE.Group(); scene.add(trowel);
const blade=new THREE.Mesh(new THREE.BoxGeometry(0.25,5,3),plateMat); blade.position.y=2.5; trowel.add(blade);
const handle=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,5,12),new THREE.MeshStandardMaterial({color:0x7a4a2a,roughness:0.8})); handle.position.y=7.5; trowel.add(handle);
trowel.children.forEach(c=>c.castShadow=true);

/* Timeline */
function locate(T){
  const t=Math.min(T,TOTAL-1e-6);
  const i=Math.min(LAYERS.length-1,Math.floor(t/PER)); let tl=t-i*PER, j=0;
  while(j<PHASES.length-1&&tl>=PHASES[j].d){tl-=PHASES[j].d;j++;}
  return {i,j,u:clamp(tl/PHASES[j].d),local:t-i*PER};
}
function sampleState(j,u){
  const s={vis:true,drop:0,ringY:-RH,dig:1,plate:0,lift:0,cap:0,tray:0};
  if(j===0){s.vis=u>0.35;s.drop=14*(1-ease((u-0.35)/0.55));s.ringY=0;s.dig=0;}
  else if(j===1){s.ringY=-RH*ease((u-0.22)/0.72);s.dig=0;}
  else if(j===2){s.dig=0;}
  else if(j===3){s.dig=ease(u);}
  else if(j===4){s.plate=ease(u);}
  else if(j===5){s.plate=1;s.lift=ease(u);}
  else {s.plate=1-ease(u/0.4);s.lift=1;s.cap=ease(u/0.45);s.tray=ease((u-0.45)/0.55);}
  return s;
}
const DONE={vis:true,drop:0,ringY:-RH,dig:1,plate:0,lift:1,cap:1,tray:1};
const FRESH={vis:false,drop:0,ringY:0,dig:0,plate:0,lift:0,cap:0,tray:0};

function applySample(L,s){
  const r=4.4+(TRENCH_R-4.4)*s.dig, d=0.4+(TRENCH_D-0.4)*s.dig, dug=s.dig>0;
  L.mask.visible=L.wall.visible=L.floor.visible=dug;
  L.mask.scale.set(r,1,r); L.wall.scale.set(r,d,r); L.floor.scale.set(r,1,r); L.floor.position.y=-d;
  const stubH=d-RH; L.stub.visible=dug&&stubH>0.05; L.stub.scale.y=Math.max(stubH,0.01); L.stub.position.y=-d;
  L.spoil.forEach((m,k)=>{const e=clamp(s.dig*1.4-k*0.2); m.visible=e>0; m.scale.set(e,0.45*e,e);});
  const smp=L.smp; smp.visible=s.vis;
  const sitePos=new THREE.Vector3(L.x,L.s+LIFT*s.lift,0), trayPos=new THREE.Vector3(L.tray,1+RH+0.8,-18);
  smp.position.lerpVectors(sitePos,trayPos,s.tray); smp.position.y+=Math.sin(Math.PI*s.tray)*10;
  L.ring.position.y=s.ringY+s.drop;
  L.core.visible=dug; L.core.position.y=s.ringY;
  L.plate.visible=s.plate>0.001; L.plate.position.set(0,-RH-0.15,16*(1-Math.min(1,s.plate*1.0001)));
  if(s.cap>0&&s.plate<1){L.plate.position.z=0; L.plate.scale.set(Math.max(s.plate,0.001),1,Math.max(s.plate,0.001));} else L.plate.scale.set(1,1,1);
  const c=Math.max(s.cap,0.001); [L.capT,L.capB].forEach(m=>{m.visible=s.cap>0;m.scale.set(c,1,c);});
  L.tag.visible=s.cap>0.5; L.tag.scale.setScalar(Math.max(0.001,(s.cap-0.5)*2));
}

let T=0, playing=!window.matchMedia('(prefers-reduced-motion: reduce)').matches, speed=1, lastIdx=-1, lastPhase=-1;
const tgt=new THREE.Vector3();
function apply(){
  const {i,j,u,local}=locate(T);
  LAYERS.forEach((L,k)=>applySample(L,k<i?DONE:k>i?FRESH:sampleState(j,u)));
  const L=LAYERS[i];
  /* press */
  let pv=false, off=0, ringY=0;
  if(j===1){pv=true; off=46*(1-ease(u/0.2)); ringY=-RH*ease((u-0.22)/0.72);}
  else if(j===2){pv=u<1; off=46*ease(u); ringY=-RH;}
  else if(j===0){pv=u>0.85; off=46; ringY=0;}
  press.visible=pv; press.position.set(L.x,L.s+off,0);
  const holderY=ringY+RH+0.8; holder.position.y=holderY;
  const rodBot=holderY+0.8, rodTop=30; rod.scale.y=Math.max(rodTop-rodBot,0.1); rod.position.y=(rodTop+rodBot)/2;
  /* trowel */
  trowel.visible=j===3;
  if(j===3){const a=u*Math.PI*3, rr=4.4+(TRENCH_R-4.4)*ease(u)-1.2, dd=0.4+(TRENCH_D-0.4)*ease(u);
    trowel.position.set(L.x+Math.cos(a)*rr,L.s-dd*0.6+0.5*Math.sin(u*40),Math.sin(a)*rr); trowel.rotation.set(0,-a,0.35);}
  /* camera follows the active layer */
  const prev=LAYERS[Math.max(0,i-1)], e=i>0?ease(local/1.5):1;
  tgt.set(prev.x+(L.x-prev.x)*e, prev.s+9+(L.s-prev.s)*e, 0);
  const delta=tgt.clone().sub(controls.target); controls.target.add(delta); camera.position.add(delta);
  /* captions and controls */
  if(i!==lastIdx||j!==lastPhase){
    lastIdx=i; lastPhase=j;
    document.getElementById('capMeta').textContent=`${L.name} · ${L.depth} · Schritt ${j+1} von ${PHASES.length}`;
    document.getElementById('capTitle').textContent=PHASES[j].title;
    document.getElementById('capText').textContent=PHASES[j].text(i);
    layerBtns.forEach((b,k)=>b.setAttribute('aria-pressed',String(k===i)));
    stepBtns.forEach((b,k)=>{if(k===j)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  }
  scrub.value=String(Math.min(T,TOTAL));
  dirty=true;
}

/* UI */
const layersEl=document.getElementById('layers'), stepsEl=document.getElementById('steps'), scrub=document.getElementById('scrub');
layersEl.innerHTML=LAYERS.map((L,k)=>`<button data-k="${k}" aria-pressed="false">${L.name}</button>`).join('');
stepsEl.innerHTML=PHASES.map((p,k)=>`<button data-k="${k}" title="${p.title}">${k+1} ${p.short}</button>`).join('');
const layerBtns=[...layersEl.children], stepBtns=[...stepsEl.children];
scrub.max=String(TOTAL);
const playBtn=document.getElementById('play'), speedBtn=document.getElementById('speed');
function setPlaying(p){playing=p; playBtn.textContent=p?'Pause':'Abspielen'; playBtn.setAttribute('aria-pressed',String(!p));}
setPlaying(playing);
playBtn.addEventListener('click',()=>{if(!playing&&T>=TOTAL)T=0; setPlaying(!playing);});
speedBtn.addEventListener('click',()=>{speed=speed===1?2:speed===2?0.5:1; speedBtn.textContent=(speed===0.5?'½':speed)+'×';});
layersEl.addEventListener('click',e=>{const b=e.target.closest('button'); if(!b)return; T=Number(b.dataset.k)*PER; apply();});
stepsEl.addEventListener('click',e=>{const b=e.target.closest('button'); if(!b)return; const {i}=locate(T); let t=i*PER; for(let k=0;k<Number(b.dataset.k);k++)t+=PHASES[k].d; T=t+0.01; apply();});
scrub.addEventListener('input',()=>{T=Number(scrub.value); apply();});
controls.addEventListener('change',()=>{dirty=true;});

function resize(){const w=host.clientWidth, h=host.clientHeight; renderer.setSize(w,h,false); renderer.domElement.style.width=w+'px'; renderer.domElement.style.height=h+'px'; camera.aspect=w/h; camera.updateProjectionMatrix(); dirty=true;}
new ResizeObserver(resize).observe(host); resize();

let visible=true;
new IntersectionObserver(es=>{visible=es[0].isIntersecting;}).observe(host);

/* Start on a telling frame: the press halfway in */
T=PHASES[0].d+2.6; apply();
let last=performance.now(), holdT=0;
function loop(now){
  const dt=Math.max(0,Math.min(0.05,(now-last)/1000)); last=now;
  if(playing&&visible){
    if(T<TOTAL){T=Math.min(TOTAL,T+dt*speed); apply();}
    else {holdT+=dt; if(holdT>HOLD){holdT=0; T=0; apply();}}
  }
  controls.update();
  if(visible&&dirty){renderer.render(scene,camera); dirty=false;}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.sampling3d={restart(){T=0; holdT=0; setPlaying(true); apply();}};
})();
