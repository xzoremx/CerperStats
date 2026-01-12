'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
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
  if (variant === 'secondary') {
    return (
      <button
        className={cn(
          'w-full py-3 px-4 rounded-xl border border-white/20 text-white text-sm font-medium',
          'hover:bg-white/5 transition-all',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      className={cn(
        'group relative w-full overflow-hidden rounded-xl cursor-pointer',
        'transition-all hover:scale-[1.01] active:scale-[0.99]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {/* Background blur */}
      <div className="absolute z-0 inset-0 backdrop-blur-sm glass-filter" />

      {/* Gradient overlay */}
      <div className="z-10 absolute inset-0 bg-gradient-to-r from-white/30 to-white/20 group-hover:from-white/40 transition-all" />

      {/* Inner shadow */}
      <div
        className="absolute inset-0 z-20"
        style={{
          boxShadow: 'inset 2px 2px 1px 0 rgba(255, 255, 255, 0.5), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.3)',
          borderRadius: '12px'
        }}
      />

      {/* Content */}
      <div className={cn(
        'z-30 relative w-full py-3 px-4 flex gap-2 text-sm font-semibold text-white items-center justify-center',
        isLoading && 'opacity-0'
      )}>
        {children}
      </div>

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </button>
  );
}
