'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

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
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-200 mb-2">
            {label}
            {hint && <span className="text-slate-400/70 font-normal ml-1">{hint}</span>}
          </label>
        )}
        <div
          className={`
            relative rounded-xl overflow-hidden transition-all duration-300
            backdrop-blur-md bg-white/10
            ${isSuccess
              ? 'ring-2 ring-green-400 shadow-[0_0_20px_rgba(74,222,128,0.4)]'
              : ''
            }
          `}
        >
          {/* Inner highlight */}
          <div
            className="absolute inset-0 pointer-events-none rounded-xl"
            style={{
              boxShadow: isSuccess
                ? 'inset 1px 1px 1px 0 rgba(74, 222, 128, 0.4), inset -1px -1px 1px 0 rgba(74, 222, 128, 0.2)'
                : 'inset 1px 1px 1px 0 rgba(255, 255, 255, 0.25), inset -1px -1px 1px 0 rgba(255, 255, 255, 0.1)'
            }}
          />
          <input
            ref={ref}
            id={inputId}
            {...props}
            className={`
              relative bg-transparent w-full px-4 py-3 text-sm 
              placeholder-slate-400/50 border-none focus:outline-none 
              transition-colors
              ${isSuccess ? 'text-green-300' : 'text-slate-200'}
            `}
          />
        </div>
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';
