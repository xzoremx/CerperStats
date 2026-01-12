'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  innerShadow?: boolean;
  borderRadius?: string;
  allowOverflow?: boolean;
}

export function GlassCard({
  children,
  className = '',
  innerShadow = true,
  borderRadius = '24px',
  allowOverflow = false
}: GlassCardProps) {
  return (
    <div className={cn('relative', !allowOverflow && 'overflow-hidden', className)}>
      {/* Background blur and distortion filter */}
      <div className="absolute z-0 inset-0 backdrop-blur-md glass-filter overflow-hidden isolate" />

      {/* Translucent overlay */}
      <div className="z-10 absolute inset-0 bg-white/15" />

      {/* Inner highlight/border effect */}
      {innerShadow && (
        <div
          className="absolute inset-0 z-20 overflow-hidden pointer-events-none"
          style={{
            boxShadow: 'inset 2px 2px 1px 0 rgba(255, 255, 255, 0.5), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.5)',
            borderRadius
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-30 h-full w-full">
        {children}
      </div>
    </div>
  );
}
