'use client';

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

type BadgeVariant = 'admin' | 'supervisor' | 'analista' | 'active' | 'inactive';

interface BadgeProps {
  children: ReactNode;
  variant: BadgeVariant;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  admin: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  supervisor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  analista: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  inactive: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export function Badge({ children, variant, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5',
        'text-xs font-medium rounded-full border capitalize',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
