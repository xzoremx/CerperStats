'use client';

import { cn } from '@/lib/utils';
import { SelectHTMLAttributes, forwardRef } from 'react';

interface Option {
  value: string;
  label: string;
}

interface GlassSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[];
  placeholder?: string;
  error?: string;
}

export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(
  ({ label, options, placeholder, error, className, id, ...props }, ref) => {
    const selectId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-white/90 mb-2">
            {label}
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
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full px-4 py-3 text-sm text-white bg-transparent',
              'appearance-none outline-none cursor-pointer',
              '[&>option]:bg-slate-900 [&>option]:text-white',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" className="text-white/50">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      </div>
    );
  }
);

GlassSelect.displayName = 'GlassSelect';
