'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { GlassCard } from './GlassCard';

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, hint, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-white mb-2">
            {label}
            {hint && <span className="text-white/50 font-normal ml-1">{hint}</span>}
          </label>
        )}
        <GlassCard borderRadius="12px" innerShadow={false} className="rounded-xl">
          {/* Specific shadow for inputs */}
          <div
            className="absolute inset-0 z-20 pointer-events-none"
            style={{
              boxShadow: 'inset 1px 1px 1px 0 rgba(255, 255, 255, 0.3), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.1)',
              borderRadius: '12px'
            }}
          />
          <input
            ref={ref}
            id={inputId}
            {...props}
            className="z-30 relative bg-transparent w-full px-4 py-3 text-sm placeholder-white/40 text-white border-none focus:outline-none"
          />
        </GlassCard>
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';
