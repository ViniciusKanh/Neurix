import React from 'react';
import { motion } from 'framer-motion';

export default function PageHeader({ title, subtitle, actions, icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary flex-shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-mono text-primary/50 uppercase tracking-[0.3em]">SYS://</span>
            <h1 className="text-xl font-bold text-foreground tracking-wide font-display">{title}</h1>
          </div>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5 font-mono">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </motion.div>
  );
}