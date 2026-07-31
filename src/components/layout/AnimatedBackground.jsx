import React, { useEffect, useRef } from 'react';

export default function AnimatedBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animFrame;
    let w, h;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Particles
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 1.5 + 0.3,
      opacity: Math.random() * 0.5 + 0.1,
      color: Math.random() > 0.7 ? '0,240,255' : Math.random() > 0.5 ? '0,200,150' : '180,100,255',
    }));

    // Grid nodes
    const gridNodes = [];
    const cols = 8, rows = 6;
    for (let i = 0; i <= cols; i++) {
      for (let j = 0; j <= rows; j++) {
        gridNodes.push({
          x: (i / cols) * window.innerWidth,
          y: (j / rows) * window.innerHeight,
          pulse: Math.random() * Math.PI * 2,
          speed: 0.02 + Math.random() * 0.02,
        });
      }
    }

    let tick = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      tick++;

      // Ambient glow orbs
      const orbs = [
        { x: w * 0.15, y: h * 0.25, r: 300, color: '0,240,255', o: 0.04 + Math.sin(tick * 0.008) * 0.015 },
        { x: w * 0.85, y: h * 0.65, r: 250, color: '0,200,150', o: 0.03 + Math.cos(tick * 0.006) * 0.012 },
        { x: w * 0.5, y: h * 0.85, r: 200, color: '180,100,255', o: 0.025 + Math.sin(tick * 0.01) * 0.01 },
      ];

      orbs.forEach(orb => {
        const g = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        g.addColorStop(0, `rgba(${orb.color}, ${orb.o})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });

      // Grid lines
      ctx.strokeStyle = 'rgba(0,240,255,0.035)';
      ctx.lineWidth = 0.5;
      const gW = 40, gH = 40;
      for (let x = 0; x <= w; x += gW) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += gH) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Grid node pulses
      gridNodes.forEach(node => {
        node.pulse += node.speed;
        const alpha = (Math.sin(node.pulse) + 1) / 2 * 0.3;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,240,255,${alpha})`;
        ctx.fill();
      });

      // Particles + connections
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.opacity})`;
        ctx.fill();
      });

      // Connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.12;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0,240,255,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Horizontal scan line
      const scanY = (tick * 0.5) % h;
      const scanGrad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 2);
      scanGrad.addColorStop(0, 'rgba(0,240,255,0)');
      scanGrad.addColorStop(1, 'rgba(0,240,255,0.05)');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 30, w, 32);

      animFrame = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  );
}