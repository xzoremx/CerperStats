'use client';

import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, ReactNode } from 'react';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

export function GlassButton({
  children,
  variant = 'primary',
  isLoading,
  className,
  disabled,
  ...props
}: GlassButtonProps) {
  const variants = {
    primary: cn(
      'bg-gradient-to-r from-white/20 to-white/5',
      'border border-white/20',
      'hover:from-white/30 hover:to-white/10',
      'hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)]'
    ),
    secondary: cn(
      'bg-white/5 border border-white/10',
      'hover:bg-white/10',
      'text-white/70'
    ),
    danger: cn(
      'bg-gradient-to-r from-red-500/80 to-red-600/80',
      'border border-red-500/50',
      'hover:from-red-500/90 hover:to-red-600/90'
    ),
  };

  return (
    <button
      className={cn(
        'relative px-6 py-3 rounded-xl',
        'text-sm font-semibold text-white',
        'backdrop-blur-lg transition-all duration-200',
        'hover:-translate-y-0.5',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
        variants[variant],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      <span className={cn('flex items-center justify-center gap-2', isLoading && 'opacity-0')}>
        {children}
      </span>
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
    </button>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  );
}
