
function covMatrix(Z) {
  const n = Z.length, d = Z[0].length;
  const C = Array.from({ length: d }, () => Array(d).fill(0));
  for (let i = 0; i < d; i++)
    for (let j = i; j < d; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += Z[k][i] * Z[k][j];
      C[i][j] = C[j][i] = s / (n - 1);
    }
  return C;
}

function matVec(A, v) {
  return A.map(row => row.reduce((s, x, i) => s + x * v[i], 0));
}

function normalize(v) {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map(x => x / n);
}

function dot(a, b) {
  return a.reduce((s, x, i) => s + x * b[i], 0);
}

function powerIter(A, iters = 80) {
  let v = normalize(Array.from({ length: A.length }, () => Math.random() - 0.5));
  for (let i = 0; i < iters; i++) v = normalize(matVec(A, v));
  const Av = matVec(A, v);
  return { v, lambda: dot(v, Av) };
}

function fixSign(pc) {
  const mi = pc.reduce((m, v, i, a) => Math.abs(v) > Math.abs(a[m]) ? i : m, 0);
  if (pc[mi] < 0) for (let i = 0; i < pc.length; i++) pc[i] = -pc[i];
}

function runPCA(Z) {
  const C = covMatrix(Z);
  const { v: pc1, lambda } = powerIter(C);

  // Deflate and find second component
  const deflated = C.map((row, i) => row.map((v, j) => v - lambda * pc1[i] * pc1[j]));
  const { v: pc2 } = powerIter(deflated);

  fixSign(pc1);
  fixSign(pc2);

  return {
    positions: Z.map(z => ({ x: dot(z, pc1), y: dot(z, pc2) })),
    pc1,
    pc2,
  };
}
