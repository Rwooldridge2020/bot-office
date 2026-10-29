import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Bot = { name: string; paused: boolean; state: string; line: string; room: string };
type Actor = { bot: Bot; body: THREE.Group; chair: THREE.Group; arms: THREE.Mesh[]; screen: THREE.MeshLambertMaterial; mats: THREE.MeshLambertMaterial[]; color: THREE.Color; marker: THREE.Sprite; doneAt: number };

const SHAPES = ["tall", "short", "wide", "hat"];
const DEMO: Bot[] = [
  { name: "Demo Lead", paused: false, state: "idle", line: "", room: "lead" },
  { name: "Demo Assistant", paused: false, state: "idle", line: "", room: "assistant" },
  ...Array.from({ length: 18 }, (_, i) => ({ name: `Demo Bot ${i + 1}`, paused: i === 7, state: "idle", line: "", room: "" })),
];
const SIM_LINES: Record<string, string> = { working: "Working on a task", waiting: "Waiting on input", error: "Hit an error", done: "Finished a task", idle: "" };

function hash(s: string) {
  let h = 0x811c9dc5;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return h;
}
const hue = (name: string) => (hash(name) % 10) * 36;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1d22);
scene.add(new THREE.HemisphereLight(0xf2efe8, 0x3a3832, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(6, 12, 8);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, -0.5);
controls.enableDamping = true;
controls.minDistance = 6;
controls.maxDistance = 80;
controls.maxPolarAngle = 1.35;

const mat = (color: THREE.ColorRepresentation) => new THREE.MeshLambertMaterial({ color });
function box(parent: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d")!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const wallMat = mat(0xcfc9bc);
const woodMat = mat(0x8a6a4c);
const darkMat = mat(0x2b2f3a);
const deskMat = mat(0xb9ab94);
const glassMat = new THREE.MeshLambertMaterial({ color: 0xbfd8e6, transparent: true, opacity: 0.18, depthWrite: false });

box(scene, 28, 0.1, 22, mat(0x55606e), 0, -0.05, 0);
box(scene, 28, 3, 0.2, wallMat, 0, 1.5, -11);
box(scene, 0.2, 3, 22, wallMat, -14, 1.5, 0);

const wallTex = canvasTexture(1024, 256, () => {});
const counter = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: wallTex }));
counter.position.set(7.5, 1.8, -10.88);
scene.add(counter);
function drawCounter(text: string) {
  const c = (wallTex.image as HTMLCanvasElement).getContext("2d")!;
  c.fillStyle = "#23262d";
  c.fillRect(0, 0, 1024, 256);
  c.fillStyle = "#9fd8ae";
  c.textAlign = "center";
  c.font = "bold 40px ui-monospace, monospace";
  c.fillText("WEEKLY USAGE", 512, 70);
  c.font = "bold 64px ui-monospace, monospace";
  c.fillText(text.slice(0, 28), 512, 175);
  wallTex.needsUpdate = true;
}

function glassWall(x: number, z: number, len: number, alongX: boolean) {
  box(scene, alongX ? len : 0.04, 2.6, alongX ? 0.04 : len, glassMat, x, 1.3, z);
  box(scene, alongX ? len : 0.1, 0.1, alongX ? 0.1 : len, darkMat, x, 2.6, z);
  box(scene, alongX ? len : 0.1, 0.1, alongX ? 0.1 : len, darkMat, x, 0.05, z);
}
function plant(x: number, z: number) {
  box(scene, 0.4, 0.4, 0.4, mat(0x7a5a44), x, 0.2, z);
  box(scene, 0.6, 0.7, 0.6, mat(0x5f7d57), x, 0.75, z);
}

// Corner office (x -14..-8) and assistant room (x -8..0), z -11..-5, door between them.
box(scene, 6, 0.02, 6, mat(0x6d7180), -11, 0.01, -8);
box(scene, 8, 0.02, 6, mat(0x7b7468), -4, 0.01, -8);
glassWall(-11, -5, 6, true);
glassWall(-4, -5, 8, true);
glassWall(0, -8, 6, false);
box(scene, 0.2, 2.8, 2.1, wallMat, -8, 1.4, -9.95);
box(scene, 0.2, 2.8, 2.1, wallMat, -8, 1.4, -6.05);
box(scene, 0.2, 0.6, 1.8, wallMat, -8, 2.5, -8);
const door = new THREE.Group();
door.position.set(-8, 0, -8);
scene.add(door);
for (const z of [-0.95, 0.95]) box(door, 0.3, 2.3, 0.1, woodMat, 0, 1.15, z);
box(door, 0.3, 0.1, 2, woodMat, 0, 2.25, 0);
box(door, 0.08, 2.18, 1.78, mat(0xa98463), 0, 1.09, 0);
for (const side of [-1, 1]) for (const [y, h] of [[0.6, 0.7], [1.6, 0.8]]) for (const z of [-0.43, 0.43]) box(door, 0.12, h, 0.66, mat(0x9b7656), side * 0.02, y, z);
for (const side of [-1, 1]) {
  box(door, 0.04, 0.12, 0.12, mat(0xc8b27a), side * 0.07, 1.05, 0.7);
  box(door, 0.08, 0.04, 0.04, mat(0xc8b27a), side * 0.1, 1.05, 0.64);
}
plant(-13.4, -5.6);
plant(-0.6, -10.4);
box(scene, 2.2, 0.4, 0.8, mat(0x6f7b8c), -3, 0.3, -10.4);
box(scene, 2.2, 0.5, 0.2, mat(0x6f7b8c), -3, 0.6, -10.75);
box(scene, 1.2, 1.8, 0.4, woodMat, -6.5, 0.9, -10.7);
plant(13.2, 10.2);
plant(-13.2, 10.2);
plant(13.2, -10.2);

const tagTex = (text: string, color: string) =>
  canvasTexture(128, 128, (c) => {
    c.fillStyle = color;
    c.font = "bold 96px system-ui, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, 64, 70);
  });
const MARKS: Record<string, THREE.Texture> = { waiting: tagTex("?", "#e8e4da"), error: tagTex("!", "#c4625a"), done: tagTex("✓", "#7fbf86") };

const office = new THREE.Group();
scene.add(office);
let actors: Actor[] = [];

function addActor(bot: Bot, x: number, z: number, rotY: number) {
  const h = hue(bot.name);
  const shape = SHAPES[hash(bot.name + "#shape") % 4];
  const color = new THREE.Color().setHSL(h / 360, 0.45, 0.55);
  const m = mat(color);
  const head = mat(0xd9c7b0);
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = rotY;
  office.add(root);
  box(root, 1.3, 0.06, 0.7, deskMat, 0, 0.75, -0.75);
  for (const dx of [-0.6, 0.6]) box(root, 0.06, 0.72, 0.6, deskMat, dx, 0.36, -0.75);
  box(root, 0.6, 0.38, 0.05, darkMat, 0, 1.05, -0.95);
  const screen = new THREE.MeshLambertMaterial({ color: 0x111111, emissive: 0x000000 });
  box(root, 0.52, 0.3, 0.01, screen, 0, 1.05, -0.92);

  const chair = new THREE.Group();
  root.add(chair);
  box(chair, 0.5, 0.08, 0.5, darkMat, 0, 0.45, 0);
  box(chair, 0.5, 0.6, 0.08, darkMat, 0, 0.8, 0.25);
  box(chair, 0.08, 0.42, 0.08, darkMat, 0, 0.21, 0);

  const w = shape === "wide" ? 0.62 : 0.44;
  const th = shape === "tall" ? 0.72 : shape === "short" ? 0.46 : 0.56;
  const body = new THREE.Group();
  body.position.y = 0.5;
  chair.add(body);
  box(body, w * 0.8, 0.14, 0.45, m, 0, 0.05, -0.2);
  box(body, w, th, 0.3, m, 0, th / 2, 0);
  box(body, 0.34, 0.34, 0.34, head, 0, th + 0.19, 0);
  if (shape === "hat") {
    box(body, 0.44, 0.05, 0.44, m, 0, th + 0.38, 0);
    box(body, 0.28, 0.18, 0.28, m, 0, th + 0.49, 0);
  }
  const arms = [-1, 1].map((s) => box(body, 0.1, 0.1, 0.38, m, s * (w / 2 + 0.06), th * 0.6, -0.18));
  arms.forEach((arm) => (arm.userData.y0 = th * 0.6));
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  marker.scale.set(0.45, 0.45, 1);
  marker.position.set(0, 0.5 + th + 0.9, 0);
  root.add(marker);
  const mats = [m, head];
  const a: Actor = { bot, body, chair, arms, screen, mats, color, marker, doneAt: 0 };
  root.traverse((o) => (o.userData.actor = a));
  actors.push(a);
  setState(a, bot);
}

function setState(a: Actor, bot: Bot) {
  if (bot.state === "done" && (a.bot.state !== "done" || !a.doneAt)) a.doneAt = performance.now();
  a.bot = bot;
  const away = bot.state === "idle" || bot.paused;
  a.chair.position.z = away ? 0.35 : 0;
  a.body.rotation.x = away ? -0.22 : 0;
  for (const arm of a.arms) (arm.rotation.x = away ? 1.2 : 0), (arm.position.y = arm.userData.y0);
  a.mats[0].color.copy(a.color).lerp(new THREE.Color(0x3a3d44), bot.paused ? 0.6 : 0);
  a.mats[1].color.set(bot.paused ? 0x6e675e : 0xd9c7b0);
  a.screen.emissive.set(bot.paused ? 0x000000 : away ? 0x101820 : 0x2e4a5c);
  const tex = bot.paused ? undefined : MARKS[bot.state];
  a.marker.visible = !!tex;
  if (tex) a.marker.material.map = tex;
  a.marker.material.opacity = 1;
}

function build(bots: Bot[]) {
  office.clear();
  actors = [];
  const sorted = [...bots].sort((a, b) => hue(a.name) - hue(b.name) || a.name.localeCompare(b.name));
  const lead = sorted.find((b) => b.room === "lead");
  const assistant = sorted.find((b) => b.room === "assistant");
  if (lead) addActor(lead, -11, -8.8, Math.PI);
  if (assistant) addActor(assistant, -4, -8.5, Math.PI);
  const groups = new Map<number, Bot[]>();
  for (const b of sorted) if (!b.room) groups.set(hue(b.name), [...(groups.get(hue(b.name)) ?? []), b]);
  const rows: { h: number; bots: Bot[]; w: number }[][] = [[]];
  let rowW = 0;
  for (const [h, gb] of groups) {
    const w = Math.ceil(gb.length / 2) * 1.5 + 1;
    if (rowW + w > 26 && rowW) rows.push([]), (rowW = 0);
    rows[rows.length - 1].push({ h, bots: gb, w });
    rowW += w;
  }
  rows.forEach((row, r) => {
    const z = 3 - (rows.length - 1) * 2.2 + r * 4.4;
    let x = -row.reduce((s, p) => s + p.w, 0) / 2;
    for (const pod of row) {
      const cols = Math.ceil(pod.bots.length / 2);
      const rug = new THREE.Mesh(new THREE.BoxGeometry(pod.w - 0.3, 0.02, 3.8), mat(new THREE.Color().setHSL(pod.h / 360, 0.18, 0.36)));
      rug.position.set(x + pod.w / 2, 0.01, z);
      office.add(rug);
      pod.bots.forEach((b, i) => {
        const bx = x + 0.5 + 0.75 + (i % cols) * 1.5;
        if (i < cols) addActor(b, bx, z - 1.2, Math.PI);
        else addActor(b, bx, z + 1.2, 0);
      });
      x += pod.w;
    }
  });
}

const hud = document.getElementById("hud")!;
const tip = document.getElementById("tip")!;
const simBtn = document.getElementById("sim") as HTMLButtonElement;
let live = { bots: [] as Bot[], paused: false, usage_line: "", feed_warning: true };
let sim: Bot[] | null = null;
let key = "";

function show(bots: Bot[]) {
  const k = bots.map((b) => b.name + b.room).join("|");
  if (k !== key) {
    key = k;
    build(bots);
  } else bots.forEach((b) => setState(actors.find((a) => a.bot.name === b.name)!, b));
  hud.textContent = [sim && "Simulation", live.paused && "Office paused", live.feed_warning && "⚠ No recent read from Notion"].filter(Boolean).join(" · ");
  drawCounter(live.usage_line || "no reading yet");
}

async function refresh() {
  try {
    live = await (await fetch("/api/state")).json();
  } catch {
    live = { ...live, feed_warning: true };
  }
  if (!sim) show(live.bots);
}

simBtn.onclick = () => {
  sim = sim ? null : (live.bots.length ? live.bots : DEMO).map((b) => ({ ...b }));
  simBtn.textContent = sim ? "Stop simulation" : "Simulate work";
  tip.hidden = true;
  show(sim ?? live.bots);
};
setInterval(() => {
  if (!sim) return;
  for (let i = 0; i < 4; i++) {
    const b = sim[Math.floor(Math.random() * sim.length)];
    if (b.paused) continue;
    b.state = Object.keys(SIM_LINES)[Math.floor(Math.random() * 5)];
    b.line = SIM_LINES[b.state];
  }
  show(sim.map((b) => ({ ...b })));
}, 1500);

const ray = new THREE.Raycaster();
function pick(e: PointerEvent) {
  ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const a: Actor | undefined = ray.intersectObjects(office.children, true).find((h) => h.object.userData.actor)?.object.userData.actor;
  tip.hidden = !a;
  if (!a) return;
  const b = a.bot;
  tip.textContent = `${b.name} — ${b.paused ? "paused" : b.line || b.state}`;
  tip.style.left = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8) + "px";
  tip.style.top = Math.max(e.clientY - 36, 8) + "px";
}
let down = { x: 0, y: 0 };
renderer.domElement.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
renderer.domElement.addEventListener("pointerup", (e) => Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && pick(e));
renderer.domElement.addEventListener("pointermove", (e) => e.pointerType === "mouse" && !e.buttons && pick(e));

function resize() {
  const aspect = innerWidth / innerHeight;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = aspect;
  camera.fov = aspect < 1 ? 50 : 45;
  camera.position.set(0, aspect < 1 ? 62 : 17, aspect < 1 ? 24 : 19);
  camera.updateProjectionMatrix();
}

renderer.setAnimationLoop((t) => {
  for (const a of actors) {
    if (a.bot.state === "working" && !a.bot.paused) a.arms.forEach((arm, i) => (arm.position.y = arm.userData.y0 + Math.abs(Math.sin(t / 120 + i * 1.7)) * 0.05));
    if (a.bot.state === "done" && a.marker.visible) a.marker.material.opacity = Math.max(0, 1 - (t - a.doneAt) / 6000);
  }
  controls.update();
  renderer.render(scene, camera);
});

addEventListener("resize", resize);
resize();
show([]);
refresh();
setInterval(refresh, 60_000);
