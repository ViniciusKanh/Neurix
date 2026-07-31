import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import GlowCard from '@/components/ui/GlowCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Slider } from '@/components/ui/slider';
import {
  Loader2, Network, RotateCcw, MousePointer2,
  Database, BarChart3, Layers, Activity, TrendingUp, HelpCircle,
  ZoomIn, ZoomOut, Maximize2, Navigation, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import { computePCA, kmeans, dbscan, parseCSV, extractNumericFeatures } from '@/lib/pca3D';
import { motion } from 'framer-motion';

const CLUSTER_COLORS = [
  '#00d4ff', '#ff6b9d', '#3ddc84', '#ffb347', '#9b59ff',
  '#e040fb', '#76ff03', '#ff5252', '#40c4ff', '#b2ff59',
];
const CLUSTER_COLORS_HEX = CLUSTER_COLORS.map(c => parseInt(c.replace('#', ''), 16));

/* ===========================
   SCENE 3D COMPONENT
   =========================== */
function Scene3D({ clusterData, hoveredCluster, setHoveredCluster, isRotating, setIsRotating }) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const animFrameRef = useRef(null);
  const pointMeshesRef = useRef([]);
  const centroidMeshesRef = useRef([]);
  const isRotatingRef = useRef(isRotating);
  const hoveredRef = useRef(hoveredCluster);

  // Smoother camera with inertia via lerp targets
  const targetRef = useRef({ theta: 0, phi: 0.5, radius: 16 });
  const currentRef = useRef({ theta: 0, phi: 0.5, radius: 16 });
  const mouseRef = useRef({ isDown: false, lastX: 0, lastY: 0 });
  const raycasterRef = useRef(new THREE.Raycaster());
  const mousePosRef = useRef(new THREE.Vector2());
  const autoAngleRef = useRef(0);

  useEffect(() => { isRotatingRef.current = isRotating; }, [isRotating]);
  useEffect(() => { hoveredRef.current = hoveredCluster; }, [hoveredCluster]);

  // Update point opacities based on hover
  useEffect(() => {
    const meshes = pointMeshesRef.current;
    const centroids = centroidMeshesRef.current;
    if (!meshes.length) return;
    meshes.forEach(m => {
      const ci = m.userData.cluster;
      const isDimmed = hoveredCluster !== null && ci !== hoveredCluster;
      m.material.opacity = isDimmed ? 0.15 : 0.9;
    });
    centroids.forEach(m => {
      const ci = m.userData.cluster;
      const isDimmed = hoveredCluster !== null && ci !== hoveredCluster;
      m.material.opacity = isDimmed ? 0.2 : 0.95;
    });
  }, [hoveredCluster]);

  useEffect(() => {
    if (!clusterData?.points || !mountRef.current) return;

    // Cleanup previous
    if (rendererRef.current) {
      rendererRef.current.dispose();
      while (mountRef.current.firstChild) mountRef.current.removeChild(mountRef.current.firstChild);
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const container = mountRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight || 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060d18);
    scene.fog = new THREE.FogExp2(0x060d18, 0.022);

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
    camera.position.set(16, 8, 16);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Grid
    const gridSize = 11;
    const gridHelper = new THREE.PolarGridHelper(gridSize, 32, 16, 64, 0x1a2a40, 0x1a2a40);
    scene.add(gridHelper);

    // Origin glow
    const originGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const originMat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 });
    const originMesh = new THREE.Mesh(originGeo, originMat);
    scene.add(originMesh);

    // Axes with labels
    const axisLen = 8;
    const axisDefs = [
      { dir: new THREE.Vector3(1, 0, 0), color: 0x00d4ff, label: 'PC1', labelColor: '#00d4ff' },
      { dir: new THREE.Vector3(0, 1, 0), color: 0x3ddc84, label: 'PC2', labelColor: '#3ddc84' },
      { dir: new THREE.Vector3(0, 0, 1), color: 0xff6b9d, label: 'PC3', labelColor: '#ff6b9d' },
    ];

    axisDefs.forEach(({ dir, color }) => {
      const pts = [new THREE.Vector3(0, 0, 0), dir.clone().multiplyScalar(axisLen)];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const matLine = new THREE.LineBasicMaterial({ color, opacity: 0.45, transparent: true });
      scene.add(new THREE.Line(geo, matLine));

      // Arrow head
      const coneGeo = new THREE.ConeGeometry(0.14, 0.4, 8);
      const coneMat = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.6 });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.copy(dir.clone().multiplyScalar(axisLen));
      if (dir.x === 1) cone.rotation.z = Math.PI / 2;
      else if (dir.z === 1) cone.rotation.x = Math.PI / 2;
      scene.add(cone);

      // Tick marks along axis
      for (let i = 2; i <= axisLen; i += 2) {
        const tickGeo = new THREE.SphereGeometry(0.06, 6, 6);
        const tick = new THREE.Mesh(tickGeo, new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.3 }));
        tick.position.copy(dir.clone().multiplyScalar(i));
        scene.add(tick);
      }
    });

    // Points
    const pointMeshes = [];
    const colors = clusterData.colors || CLUSTER_COLORS_HEX;
    const labels = clusterData.labels || clusterData.points.map(() => 0);
    const points = clusterData.points || [];

    points.forEach((p, i) => {
      const ci = labels[i] || 0;
      const colorHex = colors[ci % colors.length];
      const geo = new THREE.SphereGeometry(0.09, 10, 10);
      const mat = new THREE.MeshPhongMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p[0] || 0, p[1] || 0, p[2] || 0);
      mesh.userData = { idx: i, cluster: ci, point: p };
      scene.add(mesh);
      pointMeshes.push(mesh);
    });
    pointMeshesRef.current = pointMeshes;

    // Centroids
    const centroidMeshes = [];
    if (clusterData.centroids) {
      clusterData.centroids.forEach((c, ci) => {
        if (!c) return;
        const colorHex = colors[ci % colors.length];
        const ringGeo = new THREE.TorusGeometry(0.55, 0.07, 8, 24);
        const ringMat = new THREE.MeshPhongMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.9, transparent: true, opacity: 0.95 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(c[0] || 0, c[1] || 0, c[2] || 0);
        ring.userData = { isCentroid: true, cluster: ci };
        scene.add(ring);
        centroidMeshes.push(ring);
      });
    }
    centroidMeshesRef.current = centroidMeshes;

    // Lights
    scene.add(new THREE.AmbientLight(0x204060, 1.2));
    scene.add(new THREE.PointLight(0x00d4ff, 1.8, 60, 1.5)).position.set(12, 18, 12);
    scene.add(new THREE.PointLight(0x9b59ff, 1.2, 50, 1.5)).position.set(-12, 6, -12);
    scene.add(new THREE.PointLight(0xff6b9d, 0.7, 40, 2)).position.set(0, -8, 12);

    // Mouse interaction
    targetRef.current.theta = 0;
    targetRef.current.phi = 0.5;
    targetRef.current.radius = 16;
    currentRef.current.theta = 0;
    currentRef.current.phi = 0.5;
    currentRef.current.radius = 16;

    const onMouseDown = (e) => {
      mouseRef.current.isDown = true;
      mouseRef.current.lastX = e.clientX;
      mouseRef.current.lastY = e.clientY;
      setIsRotating(false);
    };
    const onMouseUp = () => { mouseRef.current.isDown = false; };
    const onMouseMove = (e) => {
      if (mouseRef.current.isDown) {
        const dx = (e.clientX - mouseRef.current.lastX) * 0.004;
        const dy = (e.clientY - mouseRef.current.lastY) * 0.004;
        targetRef.current.theta += dx;
        targetRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, targetRef.current.phi + dy));
        mouseRef.current.lastX = e.clientX;
        mouseRef.current.lastY = e.clientY;
      }
      // Hover
      const rect = renderer.domElement.getBoundingClientRect();
      mousePosRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mousePosRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mousePosRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(pointMeshes);
      if (intersects.length > 0) {
        const ci = intersects[0].object.userData.cluster;
        if (ci !== undefined && ci !== hoveredCluster) setHoveredCluster(ci);
      } else if (hoveredCluster !== null && !mouseRef.current.isDown) {
        setHoveredCluster(null);
      }
    };
    const onWheel = (e) => {
      e.preventDefault();
      targetRef.current.radius = Math.max(4, Math.min(40, targetRef.current.radius + e.deltaY * 0.03));
    };

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        mouseRef.current.isDown = true;
        mouseRef.current.lastX = e.touches[0].clientX;
        mouseRef.current.lastY = e.touches[0].clientY;
        setIsRotating(false);
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length === 1 && mouseRef.current.isDown) {
        const dx = (e.touches[0].clientX - mouseRef.current.lastX) * 0.004;
        const dy = (e.touches[0].clientY - mouseRef.current.lastY) * 0.004;
        targetRef.current.theta += dx;
        targetRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, targetRef.current.phi + dy));
        mouseRef.current.lastX = e.touches[0].clientX;
        mouseRef.current.lastY = e.touches[0].clientY;
      }
    };
    const onTouchEnd = () => { mouseRef.current.isDown = false; };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
    renderer.domElement.addEventListener('touchend', onTouchEnd);

    // Animation loop with smooth lerp
    const LERP_FACTOR = 0.08;
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const tgt = targetRef.current;
      const cur = currentRef.current;

      if (isRotatingRef.current) {
        autoAngleRef.current += 0.0035;
        tgt.theta = autoAngleRef.current;
        tgt.phi = 0.6;
        tgt.radius = 16;
      }

      // Smooth lerp
      cur.theta += (tgt.theta - cur.theta) * LERP_FACTOR;
      cur.phi += (tgt.phi - cur.phi) * LERP_FACTOR;
      cur.radius += (tgt.radius - cur.radius) * LERP_FACTOR;

      camera.position.x = cur.radius * Math.sin(cur.phi) * Math.cos(cur.theta);
      camera.position.y = cur.radius * Math.cos(cur.phi);
      camera.position.z = cur.radius * Math.sin(cur.phi) * Math.sin(cur.theta);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const nw = container.clientWidth;
      const nh = container.clientHeight || 520;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [clusterData]);

  const handleReset = () => {
    targetRef.current.theta = 0;
    targetRef.current.phi = 0.5;
    targetRef.current.radius = 16;
    setIsRotating(true);
  };

  if (!clusterData) {
    return (
      <div ref={mountRef} className="w-full aspect-[16/10] min-h-[420px] relative bg-[#060d18] rounded-lg flex items-center justify-center border border-border/20">
        <div className="text-center space-y-3">
          <Network className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground/70 font-mono">Selecione um projeto e gere a visualização</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={mountRef} className="w-full aspect-[16/10] min-h-[420px] relative bg-[#060d18] rounded-lg overflow-hidden border border-border/20">
      {/* Axis Labels Overlay */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
        <span className="text-[9px] font-mono font-bold" style={{ color: '#00d4ff' }}>PC1 →</span>
        <span className="text-[9px] font-mono font-bold" style={{ color: '#3ddc84' }}>PC2 ↑</span>
        <span className="text-[9px] font-mono font-bold" style={{ color: '#ff6b9d' }}>PC3 ⊙</span>
      </div>

      {/* Controls */}
      <div className="absolute top-3 right-3 flex gap-1.5 z-10">
        <button onClick={handleReset} title="Resetar câmera"
          className="h-7 w-7 rounded-lg bg-card/85 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors">
          <RotateCcw className="w-3 h-3" />
        </button>
        <button onClick={() => setIsRotating(!isRotating)}
          className={cn('h-7 px-2 rounded-lg text-[10px] font-medium border transition-all flex items-center gap-1',
            isRotating ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-card/85 border-border/50 text-muted-foreground hover:text-foreground'
          )}>
          {isRotating ? <><RotateCcw className="w-2.5 h-2.5 animate-spin" /> Auto</> : <><Navigation className="w-2.5 h-2.5" /> Pausado</>}
        </button>
      </div>

      {/* Zoom indicators */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
        <button onClick={() => { targetRef.current.radius = Math.max(4, targetRef.current.radius - 3); }}
          className="h-6 w-6 rounded-md bg-card/85 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <ZoomIn className="w-3 h-3" />
        </button>
        <button onClick={() => { targetRef.current.radius = Math.min(40, targetRef.current.radius + 3); }}
          className="h-6 w-6 rounded-md bg-card/85 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <ZoomOut className="w-3 h-3" />
        </button>
      </div>

      {/* Hover tooltip */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        {hoveredCluster !== null && clusterData.clusters?.[hoveredCluster] && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="bg-card/95 border border-border/60 rounded-lg px-3 py-2 shadow-lg"
          >
            <div className="flex items-center gap-2 text-[10px]">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[hoveredCluster % CLUSTER_COLORS.length] }} />
              <span className="font-semibold text-foreground">{clusterData.clusters[hoveredCluster].name}</span>
              <span className="text-muted-foreground font-mono">{clusterData.clusters[hoveredCluster].size} pontos</span>
              <span className="text-muted-foreground font-mono">{clusterData.clusters[hoveredCluster].percentage.toFixed(0)}%</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Interaction hint */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-card/90 border border-border/50 rounded-lg px-2.5 py-1.5 z-10">
        <MousePointer2 className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground hidden sm:inline">Arraste para girar · Scroll para zoom</span>
        <span className="text-[10px] text-muted-foreground sm:hidden">Arraste/zoom</span>
      </div>
    </div>
  );
}

/* ===========================
   METRIC TAG
   =========================== */
function MetricTag({ label, value, good, icon: Icon }) {
  return (
    <div className="flex items-center gap-1.5 bg-secondary/40 rounded-md px-2 py-1.5">
      {Icon && <Icon className="w-3 h-3 text-muted-foreground" />}
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-mono font-semibold ml-auto', good === true ? 'text-emerald-400' : good === false ? 'text-amber-400' : 'text-foreground')}>{value}</span>
    </div>
  );
}

/* ===========================
   MAIN PAGE
   =========================== */
export default function Visualization3D() {
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedProjectId, setSelectedProjectId] = useState(urlParams.get('project') || '');
  const [clusterData, setClusterData] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const [clusterMethod, setClusterMethod] = useState('kmeans');
  const [numClusters, setNumClusters] = useState(4);
  const [eps, setEps] = useState(1.0);
  const [hoveredCluster, setHoveredCluster] = useState(null);
  const [isRotating, setIsRotating] = useState(true);

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 50),
  });

  const projectsWithData = projects.filter(p => p.dataset_file_url);
  const project = projectsWithData.find(p => p.id === selectedProjectId);

  const handleGenerate = useCallback(async () => {
    if (!project?.dataset_file_url) return;
    setIsComputing(true);
    setClusterData(null);

    try {
      const response = await fetch(project.dataset_file_url);
      const text = await response.text();
      const { headers, data: rows } = parseCSV(text);
      const { features, featureHeaders } = extractNumericFeatures(headers, rows);

      if (features.length < 10 || featureHeaders.length < 2) {
        toast.error('Dataset precisa de pelo menos 2 colunas numéricas e 10 linhas');
        setIsComputing(false);
        return;
      }

      const pcaResult = computePCA(features, 3);
      if (!pcaResult) {
        toast.error('Não foi possível computar PCA');
        setIsComputing(false);
        return;
      }

      const points3D = pcaResult.points;
      let labels;
      let centroids;
      let silhouette;

      if (clusterMethod === 'kmeans') {
        const result = kmeans(points3D, numClusters);
        labels = result.labels;
        centroids = result.centroids;
        silhouette = result.silhouette;
      } else {
        const result = dbscan(points3D, eps, 5);
        labels = result.labels;
        const clusterPoints = {};
        labels.forEach((l, i) => {
          if (l < 0) return;
          if (!clusterPoints[l]) clusterPoints[l] = [];
          clusterPoints[l].push(points3D[i]);
        });
        centroids = Object.values(clusterPoints).map(pts => {
          const sum = [0, 0, 0];
          pts.forEach(p => { sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; });
          return [sum[0] / pts.length, sum[1] / pts.length, sum[2] / pts.length];
        });
        silhouette = null;
      }

      const actualK = new Set(labels.filter(l => l >= 0)).size;
      const clusterStats = [];
      for (let c = 0; c < actualK; c++) {
        const size = labels.filter(l => l === c).length;
        clusterStats.push({ name: `Grupo ${c + 1}`, size, percentage: (size / points3D.length) * 100 });
      }
      const noiseCount = labels.filter(l => l === -1).length;
      if (noiseCount > 0) {
        clusterStats.push({ name: 'Ruído', size: noiseCount, percentage: (noiseCount / points3D.length) * 100, isNoise: true });
      }

      setClusterData({
        points: points3D,
        labels,
        centroids,
        colors: clusterMethod === 'dbscan' && noiseCount > 0 ? [...CLUSTER_COLORS_HEX, 0x555555] : CLUSTER_COLORS_HEX,
        colorCSS: CLUSTER_COLORS,
        silhouette,
        explained: pcaResult.explained_variance,
        totalExplained: pcaResult.total_explained,
        clusters: clusterStats,
        numFeatures: pcaResult.num_features,
        numRows: points3D.length,
        featureHeaders: featureHeaders.slice(0, 10),
        projectName: project.name,
      });

      toast.success(`Visualização 3D gerada com ${points3D.length} pontos`);
    } catch (err) {
      console.error('Error computing 3D viz:', err);
      toast.error('Erro ao processar o dataset. Verifique o formato CSV.');
    } finally {
      setIsComputing(false);
    }
  }, [project, clusterMethod, numClusters, eps]);

  if (loadingProjects) return <LoadingSpinner text="Carregando projetos..." />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-xs text-primary/50 font-mono uppercase tracking-[0.2em] mb-0.5">[ analytics ]</p>
        <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight mb-1">
          <span className="text-gradient-primary">Visualização 3D</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Redução de dimensionalidade PCA com clustering K-Means ou DBSCAN aplicados sobre seus dados reais
        </p>
      </div>

      {/* Config Panel */}
      <GlowCard className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
              <Database className="w-3 h-3" /> Projeto com dados
            </Label>
            {projectsWithData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Envie um CSV em um projeto primeiro</p>
            ) : (
              <Select value={selectedProjectId} onValueChange={(v) => { setSelectedProjectId(v); setClusterData(null); }}>
                <SelectTrigger className="h-9 text-xs bg-secondary/50"><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
                <SelectContent>
                  {projectsWithData.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.name} <span className="text-muted-foreground ml-1">({p.dataset_size || '?'} linhas)</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Algoritmo
            </Label>
            <Select value={clusterMethod} onValueChange={setClusterMethod}>
              <SelectTrigger className="h-9 w-36 text-xs bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kmeans" className="text-xs">K-Means</SelectItem>
                <SelectItem value="dbscan" className="text-xs">DBSCAN</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {clusterMethod === 'kmeans' && (
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1">Clusters (k)</Label>
              <div className="flex items-center gap-2">
                <Slider value={[numClusters]} min={2} max={10} step={1} onValueChange={([v]) => setNumClusters(v)} className="w-20" />
                <span className="text-xs font-mono text-primary w-3">{numClusters}</span>
              </div>
            </div>
          )}

          {clusterMethod === 'dbscan' && (
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1">Distância (ε)</Label>
              <div className="flex items-center gap-2">
                <Slider value={[eps]} min={0.3} max={5} step={0.1} onValueChange={([v]) => setEps(v)} className="w-20" />
                <span className="text-xs font-mono text-primary w-6">{eps.toFixed(1)}</span>
              </div>
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={isComputing || !selectedProjectId}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 text-xs ml-auto"
          >
            {isComputing ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Processando...</>
            ) : (
              <><BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Gerar Visualização</>
            )}
          </Button>
        </div>
      </GlowCard>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* 3D Viewer */}
        <div className="lg:col-span-3">
          <Scene3D
            clusterData={clusterData}
            hoveredCluster={hoveredCluster}
            setHoveredCluster={setHoveredCluster}
            isRotating={isRotating}
            setIsRotating={setIsRotating}
          />
        </div>

        {/* Info Sidebar */}
        <div className="space-y-3">
          {clusterData && (
            <>
              {/* Metrics */}
              <GlowCard className="py-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Métricas PCA
                </p>
                <div className="space-y-1.5">
                  <MetricTag label="Dataset" value={clusterData.projectName} icon={Database} />
                  <MetricTag label="Pontos" value={clusterData.numRows} icon={BarChart3} />
                  <MetricTag label="Features" value={clusterData.numFeatures} icon={Layers} />
                  {clusterData.silhouette !== null && (
                    <MetricTag label="Silhouette" value={clusterData.silhouette.toFixed(3)} good={clusterData.silhouette > 0.4} icon={TrendingUp} />
                  )}
                  {clusterData.totalExplained !== undefined && (
                    <MetricTag label="Variância explicada" value={`${(clusterData.totalExplained * 100).toFixed(0)}%`} good={clusterData.totalExplained > 0.6} icon={Activity} />
                  )}
                </div>
              </GlowCard>

              {/* Eixos */}
              <GlowCard className="py-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Navigation className="w-3 h-3" /> Eixos (PC)
                </p>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">PC1</span>
                    <span className="font-mono text-[#00d4ff]">{clusterData.explained?.[0] !== undefined ? `${(clusterData.explained[0] * 100).toFixed(0)}%` : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">PC2</span>
                    <span className="font-mono text-[#3ddc84]">{clusterData.explained?.[1] !== undefined ? `${(clusterData.explained[1] * 100).toFixed(0)}%` : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">PC3</span>
                    <span className="font-mono text-[#ff6b9d]">{clusterData.explained?.[2] !== undefined ? `${(clusterData.explained[2] * 100).toFixed(0)}%` : '—'}</span>
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground/60 mt-2 leading-relaxed">
                  PC = Componente Principal. Reduz as dimensões dos dados preservando a variância.
                </p>
              </GlowCard>
            </>
          )}

          {/* Cluster Legend */}
          {clusterData?.clusters?.map((cluster, i) => {
            const isHovered = hoveredCluster === i;
            const colorHex = cluster.isNoise ? '#555555' : CLUSTER_COLORS[i % CLUSTER_COLORS.length];
            return (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <GlowCard
                  className={cn(
                    'py-3 cursor-pointer transition-all duration-200 group',
                    isHovered ? 'border-white/30 ring-1 ring-white/20 shadow-lg' : '',
                    cluster.isNoise ? 'border-muted-foreground/10 opacity-60 hover:opacity-80' : 'hover:border-border/60'
                  )}
                  onMouseEnter={() => !cluster.isNoise && setHoveredCluster(i)}
                  onMouseLeave={() => setHoveredCluster(null)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/15 group-hover:ring-white/30 transition-all"
                      style={{ backgroundColor: colorHex }}
                    />
                    <p className="text-xs font-semibold text-foreground truncate">{cluster.name}</p>
                    <span className="text-[10px] text-muted-foreground ml-auto font-mono tabular-nums">{cluster.size}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(cluster.percentage, 100)}%` }}
                        transition={{ duration: 0.6, delay: i * 0.05 }}
                        style={{ backgroundColor: colorHex }}
                      />
                    </div>
                    <span className="font-mono tabular-nums w-8 text-right">{cluster.percentage.toFixed(0)}%</span>
                  </div>
                </GlowCard>
              </motion.div>
            );
          })}

          {!clusterData && (
            <GlowCard className="py-8 text-center">
              <HelpCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground">Configure os parâmetros acima e clique em Gerar Visualização</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">Os grupos aparecerão aqui com métricas e legendas</p>
            </GlowCard>
          )}
        </div>
      </div>
    </div>
  );
}