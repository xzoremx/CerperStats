'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { GlassInput, GlassSelect, GlassButton, useToast } from '@/components/ui';
import { fetchLabs, registerUser } from '@/lib/api';
import type { Lab } from '@/lib/types';

const roleOptions = [
  { value: 'analista', label: 'Analista' },
  { value: 'supervisor', label: 'Supervisor / Responsable de Laboratorio' },
];

export function RegisterForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [labs, setLabs] = useState<Lab[]>([]);

  const [formData, setFormData] = useState({
    username: '',
    nombre_completo: '',
    email: '',
    password: '',
    passwordConfirm: '',
    rol: 'analista',
    default_lab: '',
  });

  useEffect(() => {
    fetchLabs().then((res) => {
      if (res.ok && res.data) {
        setLabs(res.data);
      }
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validaciones
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
        showToast('Cuenta creada exitosamente! Redirigiendo...', 'success');
        setTimeout(() => router.push('/'), 2000);
      } else {
        const errorMessages: Record<string, string> = {
          username_exists: 'El nombre de usuario ya existe',
          email_exists: 'El correo electronico ya esta registrado',
          username_password_required: 'Usuario y contrasena son requeridos',
          password_too_short: 'La contrasena es muy corta',
          username_too_short: 'El usuario es muy corto',
          invalid_username_format: 'Formato de usuario invalido',
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        placeholder="ej: Juan Perez Garcia"
      />

      <GlassInput
        label="Correo Electronico"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="ej: jperez@empresa.com"
      />

      <GlassInput
        label="Contrasena"
        hint="(min. 6 caracteres)"
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

      <GlassSelect
        label="Rol"
        name="rol"
        value={formData.rol}
        onChange={handleChange}
        options={roleOptions}
        required
      />

      <GlassSelect
        label="Laboratorio"
        name="default_lab"
        value={formData.default_lab}
        onChange={handleChange}
        options={labOptions}
        placeholder="-- Seleccionar laboratorio --"
      />

      <div className="pt-4">
        <GlassButton type="submit" isLoading={isLoading} className="w-full">
          Crear Cuenta
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </GlassButton>
      </div>
    </form>
  );
}
