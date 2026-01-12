'use client';

import { useState, useEffect, FormEvent } from 'react';
import { GlassInput, GlassDropdown, GlassButton, useToast } from '@/components/ui';
import { fetchLabs, registerUser } from '@/lib/api';
import type { Lab } from '@/lib/types';

const roleOptions = [
  { value: 'analista', label: 'Analista' },
  { value: 'supervisor', label: 'Supervisor / Responsable de Laboratorio' },
];

export function RegisterForm() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [labs, setLabs] = useState<Lab[]>([]);

  const [formData, setFormData] = useState({
    username: '',
    nombre_completo: '',
    email: '',
    password: '',
    passwordConfirm: '',
    rol: '',
    default_lab: '',
  });

  useEffect(() => {
    fetchLabs().then((res) => {
      if (res.ok && res.data) {
        setLabs(res.data);
      }
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (formData.username.length < 3) {
      showToast('El usuario debe tener al menos 3 caracteres');
      return;
    }

    if (!formData.nombre_completo) {
      showToast('El nombre completo es requerido');
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

    if (!formData.rol) {
      showToast('Selecciona un rol');
      return;
    }

    setIsLoading(true);

    try {
      const res = await registerUser({
        username: formData.username,
        password: formData.password,
        nombre_completo: formData.nombre_completo,
        email: formData.email || undefined,
        rol: formData.rol as 'analista' | 'supervisor',
        default_lab: formData.default_lab || undefined,
      });

      if (res.ok) {
        setIsSuccess(true);
      } else {
        const errorMessages: Record<string, string> = {
          username_exists: 'El nombre de usuario ya existe',
          email_exists: 'El correo electronico ya esta registrado',
          username_password_required: 'Usuario y contrasena son requeridos',
          password_too_short: 'La contrasena es muy corta',
          username_too_short: 'El usuario es muy corto',
          invalid_username_format: 'Formato de usuario invalido',
          too_many_attempts: 'Demasiados intentos. Espera 15 minutos.',
        };
        showToast(errorMessages[res.error || ''] || 'Error al crear la cuenta');
      }
    } catch {
      showToast('Error de conexion. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const labOptions = labs.map((lab) => ({
    value: lab.lab_key,
    label: lab.nombre || lab.lab_key,
  }));

  // Success state
  if (isSuccess) {
    return (
      <div className="text-center py-8 animate-in">
        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6 shadow-xl border border-white/40">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-semibold text-white mb-4">Cuenta Creada</h2>
        <p className="text-white/70 mb-8 max-w-xs mx-auto">
          Tu cuenta ha sido registrada exitosamente. Ya puedes iniciar sesion en la aplicacion.
        </p>
        <button
          onClick={() => {
            setIsSuccess(false);
            setFormData({
              username: '',
              nombre_completo: '',
              email: '',
              password: '',
              passwordConfirm: '',
              rol: '',
              default_lab: '',
            });
          }}
          className="text-white/50 hover:text-white/70 text-sm transition-colors"
        >
          Registrar otra cuenta
        </button>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-medium text-white mb-1">Crear Cuenta</h2>
        <p className="text-sm font-normal text-white/60">Completa tus datos para registrarte</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Usuario"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            minLength={3}
            placeholder="ej: jperez"
            autoComplete="username"
          />
          <GlassInput
            label="Nombre Completo"
            name="nombre_completo"
            value={formData.nombre_completo}
            onChange={handleChange}
            required
            placeholder="Juan Perez Garcia"
          />
        </div>

        <GlassInput
          label="Correo Electronico"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="jperez@empresa.com"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Contrasena"
            hint="(min. 6)"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
            placeholder="******"
            autoComplete="new-password"
          />
          <GlassInput
            label="Confirmar Contrasena"
            name="passwordConfirm"
            type="password"
            value={formData.passwordConfirm}
            onChange={handleChange}
            required
            minLength={6}
            placeholder="******"
            autoComplete="new-password"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassDropdown
            label="Rol"
            options={roleOptions}
            value={formData.rol}
            onChange={(value) => setFormData((prev) => ({ ...prev, rol: value }))}
            placeholder="Seleccionar rol"
          />
          <GlassDropdown
            label="Laboratorio"
            options={labOptions}
            value={formData.default_lab}
            onChange={(value) => setFormData((prev) => ({ ...prev, default_lab: value }))}
            placeholder="Seleccionar laboratorio"
          />
        </div>

        <GlassButton type="submit" isLoading={isLoading} className="mt-6">
          <span>Crear Cuenta</span>
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
