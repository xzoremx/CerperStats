'use client';

import { useMemo, useState } from 'react';
import { GlassCard } from '@/components/ui';
import type { Lab } from '@/lib/types';

interface LabSelectorProps {
  labs: Lab[];
  loading?: boolean;
  value: string[];
  onChange: (labKeys: string[]) => void;
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

  const selectedLabs = useMemo(() => {
    return labs.filter((lab) => value.includes(lab.lab_key));
  }, [labs, value]);

  const maxLabsReached = value.length >= 2;

  const Header = (
    <div className="flex items-end justify-between gap-3">
      <label className="block text-sm font-medium text-white">
        Laboratorios <span className="text-xs font-normal text-white/50">(máximo 2)</span>
      </label>
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/50">
          {value.length > 0 ? `${value.length}/2 seleccionados` : 'Opcional'}
        </span>
        {value.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
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
                  const isSelected = value.includes(lab.lab_key);
                  const canSelect = !maxLabsReached || isSelected;
                  return (
                    <button
                      key={lab.lab_key}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          onChange(value.filter((k) => k !== lab.lab_key));
                        } else if (canSelect) {
                          onChange([...value, lab.lab_key]);
                        }
                      }}
                      disabled={!canSelect}
                      className={`text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-2xl ${
                        !canSelect ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      aria-pressed={isSelected}
                    >
                      <GlassCard
                        borderRadius="14px"
                        innerShadow={false}
                        liquidGlass={false}
                        className={`rounded-2xl transition-colors ${
                          isSelected ? 'bg-white/20 ring-2 ring-white/40' : canSelect ? 'hover:bg-white/10' : ''
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

          {selectedLabs.length > 0 ? (
            <div className="space-y-2">
              <span className="text-xs text-white/50">Seleccionados:</span>
              <div className="flex flex-wrap gap-2">
                {selectedLabs.map((lab) => (
                  <div
                    key={lab.lab_key}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm"
                  >
                    <span className="text-xs text-white font-medium">{lab.nombre || lab.lab_key}</span>
                    <button
                      type="button"
                      onClick={() => onChange(value.filter((k) => k !== lab.lab_key))}
                      className="text-white/60 hover:text-white transition-colors"
                      aria-label={`Quitar ${lab.nombre || lab.lab_key}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-2">
              <span className="text-xs text-white/50">Ningún laboratorio seleccionado</span>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
