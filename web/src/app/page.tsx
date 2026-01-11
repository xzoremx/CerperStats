'use client';

import Link from 'next/link';
import { GlassCard, GlassButton } from '@/components/ui';

export default function LandingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <GlassCard className="max-w-md w-full p-8 text-center">
        {/* Logo */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">CerperStats</h1>
          <p className="text-white/60 text-sm">
            Sistema de gestion de analisis de laboratorio
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link href="/register" className="block">
            <GlassButton className="w-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              Crear Cuenta
            </GlassButton>
          </Link>

          <Link href="/admin" className="block">
            <GlassButton variant="secondary" className="w-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Panel de Administracion
            </GlassButton>
          </Link>
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-white/40">
          Sistema desarrollado para la gestion de ensayos y competencias de laboratorio
        </p>
      </GlassCard>
    </main>
  );
}
