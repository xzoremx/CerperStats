'use client';

import { GlassCard } from '@/components/ui';
import { RegisterForm } from '@/components/forms/RegisterForm';

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <GlassCard className="max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-black/10 pt-8 px-8 pb-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
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
          <h1 className="text-3xl font-semibold text-white tracking-tight mb-2">CerperStats</h1>
          <p className="text-sm font-light text-white/70">Crea tu cuenta para acceder al sistema</p>
        </div>

        {/* Form */}
        <div className="p-8 pt-6">
          <RegisterForm />
        </div>
      </GlassCard>
    </main>
  );
}
