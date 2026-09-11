/**
 * exportDataset.js — download a row array as Excel (.xlsx) or CSV so the user
 * can re-import the transformed dataset. Browser-side; xlsx is loaded on demand.
 */

// Excel export via SheetJS (already a project dependency).
export async function exportRowsToExcel(rows, filename = 'dataset.xlsx', sheetName = 'Dados') {
  if (!rows?.length) throw new Error('Nenhuma linha para exportar.');
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

// CSV export (UTF-8 with BOM so Excel opens accents correctly).
export function exportRowsToCSV(rows, filename = 'dataset.csv') {
  if (!rows?.length) throw new Error('Nenhuma linha para exportar.');
  const cols = Object.keys(rows[0]);
  const esc = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const safe = (s) => String(s || 'dataset').replace(/[^\w.-]+/g, '_');
export const excelName = (base) => `${safe(base)}.xlsx`;
export const csvName = (base) => `${safe(base)}.csv`;
