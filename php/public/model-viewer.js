/* =========================================================
   Biomechanik-Lab · 3D-Modell-Betrachter (three.js, ES-Modul)
   Lädt ein GLB-Modell, erlaubt Drehen/Zoomen aus allen Perspektiven
   und blendet anatomische Schichten (Knochen, Muskeln, Bänder …)
   ein/aus, damit Studierende die Bestandteile des Beins erkunden.
   Datengetrieben über window.EXERCISE.media.src.
========================================================= */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const EX = window.EXERCISE || {};
const SRC = (EX.media && EX.media.src) || "model/lower-limb.glb";
const container = document.getElementById("viewer3d");
if (container) boot();

/* ---------- Schicht-Definition (anatomische Systeme) ---------- */
const LAYERS = [
  { key: "knochen", label: "Knochen", color: "#e8e3d6" },
  { key: "muskel", label: "Muskeln", color: "#c0504d" },
  { key: "band", label: "Bänder & Sehnen", color: "#e6c34a" },
  { key: "knorpel", label: "Knorpel", color: "#8fd3c7" },
  { key: "gefaess", label: "Gefäße", color: "#b3503a" },
  { key: "nerv", label: "Nerven", color: "#d9c463" },
  { key: "sonstiges", label: "Sonstiges", color: "#8a93a6" },
];

/* Heuristik: Mesh-Name → Schicht (parallel zur Server-Legende). */
function layerOf(name) {
  const l = (name || "").toLowerCase();
  const has = (...kw) => kw.some((k) => l.indexOf(k) >= 0);
  if (has("muscle", "muscul", "gluteus", "vastus", "rectus", "biceps", "gracilis", "sartorius", "soleus", "gastrocn", "tibialis", "peroneus", "fibularis", "adductor", "abductor", "semimembr", "semitendin", "iliopsoas", "psoas", "iliacus", "piriformis", "tensor", "pectineus", "obturator", "gemellus", "quadratus", "popliteus", "plantaris", "extensor", "flexor", "lumbric", "interossei", "coccygeus")) return "muskel";
  if (has("ligament", "tendon", "retinaculum", "aponeuros", "fascia", "membrane", "meniscus", "labrum", "capsule", "plantar ", "sheath", "annulus", "symphysis")) return "band";
  if (has("artery", "arteries", "vein", "vena", "venous", "aorta", "vessel", "canal", "ring", "saphenous", "triangle")) return "gefaess";
  if (has("nerve", "nervus", "plexus", "ganglion")) return "nerv";
  if (has("cartilage", "art cart", "disc", "disk")) return "knorpel";
  if (has("bone", "femur", "tibia", "fibula", "patella", "phalanx", "phalanges", "metatarsal", "calcaneus", "talus", "tarsal", "cuneiform", "cuboid", "navicular", "sesamoid", "vertebra", "sacrum", "coccyx", "hip ", "pelvis", "ilium", "ischium", "pubis")) return "knochen";
  return "sonstiges";
}

function boot() {
  const loadingEl = document.getElementById("viewer3dLoading");
  const pctEl = document.getElementById("viewer3dPct");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1118);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.9;
  controls.zoomSpeed = 0.9;

  /* Beleuchtung: weiches Umgebungslicht + kamera-gekoppeltes Hauptlicht */
  scene.add(new THREE.HemisphereLight(0xffffff, 0x33373f, 1.05));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-1, 0.4, -0.8);
  scene.add(key, fill);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  const home = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const buckets = {}; // key → [mesh]

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(container);
  else window.addEventListener("resize", resize);

  /* ---------- Modell laden (Draco-komprimiert → DRACOLoader nötig) ---------- */
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.load(
    SRC,
    (gltf) => {
      const root = gltf.scene;

      // Schichten zuordnen
      root.traverse((o) => {
        if (!o.isMesh) return;
        const k = layerOf(o.name || (o.parent && o.parent.name) || "");
        (buckets[k] = buckets[k] || []).push(o);
        if (o.material) o.material.side = THREE.DoubleSide;
      });

      // Zentrieren + skalieren (Modell auf handhabbare Größe normieren)
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const s = 2 / maxDim;
      root.scale.setScalar(s);
      root.position.sub(center.multiplyScalar(s));
      scene.add(root);

      // Kamera einpassen
      const radius = (maxDim * s) * 0.5;
      const dist = radius / Math.sin((camera.fov * Math.PI) / 180 / 2) * 1.25;
      camera.near = radius / 100;
      camera.far = dist * 20;
      camera.updateProjectionMatrix();
      // leicht von schräg-vorne-oben
      camera.position.set(dist * 0.35, dist * 0.18, dist * 0.95);
      controls.target.set(0, 0, 0);
      controls.minDistance = radius * 0.4;
      controls.maxDistance = dist * 6;
      controls.update();
      home.pos.copy(camera.position);
      home.target.copy(controls.target);

      key.position.copy(camera.position);
      buildPanel();
      if (loadingEl) loadingEl.style.display = "none";
    },
    (ev) => {
      if (pctEl && ev.total) pctEl.textContent = Math.round((ev.loaded / ev.total) * 100) + " %";
      else if (pctEl && ev.loaded) pctEl.textContent = Math.round(ev.loaded / 1048576) + " MB";
    },
    (err) => {
      console.error("GLB-Ladefehler", err);
      if (loadingEl) loadingEl.innerHTML = "3D-Modell konnte nicht geladen werden. Internet-Zugang nötig (Bibliothek + Modell). <br>Bitte Seite neu laden.";
    }
  );

  /* ---------- Schicht-Bedienfeld ---------- */
  function setLayer(k, visible) {
    (buckets[k] || []).forEach((m) => { m.visible = visible; });
  }
  function buildPanel() {
    const host = document.getElementById("layerToggles");
    if (!host) return;
    host.innerHTML = "";
    const initialHidden = ((EX.media && EX.media.config && EX.media.config.initialHidden) || []);
    LAYERS.forEach((L) => {
      const list = buckets[L.key];
      if (!list || !list.length) return;
      const hidden = initialHidden.indexOf(L.key) >= 0;
      if (hidden) setLayer(L.key, false);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "layer-toggle" + (hidden ? " off" : "");
      btn.setAttribute("aria-pressed", hidden ? "false" : "true");
      btn.innerHTML =
        '<span class="lt-sw" style="background:' + L.color + '"></span>' +
        '<span class="lt-label">' + L.label + "</span>" +
        '<span class="lt-count">' + list.length + "</span>";
      btn.addEventListener("click", () => {
        const nowOn = btn.classList.toggle("off") === false;
        btn.setAttribute("aria-pressed", nowOn ? "true" : "false");
        setLayer(L.key, nowOn);
      });
      host.appendChild(btn);
    });
  }

  const resetBtn = document.getElementById("resetView");
  if (resetBtn) resetBtn.addEventListener("click", () => {
    camera.position.copy(home.pos);
    controls.target.copy(home.target);
    controls.update();
  });
  const allBtn = document.getElementById("layersAll");
  if (allBtn) allBtn.addEventListener("click", () => {
    document.querySelectorAll(".layer-toggle.off").forEach((b) => b.classList.remove("off"));
    document.querySelectorAll(".layer-toggle").forEach((b) => b.setAttribute("aria-pressed", "true"));
    LAYERS.forEach((L) => setLayer(L.key, true));
  });

  /* ---------- Render-Schleife ---------- */
  (function loop() {
    requestAnimationFrame(loop);
    controls.update();
    key.position.copy(camera.position); // Hauptlicht folgt der Kamera
    renderer.render(scene, camera);
  })();
}
