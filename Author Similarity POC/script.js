
// ─── Data ────────────────────────────────────────────────────────────────────

const authors = [
  { name: "Jane Austen",          features: [0.72, 0.40, 0.76, 0.58, 0.46], bio: "Social nuance, clarity, and controlled sentence rhythm." },
  { name: "William Shakespeare",  features: [0.95, 0.76, 0.54, 0.82, 0.90], bio: "Dense vocabulary, dramatic tone, and flexible syntax." },
  { name: "Ernest Hemingway",     features: [0.38, 0.18, 0.32, 0.22, 0.18], bio: "Short sentences and plain, direct prose." },
  { name: "Virginia Woolf",       features: [0.82, 0.84, 0.58, 0.88, 0.78], bio: "Highly textured interiority and flowing sentence structure." },
  { name: "Agatha Christie",      features: [0.55, 0.34, 0.49, 0.44, 0.28], bio: "Readable, efficient, and plot-oriented." },
  { name: "James Joyce",          features: [1.00, 0.98, 0.46, 0.95, 0.94], bio: "Experimental language, high density, and challenging structure." },
  { name: "Mark Twain",           features: [0.50, 0.30, 0.66, 0.36, 0.22], bio: "Accessible, sharp, and often playful." },
  { name: "Toni Morrison",        features: [0.90, 0.82, 0.60, 0.84, 0.88], bio: "Rich language with lyrical cadence." },
  { name: "George Orwell",        features: [0.44, 0.24, 0.40, 0.30, 0.20], bio: "Clear, lean, and argument-driven prose." },
  { name: "Maya Angelou",         features: [0.78, 0.62, 0.88, 0.70, 0.74], bio: "Warm, rhythmic, and emotionally vivid." },
];

const featureNames = ["Vocabulary", "Difficulty", "Mood", "Sentence length", "Imagery"];

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const svg          = document.getElementById("viz");
const selectedName = document.getElementById("selectedName");
const selectedBio  = document.getElementById("selectedBio");
const featureBars  = document.getElementById("featureBars");
const algoBtns     = document.querySelectorAll(".algo-btn");

const W = 1100, H = 800;
const center = { x: W / 2, y: H / 2 };

// ─── Standardise ──────────────────────────────────────────────────────────────

const dims = authors[0].features.length;
const means = Array(dims).fill(0);
const stds  = Array(dims).fill(0);

for (const a of authors) a.features.forEach((v, i) => means[i] += v);
for (let i = 0; i < dims; i++) means[i] /= authors.length;
for (const a of authors) a.features.forEach((v, i) => stds[i] += (v - means[i]) ** 2);
for (let i = 0; i < dims; i++) stds[i] = Math.sqrt(stds[i] / authors.length) || 1;

const Z = authors.map(a => a.features.map((v, i) => (v - means[i]) / stds[i]));
authors.forEach((a, i) => { a.z = Z[i]; a.x = 0; a.y = 0; a.vx = 0; a.vy = 0; });

// ─── Layout helpers ───────────────────────────────────────────────────────────

function scaleVal(v, min, max, outMin, outMax) {
  if (Math.abs(max - min) < 1e-9) return (outMin + outMax) / 2;
  return outMin + (v - min) * (outMax - outMin) / (max - min);
}

function applyLayout(positions) {
  const xs = positions.map(p => p.x), ys = positions.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  authors.forEach((a, i) => {
    a.base = {
      x: scaleVal(positions[i].x, minX, maxX, 160, W - 160),
      y: scaleVal(positions[i].y, minY, maxY, 120, H - 120),
    };
  });
}

// ─── Algorithms ───────────────────────────────────────────────────────────────

const cache = new Map();

function getResult(algo) {
  if (!cache.has(algo)) {
    if (algo === 'pca')   cache.set('pca',  runPCA(Z));
    if (algo === 'tsne')  cache.set('tsne', runTSNE(Z));
    if (algo === 'umap')  cache.set('umap', runUMAP(Z));
  }
  return cache.get(algo);
}

// Run PCA immediately (synchronous, deterministic)
const pcaResult = getResult('pca');
applyLayout(pcaResult.positions);

// ─── Biplot (PCA-only) ────────────────────────────────────────────────────────

let biplotVisible = false;
const biplotGroup = createBiplot(svg, center, featureNames, pcaResult.pc1, pcaResult.pc2, pcaResult.positions);

// ─── SVG nodes ────────────────────────────────────────────────────────────────

const nodeGroups = [];
for (const a of authors) {
  const g      = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  const label  = document.createElementNS("http://www.w3.org/2000/svg", "text");

  g.classList.add("node");
  circle.setAttribute("r", 26);
  label.setAttribute("dy", "5");
  label.textContent = a.name.split(" ")[0];

  g.appendChild(circle);
  g.appendChild(label);
  svg.appendChild(g);
  nodeGroups.push({ a, g, circle, label });

  g.addEventListener("click", () => { selected = a; updateInfo(); });
}

// ─── Info panel ───────────────────────────────────────────────────────────────

let selected = authors[0];

function updateInfo() {
  selectedName.textContent = selected.name;
  selectedBio.textContent  = selected.bio;
  featureBars.innerHTML    = "";
  selected.features.forEach((v, i) => {
    const name = document.createElement("div");
    name.textContent = featureNames[i];
    const bar  = document.createElement("div"); bar.className = "bar";
    const fill = document.createElement("span"); fill.style.width = `${Math.round(v * 100)}%`;
    bar.appendChild(fill);
    featureBars.appendChild(name);
    featureBars.appendChild(bar);
  });
  nodeGroups.forEach(({ g, a }) => g.classList.toggle("selected", a === selected));
}

updateInfo();

// ─── Target layout ────────────────────────────────────────────────────────────

function computeTargets() {
  const maxDist = Math.sqrt(dims * 4);
  for (const a of authors) {
    if (a === selected) { a.tx = center.x; a.ty = center.y; continue; }
    const d = Math.sqrt(a.z.reduce((s, v, i) => s + (v - selected.z[i]) ** 2, 0));
    const radius = 90 + Math.min(d / maxDist, 1) * 250;
    const angle  = Math.atan2(a.base.y - selected.base.y, a.base.x - selected.base.x);
    a.tx = center.x + Math.cos(angle) * radius;
    a.ty = center.y + Math.sin(angle) * radius;
  }
}

// ─── Physics ──────────────────────────────────────────────────────────────────

function tick() {
  computeTargets();

  for (const a of authors) {
    const k = a === selected ? 0.10 : 0.045;
    a.vx += (a.tx - a.x) * k;
    a.vy += (a.ty - a.y) * k;
  }

  for (let i = 0; i < authors.length; i++) {
    for (let j = i + 1; j < authors.length; j++) {
      const a = authors[i], b = authors[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      if (dist < 62) {
        const push = (62 - dist) * 0.0028;
        const nx = dx / dist, ny = dy / dist;
        a.vx -= nx * push; a.vy -= ny * push;
        b.vx += nx * push; b.vy += ny * push;
      }
    }
  }

  for (const a of authors) {
    a.vx *= 0.84; a.vy *= 0.84;
    a.x += a.vx;  a.y += a.vy;
  }

  render();
  requestAnimationFrame(tick);
}

function render() {
  for (const { a, g, circle, label } of nodeGroups) {
    const r = a === selected ? 36 : 28;
    circle.setAttribute("r", r);
    g.setAttribute("transform", `translate(${a.x.toFixed(2)}, ${a.y.toFixed(2)})`);
    label.textContent = a.name.split(" ").slice(-1)[0];
    label.setAttribute("y", r + 18);
  }
}

// ─── Algorithm switching ──────────────────────────────────────────────────────

let currentAlgo = 'pca';

function switchAlgo(algo) {
  currentAlgo = algo;
  const result = getResult(algo);
  applyLayout(result.positions);

  // Biplot only meaningful for PCA
  biplotGroup.style.display = (algo === 'pca' && biplotVisible) ? '' : 'none';

  algoBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.algo === algo));
}

algoBtns.forEach(btn => btn.addEventListener('click', () => switchAlgo(btn.dataset.algo)));

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

document.addEventListener("keydown", e => {
  if (e.key === "b" || e.key === "B") {
    if (currentAlgo !== 'pca') return;
    biplotVisible = !biplotVisible;
    biplotGroup.style.display = biplotVisible ? '' : 'none';
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

selected = authors[0];
updateInfo();
for (const a of authors) {
  a.x = a === selected ? center.x : a.base.x;
  a.y = a === selected ? center.y : a.base.y;
}
computeTargets();
tick();
