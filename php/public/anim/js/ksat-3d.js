/* Kopie aus gitlab.uni-bayreuth.de/bt150952/geoecology (js/ksat-3d.js, Commit e087a04), Beschriftungen deutsch.
   Aenderungen an Geometrie oder Ablauf bitte zuerst im geoecology-Repo machen und hierher uebernehmen. */
/* KSAT-Gerät in 3D (Fallhöhenmethode) */
(function(){
const host=document.getElementById('ksat3');
if(!window.THREE||!THREE.OrbitControls){host.innerHTML='<p class="fallback">Die 3D-Ansicht konnte in diesem Browser nicht geladen werden.</p>';return;}
const SOILS=window.KSOILS, BUS=window.KSOIL;
const A_S=Math.PI*16, L_S=5, A_B=4.5, H0=20, HEND=6, OUT_Y=10.4;
const HX=5, BX=-7, BZ=-2.5;
const kOf=ks=>ks/86400*A_S/(A_B*L_S);
const tSim=ks=>Math.log(H0/HEND)/kOf(ks);
const de=x=>String(x).replace('.',',');
function fmtDur(s){if(s<90)return Math.round(s)+' s'; if(s<5400)return Math.round(s/60)+' min'; return de((s/3600).toFixed(1))+' h';}
function clock(s){s=Math.round(s);const hh=Math.floor(s/3600),mm=Math.floor(s%3600/60),ss=s%60;return `${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;}

const PHASES=[
  {d:4, short:'Teile', title:'Die Bauteile', text:()=>'Von unten nach oben: Probenhalter mit Filterplatte, untere Dichtung, die gesättigte Probe im 250-cm³-Stechzylinder, Lochplatte, obere Dichtung, Haltering und die Spannkappe aus Aluminium.'},
  {d:6, short:'Einbauen', title:'Zusammenbauen', text:()=>'Die zuvor gesättigte Probe kommt zwischen den beiden Dichtungen auf die Filterplatte, wird mit der Lochplatte abgedeckt und mit der Schraubkappe wasserdicht verspannt.'},
  {d:2.5, short:'Schnitt', title:'Schnittansicht', text:()=>'Im Inneren läuft das Wasser aus der Bürette durch den Sockel, tritt von unten in die Probe ein und oben wieder aus. Ein Drucksensor sitzt an der Wasserleitung und wird über USB ausgelesen.'},
  {d:3, short:'Füllen', title:'Bürette füllen', text:()=>'Die Bürette wird bis 20 cm über das Auslaufniveau gefüllt. Mit dem Öffnen des Ventils beginnt die Messung.'},
  {d:12, short:'Messen', title:'Messung mit fallender Druckhöhe', text:()=>{const s=SOILS[BUS.i]; return `${s.name}, Ks ${s.ks} cm/d: Die Wassersäule H sinkt, während das Wasser von unten nach oben durch die Probe sickert. Sie halbiert sich in etwa ${fmtDur(Math.log(2)/kOf(s.ks))}. Der Sensor zeichnet H auf, die Software berechnet Ks aus dem Abfall.`;}}
];
/* Played length of the measurement and particle speed per soil. Both follow Ks on a compressed
   scale (real times differ by a factor of 200), so the difference stays visible but watchable. */
const MEAS_D=SOILS.map(s=>Math.round(8*Math.pow(600/s.ks,0.19))), FLOW=SOILS.map(s=>Math.pow(s.ks/600,0.45));
const NVIS=SOILS.map(s=>Math.round(120*Math.pow(s.ks/600,0.2)));
PHASES[4].d=MEAS_D[BUS.i];
let TOTAL=PHASES.reduce((a,p)=>a+p.d,0);
const HOLD=2.5, MEAS0=TOTAL-PHASES[4].d;
const ease=t=>t<=0?0:t>=1?1:t*t*(3-2*t), clamp=t=>Math.max(0,Math.min(1,t));

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
renderer.localClippingEnabled=true;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(32,1,1,500);
const controls=new THREE.OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.enablePan=false; controls.minDistance=25; controls.maxDistance=140;
controls.minPolarAngle=0.3; controls.maxPolarAngle=1.5; controls.minAzimuthAngle=-0.85; controls.maxAzimuthAngle=0.85;
controls.target.set(4,15.5,0); camera.position.set(4+22,15.5+11,76);
let dirty=true;
function setBg(){scene.background=new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--scene').trim()||'#e6ece8'); dirty=true;}
setBg();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',setBg);
new MutationObserver(setBg).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

scene.add(new THREE.HemisphereLight(0xffffff,0x8a8f94,0.9));
const sun=new THREE.DirectionalLight(0xffffff,0.7);
sun.position.set(25,60,40); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-0.0015;
Object.assign(sun.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:5,far:150});
scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:0.16}));
floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);

const cut=new THREE.Plane(new THREE.Vector3(0,0,-1),60);
const M=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:0.55,metalness:0.1,clippingPlanes:[cut],side:THREE.DoubleSide},o||{}));
function dots(bg,fg,n,r){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,256,256);g.fillStyle=fg;const st=256/n;for(let i=0;i<n;i++)for(let j=0;j<n;j++){g.beginPath();g.arc(st*(i+0.5),st*(j+0.5),r,0,7);g.fill();}return new THREE.CanvasTexture(c);}
const blackM=M(0x23282c), aluM=M(0xc9ced3,{metalness:0.45,roughness:0.32}), steelM=M(0xd9dee2,{metalness:0.35,roughness:0.3});
const blueM=M(0x2f86d6), redM=M(0xe5482f), filterM=M(0xf3f3ef,{map:dots('#f3f3ef','#cfd3d6',12,3)}), perfM=M(0xe4e8eb,{map:dots('#e4e8eb','#8a9399',14,4)});
const sensorM=M(0x2f5a3c), whiteCable=new THREE.MeshStandardMaterial({color:0xe9ecef,roughness:0.6});
const waterIn=M(0x3d8fd1,{transparent:true,opacity:0.75,roughness:0.2});
const waterFree=new THREE.MeshStandardMaterial({color:0x3d8fd1,transparent:true,opacity:0.8,roughness:0.2});
const glassM=new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:0.2,roughness:0.05,depthWrite:false,side:THREE.DoubleSide});
const tubeM=new THREE.MeshStandardMaterial({color:0xdfe6ea,transparent:true,opacity:0.45,roughness:0.2,depthWrite:false});

function soilTex(base,specks,extra){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,256,256);for(let i=0;i<2400;i++){g.fillStyle=specks[i%specks.length];g.globalAlpha=0.35+Math.random()*0.4;g.beginPath();g.arc(Math.random()*256,Math.random()*256,Math.random()*1.8+0.4,0,7);g.fill();}g.globalAlpha=1;if(extra)extra(g);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
const SOILTEX=[
  soilTex('#4a3424',['#33241a','#5e4532','#2a1c12'],g=>{g.strokeStyle='#1a120b';g.lineWidth=2;for(let i=0;i<9;i++){g.beginPath();let x=Math.random()*256,y=0;g.moveTo(x,y);while(y<256){x+=(Math.random()-0.5)*18;y+=14;g.lineTo(x,y);}g.stroke();}}),
  soilTex('#c9ad78',['#b39461','#ddc595','#a88a58']),
  soilTex('#6e6253',['#5d5345','#7f7363','#665a4c'])
];
const coreM=M(0xffffff,{map:SOILTEX[BUS.i],roughness:1});

const V2=(x,y)=>new THREE.Vector2(x,y);
const ringGeo=(ri,ro,h)=>new THREE.LatheGeometry([V2(ri,0),V2(ro,0),V2(ro,h),V2(ri,h),V2(ri,0)],64);
const cylGeo=(r,h)=>{const g=new THREE.CylinderGeometry(r,r,h,64);g.translate(0,h/2,0);return g;};
function add(parent,geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x||0,y||0,z||0);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function extrudeY(shape,depth){const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:24});g.rotateX(-Math.PI/2);return g;}

/* base plate with feet */
const plate=new THREE.Shape(); const W=12,D=8,R=1.2;
plate.moveTo(-W+R,-D);plate.lineTo(W-R,-D);plate.quadraticCurveTo(W,-D,W,-D+R);plate.lineTo(W,D-R);plate.quadraticCurveTo(W,D,W-R,D);plate.lineTo(-W+R,D);plate.quadraticCurveTo(-W,D,-W,D-R);plate.lineTo(-W,-D+R);plate.quadraticCurveTo(-W,-D,-W+R,-D);
add(scene,extrudeY(plate,1.8),blackM,0,0.4,0);
[[-10,-6],[10,-6],[-10,6],[10,6]].forEach(([x,z])=>add(scene,cylGeo(0.7,0.4),blackM,x,0,z));
/* sample holder base with thread */
add(scene,cylGeo(6,3),blackM,HX,2.2,0);
[3.0,3.8,4.6].forEach(y=>{const t=add(scene,new THREE.TorusGeometry(6,0.1,6,64),blackM,HX,y,0);t.rotation.x=Math.PI/2;});

/* moving parts: [group, assembled bottom y, explode offset, label] */
const parts=[];
function part(name,y,off,build){const g=new THREE.Group();g.position.set(HX,y,0);scene.add(g);build(g);parts.push({name,g,y,off});return g;}
part('Filterplatte',5.2,0.8,g=>add(g,cylGeo(4.3,0.4),filterM));
part('Untere Dichtung',5.3,3,g=>add(g,ringGeo(4.05,4.7,0.6),redM));
const sampleG=part('Stechzylinder 250 cm³, gesättigter Boden',5.6,6.2,g=>{add(g,ringGeo(4.0,4.25,5),steelM);add(g,cylGeo(3.97,5),coreM);});
part('Lochplatte',10.6,9.4,g=>add(g,cylGeo(4.25,0.2),perfM));
part('Obere Dichtung',10.5,11,g=>add(g,ringGeo(4.1,4.8,0.6),blueM));
part('Haltering',11.1,12.6,g=>add(g,ringGeo(4.3,5.0,0.7),blackM));
const capG=part('Spannkappe',4.6,21.5,g=>{
  add(g,ringGeo(6.05,6.7,3),aluM,0,0,0);
  add(g,ringGeo(4.75,6.05,2.4),aluM,0,0.6,0);
  const star=new THREE.Shape(); for(let i=0;i<=32;i++){const a=i/32*Math.PI*2, r=i%2?5.78:6.28; const x=Math.cos(a)*r,y=Math.sin(a)*r; if(i===0)star.moveTo(x,y); else star.lineTo(x,y);}
  const hole=new THREE.Path(); hole.absarc(0,0,4.75,0,Math.PI*2,true); star.holes.push(hole);
  add(g,extrudeY(star,4.6),aluM,0,3,0);
  add(g,ringGeo(4.3,6.0,0.5),aluM,0,7.6,0);
});

/* burette */
const bur=new THREE.Group(); bur.position.set(BX,0,BZ); scene.add(bur);
add(bur,cylGeo(1.5,8),blackM,0,2.2,0);
add(bur,cylGeo(1.75,1.2),blackM,0,2.2,0);
const glass=add(bur,ringGeo(1.05,1.17,24),glassM,0,9.6,0); glass.castShadow=false; glass.renderOrder=3;
const burWater=add(bur,cylGeo(1.0,1),waterFree,0,9.7,0); burWater.castShadow=false;
(function(){const c=document.createElement('canvas');c.width=64;c.height=1024;const g=c.getContext('2d');g.clearRect(0,0,64,1024);g.fillStyle='#20262b';g.font='bold 22px sans-serif';
  const px=y=>1024-((y-(OUT_Y-0.7))/21.6)*1024;
  for(let cm=0;cm<=20;cm+=0.5){const y=px(OUT_Y+cm);g.fillRect(0,y-1.2,cm%1===0?26:14,2.4);if(cm%1===0)g.fillText(String(cm),30,y+8);}
  const t=new THREE.CanvasTexture(c);const m=new THREE.Mesh(new THREE.PlaneGeometry(1.1,21.6),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));
  m.position.set(0.35,OUT_Y-0.7+10.8,1.2);m.renderOrder=4;bur.add(m);})();
const valve=new THREE.Group(); valve.position.set(-1.9,6.2,0.4); bur.add(valve);
add(valve,new THREE.BoxGeometry(0.5,3.4,0.7),blackM,0,-1.2,0);
add(valve,cylGeo(0.5,0.6),blackM,0,-0.3,0).rotation.x=Math.PI/2;

/* water path, pressure sensor, outflow, beaker */
const tube=(pts,r,mat)=>{const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)),false,'catmullrom',0.05),80,r,10),mat);scene.add(m);return m;};
const inflow=tube([[BX,9.6,BZ],[BX,1.3,BZ],[BX+0.6,1.2,-0.2],[HX-0.6,1.2,0],[HX,1.6,0],[HX,5.1,0]],0.38,waterFree);
const lowerW=add(scene,cylGeo(4.2,0.3),waterIn,HX,4.95,0);
const upperW=add(scene,cylGeo(4.2,0.8),waterIn,HX,10.75,0);
const sensor=add(scene,new THREE.BoxGeometry(2.2,0.9,1.4),sensorM,BX+2.6,1.2,-1.4);
const sensorCable=tube([[BX+3.7,1.2,-1.4],[4,1.1,-4.5],[11.6,1.1,-5]],0.15,whiteCable);
tube([[11.8,1.1,-5],[15,0.6,-6.5],[22,0.3,-7]],0.22,whiteCable);
const outTube=tube([[HX+4.4,11.3,0],[HX+6.9,11.3,0],[HX+8.4,10.6,1.6],[15.5,7.5,5],[15.5,5.6,5]],0.32,tubeM);
const beaker=new THREE.Group(); beaker.position.set(15.5,0,5); scene.add(beaker);
const bg=add(beaker,ringGeo(2.4,2.55,5.5),glassM); bg.castShadow=false; bg.renderOrder=3;
add(beaker,cylGeo(2.55,0.2),glassM).renderOrder=3;
const beakerW=add(beaker,cylGeo(2.35,1),waterFree,0,0.2,0); beakerW.castShadow=false;
const interior=[inflow,lowerW,upperW,sensor,sensorCable];

/* flow particles */
const NP=120, partGeo=new THREE.SphereGeometry(0.19,8,6), partMesh=new THREE.InstancedMesh(partGeo,new THREE.MeshBasicMaterial({color:0xa9dcff}),NP);
scene.add(partMesh);
const tail=[[HX+4.4,11.3,0],[HX+6.9,11.3,0],[HX+8.4,10.6,1.6],[15.5,7.5,5],[15.5,5.2,5]];
const paths=[-2.6,-1.3,0,1.3,2.6].map(dx=>new THREE.CatmullRomCurve3([[BX,14,BZ],[BX,1.3,BZ],[BX+0.6,1.2,-0.2],[HX-0.6,1.2,0],[HX,2.2,0],[HX,4.7,-0.3],[HX+dx,5.6,-0.6],[HX+dx+0.45,7.2,-0.6],[HX+dx-0.45,8.8,-0.6],[HX+dx,10.4,-0.6],[HX+dx*0.45,11.0,-0.4],...tail].map(p=>new THREE.Vector3(...p)),false,'catmullrom',0.1).getSpacedPoints(500));
const pPhase=[...Array(NP)].map((_,k)=>({c:k%5,ph:Math.random()}));
let flowClock=0; const pm=new THREE.Matrix4();

/* H dimension line */
const dimMat=new THREE.LineBasicMaterial({color:0x1f5a72}), dashMat=new THREE.LineDashedMaterial({color:0x1f5a72,dashSize:0.5,gapSize:0.4});
const dimGeo=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(new Array(18).fill(0),3));
const dim=new THREE.LineSegments(dimGeo,dimMat); scene.add(dim);
const outLvl=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(BX-3,OUT_Y,BZ),new THREE.Vector3(HX-6.8,OUT_Y,BZ)]),dashMat); outLvl.computeLineDistances(); scene.add(outLvl);

/* HTML labels */
const labelsEl=document.getElementById('klabels');
const LBL=[];
function lbl(text,pos,show,side){const el=document.createElement('div');el.className='lbl3d';el.textContent=text;labelsEl.appendChild(el);LBL.push({el,pos,show,side:side||'r'});}
parts.forEach(p=>lbl(p.name,()=>new THREE.Vector3(HX+7.4,p.g.position.y+(p.name==='Spannkappe'?5:0.4),0),st=>st.explode));
lbl('Bürette',()=>new THREE.Vector3(BX-1.6,25,BZ),st=>st.dim?0:1,'l');
lbl('Ventil',()=>new THREE.Vector3(BX-2.6,4.6,BZ+0.4),st=>st.inside,'l');
lbl('Drucksensor → USB zum Rechner',()=>new THREE.Vector3(BX+1.6,0.9,0.6),st=>st.inside,'r');
lbl('Bodenprobe',()=>new THREE.Vector3(HX+1.5,8,0.5),st=>st.inside,'r');
lbl('Wasserablauf',()=>new THREE.Vector3(17.6,4,5),st=>st.inside,'r');
lbl('Wassersäule H',()=>new THREE.Vector3(BX-2.7,OUT_Y+(st.level-OUT_Y)/2,BZ),st=>st.dim,'l');
lbl('Auslaufniveau',()=>new THREE.Vector3(HX-6.6,OUT_Y+0.9,BZ),st=>st.dim,'r');
const st={explode:1,inside:0,dim:0,level:9.7};

/* timeline */
function locate(T){const t=Math.min(T,TOTAL-1e-6);let tl=t,j=0;while(j<PHASES.length-1&&tl>=PHASES[j].d){tl-=PHASES[j].d;j++;}return {j,u:clamp(tl/PHASES[j].d)};}
const ORDER=[[0,0.14],[0.1,0.26],[0.22,0.44],[0.4,0.56],[0.52,0.68],[0.64,0.8],[0.76,1]];
let T=0, playing=!window.matchMedia('(prefers-reduced-motion: reduce)').matches, speed=1, lastPhase=-1;
const hudEl=document.getElementById('khud');
function apply(){
  const {j,u}=locate(T), soil=SOILS[BUS.i];
  parts.forEach((p,k)=>{
    let e=j===0?1:j===1?1-ease((u-ORDER[k][0])/(ORDER[k][1]-ORDER[k][0])):0;
    p.g.position.y=p.y+p.off*e;
    if(p.g===capG) p.g.rotation.y=e*Math.PI*1.2;
  });
  st.explode=j===0?1:j===1?1-clamp(u*1.6):0;
  cut.constant=j<2?60:j===2?60-60*ease(u*1.15):0;
  st.inside=j<2?0:j===2?clamp((u-0.4)/0.6):1;
  interior.forEach(m=>m.visible=st.inside>0);
  lowerW.visible=upperW.visible=j>=3&&(j>3||u>0.5);
  let level=9.7, H=null;
  if(j===3) level=9.7+(OUT_Y+H0-9.7)*ease(u);
  if(j===4){const ts=u*tSim(soil.ks); H=H0*Math.exp(-kOf(soil.ks)*ts); level=OUT_Y+H;}
  st.level=level; burWater.scale.y=Math.max(level-9.7,0.01);
  valve.rotation.z=j===3?-1.15*ease((u-0.75)/0.25):j===4?-1.15:0;
  st.dim=j>=3&&level>OUT_Y+0.5?1:0;
  const a=dimGeo.attributes.position.array, x=BX-2.2, z=BZ;
  [[x,OUT_Y,z,x,level,z],[x-0.5,OUT_Y,z,x+0.5,OUT_Y,z],[x-0.5,level,z,x+0.5,level,z]].forEach((s,k)=>a.set(s,k*6));
  dimGeo.attributes.position.needsUpdate=true; dim.visible=outLvl.visible=!!st.dim;
  partMesh.visible=j===4; outTube.visible=j>=2;
  const V=H===null?0:A_B*(H0-H); beakerW.visible=V>0.05; beakerW.scale.y=Math.max(V/(Math.PI*2.35*2.35),0.01);
  hudEl.hidden=j!==4;
  if(j===4){
    const ts=u*tSim(soil.ks);
    document.getElementById('kH').textContent=de(H.toFixed(2))+' cm';
    document.getElementById('kT').textContent=clock(ts);
    document.getElementById('kX').textContent='×'+Math.round(tSim(soil.ks)/PHASES[4].d).toLocaleString('de');
    document.getElementById('kV').textContent=de(V.toFixed(1))+' cm³';
    document.getElementById('kK').textContent=ts>1?`${de((A_B*L_S/(A_S*ts)*Math.log(H0/H)*86400).toPrecision(3))} cm/d`:'–';
    let d=''; for(let k=0;k<=40;k++){const uu=u*k/40, hh=H0*Math.exp(-Math.log(H0/HEND)*uu); d+=(k?' L':'M')+(32+164*uu).toFixed(1)+','+(70-64*hh/H0).toFixed(1);}
    const kc=document.getElementById('kcurve'); kc.setAttribute('d',d); kc.style.stroke=soil.css;
    document.getElementById('kXend').textContent=fmtDur(tSim(soil.ks));
  }
  if(j!==lastPhase){
    lastPhase=j;
    document.getElementById('kcapMeta').textContent=`KSAT · Schritt ${j+1} von ${PHASES.length}`;
    document.getElementById('kcapTitle').textContent=PHASES[j].title;
    document.getElementById('kcapText').textContent=PHASES[j].text();
    stepBtns.forEach((b,k)=>{if(k===j)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  }
  scrub.value=String(Math.min(T,TOTAL));
  dirty=true;
}
function placeParticles(){
  if(!partMesh.visible) return;
  const q=new THREE.Quaternion(), one=new THREE.Vector3(1,1,1);
  const n=NVIS[BUS.i];
  pPhase.forEach((p,k)=>{const pts=paths[p.c], f=(p.ph+flowClock)%1, v=pts[Math.floor(f*(pts.length-1))];
    const hide=k>=n||Math.abs(v.x-BX)<0.1&&Math.abs(v.z-BZ)<0.1&&v.y>st.level-0.3;
    pm.compose(v,q,hide?new THREE.Vector3(0.001,0.001,0.001):one); partMesh.setMatrixAt(k,pm);});
  partMesh.instanceMatrix.needsUpdate=true;
}

/* UI */
const soilsEl=document.getElementById('ksoils'), stepsEl=document.getElementById('ksteps'), scrub=document.getElementById('kscrub');
soilsEl.innerHTML=SOILS.map((s,i)=>`<button data-i="${i}" aria-pressed="false" title="${s.name}"><span class="dot" style="background:${s.css}"></span>${s.short}</button>`).join('');
stepsEl.innerHTML=PHASES.map((p,k)=>`<button data-k="${k}" title="${p.title}">${k+1} ${p.short}</button>`).join('');
const stepBtns=[...stepsEl.children]; scrub.max=String(TOTAL);
const playBtn=document.getElementById('kplay'), speedBtn=document.getElementById('kspeed');
function setPlaying(p){playing=p; playBtn.textContent=p?'Pause':'Abspielen'; playBtn.setAttribute('aria-pressed',String(!p));}
setPlaying(playing);
playBtn.addEventListener('click',()=>{if(!playing&&T>=TOTAL)T=0; setPlaying(!playing);});
speedBtn.addEventListener('click',()=>{speed=speed===1?2:speed===2?0.5:1; speedBtn.textContent=(speed===0.5?'½':speed)+'×';});
stepsEl.addEventListener('click',e=>{const b=e.target.closest('button'); if(!b)return; let t=0; for(let k=0;k<+b.dataset.k;k++)t+=PHASES[k].d; T=t+0.01; apply();});
scrub.addEventListener('input',()=>{T=+scrub.value; apply();});
soilsEl.addEventListener('click',e=>{const b=e.target.closest('button'); if(b) BUS.set(+b.dataset.i);});
function onSoil(i){
  coreM.map=SOILTEX[i]; coreM.needsUpdate=true;
  [...soilsEl.children].forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.i===i)));
  const was=locate(T), u=was.j===4?was.u:0.02;
  PHASES[4].d=MEAS_D[i]; TOTAL=MEAS0+PHASES[4].d; scrub.max=String(TOTAL);
  T=MEAS0+u*PHASES[4].d; lastPhase=-1; apply();
}
BUS.on(onSoil);
[...soilsEl.children].forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.i===BUS.i)));
controls.addEventListener('change',()=>{dirty=true;});

function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);renderer.domElement.style.width=w+'px';renderer.domElement.style.height=h+'px';camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;}
new ResizeObserver(resize).observe(host); resize();
let visible=true; new IntersectionObserver(es=>{visible=es[0].isIntersecting;}).observe(host);
const tmp=new THREE.Vector3();
function placeLabels(){
  const w=host.clientWidth,h=host.clientHeight;
  LBL.forEach(L=>{const a=L.show(st); if(!a){L.el.style.opacity='0';return;}
    tmp.copy(L.pos()).project(camera); if(tmp.z>1){L.el.style.opacity='0';return;}
    const x=(tmp.x+1)/2*w, y=(1-tmp.y)/2*h;
    L.el.style.opacity=String(a); L.el.style.transform=`translate(${x.toFixed(0)}px,${y.toFixed(0)}px) translate(${L.side==='l'?'-100%':'0'},-50%)`;});
}

/* start on the cut-away measurement */
T=MEAS0+5; apply();
let last=performance.now(), holdT=0;
function loop(now){
  const dt=Math.max(0,Math.min(0.05,(now-last)/1000)); last=now;
  if(playing&&visible){
    if(T<TOTAL){T=Math.min(TOTAL,T+dt*speed); apply();}
    else {holdT+=dt; if(holdT>HOLD){holdT=0; T=0; apply();}}
    const {j}=locate(T); if(j===4){const H=st.level-OUT_Y; flowClock+=dt*speed*0.06*FLOW[BUS.i]*(H/H0); dirty=true;}
  }
  controls.update();
  if(visible&&dirty){placeParticles(); renderer.render(scene,camera); placeLabels(); dirty=false;}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.ksat3d={restart(){T=0; holdT=0; setPlaying(true); apply();}};
})();
