import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {Icon && (
        <div className="relative mb-5">
          <div className="absolute inset-0 blur-2xl rounded-full bg-primary/15" aria-hidden />
          <div className="relative w-16 h-16 rounded-2xl grid place-items-center
                          bg-gradient-to-br from-primary/15 to-accent/10 border border-primary/25 text-primary">
            <Icon className="w-7 h-7" />
          </div>
        </div>
      )}
      <h3 className="font-display text-lg font-semibold text-foreground mb-1.5">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-5">{description}</p>}
      {action}
    </div>
  );
}
