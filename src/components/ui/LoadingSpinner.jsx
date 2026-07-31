import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LoadingSpinner({ className, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Loader2 className={cn("w-8 h-8 text-primary animate-spin", className)} />
      {text && <p className="text-sm text-muted-foreground animate-pulse">{text}</p>}
    </div>
  );
}