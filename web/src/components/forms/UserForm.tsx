'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Modal, ModalHeader, GlassInput, GlassSelect, GlassButton, useToast } from '@/components/ui';
import { createUser, updateUser, fetchAdminLabs } from '@/lib/api';
import type { User, Lab } from '@/lib/types';

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSuccess: () => void;
}

const roleOptions = [
  { value: 'analista', label: 'Analista' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'admin', label: 'Administrador' },
];

export function UserForm({ isOpen, onClose, user, onSuccess }: UserFormProps) {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    nombre_completo: '',
    email: '',
    rol: 'analista',
    default_lab: '',
    activo: true,
  });

  useEffect(() => {
    fetchAdminLabs().then((res) => {
      if (res.ok && res.data) {
        setLabs(res.data);
      }
    });
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        password: '',
        nombre_completo: user.nombre_completo || '',
        email: user.email || '',
        rol: user.rol,
        default_lab: user.default_lab || '',
        activo: user.activo,
      });
    } else {
      setFormData({
        username: '',
        password: '',
        nombre_completo: '',
        email: '',
        rol: 'analista',
        default_lab: '',
        activo: true,
      });
    }
    setError('');
  }, [user, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.username.length < 3) {
      setError('El usuario debe tener al menos 3 caracteres');
      return;
    }

    if (!user && formData.password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres');
      return;
    }

    if (user && formData.password && formData.password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres');
      return;
    }

    setIsLoading(true);

    try {
      let res;
      if (user) {
        // Update
        const payload: Record<string, unknown> = {
          nombre_completo: formData.nombre_completo,
          email: formData.email,
          rol: formData.rol,
          default_lab: formData.default_lab || null,
          activo: formData.activo,
        };
        if (formData.password) {
          payload.password = formData.password;
        }
        res = await updateUser(user.id, payload);
      } else {
        // Create
        res = await createUser({
          username: formData.username,
          password: formData.password,
          nombre_completo: formData.nombre_completo,
          email: formData.email,
          rol: formData.rol as 'admin' | 'supervisor' | 'analista',
          default_lab: formData.default_lab || null,
        });
      }

      if (res.ok) {
        showToast(user ? 'Usuario actualizado' : 'Usuario creado', 'success');
        onSuccess();
        onClose();
      } else {
        const errorMessages: Record<string, string> = {
          username_exists: 'El nombre de usuario ya existe',
          password_too_short: 'La contrasena es muy corta',
        };
        setError(errorMessages[res.error || ''] || 'Error al guardar usuario');
      }
    } catch {
      setError('Error de conexion');
    } finally {
      setIsLoading(false);
    }
  };

  const labOptions = labs.map((lab) => ({
    value: lab.lab_key,
    label: lab.nombre || lab.lab_key,
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader onClose={onClose}>{user ? 'Editar Usuario' : 'Nuevo Usuario'}</ModalHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Usuario"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            minLength={3}
            placeholder="ej: jperez"
            disabled={!!user}
          />
          <GlassInput
            label="Contrasena"
            hint={user ? '(dejar vacio para mantener)' : '(min. 6)'}
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required={!user}
            minLength={!user ? 6 : undefined}
            placeholder="******"
          />
        </div>

        <GlassInput
          label="Nombre Completo"
          name="nombre_completo"
          value={formData.nombre_completo}
          onChange={handleChange}
          placeholder="ej: Juan Perez Garcia"
        />

        <GlassInput
          label="Email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="ej: jperez@empresa.com"
        />

        <div className="grid grid-cols-2 gap-4">
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
            placeholder="-- Sin asignar --"
          />
        </div>

        {user && (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="activo"
              checked={formData.activo}
              onChange={handleChange}
              className="w-5 h-5 rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
            />
            <span className="text-white/90">Usuario Activo</span>
          </label>
        )}

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <div className="flex gap-3 pt-4">
          <GlassButton type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </GlassButton>
          <GlassButton type="submit" isLoading={isLoading} className="flex-1">
            {user ? 'Guardar Cambios' : 'Crear Usuario'}
          </GlassButton>
        </div>
      </form>
    </Modal>
  );
}
