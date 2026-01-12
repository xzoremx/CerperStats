'use client';

import { GlassCard } from '@/components/ui';
import { RegisterForm } from '@/components/forms/RegisterForm';

export default function HomePage() {
  return (
    <main className="flex items-center justify-center min-h-screen p-4">
      {/* Main Container */}
      <div className="max-w-2xl w-full beautiful-shadow">
        <GlassCard className="rounded-3xl flex flex-col" allowOverflow>
          {/* Top Section - Logo & Welcome */}
          <div className="h-auto flex flex-col text-center bg-black/10 p-10 items-center justify-center rounded-t-3xl">
            {/* Logo */}
            <div className="mb-8 flex flex-col items-center">
              <img
                src="/cerper_logo.png"
                alt="CerperStats"
                className="w-48 h-48 object-contain mb-6"
              />
              <h1 className="leading-tight text-5xl sm:text-6xl font-normal text-white tracking-tighter mb-3">
                CerperStats
              </h1>
              <p className="leading-relaxed text-base font-light text-white/80 max-w-md mx-auto">
                Crea tu cuenta para acceder al sistema de gestión de laboratorio
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
