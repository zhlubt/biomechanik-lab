/* Kopie aus gitlab.uni-bayreuth.de/bt150952/geoecology (js/k-chart.js, Commit e087a04), Beschriftungen deutsch.
   Aenderungen an Geometrie oder Ablauf bitte zuerst im geoecology-Repo machen und hierher uebernehmen. */
/* Conductivity chart K(h), redrawn and qualitative; shared soil selection */
(function(){
const SOILS=[
  {name:'Gut strukturierter toniger Boden', short:'Ton, strukturiert', ks:600, css:'var(--c-struct)'},
  {name:'Strukturloser sandiger Boden', short:'Sand', ks:150, css:'var(--c-sand)'},
  {name:'Schwach strukturierter toniger Boden', short:'Ton, ohne Gefüge', ks:3, css:'var(--c-poor)'}
];
window.KSOILS=SOILS;
const bus={i:1,fns:[],set(i){this.i=i;this.fns.forEach(f=>f(i));},on(f){this.fns.push(f);}};
window.KSOIL=bus;

const svg=document.getElementById('kchart');
const X0=300, XL=50, XR=410, YT=20, YB=262;
const sx=s=>X0-(X0-XL)*s/3, yk=L=>YT+(3.5-L)/7.5*(YB-YT-10);
const poor=s=>s<1.49?0.477:0.477-1.6*Math.pow(s-1.49,1.3);
const sand=s=>s<1.04?2.176:2.176-2.19*Math.pow(s-1.04,1.4);
const struct=s=>Math.log10(Math.pow(10,poor(s))+597*Math.pow(10,-2.5*s));
const FN=[struct,sand,poor];
function curve(fn,s0,s1,plateau){
  const a=[]; for(let k=0;k<=140;k++){const s=s1-(s1-s0)*k/140; a.push(`${sx(s).toFixed(1)},${yk(fn(s)).toFixed(1)}`);}
  let d='M'+a.join(' L'); if(plateau) d+=` L${XR},${yk(fn(0)).toFixed(1)}`; return d;
}
let h='';
h+=`<rect class="kc-band2" x="${sx(3)}" y="${YT}" width="${sx(1.8)-sx(3)}" height="${YB-YT}"/>`;
h+=`<rect class="kc-band" x="${X0}" y="${YT}" width="${XR-X0}" height="${YB-YT}"/>`;
for(let L=-3;L<=3;L++){const y=yk(L).toFixed(1); h+=`<line class="kc-grid" x1="${XL}" y1="${y}" x2="${XR}" y2="${y}"/><text class="kc-t" x="${XL-4}" y="${(+y+4)}" text-anchor="end">${['0,001','0,01','0,1','1','10','100','1000'][L+3]}</text>`;}
h+=`<text class="kc-t" x="${XL-4}" y="${YT-6}" text-anchor="end">K, cm/d</text>`;
h+=`<line class="kc-axis" x1="${XL}" y1="${YB}" x2="${XR+14}" y2="${YB}"/><polygon class="kc-arrow" points="${XR+20},${YB} ${XR+12},${YB-4} ${XR+12},${YB+4}"/>`;
h+=`<line class="kc-axis" x1="${X0}" y1="${YB}" x2="${X0}" y2="${YT-4}"/><polygon class="kc-arrow" points="${X0},${YT-10} ${X0-4},${YT-2} ${X0+4},${YT-2}"/>`;
h+=`<text class="kc-b" x="${X0+8}" y="${YT-2}">log K</text><text class="kc-b" x="${XR+16}" y="${YB+16}" text-anchor="end">h</text>`;
[[0,'0'],[Math.log10(11),'−10'],[Math.log10(101),'−100'],[3,'−1000 cm']].forEach(([s,t])=>{const x=sx(s).toFixed(1); h+=`<line class="kc-axis" x1="${x}" y1="${YB}" x2="${x}" y2="${YB+4}"/><text class="kc-t" x="${x}" y="${YB+15}" text-anchor="${s===3?'start':'middle'}">${t}</text>`;});
h+=`<text class="kc-t" x="${X0+12}" y="${YB+15}">+</text>`;
h+=`<line class="kc-he" x1="${sx(1.49)}" y1="${yk(0.477)}" x2="${sx(1.49)}" y2="${YB}"/><text class="kc-t" x="${sx(1.49)+4}" y="${YB-6}">hₑ</text>`;
h+=`<text class="kc-t" x="${(X0+XR)/2}" y="${YB-8}" text-anchor="middle">feldgesättigte K<tspan baseline-shift="sub" font-size="8">fs</tspan></text>`;
h+=`<text class="kc-t" x="${sx(0.75)}" y="${YB-8}" text-anchor="middle">ungesättigte K(h)</text>`;
h+=`<text class="kc-b" x="${(X0+XR)/2}" y="${YB+31}" text-anchor="middle">KSAT (diese Übung)</text>`;
h+=`<text class="kc-b" x="${(sx(3)+sx(1.8))/2}" y="${YB+31}" text-anchor="middle">Verdunstungsmethode</text>`;
const lab=[[struct,'Ton, strukturiert',-6],[sand,'Sand',-6],[poor,'Ton, ohne Gefüge',-6]];
FN.forEach((fn,i)=>{
  const vis= i===0 ? `<path class="kc-curve kc-dash c${i}" d="${curve(fn,0,1.75,true)}"/>` : `<path class="kc-curve c${i}" d="${curve(fn,0,3,true)}"/>`;
  const hit= i===0 ? curve(fn,0,1.75,true) : curve(fn,0,3,true);
  h+=`<g class="kc-soil" data-i="${i}" tabindex="0" role="button" aria-label="${SOILS[i].name}">${vis}<path class="kc-hit" d="${hit}"/><text class="kc-l c${i}" x="${XR-2}" y="${(yk(fn(0))+lab[i][2]).toFixed(1)}" text-anchor="end">${lab[i][1]}</text><circle class="c${i}" cx="${X0+22}" cy="${yk(fn(0)).toFixed(1)}" r="4.5"/></g>`;
});
svg.innerHTML=h;
const legend=document.getElementById('klegend');
legend.innerHTML=SOILS.map((s,i)=>`<button data-i="${i}" aria-pressed="false"><span class="dot" style="background:${s.css}"></span>${s.name}</button>`).join('');
function show(i){
  svg.querySelectorAll('.kc-soil').forEach(g=>{const on=+g.dataset.i===i; g.classList.toggle('on',on); g.classList.toggle('dim',!on);});
  legend.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.i===i)));
}
bus.on(show); show(bus.i);
svg.addEventListener('click',e=>{const g=e.target.closest('.kc-soil'); if(g) bus.set(+g.dataset.i);});
svg.addEventListener('keydown',e=>{const g=e.target.closest('.kc-soil'); if(g&&(e.key==='Enter'||e.key===' ')){e.preventDefault(); bus.set(+g.dataset.i);}});
legend.addEventListener('click',e=>{const b=e.target.closest('button'); if(b) bus.set(+b.dataset.i);});
})();
