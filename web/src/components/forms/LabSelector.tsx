'use client';

import { GlassCard } from '@/components/ui';
import type { Lab } from '@/lib/types';

interface LabSelectorProps {
    labs: Lab[];
    value: string;
    onChange: (labKey: string) => void;
}

export function LabSelector({ labs, value, onChange }: LabSelectorProps) {
    if (labs.length === 0) {
        return (
            <div className="text-center py-4 text-white/50 text-sm">
                Cargando laboratorios...
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-white">
                Selecciona tu Laboratorio
            </label>
            <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto glass-scrollbar pr-1">
                {labs.map((lab) => {
                    const isSelected = value === lab.lab_key;
                    return (
                        <button
                            key={lab.lab_key}
                            type="button"
                            onClick={() => onChange(lab.lab_key)}
                            className={`
                                w-full h-11 text-left transition-all duration-200 
                                focus:outline-none focus:ring-2 focus:ring-white/30
                                ${isSelected ? 'scale-[1.01]' : 'hover:scale-[1.005]'}
                            `}
                        >
                            <GlassCard
                                borderRadius="10px"
                                innerShadow={true}
                                liquidGlass={{
                                    mode: 'standard',
                                    blurAmount: isSelected ? 14 : 8,
                                    displacementScale: isSelected ? 40 : 25,
                                    cornerRadius: 10
                                }}
                                className={`
                                    rounded-[10px] h-full px-4 cursor-pointer flex items-center
                                    ${isSelected
                                        ? 'ring-2 ring-white/50 bg-white/15'
                                        : 'hover:bg-white/5'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3 w-full">
                                    {/* Selection indicator */}
                                    <div className={`
                                        w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                                        transition-all duration-200
                                        ${isSelected
                                            ? 'border-white bg-white'
                                            : 'border-white/40'
                                        }
                                    `}>
                                        {isSelected && (
                                            <div className="w-2 h-2 rounded-full bg-slate-800" />
                                        )}
                                    </div>

                                    {/* Lab name */}
                                    <span className={`
                                        text-sm font-medium transition-colors truncate
                                        ${isSelected ? 'text-white' : 'text-white/70'}
                                    `}>
                                        {lab.nombre || lab.lab_key}
                                    </span>
                                </div>
                            </GlassCard>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
