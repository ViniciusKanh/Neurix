import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function GlowCard({ children, className, glowColor = 'primary', hover = true, tactical = false, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'rounded-lg border bg-card/70 backdrop-blur-sm p-5 transition-all duration-250',
        tactical
          ? 'border-primary/20 hud-corners hover:border-primary/50 hover:glow-primary'
          : hover
          ? 'border-border/40 hover:border-primary/30 hover:bg-card/90'
          : 'border-border/40',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}