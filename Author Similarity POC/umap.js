
function runUMAP(Z, { nNeighbors = 4, iterations = 400, lr = 1.0 } = {}) {
  const n = Z.length;

  // Pairwise Euclidean distances
  const D = Z.map((zi, i) => Z.map((zj, j) =>
    Math.sqrt(zi.reduce((s, v, k) => s + (v - zj[k]) ** 2, 0))
  ));

  // k-NN (excluding self), sorted by distance
  const knn = D.map((row, i) =>
    row.map((d, j) => ({ d, j }))
      .filter(e => e.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, nNeighbors)
  );

  // rho_i = distance to nearest neighbour (local connectivity)
  const rho = knn.map(nb => Math.max(nb[0].d, 1e-10));

  // sigma_i: binary search so sum_k exp(-(d_k - rho) / sigma) = log2(k)
  function findSigma(i) {
    const target = Math.log2(nNeighbors);
    let lo = 1e-10, hi = 1e10;
    for (let t = 0; t < 64; t++) {
      const s = (lo + hi) / 2;
      const sum = knn[i].reduce((acc, { d }) => acc + Math.exp(-Math.max(0, d - rho[i]) / s), 0);
      if (sum < target) lo = s; else hi = s;
    }
    return (lo + hi) / 2;
  }
  const sigma = Array.from({ length: n }, (_, i) => findSigma(i));

  // High-dim fuzzy simplicial set weights
  const W = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (const { d, j } of knn[i])
      W[i][j] = Math.exp(-Math.max(0, d - rho[i]) / sigma[i]);

  // Symmetrise: w_ij + w_ji - w_ij * w_ji
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const s = W[i][j] + W[j][i] - W[i][j] * W[j][i];
      W[i][j] = s; W[j][i] = s;
    }

  // Random initialisation in [-1, 1]
  let Y = Array.from({ length: n }, () => [Math.random() * 2 - 1, Math.random() * 2 - 1]);

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = lr * (1 - iter / iterations);
    const newY = Y.map(y => [y[0], y[1]]);

    for (let i = 0; i < n; i++) {
      const g = [0, 0];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = Y[i][0] - Y[j][0];
        const dy = Y[i][1] - Y[j][1];
        const d2 = Math.max(dx * dx + dy * dy, 1e-6);
        const d2p1 = 1 + d2;

        // Attractive: pulls i toward j (adds to gradient, then we subtract gradient)
        const aF = 2 * W[i][j] / d2p1;
        // Repulsive: pushes i away from j (subtracts from gradient)
        const rF = 2 * (1 - W[i][j]) / (d2 * d2p1);

        g[0] += (aF - rF) * dx;
        g[1] += (aF - rF) * dy;
      }

      // Clip gradient magnitude
      const gm = Math.hypot(g[0], g[1]);
      if (gm > 4) { g[0] = g[0] / gm * 4; g[1] = g[1] / gm * 4; }

      newY[i][0] = Y[i][0] - alpha * g[0];
      newY[i][1] = Y[i][1] - alpha * g[1];
    }
    Y = newY;

    // Re-centre
    const mx = Y.reduce((s, y) => s + y[0], 0) / n;
    const my = Y.reduce((s, y) => s + y[1], 0) / n;
    Y.forEach(y => { y[0] -= mx; y[1] -= my; });
  }

  return { positions: Y.map(y => ({ x: y[0], y: y[1] })) };
}
