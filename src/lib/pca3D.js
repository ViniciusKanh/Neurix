/**
 * Real PCA, K-Means, DBSCAN implementations for 3D visualization
 */

/** Standardize data (z-score normalization) */
function standardize(data) {
  const n = data.length;
  const d = data[0].length;
  const means = Array(d).fill(0);
  const stds = Array(d).fill(0);

  for (let i = 0; i < n; i++)
    for (let j = 0; j < d; j++)
      means[j] += data[i][j];

  for (let j = 0; j < d; j++) means[j] /= n;

  for (let i = 0; i < n; i++)
    for (let j = 0; j < d; j++)
      stds[j] += (data[i][j] - means[j]) ** 2;

  for (let j = 0; j < d; j++) stds[j] = Math.sqrt(stds[j] / n) || 1;

  return data.map(row => row.map((v, j) => (v - means[j]) / stds[j]));
}

/** Dot product of two vectors */
function dot(a, b) {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

/** Multiply matrix by vector */
function matvecMul(matrix, vec) {
  const n = matrix.length;
  const d = vec.length;
  const result = Array(n).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < d; j++)
      result[i] += matrix[i][j] * vec[j];
  return result;
}

/** L2 norm of a vector */
function norm(vec) {
  return Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
}

/** Normalize a vector */
function normalize(vec) {
  const n = norm(vec);
  if (n === 0) return vec;
  return vec.map(v => v / n);
}

/** Power iteration to find dominant eigenvector of a matrix */
function powerIteration(matrix, maxIter = 200, tol = 1e-8) {
  const d = matrix.length;
  let vec = Array(d).fill(0).map(() => Math.random() * 2 - 1);
  vec = normalize(vec);

  for (let iter = 0; iter < maxIter; iter++) {
    const newVec = matvecMul(matrix, vec);
    const eigenvalue = dot(vec, newVec);
    vec = normalize(newVec);
    const residual = norm(matvecMul(matrix, vec).map((v, i) => v - eigenvalue * vec[i]));
    if (residual < tol) break;
  }
  return vec;
}

/** Deflate matrix: M' = M - lambda * v * v^T */
function deflate(matrix, eigenvector, eigenvalue) {
  const d = matrix.length;
  return matrix.map((row, i) =>
    row.map((v, j) => v - eigenvalue * eigenvector[i] * eigenvector[j])
  );
}

/**
 * Compute PCA and project data to 3 components.
 * Returns { points, explained_variance, components }
 */
export function computePCA(data, nComponents = 3) {
  const n = data.length;
  if (n === 0) return null;
  const d = data[0].length;
  const actualComponents = Math.min(nComponents, d);

  const standardized = standardize(data);

  // Covariance matrix (d x d)
  const cov = Array.from({ length: d }, () => Array(d).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < d; j++)
      for (let k = 0; k < d; k++)
        cov[j][k] += standardized[i][j] * standardized[i][k];

  for (let j = 0; j < d; j++)
    for (let k = 0; k < d; k++)
      cov[j][k] /= (n - 1);

  // Power iteration with deflation
  const eigenvectors = [];
  const eigenvalues = [];
  let currentMatrix = cov.map(row => [...row]);

  for (let c = 0; c < actualComponents; c++) {
    const vec = powerIteration(currentMatrix);
    const eigenval = dot(vec, matvecMul(cov, vec));
    eigenvectors.push(vec);
    eigenvalues.push(eigenval);
    currentMatrix = deflate(currentMatrix, vec, eigenval);
  }

  const totalVariance = eigenvalues.reduce((s, v) => s + v, 0);
  const explained = eigenvalues.map(v => v / totalVariance);

  // Project data
  const points = standardized.map(row =>
    eigenvectors.map(comp => dot(row, comp))
  );

  // Normalize to range [-5, 5] for each component
  const mins = Array(actualComponents).fill(Infinity);
  const maxs = Array(actualComponents).fill(-Infinity);
  for (const p of points) {
    for (let c = 0; c < actualComponents; c++) {
      if (p[c] < mins[c]) mins[c] = p[c];
      if (p[c] > maxs[c]) maxs[c] = p[c];
    }
  }
  const ranges = mins.map((mn, c) => maxs[c] - mn || 1);

  const normalizedPoints = points.map(p =>
    actualComponents === 1
      ? [((p[0] - mins[0]) / ranges[0]) * 10 - 5, 0, 0]
      : actualComponents === 2
      ? [((p[0] - mins[0]) / ranges[0]) * 10 - 5, ((p[1] - mins[1]) / ranges[1]) * 10 - 5, 0]
      : [((p[0] - mins[0]) / ranges[0]) * 10 - 5, ((p[1] - mins[1]) / ranges[1]) * 10 - 5, ((p[2] - mins[2]) / ranges[2]) * 10 - 5]
  );

  return {
    points: normalizedPoints,
    explained_variance: explained.slice(0, actualComponents),
    components: eigenvectors,
    total_explained: explained.reduce((s, v) => s + v, 0),
    num_features: d,
    num_components: actualComponents,
  };
}

/**
 * K-Means++ clustering
 * Returns { labels, centroids, iterations, silhouette }
 */
export function kmeans(data, k, maxIter = 100, tol = 1e-4) {
  const n = data.length;
  const d = data[0].length;
  if (k >= n) k = Math.max(2, Math.floor(n / 3));

  // K-Means++ initialization
  const centroids = [];
  centroids.push(data[Math.floor(Math.random() * n)].slice());

  for (let c = 1; c < k; c++) {
    const dists = data.map(p => {
      let minDist = Infinity;
      for (const cent of centroids) {
        const d2 = p.reduce((s, v, i) => s + (v - cent[i]) ** 2, 0);
        if (d2 < minDist) minDist = d2;
      }
      return minDist;
    });
    const total = dists.reduce((s, d) => s + d, 0);
    let r = Math.random() * total;
    let chosen = 0;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) { chosen = i; break; }
    }
    centroids.push(data[chosen].slice());
  }

  let labels = Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign
    let changed = false;
    for (let i = 0; i < n; i++) {
      let bestDist = Infinity;
      let bestLabel = 0;
      for (let c = 0; c < k; c++) {
        const d2 = data[i].reduce((s, v, j) => s + (v - centroids[c][j]) ** 2, 0);
        if (d2 < bestDist) { bestDist = d2; bestLabel = c; }
      }
      if (bestLabel !== labels[i]) changed = true;
      labels[i] = bestLabel;
    }

    // Update centroids
    const counts = Array(k).fill(0);
    const newCentroids = Array.from({ length: k }, () => Array(d).fill(0));
    for (let i = 0; i < n; i++) {
      const c = labels[i];
      counts[c]++;
      for (let j = 0; j < d; j++) newCentroids[c][j] += data[i][j];
    }
    for (let c = 0; c < k; c++)
      if (counts[c] > 0)
        for (let j = 0; j < d; j++)
          centroids[c][j] = newCentroids[c][j] / counts[c];

    if (!changed) break;
  }

  // Silhouette score
  const a = Array(n).fill(0);
  const b = Array(n).fill(Infinity);
  const counts = Array(k).fill(0);
  for (let i = 0; i < n; i++) counts[labels[i]]++;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dist = Math.sqrt(data[i].reduce((s, v, d) => s + (v - data[j][d]) ** 2, 0));
      if (labels[i] === labels[j]) a[i] += dist;
      else if (dist < b[i]) b[i] = dist;
    }
    a[i] = counts[labels[i]] > 1 ? a[i] / (counts[labels[i]] - 1) : 0;
  }

  const silhouettes = Array(n).fill(0).map((_, i) =>
    Math.max(a[i], b[i]) > 0 ? (b[i] - a[i]) / Math.max(a[i], b[i]) : 0
  );
  const silhouette = silhouettes.reduce((s, v) => s + v, 0) / n;

  return { labels, centroids, silhouettes, silhouette };
}

/**
 * DBSCAN clustering
 * Returns { labels, core_samples }
 */
export function dbscan(data, eps = 0.8, minPts = 5) {
  const n = data.length;
  const labels = Array(n).fill(-1); // -1 = noise
  let clusterId = 0;

  function getNeighbors(idx) {
    return data.reduce((neighbors, p, i) => {
      if (i === idx) return neighbors;
      const dist = Math.sqrt(data[idx].reduce((s, v, d) => s + (v - p[d]) ** 2, 0));
      if (dist <= eps) neighbors.push(i);
      return neighbors;
    }, []);
  }

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue;
    const neighbors = getNeighbors(i);
    if (neighbors.length < minPts) {
      labels[i] = -1; // noise
    } else {
      const id = clusterId++;
      labels[i] = id;
      const queue = [...neighbors];
      while (queue.length > 0) {
        const q = queue.shift();
        if (labels[q] === -1) {
          labels[q] = id;
          const qNeighbors = getNeighbors(q);
          if (qNeighbors.length >= minPts) queue.push(...qNeighbors);
        }
      }
    }
  }

  return { labels };
}

/**
 * Parse CSV text into array of arrays
 */
export function parseCSV(text, delimiter = ',') {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Handle quoted fields
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    data.push(fields);
  }

  return { headers, data };
}

/**
 * Extract numeric features from parsed CSV data
 */
export function extractNumericFeatures(headers, rows) {
  // Determine which columns are numeric
  const numericIndices = [];
  const numericHeaders = [];

  for (let j = 0; j < headers.length; j++) {
    let allNumeric = true;
    let hasValues = false;
    for (let i = 0; i < Math.min(rows.length, 100); i++) {
      const val = rows[i]?.[j];
      if (val === undefined || val === null || val === '') continue;
      hasValues = true;
      if (isNaN(parseFloat(val)) && val.trim() !== '') {
        allNumeric = false;
        break;
      }
    }
    if (allNumeric && hasValues) {
      numericIndices.push(j);
      numericHeaders.push(headers[j]);
    }
  }

  if (numericIndices.length === 0) return { features: [], featureHeaders: [], rowsProcessed: 0 };

  // Extract numeric matrix (up to 1500 rows for performance)
  const maxRows = Math.min(rows.length, 1500);
  const features = [];

  for (let i = 0; i < maxRows; i++) {
    const row = [];
    let valid = true;
    for (const j of numericIndices) {
      const val = parseFloat(rows[i]?.[j]);
      if (isNaN(val)) {
        valid = false;
        break;
      }
      row.push(val);
    }
    if (valid) features.push(row);
  }

  // Impute missing with mean
  if (features.length === 0) return { features: [], featureHeaders: [], rowsProcessed: 0 };

  const means = Array(numericIndices.length).fill(0);
  for (const row of features)
    for (let j = 0; j < row.length; j++)
      means[j] += row[j];
  for (let j = 0; j < means.length; j++) means[j] /= features.length;

  return {
    features,
    featureHeaders: numericHeaders,
    rowsProcessed: features.length,
  };
}