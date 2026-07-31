import React, { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { NODE_TYPES, PORT_COLORS } from './NodeTypes';
import PipelineNode from './PipelineNode';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Crosshair } from 'lucide-react';

export default function PipelineCanvas({
  nodes, edges, onNodesChange, onEdgesChange, onNodeSelect, selectedNodeId,
  isFullscreen, onToggleFullscreen
}) {
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [canvasOffset, setCanvasOffset] = useState({ x: 40, y: 40 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Auto-fit when nodes load
  const fitView = useCallback(() => {
    if (nodes.length === 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x + 200));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y + 100));
    const contentW = maxX - minX + 80;
    const contentH = maxY - minY + 80;
    const scaleX = rect.width / contentW;
    const scaleY = rect.height / contentH;
    const newZoom = Math.min(scaleX, scaleY, 1.2);
    const newOffX = (rect.width - contentW * newZoom) / 2 - minX * newZoom + 40;
    const newOffY = (rect.height - contentH * newZoom) / 2 - minY * newZoom + 40;
    setZoom(newZoom);
    setCanvasOffset({ x: newOffX, y: newOffY });
  }, [nodes]);

  const getCanvasPos = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left - canvasOffset.x) / zoom,
      y: (e.clientY - rect.top - canvasOffset.y) / zoom,
    };
  }, [canvasOffset, zoom]);

  const handleMouseMove = useCallback((e) => {
    const pos = getCanvasPos(e);
    setMousePos(pos);
    if (dragging) {
      onNodesChange(prev => prev.map(n =>
        n.id === dragging.nodeId
          ? { ...n, x: pos.x - dragging.offsetX, y: pos.y - dragging.offsetY }
          : n
      ));
    }
    if (panning) {
      setCanvasOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [dragging, panning, panStart, getCanvasPos, onNodesChange]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setPanning(false);
    if (connecting) setConnecting(null);
  }, [connecting]);

  const handleCanvasMouseDown = useCallback((e) => {
    if (e.target === canvasRef.current || e.target.classList.contains('canvas-bg')) {
      setPanning(true);
      setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
      onNodeSelect(null);
    }
  }, [canvasOffset, onNodeSelect]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const delta = e.deltaY > 0 ? 0.88 : 1.12;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setZoom(z => {
      const newZoom = Math.min(Math.max(z * delta, 0.2), 3);
      const ratio = newZoom / z;
      setCanvasOffset(prev => ({
        x: mouseX - (mouseX - prev.x) * ratio,
        y: mouseY - (mouseY - prev.y) * ratio,
      }));
      return newZoom;
    });
  }, []);

  const startNodeDrag = useCallback((nodeId, e) => {
    e.stopPropagation();
    const pos = getCanvasPos(e);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDragging({ nodeId, offsetX: pos.x - node.x, offsetY: pos.y - node.y });
    onNodeSelect(nodeId);
  }, [nodes, getCanvasPos, onNodeSelect]);

  const startConnect = useCallback((nodeId, portType, portLabel, e) => {
    e.stopPropagation();
    const pos = getCanvasPos(e);
    setConnecting({ nodeId, portType, portLabel, mouseX: pos.x, mouseY: pos.y });
  }, [getCanvasPos]);

  const finishConnect = useCallback((targetNodeId, portType, portLabel) => {
    if (!connecting || connecting.nodeId === targetNodeId) { setConnecting(null); return; }
    const exists = edges.find(e => e.from === connecting.nodeId && e.to === targetNodeId && e.fromPort === connecting.portLabel && e.toPort === portLabel);
    if (!exists) {
      onEdgesChange(prev => [...prev, {
        id: `edge_${Date.now()}`,
        from: connecting.nodeId,
        to: targetNodeId,
        fromPort: connecting.portLabel,
        toPort: portLabel,
        portType: connecting.portType,
      }]);
    }
    setConnecting(null);
  }, [connecting, edges, onEdgesChange]);

  const removeEdge = useCallback((edgeId) => {
    onEdgesChange(prev => prev.filter(e => e.id !== edgeId));
  }, [onEdgesChange]);

  const getPortPos = useCallback((nodeId, portLabel, isOutput) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const type = NODE_TYPES[node.type];
    const ports = isOutput ? (type?.outputs || []) : (type?.inputs || []);
    const idx = ports.indexOf(portLabel);
    const count = ports.length;
    const nodeW = 200;
    const nodeH = 80;
    const x = node.x + (isOutput ? nodeW : 0);
    const y = node.y + nodeH / 2 + (idx - (count - 1) / 2) * 24;
    return { x, y };
  }, [nodes]);

  const getEdgeColor = (portType) => {
    const colors = { data: '#00f0ff', train: '#34d399', test: '#fbbf24', model: '#a78bfa' };
    return colors[portType] || '#00f0ff';
  };

  const getEdgeLabel = (portType) => {
    const labels = { data: 'dados', train: 'treino', test: 'teste', model: 'modelo' };
    return labels[portType] || portType;
  };

  return (
    <div
      ref={canvasRef}
      className={cn(
        'relative w-full h-full overflow-hidden select-none',
        isFullscreen
          ? 'fixed inset-0 z-50 rounded-none border-0'
          : 'rounded-lg border border-primary/20',
        'cursor-grab active:cursor-grabbing',
      )}
      style={{ background: 'hsl(220 45% 3%)' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseDown={handleCanvasMouseDown}
      onWheel={handleWheel}
    >
      {/* Dot grid background */}
      <div className="absolute inset-0 canvas-bg pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle, hsl(185 100% 50% / 0.12) 1px, transparent 1px)
          `,
          backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
          backgroundPosition: `${canvasOffset.x % (28 * zoom)}px ${canvasOffset.y % (28 * zoom)}px`,
        }}
      />

      {/* Axis lines faint */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(hsl(185 100% 50% / 0.06) 1px, transparent 1px),
            linear-gradient(90deg, hsl(185 100% 50% / 0.06) 1px, transparent 1px)
          `,
          backgroundSize: `${140 * zoom}px ${140 * zoom}px`,
          backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`,
        }}
      />

      {/* SVG layer for edges */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <defs>
          {['data', 'train', 'test', 'model'].map(type => (
            <marker key={type} id={`arrow-${type}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={getEdgeColor(type)} opacity="0.8" />
            </marker>
          ))}
        </defs>
        <g transform={`translate(${canvasOffset.x}, ${canvasOffset.y}) scale(${zoom})`}>
          {edges.map(edge => {
            const from = getPortPos(edge.from, edge.fromPort, true);
            const to = getPortPos(edge.to, edge.toPort, false);
            const mx = (from.x + to.x) / 2;
            const color = getEdgeColor(edge.portType);
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            return (
              <g key={edge.id} style={{ pointerEvents: 'stroke' }} onClick={() => removeEdge(edge.id)}>
                {/* Glow effect */}
                <path
                  d={`M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`}
                  stroke={color}
                  strokeWidth="6"
                  fill="none"
                  opacity="0.08"
                />
                {/* Main line */}
                <path
                  d={`M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`}
                  stroke={color}
                  strokeWidth="2"
                  fill="none"
                  opacity="0.85"
                  markerEnd={`url(#arrow-${edge.portType || 'data'})`}
                  style={{ filter: `drop-shadow(0 0 3px ${color}88)` }}
                />
                {/* Transparent click target */}
                <path
                  d={`M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`}
                  stroke="transparent"
                  strokeWidth="12"
                  fill="none"
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                />
                {/* Edge label on hover / static if zoomed in */}
                {zoom > 0.7 && (
                  <text
                    x={midX}
                    y={midY - 4}
                    textAnchor="middle"
                    fontSize="9"
                    fill={color}
                    opacity="0.6"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {getEdgeLabel(edge.portType)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Connecting preview line */}
          {connecting && (() => {
            const from = getPortPos(connecting.nodeId, connecting.portLabel, true);
            const mx = (from.x + mousePos.x) / 2;
            return (
              <path
                d={`M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`}
                stroke="hsl(185 100% 50%)"
                strokeWidth="2"
                fill="none"
                strokeDasharray="6 4"
                opacity="0.6"
              />
            );
          })()}
        </g>
      </svg>

      {/* Nodes layer */}
      <div
        className="absolute"
        style={{
          transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          zIndex: 2,
        }}
      >
        {nodes.map(node => (
          <PipelineNode
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            onDragStart={startNodeDrag}
            onStartConnect={startConnect}
            onFinishConnect={finishConnect}
            connecting={connecting}
          />
        ))}
      </div>

      {/* Controls overlay */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={() => setZoom(z => Math.min(z * 1.2, 3))}
          className="w-7 h-7 rounded-md bg-card/80 backdrop-blur-sm border border-border/30 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(z * 0.8, 0.2))}
          className="w-7 h-7 rounded-md bg-card/80 backdrop-blur-sm border border-border/30 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={fitView}
          className="w-7 h-7 rounded-md bg-card/80 backdrop-blur-sm border border-border/30 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
          title="Ajustar à tela"
        >
          <Crosshair className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => { setZoom(1); setCanvasOffset({ x: 40, y: 40 }); }}
          className="w-7 h-7 rounded-md bg-card/80 backdrop-blur-sm border border-border/30 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
          title="Reset view"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="w-7 h-7 rounded-md bg-primary/20 border border-primary/40 flex items-center justify-center text-primary hover:bg-primary/30 transition-all"
            title={isFullscreen ? 'Sair do fullscreen' : 'Expandir fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-3 left-3 z-10 text-[9px] font-mono text-primary/40 pointer-events-none bg-card/60 rounded px-1.5 py-0.5">
        {Math.round(zoom * 100)}% · {nodes.length} nós · {edges.length} arestas
      </div>

      {/* Fullscreen close hint */}
      {isFullscreen && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 text-[9px] font-mono text-primary/50 bg-card/70 rounded px-2 py-1 pointer-events-none border border-border/20">
          ESC ou clique em <span className="text-primary">⤡</span> para sair do fullscreen
        </div>
      )}

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-primary/20 flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-primary/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground/60 font-semibold">Canvas vazio</p>
              <p className="text-xs text-muted-foreground/40 mt-1">Arraste blocos da paleta ou carregue um template</p>
              <p className="text-[10px] text-muted-foreground/30 mt-1">Scroll = zoom · Arraste fundo = mover · Porte ● = conectar</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}