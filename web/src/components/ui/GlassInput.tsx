'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { GlassCard } from './GlassCard';

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  /** Show green neon success state */
  isSuccess?: boolean;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, hint, id, isSuccess, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-white mb-2">
            {label}
            {hint && <span className="text-white/50 font-normal ml-1">{hint}</span>}
          </label>
        )}
        <GlassCard
          borderRadius="12px"
          innerShadow={false}
          className={`rounded-xl transition-all duration-300 ${isSuccess ? 'ring-2 ring-green-400 shadow-[0_0_20px_rgba(74,222,128,0.4)]' : ''
            }`}
        >
          {/* Specific shadow for inputs */}
          <div
            className={`absolute inset-0 z-20 pointer-events-none transition-all duration-300`}
            style={{
              boxShadow: isSuccess
                ? 'inset 1px 1px 1px 0 rgba(74, 222, 128, 0.5), inset -1px -1px 1px 1px rgba(74, 222, 128, 0.3)'
                : 'inset 1px 1px 1px 0 rgba(255, 255, 255, 0.3), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.1)',
              borderRadius: '12px'
            }}
          />
          <input
            ref={ref}
            id={inputId}
            {...props}
            className={`z-30 relative bg-transparent w-full px-4 py-3 text-sm placeholder-white/40 border-none focus:outline-none transition-colors ${isSuccess ? 'text-green-300' : 'text-white'
              }`}
          />
        </GlassCard>
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';
