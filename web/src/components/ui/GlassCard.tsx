'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { apply, destroy, LiquidGlassOptions } from '@/lib/liquid_glass';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  innerShadow?: boolean;
  borderRadius?: string;
  allowOverflow?: boolean;
  /** Liquid Glass effect options. Set to false to disable the effect. */
  liquidGlass?: LiquidGlassOptions | false;
}

export function GlassCard({
  children,
  className = '',
  innerShadow = true,
  borderRadius = '24px',
  allowOverflow = false,
  liquidGlass = {}
}: GlassCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || liquidGlass === false) return;

    // Extract numeric corner radius for Liquid Glass
    const cornerRadiusNum = parseInt(borderRadius, 10) || 24;

    const controller = apply(element, {
      cornerRadius: cornerRadiusNum,
      blurAmount: 12,
      mode: 'standard',
      displacementScale: 40,
      aberrationIntensity: 1.5,
      saturation: 120,
      centerDistortion: 0.3,
      ...liquidGlass
    });

    return () => {
      if (controller) {
        controller.destroy();
      } else {
        destroy(element);
      }
    };
  }, [liquidGlass, borderRadius]);

  return (
    <div
      ref={containerRef}
      className={cn('relative', !allowOverflow && 'overflow-hidden', className)}
      style={{ borderRadius }}
    >
      {/* Translucent overlay for extra glass effect */}
      <div
        className="z-10 absolute inset-0 bg-white/10 pointer-events-none"
        style={{ borderRadius }}
      />

      {/* Inner highlight/border effect */}
      {innerShadow && (
        <div
          className="absolute inset-0 z-20 overflow-hidden pointer-events-none"
          style={{
            boxShadow: 'inset 1px 1px 1px 0 rgba(255, 255, 255, 0.4), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.2)',
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
