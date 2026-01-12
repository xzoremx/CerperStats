'use client';

import { useEffect, useRef, RefObject } from 'react';
import { apply, destroy, LiquidGlassOptions } from './liquid_glass';

/**
 * React hook to apply Liquid Glass effect to an element
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const glassRef = useLiquidGlass({ mode: 'standard', blurAmount: 8 });
 *   return <div ref={glassRef}>Content</div>;
 * }
 * ```
 */
export function useLiquidGlass<T extends HTMLElement = HTMLDivElement>(
    options: LiquidGlassOptions = {}
): RefObject<T> {
    const ref = useRef<T>(null);
    const optionsRef = useRef(options);

    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const controller = apply(element, optionsRef.current);

        return () => {
            if (controller) {
                controller.destroy();
            } else {
                destroy(element);
            }
        };
    }, []);

    return ref;
}

export default useLiquidGlass;
