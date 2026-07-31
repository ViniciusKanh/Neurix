import React from 'react';
import { cn } from '@/lib/utils';

// Hexagonal neural-mesh mark. Colors follow the app theme via CSS variables,
// so it always matches the chosen accent color.
export function ModaraLogoMark({ size = 32, className }) {
  const cx = 20, cy = 20, r = 14;
  const verts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const uid = React.useId().replace(/:/g, '');

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none"
      xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id={`g-${uid}`} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))' }} />
          <stop offset="100%" style={{ stopColor: 'hsl(var(--accent))' }} />
        </linearGradient>
        <filter id={`glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <g filter={`url(#glow-${uid})`} stroke={`url(#g-${uid})`} strokeWidth="1.4" strokeLinecap="round">
        {/* hexagon perimeter */}
        {verts.map((p, i) => {
          const q = verts[(i + 1) % 6];
          return <line key={`p${i}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} strokeOpacity="0.85" />;
        })}
        {/* spokes to center */}
        {verts.map((p, i) => (
          <line key={`s${i}`} x1={cx} y1={cy} x2={p[0]} y2={p[1]} strokeOpacity="0.55" />
        ))}
      </g>

      {/* nodes */}
      {verts.map((p, i) => (
        <circle key={`n${i}`} cx={p[0]} cy={p[1]} r="1.9" fill={`url(#g-${uid})`} />
      ))}
      <circle cx={cx} cy={cy} r="3" fill={`url(#g-${uid})`} filter={`url(#glow-${uid})`} />
      <circle cx={cx} cy={cy} r="1.2" fill="hsl(var(--background))" />
    </svg>
  );
}

export function ModaraWordmark({ collapsed = false, className }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 rounded-xl bg-primary/25 blur-md scale-125 pointer-events-none" />
        <ModaraLogoMark size={32} className="relative" />
      </div>
      {!collapsed && (
        <div className="overflow-hidden min-w-0 leading-none">
          <p className="font-display font-extrabold text-[15px] tracking-[0.22em]">
            <span className="text-gradient-primary">NEURIX</span>
          </p>
          <p className="text-[7px] text-primary/45 font-mono uppercase tracking-[0.3em] mt-0.5">
            ML Workbench
          </p>
        </div>
      )}
    </div>
  );
}

export const NeurixLogoMark = ModaraLogoMark;
export const NeurixWordmark = ModaraWordmark;
