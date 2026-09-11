import React from 'react';
import { motion } from 'framer-motion';

export default function PageHeader({ title, subtitle, actions, icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="mb-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          {Icon && (
            <div className="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 text-primary
                            bg-gradient-to-br from-primary/15 to-accent/10 border border-primary/25
                            shadow-[0_0_22px_-8px_hsl(var(--primary)/0.6)]">
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground leading-none truncate">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2.5 flex-shrink-0">{actions}</div>}
      </div>
      <div className="rule-gradient mt-4" />
    </motion.div>
  );
}
