'use client';

import { useEffect, useState, FormEvent } from 'react';
import { GlassInput, GlassDropdown, GlassButton, useToast } from '@/components/ui';
import { fetchLabs, registerUser } from '@/lib/api';
import { LabSelector } from './LabSelector';
import type { Lab } from '@/lib/types';

const sedeOptions = [
  { value: 'Paita', label: 'Paita' },
  { value: 'Chimbote', label: 'Chimbote' },
  { value: 'Arequipa', label: 'Arequipa' },
  { value: 'Callao', label: 'Callao' },
];

interface RegisterFormProps {
  onSuccessChange?: (isSuccess: boolean) => void;
}

export function RegisterForm({ onSuccessChange }: RegisterFormProps) {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccessState] = useState(false);
  const [assignedUsername, setAssignedUsername] = useState<string | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labsLoading, setLabsLoading] = useState(true);

  const [formData, setFormData] = useState({
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    password: '',
    passwordConfirm: '',
    sede: '',
    default_lab: [] as string[],
  });

  useEffect(() => {
    let cancelled = false;
    setLabsLoading(true);
    fetchLabs()
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data) {
          setLabs(res.data);
        } else {
          setLabs([]);
        }
      })
      .catch((err) => {
        console.error('[WEB] Error cargando labs:', err);
        if (!cancelled) showToast('No se pudieron cargar los laboratorios');
      })
      .finally(() => {
        if (!cancelled) setLabsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const passwordsMatch =
    formData.password.length >= 6 &&
    formData.passwordConfirm.length >= 6 &&
    formData.password === formData.passwordConfirm;

  const setIsSuccess = (value: boolean) => {
    setIsSuccessState(value);
    onSuccessChange?.(value);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.nombres.trim() || !formData.apellido_paterno.trim() || !formData.apellido_materno.trim()) {
      showToast('Ingresa nombres y dos apellidos');
      return;
    }

    if (formData.password.length < 6) {
      showToast('La contrasena debe tener al menos 6 caracteres');
      return;
    }

    if (formData.password !== formData.passwordConfirm) {
      showToast('Las contrasenas no coinciden');
      return;
    }

    if (!formData.sede) {
      showToast('Selecciona una sede');
      return;
    }

    const nombre_completo = [
      formData.nombres.trim(),
      formData.apellido_paterno.trim(),
      formData.apellido_materno.trim(),
    ]
      .filter(Boolean)
      .join(' ');

    setIsLoading(true);

    try {
      const res = await registerUser({
        password: formData.password,
        nombre_completo,
        sede: formData.sede as 'Paita' | 'Chimbote' | 'Arequipa' | 'Callao',
        default_lab: formData.default_lab.length > 0 ? formData.default_lab : undefined,
      });

      if (res.ok) {
        setAssignedUsername(res.data?.username || null);
        setIsSuccess(true);
      } else {
        const errorMessages: Record<string, string> = {
          username_password_required: 'Usuario y contrasena son requeridos',
          password_too_short: 'La contrasena es muy corta',
          invalid_full_name: 'Ingresa nombres y dos apellidos',
          invalid_sede: 'Sede no valida',
          invalid_default_lab: 'Laboratorio no valido',
          too_many_attempts: 'Demasiados intentos. Espera 15 minutos.',
        };
        showToast(errorMessages[res.error || ''] || 'Error al enviar el registro');
      }
    } catch {
      showToast('Error de conexion. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 animate-in min-h-[400px]">
        <div className="relative mb-8">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-[0_0_50px_rgba(74,222,128,0.5)] animate-pulse">
            <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-green-400/30 animate-ping" />
        </div>

        <h2 className="text-4xl font-bold text-slate-200 mb-4 text-center">Registro recibido</h2>
        <p className="text-lg text-slate-300/70 mb-12 text-center max-w-md">
          Tu cuenta debe ser aprobada por un administrador antes de poder iniciar sesion.
        </p>

        {assignedUsername ? (
          <div className="w-full max-w-md text-center">
            <p className="text-sm text-slate-300/60 mb-3">Tu usuario asignado es:</p>
            <div className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-xl">
              <span className="font-mono text-lg text-slate-100 tracking-[0.08em]">{assignedUsername}</span>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="animate-in">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Nombres"
            name="nombres"
            value={formData.nombres}
            onChange={handleChange}
            required
            placeholder="ej: Rosa"
            autoComplete="given-name"
          />
          <GlassInput
            label="Apellido Paterno"
            name="apellido_paterno"
            value={formData.apellido_paterno}
            onChange={handleChange}
            required
            placeholder="ej: Chávez"
            autoComplete="family-name"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Apellido Materno"
            name="apellido_materno"
            value={formData.apellido_materno}
            onChange={handleChange}
            required
            placeholder="ej: Alarcón"
            autoComplete="additional-name"
          />
          <GlassDropdown
            label="Sede"
            options={sedeOptions}
            value={formData.sede}
            onChange={(value) => setFormData((prev) => ({ ...prev, sede: value }))}
            placeholder="Seleccionar sede"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Contraseña"
            hint="(min. 6)"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
            placeholder="******"
            autoComplete="new-password"
            isSuccess={passwordsMatch}
          />
          <GlassInput
            label="Confirmar Contraseña"
            name="passwordConfirm"
            type="password"
            value={formData.passwordConfirm}
            onChange={handleChange}
            required
            minLength={6}
            placeholder="******"
            autoComplete="new-password"
            isSuccess={passwordsMatch}
          />
        </div>

        <LabSelector
          labs={labs}
          loading={labsLoading}
          value={formData.default_lab}
          onChange={(value) => setFormData((prev) => ({ ...prev, default_lab: value }))}
        />

        <GlassButton type="submit" isLoading={isLoading} className="mt-6">
          <span>Enviar Registro</span>
          <svg
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className="group-hover:translate-x-1 transition-transform"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </GlassButton>
      </form>
    </div>
  );
}
