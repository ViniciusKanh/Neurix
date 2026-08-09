import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { MapPin, Loader2 } from 'lucide-react';
import { getDataset } from '@/lib/datasetStore';

const PALETTE = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#f87171', '#4ade80'];
const isNum = (t) => ['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64', 'double'].includes((t || '').toLowerCase());
const guessLat = (cols) => cols.find((c) => /^lat|latitude|_lat/i.test(c)) || '';
const guessLon = (cols) => cols.find((c) => /^(lon|lng|long)|longitude|_lon|_lng/i.test(c)) || '';

export default function GeoMining() {
  const [projectId, setProjectId] = useState('');
  const [rows, setRows] = useState(null);
  const [state, setState] = useState('none');
  const [latCol, setLatCol] = useState('');
  const [lonCol, setLonCol] = useState('');
  const [colorCol, setColorCol] = useState('__none__');

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 100) });
  const project = projects.find((p) => p.id === projectId);
  const cols = (project?.column_info || []).map((c) => c.name);

  useEffect(() => {
    let alive = true; setRows(null); setLatCol(''); setLonCol(''); setColorCol('__none__');
    if (!projectId) { setState('none'); return; }
    setState('loading');
    (async () => {
      try {
        const d = await getDataset(projectId);
        if (!alive) return;
        if (!d?.rows?.length) { setState('missing'); return; }
        setRows(d.rows); setState('ready');
        const keys = Object.keys(d.rows[0]);
        setLatCol(guessLat(keys)); setLonCol(guessLon(keys));
      } catch { if (alive) setState('missing'); }
    })();
    return () => { alive = false; };
  }, [projectId]);

  const points = useMemo(() => {
    if (!rows || !latCol || !lonCol) return [];
    const cap = 2000; const stepN = Math.ceil(rows.length / cap);
    const out = [];
    rows.forEach((r, i) => {
      if (i % stepN !== 0) return;
      const lat = parseFloat(r[latCol]), lon = parseFloat(r[lonCol]);
      if (isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
      out.push({ lat, lon, c: colorCol !== '__none__' ? r[colorCol] : null });
    });
    return out;
  }, [rows, latCol, lonCol, colorCol]);

  const colorScale = useMemo(() => {
    if (colorCol === '__none__' || !points.length) return () => '#22d3ee';
    const info = (project?.column_info || []).find((c) => c.name === colorCol);
    if (info && isNum(info.type)) {
      const vals = points.map((p) => parseFloat(p.c)).filter((v) => !isNaN(v));
      const mn = Math.min(...vals), mx = Math.max(...vals), rng = (mx - mn) || 1;
      return (v) => { const t = (parseFloat(v) - mn) / rng; const h = 190 - t * 190; return `hsl(${h},85%,55%)`; };
    }
    const cats = [...new Set(points.map((p) => String(p.c ?? '')))];
    return (v) => PALETTE[cats.indexOf(String(v ?? '')) % PALETTE.length];
  }, [colorCol, points, project]);

  const center = useMemo(() => {
    if (!points.length) return [0, 0];
    const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const lon = points.reduce((s, p) => s + p.lon, 0) / points.length;
    return [lat, lon];
  }, [points]);

  const hasCoords = latCol && lonCol && points.length > 0;

  return (
    <div>
      <PageHeader title="Mineração Geoespacial" subtitle="Visualize e explore seus dados em mapa — pontos coloridos por categoria ou valor" icon={MapPin} />

      <GlowCard className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Projeto</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{projects.filter((p) => p.dataset_file_url).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Latitude</label>
            <Select value={latCol} onValueChange={setLatCol} disabled={state !== 'ready'}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="coluna lat" /></SelectTrigger>
              <SelectContent>{cols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Longitude</label>
            <Select value={lonCol} onValueChange={setLonCol} disabled={state !== 'ready'}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="coluna lon" /></SelectTrigger>
              <SelectContent>{cols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Colorir por (opcional)</label>
            <Select value={colorCol} onValueChange={setColorCol} disabled={state !== 'ready'}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none__">Cor única</SelectItem>{cols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {state === 'ready' && !hasCoords && <p className="text-[11px] text-amber-400 mt-2">Selecione colunas de latitude e longitude válidas (não detectadas automaticamente).</p>}
        {state === 'missing' && <p className="text-[11px] text-amber-400 mt-2">Dataset não está neste dispositivo — reenvie no ML Studio.</p>}
        {hasCoords && <p className="text-[11px] text-muted-foreground mt-2">{points.length.toLocaleString('pt-BR')} ponto(s) plotado(s){rows.length > points.length ? ` (amostra de ${rows.length.toLocaleString('pt-BR')})` : ''}.</p>}
      </GlowCard>

      {state === 'loading' ? (
        <div className="flex items-center gap-2 justify-center py-20 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
      ) : !hasCoords ? (
        <EmptyState icon={MapPin} title="Sem coordenadas no mapa" description="Escolha um projeto com colunas de latitude/longitude (ex.: lat, lon, latitude, longitude)." />
      ) : (
        <GlowCard className="overflow-hidden p-0">
          <MapContainer key={`${center[0]},${center[1]}`} center={center} zoom={4} style={{ height: '65vh', width: '100%', background: '#0b1220' }} scrollWheelZoom>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {points.map((p, i) => (
              <CircleMarker key={i} center={[p.lat, p.lon]} radius={5} pathOptions={{ color: colorScale(p.c), fillColor: colorScale(p.c), fillOpacity: 0.7, weight: 1 }}>
                <LTooltip>{colorCol !== '__none__' ? `${colorCol}: ${p.c} · ` : ''}{p.lat.toFixed(4)}, {p.lon.toFixed(4)}</LTooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </GlowCard>
      )}
    </div>
  );
}
