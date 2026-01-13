'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  innerShadow?: boolean;
  borderRadius?: string;
  allowOverflow?: boolean;
  /** Liquid Glass effect - currently simplified for performance */
  liquidGlass?: boolean | object;
}

export function GlassCard({
  children,
  className = '',
  innerShadow = true,
  borderRadius = '24px',
  allowOverflow = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  liquidGlass = true
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'relative backdrop-blur-xl bg-white/15',
        !allowOverflow && 'overflow-hidden',
        className
      )}
      style={{ borderRadius }}
    >
      {/* Subtle border */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius,
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}
      />

      {/* Inner highlight/border effect */}
      {innerShadow && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 1px 1px 0 0 rgba(255, 255, 255, 0.15), inset -1px -1px 0 0 rgba(255, 255, 255, 0.05)',
            borderRadius
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 h-full w-full">
        {children}
      </div>
    </div>
  );
}
