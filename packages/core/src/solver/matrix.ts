// Dense linear solver: Gauss-Jordan elimination with COMPLETE (row + column)
// pivoting. Complete pivoting is required because MNA matrices place a
// branch-current variable's pivot in a node KCL row (its own KVL row has a
// zero diagonal), which defeats row-only partial pivoting.

/**
 * Solve A x = b for x. Returns null if the system is singular
 * (e.g. contradictory ideal voltage sources in parallel).
 */
export function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (n === 0) return [];

  // Augmented matrix with column permutation tracking.
  const M: number[][] = A.map((row, i) => {
    const r = row.slice(0, n);
    while (r.length < n) r.push(0);
    r.push(b[i] ?? 0);
    return r;
  });
  const colPerm = Array.from({ length: n }, (_, i) => i); // current col -> original col
  const EPS = 1e-12;

  for (let col = 0; col < n; col++) {
    // Complete pivot: largest magnitude in remaining submatrix.
    let pr = col;
    let pc = col;
    let maxAbs = 0;
    for (let r = col; r < n; r++) {
      for (let c = col; c < n; c++) {
        const v = Math.abs(M[r][c]);
        if (v > maxAbs) {
          maxAbs = v;
          pr = r;
          pc = c;
        }
      }
    }
    if (maxAbs < EPS) return null; // singular

    if (pr !== col) {
      const tmp = M[col];
      M[col] = M[pr];
      M[pr] = tmp;
    }
    if (pc !== col) {
      for (let r = 0; r < n; r++) {
        const tmp = M[r][col];
        M[r][col] = M[r][pc];
        M[r][pc] = tmp;
      }
      const t = colPerm[col];
      colPerm[col] = colPerm[pc];
      colPerm[pc] = t;
    }

    const pivVal = M[col][col];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col] / pivVal;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  const xs = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) xs[i] = M[i][n] / M[i][i];

  // Undo column permutation: x[originalCol] = xs[currentCol].
  const x = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) x[colPerm[i]] = xs[i];
  return x;
}
