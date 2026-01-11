'use client';

import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, hint, error, className, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-white/90 mb-2">
            {label}
            {hint && <span className="text-white/50 font-normal ml-1">{hint}</span>}
          </label>
        )}
        <div
          className={cn(
            'relative overflow-hidden rounded-xl',
            'bg-white/[0.08] border border-white/10',
            'transition-all duration-200',
            'focus-within:border-purple-500/50 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.2)]',
            error && 'border-red-500/50'
          )}
        >
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full px-4 py-3 text-sm text-white bg-transparent',
              'placeholder:text-white/40 outline-none',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';
