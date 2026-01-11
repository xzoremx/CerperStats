'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GlassCard, GlassInput, GlassButton } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Ingrese usuario y contrasena');
      return;
    }

    setIsLoading(true);

    const result = await login(username, password);

    if (result.ok) {
      router.push('/admin');
    } else {
      const errorMessages: Record<string, string> = {
        not_admin: 'El usuario no tiene permisos de administrador',
        invalid_admin_password: 'Contrasena incorrecta',
        auth_failed: 'Error de autenticacion',
        connection_error: 'Error de conexion',
      };
      setError(errorMessages[result.error || ''] || 'Error de autenticacion');
    }

    setIsLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <GlassCard className="max-w-md w-full p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-white"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Panel de Administracion</h1>
          <p className="text-white/60 text-sm">Ingresa con credenciales de administrador</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <GlassInput
            label="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            placeholder="admin"
          />
          <GlassInput
            label="Contrasena"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="******"
          />

          <GlassButton type="submit" isLoading={isLoading} className="w-full mt-6">
            Iniciar Sesion
          </GlassButton>

          {error && <p className="text-red-400 text-sm text-center mt-2">{error}</p>}
        </form>

        {/* Footer */}
        <div className="text-center mt-6 pt-4 border-t border-white/10">
          <Link href="/" className="text-white/50 text-sm hover:text-white/70 transition-colors">
            Volver al inicio
          </Link>
        </div>
      </GlassCard>
    </main>
  );
}
