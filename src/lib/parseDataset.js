/**
 * Dataset parsing (browser, no server) — supports CSV/TSV/TXT and Excel (XLSX/XLS).
 * Returns { columns, row_count, data_sample }.
 * Each column includes: name, type, unique_count, null_percent, sample_values,
 * and value_counts (top categories) for low-cardinality columns — used by the
 * balancing analysis.
 */

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;

function inferAndBuildColumns(headers, dataRows) {
  return headers.map((h) => {
    const values = dataRows.map((r) => r[h]).filter((v) => v !== '' && v !== undefined && v !== null);
    const nullCount = dataRows.length - values.length;
    const numericLike = values.length > 0 && values.every((v) => NUMERIC_RE.test(String(v).trim()));
    const uniqueSet = new Set(values.map((v) => String(v)));
    const unique = uniqueSet.size;

    let value_counts = [];
    if (!numericLike && unique > 0 && unique <= 50) {
      const counts = {};
      for (const v of values) {
        const k = String(v);
        counts[k] = (counts[k] || 0) + 1;
      }
      value_counts = Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);
    }

    return {
      name: h,
      type: numericLike ? 'numeric' : 'categorical',
      unique_count: unique,
      null_percent: dataRows.length > 0 ? Math.round((nullCount / dataRows.length) * 100) : 0,
      sample_values: [...uniqueSet].slice(0, 5).map(String),
      value_counts,
      total_non_null: values.length,
    };
  });
}

function detectDelimiter(firstLine) {
  const delimiters = [',', ';', '\t', '|'];
  let delimiter = ',', maxCount = 0;
  for (const d of delimiters) {
    const count = firstLine.split(d).length;
    if (count > maxCount) { maxCount = count; delimiter = d; }
  }
  return delimiter;
}

function looksBinary(text) {
  // XLSX/ZIP files start with "PK"; also flag lots of replacement chars.
  if (/^PK\x03\x04/.test(text) || text.startsWith('PK')) return true;
  const sample = text.slice(0, 2000);
  const bad = (sample.match(/[�\x00-\x08\x0E-\x1F]/g) || []).length;
  return bad > sample.length * 0.05;
}

// ---- CSV / TSV / TXT -------------------------------------------------------
export function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        if (looksBinary(text)) {
          return reject(new Error('Arquivo binário detectado (parece Excel). Use o parser de Excel.'));
        }
        const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
        if (lines.length < 2) return reject(new Error('Arquivo vazio ou sem dados'));

        const delimiter = detectDelimiter(lines[0]);
        const parseRow = (line) => {
          const result = [];
          let current = '', inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') inQuotes = !inQuotes;
            else if (ch === delimiter && !inQuotes) { result.push(current.trim()); current = ''; }
            else current += ch;
          }
          result.push(current.trim());
          return result;
        };

        const headers = parseRow(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim());
        const dataRows = [];
        for (let i = 1; i < Math.min(lines.length, 5001); i++) {
          const vals = parseRow(lines[i]);
          const row = {};
          headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
          dataRows.push(row);
        }

        resolve({
          columns: inferAndBuildColumns(headers, dataRows),
          row_count: lines.length - 1,
          data_sample: dataRows.slice(0, 300),
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

// ---- Excel (XLSX / XLS) ----------------------------------------------------
export async function parseExcelFile(file) {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Planilha vazia');
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false });
  if (!rows || rows.length < 2) throw new Error('Planilha sem dados suficientes');

  const headers = rows[0].map((h, i) => (String(h).trim() || `coluna_${i + 1}`));
  const dataRows = [];
  for (let i = 1; i < Math.min(rows.length, 5001); i++) {
    const arr = rows[i];
    const row = {};
    headers.forEach((h, idx) => { row[h] = arr[idx] != null ? String(arr[idx]).trim() : ''; });
    dataRows.push(row);
  }

  return {
    columns: inferAndBuildColumns(headers, dataRows),
    row_count: rows.length - 1,
    data_sample: dataRows.slice(0, 300),
    sheet_name: sheetName,
    sheet_count: wb.SheetNames.length,
  };
}

// ---- Unified dispatcher ----------------------------------------------------
export async function parseAnyFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (['xlsx', 'xls', 'xlsm', 'xlsb'].includes(ext)) {
    return parseExcelFile(file);
  }
  if (['csv', 'tsv', 'txt'].includes(ext)) {
    return parseCSVFile(file);
  }
  // Unknown extension: try CSV first, fall back to Excel.
  try {
    return await parseCSVFile(file);
  } catch {
    return parseExcelFile(file);
  }
}
