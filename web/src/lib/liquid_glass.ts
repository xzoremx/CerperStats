/**
 * Liquid Glass Effect - TypeScript Version for Next.js
 * 
 * Creates a backdrop distortion effect on the background behind an element
 * while keeping the content sharp and undistorted.
 */

export interface LiquidGlassOptions {
    cornerRadius?: number;
    displacementScale?: number;
    aberrationIntensity?: number;
    saturation?: number;
    blurAmount?: number;
    elasticity?: number;
    mode?: 'standard' | 'polar' | 'prominent' | 'shader' | 'edge';
    centerDistortion?: number;
    seed?: number;
    displacementMapUrl?: string;
    shaderMapUrl?: string;
}

interface LiquidGlassInstance {
    svg: SVGSVGElement;
    backdropLayer: HTMLDivElement;
    id: string;
    config: Required<LiquidGlassOptions>;
}

interface LiquidGlassController {
    destroy: () => void;
    updateConfig: (newConfig: Partial<LiquidGlassOptions>) => LiquidGlassController | null;
}

const instances = new Map<HTMLElement, LiquidGlassInstance>();
let idCounter = 0;

export const MODES = Object.freeze(['standard', 'polar', 'prominent', 'shader', 'edge'] as const);

function getDefaultConfig(): Required<LiquidGlassOptions> {
    return {
        cornerRadius: 28,
        displacementScale: 60,
        aberrationIntensity: 2,
        saturation: 140,
        blurAmount: 0,
        elasticity: 0.15,
        mode: 'standard',
        centerDistortion: 0.35,
        seed: 0,
        displacementMapUrl: '',
        shaderMapUrl: ''
    };
}

function createBackdropLayer(
    element: HTMLElement,
    filterId: string,
    config: Required<LiquidGlassOptions>
): HTMLDivElement {
    const backdrop = document.createElement('div');
    backdrop.className = 'liquid-glass-backdrop';
    backdrop.style.cssText = `
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    border-radius: ${config.cornerRadius}px;
    overflow: hidden;
  `;

    const effectLayer = document.createElement('div');
    const blurPx = Number.isFinite(config.blurAmount) && config.blurAmount > 0 ? config.blurAmount : 0;
    effectLayer.className = 'liquid-glass-effect';
    effectLayer.style.cssText = `
    position: absolute;
    inset: -20px;
    backdrop-filter: blur(${blurPx}px) saturate(${config.saturation}%);
    -webkit-backdrop-filter: blur(${blurPx}px) saturate(${config.saturation}%);
    filter: url(#${filterId});
    pointer-events: none;
  `;

    backdrop.appendChild(effectLayer);

    if (element.firstChild) {
        element.insertBefore(backdrop, element.firstChild);
    } else {
        element.appendChild(backdrop);
    }

    // Ensure all other children have proper z-index
    Array.from(element.children).forEach((child) => {
        if (child !== backdrop && child instanceof HTMLElement) {
            const childStyle = window.getComputedStyle(child);
            if (childStyle.position === 'static') {
                child.style.position = 'relative';
            }
            if (!child.style.zIndex || child.style.zIndex === 'auto') {
                child.style.zIndex = '1';
            }
        }
    });

    return backdrop;
}

function getDisplacementMap(config: Required<LiquidGlassOptions>, size: number): string {
    const modeRaw = String(config.mode ?? 'standard').toLowerCase();
    const mode = modeRaw === 'edges' ? 'edge' : modeRaw;

    const customMap = config.displacementMapUrl || config.shaderMapUrl || null;

    if (customMap && mode === 'shader') {
        return customMap;
    }

    const halfSize = size / 2;
    const invSize = 1 / size;
    const tau = Math.PI * 2;

    const centerDistortion = Math.max(0, Math.min(1, config.centerDistortion ?? 0.35));
    const seed = config.seed ?? 0;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const u = x * invSize;
            const v = y * invSize;

            const dx = x - halfSize;
            const dy = y - halfSize;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxDist = halfSize;
            const normalizedDist = Math.min(distance / maxDist, 1);
            const angle = Math.atan2(dy, dx);

            const edgeFactor = Math.pow(normalizedDist, 1.7);
            const strength = centerDistortion + (1 - centerDistortion) * edgeFactor;

            let deltaX = 0;
            let deltaY = 0;

            if (mode === 'edge') {
                const edge = Math.pow(normalizedDist, 2.5);
                const waveX = Math.sin(normalizedDist * Math.PI * 3 + seed) * 0.12;
                const waveY = Math.cos(normalizedDist * Math.PI * 3 + seed) * 0.12;
                deltaX = (Math.cos(angle) * edge * 0.5 + waveX) * 0.6;
                deltaY = (Math.sin(angle) * edge * 0.5 + waveY) * 0.6;
            } else if (mode === 'polar') {
                const radialWave = (
                    Math.sin(normalizedDist * tau * 2.6 + angle * 2.0 + seed * 0.7) +
                    Math.cos(normalizedDist * tau * 4.4 - angle * 3.1 + seed * 1.1) * 0.55
                ) / 1.55;
                const swirl = angle + radialWave * 0.85;
                const magnitude = (0.16 + 0.18 * edgeFactor) * strength;
                const surfaceNoise = (
                    Math.sin((u * tau * 3.3) + (v * tau * 2.1) + seed * 0.9) +
                    Math.sin((u * tau * 7.1) - (v * tau * 5.2) + seed * 1.6) * 0.5
                ) / 1.5;
                deltaX = Math.cos(swirl) * magnitude + surfaceNoise * 0.08 * strength;
                deltaY = Math.sin(swirl) * magnitude - surfaceNoise * 0.08 * strength;
            } else if (mode === 'prominent') {
                const baseX = (
                    Math.sin(u * tau * 1.1 + seed * 0.8) +
                    Math.cos(v * tau * 1.4 + seed * 1.1) +
                    Math.sin((u + v) * tau * 0.9 + seed * 0.6)
                ) / 3;
                const baseY = (
                    Math.cos(u * tau * 1.2 - seed * 0.7) +
                    Math.sin(v * tau * 1.3 + seed * 1.3) +
                    Math.cos((u - v) * tau * 1.0 + seed * 0.5)
                ) / 3;
                const qx = Math.round(baseX * 4) / 4;
                const qy = Math.round(baseY * 4) / 4;
                deltaX = qx * 0.32 * strength;
                deltaY = qy * 0.32 * strength;
            } else if (mode === 'shader') {
                const twist = Math.sin(normalizedDist * tau * 1.6 + seed * 0.9) * 0.9;
                const twistedAngle = angle + twist * 0.35;
                const noiseX = (
                    Math.sin((u * tau * 3.8) + (v * tau * 2.9) + seed * 0.8) +
                    Math.sin((u * tau * 8.4) - (v * tau * 6.6) + seed * 1.7) * 0.6 +
                    Math.sin((u * tau * 14.2) + (v * tau * 10.1) + seed * 2.4) * 0.25
                ) / 1.85;
                const noiseY = (
                    Math.cos((u * tau * 3.5) - (v * tau * 2.7) + seed * 1.0) +
                    Math.cos((u * tau * 7.6) + (v * tau * 8.1) + seed * 1.4) * 0.6 +
                    Math.cos((u * tau * 13.4) - (v * tau * 10.7) + seed * 2.1) * 0.25
                ) / 1.85;
                const magnitude = (0.14 + 0.22 * edgeFactor) * strength;
                deltaX = Math.cos(twistedAngle) * magnitude + noiseX * 0.14 * strength;
                deltaY = Math.sin(twistedAngle) * magnitude + noiseY * 0.14 * strength;
            } else {
                // 'standard'
                const noiseX = (
                    Math.sin((u * tau * 2.3) + (v * tau * 1.8) + seed * 0.7) +
                    Math.sin((u * tau * 5.7) - (v * tau * 4.1) + seed * 1.9) * 0.55 +
                    Math.sin((u * tau * 9.6) + (v * tau * 7.4) + seed * 2.6) * 0.25
                ) / 1.8;
                const noiseY = (
                    Math.cos((u * tau * 2.5) - (v * tau * 1.9) + seed * 1.1) +
                    Math.cos((u * tau * 4.9) + (v * tau * 6.2) + seed * 1.6) * 0.55 +
                    Math.cos((u * tau * 8.8) - (v * tau * 7.3) + seed * 2.2) * 0.25
                ) / 1.8;
                const radialX = Math.cos(angle);
                const radialY = Math.sin(angle);
                deltaX = (noiseX * 0.22 + radialX * 0.10) * strength;
                deltaY = (noiseY * 0.22 + radialY * 0.10) * strength;
            }

            const offsetX = Math.max(0, Math.min(1, 0.5 + deltaX));
            const offsetY = Math.max(0, Math.min(1, 0.5 + deltaY));

            const idx = (y * size + x) * 4;
            imageData.data[idx] = Math.round(offsetX * 255);
            imageData.data[idx + 1] = Math.round(offsetY * 255);
            imageData.data[idx + 2] = 128;
            imageData.data[idx + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
}

function createSVGFilter(filterId: string, config: Required<LiquidGlassOptions>): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'liquid-glass-svg');
    svg.style.cssText = 'position: absolute; width: 0; height: 0; pointer-events: none;';

    const size = 256;
    const displacementData = getDisplacementMap(config, size);

    svg.innerHTML = `
    <defs>
      <filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
        <feImage href="${displacementData}" result="dispMap" preserveAspectRatio="none"/>
        <feDisplacementMap in="SourceGraphic" in2="dispMap" 
          scale="${config.displacementScale}" 
          xChannelSelector="R" yChannelSelector="G" result="displaced"/>
        
        <!-- Chromatic aberration -->
        <feOffset in="displaced" dx="${config.aberrationIntensity}" dy="0" result="redChannel"/>
        <feOffset in="displaced" dx="0" dy="0" result="greenChannel"/>
        <feOffset in="displaced" dx="${-config.aberrationIntensity}" dy="0" result="blueChannel"/>
        
        <feColorMatrix in="redChannel" type="matrix" 
          values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="redOnly"/>
        <feColorMatrix in="greenChannel" type="matrix" 
          values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="greenOnly"/>
        <feColorMatrix in="blueChannel" type="matrix" 
          values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blueOnly"/>
        
        <feBlend in="redOnly" in2="greenOnly" mode="screen" result="rg"/>
        <feBlend in="rg" in2="blueOnly" mode="screen" result="final"/>
      </filter>
    </defs>
  `;

    return svg;
}

export function apply(element: HTMLElement, options: LiquidGlassOptions = {}): LiquidGlassController | null {
    if (!element) {
        console.error('[LiquidGlass] Element is required');
        return null;
    }

    const config: Required<LiquidGlassOptions> = { ...getDefaultConfig(), ...options };

    const id = `liquid-glass-${idCounter++}`;
    const filterId = `lg-filter-${id}`;

    const svg = createSVGFilter(filterId, config);
    document.body.appendChild(svg);

    const backdropLayer = createBackdropLayer(element, filterId, config);

    // Make sure element has proper positioning
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.position === 'static') {
        element.style.position = 'relative';
    }
    element.style.overflow = 'hidden';

    instances.set(element, { svg, backdropLayer, id, config });

    return {
        destroy: () => destroy(element),
        updateConfig: (newConfig) => updateConfig(element, newConfig)
    };
}

function updateConfig(element: HTMLElement, newConfig: Partial<LiquidGlassOptions>): LiquidGlassController | null {
    const instance = instances.get(element);
    if (!instance) return null;

    const mergedConfig = { ...instance.config, ...newConfig };
    destroy(element);
    return apply(element, mergedConfig);
}

export function destroy(element: HTMLElement): void {
    const instance = instances.get(element);
    if (instance) {
        instance.svg.remove();
        instance.backdropLayer.remove();
        instances.delete(element);
    }
}

export function destroyAll(): void {
    instances.forEach((_, element) => {
        destroy(element);
    });
}

// Default export for convenience
const LiquidGlass = {
    apply,
    destroy,
    destroyAll,
    MODES
};

export default LiquidGlass;
