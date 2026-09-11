import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function GlowCard({ children, className, glowColor = 'primary', hover = true, tactical = false, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={cn(
        'rounded-xl border bg-card/70 backdrop-blur-sm p-5 surface-raised transition-colors duration-200',
        tactical
          ? 'border-primary/25 hud-corners hover:border-primary/50'
          : hover
          ? 'border-border/60 hover:border-primary/35'
          : 'border-border/60',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
