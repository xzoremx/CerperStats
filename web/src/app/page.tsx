'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui';
import { RegisterForm } from '@/components/forms/RegisterForm';

export default function HomePage() {
  const [isSuccessView, setIsSuccessView] = useState(false);

  return (
    <main className="flex items-center justify-center min-h-screen p-4">
      {/* Main Container */}
      <div className="max-w-2xl w-full beautiful-shadow">
        <GlassCard className="rounded-3xl flex flex-col" allowOverflow>
          {/* Top Section - Logo & Welcome (hidden on success) */}
          {!isSuccessView && (
            <div className="relative h-auto flex flex-col text-center p-6 sm:p-8 items-center justify-center rounded-t-3xl border-b border-white/10 overflow-hidden">
              {/* Subtle background */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/[0.06] to-black/10" />
              <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
              <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-purple-300/10 blur-3xl" />

              <div className="relative z-10 flex flex-col items-center">
                {/* Logo */}
                <img
                  src="/cerper_logo.png"
                  alt="CerperStats"
                  className="w-36 h-36 sm:w-40 sm:h-40 object-contain mb-4 opacity-95 drop-shadow-[0_12px_36px_rgba(0,0,0,0.35)]"
                />

                <h1 className="leading-[1.05] text-4xl sm:text-5xl font-light text-slate-100 tracking-[0.06em] mb-2">
                  CerperStats
                </h1>

                <p className="leading-relaxed text-sm font-normal text-slate-200/70 max-w-lg mx-auto">
                  Crea tu cuenta para acceder al sistema de gestión de laboratorio
                </p>
              </div>
            </div>
          )}

          {/* Bottom Section - Form */}
          <div className={`flex-1 flex flex-col justify-start ${isSuccessView ? 'p-0' : 'p-8'}`}>
            <RegisterForm onSuccessChange={setIsSuccessView} />
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
