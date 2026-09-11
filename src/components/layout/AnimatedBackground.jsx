import React, { useEffect, useRef } from 'react';

// Calm, premium ambient backdrop: a soft aurora + a faint drifting particle
// field. Deliberately quiet so the data and UI are the heroes. Honors
// prefers-reduced-motion (renders a static aurora with no animation).
export default function AnimatedBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animFrame, w, h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Fewer, slower, softer particles — a quiet constellation.
    const N = 26;
    const particles = Array.from({ length: N }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.14,
      vy: (Math.random() - 0.5) * 0.14,
      size: Math.random() * 1.4 + 0.4,
      opacity: Math.random() * 0.35 + 0.08,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(90, 220, 245, ${p.opacity})`;
        ctx.fill();
      }
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < 140) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(90, 220, 245, ${(1 - dist / 140) * 0.07})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      animFrame = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(animFrame); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-0 app-aurora" aria-hidden />
      <div className="fixed inset-0 pointer-events-none z-0 bg-grid-pattern opacity-70" aria-hidden />
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" style={{ opacity: 0.5 }} aria-hidden />
      {/* Soft vignette to focus the eye toward the centre content */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden
        style={{ background: 'radial-gradient(120% 80% at 50% 0%, transparent 55%, hsl(222 50% 3% / 0.55) 100%)' }} />
    </>
  );
}
