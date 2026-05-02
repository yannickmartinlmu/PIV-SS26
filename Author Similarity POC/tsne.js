
function randn() {
  return Math.sqrt(-2 * Math.log(Math.random() || 1e-10)) * Math.cos(2 * Math.PI * Math.random());
}

function condP(D2, i, perplexity) {
  const ds = D2[i].map((d, j) => (j === i ? Infinity : d));
  let lo = 1e-10, hi = 1e10;
  for (let t = 0; t < 50; t++) {
    const s2 = (lo + hi) / 2;
    const exps = ds.map(d => isFinite(d) ? Math.exp(-d / (2 * s2)) : 0);
    const sum = exps.reduce((a, b) => a + b, 0) || 1e-10;
    const H = -exps.reduce((acc, e) => {
      const p = e / sum;
      return p > 0 ? acc + p * Math.log2(p) : acc;
    }, 0);
    if (H < Math.log2(perplexity)) lo = s2; else hi = s2;
  }
  const s2 = (lo + hi) / 2;
  const exps = ds.map(d => isFinite(d) ? Math.exp(-d / (2 * s2)) : 0);
  const sum = exps.reduce((a, b) => a + b, 0) || 1e-10;
  return exps.map(e => e / sum);
}

function runTSNE(Z, { perplexity = 4, iterations = 350, lr = 50 } = {}) {
  const n = Z.length;

  const D2 = Z.map((zi, i) => Z.map((zj, j) =>
    i === j ? 0 : zi.reduce((s, v, k) => s + (v - zj[k]) ** 2, 0)
  ));

  // Joint probability matrix P (symmetrised, early-exaggeration handled per-iter)
  const Pc = Z.map((_, i) => condP(D2, i, perplexity));
  const P = Z.map((_, i) => Z.map((_, j) =>
    Math.max((Pc[i][j] + Pc[j][i]) / (2 * n), 1e-12)
  ));

  let Y = Array.from({ length: n }, () => [randn() * 1e-4, randn() * 1e-4]);
  const vel = Array.from({ length: n }, () => [0, 0]);
  const gains = Array.from({ length: n }, () => [1, 1]);

  for (let iter = 0; iter < iterations; iter++) {
    const exagg = iter < 100 ? 4 : 1;
    const momentum = iter < 20 ? 0.5 : 0.8;

    // Student-t kernel in low-dim
    const inv = Y.map((yi, i) => Y.map((yj, j) => {
      if (i === j) return 0;
      const dx = yi[0] - yj[0], dy = yi[1] - yj[1];
      return 1 / (1 + dx * dx + dy * dy);
    }));
    let Zn = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) Zn += 2 * inv[i][j];
    Zn = Zn || 1;

    const grad = Array.from({ length: n }, () => [0, 0]);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const Q = Math.max(inv[i][j] / Zn, 1e-12);
        const f = 4 * (exagg * P[i][j] - Q) * inv[i][j];
        grad[i][0] += f * (Y[i][0] - Y[j][0]);
        grad[i][1] += f * (Y[i][1] - Y[j][1]);
      }
    }

    for (let i = 0; i < n; i++) {
      for (let d = 0; d < 2; d++) {
        const same = grad[i][d] * vel[i][d] >= 0;
        gains[i][d] = Math.max(0.01, same ? gains[i][d] * 0.8 : gains[i][d] + 0.2);
        vel[i][d] = momentum * vel[i][d] - lr * gains[i][d] * grad[i][d];
        Y[i][d] += vel[i][d];
      }
    }

    // Re-centre
    const mx = Y.reduce((s, y) => s + y[0], 0) / n;
    const my = Y.reduce((s, y) => s + y[1], 0) / n;
    Y.forEach(y => { y[0] -= mx; y[1] -= my; });
  }

  return { positions: Y.map(y => ({ x: y[0], y: y[1] })) };
}
