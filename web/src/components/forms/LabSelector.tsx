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
            <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto glass-scrollbar pr-1">
                {labs.map((lab) => {
                    const isSelected = value === lab.lab_key;
                    return (
                        <button
                            key={lab.lab_key}
                            type="button"
                            onClick={() => onChange(lab.lab_key)}
                            className={`
                                w-full h-14 text-left transition-all duration-200 
                                focus:outline-none focus:ring-2 focus:ring-white/30
                                ${isSelected ? 'scale-[1.01]' : 'hover:scale-[1.005]'}
                            `}
                        >
                            <GlassCard
                                borderRadius="12px"
                                innerShadow={true}
                                liquidGlass={false}
                                className={`
                                    rounded-xl h-full px-5 cursor-pointer flex items-center
                                    ${isSelected
                                        ? 'ring-2 ring-white/50 bg-white/20'
                                        : 'hover:bg-white/10'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-4 w-full">
                                    {/* Selection indicator */}
                                    <div className={`
                                        w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                                        transition-all duration-200
                                        ${isSelected
                                            ? 'border-white bg-white'
                                            : 'border-white/40'
                                        }
                                    `}>
                                        {isSelected && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                                        )}
                                    </div>

                                    {/* Lab name */}
                                    <span className={`
                                        text-base font-medium transition-colors truncate
                                        ${isSelected ? 'text-white' : 'text-white/80'}
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
