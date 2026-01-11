'use client';

import { GlassCard, Badge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { User } from '@/lib/types';

interface UsersTableProps {
  users: User[];
  isLoading: boolean;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onAddUser: () => void;
}

export function UsersTable({ users, isLoading, onEdit, onDelete, onAddUser }: UsersTableProps) {
  return (
    <GlassCard className="overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Gestion de Usuarios</h2>
        <button
          onClick={onAddUser}
          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-gradient-to-r from-white/20 to-white/5 border border-white/20 rounded-xl hover:from-white/30 hover:to-white/10 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo Usuario
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-white/5">
              <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Usuario</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Lab</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Creado</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-white/50">
                  Cargando usuarios...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-white/50">
                  No hay usuarios registrados
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-white whitespace-nowrap">
                    {user.username}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/90 whitespace-nowrap">
                    {user.nombre_completo || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/60 whitespace-nowrap">
                    {user.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={user.rol}>{user.rol}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/60 whitespace-nowrap">
                    {user.default_lab || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={user.activo ? 'active' : 'inactive'}>
                      {user.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/60 whitespace-nowrap">
                    {formatDate(user.creado_en)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-1">
                      <button
                        onClick={() => onEdit(user)}
                        className="p-2 text-white/50 hover:text-blue-400 hover:bg-white/10 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {user.activo && (
                        <button
                          onClick={() => onDelete(user)}
                          className="p-2 text-white/50 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                          title="Desactivar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
