'use client';

import { GlassButton } from '@/components/ui';

interface HeaderProps {
  adminName: string;
  onLogout: () => void;
}

export function Header({ adminName, onLogout }: HeaderProps) {
  return (
    <header className="bg-white/5 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-white"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">CerperStats Admin</h1>
            <p className="text-xs text-white/50">Panel de Administracion</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/70 text-sm">{adminName}</span>
          <GlassButton variant="secondary" onClick={onLogout} className="px-4 py-2 text-sm">
            Cerrar Sesion
          </GlassButton>
        </div>
      </div>
    </header>
  );
}
