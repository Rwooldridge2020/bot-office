import * as THREE from "three";

const DEPARTMENT = "OPERATIONS";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1d22);
scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(3, 6, 4);
scene.add(sun);

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d")!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const carpet = canvasTexture(1024, 1024, (c) => {
  c.fillStyle = "#3a4a6b";
  c.fillRect(0, 0, 1024, 1024);
  c.fillStyle = "#2f3d5a";
  c.font = "bold 80px system-ui, sans-serif";
  c.textAlign = "center";
  c.fillText(DEPARTMENT, 512, 820);
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshLambertMaterial({ map: carpet }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const wallTex = canvasTexture(1024, 512, () => {});
const wall = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshLambertMaterial({ map: wallTex }));
wall.position.set(0, 2.5, -5);
scene.add(wall);

function box(w: number, h: number, d: number, color: number, y: number, x = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, 0);
  scene.add(m);
}
box(0.18, 0.7, 0.2, 0x2b2f3a, 0.35, -0.13);
box(0.18, 0.7, 0.2, 0x2b2f3a, 0.35, 0.13);
box(0.55, 0.75, 0.3, 0x4f8a8b, 1.08);
box(0.4, 0.4, 0.4, 0xe0b48f, 1.68);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

function render() {
  renderer.render(scene, camera);
}

function resize() {
  const aspect = innerWidth / innerHeight;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = aspect;
  camera.position.set(0, 5, aspect < 1 ? 13 : 8);
  camera.lookAt(0, 1.2, -1);
  camera.updateProjectionMatrix();
  render();
}

function drawCounter(text: string, sub: string) {
  const c = (wallTex.image as HTMLCanvasElement).getContext("2d")!;
  c.fillStyle = "#d9d4c7";
  c.fillRect(0, 0, 1024, 512);
  c.fillStyle = "#222";
  c.fillRect(212, 120, 600, 200);
  c.fillStyle = "#7CFC9A";
  c.textAlign = "center";
  c.font = "bold 48px ui-monospace, monospace";
  c.fillText(text, 512, 220);
  c.font = "24px ui-monospace, monospace";
  c.fillText(sub, 512, 280);
  wallTex.needsUpdate = true;
  render();
}

async function refresh() {
  try {
    const res = await fetch("/api/state");
    const { usage } = await res.json();
    if (usage) drawCounter(`${usage.pct_left}% left`, `read ${new Date(usage.read_at).toLocaleString()}`);
    else drawCounter("no reading yet", "");
  } catch {
    drawCounter("no reading yet", "");
  }
}

addEventListener("resize", resize);
resize();
refresh();
setInterval(refresh, 60_000);
