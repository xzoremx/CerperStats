'use client';

import { useMemo, useState } from 'react';
import { GlassCard } from '@/components/ui';
import type { Lab } from '@/lib/types';

interface LabSelectorProps {
  labs: Lab[];
  loading?: boolean;
  value: string;
  onChange: (labKey: string) => void;
}

export function LabSelector({ labs, loading = false, value, onChange }: LabSelectorProps) {
  const [query, setQuery] = useState('');

  const filteredLabs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return labs;
    return labs.filter((lab) => {
      const name = (lab.nombre || '').toLowerCase();
      const key = (lab.lab_key || '').toLowerCase();
      return name.includes(q) || key.includes(q);
    });
  }, [labs, query]);

  const selectedLab = useMemo(() => {
    return value ? labs.find((lab) => lab.lab_key === value) : undefined;
  }, [labs, value]);

  const Header = (
    <div className="flex items-end justify-between gap-3">
      <label className="block text-sm font-medium text-white">Laboratorio</label>
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/50">Opcional</span>
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs text-white/70 hover:text-white underline underline-offset-4"
          >
            Limpiar
          </button>
        ) : null}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {Header}
        <GlassCard borderRadius="16px" liquidGlass={false} className="rounded-2xl">
          <div className="p-5 text-center text-white/50 text-sm">Cargando laboratorios...</div>
        </GlassCard>
      </div>
    );
  }

  if (!loading && labs.length === 0) {
    return (
      <div className="space-y-3">
        {Header}
        <GlassCard borderRadius="16px" liquidGlass={false} className="rounded-2xl">
          <div className="p-5 text-center text-white/50 text-sm">No hay laboratorios disponibles</div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Header}

      <GlassCard borderRadius="16px" liquidGlass={false} className="rounded-2xl">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <GlassCard borderRadius="12px" innerShadow={false} liquidGlass={false} className="rounded-xl">
                <div className="px-4 py-3 flex items-center gap-3">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    className="text-white/40 flex-shrink-0"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35" />
                    <circle cx="11" cy="11" r="7" strokeWidth="2" />
                  </svg>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar laboratorio..."
                    className="bg-transparent w-full text-sm text-white placeholder-white/40 focus:outline-none"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="text-white/50 hover:text-white/80 transition-colors"
                      aria-label="Limpiar búsqueda"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              </GlassCard>
            </div>

            <div className="text-xs text-white/50 tabular-nums whitespace-nowrap">
              {filteredLabs.length}/{labs.length}
            </div>
          </div>

          <div className="max-h-[260px] overflow-y-auto glass-scrollbar pr-1">
            {filteredLabs.length === 0 ? (
              <div className="py-10 text-center text-white/50 text-sm">No se encontraron laboratorios</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredLabs.map((lab) => {
                  const isSelected = value === lab.lab_key;
                  return (
                    <button
                      key={lab.lab_key}
                      type="button"
                      onClick={() => onChange(isSelected ? '' : lab.lab_key)}
                      className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-2xl"
                      aria-pressed={isSelected}
                    >
                      <GlassCard
                        borderRadius="14px"
                        innerShadow={false}
                        liquidGlass={false}
                        className={`rounded-2xl transition-colors ${
                          isSelected ? 'bg-white/20 ring-2 ring-white/40' : 'hover:bg-white/10'
                        }`}
                      >
                        <div className="px-4 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">
                              {lab.nombre || lab.lab_key}
                            </div>
                            <div className="text-xs text-white/50 truncate">{lab.lab_key}</div>
                          </div>
                          <div
                            className={`flex-shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${
                              isSelected ? 'border-white/50 bg-white/20' : 'border-white/20 bg-white/10'
                            }`}
                            aria-hidden="true"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              className={isSelected ? 'text-white' : 'text-white/30'}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M20 6L9 17l-5-5"
                              />
                            </svg>
                          </div>
                        </div>
                      </GlassCard>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-white/50">Seleccionado</span>
            <span className="text-xs text-white/80 font-medium truncate">
              {selectedLab ? selectedLab.nombre || selectedLab.lab_key : '—'}
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
