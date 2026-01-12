'use client';

import { GlassCard } from '@/components/ui';
import { RegisterForm } from '@/components/forms/RegisterForm';

export default function HomePage() {
  return (
    <main className="flex items-center justify-center min-h-screen p-4">
      {/* Main Container */}
      <div className="max-w-2xl w-full beautiful-shadow">
        <GlassCard className="rounded-3xl flex flex-col overflow-hidden">
          {/* Top Section - Logo & Welcome */}
          <div className="h-auto flex flex-col text-center bg-black/10 p-8 items-center justify-center">
            {/* Logo */}
            <div className="mb-6 flex flex-col items-center">
              <img
                src="/cerper_logo.png"
                alt="CerperStats"
                className="w-28 h-28 object-contain mb-4"
              />
              <h1 className="leading-tight text-4xl sm:text-5xl font-normal text-white tracking-tighter mb-2">
                CerperStats
              </h1>
              <p className="leading-relaxed text-sm font-light text-white/80 max-w-sm mx-auto">
                Crea tu cuenta para acceder al sistema de gestion de laboratorio
              </p>
            </div>
          </div>

          {/* Bottom Section - Form */}
          <div className="flex-1 flex flex-col p-8 justify-start">
            <RegisterForm />
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
