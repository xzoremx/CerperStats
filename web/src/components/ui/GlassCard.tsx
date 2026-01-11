'use client';

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        'bg-white/10 backdrop-blur-xl',
        'border border-white/15 rounded-2xl',
        'shadow-[0_8px_32px_rgba(0,0,0,0.2)]',
        className
      )}
    >
      {children}
    </div>
  );
}
