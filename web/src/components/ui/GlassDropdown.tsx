'use client';

import { useState, useRef, useEffect } from 'react';
import { GlassCard } from './GlassCard';

interface Option {
  value: string;
  label: string;
}

interface GlassDropdownProps {
  label?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function GlassDropdown({
  label,
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...'
}: GlassDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="w-full relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-white mb-2">{label}</label>
      )}

      <div
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer transition-transform active:scale-[0.98]"
      >
        <GlassCard borderRadius="12px" innerShadow={false} className="rounded-xl">
          <div
            className="absolute inset-0 z-20 pointer-events-none"
            style={{
              boxShadow: 'inset 1px 1px 1px 0 rgba(255, 255, 255, 0.3), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.1)',
              borderRadius: '12px'
            }}
          />
          <div className="z-30 relative w-full px-4 py-3 text-sm text-white flex items-center justify-between">
            <span className={selectedOption ? 'text-white' : 'text-white/40'}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              className={`text-white/50 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </GlassCard>
      </div>

      {/* Dropdown Menu */}
      <div
        className={`absolute top-full left-0 right-0 z-[60] mt-2 transition-all duration-300 origin-top ${isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'
          }`}
      >
        {/* Glass menu matching header style */}
        <div className="relative rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl border border-white/10">
          {/* Gradient background matching header */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/[0.06] to-black/20" />

          <div className="relative py-2 max-h-60 overflow-y-auto glass-scrollbar">
            {options.map((option) => (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${value === option.value
                  ? 'bg-white/20 text-white font-semibold'
                  : 'text-white/90 hover:bg-white/10'
                  }`}
              >
                {option.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
